import asyncio
import uuid
from typing import Dict
from fastapi import BackgroundTasks
from .processor import AudioProcessor
from .database import SessionLocal
from .models import AudioTask

# In-memory store for active processors, mapping task_id to AudioProcessor instance
active_processors: Dict[str, AudioProcessor] = {}

async def run_audio_pipeline(task_id: str, source_type: str, source_data: str):
    processor = AudioProcessor(task_id)
    active_processors[task_id] = processor
    
    db = SessionLocal()
    
    async def update_status(status_str: str):
        task = db.query(AudioTask).filter(AudioTask.id == task_id).first()
        if task:
            task.status = status_str
            db.commit()
            
    try:
        await update_status("processing")

        if source_type == "youtube":
            result = await processor.process_youtube(source_data, status_callback=update_status)
        else:
            result = await processor.process_file(source_data, status_callback=update_status)

        db_task = db.query(AudioTask).filter(AudioTask.id == task_id).first()
        if db_task:
            if result.get("status") == "success":
                db_task.status = "completed"
                db_task.vocals_path = result.get("vocals_path")
                db_task.instrumental_path = result.get("instrumental_path")
            else:
                db_task.status = "failed"
            db.commit()

    except asyncio.CancelledError:
        db_cancel = SessionLocal()
        try:
            task = db_cancel.query(AudioTask).filter(AudioTask.id == task_id).first()
            if task:
                task.status = "cancelled"
                db_cancel.commit()
        finally:
            db_cancel.close()
    except Exception as e:
        db_err = SessionLocal()
        try:
            task = db_err.query(AudioTask).filter(AudioTask.id == task_id).first()
            if task:
                task.status = "failed"
                db_err.commit()
        finally:
            db_err.close()
    finally:
        db.close()
        # Clean up memory mapping
        active_processors.pop(task_id, None)

def cancel_task(task_id: str):
    """Cancels an active processing task and cleans up temporary files."""
    processor = active_processors.get(task_id)
    if processor:
        processor.cancel()
        processor.cleanup()
        
    # Also mark in DB
    db = SessionLocal()
    db_task = db.query(AudioTask).filter(AudioTask.id == task_id).first()
    if db_task and db_task.status in ["pending", "processing"]:
        db_task.status = "cancelled"
        db.commit()
    db.close()
