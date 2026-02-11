# Astro Spectra Mod — Agent Playbook

This repo is designed to be *agent-friendly*: deterministic commands, clear contracts, and guardrails.

## Non-negotiables

1) **Do not break API contracts** documented in `docs/api_contract.md`.
2) **Keep the live graph client-side.** The server is for analysis only.
3) **No changes to URL paths** under `frontend/pages/` unless you also update `frontend/index.html`.
4) **Prefer small, reviewable PRs.** One feature area per PR.

## Quick start (local)

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

This project is plain HTML/JS/CSS. Serve `frontend/` with any static server:

```bash
python -m http.server 5173 --directory frontend
```

Open: `http://localhost:5173/index.html`

## Tests

```bash
cd backend
pytest -q
```

## Repo structure (source of truth)

Frontend:

- `frontend/pages/recording.html` — main UI page
- `frontend/scripts/` — all JS modules/scripts
- `frontend/scripts/mod/` — astro extensions (subtraction, overlays, API client, etc.)
- `frontend/styles/` — CSS; `customColorsStyle.css` + `recordingStyle.css` are required by the page

Backend:

- `backend/app/api/analyze.py` — `POST /analyze`
- `backend/app/api/library.py` — library search
- `backend/app/core/engine_adapter.py` — single adapter around `engine/engine_v6.2.1.py`
- `backend/app/data/line_library_v1.json` — current line library

## Work plan (high level)

See `docs/roadmap.md`. When implementing:

1) **UI loop (60fps)**: draw graph, stripe, quick peaks.
2) **Analysis tick (2–5Hz)**: send downsampled data to `POST /analyze`.
3) Render overlays and candidate list from the server response.

## Suggested parallelization (multiple agents)

Use separate branches/worktrees to avoid conflicts:

- **Agent A — Frontend CORE**: graph rendering stability, zoom, stripe handling.
- **Agent B — Astro UI**: calibration presets, subtraction controls, panels.
- **Agent C — Backend**: analysis endpoint performance, library filters, expanded JSON schema.

Each agent must:

- add/adjust tests where practical
- keep changes scoped
- update docs when behavior changes
