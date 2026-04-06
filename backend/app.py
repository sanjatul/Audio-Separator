import os
import shutil
import subprocess
import sys
from datetime import datetime
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from werkzeug.utils import secure_filename

app = FastAPI(title="VocalLift API", version="1.0.0")

# CORS — allow Next.js dev server and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"
CONVERTED_FOLDER = "converted"
ALLOWED_EXTENSIONS = {"wav", "mp3", "flac", "ogg", "m4a", "aac", "mp4", "wma"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)


def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def cleanup_all():
    for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, CONVERTED_FOLDER]:
        if os.path.exists(folder):
            shutil.rmtree(folder)
        os.makedirs(folder, exist_ok=True)


def find_ffmpeg() -> str | None:
    import shutil as sh
    found = sh.which("ffmpeg")
    if found:
        return found
    winget_path = os.path.expandvars(
        r"%LOCALAPPDATA%\Microsoft\WinGet\Packages"
        r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
        r"\ffmpeg-8.1-full_build\bin\ffmpeg.exe"
    )
    if os.path.exists(winget_path):
        return winget_path
    return None


def ffmpeg_to_wav(input_path: str, output_path: str) -> tuple[bool, str]:
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        return False, "ffmpeg not found"
    cmd = [
        ffmpeg, "-y",
        "-i", input_path,
        "-ar", "44100",
        "-ac", "2",
        "-sample_fmt", "s16",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        return False, result.stderr[-800:]
    return True, ""


def get_patch_script() -> str:
    return """
import sys, types
import torchaudio
import soundfile as sf
import torch

def _load(uri, *args, **kwargs):
    data, sr = sf.read(str(uri), dtype="float32", always_2d=True)
    tensor = torch.from_numpy(data.T)
    return tensor, sr

def _save(uri, src, sample_rate, *args, **kwargs):
    import numpy as np
    wav = src.numpy()
    if wav.ndim == 2:
        wav = wav.T
    sf.write(str(uri), wav, sample_rate, subtype="PCM_16")

torchaudio.load = _load
torchaudio.save = _save

from demucs.__main__ import main
main()
"""


@app.get("/health")
def health():
    try:
        r = subprocess.run(
            [sys.executable, "-m", "demucs", "--help"],
            capture_output=True, text=True, timeout=10
        )
        demucs_ok = r.returncode == 0
    except Exception:
        demucs_ok = False

    return {
        "status": "ok",
        "demucs_available": demucs_ok,
        "ffmpeg_available": find_ffmpeg() is not None
    }


@app.post("/extract")
async def extract_vocals(audio: UploadFile = File(...)):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    if not allowed_file(audio.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    if not find_ffmpeg():
        raise HTTPException(
            status_code=500,
            detail="ffmpeg not found. Install it and add to PATH. See README."
        )

    cleanup_all()

    filename = secure_filename(audio.filename)
    input_path = os.path.join(UPLOAD_FOLDER, filename)

    with open(input_path, "wb") as f:
        content = await audio.read()
        f.write(content)

    base_name = os.path.splitext(filename)[0]
    wav_path = os.path.join(CONVERTED_FOLDER, base_name + ".wav")

    ok, err = ffmpeg_to_wav(input_path, wav_path)
    if not ok:
        raise HTTPException(status_code=500, detail=f"ffmpeg conversion failed:\n{err}")

    patch_path = os.path.join(CONVERTED_FOLDER, "_patch_and_run.py")
    with open(patch_path, "w") as f:
        f.write(get_patch_script())

    cmd = [
        sys.executable, patch_path,
        "--two-stems=vocals",
        "-n", "htdemucs",
        "--out", OUTPUT_FOLDER,
        wav_path
    ]

    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=500, detail="Demucs timed out (>10 min). Try a shorter file.")
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="Demucs not found. Run: pip install demucs")

    if result.returncode != 0:
        error_msg = result.stderr[-1500:] if result.stderr else "Unknown error"
        raise HTTPException(status_code=500, detail=f"Demucs failed:\n{error_msg}")

    vocals_path = None
    no_vocals_path = None
    for root, dirs, files in os.walk(OUTPUT_FOLDER):
        for f in files:
            full = os.path.join(root, f)
            if f == "vocals.wav":
                vocals_path = full
            elif f == "no_vocals.wav":
                no_vocals_path = full

    if not vocals_path:
        raise HTTPException(status_code=500, detail="Vocals file not found after processing.")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    return JSONResponse({
        "vocals_url": f"/download/vocals?ts={ts}&base={base_name}",
        "no_vocals_url": f"/download/no_vocals?ts={ts}&base={base_name}" if no_vocals_path else None,
        "vocals_name": f"{base_name}_vocals_{ts}.wav",
        "no_vocals_name": f"{base_name}_no_vocals_{ts}.wav" if no_vocals_path else None,
    })


@app.get("/download/vocals")
def download_vocals(base: str = "output", ts: str = ""):
    vocals_path = None
    for root, dirs, files in os.walk(OUTPUT_FOLDER):
        for f in files:
            if f == "vocals.wav":
                vocals_path = os.path.join(root, f)
                break
        if vocals_path:
            break
    if not vocals_path:
        raise HTTPException(status_code=404, detail="Vocals file not found.")
    return FileResponse(
        vocals_path,
        media_type="audio/wav",
        filename=f"{base}_vocals_{ts}.wav"
    )


@app.get("/download/no_vocals")
def download_no_vocals(base: str = "output", ts: str = ""):
    no_vocals_path = None
    for root, dirs, files in os.walk(OUTPUT_FOLDER):
        for f in files:
            if f == "no_vocals.wav":
                no_vocals_path = os.path.join(root, f)
                break
        if no_vocals_path:
            break
    if not no_vocals_path:
        raise HTTPException(status_code=404, detail="No-vocals file not found.")
    return FileResponse(
        no_vocals_path,
        media_type="audio/wav",
        filename=f"{base}_no_vocals_{ts}.wav"
    )