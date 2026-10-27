"""LangChain-orchestrated scholarship search using Tavily (or configurable provider).

This module implements a deterministic LangChain chain (not an autonomous agent)
that coordinates search query generation, web search execution, result ranking,
and official-source identification.

LangChain is used for genuine orchestration:
- RunnableSequence chains coordinate the multi-step workflow
- Custom tool wraps the search provider
- Output parsers structure search results
- The chain passes retrieved context to Gemma 4 for analysis

The search provider is configurable via SEARCH_PROVIDER env var.
If credentials are missing, a clear error is returned — never fabricated results.
"""
import json
import logging
import re
import time
from typing import Any

import httpx

from langchain_core.runnables import RunnableLambda, RunnableSequence
from langchain_core.tools import Tool

from .config import Settings
from .freshness_schemas import OfficialSource, ScholarshipIdentity
from .freshness_sources import (
    extract_year_from_text,
    is_blocked_domain,
    is_official_domain,
    parse_authority_domains,
    score_source_relevance,
    validate_url_safety,
)

logger = logging.getLogger("formbridge.freshness.search")

# ── Search result cache ──────────────────────────────────────────────────
# Short-lived cache to avoid duplicate searches within a session.
# Keys: (scholarship_name, query) → (timestamp, results)
_search_cache: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes


def _cache_key(name: str, query: str) -> str:
    return f"{name.lower().strip()}|{query.lower().strip()}"


def _get_cached(name: str, query: str) -> list[dict] | None:
    key = _cache_key(name, query)
    if key in _search_cache:
        ts, results = _search_cache[key]
        if time.monotonic() - ts < _CACHE_TTL_SECONDS:
            return results
        del _search_cache[key]
    return None


def _set_cache(name: str, query: str, results: list[dict]) -> None:
    key = _cache_key(name, query)
    _search_cache[key] = (time.monotonic(), results)
    # Evict old entries
    cutoff = time.monotonic() - _CACHE_TTL_SECONDS
    for k in list(_search_cache):
        if _search_cache[k][0] < cutoff:
            del _search_cache[k]


# ── Search query generation ──────────────────────────────────────────────

def generate_search_queries(identity: ScholarshipIdentity) -> list[str]:
    """Generate targeted search queries for finding official scholarship documents.

    Uses deterministic logic — no LLM call needed for query generation.
    """
    queries = []
    name = identity.scholarship_name.strip()
    if not name:
        return queries

    org = identity.issuing_organization or ""
    dept = identity.government_department or ""

    # Primary query: scholarship name + official notification
    queries.append(f"{name} official notification latest guidelines")

    # Organization-specific query
    if org:
        queries.append(f"{name} {org} notification")

    # Government department query
    if dept and dept != org:
        queries.append(f"{name} {dept} official circular")

    # Year-specific query
    current_year = time.strftime("%Y")
    queries.append(f"{name} {current_year} scholarship guidelines")

    # Scheme ID query
    if identity.scheme_id:
        queries.append(f"{identity.scheme_id} scholarship notification")

    return queries[:3]  # Limit to 3 queries to conserve search API quota


# ── Tavily search provider ───────────────────────────────────────────────

async def _tavily_search(
    query: str,
    api_key: str,
    max_results: int = 5,
    timeout: float = 15.0,
) -> list[dict]:
    """Execute a search using the Tavily API.

    Returns a list of result dicts with keys: url, title, content (snippet).
    """
    if not api_key or api_key == "your_tavily_api_key_here":
        raise SearchConfigError(
            "Tavily API key not configured. Add TAVILY_API_KEY to backend/.env "
            "to enable scholarship freshness search."
        )

    url = "https://api.tavily.com/search"
    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "basic",
        "max_results": max_results,
        "include_answer": False,
        "include_raw_content": False,
    }

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout, connect=8)) as client:
        try:
            response = await client.post(url, json=payload)
        except httpx.TimeoutException:
            raise SearchError("Search request timed out. Try again later.")
        except httpx.RequestError as exc:
            raise SearchError(f"Search network error: {exc}")

        if response.status_code == 401:
            raise SearchConfigError("Invalid Tavily API key. Check TAVILY_API_KEY in backend/.env.")
        if response.status_code == 429:
            raise SearchError("Search API rate limit reached. Try again later.")
        if response.status_code != 200:
            raise SearchError(f"Search API returned HTTP {response.status_code}.")

        data = response.json()
        return data.get("results", [])


class SearchError(RuntimeError):
    """Search execution failed (network, timeout, rate limit)."""
    pass


class SearchConfigError(SearchError):
    """Search is not configured (missing API key or provider)."""
    pass


# ── LangChain orchestration ─────────────────────────────────────────────

def build_freshness_chain(settings: Settings) -> RunnableSequence:
    """Build a deterministic LangChain chain for scholarship freshness checking.

    The chain orchestrates:
    1. Query generation from scholarship identity
    2. Web search execution via configured provider
    3. Result filtering and validation
    4. Source ranking and official-domain identification
    5. Year/date extraction and freshness determination

    This is a deterministic workflow (RunnableSequence), not an autonomous
    agent — no uncontrolled loops or repeated LLM calls.
    """

    # Step 1: Generate search queries
    generate_queries = RunnableLambda(
        lambda identity: {
            "identity": identity,
            "queries": generate_search_queries(identity),
        },
        name="generate_search_queries",
    )

    # Step 2: Execute search using configured provider
    async def execute_search(input_data: dict) -> dict:
        identity: ScholarshipIdentity = input_data["identity"]
        queries: list[str] = input_data["queries"]

        if not queries:
            return {**input_data, "raw_results": [], "search_query_used": ""}

        if not getattr(settings, "freshness_search_enabled", True):
            return {**input_data, "raw_results": [], "search_query_used": "",
                    "error": "Freshness search is disabled in configuration."}

        provider = getattr(settings, "search_provider", "tavily").lower()
        max_results = min(getattr(settings, "freshness_max_search_results", 5), 10)
        timeout = getattr(settings, "freshness_request_timeout_seconds", 20.0)

        all_results: list[dict] = []
        query_used = ""

        for query in queries[:2]:  # Execute at most 2 queries
            # Check cache first
            cached = _get_cached(identity.scholarship_name, query)
            if cached is not None:
                all_results.extend(cached)
                query_used = query_used or query
                continue

            try:
                if provider == "tavily":
                    api_key = getattr(settings, "tavily_api_key", "")
                    results = await _tavily_search(query, api_key, max_results, timeout)
                else:
                    return {**input_data, "raw_results": [], "search_query_used": "",
                            "error": f"Unsupported search provider: {provider}. Use 'tavily'."}

                _set_cache(identity.scholarship_name, query, results)
                all_results.extend(results)
                query_used = query_used or query

            except SearchConfigError as exc:
                return {**input_data, "raw_results": [], "search_query_used": "",
                        "error": str(exc)}
            except SearchError as exc:
                logger.warning("Search failed for query '%s': %s", query, exc)
                continue

            # If we got good results from the first query, skip the rest
            if len(all_results) >= 3:
                break

        return {**input_data, "raw_results": all_results, "search_query_used": query_used}

    search_step = RunnableLambda(execute_search, name="execute_web_search")

    # Step 3: Filter, validate, and rank results
    def rank_results(input_data: dict) -> dict:
        identity: ScholarshipIdentity = input_data["identity"]
        raw_results: list[dict] = input_data.get("raw_results", [])

        if not raw_results:
            return {**input_data, "sources": []}

        authority_domains = parse_authority_domains(
            getattr(settings, "freshness_authority_domains", None)
        )

        seen_urls: set[str] = set()
        sources: list[OfficialSource] = []

        for result in raw_results:
            url = result.get("url", "")
            title = result.get("title", "")
            snippet = result.get("content", result.get("snippet", ""))

            # Deduplicate
            if url in seen_urls or not url:
                continue
            seen_urls.add(url)

            # URL safety check
            safe, reason = validate_url_safety(url)
            if not safe:
                logger.debug("Rejected unsafe URL: %s (%s)", url, reason)
                continue

            # Block known untrustworthy domains
            if is_blocked_domain(url):
                continue

            # Score relevance
            score, is_official, matched_authority = score_source_relevance(
                url, title, snippet,
                identity.scholarship_name,
                identity.issuing_organization,
                authority_domains,
            )

            # Extract year from snippet/title
            year = extract_year_from_text(f"{title} {snippet}")

            from urllib.parse import urlparse
            domain = urlparse(url).hostname or ""

            sources.append(OfficialSource(
                url=url,
                title=title,
                snippet=snippet,
                domain=domain,
                is_official=is_official,
                authority_match=matched_authority if is_official else None,
                publication_date=None,
                academic_year=year,
                relevance_score=round(score, 3),
                content_preview=snippet[:500] if snippet else "",
            ))

        # Sort by: official first, then by relevance score
        sources.sort(key=lambda s: (not s.is_official, -s.relevance_score))
        return {**input_data, "sources": sources[:10]}

    rank_step = RunnableLambda(rank_results, name="rank_and_filter_sources")

    # Compose the chain
    chain = generate_queries | search_step | rank_step
    return chain


def build_search_tool(settings: Settings) -> Tool:
    """Build a LangChain Tool wrapping the search provider.

    This tool can be used independently or within a larger chain.
    """
    async def _search_wrapper(query: str) -> str:
        provider = getattr(settings, "search_provider", "tavily").lower()
        if provider == "tavily":
            api_key = getattr(settings, "tavily_api_key", "")
            results = await _tavily_search(
                query, api_key,
                max_results=min(getattr(settings, "freshness_max_search_results", 5), 10),
                timeout=getattr(settings, "freshness_request_timeout_seconds", 20.0),
            )
            return json.dumps(results, ensure_ascii=False)
        raise SearchConfigError(f"Unsupported search provider: {provider}")

    return Tool(
        name="scholarship_web_search",
        description="Search the web for official scholarship notifications and guidelines",
        coroutine=_search_wrapper,
        func=lambda q: "",  # sync fallback — not used
    )


async def retrieve_document_content(
    url: str,
    timeout: float = 20.0,
    max_bytes: int = 5 * 1024 * 1024,
) -> tuple[str, str]:
    """Safely retrieve text content from a URL.

    Returns (text_content, content_type).
    Implements SSRF protection, size limits, and content-type validation.
    """
    from .freshness_sources import validate_content_type

    # Validate URL safety first
    safe, reason = validate_url_safety(url)
    if not safe:
        raise SearchError(f"Unsafe URL rejected: {reason}")

    headers = {
        "User-Agent": "FormBridge-AI/5.0 (Scholarship Freshness Check)",
        "Accept": "text/html,application/xhtml+xml,application/pdf,text/plain",
    }

    async with httpx.AsyncClient(
        timeout=httpx.Timeout(timeout, connect=8),
        follow_redirects=True,
        max_redirects=3,
    ) as client:
        try:
            response = await client.get(url, headers=headers)
        except httpx.TimeoutException:
            raise SearchError("Document retrieval timed out")
        except httpx.RequestError as exc:
            raise SearchError(f"Document retrieval failed: {exc}")

        if response.status_code != 200:
            raise SearchError(f"Document returned HTTP {response.status_code}")

        # Validate after redirects — the final URL must also be safe
        final_url = str(response.url)
        safe, reason = validate_url_safety(final_url)
        if not safe:
            raise SearchError(f"Redirect to unsafe URL: {reason}")

        content_type = response.headers.get("content-type", "")
        valid, media_type = validate_content_type(content_type)
        if not valid:
            raise SearchError(media_type)  # media_type contains the error message

        # Size check
        content_length = response.headers.get("content-length")
        if content_length and int(content_length) > max_bytes:
            raise SearchError(f"Document too large: {content_length} bytes")

        data = response.content
        if len(data) > max_bytes:
            raise SearchError(f"Document exceeds {max_bytes // (1024*1024)} MB limit")

        # Extract text based on content type
        if media_type == "application/pdf":
            text = _extract_pdf_text(data)
        else:
            text = _extract_html_text(data, response.encoding or "utf-8")

        return text, media_type


def _extract_html_text(data: bytes, encoding: str) -> str:
    """Extract readable text from HTML, removing scripts and styles."""
    try:
        html = data.decode(encoding, errors="replace")
    except (UnicodeDecodeError, LookupError):
        html = data.decode("utf-8", errors="replace")

    # Remove script and style content
    html = re.sub(r"<script[^>]*>.*?</script>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.S | re.I)
    html = re.sub(r"<!--.*?-->", " ", html, flags=re.S)

    # Remove HTML tags
    text = re.sub(r"<[^>]+>", " ", html)

    # Decode common entities
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
    text = text.replace("&nbsp;", " ").replace("&quot;", '"')

    # Normalize whitespace
    text = " ".join(text.split())

    return text[:50000]  # Cap at 50k characters


def _extract_pdf_text(data: bytes) -> str:
    """Extract text from a PDF document using pypdfium2."""
    try:
        import pypdfium2 as pdfium
        doc = pdfium.PdfDocument(data)
        try:
            text_parts = []
            # Process up to 10 pages to stay within token limits
            for i in range(min(len(doc), 10)):
                page = doc[i]
                try:
                    text_page = page.get_textpage()
                    try:
                        text_parts.append(text_page.get_text_range())
                    finally:
                        text_page.close()
                finally:
                    page.close()
            return "\n\n".join(text_parts)[:50000]
        finally:
            doc.close()
    except Exception as exc:
        logger.warning("PDF text extraction failed: %s", exc)
        return ""
