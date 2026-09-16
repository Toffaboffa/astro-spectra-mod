# SPECTRA PRO AI Worker

This directory contains the server-side boundary for the **AI Interpretation** feature.

The browser must never receive `OPENAI_API_KEY`. SPECTRA PRO sends its compact `spectra-pro-ai-analysis/v1` payload to this Worker; the Worker validates and rate-limits the request before any future OpenAI API call is allowed.

## Step 5 behavior

`POST /api/interpret` currently performs the security boundary, prepares the scientific interpretation prompt, and defines the strict machine-readable response format:

- exact origin allowlist
- `POST` + `application/json` only
- 64 KiB default body limit
- Cloudflare Workers Rate Limiting binding
- SPECTRA PRO schema and array-size validation
- no request/payload logging
- `Cache-Control: no-store`
- scientific prompt contract `spectra-pro-interpretation/v1`
- response contract `spectra-pro-ai-response/v1`
- user observation treated as untrusted contextual data, never as developer instructions
- no OpenAI call yet

A valid request deliberately returns HTTP `501` with `AI_CONNECTOR_NOT_ENABLED`, plus non-secret prompt/response-contract metadata. Step 6 enables the OpenAI Responses API request.

`GET /health` returns a small non-secret health response including the active prompt and response contract versions.

## Structured response

`src/response.js` defines the strict Structured Outputs schema that Step 6 will pass as the Responses API `text.format` JSON schema. The schema contains only:

- `language`
- `summary`
- `interpretation`
- `dataQuality`
- `caveats`
- `conclusion`

All fields are strings and all keys are required. `dataQuality` and `caveats` may be empty strings when there is nothing material to add. The frontend joins the prose fields into a normal text result, so users do not see JSON.

## Scientific prompt contract

`src/prompt.js` contains the stable interpretation rules. The contract deliberately separates developer instructions from the serialized SPECTRA PRO payload so measured data and user observation cannot silently become higher-priority instructions.

The model is instructed to:

- distinguish measured features, SPECTRA PRO matches and model interpretation
- never invent peaks, wavelengths, calibration data, QC flags or experimental conditions
- treat Score Share as relative ranking only, never probability, concentration or abundance
- treat Best Match as the highest current candidate score, not proof of identity
- allow multiple species when evidence supports them
- require stronger evidence from multiple consistent atomic lines or molecular bands than from a single coincidence
- use the observation as context/plausibility information without allowing it to override spectral evidence
- consider residuals, calibration, coverage, QC, saturation, signal quality, overlap and settings only when those data are actually present
- avoid unsupported quantitative claims about concentration, temperature, pressure or electron density
- avoid interpreting raw/normalized intensity directly as abundance without an explicit instrument correction basis
- answer in the observation language when reliably identifiable, otherwise English
- keep the combined result concise and normally around 120–220 words

## OpenAI API key

Use a dedicated OpenAI Project for SPECTRA PRO and preferably a project service account rather than a personal user-owned production key. Give the key only the API access the Worker needs. For the planned integration that means write access to the Responses endpoint; other endpoint permissions can remain disabled unless a later feature requires them.

The key value must never be committed to this repository.

## Cloudflare Secrets Store

Production uses Cloudflare Secrets Store. The current binding in `wrangler.jsonc` is:

```text
Worker binding: OPENAI_API_KEY
Secrets Store secret: SpectraPRO
```

The account Secrets Store ID is referenced in `wrangler.jsonc` because Workers need it to bind the existing secret. The Store ID is an identifier, not the secret value.

The secret must have the `workers` permission scope. When Step 6 reads it, Secrets Store requires an asynchronous `get()` call on the binding.

For local development, use Wrangler's local Secrets Store commands without `--remote`. Do not copy the production key into source code or a committed file.

## Setup

Requirements: Node.js/npm and a Cloudflare account.

```bash
cd backend/ai-worker
npm install
```

Verify and deploy:

```bash
npm run check
npm run deploy
```

Wrangler will provide a `workers.dev` URL unless a custom domain is configured. The frontend service will eventually call:

```text
https://<worker-host>/api/interpret
```

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

Rotate the OpenAI key if it is ever exposed. Do not place the value in frontend JavaScript, `wrangler.jsonc`, GitHub Actions output, documentation, screenshots, issues, or prompts.
