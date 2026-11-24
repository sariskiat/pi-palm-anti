# pi-palm-anti

Pi Coding Agent provider for Google Antigravity (`cloudcode-pa.googleapis.com`) and Gemini Enterprise
(`businessaicode.googleapis.com`).

## Rule: never route to Vertex AI

In Enterprise mode, every Gemini model, including `gemini-4-carbon`, must go to Gemini Enterprise
(`businessaicode.googleapis.com`) only, the same way `gemini-4-hydrogen` does.

Do not add a request, fallback, retry, cache or environment switch that sends traffic to Vertex AI
(`aiplatform.googleapis.com` or `<region>-aiplatform.googleapis.com`).

**Why:** Vertex AI bills the GCP project's pay-as-you-go Vertex AI quota. Users choose Enterprise mode to use their
Gemini Enterprise license pool, so a Vertex AI route silently moves their usage onto a separate bill. Version 0.12.0
routed Gemini 4 Carbon to Vertex AI first and quietly fell back to it on BusinessAICode 403/404 responses, which did
exactly that.

**If BusinessAICode rejects a model** (403 not allowed by your administrator, 404 not found), surface the error to the
user. Do not work around it by trying another backend.

**Guards that enforce this rule** (keep them passing, do not weaken them):

- `assertSafeApiBaseUrl` in `src/utils/security.ts` refuses Vertex AI hosts, including through `ANTIGRAVITY_BASE_URL`.
- `scripts/security-check.ts` fails if any file in `src/` contains a Vertex AI URL or a `publishers/google/models` path.
- Section 9 of `scripts/test-model-routing.ts` checks that Carbon, Hydrogen and Argon reach only BusinessAICode, and that
  403/404 responses, `ANTIGRAVITY_ENTERPRISE_BACKEND=vertex` and the `#3501` license fallback never reach Vertex AI.

## Checks

Run `npm run check` before every commit. It runs the typecheck, lint, Prettier check, security check and all tests.
