"""Call the running production API with a real notice; never inject model responses."""
import argparse
import json
from pathlib import Path

import httpx


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("document", type=Path)
    parser.add_argument("--base-url", default="http://localhost:8000")
    parser.add_argument("--percentage", type=float)
    parser.add_argument("--annual-income", type=float)
    parser.add_argument("--education-level")
    args = parser.parse_args()
    profile = {name: value for name, value in {
        "percentage": args.percentage, "annual_income": args.annual_income,
        "education_level": args.education_level,
    }.items() if value is not None}
    if not args.document.is_file():
        parser.error("Document does not exist.")
    if args.document.stat().st_size > 8 * 1024 * 1024:
        parser.error("Use a document within the default 8 MB upload limit.")
    token = None
    try:
        with httpx.Client(base_url=args.base_url.rstrip("/"), timeout=480) as client:
            health = client.get("/api/health")
            health.raise_for_status()
            if not health.json().get("gemma_configured"):
                parser.exit(1, "Configure a valid backend-only GEMINI_API_KEY and start app.main:app first.\n")
            with args.document.open("rb") as document:
                response = client.post("/api/analyze", files={"file": (args.document.name, document)}, data={"profile": json.dumps(profile)})
            if response.status_code != 200:
                parser.exit(1, f"Analysis returned HTTP {response.status_code}. Check the app's safe error message; do not publish private notices.\n")
            result = response.json()
            token = result["session_id"]
            print(json.dumps({key: result[key] for key in (
                "title", "provider", "model_used", "pages_analyzed", "summary_en", "summary_kn",
                "eligibility_overall", "criteria", "summary_sources", "warnings", "unknowns",
            )}, ensure_ascii=False, indent=2))
            print("Live API completed. Compare every fact/quote and both languages with the original; HTTP success is not an accuracy certification.")
            client.post("/api/session/delete", json={"session_id": token}).raise_for_status()
            token = None
    except httpx.HTTPError:
        parser.exit(1, "API request failed. Verify the backend URL, API permissions and quota. Any remaining context expires under the normal session TTL.\n")


if __name__ == "__main__":
    main()
