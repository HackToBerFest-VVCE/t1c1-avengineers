import json

import pytest

from app import main
from app.schemas import ExtractedAnalysis


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["model"] == "gemma-4-26b-a4b-it"


def test_invalid_image_returns_415(client):
    response = client.post("/api/analyze", files={"file": ("no.png", b"fake content", "image/png")})
    assert response.status_code == 415


def test_too_large_returns_413(client, monkeypatch):
    monkeypatch.setattr(main.settings, "max_upload_mb", 1)
    response = client.post("/api/analyze", files={"file": ("photo.png", b"a" * (1024 * 1024 + 2), "image/png")})
    assert response.status_code == 413


def test_bad_profile_returns_422(client, png_bytes):
    response = client.post("/api/analyze", files={"file": ("upload.png", png_bytes, "image/png")}, data={"profile": json.dumps({"percentage": 101})})
    assert response.status_code == 422


def test_analyze_contract(client, png_bytes, monkeypatch):
    async def fake_analyze(pages, profile, settings):
        assert len(pages) == 1
        assert profile.state == "Karnataka"
        return ExtractedAnalysis(title="Demo Only", summary_en="Works", summary_kn="ಕೆಲಸ ಮಾಡುತ್ತದೆ")

    monkeypatch.setattr(main, "analyze_with_gemma", fake_analyze)
    response = client.post(
        "/api/analyze",
        files={"file": ("notice.png", png_bytes, "image/png")},
        data={"profile": json.dumps({"state": "Karnataka"})},
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["title"] == "Demo Only"
    assert body["filename"] == "notice.png"
    assert body["pages_analyzed"] == 1
    assert body["model_used"] == "gemma-4-26b-a4b-it"
    assert body["request_id"]
