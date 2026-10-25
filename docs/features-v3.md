# V3 Feature Status

| Area | Implemented behavior |
| --- | --- |
| Evidence | Page text extracted with existing PDFium library; exact/normalized, partial, unverified and unavailable statuses; model-supplied badges overwritten |
| Viewer | Original PDF/JPG/PNG, actual PDF.js rendering, multipage controls, numeric navigation, zoom, fit width, expansion and correct-page quotation panel |
| Citations | Clickable source buttons for summary, deadline, requirements, document checklist, roadmap and chat |
| Eligibility | Existing conservative engine extended with age/study mode and verified-evidence gate; summary counts, actual supplied value, extracted rule and bilingual explanation |
| Assistant | Genuine configured Gemma model, isolated expiring context, bounded history, image/text grounding, verified answer citations, bilingual requests, loading/error/retry and reset |
| Roadmap | Verification, missing info, documents, dates, notice steps and final review; priorities, completion, sessionStorage task IDs, UTF-8 checklist download and print |
| Language | Static EN/KN dictionaries for result controls, source statuses, profile labels, chat, roadmap and errors; model produces contextual bilingual fields |
| Reliability | Three total attempts maximum, transient classification, backoff/jitter, bounded 429 handling, credential-safe diagnostics |
| Security | Byte-decoded formats, upload/page/pixel limits, no document paths, server-only key, bearer contexts, bounded chat input, React text escaping |

## Deliberate Limits

- No OCR verification for scans/images and no bounding-box text highlighting. Evidence always has an original-page and separate quotation fallback.
- Rule semantics still come from Gemma; verified quotations do not prove a threshold was interpreted correctly. All decisions remain preliminary.
- No account login, distributed session store, public API rate limiting, application submission or provider lookup.
- Browser result state is not restored after a reload. Checkbox IDs are local to the browser tab; no claim of submission or uploaded documents.
- Contextual Kannada output depends on the model. Missing optional translated names/warnings fall back to source-language content; no live-language accuracy claim.
- Chat language selection affects new answers; earlier messages retain their selected language. It does not retranslate history using an extra call.
- Both English and Kannada summaries are generated in the same original analysis call. The interface switch does not call a translation service.
