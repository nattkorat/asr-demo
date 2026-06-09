from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # ── Model ─────────────────────────────────────────────────────────────────
    MODEL_NAME: str = "Khmer ASR"
    MODEL_MODE: Literal["plain", "lora"] = "plain"
    MODEL_PATH: str = "./checkpoints/wav2vec2-khmer"
    BASE_MODEL: str = "facebook/wav2vec2-base"
    LORA_PATH:  str = "./checkpoints/lora-adapter"
    DEVICE: Literal["auto", "cuda", "cpu"] = "auto"

    # ── Audio ─────────────────────────────────────────────────────────────────
    SAMPLE_RATE: int = 16000
    STREAM_BUFFER_SEC: float = 1.0
    STREAM_OVERLAP_SEC: float = 0.3

    # ── Diarization ───────────────────────────────────────────────────────────
    # Set to false to hide the Diarize option in the UI entirely
    DIARIZATION_ENABLED: bool = True

    # Hugging Face token — required by pyannote/speaker-diarization
    # Get yours at https://huggingface.co/settings/tokens
    HF_TOKEN: str | None = None

    # Optional KenLM language model directory (lm.binary + unigrams.txt)
    # Leave empty to decode without LM
    LM_DIR: str | None = None

    # Speaker count hints (all optional — pyannote auto-detects if unset)
    DIARIZE_NUM_SPEAKERS: int | None = None
    DIARIZE_MIN_SPEAKERS: int | None = None
    DIARIZE_MAX_SPEAKERS: int | None = None

    # ── LLM / Summarization ──────────────────────────────────────────────────────
    # Dotted import path to the module containing your LLM wrapper function
    LLM_MODULE:    str = "backend.module.llm"
    # Name of the callable inside that module: fn(prompt: str) -> dict
    LLM_FUNCTION:  str = "summarize"
    # Prompt template file — edit freely without restarting the server
    LLM_PROMPT_FILE: str = "./prompts/summarize.txt"
    
    # LLM Keys, Add in .env file is recommended
    GEMINI_KEY: str | None = None # Gemini Key for LLM process (in case using Gemini)
    OPENAI_API_KEY: str | None = None
    
    # For cert https
    SSL_KEYFILE: str | None = None
    CERT: str | None = None

    # ── Server ────────────────────────────────────────────────────────────────
    HOST: str = "0.0.0.0"
    PORT: int = 7860
    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()