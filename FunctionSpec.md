# FunctionSpec.md — SPECTRA-PRO implementation plan and status tracker

This file defines **how we build SPECTRA-PRO safely**, in what order files are patched, and how we avoid breaking CORE mode while adding LAB and ASTRO features.

The project is scaffold-first: many files exist as placeholders so the structure is visible before implementation. This spec is the working contract for incremental patching.

---

## Project naming
- **App name (UI/product):** `SPECTRA-PRO`
- **Current GitHub/repo working name:** `astro-spectra-mod`

---

## Current state (updated after Phase 1 hook shell patch)

### What is already present
- Full folder structure for frontend, worker, docs, tests
- Placeholder files for original SPECTRA scripts and PRO modules
- Placeholder data/preset/library files
- Basic language files
- Initial README scaffold (now replaced by expanded version)

### Phase 1.5 notes (this patch)
- Added **v5-inspired CORE controls bridge** in the SPECTRA-PRO panel (display mode, Y-axis mode placeholders, peak lower bound, fill opacity)
- Added **data quality mini-readout** (dynamic range / saturation risk shell) derived from live frame hook
- Restored important **recording layout geometry** from original CSS while keeping dark theme colors
- Fixed overlay/toast containment so info/error UI does not spill into the right side panel area
- Added extra resize/layout stabilization on boot to reduce graph/stripe visual mismatch after load

### What is *not* implemented yet
- Full feature parity with original SPECTRA visual polish (layout is now patched shell + custom theme)
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

### Original SPECTRA placeholders (`docs/frontend/scripts/*.js`)
Status: **PARTIAL** (Phase 0 compatibility harness + placeholder APIs added; still waiting for original file import)

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

### PRO integration + UI/state modules (`docs/frontend/scripts/mod/`)
Status: **PARTIAL** (phase-2 foundation implemented for selected modules; others remain `SCAFFOLD`)

### Worker modules (`docs/frontend/workers/`)
Status: **PARTIAL** (worker protocol/router/foundation stubs implemented; analysis logic still mostly `SCAFFOLD`)

### Docs/tests
Status: **SCAFFOLD** / `README.md` now **PARTIAL** (architecture/spec-level documentation added)

---

## New v5-inspired additions added to scaffold (this revision)

The following modules/files were added to support capabilities missing in the original web app and inspired by v5 desktop behavior:

### Added files (all currently `SCAFFOLD`)
- `docs/frontend/scripts/mod/displayModes.js`
- `docs/frontend/scripts/mod/dataQualityPanel.js`
- `docs/frontend/scripts/mod/yAxisController.js`
- `docs/frontend/scripts/mod/peakControls.js`
- `docs/frontend/scripts/mod/graphAppearance.js`
- `docs/frontend/scripts/mod/cameraCapabilities.js`
- `docs/frontend/scripts/mod/calibrationIO.js`
- `docs/frontend/scripts/mod/calibrationPointManager.js`
- `docs/frontend/scripts/mod/instrumentResponse.js`
- `docs/frontend/scripts/mod/responseProfileStore.js`
- `docs/frontend/scripts/mod/instrumentProfile.js`
- `docs/frontend/scripts/mod/observationProfile.js`
- `docs/frontend/data/instrument_response_profiles.json`
- `docs/v5_gap_additions.md`

### Removed files (simplification / phase control)
- `docs/frontend/workers/templateMatcher.js` → **DEFERRED** (too advanced for current scaffold stage; can be reintroduced later)
- `tests/test-preset-mapping.md` → removed for now (premature before presets are implemented)

---

## Patch order (operational sequence)

This is the order we should follow when working on the codebase in future patch sessions.

### Phase 0 — Baseline import harness (must happen first)
**Goal:** get original SPECTRA UI running inside this repo.

**Files (priority):**
1. `docs/frontend/pages/recording.html`
2. `docs/frontend/styles/styles.css`
3. all `docs/frontend/scripts/*.js` original scripts

**Output:** CORE baseline works (camera → stripe → graph) with no PRO behavior required.

**Status:** `READY` (original SPECTRA-1 files imported into docs/frontend, path migration completed, Pages-safe harness active)

---

### Phase 1 — Safe hooks + PRO shell (no heavy logic)

**Goal:** create integration points without changing instrument behavior.

**Primary files:**
- `docs/frontend/scripts/mod/appMode.js`
- `docs/frontend/scripts/mod/stateStore.js`
- `docs/frontend/scripts/mod/eventBus.js`
- `docs/frontend/scripts/mod/spectrumFrameAdapter.js`
- `docs/frontend/scripts/mod/uiPanels.js`
- `docs/frontend/scripts/mod/overlays.js`
- patches in `docs/frontend/scripts/graphScript.js`
- patches in `docs/frontend/scripts/calibrationScript.js`
- patches in `docs/frontend/scripts/referenceGraphScript.js`

**Must be true before phase ends:**
- CORE still behaves correctly
- last frame can be exported to mod state (read-only hook)
- calibration state can be read by mod bridge
- overlay hook exists (can be no-op)
- mode tabs visible (CORE/LAB/ASTRO)

**Status:** `PARTIAL` (hooks derived from real SPECTRA draw/cal/reference flow, mode tabs + P1 panel wired, overlay hook no-op installed)

---

### Phase 1.5 — v5-style instrument UX upgrades (still CORE-safe)
**Goal:** add useful graph/instrument controls before LAB/ASTRO analysis, plus layout parity fixes after real SPECTRA import.

**Primary files:**
- `docs/frontend/scripts/mod/displayModes.js`
- `docs/frontend/scripts/mod/dataQualityPanel.js`
- `docs/frontend/scripts/mod/yAxisController.js`
- `docs/frontend/scripts/mod/peakControls.js`
- `docs/frontend/scripts/mod/graphAppearance.js`
- `docs/frontend/scripts/mod/cameraCapabilities.js`
- `docs/frontend/scripts/mod/calibrationIO.js`
- `docs/frontend/scripts/mod/calibrationPointManager.js`

**Features targeted:**
- display mode separation (Normal / Difference / Ratio / etc.)
- saturation indicator + data quality panel shell
- y-axis auto/fixed controls
- peak threshold/distance/smoothing UI
- graph color fill modes
- camera capability abstraction (unsupported-safe)
- calibration import/export + multipoint manager shell

**Status:** `PARTIAL` (floating CORE control bridge added in SPECTRA-PRO panel, data-quality mini-panel added, layout/stripe alignment CSS parity fixes applied, right-panel/toast containment cleanup applied)

---

### Phase 2 — Worker foundation + LAB MVP
**Goal:** live identification in LAB mode without freezing UI.

**Primary files:**
- `docs/frontend/scripts/mod/analysisWorkerClient.js`
- `docs/frontend/workers/analysis.worker.js`
- `docs/frontend/workers/workerRouter.js`
- `docs/frontend/workers/workerTypes.js`
- `docs/frontend/workers/workerState.js`
- `docs/frontend/workers/libraryLoader.js`
- `docs/frontend/workers/libraryIndex.js`
- `docs/frontend/workers/libraryQuery.js`
- `docs/frontend/workers/peakDetect.js`
- `docs/frontend/workers/peakScoring.js`
- `docs/frontend/workers/lineMatcher.js`
- `docs/frontend/workers/qcRules.js`
- `docs/frontend/workers/confidenceModel.js`
- `docs/frontend/workers/analysisPipeline.js`
- `docs/frontend/scripts/mod/libraryClient.js`
- `docs/frontend/scripts/mod/libraryFilters.js`
- `docs/frontend/scripts/mod/processingPipeline.js`
- `docs/frontend/scripts/mod/subtraction.js`
- `docs/frontend/scripts/mod/quickPeaks.js`
- `docs/frontend/scripts/mod/presets.js`

**Must be true before phase ends:**
- worker responds to `PING`
- worker can load atomic library
- LAB mode can analyze throttled frames
- top hits panel shows results
- overlays can label lines
- subtraction modes (dark/ref at minimum) work

**Status:** `PARTIAL` (floating CORE control bridge added in SPECTRA-PRO panel, data-quality mini-panel added, layout/stripe alignment CSS parity fixes applied, right-panel/toast containment cleanup applied)

---

### Phase 3 — ASTRO MVP (continuum + absorption + solar presets)
**Goal:** make ASTRO mode meaningfully different from LAB and useful for solar/stellar data.

**Primary files:**
- `docs/frontend/scripts/mod/continuum.js`
- `docs/frontend/scripts/mod/normalization.js`
- `docs/frontend/scripts/mod/smoothing.js`
- `docs/frontend/workers/autoMode.js`
- `docs/frontend/workers/offsetEstimate.js`
- `docs/frontend/workers/dopplerEstimate.js`
- `docs/frontend/workers/bandMatcher.js`
- `docs/frontend/workers/presetResolver.js`
- `docs/frontend/scripts/mod/calibrationPresets.js`
- `docs/frontend/scripts/mod/speciesSearch.js`

**Must be true before phase ends:**
- continuum normalization available in ASTRO
- absorption/emission auto or manual mode works
- solar/Fraunhofer preset exists
- offset estimate shown with QC
- preliminary Doppler display available with warnings
- molecular band matching supports a basic first pass

**Status:** `PARTIAL` (floating CORE control bridge added in SPECTRA-PRO panel, data-quality mini-panel added, layout/stripe alignment CSS parity fixes applied, right-panel/toast containment cleanup applied)

---

### Phase 4 — Response correction, reproducibility profiles, export augmentation
**Goal:** improve measurement quality and repeatability.

**Primary files:**
- `docs/frontend/scripts/mod/instrumentResponse.js`
- `docs/frontend/scripts/mod/responseProfileStore.js`
- `docs/frontend/data/instrument_response_profiles.json`
- `docs/frontend/scripts/mod/instrumentProfile.js`
- `docs/frontend/scripts/mod/observationProfile.js`
- `docs/frontend/scripts/mod/sessionCapture.js`
- `docs/frontend/scripts/mod/exportAugment.js`
- `docs/frontend/scripts/mod/flatField.js`

**Must be true before phase ends:**
- user can create/apply response correction profile (basic workflow)
- instrument + observation profiles can be captured/exported
- export includes key PRO metadata and QC flags

**Status:** `PARTIAL` (floating CORE control bridge added in SPECTRA-PRO panel, data-quality mini-panel added, layout/stripe alignment CSS parity fixes applied, right-panel/toast containment cleanup applied)

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
  - `docs/frontend/pages/recording.html`
  - `docs/frontend/scripts/mod/eventBus.js`
  - `docs/frontend/scripts/mod/stateStore.js`
  - `docs/frontend/scripts/mod/appMode.js`
  - `docs/frontend/scripts/mod/uiPanels.js`
  - `docs/frontend/scripts/mod/spectrumFrameAdapter.js`
  - `docs/frontend/scripts/mod/quickPeaks.js`
  - `docs/frontend/scripts/mod/subtraction.js`
  - `docs/frontend/scripts/mod/processingPipeline.js`
  - `docs/frontend/scripts/mod/analysisWorkerClient.js`
  - `docs/frontend/workers/analysis.worker.js`
  - `docs/frontend/workers/workerTypes.js`
  - `docs/frontend/workers/workerState.js`
  - `docs/frontend/workers/workerRouter.js`
  - `docs/frontend/workers/libraryLoader.js`
  - `docs/frontend/workers/libraryIndex.js`
  - `docs/frontend/workers/libraryQuery.js`
  - `docs/frontend/workers/peakDetect.js`
  - `docs/frontend/workers/peakScoring.js`
  - `docs/frontend/workers/lineMatcher.js`
  - `docs/frontend/workers/qcRules.js`
  - `docs/frontend/workers/confidenceModel.js`
  - `docs/frontend/workers/analysisPipeline.js`

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

### Session update — GitHub Pages path migration (`/docs/frontend/`)

- Deploy target normalized to **GitHub Pages `/docs`**.
- Web app tree moved to **`docs/frontend/`** (capital F) to match current repo layout.
- Added **`docs/index.html`** redirect to `frontend/index.html` so Pages root resolves correctly.
- Updated documentation paths in `README.md` and `FunctionSpec.md` from `frontend/...` to `docs/frontend/...`.
- Sanity check: relative paths inside `docs/frontend/pages/recording.html` remain valid (`../scripts`, `../workers`).

**Phase 0 readiness:** ✅ Ready to upload and proceed (original SPECTRA file integration can start next).


- Added note: paths normalized to lowercase `docs/frontend/...` and Phase 0 harness patch applied.


## Session log 2026-02-23 (Phase 0 harness patch #2)
- **Touched files**
  - `docs/index.html`
  - `docs/frontend/index.html`
  - `docs/frontend/pages/recording.html`
  - `docs/frontend/scripts/graphScript.js`
  - `docs/frontend/scripts/calibrationScript.js`
  - `docs/frontend/scripts/referenceGraphScript.js`
  - `docs/frontend/scripts/cameraScript.js`
  - `docs/frontend/scripts/stripeScript.js`
  - `docs/frontend/scripts/setupScript.js`
  - `docs/frontend/scripts/imageLoadingScript.js`
  - `docs/frontend/scripts/dataSavingScript.js`
  - `docs/frontend/scripts/cameraSelection.js`
  - `docs/frontend/scripts/languageScript.js`
  - `docs/frontend/scripts/polynomialRegressionScript.js`
  - `docs/frontend/scripts/zipScript.js`
  - `docs/frontend/scripts/mod/coreHooks.js`
  - `README.md`
  - `FunctionSpec.md`

- **What changed**
  - Implemented a **Phase 0 baseline harness** with a placeholder CORE graph loop so script order, paths, and hook wiring can be tested on GitHub Pages before importing original SPECTRA files.
  - Added `coreHooks` + `coreBridge` read-only integration layer for upcoming Phase 1 patches.
  - Added lightweight compatibility placeholders for core SPECTRA globals/APIs (`SpectraCore`, graph, calibration, reference, stripe, camera).
  - Normalized documentation and deploy references to **`docs/frontend/`** (lowercase).

- **What passed (sanity)**
  - Relative script paths and worker path remain valid from `docs/frontend/pages/recording.html`.
  - Placeholder graph renders and emits frame hooks.
  - Calibration/reference hooks emit without breaking CORE placeholder runtime.
  - Existing worker demo buttons can still ping/analyze using the foundation worker client.

- **What remains / known gaps**
  - Original SPECTRA files are still placeholders and must be imported for real Phase 0 baseline parity.
  - No real camera → stripe → pixel extraction yet (placeholder render loop only).
  - Core HTML/CSS is a temporary harness, not the real SPECTRA recording UI.


## Session Log Update — Phase 0 real import (SPECTRA-1)

- **Status:** PARTIAL → Phase 0 real import baseline completed.
- Replaced placeholder core scripts in `docs/frontend/scripts/` with originals from `SPECTRA-1.zip` (recording stack scripts + helpers).
- Rebased `docs/frontend/pages/recording.html` on original SPECTRA-1 `recording.html` and patched component paths to local `../scripts/*`.
- Added non-invasive SPECTRA-PRO Phase 0 bridge overlay panel + mode tabs on top of original UI.
- Added `coreHooks` bridge and hook emit patches in `graphScript.js`, `calibrationScript.js`, and `referenceGraphScript.js`.
- Exposed minimal `window.SpectraCore` adapters for camera/stripe/calibration/reference/graph access.
- Known gaps: original SPECTRA style assets (`customColorsStyle.css`, `recordingStyle.css`) and translation dictionaries are not included in source zip, so layout/text polish may be degraded until those assets are copied.
- Next: Phase 1 patch = verify runtime errors on Pages, then harden hooks against exact SPECTRA globals and add CORE regression checklist results.


## Latest patch notes (Phase 1 hook shell)

### Done in this patch
- Patched `graphScript.js` with a **read-only frame hook** on `drawGraph()` (emits frame every render tick; includes RGB + combined intensity and nm-axis when calibrated).
- Patched `calibrationScript.js` / `referenceGraphScript.js` bridge helpers with richer state accessors.
- Added `mod/proBootstrap.js` to wire core hook events → store, create the **SPECTRA-PRO P1 panel**, and start worker foundation safely.
- Implemented minimal `overlays.js` no-op overlay hook (reserved integration point, no CORE rendering changes).
- Added dark-theme `styles.css` that preserves the **original SPECTRA layout structure** (large graph, sidebars, calibration list behavior) while using custom colors.
- Added `mod-panels.css`, `overlays.css`, `mobile-tweaks.css` shells for PRO UI styling.

### Sanity expectations after patch
- CORE view should still load and render graph/camera flow.
- A small **SPECTRA-PRO** panel should appear bottom-right with CORE/LAB/ASTRO tabs and live status.
- Switching modes updates panel state only (no heavy analysis claims yet).
- If the worker file is still scaffolded, worker status may show `error` or stay `idle` without breaking CORE.
