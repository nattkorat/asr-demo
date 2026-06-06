"""
WebSocket router: real-time streaming transcription.

Protocol
────────
Client → Server:
    Binary frames: raw PCM16 audio chunks (16-bit signed, little-endian, mono,
                   16 kHz) as sent by the browser ScriptProcessor.

Server → Client:
    JSON text frames:
        {"type": "partial",  "partial":    "<interim text>"}
        {"type": "final",    "transcript": "<committed text>"}
        {"type": "error",    "message":    "<reason>"}

Flow
────
1. Client connects to /ws/asr
2. Client streams PCM16 binary chunks while recording
3. Server accumulates chunks; every STREAM_BUFFER_SEC seconds it decodes and
   sends a "partial" result.
4. Client disconnects (stops recording) → server decodes any remaining audio
   and sends a "final" result.
"""

import logging

import numpy as np
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from backend.core.config import settings
from backend.services.asr import get_asr_service

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/asr")
async def asr_stream(ws: WebSocket):
    await ws.accept()
    asr = get_asr_service()

    sr           = settings.SAMPLE_RATE
    buf_samples  = int(sr * settings.STREAM_BUFFER_SEC)
    overlap_samp = int(sr * settings.STREAM_OVERLAP_SEC)

    buffer: np.ndarray = np.array([], dtype=np.float32)
    logger.info("WS /ws/asr  client connected")

    try:
        while True:
            raw = await ws.receive_bytes()
            chunk = asr.pcm16_bytes_to_float32(raw)
            buffer = np.concatenate([buffer, chunk])

            # Decode when we have enough audio
            if len(buffer) >= buf_samples:
                text = asr.decode(buffer)
                logger.debug("WS partial: %r", text[:80])
                await ws.send_json({"type": "partial", "partial": text})

                # Keep a short overlap so words at the boundary aren't lost
                buffer = buffer[-overlap_samp:] if overlap_samp > 0 else np.array([], dtype=np.float32)

    except WebSocketDisconnect:
        logger.info("WS /ws/asr  client disconnected")
        # Final decode on whatever remains in the buffer
        if buffer.size > 0:
            text = asr.decode(buffer)
            logger.info("WS final:   %r", text[:120])
            try:
                await ws.send_json({"type": "final", "transcript": text})
            except Exception:
                pass  # client already gone

    except Exception as exc:
        logger.exception("WS /ws/asr  unexpected error: %s", exc)
        try:
            await ws.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
