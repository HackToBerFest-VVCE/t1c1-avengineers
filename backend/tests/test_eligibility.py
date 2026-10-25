from app.eligibility import assess_all
from app.schemas import Criterion, EligibilityRule, StudentProfile, CriterionStatus


def make(field='annual_income', operator='lte', value_number=250000, values=None, evidence='Income ≤ 250000', page=1):
    return Criterion(requirement='Eligibility requirement', evidence=evidence, page=page,
                     rule=EligibilityRule(field=field, operator=operator, value_number=value_number, values=values or []),
                     status=CriterionStatus.likely_meets)


def test_income_below_threshold():
    overall, items = assess_all([make()], StudentProfile(annual_income=150000))
    assert overall == 'appears_to_meet_extracted'
    assert items[0].status == CriterionStatus.likely_meets


def test_income_over_threshold():
    overall, items = assess_all([make()], StudentProfile(annual_income=300000))
    assert overall == 'possible_mismatch'
    assert items[0].status == CriterionStatus.may_not_meet


def test_incomplete_profile_does_not_guess():
    overall, items = assess_all([make()], StudentProfile())
    assert overall == 'needs_verification'
    assert items[0].status == CriterionStatus.needs_review


def test_missing_evidence_cannot_pass():
    overall, items = assess_all([make(evidence=None)], StudentProfile(annual_income=1000))
    assert overall == 'needs_verification'
    assert items[0].status == CriterionStatus.needs_review


def test_unstructured_ai_verdict_overridden():
    item = Criterion(requirement='Do something', status='likely_meets')
    overall, items = assess_all([item], StudentProfile())
    assert overall == 'needs_verification'
    assert items[0].status == CriterionStatus.needs_review


def test_exact_category_matches_case_insensitive():
    overall, items = assess_all([make(field='category', operator='one_of', value_number=None,
                                      values=['SC', 'ST'], evidence='SC or ST')], StudentProfile(category='sc'))
    assert overall == 'appears_to_meet_extracted'
    assert items[0].status == CriterionStatus.likely_meets


def test_multiple_mixed_statuses_conservative():
    overall, items = assess_all([make(), make(field='percentage',operator='gte',value_number=80,evidence='80%')],
                                StudentProfile(annual_income=300000))
    assert overall == 'needs_verification'
    assert [x.status for x in items] == [CriterionStatus.may_not_meet, CriterionStatus.needs_review]


def test_unknown_operator_does_not_guess():
    overall, _ = assess_all([make(operator='approx')], StudentProfile(annual_income=250000))
    assert overall == 'needs_verification'


def test_empty_criteria_not_eligible():
    overall, _ = assess_all([], StudentProfile())
    assert overall == 'needs_verification'
