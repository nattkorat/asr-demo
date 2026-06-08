"""
Report service: generates a DOCX report from summarization output.

Calls the Node.js generate_report.js script via subprocess, passing the
full payload as a temporary JSON file and receiving back a DOCX file.

Usage:
    from backend.services.report import ReportService
    svc   = ReportService()
    docx  = svc.generate(summary_result, transcript=..., segments=...)
    # docx is raw bytes — send as a file download
"""

import json
import logging
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from datetime import datetime, timezone, timedelta

from backend.core.config import settings

logger = logging.getLogger(__name__)

ICT = timezone(timedelta(hours=7))
# Path to the Node.js generator script
_SCRIPT = Path(__file__).parent.parent / "reports" / "generate_report.js"


class ReportService:
    def __init__(self) -> None:
        if not _SCRIPT.exists():
            raise RuntimeError(f"Report script not found: {_SCRIPT}")
        # Verify node is available
        result = subprocess.run(["node", "--version"], capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError("node is not available. Install Node.js to enable report generation.")
        logger.info("ReportService: ready (node %s)", result.stdout.strip())

    def generate(
        self,
        summary: dict,
        transcript: str | None = None,
        segments: list[dict] | None = None,
    ) -> bytes:
        """
        Generate a DOCX report.

        Args:
            summary:    output from LLMService.summarize()
                        {summary, key_points, action_items, metadata}
            transcript: plain text transcript (used when segments is None)
            segments:   diarized segments [{speaker, start, end, text}, ...]

        Returns:
            Raw DOCX bytes ready to stream as a file download.
        """
        payload = {
            "model_name":   settings.MODEL_NAME,
            "generated_at": datetime.now(ICT).isoformat(),
            "metadata":     summary.get("metadata", {}),
            "summary":      summary["summary"],
            "key_points":   summary["key_points"],
            "action_items": summary["action_items"],
            "transcript":   transcript,
            "segments":     segments,
        }

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp = Path(tmpdir)
            input_json  = tmp / "input.json"
            output_docx = tmp / "report.docx"

            input_json.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")

            result = subprocess.run(
                ["node", str(_SCRIPT), str(input_json), str(output_docx)],
                capture_output=True,
                text=True,
                cwd=str(_SCRIPT.parent),   # resolve node_modules relative to script
            )

            stdout = result.stdout.strip()
            stderr = result.stderr.strip()

            if result.returncode != 0 or not stdout.startswith("OK:"):
                logger.error("Report generation failed:\nSTDOUT: %s\nSTDERR: %s", stdout, stderr)
                raise RuntimeError(
                    f"Report generation failed: {stderr or stdout or 'unknown error'}"
                )

            if not output_docx.exists():
                raise RuntimeError("Report script exited OK but no .docx was written.")

            logger.info("Report generated: %d bytes", output_docx.stat().st_size)
            return output_docx.read_bytes()


# ── Singleton ─────────────────────────────────────────────────────────────────

_svc: ReportService | None = None


def get_report_service() -> ReportService:
    global _svc
    if _svc is None:
        _svc = ReportService()
    return _svc
