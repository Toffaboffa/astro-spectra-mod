# Astro Spectra Mod (CORE / LAB / ASTRO)

This repository is a **scaffold** for an “astro-mod” of the SPECTRA Recording web app you downloaded.
The main rule is: **CORE mode must stay identical to SPECTRA** (baseline + regression target), while LAB and ASTRO add capabilities.

## Modes

**CORE**
- Exact SPECTRA behavior as-is:
  - camera/video → stripe extraction → realtime RGB graph (canvas)
  - zoom, reference overlays, calibration px→nm, export image/xlsx
- No subtraction, no continuum normalization, no backend analysis, no IDs.

**LAB**
- For classroom/lab spectroscopy:
  - Dark frame capture + subtraction modes
  - Reference capture + normalization / absorbance
  - Live element identification from a large line library
  - “Top hits” list + click-to-highlight in graph
  - Export: raw + processed + matches + metadata

**ASTRO**
- For Sun / planets / stars (real-time):
  - Astro profiles (Sun / Star / Planet / DeepSky)
  - Continuum normalization (Fraunhofer + stellar absorption)
  - Doppler / wavelength-offset readout from multi-line consensus
  - Molecular/band support (bandheads/templates later)
  - Same subtraction toolbox as LAB

## What’s included in this zip

- Full repo folder structure (so you can upload one zip back here and we patch files in order).
- Placeholders where the original SPECTRA files will go in Step 2.
- Your Python analysis engine copied into:
  - `backend/app/engine/engine_v6.2.1.py`
- Your current line library copied into:
  - `backend/app/data/line_library_v1.json`

## Structure

- `frontend/` — the web UI (SPECTRA + mod modules)
- `backend/` — FastAPI analysis service that runs your engine in real time
- `docs/` — roadmap, presets, API contract notes

## Stepwise build plan (agent-friendly)

### Step 2 — Align frontend paths + add minimal hooks (keep CORE safe)
This repo is already structured to let coding agents work in parallel. Start by ensuring
`frontend/pages/recording.html` points to files that exist under `frontend/scripts/` and
`frontend/styles/` (see `AGENTS.md`).

If you later swap in upstream SPECTRA files, place them here:

- `frontend/pages/recording.html`
- `frontend/styles/styles.css`
- `frontend/scripts/*.js` (the SPECTRA scripts)

Then patch only a few files to “hook in” the mod:

1) **recording.html**
   - Add mode buttons: CORE / LAB / ASTRO (default CORE)
   - Add empty panel containers for LAB and ASTRO
   - Include `frontend/scripts/mod/*.js` after the original scripts

2) **graphScript.js**
   - Add a safe export function:
     - `window.AstroSpectra.getCurrentSpectrumFrame()`
   - Add a conditional processing hook:
     - if mode != CORE, run `processingPipeline.process(frame, settings)`
   - Add overlay drawing hook:
     - `overlays.drawMatches(ctx, matches, calibration, zoomState)`

3) **calibrationScript.js**
   - Expose calibration coefficients/state to mod modules

4) **referenceGraphScript.js**
   - Allow a reference curve to be tagged as subtraction reference (I0)

Goal: CORE still behaves exactly, LAB/ASTRO UI exists but can be “inactive”.

### Step 3 — Implement the processing pipeline (frontend)
Implement these modules:

- `frontend/scripts/mod/subtraction.js`
  - capture dark/reference frames
  - modes: raw-dark, raw/ref, (raw-dark)/(ref-dark), absorbance
- `frontend/scripts/mod/continuum.js`
  - rolling median / low-order poly continuum normalization
- `frontend/scripts/mod/smoothing.js`
  - median / SG-lite smoothing
- `frontend/scripts/mod/processingPipeline.js`
  - orchestrates processing in the right order

### Step 4 — Backend API (FastAPI) to run your engine in real time
Implement:

- `backend/app/api/analyze.py` — `POST /analyze`
- `backend/app/api/library.py` — `GET /library/search`, `GET /library/filters`
- `backend/app/core/engine_adapter.py`
  - accept in-memory arrays
  - call your engine
  - return matches + offset + QC summary

### Step 5 — Live identification + overlays
Implement:

- `frontend/scripts/mod/analysisApi.js` (throttle ~2–5 Hz)
- `frontend/scripts/mod/overlays.js` (markers + labels)
- `frontend/scripts/mod/libraryClient.js` (search + filters)
- `frontend/scripts/mod/quickPeaks.js` (instant UI peaks)

### Step 6 — ASTRO upgrades
Implement:

- `frontend/scripts/mod/presets.js` — profiles:
  - Sun / Star / Planet / DeepSky
- Doppler/offset estimation:
  - backend computes consensus shift across matched lines
- Molecule/band support:
  - filters + bandhead logic
  - later: template correlation

## Draft backend API contract

### POST /analyze
Request (draft):
```json
{
  "mode": "LAB",
  "nm": [380.0, 380.2],
  "I":  [0.12, 0.13],
  "settings": {
    "tolerance_nm": 1.0,
    "min_peak_prominence": 0.02,
    "prefer_absorption": false,
    "library_filters": ["lab"]
  }
}
```

Response (draft):
```json
{
  "mode_used": "LAB",
  "offset_nm": 0.35,
  "matches": [
    { "species": "Na I", "ref_nm": 589.0, "obs_nm": 589.3, "kind": "line", "score": 0.91, "flags": [] }
  ],
  "qc": { "notes": ["auto-mode picked emission"], "dropped": 2 }
}
```

## Run (when implemented)

Frontend: serve `frontend/` with any static server.

Backend:
```bash
cd backend
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---
Next: upload your SPECTRA files into this structure (Step 2), zip it, send it here — and we start patching in the safe order.
