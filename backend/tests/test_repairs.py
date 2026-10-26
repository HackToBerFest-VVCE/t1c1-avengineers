import asyncio
import copy
import json

import httpx
import pytest

from app import main
from app.config import Settings
from app.documents import PageImage
from app.evidence import verify_analysis, verify_source
from app.eligibility import assess_all
from app.gemma import GemmaError, GemmaOutputError, analyze_with_gemma, generate_text, parse_gemma_output
from app.localization import repair_languages
from app.numbers import parse_number
from app.schemas import Criterion, ExtractedAnalysis, StudentProfile
from tests.test_gemma import MODEL_OUTPUT


def response(payload, finish="STOP"):
    return httpx.Response(200, json={"candidates": [{"finishReason": finish, "content": {"parts": [{"text": json.dumps(payload, ensure_ascii=False)}]}}]})


@pytest.mark.parametrize("payload", [{}, {"unrelated": "anything"}, {"title": "Notice"}, {"summary_en": "The notice needs manual review."}, {"analysis": {}}])
def test_empty_or_default_model_result_is_not_success(payload):
    with pytest.raises(GemmaOutputError): parse_gemma_output(json.dumps(payload), 5)


def test_wrapped_results_preserve_supported_facts():
    result = parse_gemma_output(json.dumps({"analysis": MODEL_OUTPUT}), 1)
    assert result.title == "Demo Scholarship" and result.criteria[0].page == 1
    assert result.summary_en == MODEL_OUTPUT["summary_en"]


@pytest.mark.parametrize("text", ['{"title":"Scholarship","criteria":[{"requirement":"Income"}', '{"analysis": {"title":"Scholarship"}', 'No JSON', '[]'])
def test_no_salvage_of_inner_objects_in_truncated_json(text):
    with pytest.raises(GemmaOutputError): parse_gemma_output(text, 1)


def test_optional_fields_and_bad_rules_do_not_remove_textual_conditions():
    payload = {"summary_en": "A grant supports students with academic and income restrictions.", "criteria": [
        {"requirement": "Recognized institution required", "rule": None},
        {"requirement": "Income depends on category", "rule": {"field": "annual_income", "operator": "lte", "value_number": "2 to 3 lakh"}},
        "An interview is required",
    ], "deadline": None, "documents": None}
    result = parse_gemma_output(json.dumps(payload), 1)
    assert len(result.criteria) == 3 and all(item.rule is None for item in result.criteria)
    assert result.criteria[1].requires_manual_review
    assert result.documents == []


def test_compatible_aliases_and_citation_structure():
    payload = {"scholarship_title": "Supported Award", "summary": {"en": "This is the document's supported grant summary.", "kn": "ದಾಖಲೆಯ ವಿದ್ಯಾರ್ಥಿವೇತನದ ಸಾರಾಂಶ."},
               "eligibility_requirements": [{"condition": "Minimum 75 percent", "source": {"quote": "Minimum 75 percent", "page_number": "2"},
                                              "rule": {"field": "percentage", "operator": "gte", "value_number": "75 percent"}}]}
    result = parse_gemma_output(json.dumps(payload), 2)
    assert result.title == "Supported Award"
    assert result.criteria[0].page == 2 and result.criteria[0].rule.value_number == 75


@pytest.mark.parametrize("field,value,expected", [("annual_income", "₹2,50,000", 250000), ("annual_income", "Rs. 250000", 250000),
    ("annual_income", "2.5 lakh", 250000), ("annual_income", "INR 1,000,000", 1000000), ("percentage", "75%", 75),
    ("percentage", "75 percent", 75), ("percentage", "೭೫%", 75), ("annual_income", "2.5 ಲಕ್ಷ", 250000)])
def test_unambiguous_numeric_formats(field, value, expected):
    assert parse_number(value, field) == expected


@pytest.mark.parametrize("value", ["about 75", "70-75%", "2 to 3 lakh", "2,50,00", True, "NaN", "75 or 80", "-10"])
def test_ambiguous_numeric_values_rejected(value):
    with pytest.raises(ValueError): parse_number(value, "annual_income")


def make(requirement, evidence, field, operator, value=None, values=None):
    return Criterion.model_validate({"requirement": requirement, "evidence": evidence, "page": 1,
                                    "rule": {"field": field, "operator": operator, "value_number": value, "values": values or []}})


def test_academic_and_income_examples_end_to_end_evaluation():
    criteria = [make("Academic minimum", "Applicants must secure at least 75 percent.", "percentage", "gte", "75%"),
                make("Income limit", "Annual income must not exceed Rs. 2,50,000.", "annual_income", "lte", "2.5 lakh")]
    analysis = ExtractedAnalysis(criteria=criteria)
    verify_analysis(analysis, [PageImage(b"img", "image/png", 1, "\n".join(c.evidence for c in criteria))])
    overall, items = assess_all(criteria, StudentProfile(percentage=65, annual_income="₹1,80,000"))
    assert overall == "possible_mismatch"
    assert [item.status.value for item in items] == ["may_not_meet", "likely_meets"]
    assert assess_all(criteria, StudentProfile())[0] == "needs_verification"


def test_education_mismatch_and_unsupported_compound_condition():
    simple = make("Postgraduate only", "Only postgraduate students may apply.", "education_level", "eq", values=["Postgraduate"])
    assert assess_all([simple], StudentProfile(education_level="Undergraduate"))[0] == "possible_mismatch"
    linked = make("Postgraduate at a recognized institution", "Postgraduate students enrolled in a recognized institution.", "education_level", "eq", values=["Postgraduate"])
    overall, items = assess_all([linked], StudentProfile(education_level="Postgraduate"))
    assert overall == "needs_verification" and items[0].requires_manual_review
    exception = make("Minimum marks except reserved categories", "Minimum 75%, except reserved categories.", "percentage", "gte", 75)
    assert assess_all([exception], StudentProfile(percentage=80))[0] == "needs_verification"


def test_wrong_rule_number_or_direction_cannot_pass_verified_quote():
    wrong_number = make("Income", "Maximum income 2.5 lakh.", "annual_income", "lte", 2.5)
    assert assess_all([wrong_number], StudentProfile(annual_income=1))[0] == "needs_verification"
    wrong_direction = make("Marks", "Minimum marks 75 percent.", "percentage", "lte", 75)
    assert assess_all([wrong_direction], StudentProfile(percentage=60))[0] == "needs_verification"


@pytest.mark.parametrize("quote,operator", [
    ("Applicants need not less than 75 percent.", "lt"),
    ("Applicants need no more than 75 percent.", "gt"),
    ("Applicants need at least 75 percent.", "gt"),
    ("Applicants need at most 75 percent.", "eq"),
    ("Applicants need not above 75 percent.", "gt"),
])
def test_negated_or_inclusive_operator_cannot_be_reinterpreted(quote, operator):
    condition = make("Marks condition", quote, "percentage", operator, 75)
    assert assess_all([condition], StudentProfile(percentage=80))[0] == "needs_verification"


def test_categorical_exclusion_is_not_a_positive_rule():
    condition = make("Category condition", "General category students are not eligible.", "category", "eq", values=["General"])
    overall, items = assess_all([condition], StudentProfile(category="General"))
    assert overall == "needs_verification" and items[0].requires_manual_review


@pytest.mark.parametrize("state,expected", [("Karnataka", "appears_to_meet_extracted"), ("Kerala", "possible_mismatch"), ("Not specified", "needs_verification")])
def test_residence_rule_and_missing_state(state, expected):
    condition = make("Residence", "Applicants must reside in Karnataka.", "state", "eq", values=["Karnataka"])
    assert assess_all([condition], StudentProfile(state=state))[0] == expected


def test_domicile_is_not_proven_by_residence_alone():
    condition = make("Karnataka domicile required", "Applicants must have Karnataka domicile.", "state", "eq", values=["Karnataka"])
    assert assess_all([condition], StudentProfile(state="Karnataka"))[0] == "needs_verification"


@pytest.mark.parametrize("quote,operator,value", [("Age below 25 years.", "lt", 24), ("Age above 18 years.", "gt", 19), ("Exactly 75 percent marks.", "eq", 75)])
def test_strict_numeric_operators_remain_supported(quote, operator, value):
    field = "percentage" if operator == "eq" else "age"
    threshold = 75 if operator == "eq" else 25 if operator == "lt" else 18
    condition = make("Numeric condition", quote, field, operator, threshold)
    assert assess_all([condition], StudentProfile(**{field: value}))[0] == "appears_to_meet_extracted"


def test_unique_exact_quote_repairs_page_but_ambiguous_and_scanned_quotes_do_not():
    pages = [PageImage(b"image", "image/png", 1, "A completely different first page."),
             PageImage(b"image", "image/png", 2, "Applicants must secure at least 75 percent.")]
    item = make("Marks", "Applicants must secure at least 75 percent.", "percentage", "gte", 75)
    verify_source(item, pages)
    assert item.page == 2 and item.verification.status == "verified"
    item.page = None
    pages[0].text = pages[1].text
    verify_source(item, pages)
    assert item.page is None and item.verification.status == "unverified"
    item.page = 1
    pages[0].text = ""
    pages[1].text = ""
    verify_source(item, pages)
    assert item.verification.status == "not_available"


@pytest.mark.asyncio
async def test_all_numbered_page_images_and_text_reach_gemma_without_duplicate_request():
    seen = []
    def handle(request):
        seen.append(json.loads(request.content))
        return response(MODEL_OUTPUT)
    pages = [PageImage(f"image {i}".encode(), "image/png", i, f"Readable page {i} scholarship content.") for i in range(1, 6)]
    await analyze_with_gemma(pages, StudentProfile(), Settings(gemini_api_key="test"), httpx.MockTransport(handle))
    assert len(seen) == 1
    parts = seen[0]["contents"][0]["parts"]
    assert len([p for p in parts if "inline_data" in p]) == 5
    for i in range(1, 6): assert any(f"ORIGINAL PAGE {i} OF 5" in p.get("text", "") and f"Readable page {i}" in p["text"] for p in parts)


@pytest.mark.asyncio
async def test_one_structured_recovery_then_success():
    calls = []
    def handle(request):
        calls.append(request)
        return response({} if len(calls) == 1 else MODEL_OUTPUT)
    result = await analyze_with_gemma([PageImage(b"img", "image/png", 1)], StudentProfile(), Settings(gemini_api_key="test"), httpx.MockTransport(handle))
    assert len(calls) == 2 and result.title == "Demo Scholarship"


@pytest.mark.asyncio
async def test_empty_analysis_recovery_is_bounded():
    calls = []
    def handle(request):
        calls.append(request)
        return response({})
    with pytest.raises(GemmaOutputError):
        await analyze_with_gemma([PageImage(b"img", "image/png", 1)], StudentProfile(), Settings(gemini_api_key="test"), httpx.MockTransport(handle))
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_finish_reason_truncation_not_treated_as_success():
    with pytest.raises(GemmaOutputError, match="truncated"):
        await generate_text({}, Settings(gemini_api_key="test"), httpx.MockTransport(lambda _: response(MODEL_OUTPUT, "MAX_TOKENS")))


@pytest.mark.asyncio
async def test_translation_repairs_only_allowed_fields_and_preserves_numbers():
    analysis = parse_gemma_output(json.dumps(MODEL_OUTPUT), 1)
    analysis.summary_kn = "This is English, not Kannada."
    original = analysis.model_dump()
    seen = []
    def handle(request):
        seen.append(json.loads(request.content))
        return response({"translations": {"summary_kn": "ಉದಾಹರಣೆ ವಿದ್ಯಾರ್ಥಿವೇತನದ ಸಾರಾಂಶ.", "title": "FAKE TITLE", "criteria.0.rule.value_number": "1"}})
    assert await repair_languages(analysis, Settings(gemini_api_key="test"), httpx.MockTransport(handle))
    assert len(seen) == 1 and analysis.title == original["title"]
    assert analysis.criteria[0].model_dump() == original["criteria"][0]
    assert "ವಿದ್ಯಾರ್ಥಿವೇತನ" in analysis.summary_kn
    analysis.summary_en = "Minimum marks are 75 percent."
    analysis.summary_kn = "ಕನಿಷ್ಠ ಅಂಕಗಳು 70 percent."
    assert not await repair_languages(analysis, Settings(gemini_api_key="test"), httpx.MockTransport(lambda _: response({"translations": {"summary_kn": "ಕನಿಷ್ಠ ಅಂಕಗಳು 70 percent."}})))
    assert analysis.summary_kn == "" and "translation is unavailable" in " ".join(analysis.warnings)


@pytest.mark.asyncio
async def test_translation_provider_failure_preserves_extraction():
    analysis = parse_gemma_output(json.dumps(MODEL_OUTPUT), 1)
    analysis.summary_kn = ""
    assert not await repair_languages(analysis, Settings(gemini_api_key="test"), httpx.MockTransport(lambda _: httpx.Response(429)))
    assert analysis.title == MODEL_OUTPUT["title"] and analysis.criteria


def test_translation_endpoint_keeps_session_profile_and_chat(client, monkeypatch):
    analysis = parse_gemma_output(json.dumps(MODEL_OUTPUT), 1)
    analysis.summary_kn = ""
    token = main.app.state.sessions.create([], StudentProfile(percentage=65), analysis)
    session = main.app.state.sessions.get(token)
    session.history.append({"role": "user", "parts": [{"text": "Keep this history"}]})
    async def repair(candidate, settings):
        candidate.summary_kn = "ವಿದ್ಯಾರ್ಥಿವೇತನದ ಸರಿಯಾದ ಸಾರಾಂಶ."
        return True
    monkeypatch.setattr(main, "repair_languages", repair)
    result = client.post("/api/analysis/translate", json={"session_id": token})
    assert result.status_code == 200 and "ಸರಿಯಾದ" in result.json()["summary_kn"]
    assert session.history[0]["parts"][0]["text"] == "Keep this history"
    assert session.profile.percentage == 65
    assert session.analysis.criteria == analysis.criteria
