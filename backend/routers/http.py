"""
REST router: HTTP-based transcription.

Endpoints
─────────
POST /api/transcribe
    Upload any audio file (wav, mp3, ogg, flac, …).
    Returns the full transcript as JSON.

GET  /api/health
    Quick liveness + model-info check.
"""

import logging
import mimetypes
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from backend.services.asr import get_asr_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["REST"])

# Map common MIME types → ffmpeg format hints
MIME_TO_FORMAT: dict[str, str] = {
    "audio/wav":        "wav",
    "audio/x-wav":      "wav",
    "audio/mpeg":       "mp3",
    "audio/mp3":        "mp3",
    "audio/ogg":        "ogg",
    "audio/flac":       "flac",
    "audio/x-flac":     "flac",
    "audio/aac":        "aac",
    "audio/mp4":        "mp4",
    "audio/webm":       "webm",
    "video/webm":       "webm",
}

ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".ogg", ".flac", ".aac",
    ".m4a", ".mp4", ".webm", ".opus", ".wma",
}


def _guess_format(upload: UploadFile) -> str | None:
    """Best-effort format hint for ffmpeg from content-type or filename."""
    ct = upload.content_type or ""
    if ct in MIME_TO_FORMAT:
        return MIME_TO_FORMAT[ct]
    ext = Path(upload.filename or "").suffix.lower()
    if ext:
        guessed, _ = mimetypes.guess_type(f"file{ext}")
        if guessed in MIME_TO_FORMAT:
            return MIME_TO_FORMAT[guessed]
    return None  # let ffmpeg auto-detect


@router.get("/health")
async def health():
    from backend.core.config import settings
    return {
        "status": "ok",
        "model_mode": settings.MODEL_MODE,
        "device": str(get_asr_service().device),
        "sample_rate": settings.SAMPLE_RATE,
    }


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    # ── Validate extension ────────────────────────────────────────────────────
    ext = Path(file.filename or "").suffix.lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file extension '{ext}'. "
                   f"Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    audio_bytes = await file.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    fmt = _guess_format(file)
    logger.info(
        "REST /transcribe  file=%s  size=%d bytes  fmt_hint=%s",
        file.filename, len(audio_bytes), fmt,
    )

    asr = get_asr_service()

    try:
        audio_np = asr.load_audio(audio_bytes, src_format=fmt)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    transcript = asr.decode(audio_np)
    logger.info("REST /transcribe  → %r", transcript[:120])

    return JSONResponse({
        "transcript": transcript,
        "duration_sec": round(len(audio_np) / asr.sample_rate, 2),
        "filename": file.filename,
    })
