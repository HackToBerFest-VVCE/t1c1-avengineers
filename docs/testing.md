# Testing and Honest Verification

## V5 Functionality Regression Coverage

The new repair tests exercise wrapped/aliased/truncated/empty model output, all five page images and text reaching the provider request, formatted numeric parsing, deterministic academic/income/education comparisons, conservative linked/exclusion handling, targeted translation with number preservation, exact-page recovery, and session/chat preservation. `tests/fixtures/notice_A.pdf` through `notice_E.pdf` are explicitly fictional controlled notices: academic (page 2), income (page 3), postgraduate-only, Kannada (page 2), and image-only scan.

`test_fixture_pipeline.py` sends real PDF uploads through FastAPI, rendering, real request construction/parser/validation, independent evidence verification and deterministic comparisons. Only Google HTTP responses are mocked. Browser `repair.spec.ts` covers all five PDFs across four viewport sizes, English-Kannada-English document content, status counts, quotations and navigation to the original source page. Existing browser tests are retained. Screenshots disable animation only while capturing for stable test output; production CSS/animations are unchanged.

Run `python scripts/live_smoke.py --help` from `backend/` for the real-model procedure. Start **app.main:app**, not the fixture server. Supply a valid private backend key and follow the delivered regression checklist. The smoke procedure uses real HTTP/provider calls and cleans up the temporary session on success. It has not been run against Google in this delivery; no key was available.

## V4 UI Regression Coverage

The premium UI upgrade retains the original backend and its tests. Frontend checks now also cover all seven profile properties, replacement preview, arrow-key result tabs, assistant/roadmap navigation, drawer focus/closure, expanded-view focus/closure, image analysis, reduced motion, exported completion status and print visibility. Browser projects cover desktop (1440x1100), laptop (1100x900), tablet (820x1180) and mobile (375x844). See `docs/ui-ux-v4.md`; final executed results are in the V4 delivery report. The baseline and post-change results are distinguished there.

## Automated Commands

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt -r requirements-dev.txt
python -m pytest -q
cd ../frontend
npm ci
npm run test -- --run
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests start their own backend/frontend on ports 18030/15173 and exercise real HTTP, document processing, schema validation, deterministic comparison and PDF.js. They explicitly mock the Google HTTP transport in a separate test-only server; they do not contact Google. Never deploy `tests.e2e_server:app`. Production uses `app.main:app`.

## Coverage

Backend tests cover inherited behavior plus exact/normalized quotes, partial matches, incorrect pages, fabricated quotes, empty/scan text layers, Kannada Unicode normalization, malformed citation structures, page text extraction, safe errors, API contract, age/missing facts, NaN rejection, transient retry bounds, permanent errors, Retry-After, timeouts, safe logs, isolated/expired/evicted contexts, grounded chat request construction, bilingual requested output, reset/deletion and roadmap generation.

Frontend unit tests cover upload/sample handling, loading/failure/retry states and preserved profile, static-language switching without extra calls, summary counts, clickable sources, page navigation/zoom using a PDF component mock, chat input/errors/retry/reset and task persistence. Browser tests separately validate actual PDF.js canvas pixels and navigation with an actual two-page PDF, source selection, English/Kannada chat, roadmap toggles, download, mobile overflow and error recovery. Unit-test mocks do not establish real renderer behavior.

## Manual Live API / Language Matrix

No runtime key was available for this upgrade. Do not claim model extraction/translation accuracy from fixture tests.

| Input notice | Output | Required live checks | Status |
| --- | --- | --- | --- |
| English | English | Provider, title, exact threshold, date, citations, chat uncertainty | Pending valid key |
| English | Kannada | Same facts; native speaker checks explanation and warnings | Pending valid key/reviewer |
| Kannada | English | Unicode/scan input, correct interpretation, no invented conditions | Pending valid key/reviewer |
| Kannada | Kannada | Same facts, idiomatic Kannada, missing-information guidance | Pending valid key/reviewer |

For each combination: use a consented non-sensitive notice with known ground truth, record actual model output privately, compare every extracted requirement and date, check source badges, ask an unsupported question, and verify that the assistant admits uncertainty. Include image-only and text-layer PDFs. A text layer with broken Kannada glyph encoding must not be treated as reliable OCR.

## Demo Acceptance

1. Start `app.main:app` with a valid private key and the Vite frontend.
2. Upload the provided fictional notice; enter explicit student facts.
3. Analyze, review all outcomes and compare quotes with the original.
4. Click each kind of source button; verify correct page and separate quotation.
5. Ask a relevant question, check the response/citations, switch output language, ask again.
6. Review roadmap, toggle tasks, navigate away/back, download and print.
7. Verify missing deadline language, no fabricated official URLs, unsupported rules, missing age/mode and a scanned-page limitation.
8. Test provider failure/retry, expired context and a deployed Render origin/CORS.

Actual executed results are recorded in the delivered implementation report. Chromium automation is not a Safari/Firefox compatibility certification. Public deployment and live Google behavior are separate validation steps.
