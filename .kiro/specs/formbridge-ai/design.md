# Design — FormBridge AI

```mermaid
flowchart TD
  Student[Student / Avengineers demo] --> UI[React + TypeScript UI]
  UI -->|Multipart form: document + optional profile| API[FastAPI /api/analyze]
  API --> Validate[Magic-byte file validation & size/page limits]
  Validate --> Render[PDFium + Pillow: page images]
  Render --> Prompt[Guarded extraction prompt + student context]
  Prompt -->|Image and text parts, server-side API key| Gemma[Google Gemini API / Gemma 4 A4B]
  Gemma -->|JSON text| Schema[Pydantic validation and citation sanitization]
  Schema --> UI
  UI --> Output[English/Kannada results, evidence, checklist]
```

## API
- `GET /api/health`: whether backend and Gemma key are configured.
- `POST /api/analyze`: multipart `file` plus JSON `profile` string.
- `200`: structured `AnalysisResponse` and metadata; `4xx` for client errors; `429` on rate limits; `502/504` for provider failure.

## Data handling
- Model key resides on backend only, via environment variables.
- Avoid storage of uploaded documents or student input in this app.
- Uploaded data leaves the app when processed by Google's hosted model API; Google policy applies.
- Page evidence is model-suggested and must be verified by inspecting source file.

## Deliberate tradeoffs
- PDF pages are rendered to images, so no separate OCR engine is needed.
- No persistent document history, minimizing privacy risk for hackathon prototype.
- Exact application eligibility depends on official rules; guidance is conservative.
- The hosted model needs an internet connection and user-supplied Google AI Studio key.
