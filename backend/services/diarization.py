"""
Diarization service: speaker diarization + per-segment transcription.

Wraps module.diarization.SpeakerDiarizer and delegates all ASR decoding
(including LM support) to the shared ASRService singleton — no duplicate
model or LM loading here.

Returns:
{
  "duration_sec": float,
  "num_speakers":  int,
  "segments": [
    {"speaker": str, "start": float, "end": float, "duration": float, "text": str},
    ...
  ]
}
"""

import logging
import tempfile
from pathlib import Path

import numpy as np

from backend.core.config import settings
from backend.services.asr import get_asr_service

logger = logging.getLogger(__name__)

MIN_SEG_SEC = 0.2   # skip segments shorter than this


class DiarizationService:
    def __init__(self) -> None:
        if not settings.DIARIZATION_ENABLED:
            raise RuntimeError("Diarization is disabled (DIARIZATION_ENABLED=false).")
        if not settings.HF_TOKEN:
            raise RuntimeError(
                "HF_TOKEN is required for speaker diarization. "
                "Set it in your .env file."
            )

        logger.info("DiarizationService: loading SpeakerDiarizer …")
        from ..module.diarization import SpeakerDiarizer

        asr = get_asr_service()
        self._diarizer = SpeakerDiarizer(
            hf_token=settings.HF_TOKEN,
            device=asr.device,
        )
        logger.info(
            "DiarizationService: ready  (ASR lm=%s)",
            asr.use_lm,
        )

    # ── Public API ────────────────────────────────────────────────────────────

    def run(self, audio_bytes: bytes, src_format: str | None = None) -> dict:
        """Run diarization + transcription on raw audio bytes."""
        suffix = f".{src_format}" if src_format else ".wav"
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = Path(tmp.name)
        try:
            return self._diarize_file(str(tmp_path))
        finally:
            tmp_path.unlink(missing_ok=True)

    # ── Internal ──────────────────────────────────────────────────────────────

    def _diarize_file(self, audio_path: str) -> dict:
        logger.info("Diarizing: %s", audio_path)

        diarization = self._diarizer(
            audio_path=audio_path,
            num_speakers=settings.DIARIZE_NUM_SPEAKERS,
            min_speakers=settings.DIARIZE_MIN_SPEAKERS,
            max_speakers=settings.DIARIZE_MAX_SPEAKERS,
            show_progress=False,
        )

        logger.info(
            "Diarization done: %d speaker(s), %d segment(s), %.1fs",
            diarization["num_speakers"],
            len(diarization["segments"]),
            diarization["duration"],
        )

        asr      = get_asr_service()
        segments = []

        for i, seg in enumerate(diarization["segments"]):
            if seg["duration"] < MIN_SEG_SEC:
                continue

            audio_chunk = seg["audio_chunk"]

            # ── Normalise to 1D float32 numpy array ──────────────────────────
            # torchaudio.load → Tensor[channels, samples]
            # After merge, shape can be [1, samples] or even [1, 1, samples].
            # Wav2Vec2Processor expects a plain 1D numpy array [samples].
            if hasattr(audio_chunk, "numpy"):
                audio_chunk = audio_chunk.squeeze().numpy()   # Tensor → numpy
            elif hasattr(audio_chunk, "ndim") and audio_chunk.ndim > 1:
                audio_chunk = audio_chunk.squeeze()           # numpy multi-dim

            if audio_chunk.dtype != "float32":
                audio_chunk = audio_chunk.astype("float32")

            # Normalise amplitude if still in int16 range
            if audio_chunk.max() > 1.0:
                audio_chunk = audio_chunk / 32768.0

            # Resample to 16 kHz if the diarizer returned a different rate
            if seg["sample_rate"] != 16_000:
                try:
                    import librosa
                    audio_chunk = librosa.resample(
                        audio_chunk,
                        orig_sr=seg["sample_rate"],
                        target_sr=16_000,
                    )
                except ImportError:
                    logger.warning(
                        "librosa not installed — skipping resample for segment %d", i
                    )

            # Delegate to ASRService — LM is applied automatically if loaded
            text = asr.decode(audio_chunk)

            logger.debug(
                "  seg %d/%d  %s [%.2f→%.2f]: %r",
                i + 1, len(diarization["segments"]),
                seg["speaker"], seg["start"], seg["end"], text[:60],
            )

            segments.append({
                "speaker":  seg["speaker"],
                "start":    round(seg["start"],    3),
                "end":      round(seg["end"],      3),
                "duration": round(seg["duration"], 3),
                "text":     text,
            })

        return {
            "duration_sec": round(diarization["duration"], 2),
            "num_speakers": diarization["num_speakers"],
            "segments":     segments,
        }


# ── Singleton ─────────────────────────────────────────────────────────────────

_svc: DiarizationService | None = None


def get_diarization_service() -> DiarizationService:
    global _svc
    if _svc is None:
        _svc = DiarizationService()
    return _svc
