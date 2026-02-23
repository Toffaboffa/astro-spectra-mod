# FunctionSpec.md — SPECTRA-PRO implementation plan and status tracker

This file defines **how we build SPECTRA-PRO safely**, in what order files are patched, and how we avoid breaking CORE mode while adding LAB and ASTRO features.

The project is scaffold-first: many files exist as placeholders so the structure is visible before implementation. This spec is the working contract for incremental patching.

---

## Project naming
- **App name (UI/product):** `SPECTRA-PRO`
- **Current GitHub/repo working name:** `astro-spectra-mod`

---

## Current state (as of this scaffold upload)

### What is already present
- Full folder structure for frontend, worker, docs, tests
- Placeholder files for original SPECTRA scripts and PRO modules
- Placeholder data/preset/library files
- Basic language files
- Initial README scaffold (now replaced by expanded version)

### What is *not* implemented yet
- Original SPECTRA code integration
- Hook patches into `graphScript.js` / `calibrationScript.js`
- Worker message protocol implementation
- Any real analysis logic
- UI panels for LAB/ASTRO
- Export augmentation

---

## Guiding rule (non-negotiable)

**CORE mode must remain usable and stable.**

Every patch should be designed so that:
1. CORE can run without worker analysis,
2. PRO modules can be disabled,
3. failure in LAB/ASTRO does not brick the base graph/camera workflow.

---

## Implementation strategy (high-level)

We build in layers:
1. **Integrate original SPECTRA files**
2. **Patch read-only hooks** (no behavior changes)
3. **Add PRO shell/UI state**
4. **Add v5-style visual/quality controls**
5. **Add worker and LAB analysis**
6. **Add ASTRO preprocessing and matching**
7. **Add advanced correction/profiles/export augment**

---

## Status legend
- `TODO` = not started
- `SCAFFOLD` = file exists as placeholder only
- `PARTIAL` = basic implementation exists, not production-ready
- `READY` = implemented and manually verified
- `DEFERRED` = intentionally pushed to later phase

---

## File status snapshot (initial)

### Original SPECTRA placeholders (`docs/Frontend/scripts/*.js`)
Status: **SCAFFOLD** (all)

These files should be replaced with the original SPECTRA scripts before feature patching begins:
- `cameraScript.js`
- `graphScript.js`
- `stripeScript.js`
- `calibrationScript.js`
- `referenceGraphScript.js`
- `dataSavingScript.js`
- `imageLoadingScript.js`
- `setupScript.js`
- `cameraSelection.js`
- `languageScript.js`
- `polynomialRegressionScript.js`
- `zipScript.js` (if used by original export flow)

### PRO integration + UI/state modules (`docs/Frontend/scripts/mod/`)
Status: **PARTIAL** (phase-2 foundation implemented for selected modules; others remain `SCAFFOLD`)

### Worker modules (`docs/Frontend/workers/`)
Status: **PARTIAL** (worker protocol/router/foundation stubs implemented; analysis logic still mostly `SCAFFOLD`)

### Docs/tests
Status: **SCAFFOLD** / `README.md` now **PARTIAL** (architecture/spec-level documentation added)

---

## New v5-inspired additions added to scaffold (this revision)

The following modules/files were added to support capabilities missing in the original web app and inspired by v5 desktop behavior:

### Added files (all currently `SCAFFOLD`)
- `docs/Frontend/scripts/mod/displayModes.js`
- `docs/Frontend/scripts/mod/dataQualityPanel.js`
- `docs/Frontend/scripts/mod/yAxisController.js`
- `docs/Frontend/scripts/mod/peakControls.js`
- `docs/Frontend/scripts/mod/graphAppearance.js`
- `docs/Frontend/scripts/mod/cameraCapabilities.js`
- `docs/Frontend/scripts/mod/calibrationIO.js`
- `docs/Frontend/scripts/mod/calibrationPointManager.js`
- `docs/Frontend/scripts/mod/instrumentResponse.js`
- `docs/Frontend/scripts/mod/responseProfileStore.js`
- `docs/Frontend/scripts/mod/instrumentProfile.js`
- `docs/Frontend/scripts/mod/observationProfile.js`
- `docs/Frontend/data/instrument_response_profiles.json`
- `docs/v5_gap_additions.md`

### Removed files (simplification / phase control)
- `docs/Frontend/workers/templateMatcher.js` → **DEFERRED** (too advanced for current scaffold stage; can be reintroduced later)
- `tests/test-preset-mapping.md` → removed for now (premature before presets are implemented)

---

## Patch order (operational sequence)

This is the order we should follow when working on the codebase in future patch sessions.

### Phase 0 — Baseline import (must happen first)
**Goal:** get original SPECTRA UI running inside this repo.

**Files (priority):**
1. `docs/Frontend/pages/recording.html`
2. `docs/Frontend/styles/styles.css`
3. all `docs/Frontend/scripts/*.js` original scripts

**Output:** CORE baseline works (camera → stripe → graph) with no PRO behavior required.

**Status:** `TODO`

---

### Phase 1 — Safe hooks + PRO shell (no heavy logic)
**Goal:** create integration points without changing instrument behavior.

**Primary files:**
- `docs/Frontend/scripts/mod/appMode.js`
- `docs/Frontend/scripts/mod/stateStore.js`
- `docs/Frontend/scripts/mod/eventBus.js`
- `docs/Frontend/scripts/mod/spectrumFrameAdapter.js`
- `docs/Frontend/scripts/mod/uiPanels.js`
- `docs/Frontend/scripts/mod/overlays.js`
- patches in `docs/Frontend/scripts/graphScript.js`
- patches in `docs/Frontend/scripts/calibrationScript.js`
- patches in `docs/Frontend/scripts/referenceGraphScript.js`

**Must be true before phase ends:**
- CORE still behaves correctly
- last frame can be exported to mod state (read-only hook)
- calibration state can be read by mod bridge
- overlay hook exists (can be no-op)
- mode tabs visible (CORE/LAB/ASTRO)

**Status:** `TODO`

---

### Phase 1.5 — v5-style instrument UX upgrades (still CORE-safe)
**Goal:** add useful graph/instrument controls before LAB/ASTRO analysis.

**Primary files:**
- `docs/Frontend/scripts/mod/displayModes.js`
- `docs/Frontend/scripts/mod/dataQualityPanel.js`
- `docs/Frontend/scripts/mod/yAxisController.js`
- `docs/Frontend/scripts/mod/peakControls.js`
- `docs/Frontend/scripts/mod/graphAppearance.js`
- `docs/Frontend/scripts/mod/cameraCapabilities.js`
- `docs/Frontend/scripts/mod/calibrationIO.js`
- `docs/Frontend/scripts/mod/calibrationPointManager.js`

**Features targeted:**
- display mode separation (Normal / Difference / Ratio / etc.)
- saturation indicator + data quality panel shell
- y-axis auto/fixed controls
- peak threshold/distance/smoothing UI
- graph color fill modes
- camera capability abstraction (unsupported-safe)
- calibration import/export + multipoint manager shell

**Status:** `TODO`

---

### Phase 2 — Worker foundation + LAB MVP
**Goal:** live identification in LAB mode without freezing UI.

**Primary files:**
- `docs/Frontend/scripts/mod/analysisWorkerClient.js`
- `docs/Frontend/workers/analysis.worker.js`
- `docs/Frontend/workers/workerRouter.js`
- `docs/Frontend/workers/workerTypes.js`
- `docs/Frontend/workers/workerState.js`
- `docs/Frontend/workers/libraryLoader.js`
- `docs/Frontend/workers/libraryIndex.js`
- `docs/Frontend/workers/libraryQuery.js`
- `docs/Frontend/workers/peakDetect.js`
- `docs/Frontend/workers/peakScoring.js`
- `docs/Frontend/workers/lineMatcher.js`
- `docs/Frontend/workers/qcRules.js`
- `docs/Frontend/workers/confidenceModel.js`
- `docs/Frontend/workers/analysisPipeline.js`
- `docs/Frontend/scripts/mod/libraryClient.js`
- `docs/Frontend/scripts/mod/libraryFilters.js`
- `docs/Frontend/scripts/mod/processingPipeline.js`
- `docs/Frontend/scripts/mod/subtraction.js`
- `docs/Frontend/scripts/mod/quickPeaks.js`
- `docs/Frontend/scripts/mod/presets.js`

**Must be true before phase ends:**
- worker responds to `PING`
- worker can load atomic library
- LAB mode can analyze throttled frames
- top hits panel shows results
- overlays can label lines
- subtraction modes (dark/ref at minimum) work

**Status:** `TODO`

---

### Phase 3 — ASTRO MVP (continuum + absorption + solar presets)
**Goal:** make ASTRO mode meaningfully different from LAB and useful for solar/stellar data.

**Primary files:**
- `docs/Frontend/scripts/mod/continuum.js`
- `docs/Frontend/scripts/mod/normalization.js`
- `docs/Frontend/scripts/mod/smoothing.js`
- `docs/Frontend/workers/autoMode.js`
- `docs/Frontend/workers/offsetEstimate.js`
- `docs/Frontend/workers/dopplerEstimate.js`
- `docs/Frontend/workers/bandMatcher.js`
- `docs/Frontend/workers/presetResolver.js`
- `docs/Frontend/scripts/mod/calibrationPresets.js`
- `docs/Frontend/scripts/mod/speciesSearch.js`

**Must be true before phase ends:**
- continuum normalization available in ASTRO
- absorption/emission auto or manual mode works
- solar/Fraunhofer preset exists
- offset estimate shown with QC
- preliminary Doppler display available with warnings
- molecular band matching supports a basic first pass

**Status:** `TODO`

---

### Phase 4 — Response correction, reproducibility profiles, export augmentation
**Goal:** improve measurement quality and repeatability.

**Primary files:**
- `docs/Frontend/scripts/mod/instrumentResponse.js`
- `docs/Frontend/scripts/mod/responseProfileStore.js`
- `docs/Frontend/data/instrument_response_profiles.json`
- `docs/Frontend/scripts/mod/instrumentProfile.js`
- `docs/Frontend/scripts/mod/observationProfile.js`
- `docs/Frontend/scripts/mod/sessionCapture.js`
- `docs/Frontend/scripts/mod/exportAugment.js`
- `docs/Frontend/scripts/mod/flatField.js`

**Must be true before phase ends:**
- user can create/apply response correction profile (basic workflow)
- instrument + observation profiles can be captured/exported
- export includes key PRO metadata and QC flags

**Status:** `TODO`

---

## Dependency notes (important)

### Hard dependencies
- `graphScript.js` hook must exist before `spectrumFrameAdapter.js` is useful.
- `calibrationScript.js` hook must exist before ASTRO/Doppler results are meaningful.
- `libraryLoader.js` + `libraryIndex.js` are required before matchers do anything.
- `stateStore.js` and `eventBus.js` should be stable before adding many UI panels.

### Soft dependencies / can stub early
- `bandMatcher.js` can initially return no results.
- `dopplerEstimate.js` can be hidden until offset confidence is good enough.
- `instrumentResponse.js` can begin as pass-through with on/off plumbing.

---

## QA gates (minimum per phase)

### CORE gate (before Phase 2)
- Camera starts/stops
- Stripe moves and updates graph
- Graph remains responsive
- Calibration still works
- Export still works
- No console errors from PRO scripts when mode=CORE

### LAB gate (before Phase 3)
- Worker loop does not tank FPS
- Top hits update and are mode-filtered
- Ratio/difference/absorbance produce expected changes
- Saturation warning appears when signal clips
- Turning off overlays restores clean graph

### ASTRO gate (before Phase 4)
- Continuum normalization improves line visibility on solar sample
- Fraunhofer preset reduces false positives vs general mode
- Offset/Doppler display hides itself when confidence is low

---

## How this file should be updated during development

Each patch session should update:
1. **Current phase** (`TODO` → `PARTIAL` → `READY`)
2. **Files touched** (short list)
3. **Regression notes** (especially CORE behavior)
4. **Known breakages / deferred items**

Suggested section to append after each patch:
- `## Session log YYYY-MM-DD`
  - Touched files
  - What changed
  - What passed
  - What remains

---

## Final note

SPECTRA-PRO should feel like a real instrument first and a smart analyzer second.
That means this function spec intentionally optimizes for **stable patch order**, **clear module boundaries**, and **CORE safety** over feature rush.


## Session log 2026-02-23 (Phase 2 foundation patch #1)
- **Touched files**
  - `docs/Frontend/pages/recording.html`
  - `docs/Frontend/scripts/mod/eventBus.js`
  - `docs/Frontend/scripts/mod/stateStore.js`
  - `docs/Frontend/scripts/mod/appMode.js`
  - `docs/Frontend/scripts/mod/uiPanels.js`
  - `docs/Frontend/scripts/mod/spectrumFrameAdapter.js`
  - `docs/Frontend/scripts/mod/quickPeaks.js`
  - `docs/Frontend/scripts/mod/subtraction.js`
  - `docs/Frontend/scripts/mod/processingPipeline.js`
  - `docs/Frontend/scripts/mod/analysisWorkerClient.js`
  - `docs/Frontend/workers/analysis.worker.js`
  - `docs/Frontend/workers/workerTypes.js`
  - `docs/Frontend/workers/workerState.js`
  - `docs/Frontend/workers/workerRouter.js`
  - `docs/Frontend/workers/libraryLoader.js`
  - `docs/Frontend/workers/libraryIndex.js`
  - `docs/Frontend/workers/libraryQuery.js`
  - `docs/Frontend/workers/peakDetect.js`
  - `docs/Frontend/workers/peakScoring.js`
  - `docs/Frontend/workers/lineMatcher.js`
  - `docs/Frontend/workers/qcRules.js`
  - `docs/Frontend/workers/confidenceModel.js`
  - `docs/Frontend/workers/analysisPipeline.js`

- **What changed**
  - Added a working event bus + state store + mode switching foundation (`CORE/LAB/ASTRO`).
  - Added a basic scaffold UI page for GitHub Pages sanity checks (worker ping + dummy analyze button).
  - Implemented a first worker protocol shell (`PING`, `INIT_LIBRARIES`, `ANALYZE_FRAME`) with router + state.
  - Added placeholder LAB pipeline primitives (quick peaks, subtraction modes, processing pipeline) to support later integration.
  - Kept all logic decoupled from original SPECTRA files (no CORE patches yet).

- **What passed (sanity)**
  - Page-level script load order is valid in scaffold mode.
  - Worker entrypoint can be started from frontend (subject to static hosting path support).
  - Dummy frame analysis returns a structured result payload without blocking UI.

- **What remains / known gaps**
  - Original SPECTRA files are not imported yet (Phase 0 still pending).
  - No graph hooks, calibration hooks, or reference hooks yet.
  - Worker library loading/matching is stubbed (no real atomic library parsing yet).
  - No overlay rendering into the actual SPECTRA graph.
  - `workerTypes` are duplicated in demo page bootstrap and should later come from a shared bridge/module.


## Session log

### Session update — GitHub Pages path migration (`/docs/Frontend/`)

- Deploy target normalized to **GitHub Pages `/docs`**.
- Web app tree moved to **`docs/Frontend/`** (capital F) to match current repo layout.
- Added **`docs/index.html`** redirect to `Frontend/index.html` so Pages root resolves correctly.
- Updated documentation paths in `README.md` and `FunctionSpec.md` from `frontend/...` to `docs/Frontend/...`.
- Sanity check: relative paths inside `docs/Frontend/pages/recording.html` remain valid (`../scripts`, `../workers`).

**Phase 0 readiness:** ✅ Ready to upload and proceed (original SPECTRA file integration can start next).

