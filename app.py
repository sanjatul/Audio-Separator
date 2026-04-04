# import os
# import shutil
# import subprocess
# import sys
# from flask import Flask, request, jsonify, send_file, render_template
# from werkzeug.utils import secure_filename

# app = Flask(__name__)

# UPLOAD_FOLDER = "uploads"
# OUTPUT_FOLDER = "outputs"
# CONVERTED_FOLDER = "converted"
# ALLOWED_EXTENSIONS = {"wav", "mp3", "flac", "ogg", "m4a", "aac", "mp4", "wma"}

# os.makedirs(UPLOAD_FOLDER, exist_ok=True)
# os.makedirs(OUTPUT_FOLDER, exist_ok=True)
# os.makedirs(CONVERTED_FOLDER, exist_ok=True)


# def allowed_file(filename):
#     return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# def cleanup_all():
#     for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, CONVERTED_FOLDER]:
#         if os.path.exists(folder):
#             shutil.rmtree(folder)
#         os.makedirs(folder, exist_ok=True)


# def find_ffmpeg():
#     """Return ffmpeg executable path - checks PATH then known WinGet location."""
#     import shutil as sh
#     found = sh.which("ffmpeg")
#     if found:
#         return found
#     winget_path = os.path.expandvars(
#         r"%LOCALAPPDATA%\Microsoft\WinGet\Packages"
#         r"\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe"
#         r"\ffmpeg-8.1-full_build\bin\ffmpeg.exe"
#     )
#     if os.path.exists(winget_path):
#         return winget_path
#     return None


# def ffmpeg_to_wav(input_path, output_path):
#     ffmpeg = find_ffmpeg()
#     if not ffmpeg:
#         return False, "ffmpeg not found"
#     cmd = [
#         ffmpeg, "-y",
#         "-i", input_path,
#         "-ar", "44100",
#         "-ac", "2",
#         "-sample_fmt", "s16",
#         output_path
#     ]
#     result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
#     if result.returncode != 0:
#         return False, result.stderr[-800:]
#     return True, ""


# def get_patch_script():
#     """
#     Returns Python code that monkey-patches torchaudio to use soundfile
#     for both load() and save(), bypassing TorchCodec entirely.
#     This script is prepended to the demucs invocation via -c.
#     """
#     return """
# import sys, types

# # Patch torchaudio before demucs imports it
# import torchaudio
# import soundfile as sf
# import torch

# def _load(uri, *args, **kwargs):
#     data, sr = sf.read(str(uri), dtype="float32", always_2d=True)
#     tensor = torch.from_numpy(data.T)  # (channels, samples)
#     return tensor, sr

# def _save(uri, src, sample_rate, *args, **kwargs):
#     import numpy as np
#     wav = src.numpy()
#     if wav.ndim == 2:
#         wav = wav.T  # (samples, channels)
#     sf.write(str(uri), wav, sample_rate, subtype="PCM_16")

# torchaudio.load = _load
# torchaudio.save = _save

# # Now run demucs normally
# from demucs.__main__ import main
# main()
# """


# @app.route("/")
# def index():
#     return render_template("index.html")


# @app.route("/extract", methods=["POST"])
# def extract_vocals():
#     if "audio" not in request.files:
#         return jsonify({"error": "No audio file provided."}), 400

#     file = request.files["audio"]

#     if file.filename == "":
#         return jsonify({"error": "No file selected."}), 400

#     if not allowed_file(file.filename):
#         return jsonify({"error": f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

#     if not find_ffmpeg():
#         return jsonify({"error": "ffmpeg not found. See README for install instructions."}), 500

#     cleanup_all()

#     filename = secure_filename(file.filename)
#     input_path = os.path.join(UPLOAD_FOLDER, filename)
#     file.save(input_path)

#     # Step 1: convert to WAV with ffmpeg (bypasses torchaudio load)
#     base_name = os.path.splitext(filename)[0]
#     wav_path = os.path.join(CONVERTED_FOLDER, base_name + ".wav")

#     ok, err = ffmpeg_to_wav(input_path, wav_path)
#     if not ok:
#         return jsonify({"error": f"ffmpeg conversion failed:\n{err}"}), 500

#     # Step 2: write the patch script to a temp file
#     patch_path = os.path.join(CONVERTED_FOLDER, "_patch_and_run.py")
#     with open(patch_path, "w") as f:
#         f.write(get_patch_script())

#     # Step 3: run demucs via the patch script
#     # sys.argv is simulated by passing args after the script
#     cmd = [
#         sys.executable, patch_path,
#         "--two-stems=vocals",
#         "-n", "htdemucs",
#         "--out", OUTPUT_FOLDER,
#         wav_path
#     ]

#     try:
#         result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
#     except subprocess.TimeoutExpired:
#         return jsonify({"error": "Demucs timed out (>10 min). Try a shorter file."}), 500
#     except FileNotFoundError:
#         return jsonify({"error": "Demucs not found. Run: pip install demucs"}), 500

#     if result.returncode != 0:
#         error_msg = result.stderr[-1500:] if result.stderr else "Unknown error"
#         return jsonify({"error": f"Demucs failed:\n{error_msg}"}), 500

#     # Find vocals.wav
#     vocals_path = None
#     for root, dirs, files in os.walk(OUTPUT_FOLDER):
#         for f in files:
#             if f == "vocals.wav":
#                 vocals_path = os.path.join(root, f)
#                 break
#         if vocals_path:
#             break

#     if not vocals_path or not os.path.exists(vocals_path):
#         return jsonify({"error": "Vocals file not found after processing."}), 500

#     download_name = f"{base_name}_vocals.wav"
#     return send_file(
#         vocals_path,
#         mimetype="audio/wav",
#         as_attachment=True,
#         download_name=download_name
#     )


# @app.route("/health")
# def health():
#     try:
#         r = subprocess.run(
#             [sys.executable, "-m", "demucs", "--help"],
#             capture_output=True, text=True, timeout=10
#         )
#         demucs_ok = r.returncode == 0
#     except Exception:
#         demucs_ok = False

#     return jsonify({
#         "status": "ok",
#         "demucs_available": demucs_ok,
#         "ffmpeg_available": find_ffmpeg() is not None
#     })


# if __name__ == "__main__":
#     app.run(debug=True, port=5000)



import os
import shutil
import subprocess
import sys
from datetime import datetime
from flask import Flask, request, jsonify, send_file, render_template
from werkzeug.utils import secure_filename

app = Flask(__name__)

UPLOAD_FOLDER = "uploads"
OUTPUT_FOLDER = "outputs"
CONVERTED_FOLDER = "converted"
ALLOWED_EXTENSIONS = {"wav", "mp3", "flac", "ogg", "m4a", "aac", "mp4", "wma"}

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def cleanup_all():
    for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, CONVERTED_FOLDER]:
        if os.path.exists(folder):
            shutil.rmtree(folder)
        os.makedirs(folder, exist_ok=True)


def find_ffmpeg():
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


def ffmpeg_to_wav(input_path, output_path):
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


def get_patch_script():
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


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/extract", methods=["POST"])
def extract_vocals():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided."}), 400

    file = request.files["audio"]

    if file.filename == "":
        return jsonify({"error": "No file selected."}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"}), 400

    if not find_ffmpeg():
        return jsonify({"error": "ffmpeg not found. See README for install instructions."}), 500

    cleanup_all()

    filename = secure_filename(file.filename)
    input_path = os.path.join(UPLOAD_FOLDER, filename)
    file.save(input_path)

    base_name = os.path.splitext(filename)[0]
    wav_path = os.path.join(CONVERTED_FOLDER, base_name + ".wav")

    ok, err = ffmpeg_to_wav(input_path, wav_path)
    if not ok:
        return jsonify({"error": f"ffmpeg conversion failed:\n{err}"}), 500

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
        return jsonify({"error": "Demucs timed out (>10 min). Try a shorter file."}), 500
    except FileNotFoundError:
        return jsonify({"error": "Demucs not found. Run: pip install demucs"}), 500

    if result.returncode != 0:
        error_msg = result.stderr[-1500:] if result.stderr else "Unknown error"
        return jsonify({"error": f"Demucs failed:\n{error_msg}"}), 500

    # Find both vocals.wav and no_vocals.wav
    vocals_path = None
    no_vocals_path = None
    for root, dirs, files in os.walk(OUTPUT_FOLDER):
        for f in files:
            full = os.path.join(root, f)
            if f == "vocals.wav":
                vocals_path = full
            elif f == "no_vocals.wav":
                no_vocals_path = full

    if not vocals_path or not os.path.exists(vocals_path):
        return jsonify({"error": "Vocals file not found after processing."}), 500

    # Timestamp suffix: YYYYMMDD_HHMMSS
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    return jsonify({
        "vocals_url": f"/download/vocals?ts={ts}&base={base_name}",
        "no_vocals_url": f"/download/no_vocals?ts={ts}&base={base_name}" if no_vocals_path else None,
        "vocals_name": f"{base_name}_vocals_{ts}.wav",
        "no_vocals_name": f"{base_name}_no_vocals_{ts}.wav" if no_vocals_path else None,
    })


@app.route("/download/vocals")
def download_vocals():
    base = request.args.get("base", "output")
    ts = request.args.get("ts", "")
    vocals_path = None
    for root, dirs, files in os.walk(OUTPUT_FOLDER):
        for f in files:
            if f == "vocals.wav":
                vocals_path = os.path.join(root, f)
                break
        if vocals_path:
            break
    if not vocals_path:
        return "File not found", 404
    return send_file(vocals_path, mimetype="audio/wav", as_attachment=True,
                     download_name=f"{base}_vocals_{ts}.wav")


@app.route("/download/no_vocals")
def download_no_vocals():
    base = request.args.get("base", "output")
    ts = request.args.get("ts", "")
    no_vocals_path = None
    for root, dirs, files in os.walk(OUTPUT_FOLDER):
        for f in files:
            if f == "no_vocals.wav":
                no_vocals_path = os.path.join(root, f)
                break
        if no_vocals_path:
            break
    if not no_vocals_path:
        return "File not found", 404
    return send_file(no_vocals_path, mimetype="audio/wav", as_attachment=True,
                     download_name=f"{base}_no_vocals_{ts}.wav")


@app.route("/health")
def health():
    try:
        r = subprocess.run(
            [sys.executable, "-m", "demucs", "--help"],
            capture_output=True, text=True, timeout=10
        )
        demucs_ok = r.returncode == 0
    except Exception:
        demucs_ok = False

    return jsonify({
        "status": "ok",
        "demucs_available": demucs_ok,
        "ffmpeg_available": find_ffmpeg() is not None
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000, use_reloader=False)