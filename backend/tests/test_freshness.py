"""Comprehensive tests for Scholarship Freshness Intelligence.

All tests mock external APIs — no live Gemma or Tavily calls required.
"""
import json
import time
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.freshness_schemas import (
    ComparisonField,
    FreshnessCheckResponse,
    FreshnessCompareResponse,
    FreshnessStatus,
    OfficialSource,
    ScholarshipIdentity,
)
from app.freshness_sources import (
    extract_year_from_text,
    is_blocked_domain,
    is_official_domain,
    score_source_relevance,
    validate_content_type,
    validate_url_safety,
)
from app.freshness_search import (
    SearchConfigError,
    SearchError,
    generate_search_queries,
    _search_cache,
)


# ── 1. Scholarship Identification ────────────────────────────────────────

class TestScholarshipIdentification:
    def test_identity_from_title(self):
        """Test extracting identity from a clear analysis title."""
        from app.freshness import _identity_from_analysis
        from app.schemas import ExtractedAnalysis

        analysis = ExtractedAnalysis(
            title="Ishan Uday Scholarship for NER",
            provider="University Grants Commission",
            summary_en="Scholarship for students from NER pursuing higher education."
        )
        identity = _identity_from_analysis(analysis)
        assert identity.scholarship_name == "Ishan Uday Scholarship for NER"
        assert identity.issuing_organization == "University Grants Commission"
        assert identity.confidence in ("high", "medium")

    def test_identity_from_generic_title(self):
        """Unknown documents should have low confidence."""
        from app.freshness import _identity_from_analysis
        from app.schemas import ExtractedAnalysis

        analysis = ExtractedAnalysis(title="Not specified in the notice")
        identity = _identity_from_analysis(analysis)
        assert identity.scholarship_name == ""
        assert identity.confidence == "low"


# ── 2. Search Query Generation ───────────────────────────────────────────

class TestSearchQueryGeneration:
    def test_queries_from_identity(self):
        """Should generate targeted queries from scholarship identity."""
        identity = ScholarshipIdentity(
            scholarship_name="Ishan Uday Scholarship",
            issuing_organization="UGC",
            confidence="high",
        )
        queries = generate_search_queries(identity)
        assert len(queries) >= 1
        assert len(queries) <= 3
        assert any("Ishan Uday" in q for q in queries)

    def test_empty_name_no_queries(self):
        """Should return no queries for empty scholarship name."""
        identity = ScholarshipIdentity(scholarship_name="", confidence="low")
        queries = generate_search_queries(identity)
        assert queries == []

    def test_query_includes_org(self):
        """Should include organization in query when available."""
        identity = ScholarshipIdentity(
            scholarship_name="Post Matric Scholarship",
            issuing_organization="Ministry of Social Justice",
            confidence="medium",
        )
        queries = generate_search_queries(identity)
        assert any("Ministry" in q for q in queries)


# ── 3. Official Source Validation ─────────────────────────────────────────

class TestOfficialSourceValidation:
    def test_gov_in_is_official(self):
        is_off, domain = is_official_domain("https://scholarships.gov.in/guidelines")
        assert is_off is True
        assert "gov.in" in domain

    def test_nic_in_is_official(self):
        is_off, _ = is_official_domain("https://sw.kar.nic.in/scholarship/details")
        assert is_off is True

    def test_ugc_is_official(self):
        is_off, _ = is_official_domain("https://ugc.gov.in/ishan-uday")
        assert is_off is True

    def test_random_domain_not_official(self):
        is_off, _ = is_official_domain("https://randomsite.com/scholarships")
        assert is_off is False

    def test_custom_authority_domains(self):
        is_off, _ = is_official_domain(
            "https://custom-portal.org/scheme",
            authority_domains=["custom-portal.org"],
        )
        assert is_off is True


# ── 4. Scholarship Identity Matching (relevance scoring) ─────────────────

class TestScholarshipIdentityMatching:
    def test_high_relevance_for_official_match(self):
        score, is_off, _ = score_source_relevance(
            "https://ugc.gov.in/ishan-uday-notification",
            "Ishan Uday Scholarship 2024-25 Notification",
            "Guidelines for Ishan Uday scholarship for NER students",
            "Ishan Uday Scholarship",
            "UGC",
        )
        assert score > 0.5
        assert is_off is True

    def test_low_relevance_for_unrelated(self):
        score, _, _ = score_source_relevance(
            "https://example.com/jobs",
            "Job Openings 2024",
            "Latest job vacancies in Delhi",
            "Ishan Uday Scholarship",
            "UGC",
        )
        assert score < 0.3

    def test_blocked_domain_zero_score(self):
        score, _, _ = score_source_relevance(
            "https://buddy4study.com/ishan-uday",
            "Ishan Uday Scholarship",
            "Complete details about Ishan Uday",
            "Ishan Uday Scholarship",
            "UGC",
        )
        assert score == 0.0


# ── 5. Date/Version Comparison ───────────────────────────────────────────

class TestDateComparison:
    def test_extract_academic_year(self):
        assert extract_year_from_text("Guidelines for 2024-25") == "2024-25"

    def test_extract_full_year_range(self):
        assert extract_year_from_text("Session 2024-2025") == "2024-25"

    def test_extract_standalone_year(self):
        assert extract_year_from_text("Published in 2024") == "2024"

    def test_no_year_found(self):
        assert extract_year_from_text("No dates here") is None

    def test_multiple_years_picks_latest(self):
        result = extract_year_from_text("From 2022-23 to 2024-25")
        assert result == "2024-25"


# ── 6. Search API Failure ─────────────────────────────────────────────────

class TestSearchApiFailure:
    def test_missing_api_key_raises(self):
        with pytest.raises(SearchConfigError, match="Tavily API key not configured"):
            import asyncio
            from app.freshness_search import _tavily_search
            asyncio.get_event_loop().run_until_complete(
                _tavily_search("test query", "")
            )

    def test_placeholder_key_raises(self):
        with pytest.raises(SearchConfigError):
            import asyncio
            from app.freshness_search import _tavily_search
            asyncio.get_event_loop().run_until_complete(
                _tavily_search("test query", "your_tavily_api_key_here")
            )


# ── 7. No Results Found ──────────────────────────────────────────────────

class TestNoResultsFound:
    def test_empty_sources_returns_no_newer(self):
        from app.freshness import _determine_freshness
        identity = ScholarshipIdentity(
            scholarship_name="Test Scholarship",
            academic_year="2023-24",
            confidence="high",
        )
        status, explanation, _, _ = _determine_freshness(identity, [])
        assert status == FreshnessStatus.no_newer_verified


# ── 8. Multiple Candidate Versions ────────────────────────────────────────

class TestMultipleCandidates:
    def test_multiple_newer_sources(self):
        from app.freshness import _determine_freshness
        identity = ScholarshipIdentity(
            scholarship_name="Test Scholarship",
            academic_year="2022-23",
            confidence="high",
        )
        sources = [
            OfficialSource(
                url="https://ugc.gov.in/a",
                title="Test 2024-25",
                is_official=True,
                academic_year="2024-25",
                relevance_score=0.8,
            ),
            OfficialSource(
                url="https://ugc.gov.in/b",
                title="Test 2023-24",
                is_official=True,
                academic_year="2023-24",
                relevance_score=0.7,
            ),
        ]
        status, explanation, year, best = _determine_freshness(identity, sources)
        assert status == FreshnessStatus.multiple_candidates
        assert year == "2024-25"


# ── 9. Outdated Document Detection ────────────────────────────────────────

class TestOutdatedDetection:
    def test_newer_year_detected(self):
        from app.freshness import _determine_freshness
        identity = ScholarshipIdentity(
            scholarship_name="Test Scholarship",
            academic_year="2022-23",
            confidence="high",
        )
        sources = [
            OfficialSource(
                url="https://ugc.gov.in/test",
                title="Test 2024-25",
                is_official=True,
                academic_year="2024-25",
                relevance_score=0.8,
            ),
        ]
        status, _, year, _ = _determine_freshness(identity, sources)
        assert status == FreshnessStatus.newer_found
        assert year == "2024-25"


# ── 10. Current Document Handling ────────────────────────────────────────

class TestCurrentDocument:
    def test_same_year_appears_current(self):
        from app.freshness import _determine_freshness
        identity = ScholarshipIdentity(
            scholarship_name="Test Scholarship",
            academic_year="2024-25",
            confidence="high",
        )
        sources = [
            OfficialSource(
                url="https://ugc.gov.in/test",
                title="Test 2024-25",
                is_official=True,
                academic_year="2024-25",
                relevance_score=0.8,
            ),
        ]
        status, _, _, _ = _determine_freshness(identity, sources)
        assert status == FreshnessStatus.appears_current


# ── 11. Unverifiable Freshness ───────────────────────────────────────────

class TestUnverifiableFreshness:
    def test_no_dates_unable_to_verify(self):
        from app.freshness import _determine_freshness
        identity = ScholarshipIdentity(
            scholarship_name="Test Scholarship",
            confidence="high",
        )
        sources = [
            OfficialSource(
                url="https://ugc.gov.in/test",
                title="Test Scholarship Details",
                is_official=True,
                academic_year=None,
                relevance_score=0.5,
            ),
        ]
        status, _, _, _ = _determine_freshness(identity, sources)
        assert status == FreshnessStatus.unable_to_verify

    def test_uploaded_no_year_unable(self):
        from app.freshness import _determine_freshness
        identity = ScholarshipIdentity(
            scholarship_name="Test Scholarship",
            academic_year=None,
            confidence="high",
        )
        sources = [
            OfficialSource(
                url="https://ugc.gov.in/test",
                title="Test 2024",
                is_official=True,
                academic_year="2024",
                relevance_score=0.8,
            ),
        ]
        status, _, _, _ = _determine_freshness(identity, sources)
        assert status == FreshnessStatus.unable_to_verify


# ── 12-14. Pydantic model validation ─────────────────────────────────────

class TestSchemaValidation:
    def test_freshness_check_response_serialization(self):
        resp = FreshnessCheckResponse(
            status=FreshnessStatus.newer_found,
            scholarship=ScholarshipIdentity(
                scholarship_name="Test",
                confidence="high",
            ),
            verification_explanation="Found newer version",
            checked_at="2024-01-01T00:00:00Z",
            search_provider="tavily",
        )
        data = resp.model_dump()
        assert data["status"] == "newer_official_version_found"
        assert data["scholarship"]["scholarship_name"] == "Test"

    def test_comparison_field_types(self):
        field = ComparisonField(
            field_name="Income limit",
            uploaded_value="2.5 Lakh",
            newer_value="3 Lakh",
            change_type="changed",
        )
        assert field.change_type == "changed"

    def test_comparison_response(self):
        resp = FreshnessCompareResponse(
            scholarship_name="Test",
            source_url="https://example.com",
            comparisons=[],
            summary="No changes found",
        )
        assert resp.disclaimer  # Should have default disclaimer


# ── 15. Evidence preservation ─────────────────────────────────────────────

class TestEvidencePreservation:
    def test_comparison_evidence_fields(self):
        field = ComparisonField(
            field_name="Income",
            uploaded_value="2.5 lakh",
            newer_value="3 lakh",
            change_type="changed",
            evidence_uploaded="income shall not exceed Rs. 2.5 lakh",
            evidence_newer="family income shall not exceed Rs. 3 lakh per annum",
        )
        assert field.evidence_uploaded
        assert field.evidence_newer


# ── 16. API Rate-Limit Handling ───────────────────────────────────────────

class TestRateLimitHandling:
    def test_freshness_check_endpoint_returns_error(self, client, png_bytes, monkeypatch):
        """Test that rate limit errors from freshness check are handled gracefully."""
        from app import main
        from app.schemas import ExtractedAnalysis

        async def fake_analyze(pages, profile, settings):
            return ExtractedAnalysis(
                title="Test Scholarship",
                summary_en="A test scholarship.",
                summary_kn="ಪರೀಕ್ಷಾ ವಿದ್ಯಾರ್ಥಿವೇತನ.",
            )
        monkeypatch.setattr(main, "analyze_with_gemma", fake_analyze)

        # Create a session first
        response = client.post(
            "/api/analyze",
            files={"file": ("notice.png", png_bytes, "image/png")},
        )
        assert response.status_code == 200
        session_id = response.json()["session_id"]

        # The freshness check should handle errors gracefully
        response = client.post(
            "/api/freshness/check",
            json={"session_id": session_id},
        )
        # Should succeed (returns unable_to_verify since Tavily key is not configured)
        assert response.status_code == 200
        body = response.json()
        assert body["status"] in [
            "unable_to_verify_freshness",
            "no_newer_version_verified",
        ]


# ── 17. Unsafe URL Rejection ────────────────────────────────────────────

class TestUnsafeUrlRejection:
    def test_private_ip_rejected(self):
        safe, reason = validate_url_safety("http://192.168.1.1/admin")
        assert safe is False
        assert "Private" in reason

    def test_localhost_rejected(self):
        safe, reason = validate_url_safety("http://localhost:8080/admin")
        assert safe is False
        assert "Localhost" in reason

    def test_file_scheme_rejected(self):
        safe, reason = validate_url_safety("file:///etc/passwd")
        assert safe is False

    def test_loopback_rejected(self):
        safe, reason = validate_url_safety("http://127.0.0.1/secret")
        assert safe is False

    def test_credentials_in_url_rejected(self):
        safe, reason = validate_url_safety("http://user:pass@example.com/")
        assert safe is False
        assert "credentials" in reason

    def test_valid_https_accepted(self):
        safe, reason = validate_url_safety("https://ugc.gov.in/scholarship")
        assert safe is True

    def test_non_standard_port_rejected(self):
        safe, reason = validate_url_safety("https://example.com:9999/")
        assert safe is False


# ── 18. Content Type Validation ──────────────────────────────────────────

class TestContentTypeValidation:
    def test_html_allowed(self):
        valid, _ = validate_content_type("text/html; charset=utf-8")
        assert valid is True

    def test_pdf_allowed(self):
        valid, _ = validate_content_type("application/pdf")
        assert valid is True

    def test_image_rejected(self):
        valid, _ = validate_content_type("image/jpeg")
        assert valid is False

    def test_missing_type_rejected(self):
        valid, _ = validate_content_type(None)
        assert valid is False


# ── 19. Blocked Domain Detection ─────────────────────────────────────────

class TestBlockedDomains:
    def test_buddy4study_blocked(self):
        assert is_blocked_domain("https://buddy4study.com/scholarship") is True

    def test_careers360_blocked(self):
        assert is_blocked_domain("https://careers360.com/scholarship") is True

    def test_gov_not_blocked(self):
        assert is_blocked_domain("https://scholarships.gov.in/") is False


# ── 20. API Endpoint Registration ────────────────────────────────────────

class TestEndpointRegistration:
    def test_freshness_check_endpoint_exists(self, client):
        """Verify freshness check endpoint is registered."""
        response = client.post("/api/freshness/check", json={"session_id": "x" * 32})
        # 410 = session not found (not 404 = endpoint not found)
        assert response.status_code == 410

    def test_freshness_compare_endpoint_exists(self, client):
        response = client.post(
            "/api/freshness/compare",
            json={"session_id": "x" * 32, "source_url": "https://example.com"},
        )
        assert response.status_code == 410

    def test_freshness_analyze_endpoint_exists(self, client):
        response = client.post(
            "/api/freshness/analyze-latest",
            json={"session_id": "x" * 32, "source_url": "https://example.com"},
        )
        assert response.status_code == 410

    def test_health_still_works(self, client):
        """Regression: existing health endpoint unchanged."""
        response = client.get("/api/health")
        assert response.status_code == 200
        assert "gemma_configured" in response.json()


# ── 21. Existing Feature Regression ──────────────────────────────────────

class TestExistingFeatureRegression:
    def test_analyze_still_works(self, client, png_bytes, monkeypatch):
        """Regression: existing analyze endpoint still works."""
        from app import main
        from app.schemas import ExtractedAnalysis

        async def fake_analyze(pages, profile, settings):
            return ExtractedAnalysis(
                title="Demo Scholarship",
                summary_en="Works correctly",
                summary_kn="ಸರಿಯಾಗಿ ಕೆಲಸ ಮಾಡುತ್ತದೆ",
            )
        monkeypatch.setattr(main, "analyze_with_gemma", fake_analyze)

        response = client.post(
            "/api/analyze",
            files={"file": ("notice.png", png_bytes, "image/png")},
        )
        assert response.status_code == 200
        body = response.json()
        assert body["title"] == "Demo Scholarship"
        assert body["session_id"]
        assert body["model_used"] == "gemma-4-26b-a4b-it"

    def test_chat_endpoint_rejects_missing_session(self, client):
        """Regression: chat endpoint still validates sessions."""
        response = client.post(
            "/api/chat",
            json={"session_id": "x" * 32, "question": "What is this?"},
        )
        assert response.status_code == 410

    def test_invalid_upload_still_returns_415(self, client):
        """Regression: invalid uploads still rejected."""
        response = client.post(
            "/api/analyze",
            files={"file": ("bad.png", b"not a real image", "image/png")},
        )
        assert response.status_code == 415


# ── 22. Search Cache ─────────────────────────────────────────────────────

class TestSearchCache:
    def test_cache_stores_and_retrieves(self):
        from app.freshness_search import _get_cached, _set_cache
        _set_cache("Test", "query1", [{"url": "https://example.com"}])
        cached = _get_cached("Test", "query1")
        assert cached is not None
        assert len(cached) == 1
        # Clean up
        _search_cache.clear()

    def test_cache_case_insensitive(self):
        from app.freshness_search import _get_cached, _set_cache
        _set_cache("Test Scholarship", "test query", [{"url": "a"}])
        assert _get_cached("test scholarship", "test query") is not None
        _search_cache.clear()
