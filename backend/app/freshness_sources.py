"""Source validation, URL safety checks, and official domain verification.

Implements SSRF protection, domain allowlisting, and content-type validation
for safe retrieval of official scholarship documents.
"""
import ipaddress
import logging
import re
from urllib.parse import urlparse

logger = logging.getLogger("formbridge.freshness.sources")

# ── Official domain patterns ─────────────────────────────────────────────
# Authoritative government and institution domains.
# A .gov.in domain is a useful signal but not proof of authenticity.
# These are configurable starting points; the issuing-authority domain
# should also be added dynamically when identified.

DEFAULT_AUTHORITY_DOMAINS: list[str] = [
    # Indian government
    ".gov.in",
    ".nic.in",
    ".india.gov.in",
    # National Scholarship Portal
    "scholarships.gov.in",
    "nsp.gov.in",
    # UGC
    "ugc.gov.in",
    "ugc.ac.in",
    # State portals
    "dhe.karnataka.gov.in",
    "sw.kar.nic.in",
    "mahadbt.maharashtra.gov.in",
    "dce.karnataka.gov.in",
    # Higher education
    "aicte-india.org",
    "mhrd.gov.in",
    "education.gov.in",
    # Ishan Uday specific
    "antodaya.ugc.ac.in",
]

# Domains to reject outright (scholarship aggregator blogs, spam, etc.)
BLOCKED_DOMAINS: list[str] = [
    "scholarshiptrack.in",
    "buddy4study.com",
    "scholarships360.info",
    "getmyuni.com",
    "collegedunia.com",
    "shiksha.com",
    "careers360.com",
    "gradeup.co",
    "embibe.com",
    "toppr.com",
]

# Maximum content size for downloaded documents (5 MB)
MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024

# Allowed content types for retrieved documents
ALLOWED_CONTENT_TYPES = {
    "text/html",
    "application/xhtml+xml",
    "application/pdf",
    "text/plain",
}


def parse_authority_domains(extra_domains: str | None = None) -> list[str]:
    """Merge default authority domains with user-configured extras."""
    domains = list(DEFAULT_AUTHORITY_DOMAINS)
    if extra_domains:
        for d in extra_domains.split(","):
            d = d.strip().lower()
            if d and d not in domains:
                domains.append(d)
    return domains


def is_official_domain(url: str, authority_domains: list[str] | None = None) -> tuple[bool, str]:
    """Check whether a URL belongs to a known official domain.

    Returns (is_official, matched_domain_or_empty_string).
    """
    domains = authority_domains or DEFAULT_AUTHORITY_DOMAINS
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower().strip(".")
    except Exception:
        return False, ""

    if not host:
        return False, ""

    for domain in domains:
        domain = domain.lower().strip(".")
        if domain.startswith("."):
            # Suffix match (e.g. ".gov.in" matches "scholarships.gov.in")
            if host.endswith(domain) or host == domain.lstrip("."):
                return True, domain
        else:
            # Exact or subdomain match
            if host == domain or host.endswith("." + domain):
                return True, domain

    return False, ""


def is_blocked_domain(url: str) -> bool:
    """Check whether a URL belongs to a blocked domain."""
    try:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower().strip(".")
    except Exception:
        return True

    for blocked in BLOCKED_DOMAINS:
        blocked = blocked.lower().strip(".")
        if host == blocked or host.endswith("." + blocked):
            return True
    return False


def validate_url_safety(url: str) -> tuple[bool, str]:
    """Validate a URL for SSRF protection and general safety.

    Returns (is_safe, reason_if_unsafe).
    """
    try:
        parsed = urlparse(url)
    except Exception:
        return False, "Invalid URL format"

    # Must be HTTP(S)
    if parsed.scheme not in ("http", "https"):
        return False, f"Unsupported URL scheme: {parsed.scheme}"

    # Must have a hostname
    hostname = parsed.hostname
    if not hostname:
        return False, "Missing hostname"

    # Block private/reserved IP ranges (SSRF protection)
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_reserved or ip.is_link_local:
            return False, "Private or reserved IP address"
    except ValueError:
        # Not an IP literal — check for localhost-like hostnames
        if hostname.lower() in ("localhost", "127.0.0.1", "::1", "0.0.0.0"):
            return False, "Localhost URL"

    # Block URLs with credentials
    if parsed.username or parsed.password:
        return False, "URL contains embedded credentials"

    # Block non-standard ports commonly used for internal services
    port = parsed.port
    if port is not None and port not in (80, 443, 8080, 8443):
        return False, f"Non-standard port: {port}"

    # Block very long URLs
    if len(url) > 2000:
        return False, "URL too long"

    # Block data: and javascript: URIs that might sneak through
    if parsed.scheme.lower() in ("data", "javascript", "file", "ftp"):
        return False, f"Blocked scheme: {parsed.scheme}"

    return True, ""


def validate_content_type(content_type: str | None) -> tuple[bool, str]:
    """Validate the content type of a retrieved document."""
    if not content_type:
        return False, "Missing Content-Type header"

    # Extract the media type (ignore parameters like charset)
    media_type = content_type.split(";")[0].strip().lower()

    if media_type in ALLOWED_CONTENT_TYPES:
        return True, media_type

    return False, f"Unsupported content type: {media_type}"


def score_source_relevance(
    url: str,
    title: str,
    snippet: str,
    scholarship_name: str,
    issuing_org: str | None,
    authority_domains: list[str] | None = None,
) -> tuple[float, bool, str]:
    """Score a search result's relevance to the scholarship.

    Returns (score 0.0-1.0, is_official, matched_authority).
    """
    score = 0.0
    text = f"{title} {snippet}".lower()
    name_lower = scholarship_name.lower()

    # Check official domain
    is_official, matched = is_official_domain(url, authority_domains)
    if is_official:
        score += 0.35

    # Check if blocked
    if is_blocked_domain(url):
        return 0.0, False, ""

    # Name match (check significant words)
    name_words = [w for w in name_lower.split() if len(w) > 2 and w not in {
        "the", "and", "for", "scheme", "scholarship", "programme", "program",
    }]
    if name_words:
        matched_words = sum(1 for w in name_words if w in text)
        name_ratio = matched_words / len(name_words)
        score += 0.3 * name_ratio

    # Issuing organization match
    if issuing_org:
        org_lower = issuing_org.lower()
        org_words = [w for w in org_lower.split() if len(w) > 2]
        if org_words:
            org_matched = sum(1 for w in org_words if w in text)
            score += 0.15 * (org_matched / len(org_words))

    # Notification/guideline signals
    notification_signals = [
        "notification", "guidelines", "circular", "office memorandum",
        "official", "revised", "updated", "amendment", "gazette",
        "order", "scheme details",
    ]
    if any(signal in text for signal in notification_signals):
        score += 0.1

    # Year/date signals
    if re.search(r"20\d{2}[\s-]+20\d{2}|20\d{2}", text):
        score += 0.05

    # PDF link bonus
    if url.lower().endswith(".pdf"):
        score += 0.05

    return min(1.0, score), is_official, matched


def extract_year_from_text(text: str) -> str | None:
    """Extract the most recent academic year or year from text."""
    # Try academic year pattern first (e.g., "2024-25", "2024-2025")
    academic = re.findall(r"(20\d{2})\s*[-–]\s*(?:20)?(\d{2})", text)
    if academic:
        years = [(int(y1), int(y2) if len(y2) == 4 else int(f"20{y2}"))
                 for y1, y2 in academic]
        latest = max(years, key=lambda x: x[0])
        return f"{latest[0]}-{latest[1] % 100:02d}"

    # Try standalone years
    standalone = re.findall(r"20\d{2}", text)
    if standalone:
        return max(standalone, key=int)

    return None
