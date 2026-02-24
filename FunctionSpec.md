## Patch update – Phase 2.1 dock/layout stabilization (current)

- Fixed SPECTRA-PRO dock mounting so **SpectraProDockHost** is now injected directly into `#graphSettingsDrawerLeft` (the drawer under the graph).
- Moved original graph controls (`#graphSettingsContent`, including p-2/px-2 content) into **General** tab inside the dock.
- Kept a persistent right-side status rail (`SPStatusRail`) inside the dock body, always visible.
- Removed/hidden legacy floating SPECTRA-PRO panel if present (prevents duplicate UI).
- Added authoritative dock CSS rules in `docs/frontend/styles/mod-panels.css` to prevent empty/hidden tab panel regressions.
- Forced drawer/sidebar toggle handles to remain visible (no hover-disappear behavior).
- Remaining work: wire actual LAB/ASTRO/Other controls into `sp-tabpanel` containers; refine mobile compaction.

# FunctionSpec.md — SPECTRA-PRO implementation plan and status tracker

This file defines **how we build SPECTRA-PRO safely**, in what order files are patched, and how we avoid breaking CORE mode while adding LAB and ASTRO features.

The project is scaffold-first: many files exist as placeholders so the structure is visible before implementation. This spec is the working contract for incremental patching.

---

## Project naming
- **App name (UI/product):** `SPECTRA-PRO`
- **Current GitHub/repo working name:** `astro-spectra-mod`

---

## Current state (updated after Phase 2 LAB-MVP + Phase 2.1 UI docking patch)

### What is already present
- Full folder structure for frontend, worker, docs, tests
- Placeholder files for original SPECTRA scripts and PRO modules
- Placeholder data/preset/library files
- Basic language files
- Initial README scaffold (now replaced by expanded version)

### Phase 1.5 notes (previous patch)
- Added **v5-inspired CORE controls bridge** in the SPECTRA-PRO panel (display mode, Y-axis mode placeholders, peak lower bound, fill opacity)
- Added **data quality mini-readout** (dynamic range / saturation risk shell) derived from live frame hook
- Restored important **recording layout geometry** from original CSS while keeping dark theme colors
- Fixed overlay/toast containment so info/error UI does not spill into the right side panel area
- Added extra resize/layout stabilization on boot to reduce graph/stripe visual mismatch after load


### Phase 2.1 notes (this patch)
- Moved SPECTRA-PRO controls from floating bottom-right modal into the **bottom drawer** (integrated with graph controls area)
- Added **tabbed PRO sections**: General / CORE controls / LAB / ASTRO / Other
- Added always-visible **Status + Data Quality dock** on the right side of the PRO row (responsive fallback stacks on smaller widths)
- Removed redundant **Home** button from bottom-right drawer area (reduced clutter)
- Relabeled original **FLR** button to **Long Exposure** for clarity (kept original functionality)
- Updated button color styling to fit the blue/dark theme (replacing bright green visual mismatch)

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

**Status:** `PARTIAL` (LAB MVP shell + worker hooks present; PRO controls now docked in bottom drawer with tabbed sections and always-visible status/data-quality area)

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

**Status:** `PARTIAL` (LAB MVP shell + worker hooks present; PRO controls now docked in bottom drawer with tabbed sections and always-visible status/data-quality area)

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

**Status:** `PARTIAL` (LAB MVP shell + worker hooks present; PRO controls now docked in bottom drawer with tabbed sections and always-visible status/data-quality area)

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

**Status:** `PARTIAL` (LAB MVP shell + worker hooks present; PRO controls now docked in bottom drawer with tabbed sections and always-visible status/data-quality area)

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


## Hotfix after Phase 1.5 (2026-02-23)

### Fixed
- **Lag / stack overflow loop** in `proBootstrap.js` + `stateStore.js` (state render -> state update recursion on `state:changed`).
- **`drawGraph` wrapper crash** (`Cannot set properties of undefined (setting 'width')`) by guarding Phase 1 wrapper until original graph canvases are initialized.
- **Info popup close UX** improved by restoring sane popup box sizing (`#infoPopupInside`, `#errorBoxInside`) instead of the oversized 20% padding rule.
- **GitHub Actions CI** made scaffold-safe when no `backend/` exists yet, and frontend smoke paths updated to `docs/frontend/...`.

### Notes
- P1.5 layout fix no longer mutates stripe canvas geometry (this could desync stripe preview vs graph in original SPECTRA layout).
- CORE safety remains priority: hooks/panel must never break original draw loop.


## Patch Update – Phase 2 (LAB-MVP kickoff)

### Done in this patch
- Fixed adapter to derive `nm[]` from calibration polynomial when CORE frame only has px/intensity.
- Added built-in lite atomic library in worker (H, Na, Hg, Ne, Ca) so LAB-MVP can produce real top hits without engine7 files yet.
- Implemented basic worker line matching + median offset estimate (calibrated data only).
- Upgraded SPECTRA-PRO panel from passive shell to LAB-MVP control surface:
  - Init libraries / Ping worker
  - LAB preset selector (state only for now)
  - Worker on/off toggle (state flag)
  - Capture Dark / Capture Ref / Clear (buffer-state stubs)
  - Top Hits list rendering + confidence + observed nm
  - Worker libs-ready status in panel
- Removed recursive store-write from panel render loop (the old `qualityRender` update) to avoid lag/stack overflows.
- Blue/dark button color cleanup in PRO panel (removes green feel).

### Still missing for full LAB-MVP
- True subtraction math (currently capture buttons store state only)
- Overlay markers in graph for matches
- Preset-aware filtering in worker
- Export of LAB hits/QC metadata
- Engine7 library loading from JSON files (currently built-in lite fallback)

## Incremental Updates

- **Hotfix (P2.1 UI dock):** Forced SPECTRA-PRO panel to dock inside `#graphSettingsDrawerLeft` with explicit non-floating style reset (prevents legacy/cached floating panel CSS from collapsing layout in bottom-right corner).

## Latest hotfix notes
- Hotfix 2.1.3: CI frontend-smoke path check now accepts merged `docs/frontend/styles/styles.css`; SPECTRA-PRO dock moved to dedicated host below graph settings; compact layout to avoid page scrollbar and stop overlap with drawer toggles.


- **Phase 2.1 hotfix (dock placement + CSS):** PRO dock is now mounted below `#graphSettingsDrawer` (not nested inside graph controls), scrollbar overflow guarded, and drawer toggle arrows forced above overlays. CI frontend smoke CSS check accepts consolidated styles file.

## Phase 2.1 UI hotfix (General + status rail layout)

### Fixed in this patch
- **General tab now loads the real original SPECTRA graph controls** (the existing `.p-2` / `.px-2` blocks from `#graphSettingsDrawerLeft`) instead of an empty placeholder panel.
- **SPECTRA-PRO dock host is the only visible panel container** in the lower drawer; legacy drawer children are hidden after being re-mounted into the dock UI.
- **Status + Data Quality rail** is now a fixed right-side area and renders the two cards **side-by-side** (desktop) instead of stacked.
- Removed redundant **brandline / pill branding UI** in the status rail to save vertical space.
- **CORE controls placeholder restored** with `App mode`, `Worker`, and action buttons (`Init libraries`, `Ping worker`, `Refresh UI`).
- **Double-border issue reduced** by removing inner card framing in the General tab so original controls can use the panel space directly.
- **Drawer toggle arrows** are force-kept visible via CSS overrides (`opacity/visibility/display/pointer-events`) to stop the disappearing-hover bug.
- **CI/frontend smoke** remains fixed (path checks no longer fail after style consolidation).

### Notes
- This patch intentionally uses strong CSS overrides at the end of `mod-panels.css` to beat legacy rules while the layout is still evolving.
- Next UI cleanup pass can move these overrides into a single canonical PRO stylesheet once layout stabilizes.

## Patch 2026-02-24 – GUI recovery (bottom dock regression)

### klart
- `proBootstrap.js` rewritten to a **minimal, compatibility-first dock bootstrap**.
- General-tab now mounts the **actual original graph controls** from `#graphSettingsDrawerLeft` (Reset Zoom, Step Back, RGB toggles, x-axis labels, peaks, lower bound, etc.) without renaming IDs.
- Dock tabs (General / CORE controls / LAB / ASTRO / Other) rebuilt with stable tab switching (no panel duplication).
- Status/Data Quality rail rebuilt as a fixed right column with **two cards side-by-side**.
- Added popup cleanup guard for accidental default `Info message` visibility on load.
- CSS overrides appended to keep dock in normal flow under graph and preserve drawer handles.

### påbörjat
- Data Quality text is rendered defensively from available frame data if present (falls back gracefully when worker/frame payload shape differs).
- CORE controls tab is placeholder wiring only (safe state updates, no heavy logic changes).

### kvar
- Deeper cleanup of historical `mod-panels.css` hotfix layers (many old conflicting overrides still remain in file, but are superseded by final patch block).
- Optional refactor to move dock styles into one canonical stylesheet section once UI is stable.

### kända risker
- `mod-panels.css` contains many legacy overrides from earlier sessions; this patch intentionally wins by appending authoritative rules last.
- If future patches again move `#graphSettingsDrawerLeft` children before `proBootstrap` runs, General mounting may need a small selector adjustment.

### regression-logg
- Root cause was a **wrong DOM hosting strategy** while converting a floating dock to a bottom-docked dock: previous patch moved/targeted the wrong drawer side (`Right`) and stacked multiple incompatible CSS hotfixes.
- A critical CSS rule (`#graphSettingsDrawerLeft > :not(#SpectraProDockHost){display:none !important;}`) hid the real original controls unless they were rehosted correctly.
- Repeated broad CSS overrides changed dock DOM assumptions (`.sp-*` class names/layout models), causing tabs/visibility mismatches and null lookups in surrounding UI code.
