# SonicSplit Backend

FastAPI backend for AI-powered audio separation.

## Quick Start

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## API Docs

See the root [README.md](../README.md) for full API documentation.

Swagger UI available at `http://localhost:8000/docs` when the server is running.

## Project Structure

```
app/
├── main.py              # FastAPI app, CORS, router mounting
├── database.py           # SQLAlchemy engine (SQLite)
├── models.py             # User, AudioTask ORM models
├── auth.py               # JWT, password hashing, dependencies
├── processor.py          # Audio pipeline (yt-dlp, FFmpeg, Demucs, DeepFilterNet, MP3)
├── tasks.py              # Background task runner + cancellation
└── routers/
    ├── api.py            # Processing, tasks, download routes
    └── auth.py           # Register, login, refresh, profile routes
```
