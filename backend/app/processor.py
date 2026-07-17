import asyncio
import os
import sys
import shutil
import subprocess
import logging
from typing import Optional, Dict

logger = logging.getLogger(__name__)


def _find_ffmpeg() -> str:
    """Locate ffmpeg, checking PATH first, then common Windows install paths."""
    found = shutil.which("ffmpeg")
    if found:
        return found
    winget_path = os.path.expandvars(
        r"%LOCALAPPDATA%\Microsoft\WinGet\Packages"
        r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
        r"\ffmpeg-8.1-full_build\bin\ffmpeg.exe"
    )
    if os.path.exists(winget_path):
        return winget_path
    return "ffmpeg"


def _find_executable(name: str) -> str:
    """Locate a CLI tool on PATH, return full path or the bare name as fallback."""
    found = shutil.which(name)
    return found if found else name


class AudioProcessor:
    def __init__(self, task_id: str, storage_root: str = "storage/tasks"):
        self.task_id = task_id
        self.task_dir = os.path.join(storage_root, task_id)
        self.is_cancelled = False
        self.current_process: Optional[asyncio.subprocess.Process] = None

    # ------------------------------------------------------------------
    # Command execution
    # ------------------------------------------------------------------
    async def _run_command(self, cmd: list[str]) -> bool:
        if self.is_cancelled:
            return False

        cmd_str = " ".join(cmd)
        logger.info(f"[{self.task_id}] Running: {cmd_str[:200]}")

        try:
            self.current_process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await self.current_process.communicate()

            if self.current_process.returncode != 0:
                err_text = stderr.decode(errors="replace")[-1500:]
                logger.error(
                    f"[{self.task_id}] Command failed (exit {self.current_process.returncode}):\n{err_text}"
                )
                return False

            logger.info(f"[{self.task_id}] Command succeeded.")
            return True
        except NotImplementedError as e:
            logger.warning(
                f"[{self.task_id}] asyncio subprocess unsupported, falling back: {e}"
            )
            return await self._run_command_fallback(cmd)
        except FileNotFoundError as e:
            logger.error(f"[{self.task_id}] Executable not found: {cmd[0]} - {e}")
            return False
        except asyncio.CancelledError:
            self.cancel()
            raise
        except Exception as e:
            logger.error(
                f"[{self.task_id}] Exception running command: {type(e).__name__}: {e}"
            )
            return False
        finally:
            self.current_process = None

    async def _run_command_fallback(self, cmd: list[str]) -> bool:
        if self.is_cancelled:
            return False
        try:
            completed = await asyncio.to_thread(
                subprocess.run,
                cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                check=False,
            )
            if completed.returncode != 0:
                err_text = completed.stderr.decode(errors="replace")[-1500:]
                logger.error(
                    f"[{self.task_id}] Fallback failed (exit {completed.returncode}):\n{err_text}"
                )
                return False
            logger.info(f"[{self.task_id}] Fallback command succeeded.")
            return True
        except FileNotFoundError as e:
            logger.error(f"[{self.task_id}] Executable not found in fallback: {cmd[0]} - {e}")
            return False
        except Exception as e:
            logger.error(
                f"[{self.task_id}] Fallback exception: {type(e).__name__}: {e}"
            )
            return False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def cancel(self):
        self.is_cancelled = True
        if self.current_process:
            try:
                self.current_process.kill()
            except Exception as e:
                logger.error(f"Failed to kill process: {e}")

    def cleanup(self):
        if os.path.exists(self.task_dir):
            try:
                shutil.rmtree(self.task_dir)
            except Exception as e:
                logger.error(f"Failed to cleanup task dir {self.task_dir}: {e}")

    # ------------------------------------------------------------------
    # Public entry points
    # ------------------------------------------------------------------
    async def process_youtube(self, url: str, status_callback=None) -> Dict[str, str]:
        os.makedirs(self.task_dir, exist_ok=True)
        raw_audio_path = os.path.join(self.task_dir, "raw_audio.%(ext)s")

        logger.info("Starting yt-dlp extraction...")
        if status_callback:
            await status_callback("downloading")

        yt_dlp_bin = _find_executable("yt-dlp")
        yt_cmd = [
            yt_dlp_bin,
            "-x", "--audio-format", "wav",
            "-o", raw_audio_path,
            url,
        ]
        if not await self._run_command(yt_cmd):
            return {"status": "error", "message": "Failed to download from YouTube"}

        actual_path = os.path.join(self.task_dir, "raw_audio.wav")
        if not os.path.exists(actual_path):
            for f in os.listdir(self.task_dir):
                if f.startswith("raw_audio"):
                    actual_path = os.path.join(self.task_dir, f)
                    break

        return await self._process_pipeline(actual_path, status_callback=status_callback)

    async def process_file(self, file_path: str, status_callback=None) -> Dict[str, str]:
        os.makedirs(self.task_dir, exist_ok=True)
        return await self._process_pipeline(file_path, status_callback=status_callback)

    # ------------------------------------------------------------------
    # Internal pipeline
    # ------------------------------------------------------------------
    async def _process_pipeline(self, input_audio_path: str, status_callback=None) -> Dict[str, str]:
        converted_path = os.path.join(self.task_dir, "converted.wav")

        # 1. FFmpeg -> resample to 44.1 kHz stereo WAV
        logger.info("Starting FFmpeg conversion...")
        if status_callback:
            await status_callback("converting")

        ffmpeg_bin = _find_ffmpeg()
        ffmpeg_cmd = [
            ffmpeg_bin, "-y", "-i", input_audio_path,
            "-ar", "44100", "-ac", "2", converted_path,
        ]
        if not await self._run_command(ffmpeg_cmd):
            return {"status": "error", "message": "Failed audio conversion"}

        # 2. Demucs htdemucs 2-stem separation
        logger.info("Starting Demucs separation...")
        if status_callback:
            await status_callback("separating")

        demucs_out_dir = os.path.join(self.task_dir, "demucs_out")
        wrapper_path = os.path.join(os.path.dirname(__file__), "_demucs_wrapper.py")
        demucs_cmd = [
            sys.executable, wrapper_path,
            "--two-stems=vocals", "-n", "htdemucs",
            "--out", demucs_out_dir, converted_path,
        ]
        if not await self._run_command(demucs_cmd):
            return {"status": "error", "message": "Failed stem separation"}

        base_name = "converted"
        vocals_path = os.path.join(demucs_out_dir, "htdemucs", base_name, "vocals.wav")
        instrumental_path = os.path.join(demucs_out_dir, "htdemucs", base_name, "no_vocals.wav")

        if not os.path.exists(vocals_path):
            return {"status": "error", "message": "Vocals file not produced"}

        # 3. DeepFilterNet vocal enhancement
        logger.info("Starting DeepFilterNet enhancement...")
        if status_callback:
            await status_callback("enhancing")

        enhanced_vocals_path = os.path.join(self.task_dir, "enhanced_vocals.wav")
        deepfilter_bin = _find_executable("deepFilter")
        dfn_cmd = [deepfilter_bin, vocals_path, "-o", self.task_dir]

        if not await self._run_command(dfnn_cmd if False else dfn_cmd):
            logger.warning("DeepFilterNet failed, falling back to original vocals")
            shutil.copy(vocals_path, enhanced_vocals_path)
        else:
            dfn_output = os.path.join(self.task_dir, "vocals_DeepFilterNet3.wav")
            if os.path.exists(dfn_output):
                os.rename(dfn_output, enhanced_vocals_path)
            else:
                shutil.copy(vocals_path, enhanced_vocals_path)

        # Copy instrumental to task root
        final_instrumental_wav = os.path.join(self.task_dir, "instrumental.wav")
        if os.path.exists(instrumental_path):
            shutil.copy(instrumental_path, final_instrumental_wav)

        # 4. Convert WAV files to MP3
        logger.info("Converting to MP3...")
        if status_callback:
            await status_callback("converting_to_mp3")

        final_vocals_mp3 = os.path.join(self.task_dir, "vocals.mp3")
        final_instrumental_mp3 = os.path.join(self.task_dir, "instrumental.mp3")

        mp3_bitrate = "192k"

        vocals_mp3_cmd = [
            ffmpeg_bin, "-y", "-i", enhanced_vocals_path,
            "-codec:a", "libmp3lame", "-b:a", mp3_bitrate,
            final_vocals_mp3,
        ]
        if not await self._run_command(vocals_mp3_cmd):
            return {"status": "error", "message": "Failed to convert vocals to MP3"}

        instrumental_mp3_cmd = [
            ffmpeg_bin, "-y", "-i", final_instrumental_wav,
            "-codec:a", "libmp3lame", "-b:a", mp3_bitrate,
            final_instrumental_mp3,
        ]
        if not await self._run_command(instrumental_mp3_cmd):
            return {"status": "error", "message": "Failed to convert instrumental to MP3"}

        return {
            "status": "success",
            "vocals_path": final_vocals_mp3,
            "instrumental_path": final_instrumental_mp3,
        }
