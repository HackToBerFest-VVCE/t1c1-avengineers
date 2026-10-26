from enum import Enum
from typing import Literal
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from .numbers import parse_number


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
    age: int | None = Field(default=None, ge=0, le=120)
    study_mode: str = Field(default="Not specified", max_length=120)
    model_config = {"allow_inf_nan": False}

    @field_validator("annual_income", "percentage", "age", mode="before")
    @classmethod
    def numeric_input(cls, value, info):
        return parse_number(value, info.field_name)


class Verification(BaseModel):
    status: Literal["verified", "partial_match", "unverified", "not_available"] = "not_available"
    reason: str = "No reliable document text is available."
    matched_text: str | None = None


class SourceFact(BaseModel):
    evidence: str | None = Field(default=None, max_length=2000)
    page: int | None = Field(default=None, ge=1, strict=True)
    verification: Verification | None = None


class Deadline(SourceFact):
    date_text: str | None = None
    iso_date: str | None = None

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


class EligibilityRule(BaseModel):
    # Only structured rules explicitly supported by the source should be supplied.
    field: str
    operator: str
    value_number: float | None = None
    values: list[str] = Field(default_factory=list)
    model_config = {"allow_inf_nan": False}

    @field_validator("value_number", mode="before")
    @classmethod
    def numeric_threshold(cls, value, info):
        return parse_number(value, info.data.get("field", ""))


class Criterion(SourceFact):
    requirement: str
    rule: EligibilityRule | None = None
    status: CriterionStatus = CriterionStatus.needs_review
    explanation_en: str = "Requires manual verification."
    explanation_kn: str = "ದಯವಿಟ್ಟು ಅರ್ಹತೆಯನ್ನು ಪರಿಶೀಲಿಸಿ."
    requirement_kn: str | None = None
    student_value: str | float | None = None
    requires_manual_review: bool = False

    @model_validator(mode="before")
    @classmethod
    def preserve_text_when_rule_invalid(cls, value):
        if not isinstance(value, dict): return value
        value = dict(value)
        if value.get("rule") is not None:
            try:
                value["rule"] = EligibilityRule.model_validate(value["rule"])
            except (ValidationError, TypeError, ValueError):
                value["rule"] = None
                value["requires_manual_review"] = True
        return value


class RequiredDocument(SourceFact):
    name: str
    name_kn: str | None = None


class ActionStep(SourceFact):
    title: str
    detail_en: str
    detail_kn: str
    title_kn: str | None = None
    priority: Literal["critical", "important", "optional"] = "important"


class RoadmapTask(ActionStep):
    id: str
    completed: bool = False


class ExtractedAnalysis(BaseModel):
    title: str = "Not specified in the notice"
    provider: str | None = None
    summary_en: str = ""
    summary_kn: str = ""
    summary_sources: list[SourceFact] = Field(default_factory=list)
    deadline: Deadline = Field(default_factory=Deadline)
    criteria: list[Criterion] = Field(default_factory=list)
    eligibility_overall: str = "needs_verification"
    documents: list[RequiredDocument] = Field(default_factory=list)
    steps: list[ActionStep] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    unknowns_kn: list[str] = Field(default_factory=list)
    warnings_kn: list[str] = Field(default_factory=list)
    confidence: Confidence = Confidence.low


class AnalysisResponse(ExtractedAnalysis):
    session_id: str
    session_expires_in: int
    roadmap: list[RoadmapTask] = Field(default_factory=list)
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


class ChatRequest(BaseModel):
    session_id: str = Field(min_length=32, max_length=128)
    question: str = Field(min_length=1, max_length=2000)
    language: str = Field(default="en", pattern="^(en|kn)$")

    @field_validator("question")
    @classmethod
    def nonblank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Question must not be blank")
        return value.strip()


class ChatAnswer(BaseModel):
    answer: str = Field(min_length=1, max_length=10000)
    suggestions: list[str] = Field(default_factory=list, max_length=12)
    missing_information: list[str] = Field(default_factory=list, max_length=12)
    citations: list[SourceFact] = Field(default_factory=list, max_length=12)
    disclaimer: str = "Preliminary AI guidance only. Confirm with the scholarship provider."


class SessionRequest(BaseModel):
    session_id: str = Field(min_length=32, max_length=128)
