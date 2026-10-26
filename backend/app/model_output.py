"""Strict JSON decoding plus narrow compatibility normalization for model output."""
import json
import re
from copy import deepcopy


class ModelOutputError(ValueError):
    pass


def json_object(text: str) -> dict:
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.I).strip()
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        # Allow a prose prefix, but never salvage an inner object from truncated JSON.
        start = raw.find("{")
        if start < 0:
            raise ModelOutputError("No structured JSON object")
        try:
            value, end = json.JSONDecoder().raw_decode(raw[start:])
            if raw[start + end:].strip() not in {"", "```"}:
                raise ModelOutputError("Unexpected content after structured JSON")
        except json.JSONDecodeError as exc:
            raise ModelOutputError("Incomplete or malformed structured JSON") from exc
    if not isinstance(value, dict):
        raise ModelOutputError("Expected a structured JSON object")
    return value


def source_fields(item: dict) -> dict:
    result = deepcopy(item)
    source = result.get("source") or (result.get("evidence") if isinstance(result.get("evidence"), dict) else None)
    if isinstance(source, dict):
        result["evidence"] = source.get("evidence") or source.get("quote") or source.get("quotation")
        result.setdefault("page", source.get("page", source.get("page_number")))
    if "evidence" not in result:
        result["evidence"] = result.get("source_quote", result.get("quote", result.get("quotation")))
    if "page" not in result:
        result["page"] = result.get("page_number")
    page = result.get("page")
    if isinstance(page, str):
        match = re.fullmatch(r"(?:page\s*)?(\d+)", page.strip(), re.I)
        page = int(match[1]) if match else None
    result["page"] = page if type(page) is int and page >= 1 else None
    if not isinstance(result.get("evidence"), str): result["evidence"] = None
    result.pop("verification", None)
    return result


def normalize_analysis(payload: dict) -> dict:
    payload = deepcopy(payload)
    for _ in range(2):
        if any(key in payload for key in ("title", "summary_en", "summary_kn", "criteria", "scholarship_title")):
            break
        wrapped = next((payload[key] for key in ("analysis", "scholarship_analysis", "result", "data")
                        if isinstance(payload.get(key), dict)), None)
        if wrapped is None: break
        payload = wrapped
    aliases = {"title": ("scholarship_title", "scholarship_name"), "provider": ("scholarship_provider", "organization"),
               "summary_en": ("english_summary",), "summary_kn": ("kannada_summary",),
               "criteria": ("eligibility_requirements", "eligibility_criteria"),
               "summary_sources": ("summary_citations",),
               "documents": ("required_documents",), "steps": ("application_steps",)}
    for key, alternatives in aliases.items():
        if key not in payload:
            for alias in alternatives:
                if alias in payload:
                    payload[key] = payload[alias]
                    break
    summary = payload.get("summary")
    if isinstance(summary, str): payload.setdefault("summary_en", summary)
    elif isinstance(summary, dict):
        payload.setdefault("summary_en", summary.get("en", ""))
        payload.setdefault("summary_kn", summary.get("kn", ""))
    for key in ("title", "summary_en", "summary_kn"):
        if payload.get(key) is None: payload.pop(key, None)
    for key in ("criteria", "documents", "steps", "summary_sources", "warnings", "unknowns", "warnings_kn", "unknowns_kn"):
        if payload.get(key) is None: payload[key] = []
    if payload.get("deadline") is None: payload["deadline"] = {}
    if isinstance(payload.get("deadline"), dict): payload["deadline"] = source_fields(payload["deadline"])
    for key, field, alternatives in [("criteria", "requirement", ("condition", "criterion", "text")),
                                     ("documents", "name", ("document", "title")),
                                     ("steps", "title", ("step", "instruction")),
                                     ("summary_sources", "evidence", ())]:
        if key not in payload: continue
        if not isinstance(payload[key], list): raise ModelOutputError(f"Invalid {key} list")
        normalized = []
        for item in payload[key]:
            if isinstance(item, str): item = {field: item}
            if not isinstance(item, dict): raise ModelOutputError(f"Invalid {key} item")
            item = source_fields(item)
            if not item.get(field):
                item[field] = next((item.get(alias) for alias in alternatives if isinstance(item.get(alias), str)), None)
            if key == "criteria":
                item["status"] = "needs_review"
                item.pop("student_value", None)
            if key == "steps":
                item.setdefault("detail_en", item.get("description", item.get("title", "")))
                item.setdefault("detail_kn", "")
                if item.get("priority") not in {"critical", "important", "optional"}: item["priority"] = "important"
            normalized.append(item)
        payload[key] = normalized
    return payload
