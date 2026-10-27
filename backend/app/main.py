"""HTTP API: memory-only upload validation and genuine Gemma 4 document analysis."""
import json
import asyncio
from contextlib import asynccontextmanager, suppress
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from .config import get_settings
from .documents import DocumentError, prepare_document
from .gemma import GemmaError, analyze_with_gemma, request_context
from .evidence import verify_analysis
from .eligibility import assess_all
from .sessions import SessionStore
from .chat import answer_question
from .roadmap import build_roadmap
from .localization import repair_languages
from .schemas import AnalysisResponse, HealthResponse, StudentProfile, ChatRequest, ChatAnswer, SessionRequest
from .freshness_schemas import (
    FreshnessCheckRequest, FreshnessCheckResponse,
    FreshnessCompareRequest, FreshnessCompareResponse,
    FreshnessAnalyzeRequest,
)
from .freshness import check_freshness, compare_documents, analyze_latest_document

settings = get_settings()
@asynccontextmanager
async def lifespan(app):
    async def sweep():
        while True:
            await asyncio.sleep(30)
            app.state.sessions.cleanup()
    task = asyncio.create_task(sweep())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
    app.state.sessions.clear()


app = FastAPI(title="FormBridge AI API", version="3.0.0", docs_url="/docs", lifespan=lifespan)
app.state.sessions = SessionStore(settings.session_ttl_seconds, settings.session_max_count, settings.session_max_bytes)


@app.middleware("http")
async def request_metadata(request, call_next):
    token = request_context.set(uuid.uuid4().hex[:12])
    try:
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_context.get()
        response.headers["Cache-Control"] = "no-store"
        return response
    finally:
        request_context.reset(token)
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
    original_name = Path((file.filename or "uploaded-document").replace("\\", "/")).name[:150]
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

    verify_analysis(result, pages)
    result.eligibility_overall, result.criteria = assess_all(result.criteria, student)
    try:
        session_id = app.state.sessions.create(pages, student, result)
    except ValueError as exc:
        raise HTTPException(503, "Document context is too large. Try a smaller document.") from exc
    return AnalysisResponse(
        **result.model_dump(),
        session_id=session_id,
        session_expires_in=settings.session_ttl_seconds,
        roadmap=build_roadmap(result, student),
        model_used=settings.gemma_model,
        pages_analyzed=len(pages),
        processing_seconds=round(time.monotonic() - start, 2),
        request_id=request_context.get(),
        filename=original_name,
    )


def require_session(token: str):
    session = app.state.sessions.get(token)
    if session is None:
        raise HTTPException(410, "Document session expired or unavailable. Analyze the notice again.")
    return session


@app.post("/api/chat", response_model=ChatAnswer)
async def chat(body: ChatRequest) -> ChatAnswer:
    session = require_session(body.session_id)
    if session.lock.locked():
        raise HTTPException(409, "An answer is already being prepared. Please wait.")
    async with session.lock:
        try:
            return await answer_question(session, body.question, body.language, settings)
        except GemmaError as exc:
            raise HTTPException(exc.status, str(exc)) from exc


@app.post("/api/chat/reset")
async def reset_chat(body: SessionRequest):
    session = require_session(body.session_id)
    if session.lock.locked():
        raise HTTPException(409, "Wait for the current answer before resetting chat.")
    session.history.clear()
    return {"status": "cleared"}


@app.post("/api/analysis/translate")
async def translate_analysis(body: SessionRequest):
    session = require_session(body.session_id)
    if session.lock.locked():
        raise HTTPException(409, "An answer or translation is already being prepared. Please wait.")
    async with session.lock:
        candidate = session.analysis.model_copy(deep=True)
        if not await repair_languages(candidate, settings):
            raise HTTPException(502, "Document-content translation is unavailable. Try again later; your analysis is unchanged.")
        session.analysis = candidate
        return {**candidate.model_dump(), "roadmap": [task.model_dump() for task in build_roadmap(candidate, session.profile)]}


@app.post("/api/session/delete")
async def delete_session(body: SessionRequest):
    app.state.sessions.delete(body.session_id)
    return {"status": "deleted"}


# ── Scholarship Freshness Intelligence endpoints ─────────────────────────

@app.post("/api/freshness/check", response_model=FreshnessCheckResponse)
async def freshness_check(body: FreshnessCheckRequest) -> FreshnessCheckResponse:
    """Identify the scholarship and search for newer official versions."""
    session = require_session(body.session_id)
    if session.lock.locked():
        raise HTTPException(409, "Another operation is in progress. Please wait.")
    async with session.lock:
        try:
            return await check_freshness(session, settings)
        except GemmaError as exc:
            raise HTTPException(exc.status, str(exc)) from exc


@app.post("/api/freshness/compare", response_model=FreshnessCompareResponse)
async def freshness_compare(body: FreshnessCompareRequest) -> FreshnessCompareResponse:
    """Compare uploaded scholarship with a newer official version."""
    session = require_session(body.session_id)
    if session.lock.locked():
        raise HTTPException(409, "Another operation is in progress. Please wait.")
    async with session.lock:
        try:
            return await compare_documents(session, body.source_url, settings)
        except GemmaError as exc:
            raise HTTPException(exc.status, str(exc)) from exc


@app.post("/api/freshness/analyze-latest")
async def freshness_analyze_latest(body: FreshnessAnalyzeRequest):
    """Analyze the latest official version using the existing FormBridge pipeline."""
    session = require_session(body.session_id)
    if session.lock.locked():
        raise HTTPException(409, "Another operation is in progress. Please wait.")
    async with session.lock:
        try:
            result, pages, source_version = await analyze_latest_document(
                session, body.source_url, settings
            )
        except GemmaError as exc:
            raise HTTPException(exc.status, str(exc)) from exc

        verify_analysis(result, pages)
        result.eligibility_overall, result.criteria = assess_all(result.criteria, session.profile)

        return {
            **result.model_dump(),
            "roadmap": [task.model_dump() for task in build_roadmap(result, session.profile)],
            "source_url": body.source_url,
            "source_document_version": source_version,
            "analysis_source": "updated_official_document",
            "model_used": settings.gemma_model,
        }


@app.exception_handler(Exception)
async def unexpected_error(_request, _exc):
    # Do not disclose sensitive uploads, API credentials or provider responses.
    return JSONResponse(status_code=500, content={"detail": "Unexpected server error. Try again or contact the team."})
