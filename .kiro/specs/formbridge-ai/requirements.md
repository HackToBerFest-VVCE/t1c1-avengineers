# Requirements — FormBridge AI

## User story 1 — Multimodal document analysis
As a student, I can upload a real PDF, JPG or PNG scholarship notice so that I can understand the conditions without manually parsing long text.

Acceptance criteria:
- Backend checks actual file signatures rather than trusting extension or MIME supplied by browser.
- Uploads above 8 MB, unreadable files, and PDFs above five pages generate understandable 4xx errors.
- Real Gemma 4 interprets the uploaded pages; production returns no pre-baked or synthetic AI outputs.

## User story 2 — Actionable bilingual insight
As a student, I can read an English or Kannada explanation, see the deadline, and prepare a required-document checklist.

Acceptance criteria:
- Show summary in either language using fields returned by Gemma 4.
- Indicate missing deadlines, missing criteria, and unknown details without invented values.
- Support downloadable plain-text checklist and session-only document completion ticks.

## User story 3 — Conservative eligibility support
As a student, I can optionally provide education, domicile, category, income and marks to understand provisional eligibility comparisons.

Acceptance criteria:
- Missing student facts must result in needs_review status.
- The app never calls a student definitively eligible or ineligible.
- Each condition can show short model-suggested evidence and original page references.

## User story 4 — Honest demonstration
As a hackathon judge, I can see which model produced the output, review the source document and verify meaningful development progress.

Acceptance criteria:
- Results report model_used, pages_analyzed, duration, request_id.
- README describes local run, architecture, testing, and deployment.
- Team pushes genuine progress daily to the organizers' repo; checkpoint improvements tracked.
