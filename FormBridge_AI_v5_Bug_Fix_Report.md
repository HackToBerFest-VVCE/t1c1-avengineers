# FormBridge AI V5: Functionality Repair Report

Date: 26 October 2026. Team: Avengineers, Akshay Naik and Mishal Fernandes.
Track 1: AI + Data Intelligence; Best Use of Google Gemma 4.

## 1. Scope and Verification Boundary

Repaired the supplied `FormBridge_AI_v5_Ultimate_UI_Experience.zip`, preserving its React/FastAPI architecture and V5 presentation. The configured model remains `gemma-4-26b-a4b-it` through Google's Gemini REST API. No alternate model, production mock mode, new dependency, Git push or deployment was introduced.

The two screenshots mentioned in the task were not present in the supplied attachments or ZIP. No original failing real notice, raw provider response or usable runtime API key was supplied. Therefore the specific historical model response cannot be reconstructed, and screenshot pixel-diff matching was unavailable. The root causes below are reproduced code defects and request omissions consistent with the reported symptoms, not a claim to have inspected the user's original live API incident.

All automated provider responses are controlled test fixtures. Actual PDF processing, outgoing request construction, parsing, schemas, verification, deterministic evaluation, API serialization and browser rendering are exercised. This proves repaired application behavior for the controlled cases, not live model accuracy.

## 2. Original Symptoms and Confirmed Root Causes

| Symptom | Reproduced cause in the supplied source | Repair |
| --- | --- | --- |
| Generic scholarship title, summary and zero criteria despite HTTP success | `{}` and a valid response under an `analysis` wrapper were accepted with Pydantic defaults; useful wrapped fields were ignored | Narrow wrapper/alias normalization; meaningful-content checks; empty/default responses fail visibly |
| Insufficient document understanding | Extracted PDF text existed but was not sent in the analysis request; individual images lacked explicit page labels; rendering was lower resolution | Every accepted page now carries its 1-based label, reliable text and higher-resolution original image |
| Incomplete structured output | The prompt first prohibited other keys and later asked for additional bilingual keys; truncation finish reasons were not checked | One complete schema, explicit bilingual/evidence instructions, MAX_TOKENS detection and one bounded structured recovery |
| Lost useful conditions | One malformed optional deterministic rule could invalidate the full response | Preserve the textual condition; clear unsafe rule and require manual review |
| Incorrect/absent comparisons | Formatted numeric strings such as `Rs. 2,50,000`, `2.5 lakh`, `75%` were not safely normalized; quoted thresholds/operators were not independently checked against the structured rule | Field-aware numeric parsing, quote threshold/operator checks and deterministic Python comparisons |
| Oversimplified eligibility | A bare education/category rule could ignore linked enrollment conditions, exceptions or exclusions | Complex/manual-review detection plus explicit extraction instructions; no unsupported final verdict |
| Kannada UI but English/missing document content | The UI language state already worked; dynamic fields were missing or English fallback was silent, with no model repair | Targeted real-model translation recovery and explicit unavailable states across dynamic fields |
| Missing/unusable source quotations | Invalid pages caused both page and quote to be removed; common nested source forms were not normalized | Preserve original quotation, normalize citation forms and only repair pages using a unique exact reliable-text match |

The shared empty-success path directly explains how an upload could complete, report a page count and low confidence, yet show generic content and zero eligibility counts. Upload transport alone was not the failure.

## 3. Repaired Pipeline

1. FastAPI validates the file and supplied student profile; content signatures, size limits and memory-only handling remain.
2. PDFium processes every page of an accepted PDF. Text extraction failure no longer discards a usable rendered image.
3. Rendering uses scale up to 2.8 and a 2400-pixel pre-encoding bound. Encoded images are capped at 2200 pixels, with higher JPEG quality when needed. No document is written by the production upload path.
4. Gemma receives all accepted images, explicit page boundaries and reliable extracted text. Supplemental text is capped at 30,000 characters per page and marked when capped; the full page image remains present.
5. The prompt requests supported title/provider, purpose, applicants, benefits, conditions, dates, required documents, procedure, restrictions, unknowns and literal evidence. Missing facts must remain missing, not invented.
6. Strict JSON decoding rejects truncated outer objects. Only named wrappers and narrow compatibility aliases are normalized; unknown schema shapes are not guessed.
7. Empty/default/malformed/truncated or visibly incomplete extraction gets at most one recovery request with the original document context. Persistent failure produces an error, not a generic successful analysis.
8. Missing/invalid dynamic translations get one separate real-model request. Only whitelisted text fields can change. Citation quotations, rules, statuses, profile and metadata cannot be overwritten by translation output.
9. Independent page-text verification assigns source statuses. The Python engine then recomputes all supported eligibility comparisons; model-provided verdicts never determine the returned result.
10. The API returns the existing analysis/session contract plus compatible fields. The UI selects English/Kannada content without uploading or analyzing again.

### Page and retry limits

The five-page default was deliberately retained. Longer PDFs are rejected before analysis with an explicit page-limit error; the app does not silently analyze only the beginning. `MAX_PDF_PAGES` remains configurable from 1 to 10, but raising it was not load-tested and is not recommended without measuring quota, payload and memory use.

Valid complete bilingual extraction uses one logical model request. At most two extraction requests and one translation request are made automatically. Each retains the existing maximum of three transport attempts: up to nine attempts in the worst combined case. Quota retries require short explicit Retry-After guidance; permanent authentication/model errors are not retried. Timeouts are per attempt, not a strict total deadline. Slow-provider requests can take several minutes.

## 4. Eligibility and Evidence Safety

- Safe numeric formats include Indian/western grouping, INR/Rs./rupee prefixes, lakh/lac/crore, percent/% and Kannada digits/units. Ambiguous ranges, approximate values, invalid grouping, booleans and nonfinite values are rejected rather than guessed.
- Academic 65 against a supported minimum 75 becomes a possible mismatch. Income 180000 against a supported maximum 250000 appears satisfied; 300000 becomes a mismatch.
- Missing profile facts, unsupported rules, linked recognized-institution enrollment, domicile versus mere residence, exclusions and conditional exceptions remain Needs verification. Textual criteria stay visible even without a machine-checkable rule.
- Existing fields/operators and preliminary-assessment disclaimers remain. A numeric rule must agree with quoted values and comparison wording; strict operators cannot reinterpret inclusive or negated wording.
- Verified means normalized source text matches on the cited page, not that the model's interpretation is complete or the notice authentic. Partial matches remain partial.
- A missing/incorrect page is repaired only when a sufficiently long quote has exactly one exact match across reliable page text. Ambiguous matches are not repaired; no page number is invented.
- Image-only/scanned notices can have a model-suggested source page, but their quotations remain Text verification unavailable and their criteria require manual verification.
- The existing PDF viewer, page/zoom controls and separate selected quotation panel remain. Precise bounding boxes are unavailable, so no fabricated passage highlight is added.
- Overall status retains the existing conservative precedence: any unresolved condition yields Needs verification, even when a separate criterion shows a possible mismatch.

## 5. Dynamic Language Repair

The repaired paths cover summaries, eligibility requirement names/explanations, required-document names, steps, roadmap content, warnings and missing-information messages. Both checklist and roadmap exports use the selected dynamic text. Original names, literal quotations and document dates are not fabricated or forcibly translated.

Backend language checks detect absent/wrong-script content and changed literal numeric tokens. One configured-model repair attempts to restore missing translations. These are heuristic checks, not proof of faithful translation: units, negation, date meaning and idiomatic Kannada still require human review. Unsupported or failed fields are emptied and visibly labeled unavailable, with original-language text clearly identified rather than silently masquerading as Kannada.

`POST /api/analysis/translate` repairs an existing session only. It shares the chat session lock, operates on a copy, and commits on success. Failed targeted recovery leaves the stored analysis unchanged. It does not reupload the notice, change eligibility results or clear chat. Frontend state merging is scoped to the same session. Ordinary language switching makes no analysis request.

## 6. Files Changed

| Files | Purpose |
| --- | --- |
| `backend/app/documents.py` | Readability, reliable-text guard, resilient extraction |
| `backend/app/gemma.py` | Full prompt/schema, numbered text+images, meaningful output checks, bounded recovery, truncation detection |
| `backend/app/model_output.py` (new) | Strict decoding and narrow response/citation normalization |
| `backend/app/numbers.py` (new) | Conservative formatted numeric parsing |
| `backend/app/schemas.py` | Numeric validators, non-deceptive defaults, retention of unsupported textual criteria |
| `backend/app/eligibility.py` | Source-backed deterministic comparison, linked/exception/exclusion safeguards |
| `backend/app/evidence.py`, `backend/app/chat.py` | Independent unique exact-page repair, including assistant citations |
| `backend/app/localization.py` (new) | Targeted real-model translation, allowed paths, language/numeric validation |
| `backend/app/main.py` | Session-preserving translation recovery endpoint |
| `frontend/src/App.tsx` | Dynamic text selection, targeted retry/error state, localized checklist content |
| `frontend/src/components/AnalysisOverview.tsx` | Selected-language summary, document and next-action text |
| `frontend/src/components/ApplicationRoadmap.tsx` | Selected-language task text/export |
| `frontend/src/components/ResultHeader.tsx` | Explicit localized missing-title/provider fallback |
| `frontend/src/lib/content.ts` (new), `api.ts`, `types.ts`, `i18n.ts` | Dynamic language helpers, recovery client, compatible manual-review field and labels |
| `backend/tests/test_gemma.py`, `test_repairs.py` (new), `test_fixture_pipeline.py` (new) | Parser, request, numeric, comparison, translation, evidence and API regression tests |
| `backend/tests/notice_fixtures.py`, `generate_notice_fixtures.py`, `fixtures/notice_A.pdf` through `notice_E.pdf` (new) | Controlled fictional English/Kannada/scanned notices and generation procedure |
| `backend/tests/e2e_server.py` | Test-only per-fixture mocked Google transport; production entrypoint unchanged |
| `frontend/src/test/repair.test.tsx` (new), `frontend/e2e/repair.spec.ts` (new) | Dynamic EN/KN state preservation and five-document browser matrix |
| `frontend/e2e/application.spec.ts`, `frontend/playwright.config.ts` | Existing checks retained; stable screenshots, bounded worker count and test timeout |
| `backend/scripts/live_smoke.py` (new) | Genuine production-API smoke procedure, no injected responses |
| `.gitignore` (new), `README.md`, `docs/testing.md`, `docs/gemma-integration.md` | Security exclusions, updated behavior and verification instructions |
| This report and `FormBridge_AI_v5_Regression_Checklist.md` | Delivery record and reproducible acceptance checklist |

## 7. Executed Tests

Environment: Python 3.12.15, Node 26.3.1, Chromium on macOS. Dependencies installed with the requested backend requirements and `npm ci`; no manifest/lockfile or dependency changes were needed. `npm ci` reported zero audit vulnerabilities at installation time.

| Verification | Baseline supplied V5 | Final repaired source |
| --- | --- | --- |
| Backend `python -m pytest -q` | 70 passed | 131 passed, 0 failed |
| Frontend `npm test` | 13 passed | 15 passed, 0 failed |
| `npm run build` | Passed | Passed, TypeScript + Vite |
| `npm run test:e2e` | 12 passed, 4 failed/timeouts | 36 passed, 0 failed, about 1.3 minutes |
| Live smoke script argument/help check | Not present | Passed |
| Genuine Google inference | Not performed | Pending valid API key |

The inherited Starlette TestClient/httpx deprecation warning remains (one backend warning); it is not a test failure. Browser logs also contain harmless NO_COLOR/FORCE_COLOR warnings. No dependency upgrade was made merely to remove warnings.

Baseline browser timeouts involved animated screenshots and the later Kannada roadmap step. The final suite retains those workflow assertions, disables animations only during screenshot capture and uses two workers with a 90-second test ceiling. Production animations/CSS are untouched. An intermediate new-test selector incorrectly requested "English" rather than the existing "EN" button; that test-only issue was fixed before the complete successful rerun. Test-fixture numeric labels and the missing-state fixture were also corrected to honor the real contracts.

### Five controlled documents

| Fixture | Real PDF processing / mocked model expectation | Result |
| --- | --- | --- |
| A: academic, two pages | Minimum 75 on page 2, student 65 | Mismatch, verified source page 2; missing marks separately tested as Needs verification |
| B: income, three pages | Maximum Rs. 2,50,000 on page 3 | 180000 satisfied, 300000 mismatch in API tests; verified page 3 |
| C: postgraduate restriction | PG-only condition, UG student | Mismatch with verified page 1 |
| D: Kannada notice, two pages | Kannada minimum-75 quotation on page 2, student 65 | Mismatch, Unicode quote verified, bilingual summaries retained |
| E: image-only scan | Visible minimum-75 condition, no text layer | Source page 1 retained, text unavailable, Needs verification rather than automatic mismatch |

Each fixture was also exercised in Chromium at 1440x1100, 1100x900, 820x1180 and 375x844: meaningful fixture title/summary, EN-KN-EN restoration, unchanged status, one analysis request, required documents, quoted source, correct PDF page and no horizontal overflow. Existing browser tests additionally check real canvas pixels, zoom/fit/next-page, English/Kannada chat, navigation, drawer/expanded-view focus, keyboard tabs, roadmap persistence/export, printing and provider-error input preservation. React unit tests separately confirm chat survives language switching and targeted translation recovery.

## 8. Visual, Archive and Security Checks

All 73 original source files are retained at their relative paths under `FormBridge-AI/`; none of the original components/features was deleted. Existing historical reports remain and should not be mistaken for this repair's results.

Twenty-one protected assets/configuration files were checked byte-for-byte against the input archive, including stylesheet, HTML/main entrypoint, PDF viewer, source tags/badges, chat component, eligibility summary, focus hook, demo assets, frontend manifests/lockfile, backend requirements, configuration/sessions/roadmap, both `.env.example` files and Render Blueprint.

The unchanged `frontend/src/styles.css` SHA-256 is `535fdafdf4f10f6544fbfdf5380511a868cf9d9977ef369683d88613cc36d044`.

Captured desktop/mobile result screenshots were visually inspected. Browser tests exercise the two other widths and overflow checks. This supports design preservation but is not a pixel comparison against unavailable user screenshots or an exhaustive visual certification of every state/browser.

Packaging checks require original-file completeness, protected-file identity, no credential-shaped Google keys or private-key headers, no forbidden generated/secret paths, unique archive members and a clean ZIP CRC test. The archive excludes real `.env` files, `.venv`, `node_modules`, `dist`, caches, test traces/results, build metadata and temporary files. `.env.example` placeholders and test-only noncredentials are intentionally included.

Backend-only authentication and bounded memory sessions remain. No uploaded document retention, database, frontend key or third-party telemetry was added. Pattern scanning is not a universal secret detector; the delivered configuration contains placeholders, not a supplied live credential.

## 9. Run Locally

Extract the ZIP and open its `FormBridge-AI` folder. Use Python 3.12 and Node 22.13+.

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
# Set GEMINI_API_KEY privately in backend/.env.
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```bash
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Health indicates configuration presence, not a successful Google inference. Without a valid key the production analyzer intentionally returns a configuration error, not fixture results. Keep the default five-page/8 MB limits for initial smoke tests.

For real, quota-consuming verification, from `backend/` while the production server runs:

```bash
python scripts/live_smoke.py tests/fixtures/notice_A.pdf --percentage 65
python scripts/live_smoke.py tests/fixtures/notice_B.pdf --annual-income 180000
python scripts/live_smoke.py tests/fixtures/notice_C.pdf --education-level Undergraduate
python scripts/live_smoke.py tests/fixtures/notice_D.pdf --percentage 65
python scripts/live_smoke.py tests/fixtures/notice_E.pdf --percentage 65
```

The script calls the production HTTP API, prints analysis facts for inspection and deletes its temporary session after success. Do not publish private output. Compare every fact, condition and quotation; a 200 response is not semantic proof. Also run the checklist with consented real notices and a Kannada reviewer. The script's help was tested; these five genuine Google calls were not run here.

## 10. Render Deployment and Remaining Limitations

The included `render.yaml` remains unchanged. No deployment has been attempted.

1. Use an authorized copy of the project in your own deployment repository; this repair did not modify the official hackathon repository.
2. Create a Render Blueprint from `render.yaml`. The API uses root `backend`, Python 3.12.8, `pip install -r requirements.txt`, and `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
3. Set private backend `GEMINI_API_KEY`; retain `GEMMA_MODEL=gemma-4-26b-a4b-it`. Set `FRONTEND_ORIGIN` to the exact deployed static-site origin.
4. The static site uses root `frontend`, Node 22, the existing build command and `dist` publish directory. Set build-time `VITE_API_BASE_URL` to the backend HTTPS origin without `/api`. Never place the API key in a VITE variable.
5. Keep SPA fallback to `/index.html`, one backend instance/worker, then check `/api/health`, CORS, a real analysis, citation navigation, both languages, chat and reset on the deployed URLs.
6. Restarts/sleep/rolling deploys discard process-local sessions; analyze again after context loss. Multi-instance use needs a shared expiring store and access controls, not implemented here.

Live extraction quality, model accessibility/quota, translation faithfulness and Render behavior remain unverified. No OCR, reliable passage coordinates, document-authenticity validation or guarantee of complete rule extraction is added. Language/text reliability checks are heuristic. Very dense pages, unusual encodings and complex eligibility must be inspected manually. Verified quotations do not certify that all exceptions were extracted. Public hosting still requires authentication, rate limiting, usage budgets and abuse controls. Chromium regression coverage is not a Safari/Firefox certification. The result remains preliminary guidance, never an official eligibility decision or scholarship application submission.
