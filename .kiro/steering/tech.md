# FormBridge AI — Technical steering

- UI: React 19, TypeScript, Vite, CSS, lucide-react.
- API: FastAPI, Pydantic, httpx, pypdfium2, Pillow.
- Model: `gemma-4-26b-a4b-it`, hosted via Google Gemini API generateContent REST endpoint.
- Model access is server-side with `GEMINI_API_KEY`; do not leak the key to frontend.
- Support PDF (5 pages max), JPEG, PNG (8 MB max); render PDF pages into images.
- Fail visibly on missing credentials, rate limits, malformed uploads, invalid model responses.
- Validate model output with Pydantic and label source excerpts as model-suggested.
- Uploaded documents are processed in memory, not stored in a database.
- CI checks must pass before tagging demo-ready builds.
