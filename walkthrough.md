# SonicSplit Implementation Walkthrough

The foundational structure for the **SonicSplit AI Audio Separation Suite** has been successfully implemented according to your architectural requirements.

## 1. Documentation & Skills
- **`README.md`**: Outlines the project structure, stack, and execution model.
- **`SKILL.md`**: An instruction file for AI agents to understand the project architecture, separation of concerns (`/backend` vs `/webapp`), and the strict rules around handling guest sessions and subprocess cleanup.

## 2. Backend Foundation (FastAPI)
The backend was structured cleanly using FastAPI and SQLAlchemy:
- **`requirements.txt`**: Added necessary ML dependencies (`yt-dlp`, `htdemucs`, `deepfilternet`).
- **`database.py` & `models.py`**: Configured the SQLite database and created SQLAlchemy schemas for `User` and `AudioTask`. The tasks track relative paths and processing states.
- **`main.py`**: Initialized the FastAPI application and CORS middleware.

## 3. ML Audio Pipeline
- **`processor.py`**: The heart of the application. It's an `async` wrapper managing a sequential pipeline: `yt-dlp` -> `FFmpeg` -> `htdemucs` -> `DeepFilterNet`.
  - **Subprocess Safety**: All commands use `asyncio.create_subprocess_exec` allowing them to be actively managed by the event loop.
  - **Graceful Cancellation**: The class exposes `cancel()` and `cleanup()` methods which actively `.kill()` running subprocesses and delete temporary directories to prevent zombie processes.

## 4. API Routing & Session Management
- **`api.py`**: Exposes `/api/process/youtube` and `/api/process/upload`. 
- **Disconnect Detection**: Uses FastAPI's `Request.is_disconnected()` in an asynchronous polling loop. If a guest user closes their browser tab or refreshes, the API detects the disconnected socket, instantly invokes `tasks.cancel_task(task_id)`, and kills the background audio ML processes.

## 5. Frontend Web Application (Next.js)
- Installed the `lucide-react` icon library to meet the aesthetic requirements.
- **`app/page.tsx`**: Built a sleek, minimalist, dark-themed React dashboard.
  - Features an intuitive drag-and-drop zone and a YouTube URL input area.
  - Handles the asynchronous requests to the FastAPI backend, utilizing React state to shift the UI dynamically between `idle`, `processing`, `success`, and `error` states.
  - The component unmounts or cancels requests seamlessly, letting the backend handle the active drop via our custom disconnect-detection logic.

### Next Steps
The core pipeline is ready for testing! You can now spin up both servers locally:
- **Backend:** `cd backend && uvicorn app.main:app --reload --port 8000`
- **Frontend:** `cd webapp && npm run dev`
