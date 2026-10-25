# FormBridge AI

FormBridge AI is a multilingual scholarship-notice navigator powered by Google's Gemma 4.
It reads PDF documents and images using actual multimodal Gemma 4 inference.
It extracts deadlines, conditions, required documents, and actionable steps.
It provides English and Kannada guidance and optional, conservative eligibility comparisons.
Built by Avengineers for VVCE Hacktoberfest Track 1 — Best Use of Gemma 4.

## What is included

- React + TypeScript + Vite frontend, designed with deep navy and electric-cyan details.
- FastAPI backend making a **real hosted Gemma 4 request** to Google's Gemini API (`gemma-4-26b-a4b-it`).
- In-memory PDF-to-image conversion (up to 5 pages), JPEG/PNG validation, 8 MB upload limit.
- Document summaries in English/Kannada, source excerpts with page labels, deadlines, cautionary eligibility comparisons, requirements, steps, and checklist export.
- Two fictional sample notices (PDF and PNG) for a quick live demo. **These are not real scholarship offers.**
- Kiro specifications, backend tests, frontend tests, GitHub Actions, Render Blueprint, and checkpoint notes.

## Requirements

- Python **3.11+** and Node.js **20.19+ or 22+**
- A Google AI Studio API key with access to Gemma 4 via the Gemini API. See [Google's official Gemma docs](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api).
- Internet access for the hosted Gemma 4 model.

## Local quick start

**Terminal 1 — Backend**

```bash
cd backend
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell: .venv\\Scripts\\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
# Edit .env and replace GEMINI_API_KEY with your own key.
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open **http://localhost:5173**. The app automatically proxies `/api` to FastAPI on port 8000. `/api/health` reports if the server sees a configured key; the key itself is NEVER sent to the frontend.

> Windows users: Create `.env` with your editor or use `copy .env.example .env`. Use `\.venv\Scripts\Activate.ps1` as appropriate. Never check `.env` into Git.

### First live AI test

1. Open the app and confirm the bottom-right status displays **Gemma 4 ready**.
2. Click **Scholarship PDF** under sample notices (a fictional demo document).
3. Optionally set Karnataka, Undergraduate, income `250000` and marks `85`.
4. Click **Analyze with Gemma 4**. The backend converts each PDF page to an image and calls the configured model. The API key must have access and available quota.
5. View eligibility guidance and document checkbox list, switch to **ಕನ್ನಡ**, and download the checklist.
6. Compare each statement with the supplied sample PDF. Not every model response is guaranteed accurate; repeat tests for different notices.

No mock results are served in the live app. If the API key is absent or the provider fails, the app shows an error instead of inventing an analysis.

## API contract

**`GET /api/health`** → `{status, gemma_configured, model}`.

**`POST /api/analyze`** → `multipart/form-data`:
- `file`: PDF/JPG/PNG, up to 8 MB and 5 pages.
- `profile`: JSON string, e.g. `{"education_level":"Undergraduate","state":"Karnataka","category":"Not specified","annual_income":250000,"percentage":85}`.

Returns a structured response with `title`, `summary_en`, `summary_kn`, `deadline`, `criteria`, `documents`, `steps`, `warnings`, `unknowns`, `confidence`, `model_used`, `pages_analyzed`, `processing_seconds`, and `request_id`. See Pydantic models in [`backend/app/schemas.py`](backend/app/schemas.py). Interactive API docs: **http://localhost:8000/docs**.

## Run tests

```bash
cd backend
pip install -r requirements-dev.txt pytest-asyncio
PYTHONPATH=. pytest -q
```

```bash
cd frontend
npm install
npm run test
npm run build
```

Backend unit tests inject a fake HTTP transport only to assert that a correctly structured request would be sent to the real model. They do **not** claim to have contacted Google. Live API integration requires your API key. See [test coverage and limits](docs/testing.md).

## Deploy to Render

A [`render.yaml`](render.yaml) Blueprint is included. Deploy from the **VVCE organizer-assigned GitHub repository**, not a separate repository.

1. On Render, create a new **Blueprint** using that repository and approve the proposed Python web service and static site.
2. Set private backend `GEMINI_API_KEY` using Render's environment settings; never put it into source, static frontend variables or commits.
3. Set backend `FRONTEND_ORIGIN` to the actual frontend URL, e.g. `https://your-web.onrender.com`.
4. Set frontend **build-time** `VITE_API_BASE_URL` to the backend URL, e.g. `https://your-api.onrender.com` (without `/api` at the end).
5. Deploy/redeploy both services. Visit the frontend, check health and perform a genuine PDF analysis.

> Render service names and URLs are allocated by Render. The examples above are placeholders. `FRONTEND_ORIGIN` can also contain comma-separated allowed origins. Free tier spin-up, limits and credits depend on Render's current policy.

## Architecture and trade-offs

See [Kiro design spec](.kiro/specs/formbridge-ai/design.md) for the Mermaid flow. The original submitted architecture image is preserved under [`docs/original-submission-architecture.png`](docs/original-submission-architecture.png). The runtime implementation uses:

`React UI → FastAPI upload validation → PDFium/Pillow page rendering → server-side Gemini API: gemma-4-26b-a4b-it → Pydantic JSON validation → bilingual UI + checklist`

The hosted model is accessed through Google's officially documented **Gemini REST `generateContent` endpoint** with multimodal inline image parts and a server-only key. This is a genuine Gemma 4 integration; a separate Google GenAI SDK is not needed.

## Privacy, reliability & limitations

- **No persistence:** This MVP does not write uploaded document bytes or personal profile fields to disk/database. The results remain in browser state while the tab is open.
- **Provider transfer:** The uploaded pages and optional profile facts **are sent to Google's API for inference**. Check Google's terms and data-handling requirements before uploading sensitive student data.
- **Accuracy:** This is educational assistance, not a definitive eligibility determination. The model may hallucinate or mistranslate. Evidence and page labels are model-generated leads; check them against the original notice. Deadline is only populated when identifiable.
- **Input:** PDFs are rasterized into page images; 5 pages and 8 MB maximum; no handwriting guarantee. For production use add authentication, API rate limits, file malware scanning and usage budgets.
- **Availability:** A configured Google API key, network, model access and quota are required for analysis.

## Hackathon / Kiro workflow

Read [the Kiro requirements](.kiro/specs/formbridge-ai/requirements.md), [tasks](.kiro/specs/formbridge-ai/tasks.md), [checkpoints](docs/checkpoint-plan.md), and [daily progress log](docs/progress-log.md).

Keep the original FormBridge idea and Gemma 4 Challenge A. Use Kiro's free tier to review, test, and improve this code in the organizers' repository. Push **real updates every day**, not only an initial ZIP import. Show improvements and commit history at both checkpoints.

## Credits

Developed as an Avengineers hackathon prototype. Gemma is a Google model; this project is not an official scholarship provider or an official Google product. Licensed under MIT.

## Version 2: evidence-backed eligibility comparisons

Gemma 4 is asked to extract an **optional structured rule** per eligibility condition (numeric thresholds or exact categorical values). The backend `app/eligibility.py` then performs deterministic comparisons with the student profile, rather than trusting a model-generated eligibility verdict. Each criterion stays **Needs verification** if the document quote/page, supported rule, or student fact is missing. The overall result distinguishes **Appears to meet extracted rules**, **Possible mismatch**, and **Needs verification**. The label *never* certifies official eligibility because extraction may omit conditions and source excerpts are generated by the model, not independently OCR-verified.

Compatibility: existing Gemma outputs without a `rule` field still work; such conditions stay at Needs verification. New tests cover income thresholds, case-insensitive categories, missing student facts, missing evidence, and misleading model verdicts. To try the upgraded prompt, restart the backend after updating the source and analyze a sample notice again.

The frontend now displays the overall preliminary assessment at the top of the Eligibility tab. Check source quotations manually against the PDF or image before relying on them.
