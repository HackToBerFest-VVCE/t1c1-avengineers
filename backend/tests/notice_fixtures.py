"""Synthetic notices and expected MODEL responses, used exclusively by automated tests."""
from copy import deepcopy

CASES = {
    "A": ("Academic Test Scholarship", "Applicants must secure at least 75 percent.", 2, "percentage", "gte", "75%", [],
          "ಕನಿಷ್ಠ 75% ಅಂಕಗಳು", "This fictional grant requires at least 75 percent marks.", "ಈ ಕಾಲ್ಪನಿಕ ವಿದ್ಯಾರ್ಥಿವೇತನಕ್ಕೆ ಕನಿಷ್ಠ 75 percent ಅಂಕಗಳು ಅಗತ್ಯ."),
    "B": ("Income Test Scholarship", "Annual family income must not exceed Rs. 2,50,000.", 3, "annual_income", "lte", "2.5 lakh", [],
          "ವಾರ್ಷಿಕ ಆದಾಯದ ಮಿತಿ", "This fictional grant limits annual family income to Rs. 2,50,000.", "ಈ ಕಾಲ್ಪನಿಕ ವಿದ್ಯಾರ್ಥಿವೇತನದ ವಾರ್ಷಿಕ ಆದಾಯದ ಮಿತಿ Rs. 2,50,000."),
    "C": ("Postgraduate Test Scholarship", "Only postgraduate students may apply.", 1, "education_level", "eq", None, ["Postgraduate"],
          "ಸ್ನಾತಕೋತ್ತರ ವಿದ್ಯಾರ್ಥಿಗಳು ಮಾತ್ರ", "This fictional grant is restricted to postgraduate students.", "ಈ ಕಾಲ್ಪನಿಕ ವಿದ್ಯಾರ್ಥಿವೇತನ ಸ್ನಾತಕೋತ್ತರ ವಿದ್ಯಾರ್ಥಿಗಳಿಗೆ ಮಾತ್ರ."),
    "D": ("ಕಾಲ್ಪನಿಕ ವಿದ್ಯಾ ವಿದ್ಯಾರ್ಥಿವೇತನ", "ಅರ್ಜಿದಾರರು ಕನಿಷ್ಠ 75% ಅಂಕಗಳನ್ನು ಪಡೆದಿರಬೇಕು.", 2, "percentage", "gte", "75 percent", [],
          "ಕನಿಷ್ಠ 75% ಅಂಕಗಳು", "This Kannada notice requires at least 75% marks for this fictional scholarship.", "ಈ ಕನ್ನಡ ಪ್ರಕಟಣೆಯ ಕಾಲ್ಪನಿಕ ವಿದ್ಯಾರ್ಥಿವೇತನಕ್ಕೆ ಕನಿಷ್ಠ 75% ಅಂಕಗಳು ಅಗತ್ಯ."),
    "E": ("Scanned Test Scholarship", "Applicants must secure at least 75 percent.", 1, "percentage", "gte", "75 percent", [],
          "ಕನಿಷ್ಠ 75% ಅಂಕಗಳು", "This fictional scanned notice requires at least 75 percent marks.", "ಈ ಕಾಲ್ಪನಿಕ ಚಿತ್ರ ಪ್ರಕಟಣೆಗೆ ಕನಿಷ್ಠ 75 percent ಅಂಕಗಳು ಅಗತ್ಯ."),
}


def notice(kind: str) -> dict:
    title, quote, page, field, operator, number, values, requirement_kn, en, kn = CASES[kind]
    document = "ಅಂಕಪಟ್ಟಿ ಅಗತ್ಯವಿದೆ." if kind == "D" else "An examination marksheet is required."
    return deepcopy({
        "title": title, "provider": "Fictional Test Foundation", "summary_en": en, "summary_kn": kn,
        "summary_sources": [{"page": page, "evidence": quote}],
        "deadline": {"date_text": None, "iso_date": None, "page": None, "evidence": None},
        "criteria": [{"requirement": "Minimum 75% marks" if field == "percentage" else "Annual income limit" if field == "annual_income" else "Postgraduate enrollment",
                      "requirement_kn": requirement_kn, "page": page, "evidence": quote,
                      "rule": {"field": field, "operator": operator, "value_number": number, "values": values}}],
        "documents": [{"name": "Examination marksheet", "name_kn": "ಪರೀಕ್ಷೆಯ ಅಂಕಪಟ್ಟಿ", "page": page, "evidence": document}],
        "steps": [{"title": "Prepare the marksheet", "title_kn": "ಅಂಕಪಟ್ಟಿಯನ್ನು ಸಿದ್ಧಪಡಿಸಿ", "detail_en": "Prepare the examination marksheet.",
                   "detail_kn": "ಪರೀಕ್ಷೆಯ ಅಂಕಪಟ್ಟಿಯನ್ನು ಸಿದ್ಧಪಡಿಸಿ.", "page": page, "evidence": document}],
        "unknowns": ["The deadline is not specified in the notice."], "unknowns_kn": ["ಪ್ರಕಟಣೆಯಲ್ಲಿ ಅರ್ಜಿಯ ಗಡುವನ್ನು ತಿಳಿಸಿಲ್ಲ."],
        "warnings": ["Fictional test notice, not a real scholarship."], "warnings_kn": ["ಇದು ಕಾಲ್ಪನಿಕ ಪರೀಕ್ಷಾ ಪ್ರಕಟಣೆ, ನಿಜವಾದ ವಿದ್ಯಾರ್ಥಿವೇತನವಲ್ಲ."],
        "confidence": "medium",
    })
