# FormBridge AI V5: Reproducible Regression Checklist

Date: 26 October 2026. Read the accompanying Bug Fix Report for executed results and limitations.

Legend: checked items below were executed through controlled automated tests or archive/source inspection. Unchecked live/deployment items remain pending. Automated Google responses are mocked only in tests; production uses the configured real model.

## 1. Automated Setup and Commands

From the extracted `FormBridge-AI` directory:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -q
cd ../frontend
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

- [x] Backend: 131 passing, zero failing; one inherited TestClient/httpx deprecation warning.
- [x] Frontend: 15 passing, zero failing.
- [x] TypeScript and Vite production build succeed.
- [x] Chromium: 36 passing, zero failing across desktop 1440x1100, laptop 1100x900, tablet 820x1180 and mobile 375x844.
- [x] Test servers own ports 18030/15173 and use only `tests.e2e_server:app`. Keep those ports free when rerunning.
- [x] Production deployment points to `app.main:app`, never the fixture server.

## 2. Structured Extraction and Failure States

- [x] Upload real controlled PDFs through FastAPI, render pages and build actual Gemma requests.
- [x] Send all five accepted page images and numbered reliable text, not only the first page.
- [x] Reject PDFs over the configured page limit rather than returning partial success.
- [x] Preserve supported title, summaries, criteria, required documents, evidence and session through serialization.
- [x] Parse the narrow supported wrappers/aliases and nested citation forms.
- [x] Reject `{}`, default-only content, malformed/truncated JSON and unsupported response shapes.
- [x] Detect MAX_TOKENS and bound structured recovery to one retry.
- [x] Do not duplicate a valid complete bilingual extraction call.
- [x] Retain a textual condition when its optional deterministic rule is unsafe.
- [x] Test transient/permanent provider errors, short/long Retry-After, timeout and safe logs.
- [x] Provider failure keeps the user's file/profile selected and exposes retry.

## 3. Controlled Documents A-E

Fixtures live in `backend/tests/fixtures/`. They are fictional test notices, not scholarship offers. Backend integration tests mock the Google transport while using real document processing. Browser tests upload the same PDFs to the fixture server and use real PDF.js.

| Document | Student facts | Required deterministic/evidence result |
| --- | --- | --- |
| `notice_A.pdf`: minimum 75%, page 2 | Marks 65 | Possible mismatch; source verified on page 2 |
| A again | No marks supplied | Needs verification; condition remains visible |
| `notice_B.pdf`: maximum Rs. 2,50,000, page 3 | Income 180000 | Appears satisfied; source verified on page 3 |
| B again | Income 300000 | Possible mismatch |
| `notice_C.pdf`: postgraduate only | Undergraduate | Possible mismatch; verified page 1 |
| `notice_D.pdf`: Kannada minimum 75%, page 2 | Marks 65 | Possible mismatch; exact Kannada quotation verified on page 2 |
| `notice_E.pdf`: image-only academic scan | Marks 65 | Needs verification; page 1 identified, text verification unavailable |

- [x] A-E API fixture outcomes match this table.
- [x] A-E browser cases show the fixture title, meaningful summary and required document.
- [x] A-E switch EN -> Kannada -> EN with exact original English restored, unchanged criterion status and only one analysis request.
- [x] A-E citation click selects the correct original page and retains the original-language quotation.
- [x] Scan E is not represented as textually verified or automatically satisfied/mismatched.

## 4. Deterministic Eligibility

- [x] Compare numeric values only after safe parsing: rupee/Rs./INR, Indian commas, lakh, percentage, Kannada digits/units.
- [x] Reject ambiguous ranges, approximation, malformed grouping, NaN and booleans.
- [x] Academic minimum 75 versus 65 produces a mismatch.
- [x] Income maximum 250000 versus 180000/300000 produces satisfied/mismatch.
- [x] Missing student facts produce Needs verification, not a guessed answer.
- [x] Postgraduate restriction versus undergraduate produces a mismatch.
- [x] Karnataka residence matches Karnataka, mismatches Kerala and requires review when absent.
- [x] Domicile is not inferred from residence alone.
- [x] Category and study-mode comparisons retain supported exact aliases and evidence checks.
- [x] Existing strict/inclusive/equality operators remain supported; negated/inclusive text cannot be reinterpreted as a strict comparison.
- [x] Wrong quoted threshold/direction cannot produce an automatic outcome.
- [x] Compound recognized-institution conditions, exceptions and category exclusions stay visible as Needs verification.
- [x] Mixed/unknown conditions preserve conservative overall status and preliminary disclaimer.

## 5. Dynamic English/Kannada Content

- [x] English summary and Kannada summary render from dynamic response fields, not static UI labels.
- [x] Requirement names, deterministic explanations, document names, step/roadmap content, warnings and unknowns select the current language.
- [x] Switch back to English and restore original English content without reanalysis.
- [x] Retain uploaded file, selected source page, profile, status and chat when switching languages.
- [x] Missing Kannada shows an explicit unavailable label, not unrelated or silently substituted content.
- [x] The backend makes one targeted real-model translation request when needed (transport mocked in tests).
- [x] Reject translated numeric changes and unauthorized translation paths affecting rules/title/citations.
- [x] Translation provider failure keeps valid extraction data.
- [x] Retry translation updates only the same session; no document reupload/reanalysis or chat reset.
- [x] Checklist/roadmap export selects the active dynamic language; browser verifies roadmap completion export.
- [ ] Have a fluent Kannada reviewer check actual model translations, units, dates, negation, exceptions and tone.

## 6. Evidence and Viewer

- [x] Preserve original quotation and valid 1-based page through validation/API/UI.
- [x] Verify exact normalized text independently; never trust a model-provided verification label.
- [x] Keep partial matches partial and fabricated/unlocated quotes unverified.
- [x] Repair a missing/wrong page only with a unique exact reliable-text match.
- [x] Do not repair ambiguous repeated quotations or fabricate scan text/coordinates.
- [x] Retain quotation even when an invalid model page is removed.
- [x] Citation click keeps results visible, selects the source quote and navigates the original PDF.
- [x] Sources remain available when switching language; quote wording remains original.
- [x] Test PDF next/previous page, typed page field, zoom, fit-width, expanded dialog, open-original fallback and rendered nonblank canvas pixels.
- [x] Image upload and scan verification-unavailable states remain functional.
- [ ] Confirm live citations against every original notice page; verified text does not certify correct interpretation or completeness.

## 7. Existing UI/Workflow Preservation

- [x] Preserve every original component and source file; no feature deletion.
- [x] Check byte-identical V5 stylesheet, HTML/main entrypoint, viewer, source tags/badges, chat component, eligibility counts and focus helper.
- [x] Preserve dependencies/lockfile, demo assets, environment templates, session/config/roadmap core and Render Blueprint.
- [x] Inspect desktop/mobile captured results; check no horizontal overflow at all four browser widths.
- [x] Sidebar/dashboard/analyzer/results/assistant/roadmap navigation works.
- [x] Mobile drawer and expanded viewer trap focus, close with Escape and restore focus.
- [x] Keyboard result tabs, reduced-motion behavior, print layout and error retry work.
- [x] English/Kannada chat responses, citations and history remain functional in mocked integration.
- [x] Roadmap checkboxes persist across tabs; download includes completion state.
- [x] Production CSS/animations are unchanged; only test screenshots temporarily disable animation during capture.
- [ ] Compare with the two original incident screenshots if supplied later; they were unavailable for this repair.
- [ ] Run manual Safari/Firefox and assistive-technology checks before claiming cross-browser/accessibility certification.

## 8. Genuine Live-Model Procedure: Pending

Use a valid private API key in `backend/.env`, start `uvicorn app.main:app --port 8000` and run the regular Vite frontend. Do not start `tests.e2e_server:app` for live verification. Google requests consume real quota. Use only consented, non-sensitive notices.

```bash
cd backend
python scripts/live_smoke.py --help
python scripts/live_smoke.py tests/fixtures/notice_A.pdf --percentage 65
python scripts/live_smoke.py tests/fixtures/notice_B.pdf --annual-income 180000
python scripts/live_smoke.py tests/fixtures/notice_C.pdf --education-level Undergraduate
python scripts/live_smoke.py tests/fixtures/notice_D.pdf --percentage 65
python scripts/live_smoke.py tests/fixtures/notice_E.pdf --percentage 65
```

- [x] Smoke script argument/help entrypoint works.
- [ ] Execute the five real-Google commands. Verify the configured model and actual outputs; do not mark success from HTTP status alone.
- [ ] Repeat with real English and Kannada notices with known ground truth, including a readable scan.
- [ ] Check supported title/provider/purpose/benefits/conditions/deadline/documents/procedure; missing facts must be explicitly missing.
- [ ] Verify English -> English, English -> Kannada, Kannada -> English and Kannada -> Kannada consistency with a fluent reviewer.
- [ ] In the browser, switch EN -> KN -> EN; count no new `/api/analyze`, retain file/status/session/chat and click source citations in both languages.
- [ ] Exercise a missing translation and targeted retry with the actual provider, then verify rules/quotations/status are unchanged.
- [ ] Ask the assistant an unsupported question; it should acknowledge uncertainty and not invent a portal, amount or deadline.
- [ ] Record real latency, quota and failures privately. Do not publish API keys, bearer session tokens or sensitive notice/profile output.

No runtime API key was available here, so none of the unchecked live steps is claimed as completed.

## 9. Packaging, Privacy and Deployment

- [x] Preserve backend-only model authentication and bounded temporary memory sessions.
- [x] Add `.gitignore` covering real `.env`, dependencies, builds, caches, test output and key files.
- [x] Deliver full source, original UI components, tests/fixtures, README, Render config and `.env.example` files.
- [x] Exclude real `.env`, keys, `.venv`, `node_modules`, `dist`, cache files, traces and temporary artifacts from ZIP.
- [x] Validate all 73 original file paths, 21 protected file identities, credential patterns and ZIP CRC.
- [x] No Git push or automatic deployment performed.
- [ ] Deploy an authorized project copy through the unchanged Render Blueprint, with private backend key and correct frontend/backend origins.
- [ ] Use one backend instance/worker; confirm health, CORS, real analysis, bilingual content, citations, chat and reset on deployed URLs.
- [ ] Verify context expiry/restart behavior; add authentication, rate limits, usage budgets and abuse controls before public hosting.

## Acceptance Record

Automated repair checks pass with mocked Google responses and real application processing. Live semantic accuracy, Kannada quality, original screenshot matching and Render deployment remain pending. Do not replace those pending items with an unconditional production-readiness claim.
