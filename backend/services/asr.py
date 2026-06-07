"""
ASR service: model lifecycle + inference.

Responsibilities
────────────────
- Load Wav2Vec2ForCTC (plain checkpoint OR LoRA adapter) once at startup.
- Optionally wrap processor with a KenLM n-gram decoder (Wav2Vec2ProcessorWithLM).
- Convert any ffmpeg-supported audio format → 16-bit PCM float32 numpy array.
- Decode a numpy audio array → transcript string (greedy or LM-boosted).

LM support
──────────
Set LM_DIR in .env to a directory containing:
    lm.binary     — KenLM binary language model
    unigrams.txt  — one unigram per line (used by pyctcdecode)

If LM_DIR is unset or loading fails, falls back silently to greedy CTC decode.
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
        self.use_lm      = False
        self.device      = self._resolve_device()

        logger.info(
            "ASRService: loading model (mode=%s, device=%s)",
            settings.MODEL_MODE, self.device,
        )
        self.processor, self.model = self._load_model()

        # Try to upgrade processor with LM decoder
        if settings.LM_DIR:
            self._attach_lm()

        logger.info(
            "ASRService: ready  [%s]  lm=%s",
            settings.MODEL_NAME, self.use_lm,
        )

    # ── Device resolution ─────────────────────────────────────────────────────

    @staticmethod
    def _resolve_device() -> torch.device:
        d = settings.DEVICE
        if d == "auto":
            return torch.device("cuda" if torch.cuda.is_available() else "cpu")
        if d == "cuda" and not torch.cuda.is_available():
            raise RuntimeError(
                "DEVICE=cuda is set but CUDA is not available. "
                "Use DEVICE=auto or DEVICE=cpu in your .env."
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
        model     = Wav2Vec2ForCTC.from_pretrained(path).eval().to(self.device)
        return processor, model

    def _load_lora(self) -> tuple[Wav2Vec2Processor, Wav2Vec2ForCTC]:
        try:
            from peft import PeftModel
        except ImportError as exc:
            raise RuntimeError(
                "peft is required for MODEL_MODE=lora. "
                "Install it with: pip install peft"
            ) from exc

        logger.info(
            "Loading LoRA: base=%s  adapter=%s",
            settings.BASE_MODEL, settings.LORA_PATH,
        )
        processor = Wav2Vec2Processor.from_pretrained(settings.LORA_PATH)
        base      = Wav2Vec2ForCTC.from_pretrained(settings.BASE_MODEL)
        model     = PeftModel.from_pretrained(base, settings.LORA_PATH).eval().to(self.device)
        return processor, model

    # ── LM attachment ─────────────────────────────────────────────────────────

    def _attach_lm(self) -> None:
        """
        Upgrade self.processor to Wav2Vec2ProcessorWithLM using the KenLM
        binary + unigrams in settings.LM_DIR.  Mirrors the pattern in the
        original main.py exactly.  Failures are logged and silently ignored
        so the server stays up without LM support.
        """
        try:
            from transformers import (
                Wav2Vec2CTCTokenizer,
                Wav2Vec2ProcessorWithLM,
            )
            from ..module import lm as lm_module

            model_path = (
                settings.LORA_PATH
                if settings.MODEL_MODE == "lora"
                else settings.MODEL_PATH
            )

            tokenizer   = Wav2Vec2CTCTokenizer.from_pretrained(model_path)
            vocab_dict  = tokenizer.get_vocab()

            # pyctcdecode expects vocab sorted by token id, lowercase
            sorted_vocab = {
                k.lower(): v
                for k, v in sorted(vocab_dict.items(), key=lambda x: x[1])
            }

            decoder = lm_module.load_ngrams_decoder(
                settings.LM_DIR, list(sorted_vocab.keys())
            )

            self.processor = Wav2Vec2ProcessorWithLM(
                feature_extractor=self.processor.feature_extractor,
                tokenizer=tokenizer,
                decoder=decoder,
            )
            self.use_lm = True
            logger.info("ASRService: LM decoder loaded from %s", settings.LM_DIR)

        except Exception as exc:
            logger.warning(
                "ASRService: LM loading failed (%s) — falling back to greedy decode",
                exc,
            )

    # ── Audio conversion ──────────────────────────────────────────────────────

    def load_audio(self, data: bytes, src_format: str | None = None) -> np.ndarray:
        """
        Convert raw audio bytes (any ffmpeg format) to a float32 numpy array
        at self.sample_rate.
        """
        cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
        if src_format:
            cmd += ["-f", src_format]
        cmd += ["-i", "pipe:0", "-ac", "1", "-ar", str(self.sample_rate),
                "-f", "s16le", "pipe:1"]

        result = subprocess.run(cmd, input=data, capture_output=True)
        if result.returncode != 0:
            raise ValueError(
                f"ffmpeg conversion failed: {result.stderr.decode(errors='replace')}"
            )

        pcm = np.frombuffer(result.stdout, dtype=np.int16)
        return pcm.astype(np.float32) / 32768.0

    def pcm16_bytes_to_float32(self, raw: bytes) -> np.ndarray:
        """Convert raw PCM16 bytes from the browser into float32. Hot path."""
        pcm = np.frombuffer(raw, dtype=np.int16)
        return pcm.astype(np.float32) / 32768.0

    # ── Inference ─────────────────────────────────────────────────────────────

    def decode(self, audio: np.ndarray) -> str:
        """
        Decode a float32 numpy audio array to a transcript string.

        Uses LM-boosted beam search (Wav2Vec2ProcessorWithLM) when an LM was
        successfully loaded, otherwise falls back to greedy CTC argmax.
        """
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

        if self.use_lm:
            # ProcessorWithLM.batch_decode expects a numpy array of logits
            transcription = self.processor.batch_decode(logits.cpu().numpy())[0][0]
        else:
            ids           = torch.argmax(logits, dim=-1)
            transcription = self.processor.batch_decode(ids)[0]

        return transcription.strip()


# ── Singleton ─────────────────────────────────────────────────────────────────

asr_service: ASRService | None = None


def get_asr_service() -> ASRService:
    global asr_service
    if asr_service is None:
        asr_service = ASRService()
    return asr_service