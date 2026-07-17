# SonicSplit AI Audio Separation Suite

SonicSplit is a powerful, decoupled web application designed to extract and enhance vocals and instrumentals from audio/video files or YouTube URLs. Built for performance with background async processing and real-time SSE progress updates.

## Architecture & Stack

### Backend
- **Framework:** FastAPI (Python 3.10+) — `backend/app/`
- **Database:** SQLite with SQLAlchemy ORM
- **Authentication:** JWT (access + refresh tokens), bcrypt via passlib
- **Task Processing:** Async background tasks using `asyncio` + subprocess
- **Audio Pipeline:**
  1. `yt-dlp` — YouTube/audio URL extraction
  2. `FFmpeg` — Format conversion & resampling to 44.1 kHz
  3. `htdemucs` — 2-stem separation (Vocals vs Instrumental)
  4. `DeepFilterNet` — Vocal enhancement & de-noising
  5. `FFmpeg` — Final MP3 encoding (192 kbps)

### Frontend
- **Framework:** Next.js 16 (App Router) — `webapp/`
- **Styling:** Tailwind CSS 4, Lucide Icons
- **Real-time Updates:** Server-Sent Events (SSE) for progress streaming

## User Tiers

| Feature | Guest | Registered |
|---|---|---|
| Upload / YouTube processing | Yes | Yes |
| Task persists after disconnect | No (cancelled) | Yes |
| Task history | No | Yes (`GET /api/tasks`) |
| Authentication required | No | Yes (JWT Bearer) |

---

## Setup

### Prerequisites
- Python 3.10+
- FFmpeg installed and on system PATH
- Node.js 18+ (for the frontend)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Models for `htdemucs` and `DeepFilterNet` are downloaded automatically on first run.

### Frontend

```bash
cd webapp
npm install
npm run dev
```

The frontend proxies API calls to `http://localhost:8000` via `next.config.ts` rewrites.

---

## API Documentation

**Base URL:** `http://localhost:8000`

All responses follow a standard JSON envelope:
```json
{
  "status": "success" | "error",
  "data": {},
  "message": "Optional context"
}
```

### Authentication

Include the JWT access token in the `Authorization` header:
```
Authorization: Bearer <access_token>
```

Guest users can omit this header for processing endpoints. Authenticated users get persistent task storage.

---

### Auth Endpoints

#### `POST /api/auth/register`
Create a new user account.

**Request Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Response (201):**
```json
{
  "status": "success",
  "message": "Account created",
  "data": { "id": 1 }
}
```

---

#### `POST /api/auth/login`
Authenticate and receive JWT tokens.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securepass123"
}
```

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "eyJ...",
    "token_type": "bearer"
  }
}
```

---

#### `POST /api/auth/refresh`
Exchange a refresh token for a new token pair.

**Request Body:**
```json
{
  "refresh_token": "eyJ..."
}
```

**Response (200):** Same structure as login.

---

#### `GET /api/auth/profile`
Get the current authenticated user's profile.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "status": "success",
  "data": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "is_active": true
  }
}
```

---

### Processing Endpoints

#### `POST /api/process/youtube`
Start audio separation from a YouTube URL.

**Query Parameter:** `url` (required) — YouTube video URL

**Headers:** `Authorization` (optional — include for registered user persistence)

**Response (200):**
```json
{
  "status": "success",
  "data": { "task_id": "550e8400-e29b-41d4-a716-446655440000" },
  "message": "Processing started"
}
```

---

#### `POST /api/process/upload`
Upload an audio or video file for separation.

**Body:** `multipart/form-data` with field `file`

**Supported formats:** `wav, mp3, flac, ogg, m4a, aac, mp4, wma, webm, avi, mkv`

**Headers:** `Authorization` (optional)

**Response (200):** Same structure as YouTube endpoint.

---

#### `GET /api/tasks/{task_id}/stream`
Server-Sent Events stream for real-time task progress.

**SSE Events:**
```
data: {"status": "downloading"}
data: {"status": "converting"}
data: {"status": "separating"}
data: {"status": "enhancing"}
data: {"status": "converting_to_mp3"}
data: {"status": "completed", "vocals_url": "/api/download/{id}/vocals", "instrumental_url": "/api/download/{id}/instrumental"}
```

Terminal statuses: `completed`, `failed`, `cancelled`, `not_found`.

Disconnecting cancels the task for guest users.

---

#### `POST /api/tasks/{task_id}/cancel`
Cancel a pending or in-progress task.

**Response (200):**
```json
{ "status": "success", "message": "Task cancelled" }
```

---

#### `GET /api/tasks`
List tasks for the authenticated user. Returns empty array for guests.

**Headers:** `Authorization: Bearer <token>` (required for data)

**Response (200):**
```json
{
  "status": "success",
  "data": [
    {
      "task_id": "550e8400-...",
      "status": "completed",
      "source_type": "youtube",
      "source_url": "https://www.youtube.com/watch?v=...",
      "created_at": "2026-07-17T10:00:00",
      "completed_at": "2026-07-17T10:05:00",
      "vocals_available": true,
      "instrumental_available": true
    }
  ]
}
```

---

### Download Endpoints

#### `GET /api/download/{task_id}/vocals`
Download the separated vocals as MP3 (192 kbps).

#### `GET /api/download/{task_id}/instrumental`
Download the separated instrumental as MP3 (192 kbps).

Both return `audio/mpeg` with filename `{task_id}_vocals.mp3` or `{task_id}_instrumental.mp3`.

---

### Root

#### `GET /`
```json
{ "status": "success", "message": "SonicSplit API is running" }
```

---

## Postman Collection

Import `backend/postman_collection.json` into Postman to test all endpoints.

**Collection Variables:**
| Variable | Description |
|---|---|
| `base_url` | `http://localhost:8000` |
| `access_token` | Set automatically after Login |
| `refresh_token` | Set automatically after Login |
| `task_id` | Set automatically after process requests |

**Suggested test flow:**
1. Root → Health Check
2. Auth → Register
3. Auth → Login (saves tokens)
4. Auth → Get Profile
5. Processing → Process YouTube URL (authenticated)
6. Tasks → Stream Task Status (SSE) — watch until completed
7. Downloads → Download Vocals / Instrumental

---

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entrypoint
│   ├── database.py           # SQLAlchemy engine/session
│   ├── models.py             # User, AudioTask ORM models
│   ├── auth.py               # JWT, password hashing, dependencies
│   ├── processor.py          # Audio pipeline (yt-dlp, FFmpeg, Demucs, DeepFilterNet)
│   ├── tasks.py              # Background task runner + cancellation
│   └── routers/
│       ├── api.py            # Processing, tasks, download routes
│       └── auth.py           # Register, login, refresh, profile routes
├── storage/                  # Runtime: uploads + task outputs
├── requirements.txt
├── postman_collection.json
└── sonicsplit.db             # SQLite database (auto-created)
```

---

## Pipeline Stages

```
YouTube URL / Uploaded File
        │
        ▼
   yt-dlp extract → raw audio
        │
        ▼
   FFmpeg resample → 44.1 kHz stereo WAV
        │
        ▼
   Demucs htdemucs → vocals.wav + no_vocals.wav
        │
        ▼
   DeepFilterNet → enhanced_vocals.wav
        │
        ▼
   FFmpeg encode → vocals.mp3 + instrumental.mp3 (192 kbps)
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `JWT_SECRET` | `sonicsplit-dev-secret-change-in-prod` | Secret key for JWT signing |

---

## Notes

- Guest tasks are ephemeral: disconnecting via SSE cancels the task and cleans up files.
- Registered user tasks persist in SQLite and are accessible via `GET /api/tasks`.
- All output files are MP3 (192 kbps) for web-friendly delivery.
- FFmpeg must be installed and accessible on system PATH.
