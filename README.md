# VocalLift — AI Vocal Extractor

Extract clean vocals from any audio file locally using the Demucs `htdemucs` neural model.  
No cloud, no TorchCodec issues, no DLL errors — runs entirely on your Windows machine.

---

## Requirements

- Python 3.10 or 3.11 (recommended)
- pip
- ffmpeg installed and added to your system PATH (see setup below)
- A working internet connection for the **first run** (Demucs downloads the model weights ~320 MB)

---

## Installation

### 1. Clone or download this project

```
vocal-extractor/
├── app.py
├── requirements.txt
├── templates/
│   └── index.html
├── setup.bat
└── run.bat
```

---

### 2. Install ffmpeg (required)

VocalLift uses ffmpeg to convert audio files before passing them to Demucs. This completely bypasses the TorchCodec issue on Windows.

#### Option A — via winget (recommended)

Open Command Prompt or PowerShell and run:

```cmd
winget install Gyan.FFmpeg
```

After install, **close your terminal completely** and open a new one. Then verify:

```cmd
ffmpeg -version
```

If it prints version info, you're good. If it says "not recognized", follow Option B.

#### Option B — Manual install

1. Go to **https://ffmpeg.org/download.html** → Windows → "Windows builds by BtbN"
2. Download `ffmpeg-master-latest-win64-gpl.zip`
3. Extract it, rename the folder to `ffmpeg`, and move it to `C:\ffmpeg`
4. Add ffmpeg to your PATH:
   - Press **Win + S** and search **"Edit the system environment variables"**
   - Click **Environment Variables...**
   - Under **User variables**, select **Path** → click **Edit**
   - Click **New** and paste: `C:\ffmpeg\bin`
   - Click **OK** on all windows
5. Open a **new** terminal and run `ffmpeg -version` to confirm

#### winget installed but ffmpeg not recognized?

winget sometimes installs to a path not on your PATH. Find it:

```cmd
dir "%LOCALAPPDATA%\Microsoft\WinGet" /s /b 2>nul | findstr ffmpeg.exe
```

Copy the folder containing `ffmpeg.exe` (everything up to but not including `\ffmpeg.exe`), then run:

```cmd
setx PATH "%PATH%;C:\paste\the\folder\path\here"
```

Close and reopen your terminal, then verify with `ffmpeg -version`.

---

### 3. Create a virtual environment

```cmd
python -m venv venv
venv\Scripts\activate
```

### 4. Install Python dependencies

```cmd
pip install -r requirements.txt
```

---

## Running the App

```cmd
venv\Scripts\activate
python app.py
```

Then open your browser to: **http://localhost:5000**

The green dot at the bottom of the page confirms both Demucs and ffmpeg are detected correctly.

---

## How It Works

1. Upload any audio file (WAV, MP3, FLAC, OGG, M4A, AAC, MP4, WMA).
2. Click **Extract Vocals**.
3. ffmpeg converts the file to a clean 44.1 kHz WAV (bypassing torchaudio's decoder entirely).
4. Demucs runs in `--two-stems=vocals` mode using the `htdemucs` model.
5. Download **Vocals** (isolated voice) or **Instrumental** (everything else).

---

## Model Info

| Setting | Value |
|---|---|
| Model | `htdemucs` (Hybrid Transformer Demucs) |
| Mode | `--two-stems=vocals` |
| Output | WAV, 44.1 kHz stereo, timestamped filename |
| Processing | CPU (slow) or GPU (fast, if CUDA available) |

**First run:** Demucs downloads the `htdemucs` model weights (~320 MB) to your home folder.  
Subsequent runs use the cached model.

---

## Troubleshooting

### "ffmpeg not found" in the UI
ffmpeg is installed but not on your PATH. See **Step 2 → winget installed but ffmpeg not recognized** above.  
Always open a **new** terminal after updating PATH — existing terminals won't pick up the change.

### "Demucs not found" in the UI
Make sure you activated your virtual environment and ran `pip install -r requirements.txt`.

### Processing is very slow
Demucs defaults to CPU on machines without a CUDA GPU. A 3-minute song may take 5–15 minutes on CPU.  
If you have an NVIDIA GPU with CUDA, reinstall torch with CUDA support first:

```cmd
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
pip install demucs soundfile
```

### Flask restarts mid-extraction
This is caused by Flask's debug reloader watching temp files. The app already sets `use_reloader=False` to prevent this. If it happens, make sure you're using the latest `app.py`.

### Output folder issues
The app automatically clears `uploads/`, `converted/`, and `outputs/` before each new extraction to prevent stale file conflicts.

---

## File Structure

```
vocal-extractor/
├── app.py                  # Flask backend
├── requirements.txt        # Python dependencies
├── templates/
│   └── index.html          # Web UI
├── setup.bat               # One-click installer
├── run.bat                 # One-click launcher
├── uploads/                # Temporary input files (auto-managed)
├── converted/              # ffmpeg-converted WAV (auto-managed)
└── outputs/                # Demucs stems output (auto-managed)
```

---

## License

MIT — use freely for personal and commercial projects.
