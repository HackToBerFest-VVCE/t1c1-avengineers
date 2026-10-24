# Avengineers checkpoint presentation plan

## Before arrival (three-day build window)
Day 1 — run the multimodal Gemma backend and verify one sample notice. Push to organizers' repository.
Day 2 — integrate eligibility summary, bilingual output, checklist and source excerpts. Push tested changes.
Day 3 — perform real-document validation, improve UI, document errors and verify deployment. Push tested release.

## Checkpoint 1 (suggested 90-second flow)
1. State the application-access problem in one sentence.
2. Show an unedited PDF and explain why it's difficult to interpret.
3. Upload it and show that the backend sends real page images to Gemma 4.
4. Open the result; show extracted deadline, evidence, Kannada explanation, and checklist.
5. Mention evidence verification, and acknowledge known limitations.

## Between checkpoints
Write down judge feedback verbatim, prioritize an improvement that can be demonstrated safely in the event time, implement and test it, and commit it in the provided repository.

## Checkpoint 2
Compare checkpoint-1 behavior to current behavior using the same input file; show tests, GitHub commit(s), and the before/after result.

## Judge Q&A — honest answers
Q: Why Gemma 4? A: Its multimodal image+text capabilities are the core extraction/understanding engine, not a decorative chatbot.
Q: Do you guarantee eligibility? A: No. We display tentative comparisons and require students to verify official criteria.
Q: How do you handle hallucinations? A: Narrow extraction prompt, Pydantic validation, missing-value handling, citation sanitization, and explicit source verification.
Q: How is user data handled? A: No application database or upload history. Pages and user-provided facts are sent to Google's hosted model API for inference; do not upload highly sensitive documents without assessing the provider policy.
Q: What changed during the event? A: Show actual issue, commit diff, test, and improved output—not a rehearsed claim.
