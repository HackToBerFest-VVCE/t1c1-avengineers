"""Conservative, page-specific text verification. Never invent coordinates or OCR."""
import re
import unicodedata
from difflib import SequenceMatcher

from .documents import PageImage
from .schemas import ExtractedAnalysis, SourceFact, Verification


def normalize(text: str) -> str:
    text = unicodedata.normalize("NFKC", text).casefold()
    # Retain symbols, numbers and Kannada combining marks. Punctuation is spacing.
    return " ".join("".join(" " if unicodedata.category(c).startswith("P") else c
                            for c in text).split())


def verify_citation(citation: SourceFact, pages: list[PageImage]) -> Verification:
    page = citation.page
    if page is None or not 1 <= page <= len(pages):
        return Verification(status="unverified", reason="Missing or invalid page reference.")
    text = pages[page - 1].text
    normalized = normalize(text)
    if len(normalized) < 15 or not any(c.isalpha() for c in normalized):
        return Verification(reason="This page has no reliable text layer; inspect the image or scanned page manually.")
    quote = normalize(citation.evidence or "")
    if len(quote) < 6 or not any(c.isalpha() for c in quote):
        return Verification(status="unverified", reason="Quotation is missing or too short for reliable verification.")
    if quote in normalized:
        return Verification(status="verified", reason="Quotation matched normalized text on the cited page.",
                            matched_text=citation.evidence)
    # Fuzzy matching never produces 'verified', even for near-exact quotations.
    words = normalized.split()[:10000]
    size = len(quote.split())
    if 20 <= len(quote) <= 400 and size >= 4:
        for count in range(max(1, size - 2), size + 3):
            for start in range(len(words) - count + 1):
                window = " ".join(words[start:start + count])
                if SequenceMatcher(None, quote, window, autojunk=False).ratio() >= 0.88:
                    return Verification(status="partial_match", reason="Similar text found; verify the wording manually.",
                                        matched_text=window)
    return Verification(status="unverified", reason="Quotation was not found on the cited page.")


def verify_analysis(analysis: ExtractedAnalysis, pages: list[PageImage]) -> None:
    for citation in [analysis.deadline, *analysis.summary_sources, *analysis.criteria,
                     *analysis.documents, *analysis.steps]:
        citation.verification = verify_citation(citation, pages)
