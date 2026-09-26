# SPECTRA PRO AI Worker

This directory contains the server-side boundary for **AI Interpretation**.

The browser never receives `OPENAI_API_KEY`. SPECTRA PRO sends its compact `spectra-pro-ai-analysis/v1` payload to this Worker; the Worker validates and rate-limits the request, retrieves the OpenAI key from Cloudflare Secrets Store, calls the OpenAI Responses API, validates the structured result, and returns only the interpretation plus compact token-usage metadata.

## Current behavior

`POST /api/interpret` now performs the complete server-side interpretation flow:

- exact origin allowlist
- `POST` + `application/json` only
- 64 KiB default body limit
- Cloudflare Workers Rate Limiting binding
- SPECTRA PRO schema and array-size validation
- no request/payload logging
- `Cache-Control: no-store`
- context-aware scientific prompt contract `spectra-pro-interpretation/v6`
- strict response contract `spectra-pro-ai-response/v1`
- account-level Secrets Store binding `OPENAI_API_KEY` -> secret `SpectraPRO`
- OpenAI Responses API with Structured Outputs (`text.format` JSON schema)
- developer-role scientific instructions separated from user/measurement data
- `store: false` for the OpenAI response
- configurable model/output/timeout limits
- validated structured result returned to the browser
- compact token usage returned for client display and cost monitoring

The validated payload identifies one of four deterministic scientific contexts:
`lab-atomic`, `lab-molecular`, `fluorescence`, or `astro`. ASTRO input is bounded to
compact continuum state, absorption/reference evidence, equivalent widths, radial
velocity with uncertainty/correction metadata, broad class evidence, quality limits,
and optional observation text. Prompt rules prohibit invented features, probability
claims from rankings, unsupported exact stellar classes or abundances, radial-velocity
overprecision, and use of uncorrected continuum shape as temperature evidence.

Frontend defaults send at most 80 normalized trace points, 20 prioritized
accepted hits, 6 candidates and 600 observation characters. Result evidence uses
canonical `topHits`; broader raw/diagnostic hits are excluded, and source identity is
kept as provenance rather than model evidence. The deterministic dense-input contract
is capped at 9 kB and approximately 3500 estimated input tokens including instructions
and response schema. Output is targeted at 100–170 words without repeated conclusions.

`GET /health` returns a small non-secret health response with application, model and contract versions. It does not expose or test the secret value.

## OpenAI configuration

Production defaults in `wrangler.jsonc`:

- model: `gpt-5.6-terra`
- reasoning effort: `low`
- text verbosity: `low`
- max output tokens: `700`
- upstream timeout: `35000 ms`
- OpenAI response storage: disabled (`store: false`)

The project API key should be restricted to the Responses endpoint and stored only in Cloudflare Secrets Store. The Worker supports the Secrets Store binding via `await env.OPENAI_API_KEY.get()`; a plain string `OPENAI_API_KEY` is accepted only to keep local `.dev.vars` development simple.

## Cloudflare secret binding

The repository is configured for the account-level secret already created in Cloudflare:

```text
Secrets Store secret: SpectraPRO
Worker binding:       OPENAI_API_KEY
Permission scope:     Workers
```

`wrangler.jsonc` contains only the store ID, secret name and binding name. It never contains the secret value.

## Deploy

Requirements: Node.js/npm, Wrangler authentication and permission to deploy a Worker that binds the Secrets Store secret.

```bash
cd backend/ai-worker
npm install
npm run check
npm run deploy
```

After deployment Wrangler prints the Worker URL, normally similar to:

```text
https://spectra-pro-ai.<your-workers-subdomain>.workers.dev
```

Verify:

```text
https://spectra-pro-ai.<your-workers-subdomain>.workers.dev/health
```

The response should report `appVersion: "1.3.8"`.

## Frontend endpoint

The frontend service is `docs/frontend/scripts/mod/aiAnalysisService.js`. It resolves the backend endpoint in this order:

1. `SpectraPro.aiAnalysisConfig.endpoint`
2. `window.SPECTRA_PRO_AI_ENDPOINT`
3. `<meta name="spectra-pro-ai-endpoint" content="...">`

The configured URL may be the Worker origin or the full endpoint. If only the origin is supplied, `/api/interpret` is added automatically.

Example, set before using AI Interpretation:

```js
window.SPECTRA_PRO_AI_ENDPOINT = 'https://spectra-pro-ai.<your-workers-subdomain>.workers.dev';
```

For production, commit the final Worker URL into the frontend configuration only after the Worker has been deployed and tested. The URL itself is public and is not a secret. The OpenAI key remains server-side.

## Local development

For local development without production Secrets Store, copy `dev.vars.example` to `.dev.vars` and insert a project-specific test API key. `.dev.vars*`, `.env*` and `.wrangler/` are ignored by git.

```bash
cd backend/ai-worker
npm install
npm run dev
```

Then configure the frontend to the local Worker URL shown by Wrangler.

## Allowed origins

`wrangler.jsonc` currently allows:

- `https://toffaboffa.github.io`
- `http://localhost:8000`
- `http://127.0.0.1:8000`

CORS origins contain only scheme + host + optional port, never a path. If SPECTRA PRO is deployed on a custom domain, add that exact origin to `ALLOWED_ORIGINS` before deployment.

The origin check is browser hardening, not authentication. A non-browser client can forge an `Origin` header, which is why requests are also rate-limited and validated.

## Rate limiting

The Worker uses Cloudflare's `AI_RATE_LIMITER` binding at 12 attempts per 60 seconds for each connecting IP within a Cloudflare location. This is basic abuse protection, not billing-grade accounting. Shared school/mobile networks may place multiple users behind one IP, so the value should be tuned from real usage before wider deployment.

## Response shape

A successful response contains approximately:

```json
{
  "ok": true,
  "appVersion": "1.3.8",
  "model": "gpt-5.6-terra",
  "result": {
    "language": "sv",
    "summary": "...",
    "interpretation": "...",
    "dataQuality": "...",
    "caveats": "...",
    "conclusion": "..."
  },
  "text": "...",
  "usage": {
    "inputTokens": 0,
    "outputTokens": 0,
    "totalTokens": 0,
    "reasoningTokens": 0
  }
}
```

The browser renders the structured prose as ordinary readable text rather than displaying JSON.
