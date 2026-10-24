# Verification status and test plan

## Tests implemented

Backend automated tests cover:
- Real PNG acceptance and invalid upload rejection.
- Rendering multiple PDF pages as images, and rejecting too many pages.
- Rejecting empty files and excessive file sizes.
- Student profile validation.
- Schema parsing and sanitization of impossible page citations.
- Building a real Gemma 4 REST request with inline image payloads using injected HTTP transport.
- Safe handling of missing credentials, provider rate limits and HTTP response fields.
- `POST /api/analyze` response contract with a test-only substituted service.

Frontend tests cover basic rendering, absent-key messaging, loading a fictional notice, the result view, and document checklist tab. These require npm dependencies and are not evidence of a real Google API call.

## Manual verification with a key (must perform before public demo)

1. Add `GEMINI_API_KEY` to `backend/.env`.
2. Start both servers and confirm `/api/health` returns `gemma_configured: true`.
3. Load the Riverbend **fictional** PDF and analyze it (actual Gemma 4 call).
4. Compare name, income threshold, minimum marks, deadline, and document requirements with the PDF.
5. Test Kannada output with a native speaker; test unknown data and malformed file cases.
6. Confirm Render frontend can call deployed backend and CORS works.
7. Re-run same notice at checkpoint 2 to demonstrate actual improvement.

The test suite's `httpx.MockTransport` verifies client payload construction without pretending to invoke the hosted service. Do not describe it as an end-to-end live model test.
