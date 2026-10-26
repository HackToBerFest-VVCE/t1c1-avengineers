import base64
import json

import httpx
import pytest

from app.config import Settings
from app.documents import PageImage
from app.gemma import GemmaError, analyze_with_gemma, parse_gemma_output
from app.schemas import StudentProfile


MODEL_OUTPUT = {
    "title": "Demo Scholarship",
    "provider": "Demo Trust",
    "summary_en": "Example summary.",
    "summary_kn": "ಉದಾಹರಣೆ ಸಾರಾಂಶ.",
    "deadline": {"date_text": "15 December 2026", "iso_date": "2026-12-15", "evidence": "15 December 2026", "page": 1},
    "criteria": [{
        "requirement": "Minimum marks 70%", "evidence": "70%", "page": 1,
        "status": "likely_meets", "requirement_kn": "ಕನಿಷ್ಠ ಅಂಕಗಳು 70%", "explanation_en": "Student reported 85%",
        "explanation_kn": "ವಿದ್ಯಾರ್ಥಿ 85% ಅಂಕಗಳನ್ನು ತಿಳಿಸಿದ್ದಾರೆ"
    }],
    "documents": [{"name": "Marksheet", "name_kn": "ಅಂಕಪಟ್ಟಿ", "evidence": "Marksheet", "page": 1}],
    "steps": [{"title": "Prepare", "title_kn": "ಸಿದ್ಧಪಡಿಸಿ", "detail_en": "Check documents", "detail_kn": "ದಾಖಲೆಗಳನ್ನು ಪರಿಶೀಲಿಸಿ"}],
    "unknowns": [], "warnings": [], "confidence": "high",
}


def test_parse_fenced_json():
    result = parse_gemma_output("```json\n" + json.dumps(MODEL_OUTPUT) + "\n```", 1)
    assert result.title == "Demo Scholarship"
    assert result.deadline.iso_date == "2026-12-15"


def test_out_of_range_page_removed_but_quote_retained_for_manual_review():
    payload = {**MODEL_OUTPUT, "deadline": {**MODEL_OUTPUT["deadline"], "page": 7}}
    result = parse_gemma_output(json.dumps(payload), 1)
    assert result.deadline.page is None
    assert result.deadline.evidence == "15 December 2026"
    assert result.warnings


def test_invalid_model_json():
    with pytest.raises(GemmaError, match="structured"):
        parse_gemma_output("This is prose, not JSON", 1)


@pytest.mark.asyncio
async def test_real_gemma_rest_payload_is_constructed_correctly():
    seen = {}

    def handler(req: httpx.Request):
        seen["url"] = str(req.url)
        seen["headers"] = dict(req.headers)
        seen["body"] = json.loads(req.content)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json.dumps(MODEL_OUTPUT)}]}}]})

    image = b"\x89PNG-test-image-bytes"
    result = await analyze_with_gemma(
        [PageImage(image, "image/png", 1)],
        StudentProfile(percentage=85),
        Settings(gemini_api_key="test-only", gemma_model="gemma-4-26b-a4b-it"),
        transport=httpx.MockTransport(handler),
    )
    assert result.title == "Demo Scholarship"
    assert "gemma-4-26b-a4b-it:generateContent" in seen["url"]
    assert seen["headers"]["x-goog-api-key"] == "test-only"
    parts = seen["body"]["contents"][0]["parts"]
    assert base64.b64decode(next(part["inline_data"]["data"] for part in parts if "inline_data" in part)) == image
    assert "Gemma" in seen["body"]["systemInstruction"]["parts"][0]["text"] or "document" in seen["body"]["systemInstruction"]["parts"][0]["text"]


@pytest.mark.asyncio
async def test_missing_key_blocks_real_call():
    with pytest.raises(GemmaError, match="not configured"):
        await analyze_with_gemma([PageImage(b"anything", "image/png", 1)], StudentProfile(), Settings(gemini_api_key=""))


@pytest.mark.asyncio
async def test_rate_limit_translates_to_user_safe_error():
    transport = httpx.MockTransport(lambda _req: httpx.Response(429, json={"error": "secret diagnostic"}))
    with pytest.raises(GemmaError, match="rate limit") as info:
        await analyze_with_gemma(
            [PageImage(b"any", "image/png", 1)], StudentProfile(),
            Settings(gemini_api_key="key"), transport=transport,
        )
    assert info.value.status == 429
    assert "secret diagnostic" not in str(info.value)
