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

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
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

FRONTEND_DIR  = Path(__file__).parent.parent / "frontend"
REACT_DIST    = FRONTEND_DIR / "dist"          # built by: cd frontend-react && npm run build
STATIC_DIR    = FRONTEND_DIR / "static"

assets_dir = REACT_DIST / "assets"

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

logger.info("REACT_DIST: %s", REACT_DIST)
logger.info("ASSETS_DIR: %s", assets_dir)
logger.info("ASSETS EXISTS: %s", assets_dir.exists())

if assets_dir.exists():
    logger.info("Files: %s", list(assets_dir.iterdir())[:10])

    app.mount(
        "/assets",
        StaticFiles(directory=str(assets_dir)),
        name="react-assets",
    )

# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(http_router)   # GET /api/health, POST /api/transcribe
app.include_router(ws_router)     # WS  /ws/asr


# ── Frontend ──────────────────────────────────────────────────────────────────
# Inject MODEL_NAME so the UI title always matches .env without a template engine.

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def index():
    # Prefer the React production build (frontend/dist/index.html)
    # Fall back to the legacy single-file HTML during development
    react_index = REACT_DIST / "index.html"
    legacy_index = FRONTEND_DIR / "index.html"

    if react_index.exists():
        return HTMLResponse(react_index.read_text(encoding="utf-8"))

    if legacy_index.exists():
        html = legacy_index.read_text(encoding="utf-8")
        html = html.replace("{{MODEL_NAME}}", settings.MODEL_NAME)
        return HTMLResponse(html)

    return HTMLResponse("<h1>Frontend not found. Run: cd frontend-react && npm run build</h1>", status_code=404)


# ── Static assets ─────────────────────────────────────────────────────────────
# Serve frontend/static/ at /static — this is where the logo lives.
# Always create the directory so the mount never fails on a fresh clone.

STATIC_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Serve React build assets (JS/CSS chunks) — must be after API routes
if REACT_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(REACT_DIST / "assets")), name="react-assets")


# ── Logo upload ───────────────────────────────────────────────────────────────
# POST /api/upload-logo  (multipart, field name: "file")
# Saves the logo to frontend/static/ so it is immediately served at /static/logo.<ext>
# Supported formats: PNG, JPG, SVG, WEBP, ICO
#
# Quick test:
#   curl -X POST http://localhost:7860/api/upload-logo \
#        -F "file=@/path/to/your/logo.png"
#
# Then update the <img src="..."> in index.html to /static/logo.<ext> if needed.
# (PNG is already the default.)

_ALLOWED_LOGO_EXT = {".png", ".jpg", ".jpeg", ".svg", ".webp", ".ico"}


@app.post("/api/upload-logo", tags=["Admin"])
async def upload_logo(file: UploadFile = File(...)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in _ALLOWED_LOGO_EXT:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported format '{ext}'. Allowed: {sorted(_ALLOWED_LOGO_EXT)}",
        )
    data = await file.read()
    dest = STATIC_DIR / f"logo{ext}"
    dest.write_bytes(data)
    logger.info("Logo saved → %s  (%d bytes)", dest, len(data))
    return JSONResponse({"saved": f"/static/logo{ext}", "bytes": len(data)})