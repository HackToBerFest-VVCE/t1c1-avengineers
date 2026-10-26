"""TEST ONLY: real HTTP stack with mocked Google transport. Never a deployment entrypoint."""
import io
import json
from pathlib import Path

import httpx
from fastapi.responses import Response
from reportlab.pdfgen.canvas import Canvas

from app import main
from app.chat import answer_question
from app.config import Settings
from app.gemma import analyze_with_gemma
from tests.notice_fixtures import notice

NOTICE = {
    "title": "Riverbend Student Support Grant 2026",
    "provider": "Riverbend Student Foundation (fictional)",
    "summary_en": "Fictional grant for undergraduate students in Karnataka. Income and marks requirements apply.",
    "summary_kn": "ಕರ್ನಾಟಕದ ಪದವಿ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಕಾಲ್ಪನಿಕ ವಿದ್ಯಾರ್ಥಿವೇತನ. ಆದಾಯ ಮತ್ತು ಅಂಕಗಳ ನಿಯಮಗಳಿವೆ.",
    "summary_sources": [{"page": 1, "evidence": "Applicants must reside in Karnataka"}],
    "deadline": {"date_text": "15 December 2026, 5:00 PM IST", "iso_date": "2026-12-15", "page": 1, "evidence": "Applications close: 15 December 2026, 5:00 PM IST"},
    "criteria": [{"requirement": "Minimum 70% marks", "requirement_kn": "ಕನಿಷ್ಠ 70% ಅಂಕಗಳು", "page": 1,
                  "evidence": "Applicants must have scored at least 70% in their previous examination",
                  "rule": {"field": "percentage", "operator": "gte", "value_number": 70}}],
    "documents": [{"name": "Previous examination marksheet", "name_kn": "ಹಿಂದಿನ ಪರೀಕ್ಷೆಯ ಅಂಕಪಟ್ಟಿ", "page": 1, "evidence": "Previous examination marksheet"}],
    "steps": [{"title": "Complete the form", "title_kn": "ಅರ್ಜಿ ತುಂಬಿಸಿ", "detail_en": "Complete the online application form and upload the listed documents. No portal URL is specified.", "detail_kn": "ಆನ್‌ಲೈನ್ ಅರ್ಜಿ ತುಂಬಿಸಿ ಮತ್ತು ದಾಖಲೆಗಳನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ. ಅರ್ಜಿಯ ಲಿಂಕ್ ನೀಡಲಾಗಿಲ್ಲ.", "page": 1, "evidence": "Complete the online application form"}],
    "confidence": "medium", "warnings": ["Fictional sample only."], "warnings_kn": ["ಕಾಲ್ಪನಿಕ ಮಾದರಿ ಮಾತ್ರ."],
}


def provider(request, analysis=NOTICE):
    body = json.loads(request.content)
    is_chat = "scholarship reasoning assistant" in body["systemInstruction"]["parts"][0]["text"]
    result = analysis
    if is_chat:
        language = json.loads(body["contents"][-1]["parts"][0]["text"])["language"]
        result = {"answer": "Prepare your previous examination marksheet. This is preliminary guidance." if language == "en" else "ಹಿಂದಿನ ಪರೀಕ್ಷೆಯ ಅಂಕಪಟ್ಟಿಯನ್ನು ಸಿದ್ಧಪಡಿಸಿ. ಇದು ಪ್ರಾಥಮಿಕ ಮಾರ್ಗದರ್ಶನ.",
                  "citations": [{"page": 1, "evidence": "Previous examination marksheet"}],
                  "suggestions": [], "missing_information": []}
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json.dumps(result, ensure_ascii=False)}]}}]})


transport = httpx.MockTransport(provider)
test_settings = Settings(gemini_api_key="test-only-not-a-credential")


async def analyze(pages, profile, _settings):
    text = "\n".join(page.text for page in pages)
    kind = next((kind for kind in "ABCD" if f"TEST FIXTURE {kind}" in text), None)
    if not text.strip():
        kind = "E"
    response = notice(kind) if kind else NOTICE
    fixture_transport = httpx.MockTransport(lambda request: provider(request, response))
    return await analyze_with_gemma(pages, profile, test_settings, fixture_transport)


async def chat(session, question, language, _settings):
    return await answer_question(session, question, language, test_settings, transport)


main.analyze_with_gemma = analyze
main.answer_question = chat
app = main.app


@app.get("/test-only/fixtures/{kind}.pdf")
async def fixture_pdf(kind: str):
    if kind not in "ABCDE" or len(kind) != 1:
        return Response(status_code=404)
    return Response((Path(__file__).parent / "fixtures" / f"notice_{kind}.pdf").read_bytes(), media_type="application/pdf")


@app.get("/test-only/multipage.pdf")
async def multipage_pdf():
    data = io.BytesIO()
    canvas = Canvas(data)
    canvas.drawString(40, 720, "Fictional test notice - first page")
    canvas.showPage()
    canvas.drawString(40, 720, "Fictional test notice - second page evidence")
    canvas.save()
    return Response(data.getvalue(), media_type="application/pdf")
