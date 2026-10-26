# FormBridge AI 5.0 - Ultimate UI Experience

FormBridge AI explains scholarship notices with Google's multimodal Gemma 4.
It reads PDF/JPG/PNG notices and produces English and Kannada guidance.
Students can inspect original pages, check citation verification, and compare extracted rules with their own facts.
A document-grounded assistant and application roadmap help students prepare their next steps.
Built by Avengineers for VVCE Hacktoberfest 2026, Track 1 - Challenge A: Best Use of Gemma 4.

## V5 Interface Upgrade (Ultimate UI Experience)

V5 elevates FormBridge AI into a world-class AI SaaS platform combining the precision of Linear, visual hierarchy of Stripe, and typography of modern AI copilots. Built on a premium design system centered on Midnight Navy (`#071426`), Deep Navy (`#0B1F3A`), and Electric Cyan (`#00D9F5`), V5 delivers:
- **Atmospheric Dark Hero Workspace**: Compelling hero banner with radial cyan ambient glow, prominent "Analyze Scholarship Document" primary CTA, and 5 capability highlight cards for document intelligence, evidence citations, bilingual assistance, interactive verification, and personalized guidance.
- **Header & Navigation Shell**: Fixed midnight navy sidebar with glowing active indicators, collapsible desktop navigation, mobile modal drawer, top navigation with dedicated Google Gemma 4 model pill indicator (`gemma-4-26b-a4b-it`), connection health badge, and instant language switch (EN/ಕನ್ನಡ).
- **Intake & Profile Workspace**: Drag-and-drop file intake with cyan glow hover states, file format badges, image thumbnail preview, replacement actions, grouped student profile fields (Academic Information, Financial & Category, Personal Details), and multi-stage loading feedback during analysis.
- **Split-Screen Evidence & Results Workspace**: PDF.js interactive viewer with zoom controls (50%–300%), page steppers, full-screen dialog expansion, and animated quote panels cross-referenced with exact document citations.
- **Conversational Assistant & Roadmap**: Dedicated Gemma 4 copilot message cards, prompt chips, real-time checklist progress, and local roadmap storage with export and print capabilities.

This describes the original V5 interface release. The functionality repair below updates extraction, validation, eligibility, translations and evidence without redesigning the interface. See [UI/UX design documentation](docs/premium-ui-v5.md) for the original design system.

## V5 Functionality Repair

- All accepted pages now reach Gemma as explicitly numbered higher-resolution images plus reliable page text. The default five-page limit rejects longer PDFs completely; no partial-document success is presented. Supplemental text is capped at 30,000 characters per page with an explicit marker; the complete image is still supplied.
- Wrapped/aliased model JSON is normalized narrowly. Empty/default/truncated results are errors, with at most one structured recovery request. Optional unsupported rules remain visible for manual review.
- Indian currency, lakh, percentage and Kannada-digit formats are parsed only when unambiguous. Python compares supported source-backed rules; ambiguous/compound/exclusion conditions and unverified scans require review.
- Missing/invalid dynamic English/Kannada fields receive one targeted real-model translation attempt. Invalid translations show an explicit unavailable message; Retry translation preserves the document, eligibility and chat without reanalysis. Literal numeric tokens are checked, but human semantic review is still necessary.
- Original quotations survive validation. Only a unique exact match in reliable page text can repair an incorrect/missing page. Scans remain textually unverifiable. Page navigation and quote display are retained without fabricated highlights.

See `FormBridge_AI_v5_Bug_Fix_Report.md` and `FormBridge_AI_v5_Regression_Checklist.md` for executed results, limitations and reproducible checks. Historical V3/V4 reports describe earlier releases, not this repair.

## Features

- Preserves the v2 React/FastAPI implementation, existing samples, navy/cyan identity, summaries, deadlines, profile, requirements and checklist.
- Page-specific PDF text extraction and independent citation verification: `verified`, `partial_match`, `unverified`, `not_available`.
- PDF.js evidence viewer with page navigation, zoom, fit width, expansion, and JPG/PNG support. Citation buttons in summaries, requirements, documents, dates, roadmap and chat open the original page and quotation.
- Deterministic numeric and exact categorical comparisons, including optional age and study mode. Unverified source quotes and missing student facts remain Needs verification. No prefilled student facts.
- Bounded, expiring document sessions for real Gemma 4 chat, server-held context/history, English/Kannada responses, clickable citations, reset and retry.
- Bilingual application roadmap with critical/important/optional priorities, tab-local checkbox progress, text download and printing. Checking a box does not submit an application.
- Bounded transient API retries, safe diagnostic logging and input-preserving error recovery. No production mock mode or model substitution.

## Prerequisites

- Python **3.12** (tested on 3.12; compatible source), Node **22.13+** (tested on Node 26.3), npm, and internet for package installation/model calls.
- A Google AI Studio key permitted to access `gemma-4-26b-a4b-it` with available quota. [Official Gemma API documentation](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api).
- Modern Chromium, Firefox or Safari; PDF.js browser support depends on the installed react-pdf version. Kannada fonts and a native-speaker review are recommended.

## Local Setup

From the extracted `FormBridge-AI` directory:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
# Set your GEMINI_API_KEY in .env, then:
uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open [localhost:5173](http://localhost:5173). Vite proxies `/api` to port 8000. Open [FastAPI docs](http://localhost:8000/docs) for validated schemas. Windows users can activate `.venv\Scripts\Activate.ps1` and create `.env` with an editor.

The production app shows an honest configuration/provider error until a valid key is supplied. The fictional sample notices are demonstration material, not scholarship offers.

## Configuration

Backend variables (see `backend/.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | placeholder | Server-only Google API credential |
| `GEMMA_MODEL` | `gemma-4-26b-a4b-it` | Core model for analysis and chat; no fallback |
| `FRONTEND_ORIGIN` | `http://localhost:5173` | Comma-separated exact CORS origins |
| `MAX_UPLOAD_MB` | 8 | Upload byte limit (UI also enforces 8 MB) |
| `MAX_PDF_PAGES` | 5 | PDF page limit |
| `GEMMA_TIMEOUT_SECONDS` | 40 | Per-attempt network timeout; connect timeout 10s |
| `GEMMA_MAX_RETRIES` | 2 | At most 3 transport attempts per logical model request |
| `SESSION_TTL_SECONDS` | 1200 | Absolute session lifetime, not sliding |
| `SESSION_MAX_COUNT` | 32 | Process-local context capacity; oldest evicted first |
| `SESSION_MAX_BYTES` | 67108864 | Accounted context budget, including history allowance |

Frontend `VITE_API_BASE_URL` is optional in development. For a separate production host, set it to the public backend origin, without `/api`. Never put credentials in any `VITE_*` variable.

## Architecture and API

Gemma 4 interprets numbered page images and reliable text, extracts bilingual scholarship facts and structured rules, and reasons conversationally over the same notice. Ordinary application code validates uploads/JSON, verifies quotations, compares rules, retains bounded contexts and renders the UI. See [architecture](docs/architecture.md) and [Gemma integration](docs/gemma-integration.md).

| Endpoint | Input | Behavior |
| --- | --- | --- |
| `GET /api/health` | none | Backend/configuration status, not a live model probe |
| `POST /api/analyze` | multipart `file`, JSON `profile` | Validated analysis, verified citations, roadmap, opaque `session_id` and TTL |
| `POST /api/chat` | JSON `session_id`, `question`, `language` (`en`/`kn`) | Genuine Gemma answer with independently checked citations |
| `POST /api/chat/reset` | JSON `session_id` | Clears that session's conversation history |
| `POST /api/analysis/translate` | JSON `session_id` | Repairs only missing/invalid dynamic translations, retaining context and chat; returns updated analysis and roadmap |
| `POST /api/session/delete` | JSON `session_id` | Releases context; UI invokes this on new analysis/reset/file replacement |

Chat questions are limited to 2,000 characters. Missing/expired/evicted contexts return 410; overlapping requests within one chat return 409. The session token is a bearer capability: anyone possessing it can use the context until deletion/expiry. It stays in frontend memory, never in a URL. No authentication is implemented.

## Testing

```bash
cd backend
python -m pytest -q
cd ../frontend
npm run test -- --run
npm run build
```

Optional repeatable browser validation (requires the backend `.venv` above):

```bash
cd frontend
npx playwright install chromium
npm run test:e2e
```

Browser tests own ports 18030 and 15173; these must be free. `tests.e2e_server:app` is **test-only** and uses `httpx.MockTransport`, never Google's real API. Production must start **`app.main:app`**. Browser tests exercise actual PDF.js rendering at desktop/laptop/tablet/mobile widths, uploads, citations, chat, Kannada UI, checklist download, errors, multipage navigation, keyboard focus, responsive navigation and print layout. See [testing details and live-language matrix](docs/testing.md). Mocked tests do not establish model accuracy.

For a genuine live-model smoke test, start the production backend with a valid private key, then run from `backend/`:

```bash
python scripts/live_smoke.py tests/fixtures/notice_A.pdf --percentage 65
python scripts/live_smoke.py tests/fixtures/notice_B.pdf --annual-income 180000
```

These commands make real, quota-consuming requests. The script prints analysis facts for your inspection and deletes its temporary session after success. Use non-sensitive notices and do not publish private output. A successful call does not establish model accuracy. Test all five fixtures and real consented notices using the regression checklist.

## Render Deployment

The existing `render.yaml` remains a Python web service plus static Vite site. It uses Python 3.12 and `uvicorn app.main:app`, not the test server. Set `GEMINI_API_KEY` privately, `FRONTEND_ORIGIN` to the exact static-site origin, and build-time `VITE_API_BASE_URL` to the backend origin. Use Node 22.13+; the Blueprint pins Node 22. Deploy the static `dist/` folder with SPA fallback to `index.html`. No paid database is required.

Use **one backend worker/instance** for this prototype: sessions are local to a process. Restarts, free-service sleep, rolling deploys or another worker lose context; students must analyze again. Multi-instance production requires a shared expiring store and access controls. No deployment or Git push is performed by this upgrade.

## Troubleshooting

- 500/502/503/504: provider transients retry twice with exponential backoff and jitter; use Retry after failure. Upload/profile remain selected.
- 429: without a short valid `Retry-After`, return immediately. A wait longer than 8 seconds is left to the user, avoiding repeated quota consumption.
- 401/403/404 or invalid requests: not automatically retried. Check server-side key/model permissions and configuration.
- Empty/default/malformed/truncated extraction: one structured recovery request, then a visible error. Valid complete extraction is not duplicated. Missing translations may add one separate targeted model call; a user-triggered translation retry never re-runs document analysis.
- Worst case: two logical extraction calls plus one translation call, each with up to three transport attempts (nine total). Timeouts are per attempt, not a total deadline; slow providers can take several minutes.
- 410 in chat: analyze the document again; the context expired or was evicted/restarted.
- Unverified citation: inspect the cited page; the quotation was not reliably located. Partial match never means verified.
- Text verification unavailable: images/scanned pages have no reliable text layer. Multimodal analysis still works, but automatic evidence verification does not.
- PDF viewer fails: use Open original, verify browser support, and ensure the bundled PDF.js worker is deployed. The worker is local, not fetched from a third-party CDN.
- CORS failures: confirm exact public frontend origin and rebuild the frontend after changing `VITE_API_BASE_URL`.

## Privacy and Limitations

Uploads are decoded/processed in memory; no upload files/database are created. After successful analysis, rendered page bytes, extracted text, profile, analysis and the last six conversation turns are retained in bounded server memory for a default 20 minutes. Expired entries are inaccessible immediately on access, removed by a 30-second sweep or another store operation, and cleared on shutdown. Capacity eviction can occur earlier; active requests can hold a reference until they finish. Session bytes are an accounting budget, not a strict Python RSS cap. Browser results disappear on reload; roadmap task IDs/checkboxes stay in `sessionStorage` until the tab closes. No full notice/profile is persisted in browser storage.

Pages/profile/chat are sent to Google's hosted API. Provider retention terms apply. This is not end-to-end encryption. Diagnostics log request ID, API status, retry count, category and duration, not keys, profiles or documents.

Verified means a sufficiently long normalized quotation occurs **on the cited page**; it does not validate the interpretation, threshold structure, document authenticity or extraction completeness. Fuzzy matches are partial only. No OCR or passage-coordinate extraction is implemented; citations navigate pages and show quotations separately, without fabricated highlights. Corrupt/absent text layers cannot be verified reliably. Dates and extracted names remain original when translation is unavailable.

No live Google API or native-speaker Kannada accuracy evaluation was possible during this upgrade because no runtime API key was supplied. Four input/output language combinations are listed in the manual test matrix. Before a public demo, perform them with real notices and a Kannada reviewer. Public hosting also needs authentication, rate limiting, usage budgets and abuse controls.

## Hackathon Materials

[V3 features](docs/features-v3.md), [checkpoint plan](docs/checkpoint-plan.md), [progress log](docs/progress-log.md), the original architecture image and `.kiro/` specifications are included. No commits, benchmarks or competition outcomes are fabricated. MIT license; Avengineers project, not an official scholarship provider or Google product.
