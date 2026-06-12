"""
backend.app
----------------
FastAPI application providing a small HTTP API to extract vocals from
uploaded audio using Demucs. This module handles file uploads, converts
input audio to a WAV file using ffmpeg, runs a patched Demucs invocation
to separate vocals/no-vocals stems, and exposes endpoints to download
the resulting WAV files.

Key endpoints:
- GET /health           : checks availability of Demucs and ffmpeg
- POST /extract         : upload audio and run separation
- GET /download/vocals  : download separated vocals
- GET /download/no_vocals: download instrumental (no-vocals)

Notes:
- Requires `demucs` Python package and `ffmpeg` binary available.
- Temporary files are stored in `uploads/`, `converted/`, and `outputs/`.
"""

import os
import shutil
import subprocess
import sys
from datetime import datetime, timedelta
import sqlite3
import jwt
from pydantic import BaseModel
from passlib.context import CryptContext
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

# --- Simple SQLite-backed user store and auth helpers -----------------
# Database file used for user records (email, hashed password, refresh token)
DB_PATH = "auth.db"

# Password hashing context. Uses PBKDF2-SHA256 so it works without extra C
# dependencies; strong and portable for this demo.
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

# JWT settings
JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-prod")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7


def _get_db_conn():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def initialize_db():
    """Create the users table if it doesn't exist."""
    conn = _get_db_conn()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            refresh_token TEXT
        )
        """
    )
    conn.commit()
    conn.close()


def create_user(name: str, email: str, password: str) -> None:
    """Insert a new user with a hashed password."""
    pwd = pwd_context.hash(password)
    conn = _get_db_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)", (name, email, pwd))
    conn.commit()
    conn.close()


def get_user_by_email(email: str):
    conn = _get_db_conn()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE email = ?", (email,))
    row = cur.fetchone()
    conn.close()
    return row


def update_refresh_token(email: str, token: str | None):
    conn = _get_db_conn()
    cur = conn.cursor()
    cur.execute("UPDATE users SET refresh_token = ? WHERE email = ?", (token, email))
    conn.commit()
    conn.close()


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": email, "exp": int(expire.timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(email: str) -> str:
    expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": email, "exp": int(expire.timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


# Initialize DB at import time so endpoints can use it immediately
initialize_db()

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)
os.makedirs(CONVERTED_FOLDER, exist_ok=True)


def allowed_file(filename: str) -> bool:
    """Return True if the filename has a permitted audio extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def cleanup_all():
    """Remove and recreate the working folders.

    This ensures a clean state before processing a new upload so we don't
    inadvertently return stale outputs.
    """
    for folder in [UPLOAD_FOLDER, OUTPUT_FOLDER, CONVERTED_FOLDER]:
        if os.path.exists(folder):
            shutil.rmtree(folder)
        os.makedirs(folder, exist_ok=True)


def find_ffmpeg() -> str | None:
    """Try to locate an ffmpeg executable on the system.

    First uses `shutil.which("ffmpeg")`. On some Windows setups, a
    winget-installed FFmpeg may live under the LocalAppData path; check
    that location as a fallback.
    Returns the full path to ffmpeg or None if not found.
    """
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
    """Convert an input audio file to a 44.1kHz 16-bit stereo WAV using ffmpeg.

    Returns a (ok, error_message) tuple. `ok` is True on success; `error_message`
    contains stderr output when conversion fails.
    """
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

def ffmpeg_to_mp3(input_path: str, output_path: str) -> tuple[bool, str]:
    """Convert input audio to MP3 using ffmpeg."""
    ffmpeg = find_ffmpeg()
    if not ffmpeg:
        return False, "ffmpeg not found"

    cmd = [
        ffmpeg, "-y",
        "-i", input_path,
        "-vn",
        "-ar", "44100",
        "-ac", "2",
        "-b:a", "192k",
        output_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        return False, result.stderr[-800:]
    return True, ""

def get_patch_script() -> str:
    """Return a small Python script used to patch `torchaudio` I/O calls.

    Demucs may expect torchaudio's load/save semantics; this script replaces
    `torchaudio.load`/`save` with functions that delegate to `soundfile` so
    Demucs can run in this environment.
    """
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
    """Health check that verifies Demucs (Python module) and ffmpeg.

    Runs a lightweight `demucs --help` to ensure the package is importable
    and looks for the ffmpeg binary. Returns JSON describing availability.
    """
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
    """Handle an uploaded audio file, run separation, and return download URLs.

    Steps:
    1. Validate upload and extension.
    2. Ensure `ffmpeg` is available.
    3. Clean working directories.
    4. Save uploaded file to `uploads/`.
    5. Convert to WAV and write a small patch script for torchaudio.
    6. Run the patched Demucs invocation to produce separated stems.
    7. Locate the resulting `vocals.wav` (and optional `no_vocals.wav`) and
       return JSON containing URLs to download them.
    """
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

    # Start with a clean workspace for this request
    cleanup_all()

    filename = secure_filename(audio.filename)
    input_path = os.path.join(UPLOAD_FOLDER, filename)

    # Save the uploaded file
    with open(input_path, "wb") as f:
        content = await audio.read()
        f.write(content)

    base_name = os.path.splitext(filename)[0]
    mp3_path = os.path.join(CONVERTED_FOLDER, base_name + ".mp3")

    # Convert the uploaded file to a standard MP3 format
    ok, err = ffmpeg_to_mp3(input_path, mp3_path)
    if not ok:
        raise HTTPException(status_code=500, detail=f"ffmpeg conversion failed:\n{err}")

    # Write the small patch script that adapts torchaudio IO for Demucs
    patch_path = os.path.join(CONVERTED_FOLDER, "_patch_and_run.py")
    with open(patch_path, "w") as f:
        f.write(get_patch_script())

    # Build the command that runs Demucs (via the patch script)
    cmd = [
        sys.executable, patch_path,
        "--two-stems=vocals",
        "-n", "htdemucs",
        "--out", OUTPUT_FOLDER,
        mp3_path
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

    # Locate output stems produced by Demucs
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
    """Return the separated vocals WAV as an HTTP file response.

    Searches the `outputs/` folder for a `vocals.wav` produced by Demucs
    and streams it back to the client with a friendly filename.
    """
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
    """Return the instrumental (no-vocals) WAV as an HTTP file response.

    Similar to `download_vocals` but looks for `no_vocals.wav` in outputs.
    """
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
# --- Auth models and endpoints -----------------------------------------


class RegisterModel(BaseModel):
    name: str
    email: str
    password: str


class LoginModel(BaseModel):
    email: str
    password: str


class RefreshModel(BaseModel):
    refresh_token: str


@app.post("/register")
def register(payload: RegisterModel):
    """Register a new user. Returns 201 on success.

    Stores a hashed password in the local SQLite DB. Email must be unique.
    """
    if get_user_by_email(payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    try:
        create_user(payload.name, payload.email, payload.password)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create user: {e}")
    return JSONResponse({"status": "created"}, status_code=201)


@app.post("/login")
def login(payload: LoginModel):
    """Authenticate user and return access + refresh tokens."""
    user = get_user_by_email(payload.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access = create_access_token(user["email"])
    refresh = create_refresh_token(user["email"])
    # store refresh token server-side so we can revoke it if needed
    update_refresh_token(user["email"], refresh)
    return {"access_token": access, "refresh_token": refresh}


@app.post("/refresh")
def refresh_token(payload: RefreshModel):
    """Exchange a refresh token for a new access token (and refresh token).

    The provided refresh token must match the one stored for the user.
    """
    try:
        data = jwt.decode(payload.refresh_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    email = data.get("sub")
    if not email:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = get_user_by_email(email)
    if not user or not user["refresh_token"]:
        raise HTTPException(status_code=401, detail="Refresh token not recognized")

    # Ensure the provided token matches the stored one
    if user["refresh_token"] != payload.refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token mismatch")

    # Issue new tokens
    access = create_access_token(email)
    new_refresh = create_refresh_token(email)
    update_refresh_token(email, new_refresh)
    return {"access_token": access, "refresh_token": new_refresh}


@app.get("/user/{email}")
def get_user(email: str):
    """Return public user information by email (no password hash).

    This endpoint is intentionally simple and returns only `name` and
    `email`. In a production system this would likely be protected.
    """
    user = get_user_by_email(email)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"name": user["name"], "email": user["email"]}


