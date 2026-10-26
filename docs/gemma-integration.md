# Meaningful Gemma 4 Integration

## Model Integrity

The inherited Google REST integration and default `gemma-4-26b-a4b-it` are preserved. Google lists this identifier and multimodal image input in its [official Gemma on Gemini API guide](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api), checked during implementation on 2026-10-25. No OpenAI, Claude, Gemini Pro or other core/fallback model is introduced.

## Analysis

PDFium renders every accepted PDF page at scale up to 2.8, capped at 2400 pixels before encoding; the encoded image is bounded to 2200 pixels on its longest edge. Pillow validates/prepares JPG/PNG inputs. The extraction call sends explicitly numbered inline page images, reliable extracted text (up to 30,000 characters per page), and validated student facts. The original image remains authoritative. PDFs beyond the configured page limit are rejected, never silently truncated. The default is five pages.

The prompt treats document instructions as untrusted data, asks for literal original-language quotations/pages and complete bilingual fields, and prohibits invented facts, URLs, deadlines or official decisions. Narrow wrapper/field normalization precedes Pydantic validation. Unsupported optional rules become manual-review conditions rather than deleting the text. Empty/default/invalid/truncated outputs get one structured recovery request; persistent failure returns an error. Impossible page references are cleared but quotations retained. Only unique exact independent text matches can repair a page.

Missing/invalid English/Kannada dynamic text receives one separate translation call using the same configured real model. Only explicitly allowed text paths can change; rules, source quotations, outcomes and session metadata cannot. Script ratios and unchanged literal numeric tokens are checked. A targeted retry endpoint retains session/chat/profile/eligibility. These checks are not a semantic translation guarantee; failed fields remain visibly unavailable.

## Reasoning Assistant

`/api/chat` resolves an opaque token entirely on the server. Its context includes the same original rendered images (important for scans), bounded page text, analysis with independent verification statuses, the student facts and at most six preceding turns. The question and output language are validated. The real Gemma endpoint provides an answer, distinct general suggestions, missing information and proposed citations. The backend independently rechecks each quotation on its cited page and stores only the bounded conversation.

## What Gemma Does Not Do

Numeric comparisons, exact categorical comparisons, file validation, citation matching, session expiry, task checkbox storage, API backoff and viewer rendering are ordinary application code. The AI proposes the structured rule; code performs the comparison. A matched quote does not establish that the structured rule faithfully captures every condition. All outcomes remain provisional.

## API Failure Policy

Network/timeout errors and 500/502/503/504 may retry twice with exponential backoff and jitter. 429 retries only when Retry-After is parseable and at most 8 seconds; longer/absent guidance is returned to the user. Invalid credentials, permissions, inaccessible models and malformed requests do not retry. Response body diagnostics and credentials are never reflected or logged. Non-JSON/invalid-schema model responses produce visible errors; no synthetic success response hides failure.

The timeout is per network operation/attempt (40 seconds by default with a 10-second connect timeout), not a strict end-to-end deadline. Each logical request has at most three transport attempts. Analysis uses up to two extraction calls and one optional translation call: nine transport attempts at worst, potentially several minutes. Valid complete bilingual extraction uses just one call. A later explicit translation retry adds one logical translation request, not document reanalysis. The UI preserves input during failure.

## Verification Limits

Automated tests inject HTTP transports only inside tests. `backend/tests/e2e_server.py` is an explicit browser-test fixture, never a production entrypoint. No key was supplied for a live inference in the upgrade environment. Live semantic accuracy, provider availability/quota and four English/Kannada input/output combinations remain manual checks.
