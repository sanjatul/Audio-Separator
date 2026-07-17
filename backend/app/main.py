import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

import logging
from sqlalchemy import text
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from . import models
from .database import engine
from .routers import api, auth

logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s:     %(name)s - %(message)s",
)


def _migrate_db():
    """Lightweight migration: add missing columns to existing tables."""
    with engine.connect() as conn:
        result = conn.execute(text("PRAGMA table_info(users)"))
        columns = {row[1] for row in result}

        migrations = {
            "name": "ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''",
            "created_at": "ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
        }
        for col, sql in migrations.items():
            if col not in columns:
                conn.execute(text(sql))
                conn.commit()
                logging.info(f"Migration: added users.{col} column")


_migrate_db()
models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="SonicSplit API",
    description="AI-powered vocal and instrumental separation from audio/video/YouTube",
    version="1.0.0",
)

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

app.include_router(api.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth")


@app.get("/")
def read_root():
    return {"status": "success", "message": "SonicSplit API is running"}
