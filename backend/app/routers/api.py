import os
import uuid
import asyncio
import json
import logging
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Depends, Request, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from .. import models, tasks
from ..auth import get_optional_user
from ..database import get_db, SessionLocal
from ..models import User

logger = logging.getLogger(__name__)

router = APIRouter()

STORAGE_DIR = "storage/uploads"
os.makedirs(STORAGE_DIR, exist_ok=True)


@router.post("/process/youtube")
async def process_youtube(
    url: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    task_id = str(uuid.uuid4())

    db_task = models.AudioTask(
        id=task_id,
        user_id=current_user.id if current_user else None,
        source_type="youtube",
        source_url=url,
        status="pending",
    )
    db.add(db_task)
    db.commit()

    asyncio.create_task(tasks.run_audio_pipeline(task_id, "youtube", url))

    return {
        "status": "success",
        "data": {"task_id": task_id},
        "message": "Processing started",
    }


@router.post("/process/upload")
async def process_upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    allowed = {"wav", "mp3", "flac", "ogg", "m4a", "aac", "mp4", "wma", "webm", "avi", "mkv"}
    ext = file.filename.rsplit(".", 1)[-1].lower() if file.filename and "." in file.filename else ""
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Allowed: {', '.join(sorted(allowed))}",
        )

    task_id = str(uuid.uuid4())
    local_path = os.path.join(STORAGE_DIR, f"{task_id}.{ext}")
    with open(local_path, "wb") as f:
        f.write(await file.read())

    db_task = models.AudioTask(
        id=task_id,
        user_id=current_user.id if current_user else None,
        source_type="upload",
        source_url=file.filename,
        status="pending",
    )
    db.add(db_task)
    db.commit()

    asyncio.create_task(tasks.run_audio_pipeline(task_id, "upload", local_path))

    return {
        "status": "success",
        "data": {"task_id": task_id},
        "message": "Processing started",
    }


@router.get("/tasks/{task_id}/stream")
async def stream_task_status(task_id: str, request: Request):
    async def event_generator():
        try:
            while True:
                db = SessionLocal()
                try:
                    task = db.query(models.AudioTask).filter(
                        models.AudioTask.id == task_id
                    ).first()
                finally:
                    db.close()

                if not task:
                    yield f"data: {json.dumps({'status': 'not_found'})}\n\n"
                    break

                status = task.status
                payload = {"status": status}
                if status == "completed":
                    payload["vocals_url"] = f"/api/download/{task_id}/vocals"
                    payload["instrumental_url"] = f"/api/download/{task_id}/instrumental"

                yield f"data: {json.dumps(payload)}\n\n"

                if status in ("completed", "failed", "cancelled"):
                    break

                if await request.is_disconnected():
                    logger.info(f"SSE client disconnected for task {task_id}. Cancelling.")
                    tasks.cancel_task(task_id)
                    break

                await asyncio.sleep(1)
        except Exception as e:
            logger.error(f"SSE stream error for task {task_id}: {e}")
            yield f"data: {json.dumps({'status': 'failed'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/tasks/{task_id}/cancel")
async def cancel_task_endpoint(task_id: str, db: Session = Depends(get_db)):
    tasks.cancel_task(task_id)
    return {"status": "success", "message": "Task cancelled"}


@router.get("/tasks")
def list_tasks(
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    if current_user:
        rows = (
            db.query(models.AudioTask)
            .filter(models.AudioTask.user_id == current_user.id)
            .order_by(models.AudioTask.created_at.desc())
            .all()
        )
    else:
        rows = []

    return {
        "status": "success",
        "data": [
            {
                "task_id": t.id,
                "status": t.status,
                "source_type": t.source_type,
                "source_url": t.source_url,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "completed_at": t.completed_at.isoformat() if t.completed_at else None,
                "vocals_available": t.vocals_path is not None,
                "instrumental_available": t.instrumental_path is not None,
            }
            for t in rows
        ],
    }


@router.get("/download/{task_id}/{stem}")
async def download_stem(task_id: str, stem: str, db: Session = Depends(get_db)):
    db_task = db.query(models.AudioTask).filter(models.AudioTask.id == task_id).first()
    if not db_task:
        raise HTTPException(status_code=404, detail="Task not found")

    if stem == "vocals" and db_task.vocals_path:
        return FileResponse(
            db_task.vocals_path,
            media_type="audio/mpeg",
            filename=f"{task_id}_vocals.mp3",
        )
    elif stem == "instrumental" and db_task.instrumental_path:
        return FileResponse(
            db_task.instrumental_path,
            media_type="audio/mpeg",
            filename=f"{task_id}_instrumental.mp3",
        )

    raise HTTPException(status_code=404, detail="File not available")
