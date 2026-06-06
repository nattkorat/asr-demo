"""
ASR service: model lifecycle + inference.

Responsibilities
────────────────
- Load Wav2Vec2ForCTC (plain checkpoint OR LoRA adapter) once at startup.
- Convert any ffmpeg-supported audio format → 16-bit PCM float32 numpy array.
- Decode a numpy audio array → transcript string.

Usage
─────
    from backend.services.asr import ASRService
    asr = ASRService()            # loads model
    text = asr.decode(audio_np)   # audio_np: float32 ndarray @ SAMPLE_RATE
"""

import logging
import subprocess

import numpy as np
import torch
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

from backend.core.config import settings

logger = logging.getLogger(__name__)


class ASRService:
    def __init__(self) -> None:
        self.sample_rate = settings.SAMPLE_RATE
        self.device = self._resolve_device()
        logger.info(
            "ASRService: loading model (mode=%s, device=%s)",
            settings.MODEL_MODE, self.device,
        )
        self.processor, self.model = self._load_model()
        logger.info("ASRService: model ready  [%s]", settings.MODEL_NAME)

    # ── Device resolution ─────────────────────────────────────────────────────

    @staticmethod
    def _resolve_device() -> torch.device:
        d = settings.DEVICE
        if d == "auto":
            return torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if d == "cuda" and not torch.cuda.is_available():
            raise RuntimeError(
                "DEVICE=cuda is set but CUDA is not available on this machine. "
                "Set DEVICE=auto or DEVICE=cpu in your .env."
            )
        return torch.device(d)

    # ── Model loading ─────────────────────────────────────────────────────────

    def _load_model(self) -> tuple[Wav2Vec2Processor, Wav2Vec2ForCTC]:
        if settings.MODEL_MODE == "lora":
            return self._load_lora()
        return self._load_plain()

    def _load_plain(self) -> tuple[Wav2Vec2Processor, Wav2Vec2ForCTC]:
        path = settings.MODEL_PATH
        logger.info("Loading plain checkpoint from %s", path)
        processor = Wav2Vec2Processor.from_pretrained(path)
        model = Wav2Vec2ForCTC.from_pretrained(path).eval().to(self.device)
        return processor, model

    def _load_lora(self) -> tuple[Wav2Vec2Processor, Wav2Vec2ForCTC]:
        try:
            from peft import PeftModel
        except ImportError as e:
            raise RuntimeError(
                "peft is required for MODEL_MODE=lora. "
                "Install it with: pip install peft"
            ) from e

        logger.info(
            "Loading LoRA: base=%s  adapter=%s",
            settings.BASE_MODEL,
            settings.LORA_PATH,
        )
        processor = Wav2Vec2Processor.from_pretrained(settings.LORA_PATH)
        base = Wav2Vec2ForCTC.from_pretrained(settings.BASE_MODEL)
        model = PeftModel.from_pretrained(base, settings.LORA_PATH).eval().to(self.device)
        return processor, model

    # ── Audio conversion ──────────────────────────────────────────────────────

    def load_audio(self, data: bytes, src_format: str | None = None) -> np.ndarray:
        """
        Convert raw audio bytes (any ffmpeg format) to a float32 numpy array
        at self.sample_rate.  src_format is a hint (e.g. 'mp3', 'wav') but
        ffmpeg can usually detect it automatically.
        """
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
        ]
        if src_format:
            cmd += ["-f", src_format]
        cmd += [
            "-i", "pipe:0",
            "-ac", "1",
            "-ar", str(self.sample_rate),
            "-f", "s16le",
            "pipe:1",
        ]

        result = subprocess.run(cmd, input=data, capture_output=True)

        if result.returncode != 0:
            raise ValueError(
                f"ffmpeg conversion failed: {result.stderr.decode(errors='replace')}"
            )

        pcm = np.frombuffer(result.stdout, dtype=np.int16)
        return pcm.astype(np.float32) / 32768.0

    def pcm16_bytes_to_float32(self, raw: bytes) -> np.ndarray:
        """
        Convert raw PCM16 bytes (from browser ScriptProcessor) to float32.
        Hot path for WebSocket streaming — no ffmpeg involved.
        """
        pcm = np.frombuffer(raw, dtype=np.int16)
        return pcm.astype(np.float32) / 32768.0

    # ── Inference ─────────────────────────────────────────────────────────────

    def decode(self, audio: np.ndarray) -> str:
        """Run CTC decoding on a float32 numpy array. Returns transcript."""
        if audio.size == 0:
            return ""

        inputs = self.processor(
            audio,
            sampling_rate=self.sample_rate,
            return_tensors="pt",
            padding=True,
        )

        with torch.no_grad():
            logits = self.model(inputs.input_values.to(self.device)).logits

        ids = torch.argmax(logits, dim=-1)
        return self.processor.batch_decode(ids)[0]


# ── Singleton ─────────────────────────────────────────────────────────────────

asr_service: ASRService | None = None


def get_asr_service() -> ASRService:
    global asr_service
    if asr_service is None:
        asr_service = ASRService()
    return asr_service
