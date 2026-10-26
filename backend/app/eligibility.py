"""Conservative deterministic assessment of structured requirements extracted by Gemma.

Gemma extracts requirements and evidence; this module alone computes outcomes.
A purported document quote is model-provided and not independently OCR-verified.
"""
import re
from .schemas import Criterion, CriterionStatus, StudentProfile
from .numbers import numeric_values

SUPPORTED_FIELDS = {'annual_income', 'percentage', 'state', 'category', 'education_level', 'age', 'study_mode'}
NUMERIC_OPERATORS = {'lt', 'lte', 'gt', 'gte', 'eq'}
FIELD_KN = {'annual_income': 'ಕುಟುಂಬದ ವಾರ್ಷಿಕ ಆದಾಯ', 'percentage': 'ಅಂಕಗಳ ಶೇಕಡಾವಾರು', 'age': 'ವಯಸ್ಸು',
            'state': 'ವಾಸಿಸುವ ರಾಜ್ಯ', 'category': 'ವರ್ಗ', 'education_level': 'ಶಿಕ್ಷಣದ ಮಟ್ಟ', 'study_mode': 'ಅಧ್ಯಯನ ವಿಧಾನ'}
ALIASES = {'ug': 'undergraduate', 'under graduate': 'undergraduate', 'bachelor': 'undergraduate',
           'pg': 'postgraduate', 'post graduate': 'postgraduate', 'masters': 'postgraduate', 'master': 'postgraduate',
           'ಸ್ನಾತಕೋತ್ತರ': 'postgraduate', 'ಕರ್ನಾಟಕ': 'karnataka', 'ಪರಿಶಿಷ್ಟ ಜಾತಿ': 'sc', 'ಪರಿಶಿಷ್ಟ ಪಂಗಡ': 'st',
           'full time': 'full-time', 'part time': 'part-time', 'scheduled caste': 'sc', 'scheduled castes': 'sc',
           'scheduled tribe': 'st', 'scheduled tribes': 'st'}


def _normalize(value: str) -> str:
    normalized = ' '.join(value.casefold().split())
    return ALIASES.get(normalized, normalized)


def complex_condition(item: Criterion) -> bool:
    text = f'{item.requirement} {item.evidence or ""}'.casefold()
    if item.requires_manual_review or re.search(r'\b(?:unless|except|provided that|only if|subject to|relaxation|depending|conditional)\b|ಹೊರತು|ಷರತ್ತಿಗೆ', text):
        return True
    if re.search(r'\b(?:not eligible|ineligible|excluded|other than|not permitted|not allowed)\b|ಅನರ್ಹ', text):
        return True
    if item.rule and item.rule.field == 'education_level' and re.search(r'\b(?:recognized|accredited|enrolled|institution|college)\b', text):
        return True
    if item.rule and item.rule.field == 'state' and re.search(r'\bdomicile\b', text):
        return True
    return bool(re.search(r'\bincome\b', text) and re.search(r'\b(?:marks|percentage)\b', text))


def operator_supported(text: str, operator: str) -> bool:
    inclusive = r'≥|<=|≤|>=|at least|minimum|not less than|or more|and above|not exceed|at most|maximum|not more than|no more than|up to|(?:less|greater) than or equal to|ಕನಿಷ್ಠ|ಮೀರಬಾರದು|ಗರಿಷ್ಠ'
    if operator in {'lt', 'gt', 'eq'} and re.search(inclusive, text, re.I):
        return False
    if re.search(r'\bnot (?:at least|at most|above|below|equal to)\b', text, re.I):
        return False
    patterns = {
        'gte': r'≥|>=|at least|minimum|not less than|or more|and above|ಕನಿಷ್ಠ',
        'lte': r'≤|<=|not exceed|at most|maximum|not more than|no more than|up to|less than or equal to|ಮೀರಬಾರದು|ಗರಿಷ್ಠ',
        'gt': r'(?<![<>=])>(?!=)|more than|above|greater than',
        'lt': r'(?<![<>=])<(?!=)|less than|below',
        'eq': r'(?<![<>=])=(?!=)|equal to|exactly',
    }
    return bool(re.search(patterns.get(operator, r'(?!)'), text, re.I))


def assess_criterion(item: Criterion, student: StudentProfile) -> Criterion:
    # Model-provided verdicts are never treated as authoritative.
    item.status = CriterionStatus.needs_review
    item.explanation_en = 'Needs verification: no machine-checkable, source-backed rule and student fact.'
    item.explanation_kn = 'ಪರಿಶೀಲನೆ ಅಗತ್ಯ: ಮೂಲಾಧಾರವಿರುವ ನಿಯಮ ಅಥವಾ ವಿದ್ಯಾರ್ಥಿಯ ಮಾಹಿತಿ ಲಭ್ಯವಿಲ್ಲ.'
    rule = item.rule
    item.student_value = getattr(student, rule.field, None) if rule else None
    if complex_condition(item):
        item.requires_manual_review = True
        item.explanation_en = 'Needs verification: this condition includes linked requirements, exceptions or information the profile cannot establish.'
        item.explanation_kn = 'ಪರಿಶೀಲನೆ ಅಗತ್ಯ: ಈ ನಿಯಮದಲ್ಲಿ ಸಂಬಂಧಿತ ಷರತ್ತುಗಳು, ವಿನಾಯಿತಿಗಳು ಅಥವಾ ಪ್ರೊಫೈಲ್‌ನಿಂದ ದೃಢಪಡಿಸಲಾಗದ ಮಾಹಿತಿಯಿದೆ.'
        return item
    if item.verification is not None and item.verification.status != 'verified':
        item.explanation_en = 'Needs verification: the quoted condition has not been matched to document text.'
        item.explanation_kn = 'ಪರಿಶೀಲನೆ ಅಗತ್ಯ: ಉಲ್ಲೇಖಿತ ನಿಯಮವನ್ನು ದಾಖಲೆಯ ಪಠ್ಯದೊಂದಿಗೆ ದೃಢಪಡಿಸಲಾಗಿಲ್ಲ.'
        return item
    if not rule or not item.evidence or not item.evidence.strip() or item.page is None:
        return item
    if rule.field not in SUPPORTED_FIELDS:
        return item
    actual = getattr(student, rule.field)
    if actual is None or (isinstance(actual, str) and _normalize(actual) in {'', 'not specified', 'prefer not to say', 'other'}):
        item.explanation_en = f'Needs verification: student {rule.field.replace("_", " ")} was not supplied.'
        item.explanation_kn = f'ಪರಿಶೀಲನೆ ಅಗತ್ಯ: ವಿದ್ಯಾರ್ಥಿಯ {FIELD_KN[rule.field]} ನೀಡಲಾಗಿಲ್ಲ.'
        return item

    if rule.field in {'annual_income', 'percentage', 'age'}:
        if rule.operator not in NUMERIC_OPERATORS or not isinstance(rule.value_number, (float, int)):
            return item
        value = float(actual)
        threshold = float(rule.value_number)
        if threshold not in numeric_values(item.evidence, rule.field) or not operator_supported(item.evidence, rule.operator):
            item.explanation_en = 'Needs verification: the structured threshold does not match the quoted numeric value.'
            item.explanation_kn = 'ಪರಿಶೀಲನೆ ಅಗತ್ಯ: ರಚನಾತ್ಮಕ ಮಿತಿ ಮತ್ತು ಮೂಲ ಉಲ್ಲೇಖದ ಸಂಖ್ಯೆಯು ಹೊಂದಿಕೆಯಾಗಿಲ್ಲ.'
            return item
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
        source = ' '.join(item.evidence.casefold().split())
        for option in options:
            equivalents = [option, *(key for key, canonical in ALIASES.items() if canonical == option)]
            if not any(re.search(r'(?<!\w)' + re.escape(value) + r'(?!\w)', source) for value in equivalents):
                item.explanation_en = 'Needs verification: a structured category is not supported by the quoted wording.'
                item.explanation_kn = 'ಪರಿಶೀಲನೆ ಅಗತ್ಯ: ರಚನಾತ್ಮಕ ವರ್ಗಕ್ಕೆ ಉಲ್ಲೇಖಿತ ಪಠ್ಯದಲ್ಲಿ ಬೆಂಬಲವಿಲ್ಲ.'
                return item
        if not any(_normalize(str(actual)) == option for option in options) and any(re.search(r'[\u0c80-\u0cff]', option) for option in options):
            item.explanation_en = 'Needs verification: this categorical label needs a confirmed cross-language equivalence.'
            item.explanation_kn = 'ಪರಿಶೀಲನೆ ಅಗತ್ಯ: ಈ ವರ್ಗದ ಹೆಸರುಗಳ ಭಾಷಾಂತರದ ಸಮಾನತೆಯನ್ನು ದೃಢಪಡಿಸಬೇಕು.'
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
