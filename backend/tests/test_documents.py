import io

import pytest
from PIL import Image
from reportlab.pdfgen.canvas import Canvas

from app.documents import DocumentError, prepare_document


def test_accepts_real_png_regardless_of_name(png_bytes):
    result = prepare_document(png_bytes, "arbitrary.dat")
    assert len(result) == 1
    assert result[0].mime_type == "image/png"
    assert result[0].data.startswith(b"\x89PNG")


def test_rejects_fake_png():
    with pytest.raises(DocumentError, match="valid"):
        prepare_document(b"This is not a photo", "fake.png")


def test_pdf_pages_are_rendered():
    content = io.BytesIO()
    pdf = Canvas(content, pagesize=(400, 400))
    pdf.drawString(50, 300, "Example scholarship")
    pdf.showPage()
    pdf.drawString(50, 300, "Second page")
    pdf.save()
    pages = prepare_document(content.getvalue(), "notice.pdf")
    assert [p.page for p in pages] == [1, 2]
    assert all(p.data.startswith(b"\x89PNG") for p in pages)


def test_pdf_limit():
    content = io.BytesIO()
    pdf = Canvas(content)
    for i in range(3):
        pdf.drawString(20, 20, str(i))
        pdf.showPage()
    pdf.save()
    with pytest.raises(DocumentError, match="limited"):
        prepare_document(content.getvalue(), "big.pdf", max_pages=2)


def test_rejects_empty():
    with pytest.raises(DocumentError, match="empty"):
        prepare_document(b"", "empty.pdf")
