import json
from pathlib import Path

import httpx
import pytest

from app import main
from app.config import Settings
from app.documents import prepare_document
from app.gemma import analyze_with_gemma
from tests.notice_fixtures import notice, CASES

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.mark.parametrize("kind,profile,expected", [
    ("A", {"percentage": 65}, "may_not_meet"), ("A", {}, "needs_review"),
    ("B", {"annual_income": 180000}, "likely_meets"), ("B", {"annual_income": 300000}, "may_not_meet"),
    ("C", {"education_level": "Undergraduate"}, "may_not_meet"),
    ("D", {"percentage": 65}, "may_not_meet"), ("E", {"percentage": 65}, "needs_review"),
])
def test_pdf_to_real_request_parsing_verification_comparison_and_serialization(client, monkeypatch, kind, profile, expected):
    calls = []
    def provider(request):
        calls.append(json.loads(request.content))
        # Reproduce the formerly silent wrapped-response failure through the actual pipeline.
        return httpx.Response(200, json={"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": json.dumps({"analysis": notice(kind)}, ensure_ascii=False)}]}}]})
    async def analyze(pages, student, settings):
        return await analyze_with_gemma(pages, student, Settings(gemini_api_key="test"), httpx.MockTransport(provider))
    monkeypatch.setattr(main, "analyze_with_gemma", analyze)
    pdf = (FIXTURES / f"notice_{kind}.pdf").read_bytes()
    result = client.post("/api/analyze", files={"file": (f"notice_{kind}.pdf", pdf, "application/pdf")}, data={"profile": json.dumps(profile)})
    assert result.status_code == 200, result.text
    body = result.json()
    assert body["title"] == CASES[kind][0] and body["summary_en"] == notice(kind)["summary_en"]
    assert body["summary_kn"] == notice(kind)["summary_kn"]
    assert body["criteria"][0]["status"] == expected
    assert body["criteria"][0]["page"] == CASES[kind][2]
    assert body["criteria"][0]["verification"]["status"] == ("not_available" if kind == "E" else "verified")
    assert body["documents"][0]["evidence"] == notice(kind)["documents"][0]["evidence"]
    assert body["session_id"] and len(calls) == 1
    parts = calls[0]["contents"][0]["parts"]
    assert len([p for p in parts if "inline_data" in p]) == body["pages_analyzed"]
    if kind == "D": assert "ಅರ್ಜಿದಾರರು" in json.dumps(parts, ensure_ascii=False)


def test_scanned_fixture_has_no_text_layer():
    pages = prepare_document((FIXTURES / "notice_E.pdf").read_bytes(), "scan.pdf")
    assert len(pages) == 1 and pages[0].text == "" and pages[0].data


def test_empty_provider_result_returns_error_instead_of_generic_success(client, monkeypatch):
    calls = []
    def provider(request):
        calls.append(request)
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": "{}"}]}}]})
    async def analyze(pages, student, settings):
        return await analyze_with_gemma(pages, student, Settings(gemini_api_key="test"), httpx.MockTransport(provider))
    monkeypatch.setattr(main, "analyze_with_gemma", analyze)
    res = client.post("/api/analyze", files={"file": ("notice.pdf", (FIXTURES / "notice_A.pdf").read_bytes(), "application/pdf")})
    assert res.status_code == 502 and len(calls) == 2
    assert "Unidentified scholarship" not in res.text
