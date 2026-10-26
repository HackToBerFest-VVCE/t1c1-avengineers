"""Parse only unambiguous scholarship numeric values; never infer a rule or operator."""
import math
import re
import unicodedata

NUMBER = r"(?:\d{1,3}(?:,\d{2})*,\d{3}|\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?"
UNITS = r"(?:lakhs?|lacs?|crores?|ಲಕ್ಷ(?:ಗಳು)?|ಕೋಟಿ|percent(?:age)?|%|ಶೇಕಡಾ|years?|ವರ್ಷ)?"
FRAGMENT = re.compile(rf"(?<![\w.,]){NUMBER}\s*{UNITS}(?![\w,]|\.\d)", re.I)


def ascii_digits(text: str) -> str:
    return "".join(str(unicodedata.digit(c)) if c.isdecimal() else c
                   for c in unicodedata.normalize("NFKC", text))


def parse_number(value, field: str) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError("Boolean is not a numeric threshold")
    if isinstance(value, (float, int)):
        result = float(value)
    elif isinstance(value, str):
        text = ascii_digits(value).strip().casefold()
        text = re.sub(r"^(?:₹|rs\.?|inr|ರೂ\.?)\s*", "", text)
        match = re.fullmatch(rf"({NUMBER})\s*({UNITS})", text, re.I)
        if not match:
            raise ValueError("Ambiguous numeric value")
        result = float(match[1].replace(",", ""))
        unit = match[2].strip()
        if re.fullmatch(r"lakhs?|lacs?|ಲಕ್ಷ(?:ಗಳು)?", unit):
            if field != "annual_income": raise ValueError("Income unit on another field")
            result *= 100_000
        elif re.fullmatch(r"crores?|ಕೋಟಿ", unit):
            if field != "annual_income": raise ValueError("Income unit on another field")
            result *= 10_000_000
        elif unit in {"%", "percent", "percentage", "ಶೇಕಡಾ"} and field != "percentage":
            raise ValueError("Percentage unit on another field")
        elif unit in {"year", "years", "ವರ್ಷ"} and field != "age":
            raise ValueError("Age unit on another field")
    else:
        raise ValueError("Invalid numeric value")
    maximum = {"percentage": 100, "age": 120, "annual_income": 1_000_000_000}.get(field, 1_000_000_000)
    if not math.isfinite(result) or not 0 <= result <= maximum:
        raise ValueError("Numeric value outside supported bounds")
    return result


def numeric_values(text: str, field: str) -> set[float]:
    values = set()
    for match in FRAGMENT.finditer(ascii_digits(text)):
        try:
            parsed = parse_number(match[0], field)
            if parsed is not None: values.add(parsed)
        except ValueError:
            continue
    return values
