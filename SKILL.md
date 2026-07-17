---
name: sonicsplit_developer
description: Guidelines and instructions for AI agents working on the SonicSplit codebase.
---

# SonicSplit Developer Skill

When working on the SonicSplit repository, adhere to the following architectural and development rules.

## Core Directives

1. **Architecture Separation**: The project is strictly divided into `/backend` (FastAPI) and `/webapp` (Next.js 16). Do not mix logic or assets between them.
2. **Subprocess Safety**: When modifying the audio pipeline (`processor.py`), any use of `subprocess` or `asyncio.create_subprocess_exec` must be wrapped in `try...except...finally`. You must ensure that PIDs are explicitly killed on cancellation to avoid zombie processes.
3. **Guest Session Lifecycle**: For unauthenticated guests, tasks are ephemeral. If the client disconnects (detectable via SSE or request cancellation), you MUST trigger cleanup hooks that terminate the audio processing tasks and delete the temporary `/backend/storage/tasks/{task_id}/` directory.
4. **Data Persistence**: Do not store absolute paths in the SQLite database. All paths must be relative to the application's storage root to maintain portability.
5. **API Contract**: All FastAPI endpoints must return standard JSON wrappers:
   ```json
   {
     "status": "success" | "error",
     "data": {},
     "message": "Optional context"
   }
   ```
6. **Output Format**: All separated audio files are output as MP3 (192 kbps) using FFmpeg's `libmp3lame` encoder.
7. **Auth is Optional on Processing Routes**: Processing endpoints (`/api/process/*`) accept both guests and authenticated users. The `get_optional_user` dependency from `auth.py` handles this.

## Backend Structure

```
backend/app/
├── main.py              # FastAPI app entrypoint, CORS, router mounting
├── database.py           # SQLAlchemy engine (SQLite), SessionLocal, get_db()
├── models.py             # User (id, name, email, hashed_password) and AudioTask ORM models
├── auth.py               # JWT token creation/validation, password hashing, FastAPI dependencies
├── processor.py          # AudioProcessor class: yt-dlp → FFmpeg → Demucs → DeepFilterNet → MP3
├── tasks.py              # Background task runner, active_processors dict, cancel_task()
└── routers/
    ├── api.py            # /api/process/*, /api/tasks/*, /api/download/*
    └── auth.py           # /api/auth/register, /api/auth/login, /api/auth/refresh, /api/auth/profile
```

## API Endpoints Summary

### Auth (`/api/auth`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | No | Create new account (name, email, password) |
| POST | `/api/auth/login` | No | Login, returns access + refresh JWT tokens |
| POST | `/api/auth/refresh` | No | Exchange refresh token for new token pair |
| GET | `/api/auth/profile` | Yes | Get current user profile |

### Processing (`/api`)
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/process/youtube` | Optional | Start separation from YouTube URL (?url=) |
| POST | `/api/process/upload` | Optional | Upload audio/video file for separation |
| GET | `/api/tasks/{id}/stream` | No | SSE stream for real-time progress |
| POST | `/api/tasks/{id}/cancel` | No | Cancel an in-progress task |
| GET | `/api/tasks` | Optional | List tasks (empty for guests) |
| GET | `/api/download/{id}/{stem}` | No | Download vocals or instrumental MP3 |

### Root
| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |

## Auth Flow

- Use `get_optional_user` dependency for routes that work for both guests and registered users.
- Use `get_current_user` dependency for routes that require authentication.
- JWT tokens contain `sub` (email), `exp`, and `type` (access/refresh) claims.
- Access token expires in 24 hours. Refresh token expires in 30 days.

## Audio Pipeline Stages

1. **Download** (`downloading`) — yt-dlp extracts audio from YouTube URLs
2. **Convert** (`converting`) — FFmpeg resamples to 44.1 kHz stereo WAV
3. **Separate** (`separating`) — Demucs htdemucs splits into vocals + instrumental
4. **Enhance** (`enhancing`) — DeepFilterNet cleans up vocals
5. **Encode** (`converting_to_mp3`) — FFmpeg encodes both stems to MP3 at 192 kbps

## Workflow

- **Backend**: Use `cd backend && uvicorn app.main:app --reload --port 8000` for local development.
- **Frontend**: Use `cd webapp && npm run dev` (runs on port 3000, proxies to backend).
- **Database**: SQLite file `sonicsplit.db` is auto-created at startup via `Base.metadata.create_all()`.
- Ensure `FFmpeg` is installed and on PATH before running.

## Postman Collection

Import `backend/postman_collection.json` into Postman. Collection variables (`access_token`, `refresh_token`, `task_id`) are set automatically by test scripts.

## Dependencies

Key Python packages (see `requirements.txt` for full list):
- `fastapi==0.115.0` + `uvicorn==0.32.0`
- `sqlalchemy==2.0.41`
- `PyJWT==2.8.0` + `passlib==1.7.4`
- `demucs==4.0.1`
- `deepfilternet>=0.5.0`
- `torch==2.11.0` + `torchaudio==2.11.0`
- `yt-dlp==2026.3.17`
- `python-multipart==0.0.12`

## Notes

- The `app_old.py` file is a legacy monolith kept for reference. Do not modify it.
- Windows requires `asyncio.WindowsProactorEventLoopPolicy` — this is set in `main.py`.
- DeepFilterNet failures are non-fatal: the pipeline falls back to the original vocals.
