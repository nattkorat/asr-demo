"""
LLM summarization service.

This module is a thin adapter between the ASR demo and the user's own LLM
wrapper.  It handles:
  - Loading the prompt template from disk (hot-reloaded each call so you can
    edit prompts without restarting the server)
  - Formatting the transcript into the prompt
  - Calling the user's LLM function
  - Validating and normalising the returned dict

Your LLM wrapper contract
─────────────────────────
The function imported via LLM_MODULE / LLM_FUNCTION in config must match:

    def my_llm(prompt: str) -> dict:
        ...
        return {
            "summary":      str,          # required
            "key_points":   list[str],    # required
            "action_items": list[str],    # required (can be empty)
        }

If your function returns extra keys they are passed through transparently.
If required keys are missing a ValueError is raised and the endpoint returns 422.

Configuration (.env)
────────────────────
    LLM_MODULE=module.llm             # dotted import path to the module
    LLM_FUNCTION=summarize            # function name inside that module
    LLM_PROMPT_FILE=./prompts/summarize.txt
"""

import importlib
import json
import logging
import re
from pathlib import Path
from typing import Callable

from backend.core.config import settings

logger = logging.getLogger(__name__)

# ── Required keys that must be present in the LLM response ────────────────────
REQUIRED_KEYS = {"summary", "key_points", "action_items"}


class LLMService:
    def __init__(self) -> None:
        self._fn: Callable[[str], dict] = self._load_function()
        logger.info(
            "LLMService: loaded %s.%s",
            settings.LLM_MODULE, settings.LLM_FUNCTION,
        )

    # ── Load the user's LLM function ──────────────────────────────────────────

    @staticmethod
    def _load_function() -> Callable[[str], dict]:
        try:
            mod = importlib.import_module(settings.LLM_MODULE)
        except ModuleNotFoundError as exc:
            raise RuntimeError(
                f"Could not import LLM module '{settings.LLM_MODULE}'. "
                f"Set LLM_MODULE in your .env to the dotted path of your wrapper. "
                f"Original error: {exc}"
            ) from exc

        fn = getattr(mod, settings.LLM_FUNCTION, None)
        if fn is None:
            raise RuntimeError(
                f"Function '{settings.LLM_FUNCTION}' not found in module "
                f"'{settings.LLM_MODULE}'. Set LLM_FUNCTION in your .env."
            )
        if not callable(fn):
            raise RuntimeError(
                f"'{settings.LLM_MODULE}.{settings.LLM_FUNCTION}' is not callable."
            )
        return fn

    # ── Prompt loading (hot-reload on every call) ──────────────────────────────

    @staticmethod
    def _load_prompt() -> str:
        path = Path(settings.LLM_PROMPT_FILE)
        if not path.exists():
            raise FileNotFoundError(
                f"Prompt file not found: {path}. "
                f"Set LLM_PROMPT_FILE in your .env."
            )
        return path.read_text(encoding="utf-8")

    # ── Transcript formatting ──────────────────────────────────────────────────

    @staticmethod
    def _format_transcript(
        transcript: str | None,
        segments: list[dict] | None,
    ) -> str:
        """
        Build the transcript block injected into the prompt.
        Uses diarized segments when available (preserves speaker labels),
        falls back to plain transcript text.
        """
        if segments:
            lines = ["TRANSCRIPT (with speaker labels):"]
            for seg in segments:
                start = _fmt_ts(seg["start"])
                end   = _fmt_ts(seg["end"])
                lines.append(f"[{seg['speaker']}  {start} → {end}]")
                lines.append(f"  {seg['text']}")
                lines.append("")
            return "\n".join(lines)

        if transcript:
            return f"TRANSCRIPT:\n{transcript}"

        raise ValueError("Either 'transcript' or 'segments' must be provided.")

    # ── Public API ─────────────────────────────────────────────────────────────

    def summarize(
        self,
        transcript: str | None = None,
        segments: list[dict] | None = None,
        metadata: dict | None = None,
    ) -> dict:
        """
        Summarize a transcript.

        Args:
            transcript:  plain text transcript (used when no segments)
            segments:    diarized segment list [{speaker, start, end, text}, ...]
            metadata:    optional dict with keys like filename, duration_sec,
                         num_speakers — included in the returned result but not
                         sent to the LLM

        Returns:
            {
                "summary":      str,
                "key_points":   [str, ...],
                "action_items": [str, ...],
                "metadata":     {...},   # echoed back from input
            }
        """
        prompt_tpl   = self._load_prompt()
        tx_block     = self._format_transcript(transcript, segments)
        prompt       = prompt_tpl.replace("{transcript_block}", tx_block)

        logger.info(
            "LLMService: calling %s.%s (prompt_len=%d)",
            settings.LLM_MODULE, settings.LLM_FUNCTION, len(prompt),
        )

        raw = self._fn(prompt)

        # If the function returned a string instead of a dict, try JSON-parsing it
        if isinstance(raw, str):
            raw = _parse_json_string(raw)

        _validate(raw)

        result = {
            "summary":      raw["summary"],
            "key_points":   raw["key_points"],
            "action_items": raw["action_items"],
            "metadata":     metadata or {},
        }

        logger.info(
            "LLMService: done — %d key points, %d action items",
            len(result["key_points"]), len(result["action_items"]),
        )
        return result


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt_ts(seconds: float) -> str:
    m = int(seconds // 60)
    s = seconds % 60
    return f"{m}:{s:05.2f}"


def _parse_json_string(text: str) -> dict:
    """Strip markdown fences then parse JSON."""
    clean = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    try:
        return json.loads(clean)
    except json.JSONDecodeError as exc:
        raise ValueError(f"LLM returned invalid JSON: {exc}\nRaw output: {text[:400]}") from exc


def _validate(data: dict) -> None:
    missing = REQUIRED_KEYS - set(data.keys())
    if missing:
        raise ValueError(
            f"LLM response is missing required keys: {missing}. Got: {set(data.keys())}"
        )
    if not isinstance(data["key_points"], list):
        raise ValueError("'key_points' must be a list.")
    if not isinstance(data["action_items"], list):
        raise ValueError("'action_items' must be a list.")


# ── Singleton ─────────────────────────────────────────────────────────────────

_svc: LLMService | None = None


def get_llm_service() -> LLMService:
    global _svc
    if _svc is None:
        _svc = LLMService()
    return _svc
