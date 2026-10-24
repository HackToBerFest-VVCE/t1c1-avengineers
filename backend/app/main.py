"""HTTP API: memory-only upload validation and genuine Gemma 4 document analysis."""
import json
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .config import get_settings
from .documents import DocumentError, prepare_document
from .gemma import GemmaError, analyze_with_gemma
from .schemas import AnalysisResponse, HealthResponse, StudentProfile

settings = get_settings()
app = FastAPI(title="FormBridge AI API", version="1.0.0", docs_url="/docs")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[s.strip() for s in settings.frontend_origin.split(",") if s.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        gemma_configured=bool(settings.gemini_api_key.strip() and settings.gemini_api_key != "replace_with_your_google_ai_studio_key"),
        model=settings.gemma_model,
    )


@app.post("/api/analyze", response_model=AnalysisResponse)
async def analyze(file: UploadFile = File(...), profile: str = Form("{}")) -> AnalysisResponse:
    start = time.monotonic()
    original_name = Path(file.filename or "uploaded-document").name[:150]
    try:
        student = StudentProfile.model_validate(json.loads(profile))
    except (json.JSONDecodeError, ValidationError, TypeError) as exc:
        raise HTTPException(status_code=422, detail="Invalid student profile values.") from exc

    max_bytes = settings.max_upload_mb * 1024 * 1024
    data = await file.read(max_bytes + 1)
    await file.close()
    if len(data) > max_bytes:
        raise HTTPException(status_code=413, detail=f"Maximum upload size is {settings.max_upload_mb} MB.")

    try:
        pages = prepare_document(data, original_name, settings.max_pdf_pages)
    except DocumentError as exc:
        raise HTTPException(status_code=415, detail=str(exc)) from exc

    try:
        result = await analyze_with_gemma(pages, student, settings)
    except GemmaError as exc:
        raise HTTPException(status_code=exc.status, detail=str(exc)) from exc

    return AnalysisResponse(
        **result.model_dump(),
        model_used=settings.gemma_model,
        pages_analyzed=len(pages),
        processing_seconds=round(time.monotonic() - start, 2),
        request_id=uuid.uuid4().hex[:12],
        filename=original_name,
    )


@app.exception_handler(Exception)
async def unexpected_error(_request, _exc):
    # Do not disclose sensitive uploads, API credentials or provider responses.
    return JSONResponse(status_code=500, content={"detail": "Unexpected server error. Try again or contact the team."})
