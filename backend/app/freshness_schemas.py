"""Pydantic models for the Scholarship Freshness Intelligence feature."""
from datetime import datetime
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class FreshnessStatus(str, Enum):
    newer_found = "newer_official_version_found"
    appears_current = "uploaded_document_appears_current"
    no_newer_verified = "no_newer_version_verified"
    unable_to_verify = "unable_to_verify_freshness"
    multiple_candidates = "multiple_candidate_versions_found"


class ScholarshipIdentity(BaseModel):
    """Structured scholarship identification extracted by Gemma 4."""
    scholarship_name: str = ""
    issuing_organization: str | None = None
    government_department: str | None = None
    notification_date: str | None = None
    academic_year: str | None = None
    scheme_id: str | None = None
    keywords: list[str] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"] = "low"


class OfficialSource(BaseModel):
    """A candidate official source discovered through web search."""
    url: str
    title: str = ""
    snippet: str = ""
    domain: str = ""
    is_official: bool = False
    authority_match: str | None = None
    publication_date: str | None = None
    academic_year: str | None = None
    relevance_score: float = 0.0
    retrieval_status: Literal[
        "available", "failed", "too_large", "unsafe", "blocked"
    ] = "available"
    content_preview: str = ""


class FreshnessCheckRequest(BaseModel):
    session_id: str = Field(min_length=32, max_length=128)


class FreshnessCheckResponse(BaseModel):
    status: FreshnessStatus
    scholarship: ScholarshipIdentity
    sources: list[OfficialSource] = Field(default_factory=list)
    uploaded_year: str | None = None
    candidate_latest_year: str | None = None
    issuing_authority: str | None = None
    official_source_url: str | None = None
    verification_explanation: str = ""
    checked_at: str = ""
    search_provider: str = ""
    search_query_used: str = ""
    error: str | None = None


class ComparisonField(BaseModel):
    """A single field comparison between old and new scholarship versions."""
    field_name: str
    uploaded_value: str = ""
    newer_value: str = ""
    change_type: Literal["changed", "added", "removed", "unchanged", "uncertain"] = "uncertain"
    evidence_uploaded: str = ""
    evidence_newer: str = ""


class FreshnessCompareRequest(BaseModel):
    session_id: str = Field(min_length=32, max_length=128)
    source_url: str = Field(min_length=1, max_length=2000)


class FreshnessCompareResponse(BaseModel):
    scholarship_name: str
    uploaded_year: str | None = None
    newer_year: str | None = None
    source_url: str
    source_title: str = ""
    comparisons: list[ComparisonField] = Field(default_factory=list)
    summary: str = ""
    disclaimer: str = (
        "AI-generated comparison. Verify all changes against the official "
        "document before relying on this information."
    )


class FreshnessAnalyzeRequest(BaseModel):
    session_id: str = Field(min_length=32, max_length=128)
    source_url: str = Field(min_length=1, max_length=2000)


class FreshnessAnalyzeResponse(BaseModel):
    """Response mirrors AnalysisResponse but indicates which source was used."""
    source_url: str
    source_title: str = ""
    source_document_version: str = ""
    analysis_source: Literal["updated_official_document"] = "updated_official_document"
    # The actual analysis fields are merged into this at response time
