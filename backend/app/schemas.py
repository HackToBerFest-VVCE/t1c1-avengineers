from enum import Enum
from pydantic import BaseModel, Field, field_validator


class CriterionStatus(str, Enum):
    likely_meets = "likely_meets"
    needs_review = "needs_review"
    may_not_meet = "may_not_meet"


class Confidence(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class StudentProfile(BaseModel):
    education_level: str = Field(default="Not specified", max_length=120)
    state: str = Field(default="Not specified", max_length=120)
    category: str = Field(default="Not specified", max_length=120)
    annual_income: float | None = Field(default=None, ge=0, le=1_000_000_000)
    percentage: float | None = Field(default=None, ge=0, le=100)


class Deadline(BaseModel):
    date_text: str | None = None
    iso_date: str | None = None
    evidence: str | None = None
    page: int | None = Field(default=None, ge=1)

    @field_validator("iso_date")
    @classmethod
    def validate_iso(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        from datetime import date
        try:
            date.fromisoformat(value)
            return value
        except ValueError:
            return None


class Criterion(BaseModel):
    requirement: str
    evidence: str | None = None
    page: int | None = Field(default=None, ge=1)
    status: CriterionStatus = CriterionStatus.needs_review
    explanation_en: str = "Requires manual verification."
    explanation_kn: str = "ದಯವಿಟ್ಟು ಅರ್ಹತೆಯನ್ನು ಪರಿಶೀಲಿಸಿ."


class RequiredDocument(BaseModel):
    name: str
    evidence: str | None = None
    page: int | None = Field(default=None, ge=1)


class ActionStep(BaseModel):
    title: str
    detail_en: str
    detail_kn: str


class ExtractedAnalysis(BaseModel):
    title: str = "Unidentified scholarship or notice"
    provider: str | None = None
    summary_en: str = "The notice needs manual review."
    summary_kn: str = "ಈ ಪ್ರಕಟಣೆಯನ್ನು ಪರಿಶೀಲಿಸಬೇಕಾಗಿದೆ."
    deadline: Deadline = Field(default_factory=Deadline)
    criteria: list[Criterion] = Field(default_factory=list)
    documents: list[RequiredDocument] = Field(default_factory=list)
    steps: list[ActionStep] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    confidence: Confidence = Confidence.low


class AnalysisResponse(ExtractedAnalysis):
    model_used: str
    pages_analyzed: int
    processing_seconds: float
    request_id: str
    filename: str
    disclaimer: str = (
        "AI-assisted guidance only. Verify eligibility, documents, and dates "
        "against the original notice and official scholarship website."
    )


class HealthResponse(BaseModel):
    status: str
    gemma_configured: bool
    model: str
