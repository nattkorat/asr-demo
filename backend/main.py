"""
main.py — FastAPI application entry point.

Run:
    uvicorn backend.main:app --host 0.0.0.0 --port 7860 --reload

Or via the helper script:
    python run.py
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from backend.core.config import settings
from backend.routers.http import router as http_router
from backend.routers.websocket import router as ws_router
from backend.services.asr import get_asr_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"


# ── Lifespan: load model once before first request ────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — loading ASR model …")
    get_asr_service()
    logger.info("Model loaded. Server ready.")
    yield
    logger.info("Shutting down.")


# ── App factory ───────────────────────────────────────────────────────────────

app = FastAPI(
    title=settings.MODEL_NAME,
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(http_router)   # GET /api/health, POST /api/transcribe
app.include_router(ws_router)     # WS  /ws/asr


# ── Frontend ──────────────────────────────────────────────────────────────────
# Inject MODEL_NAME from config so the UI title always matches .env
# without needing a template engine.

def _render_index() -> str:
    html_path = FRONTEND_DIR / "index.html"
    if not html_path.exists():
        return "<h1>frontend/index.html not found</h1>"
    html = html_path.read_text(encoding="utf-8")
    # Replace the placeholder the frontend uses for the model name
    html = html.replace("{{MODEL_NAME}}", settings.MODEL_NAME)
    return html


@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def index():
    return HTMLResponse(_render_index())


# Mount optional static assets (css, js, images) under /static
_static_dir = FRONTEND_DIR / "static"
if _static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(_static_dir)), name="static")
