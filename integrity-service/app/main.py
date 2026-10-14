"""
HTTP surface for the face-presence analyzer.

This is an INTERNAL service. It must not be exposed to the public internet:
it takes a path/upload of an interview recording and returns review signals.
Run it on a private network and have the Node backend call it after a recording
finishes uploading.

Contract note for whoever consumes this: when `suppressed` is true the `signals`
array is empty BY DESIGN and `quality.reason` explains why. Show the reason as a
recording-quality notice. Never render it as candidate behaviour, and never let
any field here change a score or end a session.
"""

from __future__ import annotations

import logging
import os
import shutil
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from .detector import DEFAULT_MODEL, Config, FacePresenceAnalyzer

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("integrity")

app = FastAPI(
    title="Interview Integrity Service",
    version="1.0.0",
    description=(
        "Server-side face-presence analysis over interview recordings. "
        "Produces reviewable evidence for a human, never an automated verdict."
    ),
)

# Where the Node backend writes recordings. Shared volume in Docker, or a local
# path in dev. Analysis by path avoids re-uploading multi-hundred-MB files.
RECORDINGS_DIR = Path(os.getenv("RECORDINGS_DIR", "./recordings")).resolve()
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", 512 * 1024 * 1024))


class AnalyzeRequest(BaseModel):
    filename: str = Field(..., description="File name inside RECORDINGS_DIR")
    sample_fps: float = Field(2.0, gt=0, le=10)
    min_absence_ms: int = Field(10_000, ge=1_000, le=120_000)
    min_multi_face_ms: int = Field(5_000, ge=1_000, le=120_000)


def _config(req: AnalyzeRequest) -> Config:
    return Config(
        sample_fps=req.sample_fps,
        min_absence_ms=req.min_absence_ms,
        min_multi_face_ms=req.min_multi_face_ms,
    )


def _resolve_inside(base: Path, name: str) -> Path:
    """Resolve `name` under `base`, refusing anything that escapes it."""
    candidate = (base / Path(name).name).resolve()
    if not str(candidate).startswith(str(base) + os.sep):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    return candidate


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_present": DEFAULT_MODEL.exists(),
        "recordings_dir": str(RECORDINGS_DIR),
    }


@app.post("/analyze")
def analyze(req: AnalyzeRequest) -> dict:
    """Analyse a recording already present in RECORDINGS_DIR."""
    path = _resolve_inside(RECORDINGS_DIR, req.filename)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Recording not found.")

    started = time.perf_counter()
    try:
        result = FacePresenceAnalyzer(config=_config(req)).analyze(path)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    payload = result.to_dict()
    payload["analysis_ms"] = int((time.perf_counter() - started) * 1000)
    log.info(
        "analysed %s in %dms: %d signals, suppressed=%s",
        path.name, payload["analysis_ms"], len(payload["signals"]), payload["suppressed"],
    )
    return payload


@app.post("/analyze-upload")
async def analyze_upload(file: UploadFile = File(...)) -> dict:
    """Analyse an uploaded recording. Prefer /analyze for large files."""
    suffix = Path(file.filename or "upload.webm").suffix or ".webm"
    tmp = Path(tempfile.mkdtemp()) / f"upload{suffix}"
    size = 0
    try:
        with tmp.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(status_code=413, detail="Recording too large.")
                out.write(chunk)

        started = time.perf_counter()
        result = FacePresenceAnalyzer().analyze(tmp)
        payload = result.to_dict()
        payload["analysis_ms"] = int((time.perf_counter() - started) * 1000)
        return payload
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        shutil.rmtree(tmp.parent, ignore_errors=True)
