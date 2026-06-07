"""
REST router: HTTP-based transcription + diarization.

Endpoints
─────────
GET  /api/health
POST /api/transcribe        — full-file ASR, returns plain transcript
POST /api/diarize           — speaker diarization + per-segment ASR
"""

import logging
import mimetypes
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse

from backend.core.config import settings
from backend.services.asr import get_asr_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["REST"])

# ── Shared helpers ────────────────────────────────────────────────────────────

MIME_TO_FORMAT: dict[str, str] = {
    "audio/wav":    "wav",  "audio/x-wav":  "wav",
    "audio/mpeg":   "mp3",  "audio/mp3":    "mp3",
    "audio/ogg":    "ogg",  "audio/flac":   "flac",
    "audio/x-flac": "flac", "audio/aac":    "aac",
    "audio/mp4":    "mp4",  "audio/webm":   "webm",
    "video/webm":   "webm",
}

ALLOWED_EXTENSIONS = {
    ".wav", ".mp3", ".ogg", ".flac", ".aac",
    ".m4a", ".mp4", ".webm", ".opus", ".wma",
}


def _guess_format(upload: UploadFile) -> str | None:
    ct = upload.content_type or ""
    if ct in MIME_TO_FORMAT:
        return MIME_TO_FORMAT[ct]
    ext = Path(upload.filename or "").suffix.lower()
    if ext:
        guessed, _ = mimetypes.guess_type(f"file{ext}")
        if guessed in MIME_TO_FORMAT:
            return MIME_TO_FORMAT[guessed]
    return None


async def _read_audio(file: UploadFile) -> tuple[bytes, str | None]:
    """Validate, read, and return (bytes, fmt_hint). Raises HTTPException on error."""
    ext = Path(file.filename or "").suffix.lower()
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported extension '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    return data, _guess_format(file)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/health")
async def health():
    return {
        "status":               "ok",
        "model_mode":           settings.MODEL_MODE,
        "device":               str(get_asr_service().device),
        "sample_rate":          settings.SAMPLE_RATE,
        "diarization_enabled":  settings.DIARIZATION_ENABLED,
        "lm_enabled":           bool(settings.LM_DIR),
    }


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    audio_bytes, fmt = await _read_audio(file)
    logger.info("POST /transcribe  file=%s  size=%d  fmt=%s", file.filename, len(audio_bytes), fmt)

    asr = get_asr_service()
    try:
        audio_np = asr.load_audio(audio_bytes, src_format=fmt)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    transcript = asr.decode(audio_np)
    return JSONResponse({
        "transcript":   transcript,
        "duration_sec": round(len(audio_np) / asr.sample_rate, 2),
        "filename":     file.filename,
    })


@router.post("/diarize")
async def diarize(file: UploadFile = File(...)):
    if not settings.DIARIZATION_ENABLED:
        raise HTTPException(status_code=503, detail="Diarization is disabled on this server.")

    audio_bytes, fmt = await _read_audio(file)
    logger.info("POST /diarize  file=%s  size=%d  fmt=%s", file.filename, len(audio_bytes), fmt)

    from ..services.diarization import get_diarization_service
    try:
        svc    = get_diarization_service()
        result = svc.run(audio_bytes, src_format=fmt)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.exception("Diarization error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Diarization failed: {exc}")

    result["filename"] = file.filename
    return JSONResponse(result)
