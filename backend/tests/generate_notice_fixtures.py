"""Regenerate synthetic PDF assets. Kannada regeneration needs an embeddable Kannada TTF/TTC."""
import argparse
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from tests.notice_fixtures import CASES


def generate(font_path: str) -> None:
    destination = Path(__file__).parent / "fixtures"
    destination.mkdir(exist_ok=True)
    pdfmetrics.registerFont(TTFont("FixtureKannada", font_path, subfontIndex=0))
    for kind, row in CASES.items():
        title, quote, source_page = row[:3]
        output = destination / f"notice_{kind}.pdf"
        pdf = Canvas(str(output), pagesize=(720, 900))
        if kind == "E":
            image = Image.new("RGB", (1440, 1800), "white")
            draw = ImageDraw.Draw(image)
            for index, line in enumerate(["TEST FIXTURE E - FICTIONAL", title, "Fictional Test Foundation", quote, "An examination marksheet is required."]):
                draw.text((60, 80 + index * 110), line, fill="black", font_size=32)
            pdf.drawImage(ImageReader(image), 0, 0, width=720, height=900)
        else:
            for page in range(1, source_page + 1):
                pdf.setFont("Helvetica", 12)
                pdf.drawString(40, 850, f"TEST FIXTURE {kind} - FICTIONAL - PAGE {page}")
                pdf.setFont("FixtureKannada" if kind == "D" else "Helvetica", 14)
                pdf.drawString(40, 790, title)
                pdf.setFont("Helvetica", 12)
                pdf.drawString(40, 750, "Fictional Test Foundation")
                if page == source_page:
                    pdf.setFont("FixtureKannada" if kind == "D" else "Helvetica", 13)
                    pdf.drawString(40, 680, quote)
                    pdf.drawString(40, 640, "ಅಂಕಪಟ್ಟಿ ಅಗತ್ಯವಿದೆ." if kind == "D" else "An examination marksheet is required.")
                else:
                    pdf.drawString(40, 650, "General background only. Eligibility appears on a later page.")
                if page < source_page: pdf.showPage()
        pdf.save()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--kannada-font", required=True)
    generate(parser.parse_args().kannada_font)
