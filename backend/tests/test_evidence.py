import io

import pytest
from pydantic import ValidationError
from reportlab.pdfgen.canvas import Canvas

from app.documents import PageImage, prepare_document
from app.evidence import verify_citation, verify_analysis
from app.schemas import SourceFact, ExtractedAnalysis


def pages(text="Applicants must have annual income below Rs 250000."):
    return [PageImage(b"image", "image/png", 1, text)]


@pytest.mark.parametrize("quote", ["annual income below Rs 250000", "annual  income\n below Rs 250000."])
def test_exact_and_normalized(quote):
    assert verify_citation(SourceFact(page=1, evidence=quote), pages()).status == "verified"


def test_wrong_page_never_verified():
    source = [*pages(), PageImage(b"img", "image/png", 2, "A completely different second page.")]
    assert verify_citation(SourceFact(page=2, evidence="annual income below Rs 250000"), source).status == "unverified"
    assert verify_citation(SourceFact(page=3, evidence="annual income"), source).status == "unverified"


def test_fabricated_quote():
    assert verify_citation(SourceFact(page=1, evidence="Every applicant receives one million rupees"), pages()).status == "unverified"


def test_partial_not_verified():
    result = verify_citation(SourceFact(page=1, evidence="Applicants must have annual incomes below Rs 250000"), pages())
    assert result.status == "partial_match"


@pytest.mark.parametrize("text", ["", "   ", "12345", "scan"])
def test_unreliable_text_layer(text):
    assert verify_citation(SourceFact(page=1, evidence="annual income"), pages(text)).status == "not_available"


def test_empty_document():
    assert verify_citation(SourceFact(page=1, evidence="annual income"), []).status == "unverified"


@pytest.mark.parametrize("payload", [{"page": 0}, {"page": -1}, {"page": "bad"}, {"page": True}, {"evidence": {"text": "bad"}}])
def test_invalid_citation_structure(payload):
    with pytest.raises(ValidationError):
        SourceFact.model_validate(payload)


def test_no_page_or_short_quote():
    assert verify_citation(SourceFact(evidence="annual income"), pages()).status == "unverified"
    assert verify_citation(SourceFact(page=1, evidence="Rs"), pages()).status == "unverified"


def test_real_pdf_text_and_scanned_pdf():
    data = io.BytesIO()
    pdf = Canvas(data)
    pdf.drawString(30, 600, "Applicants must have annual income below Rs 250000.")
    pdf.showPage()
    pdf.rect(20, 20, 100, 100)
    pdf.save()
    result = prepare_document(data.getvalue(), "notice.pdf")
    assert "annual income" in result[0].text
    assert result[1].text == ""
    assert verify_citation(SourceFact(page=2, evidence="Applicants must have"), result).status == "not_available"


def test_model_supplied_verification_overwritten():
    analysis = ExtractedAnalysis.model_validate({"documents": [{"name": "Fake", "page": 1, "evidence": "imaginary document", "verification": {"status": "verified"}}]})
    verify_analysis(analysis, pages())
    assert analysis.documents[0].verification.status == "unverified"


def test_kannada_combining_marks_are_preserved():
    text = "ಅರ್ಜಿದಾರರು ಕರ್ನಾಟಕದ ನಿವಾಸಿಗಳಾಗಿರಬೇಕು."
    assert verify_citation(SourceFact(page=1, evidence="ಕರ್ನಾಟಕದ ನಿವಾಸಿಗಳಾಗಿರಬೇಕು"), pages(text)).status == "verified"
