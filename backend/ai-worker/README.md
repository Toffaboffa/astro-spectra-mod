# SPECTRA PRO AI Worker

This directory contains the server-side boundary for the future **AI Interpretation** feature.

The browser must never receive `OPENAI_API_KEY`. SPECTRA PRO sends its compact `spectra-pro-ai-analysis/v1` payload to this Worker; the Worker validates and rate-limits the request before any future OpenAI API call is allowed.

## Step 3 behavior

`POST /api/interpret` currently performs only the security boundary:

- exact origin allowlist
- `POST` + `application/json` only
- 64 KiB default body limit
- Cloudflare Workers Rate Limiting binding
- SPECTRA PRO schema and array-size validation
- no request/payload logging
- `Cache-Control: no-store`
- no OpenAI call yet

A valid request deliberately returns HTTP `501` with `AI_CONNECTOR_NOT_ENABLED`. Step 4 will add the scientific prompt contract. Step 6 will enable the OpenAI Responses API request.

`GET /health` returns a small non-secret health response.

## Setup

Requirements: Node.js/npm and a Cloudflare account.

```bash
cd backend/ai-worker
npm install
```

For local development, copy `dev.vars.example` to `.dev.vars` and put a project-specific OpenAI API key there. `.dev.vars*`, `.env*` and `.wrangler/` are ignored by git.

For production, store the key as an encrypted Worker secret instead of a committed variable:

```bash
npx wrangler secret put OPENAI_API_KEY
```

Then verify and deploy:

```bash
npm run check
npm run deploy
```

Wrangler will provide a `workers.dev` URL unless a custom domain is configured. The future frontend service should call:

```text
https://<worker-host>/api/interpret
```

Do not put this API key in `wrangler.jsonc`, frontend JavaScript, GitHub Actions output, documentation, screenshots, or issue text.

## Allowed origins

`wrangler.jsonc` currently allows:

- `https://toffaboffa.github.io`
- `http://localhost:8000`
- `http://127.0.0.1:8000`

CORS origins contain only scheme + host + optional port, never a path. If SPECTRA PRO is deployed on a custom domain, add that exact origin to `ALLOWED_ORIGINS` before deployment.

The origin check is browser hardening, not authentication. A non-browser client can forge an `Origin` header, which is why requests are also rate-limited and validated. Turnstile or authenticated per-user quotas can be added later if public abuse becomes a real problem.

## Rate limiting

The Worker uses Cloudflare's `AI_RATE_LIMITER` binding at 12 accepted attempts per 60 seconds for each connecting IP within a Cloudflare location. This is basic abuse protection, not billing-grade accounting. Shared school/mobile networks may place multiple users behind one IP, so the value should be tuned from real usage before wider deployment.

## Secret policy

Use a dedicated OpenAI Project and a project-scoped API key with appropriate permissions and spend controls. Rotate the key if it is ever exposed. The Worker code references only the environment binding name `OPENAI_API_KEY`; no key value belongs in this repository.
