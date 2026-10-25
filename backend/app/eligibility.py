"""Conservative deterministic assessment of structured requirements extracted by Gemma.

Gemma extracts requirements and evidence; this module alone computes outcomes.
A purported document quote is model-provided and not independently OCR-verified.
"""
from .schemas import Criterion, CriterionStatus, StudentProfile

SUPPORTED_FIELDS = {'annual_income', 'percentage', 'state', 'category', 'education_level'}
NUMERIC_OPERATORS = {'lt', 'lte', 'gt', 'gte', 'eq'}


def _normalize(value: str) -> str:
    return ' '.join(value.casefold().split())


def assess_criterion(item: Criterion, student: StudentProfile) -> Criterion:
    # Model-provided verdicts are never treated as authoritative.
    item.status = CriterionStatus.needs_review
    item.explanation_en = 'Needs verification: no machine-checkable, source-backed rule and student fact.'
    item.explanation_kn = 'ಪರಿಶೀಲನೆ ಅಗತ್ಯ: ಮೂಲಾಧಾರವಿರುವ ನಿಯಮ ಅಥವಾ ವಿದ್ಯಾರ್ಥಿಯ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.'
    rule = item.rule
    if not rule or not item.evidence or not item.evidence.strip() or item.page is None:
        return item
    if rule.field not in SUPPORTED_FIELDS:
        return item
    actual = getattr(student, rule.field)
    if actual is None or (isinstance(actual, str) and _normalize(actual) in {'', 'not specified'}):
        item.explanation_en = f'Needs verification: student {rule.field.replace("_", " ")} was not supplied.'
        item.explanation_kn = f'ಪರಿಶೀಲನೆ ಅಗತ್ಯ: ವಿದ್ಯಾರ್ಥಿಯ {rule.field.replace("_", " ")} ನೀಡಲಾಗಿಲ್ಲ.'
        return item

    if rule.field in {'annual_income', 'percentage'}:
        if rule.operator not in NUMERIC_OPERATORS or not isinstance(rule.value_number, (float, int)):
            return item
        value = float(actual)
        threshold = float(rule.value_number)
        comparisons = {'lt': value < threshold, 'lte': value <= threshold,
                       'gt': value > threshold, 'gte': value >= threshold, 'eq': value == threshold}
        passed = comparisons[rule.operator]
        symbol = {'lt': '<', 'lte': '≤', 'gt': '>', 'gte': '≥', 'eq': '='}[rule.operator]
        comparison = f'{value:g} {symbol} {threshold:g}'
    else:
        if rule.operator not in {'eq', 'one_of'} or not rule.values:
            return item
        options = [_normalize(s) for s in rule.values if s.strip()]
        if not options:
            return item
        # Exact categorical comparisons only; no fuzzy matching or guessed equivalences.
        passed = _normalize(str(actual)) in options
        comparison = f'{actual} vs {", ".join(rule.values)}'

    item.status = CriterionStatus.likely_meets if passed else CriterionStatus.may_not_meet
    item.explanation_en = f'{"Appears satisfied" if passed else "Possible mismatch"}: {comparison}. Verify the quoted rule in the original notice.'
    item.explanation_kn = f'{"ಪೂರೈಸಿದಂತೆ ಕಾಣುತ್ತದೆ" if passed else "ಹೊಂದಿಕೆಯಾಗದಿರಬಹುದು"}: {comparison}. ಮೂಲ ಪ್ರಕಟಣೆಯಲ್ಲಿ ನಿಯಮವನ್ನು ಪರಿಶೀಲಿಸಿ.'
    return item


def assess_all(criteria: list[Criterion], student: StudentProfile) -> tuple[str, list[Criterion]]:
    assessed = [assess_criterion(item, student) for item in criteria]
    if not assessed or any(c.status == CriterionStatus.needs_review for c in assessed):
        overall = 'needs_verification'
    elif any(c.status == CriterionStatus.may_not_meet for c in assessed):
        overall = 'possible_mismatch'
    else:
        # Even complete extracted matches cannot prove document extraction completeness.
        overall = 'appears_to_meet_extracted'
    return overall, assessed
