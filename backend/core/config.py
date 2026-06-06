from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # ── Model ─────────────────────────────────────────────────────────────────
    # Display name shown in the frontend header and /api/health response
    MODEL_NAME: str = "Khmer ASR"

    # "plain"  → load a single Wav2Vec2ForCTC checkpoint from MODEL_PATH
    # "lora"   → load BASE_MODEL then apply LoRA adapter from LORA_PATH
    MODEL_MODE: Literal["plain", "lora"] = "plain"

    # Used when MODEL_MODE = "plain"
    MODEL_PATH: str = "./checkpoints/wav2vec2-khmer"

    # Used when MODEL_MODE = "lora"
    BASE_MODEL: str = "facebook/wav2vec2-base"
    LORA_PATH:  str = "./checkpoints/lora-adapter"

    # "auto"  → use CUDA if available, else CPU  (default)
    # "cuda"  → force GPU (raises at startup if unavailable)
    # "cpu"   → force CPU (useful for debugging or CPU-only servers)
    DEVICE: Literal["auto", "cuda", "cpu"] = "auto"

    # ── Audio ─────────────────────────────────────────────────────────────────
    SAMPLE_RATE: int = 16000

    # WebSocket streaming: accumulate this many seconds before each decode
    STREAM_BUFFER_SEC: float = 1.0
    # Overlap kept between windows to avoid cutting words at chunk boundaries
    STREAM_OVERLAP_SEC: float = 0.3

    # ── Server ────────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 7860
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
