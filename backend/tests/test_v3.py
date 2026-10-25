import asyncio
import json

import httpx
import pytest
from pydantic import ValidationError

from app import main
from app.chat import answer_question
from app.config import Settings
from app.documents import PageImage
from app.eligibility import assess_all
from app.gemma import GemmaError, generate_text, retry_after_seconds
from app.roadmap import MISSING_DEADLINE, build_roadmap
from app.schemas import Criterion, EligibilityRule, ExtractedAnalysis, StudentProfile, Verification
from app.sessions import SessionStore


@pytest.mark.asyncio
@pytest.mark.parametrize("code", [500, 502, 503, 504])
async def test_transient_errors_retry(code, monkeypatch):
    calls, sleeps = [], []
    async def pause(seconds): sleeps.append(seconds)
    monkeypatch.setattr(asyncio, "sleep", pause)
    def handle(request):
        calls.append(request)
        return httpx.Response(code) if len(calls) < 3 else httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "ok"}]}}]})
    assert await generate_text({}, Settings(gemini_api_key="test"), httpx.MockTransport(handle)) == "ok"
    assert len(calls) == 3 and len(sleeps) == 2 and sleeps[1] > sleeps[0]


@pytest.mark.asyncio
@pytest.mark.parametrize("code", [400, 401, 403, 404, 429])
async def test_permanent_errors_do_not_retry(code):
    calls = []
    def handle(request):
        calls.append(request)
        return httpx.Response(code, json={"secret": "never display"})
    with pytest.raises(GemmaError) as info:
        await generate_text({}, Settings(gemini_api_key="test"), httpx.MockTransport(handle))
    assert len(calls) == 1 and "never display" not in str(info.value)


@pytest.mark.asyncio
async def test_retry_after_and_bounded_failures(monkeypatch):
    sleeps, calls = [], []
    async def pause(seconds): sleeps.append(seconds)
    monkeypatch.setattr(asyncio, "sleep", pause)
    def handle(request):
        calls.append(request)
        return httpx.Response(429, headers={"Retry-After": "2"})
    with pytest.raises(GemmaError):
        await generate_text({}, Settings(gemini_api_key="test"), httpx.MockTransport(handle))
    assert sleeps == [2, 2] and len(calls) == 3
    assert retry_after_seconds("not a date") is None
    assert retry_after_seconds("Wed, 21 Oct 2015 07:28:00 GMT") == 0


@pytest.mark.asyncio
async def test_long_retry_after_does_not_retry():
    calls = []
    def handle(request):
        calls.append(request)
        return httpx.Response(429, headers={"Retry-After": "120"})
    with pytest.raises(GemmaError):
        await generate_text({}, Settings(gemini_api_key="test"), httpx.MockTransport(handle))
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_timeouts_retry_and_safe_logging(monkeypatch, caplog):
    async def pause(_): pass
    monkeypatch.setattr(asyncio, "sleep", pause)
    calls = []
    def handle(request):
        calls.append(request)
        raise httpx.ReadTimeout("sensitive diagnostic", request=request)
    with caplog.at_level("INFO", logger="formbridge.gemma"):
        with pytest.raises(GemmaError, match="timed out"):
            await generate_text({}, Settings(gemini_api_key="TOP-SECRET"), httpx.MockTransport(handle))
    assert len(calls) == 3
    assert "request_id=" in caplog.text and "retry_count=2" in caplog.text
    assert "TOP-SECRET" not in caplog.text and "sensitive diagnostic" not in caplog.text


def test_session_isolation_expiration_eviction():
    now = [0.0]
    store = SessionStore(ttl=10, max_count=2, clock=lambda: now[0])
    a = store.create([], StudentProfile(state="Karnataka"), ExtractedAnalysis(title="A"))
    b = store.create([], StudentProfile(state="Kerala"), ExtractedAnalysis(title="B"))
    assert a != b and len(a) >= 32
    assert store.get(a).analysis.title == "A" and store.get(b).profile.state == "Kerala"
    store.get(a).history.append({"role": "user"})
    assert store.get(b).history == []
    c = store.create([], StudentProfile(), ExtractedAnalysis(title="C"))
    assert store.get(a) is None and store.get(c) is not None
    now[0] = 11
    assert store.get(b) is None and store.get(c) is None


@pytest.mark.asyncio
@pytest.mark.parametrize("language", ["en", "kn"])
async def test_grounded_chat_request_and_citation_verification(language):
    store = SessionStore()
    token = store.create([PageImage(b"PNG", "image/png", 1, "Applicants must prepare an income certificate.")], StudentProfile(), ExtractedAnalysis(title="Notice A"))
    seen = []
    def handle(request):
        seen.append(json.loads(request.content))
        answer = {"answer": "Prepare an income certificate." if language == "en" else "ಆದಾಯ ಪ್ರಮಾಣಪತ್ರವನ್ನು ಸಿದ್ಧಪಡಿಸಿ.",
                  "citations": [{"page": 1, "evidence": "prepare an income certificate"}, {"page": 1, "evidence": "invented deadline 2028"}],
                  "missing_information": ["Age not supplied"], "suggestions": []}
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json.dumps(answer)}]}}]})
    answer = await answer_question(store.get(token), "What documents?", language, Settings(gemini_api_key="test"), httpx.MockTransport(handle))
    assert answer.citations[0].verification.status == "verified"
    assert answer.citations[1].verification.status == "unverified"
    serialized = json.dumps(seen[0], ensure_ascii=False)
    assert "Notice A" in serialized and "not specified" in serialized.lower()
    assert '"language": "' + language + '"' in seen[0]["contents"][-1]["parts"][0]["text"]
    assert len(store.get(token).history) == 2


def test_missing_age_mode_and_unverified_rule_stay_uncertain():
    rule = EligibilityRule(field="age", operator="lte", value_number=25)
    item = Criterion(requirement="Age limit", evidence="Maximum age 25", page=1, rule=rule, verification=Verification(status="verified"))
    assert assess_all([item], StudentProfile())[0] == "needs_verification"
    assert assess_all([item], StudentProfile(age=21))[0] == "appears_to_meet_extracted"
    item.verification.status = "unverified"
    assert assess_all([item], StudentProfile(age=21))[0] == "needs_verification"
    mode = Criterion(requirement="Full time", evidence="Full time students", page=1, rule=EligibilityRule(field="study_mode", operator="eq", values=["Full-time"]))
    assert assess_all([mode], StudentProfile())[0] == "needs_verification"
    category = Criterion(requirement="Category", evidence="SC or ST", page=1, rule=EligibilityRule(field="category", operator="one_of", values=["SC", "ST"]))
    assert assess_all([category], StudentProfile(category="Prefer not to say"))[0] == "needs_verification"


@pytest.mark.parametrize("data", [{"age": -1}, {"percentage": 101}, {"annual_income": -1}, {"percentage": float("nan")}])
def test_invalid_student(data):
    with pytest.raises(ValidationError): StudentProfile.model_validate(data)


def test_roadmap_missing_deadline_and_sources():
    analysis = ExtractedAnalysis.model_validate({"documents": [{"name": "Marksheet", "evidence": "Marksheet", "page": 1}],
                                               "steps": [{"title": "Apply", "detail_en": "Send form", "detail_kn": "ಅರ್ಜಿ ಕಳುಹಿಸಿ"}]})
    tasks = build_roadmap(analysis, StudentProfile())
    assert len({task.id for task in tasks}) == len(tasks)
    assert next(t for t in tasks if t.id == "deadline").detail_en == MISSING_DEADLINE
    assert next(t for t in tasks if t.id == "document-0").page == 1
    assert all(not t.completed for t in tasks)


def test_chat_endpoints_missing_session_invalid_input_and_reset(client):
    assert client.post("/api/chat", json={"session_id": "x" * 40, "question": "Why?"}).status_code == 410
    token = main.app.state.sessions.create([], StudentProfile(), ExtractedAnalysis())
    session = main.app.state.sessions.get(token)
    session.history.append({"role": "user"})
    assert client.post("/api/chat", json={"session_id": token, "question": " "}).status_code == 422
    assert client.post("/api/chat", json={"session_id": token, "question": "x" * 2001}).status_code == 422
    assert client.post("/api/chat/reset", json={"session_id": token}).status_code == 200
    assert session.history == []
    assert client.post("/api/session/delete", json={"session_id": token}).status_code == 200
    assert main.app.state.sessions.get(token) is None


def test_safe_api_failure(client, png_bytes, monkeypatch):
    async def fail(*_): raise GemmaError("Temporary provider failure", 502)
    monkeypatch.setattr(main, "analyze_with_gemma", fail)
    res = client.post("/api/analyze", files={"file": ("../../private.png", png_bytes, "image/png")})
    assert res.status_code == 502 and "private.png" not in res.text


def test_session_memory_limit_and_explicit_delete():
    store = SessionStore(max_bytes=10)
    with pytest.raises(ValueError):
        store.create([], StudentProfile(), ExtractedAnalysis())


def test_chat_busy_expired_and_safe_error(client, monkeypatch):
    token = main.app.state.sessions.create([], StudentProfile(), ExtractedAnalysis())
    session = main.app.state.sessions.get(token)
    session.lock = type("Busy", (), {"locked": lambda _: True})()
    assert client.post("/api/chat", json={"session_id": token, "question": "Why?"}).status_code == 409
    assert client.post("/api/chat/reset", json={"session_id": token}).status_code == 409
    session.lock = asyncio.Lock()
    async def fail(*_): raise GemmaError("Provider unavailable", 502)
    monkeypatch.setattr(main, "answer_question", fail)
    assert client.post("/api/chat", json={"session_id": token, "question": "Why?"}).status_code == 502
    session.expires_at = 0
    assert client.post("/api/chat", json={"session_id": token, "question": "Why?"}).status_code == 410


def test_api_never_passes_image_rule_without_text_verification(client, png_bytes, monkeypatch):
    async def extracted(*_):
        return ExtractedAnalysis(criteria=[Criterion(requirement="Marks", page=1, evidence="Minimum marks 70%",
              rule=EligibilityRule(field="percentage", operator="gte", value_number=70))])
    monkeypatch.setattr(main, "analyze_with_gemma", extracted)
    res = client.post("/api/analyze", files={"file": ("../../notice.png", png_bytes, "image/png")},
                      data={"profile": json.dumps({"percentage": 85})})
    result = res.json()
    assert result["filename"] == "notice.png"
    assert result["criteria"][0]["status"] == "needs_review"
    assert result["criteria"][0]["verification"]["status"] == "not_available"
    assert res.headers["cache-control"] == "no-store"
    assert res.headers["x-request-id"] == result["request_id"]
