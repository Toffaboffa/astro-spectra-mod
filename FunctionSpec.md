# FunctionSpec.md — SPECTRA-PRO implementation plan, file map and status tracker

This document is the **single source of truth** for:
- what SPECTRA-PRO is supposed to do,
- which files/modules exist and what they are responsible for,
- what is currently implemented vs scaffold/placeholder,
- what was changed in recent patches,
- what remains (with patch order and QA gates).

It must be updated on every patch so the codebase and plan do not drift.

---

## Project identity
- **Product/UI name:** `SPECTRA-PRO`
- **Repo working name:** `astro-spectra-mod`
- **Deployment target:** static frontend (GitHub Pages via `docs/`)

---

## Product goal (aligned with README)

SPECTRA-PRO is a **frontend-first spectrum analysis workstation** built on top of the original SPECTRA recording workflow (camera → stripe → live spectrum graph), extended with a PRO shell and staged analysis features.

### Core idea
Keep the browser instrument feel (fast graph, live camera/stripe workflow) and layer on:
- **CORE mode** (safe baseline, SPECTRA-like)
- **LAB mode** (teaching/lab line ID + subtraction/quality workflows)
- **ASTRO mode** (solar/stellar workflows, normalization, absorption handling, molecular bands, preliminary offset/Doppler)

### Architectural constraint
Heavy analysis must run in a **Web Worker** so the UI remains responsive.

---

## Functional scope (what the app should support)

This section is the product-level checklist. Phases below describe *when* each part lands.

### A. CORE instrument workflow (SPECTRA-compatible foundation)
- Live camera or loaded image source
- Stripe width and stripe position controls
- Stripe preview overlay in camera view
- Real-time graph rendering from stripe pixel data (RGB + combined intensity)
- Graph zoom / pan / reset / back / forward
- Peak visualization (basic)
- Reference curves / comparison curves
- Calibration px ↔ nm (polynomial fit)
- Calibration quality / residual feedback (where original supports it)
- Export graph image, source image, and numeric data

### B. PRO modes (shell behavior)
- **CORE mode** — stable baseline behavior
- **LAB mode** — line ID, subtraction, absorbance/transmittance workflows, top hits, presets
- **ASTRO mode** — normalization, absorption handling, presets, molecular bands, offset/Doppler (staged)

### C. PRO dock / GUI (integrated under graph)
- Bottom dock integrated in graph settings area (not floating)
- Tabs: `General`, `CORE controls`, `LAB`, `ASTRO`, `Other`
- **General** hosts real original graph controls (no fake duplicates)
- Persistent status rail on the right: **Status** + **Data Quality**
- Stable drawer height / no accidental layout jumps

### D. Phase 1.5 (v5-inspired, CORE-safe UX upgrades)
- Display modes (Normal / Difference / Ratio / etc.)
- Data quality panel (saturation, dynamic range, QC shell)
- Y-axis controls (auto/fixed)
- Peak threshold/distance/smoothing controls
- Graph appearance / fill controls
- Camera capability abstraction (unsupported-safe)
- Calibration I/O + multipoint manager shell

### E. Phase 2 (LAB MVP)
- Worker foundation + protocol (`PING`, library init, frame analysis)
- Library loading/index/query (initial atomic lines)
- Peak detection/scoring/matching + QC + confidence
- Throttled live LAB analysis
- Top hits panel + overlays
- Subtraction modes (dark/reference minimum)
- Preset plumbing + quick peaks / processing pipeline integration

### F. Phase 3 (ASTRO MVP)
- Continuum normalization
- Smoothing/normalization pipeline
- Absorption/emission mode (auto/manual)
- Solar/Fraunhofer presets
- Offset estimate + QC
- Preliminary Doppler estimate (quality-gated)
- Molecular band matching (first pass)
- Species search / preset resolver

### G. Phase 4 (quality/reproducibility/export+)
- Instrument response correction
- Response profile store
- Instrument profile
- Observation profile
- Session capture
- Flat field (staged)
- Export augmentation (PRO metadata + QC + results)

---

## Guiding rule (non-negotiable)

**CORE mode must remain usable and stable.**

Every patch must preserve:
1. CORE works without worker analysis,
2. PRO modules can fail/disable safely,
3. LAB/ASTRO errors must not brick camera/stripe/graph workflow.

---

## Ownership and duplication policy (CORE boundary map)

This section clarifies **what is original SPECTRA-1 vs what is SPECTRA-PRO**, so we avoid accidental duplicate engines while preserving all PRO ideas.

### Ownership types
- **Primary (Original)** — the original script/DOM is the real source of truth. PRO may host or observe it, but must not create a parallel engine in CORE.
- **Primary (PRO)** — new SPECTRA-PRO behavior/control added on top of the original instrument.
- **Bridge** — PRO imports/exports/manages workflow state, then applies into the original pipeline.
- **Host/Mirror** — PRO re-homes the real original controls/UI in a new tab/container (no fake duplicate logic).
- **Override (visual)** — PRO may override rendering behavior in a reversible way without mutating underlying captured data.

### CORE boundary map (current decisions)
| Area | Owner | PRO role | Rule / duplicate-risk decision |
|---|---|---|---|
| Camera acquisition / stream lifecycle | Original | Observe + status + capability probe | No parallel camera engine in CORE. `Probe camera` is diagnostic only. |
| Stripe selection / preview overlay | Original | Observe/status hooks | Preserve original interaction model. |
| Live graph rendering loop | Original | Visual override hooks | PRO may alter display transform / scaling / fill, but must keep graph loop intact and reversible. |
| General graph controls | Original | Host/Mirror in `General` tab | Same DOM nodes, same IDs. No cloned controls. |
| Calibration solve / coefficients | Original | Bridge (`point 20`) | PRO shell may import/manage/export points and apply them into original calibration inputs + `setCalibrationPoints()`. No parallel solver in CORE. |
| Reference capture / compare curves | Original | Observe + status | Original behavior remains authoritative in CORE. |
| Status + Data Quality | PRO | Primary (PRO) | Unified diagnostics layer reading store/hooks without replacing instrument logic. |
| Worker controls / library init | PRO | Primary (PRO) | Optional path; CORE must remain usable without worker. |
| Display modes / Y-axis / Fill modes | PRO | Primary (PRO visual override) | Accepted PRO additions because they are reversible and LAB/ASTRO-prep. |
| Peak threshold/distance/smoothing (PRO panel) | PRO | Primary (PRO analysis-facing control) | Coexists with original graph controls; semantics must stay documented. |
| Calibration I/O text shell / point manager | PRO | Primary (PRO shell) + Bridge | Workflow layer for import/export/presets; apply target is original calibration pipeline. |

### Anti-duplication rule (explicit)
If a new CORE patch adds a control resembling an original capability, patch notes/spec must tag it as **Host/Mirror**, **Bridge**, or **Primary PRO**. This preserves your feature ideas while preventing hidden duplicate engines.

---

## Canonical file map (what exists and what belongs where)

> This section is the “where things should be” map. It is intentionally explicit.

### 1) Entry points / Pages
- `docs/index.html`
  - GitHub Pages entry/redirect
- `docs/frontend/index.html`
  - Frontend landing page (project shell)
- `docs/frontend/pages/recording.html`
  - **Main instrument page** (camera/graph/calibration + SPECTRA-PRO integration)

### 2) Styles
- `docs/frontend/styles/styles.css`
  - Base UI/layout styling (original SPECTRA-compatible + merged overrides)
- `docs/frontend/styles/mod-panels.css`
  - SPECTRA-PRO dock/status/tab layout styling (currently contains layered hotfix history)
- `docs/frontend/styles/overlays.css`
  - Overlay-related styling
- `docs/frontend/styles/mobile-tweaks.css`
  - Mobile-specific tweaks

### 3) Original SPECTRA scripts (CORE stack) — `docs/frontend/scripts/`
These are the baseline scripts that must keep working.
- `cameraScript.js`
- `stripeScript.js`
- `graphScript.js`
- `calibrationScript.js`
- `referenceGraphScript.js`
- `dataSavingScript.js`
- `imageLoadingScript.js`
- `setupScript.js`
- `cameraSelection.js`
- `languageScript.js`
- `polynomialRegressionScript.js`
- `zipScript.js`

### 4) PRO integration/UI modules — `docs/frontend/scripts/mod/`
#### 4a) Shell/foundation (Phase 1 core)
- `coreHooks.js` — bridge namespace/hooks into original scripts
- `eventBus.js` — app event bus (`sp.eventBus`)
- `stateStore.js` — store (`sp.store`)
- `appMode.js` — mode API (`CORE/LAB/ASTRO`)
- `uiPanels.js` — panel helpers / UI shell helpers
- `spectrumFrameAdapter.js` — frame adaptation helpers
- `overlays.js` — graph overlay hook (currently no-op-safe)
- `proBootstrap.js` — SPECTRA-PRO dock bootstrap, General hosting, status rail, CORE-tab controls wiring
- `analysisWorkerClient.js` — browser worker client wrapper

#### 4b) Phase 1.5 UX modules (currently mostly scaffold)
- `displayModes.js`
- `dataQualityPanel.js`
- `yAxisController.js`
- `peakControls.js`
- `graphAppearance.js`
- `cameraCapabilities.js`
- `calibrationIO.js`
- `calibrationPointManager.js`

#### 4c) Phase 2+/support modules (mixed scaffold/partial)
- `libraryClient.js`
- `libraryFilters.js`
- `processingPipeline.js`
- `subtraction.js`
- `quickPeaks.js`
- `presets.js`
- `calibrationBridge.js`

#### 4d) Phase 3+ ASTRO modules (mostly scaffold)
- `continuum.js`
- `normalization.js`
- `smoothing.js`
- `calibrationPresets.js`
- `speciesSearch.js`

#### 4e) Phase 4 modules (mostly scaffold)
- `instrumentResponse.js`
- `responseProfileStore.js`
- `instrumentProfile.js`
- `observationProfile.js`
- `sessionCapture.js`
- `exportAugment.js`
- `flatField.js`

#### 4f) Utility
- `utils.js`

### 5) Worker modules — `docs/frontend/workers/`
#### Worker runtime/foundation
- `analysis.worker.js`
- `workerRouter.js`
- `workerTypes.js`
- `workerState.js`

#### Library and analysis pipeline
- `libraryLoader.js`
- `libraryIndex.js`
- `libraryQuery.js`
- `peakDetect.js`
- `peakScoring.js`
- `lineMatcher.js`
- `qcRules.js`
- `confidenceModel.js`
- `analysisPipeline.js`

#### ASTRO/advanced worker modules (planned/staged; may be absent or scaffold)
- `autoMode.js`
- `offsetEstimate.js`
- `dopplerEstimate.js`
- `bandMatcher.js`
- `presetResolver.js`

### 6) Data assets
- `docs/frontend/data/` (libraries, response profiles, presets; staged additions)
- Example currently present/planned:
  - `instrument_response_profiles.json`

### 7) Documentation and tests
- `README.md` — product vision + architecture overview
- `FunctionSpec.md` — implementation contract and status tracker (this file)
- `docs/v5_gap_additions.md` — gap analysis / planned additions
- `tests/` — patch-specific test notes/smoke docs (as used)

---

## Runtime load map (what is currently loaded on `recording.html`)

### Currently loaded (classic `<script>` path)
`recording.html` loads these PRO modules directly:
- `mod/coreHooks.js`
- `mod/eventBus.js`
- `mod/stateStore.js`
- `mod/appMode.js`
- `mod/uiPanels.js`
- `mod/spectrumFrameAdapter.js`
- `mod/overlays.js`
- `mod/analysisWorkerClient.js`
- `mod/displayModes.js`
- `mod/dataQualityPanel.js`
- `mod/yAxisController.js`
- `mod/peakControls.js`
- `mod/graphAppearance.js`
- `mod/cameraCapabilities.js`
- `mod/calibrationIO.js`
- `mod/calibrationPointManager.js`
- `mod/proBootstrap.js`

### Activation state (important)
Phase 1.5 modules (`displayModes.js`, `yAxisController.js`, etc.) are now **loaded as classic-script-compatible scaffold modules** and exposed under `window.SpectraPro.v15`, but are not yet functionally integrated into graph behavior.

### Compatibility trap (must remember)
Phase 1.5 scaffold modules have been converted to **classic-script-compatible namespace modules** under `window.SpectraPro.v15` in Step 3. Future additions should follow the same browser-safe pattern unless the page is migrated to `type=module`.

---

## Current implementation status snapshot (aligned with latest patch)

### Status legend
- `TODO` = not started
- `SCAFFOLD` = file exists, placeholder only
- `PARTIAL` = basic implementation exists, not production-ready
- `READY` = implemented and manually verified (or patch-level verified)
- `DEFERRED` = intentionally postponed

### A. CORE baseline import and compatibility
- **Phase 0 original SPECTRA import into `docs/frontend/`:** `READY`
- **CORE page pathing / Pages harness:** `READY`
- **CORE camera/stripe/graph/calibration/export behavior parity:** `PARTIAL` (functional baseline exists; visual polish/asset parity may still differ)

### B. PRO shell (items 5–8)
#### 5) App mode / mode handling (`CORE/LAB/ASTRO`)
- `PARTIAL`
- `appMode.js` API exists and emits `mode:changed`.
- **Latest Step 1 patch:** CORE-tab App Mode selector in `proBootstrap.js` now routes through `sp.appMode.setMode(...)` when available (instead of store-only writes).

#### 6) State store + event bus
- `PARTIAL` (foundation strong)
- `eventBus.js` and `stateStore.js` are present and working as shell primitives.
- Remaining work is normalization/consistent usage (not existence).

#### 7) Read-only hooks into original scripts (graph/calibration/reference)
- `PARTIAL` → strong
- Hooks exist in `graphScript.js`, `calibrationScript.js`, `referenceGraphScript.js` and publish bridge data/events.
- Remaining work: normalize state sync and reduce hybrid reads.

#### 8) Overlay hook (PRO overlay integration point)
- `READY` (shell-level)
- `overlays.js` exists and is no-op-safe; `graphScript.js` can call it without changing CORE rendering semantics.

### C. PRO dock / GUI (items 9–13)
#### 9) Bottom dock under graph (non-floating)
- `READY`
- Recovered from floating-to-bottom regression; dock integrated under graph controls area.

#### 10) Tab row (General / CORE controls / LAB / ASTRO / Other)
- `READY`
- Stable tab switching and panel containers present.

#### 11) General tab hosts real original graph controls
- `READY`
- Original controls are re-mounted into General (real DOM nodes, original IDs preserved).

#### 12) CORE controls tab (PRO shell controls)
- `PARTIAL`
- UI exists and is visible.
- **Latest Step 1 patch:** Worker controls now attempt to use `analysisWorkerClient` (`start/stop/ping/initLibraries`) with safe fallback behavior.
- Still not full LAB control surface (many controls remain shell/placeholder level).

#### 13) Status rail (Status + Data Quality)
- `PARTIAL`
- Layout/placement is good and stable.
- Status/Data Quality is store-normalized (Step 2) with module-based DQ compute; standalone DQ panel UI still pending.

### D. Phase 1.5 v5-inspired UX upgrades (items 14–20)
#### 14) Display modes
- `READY` (core-safe visual override)
- UI selector writes `state.display.mode`; `graphScript.js` applies transforms: `NORMAL`, `DIFFERENCE`, `RATIO`, `TRANSMITTANCE`, `ABSORBANCE` (requires a captured reference curve).

#### 15) Data Quality module
- `PARTIAL`
- `dataQualityPanel.js` computes Status + DQ metrics and is rendered in the Status rail.
- Standalone “Data Quality” panel UI is not yet implemented (no drill-down UX).

#### 16) Y-axis controls
- `READY`
- UI selector writes `state.display.yAxisMode` (`auto|fixed_255|manual`) and `state.display.yAxisMax`; `graphScript.js` applies scaling.

#### 17) Peak controls (threshold/distance/smoothing)
- `READY` (basic controls)
- UI writes `state.peaks.*`; `graphScript.js` reads them via `sp.v15.peakControls.getEffective(...)` and passes into peak detection.

#### 18) Graph appearance / fill modes
- `PARTIAL+`
- Fill mode + opacity are wired (`state.display.fillMode`, `state.display.fillOpacity`) and applied in `graphScript.js` (`INHERIT|OFF|SYNTHETIC|SOURCE`).
- Remaining: define final semantics for `SOURCE` across zoom ranges + document in UI/help.

#### 19) Camera capability abstraction
- `PARTIAL+`
- `cameraCapabilities.js` provides `probeCurrent()` and normalizes supported/values/ranges.
- Status rail shows camera support summary (exposure/zoom/resolution). No direct camera-parameter controls are exposed (intentionally core-safe).

#### 20) Calibration I/O + multipoint manager shell
- `PARTIAL+`
- `Other` tab contains the shell manager (JSON/CSV import/export, capture current points).
- `Apply shell to calibration` maps shell points into the original calibration pipeline (core-safe bridge).
- Remaining: outlier/disable UX + rollback affordance; more explicit validation preview and warnings.


### E. Phase 2 LAB MVP
- `PARTIAL` (end-to-end MVP loop exists, but feature surface is incomplete)

**What is implemented now**
- Worker protocol is functional: `PING → PONG`, `INIT_LIBRARIES`, `ANALYZE_FRAME → ANALYZE_RESULT`.
- `analysisWorkerClient.js` is wired and updates store:
  - `worker.*` (status, hz, librariesLoaded, errors)
  - `analysis.topHits`, `analysis.qcFlags`, `analysis.offsetNm` (when present)
- LAB panel has a working MVP loop:
  - App mode = `LAB`
  - Toggle **Analyze** + set **Max Hz**
  - After **Init libraries**, frames are throttled and sent to the worker
  - Results render in **Top hits** and **QC** lists.

**Current limitations / still missing**
- Library is currently **builtin-lite** (hardcoded minimal atomic lines in worker) — no external JSON library loading yet.
- Presets are placeholder-level (no real resolver/plumbing yet).
- “Query library” button is placeholder.
- Subtraction/absorbance workflows are not yet wired into the live analysis pipeline (modules exist, plumbing pending).
- Overlay labels are not yet rendered on the graph (overlay hook exists, but labeling is not implemented).


### F. Phase 3 ASTRO MVP
- `SCAFFOLD/PARTIAL` (mostly scaffold modules present)

### G. Phase 4 correction/profiles/export+
- `SCAFFOLD` (modules/files mostly placeholders)

---

## Patch order and roadmap (controlled implementation plan)

### Phase 0 — Baseline import harness (completed)
**Goal:** run original SPECTRA UI inside this repo.
- `recording.html`, styles, original scripts imported into `docs/frontend/`
- Pages-safe pathing/harness validated

**Status:** `READY`

### Phase 1 — Safe hooks + PRO shell (in progress)
**Goal:** create integration points and dock shell without changing instrument behavior.

Primary files:
- `mod/appMode.js`, `mod/stateStore.js`, `mod/eventBus.js`
- `mod/spectrumFrameAdapter.js`, `mod/uiPanels.js`, `mod/overlays.js`
- hook patches in `graphScript.js`, `calibrationScript.js`, `referenceGraphScript.js`
- `mod/proBootstrap.js`

Must be true before Phase 1 closes:
- CORE still behaves correctly
- frame/calibration/reference states are readable via hooks/bridge
- dock UI exists and does not break original graph controls
- overlays hook exists and is safe

**Status:** `PARTIAL`

### Recovery roadmap to complete Phase 1 → 1.5 (current focus)

#### Step 1 — Shell wiring hardening (implemented)
**Goal:** make PRO shell controls talk to real shell APIs instead of placeholder state writes.

Implemented in latest patch:
- Route App mode UI through `sp.appMode.setMode(...)`
- Add safe worker client singleton init in `proBootstrap.js`
- Wire CORE-tab Worker mode (`Auto/On/Off`) to worker client start/stop behavior (with fallback)
- Wire `Ping worker` to real client `ping()` (with fallback)
- Wire `Init libraries` to real client `initLibraries(...)` (with fallback marker state)
- Add worker-event listeners (`worker:ready`, `worker:libraries`, `worker:error`, `worker:timeout`, `worker:result`) so status UI refreshes more reliably

Success criteria:
- Mode changes emit `mode:changed`
- Ping/Init trigger real worker path when client is available
- No new CORE null errors

**Status:** `READY`

#### Step 2 — Shell state normalization + status rail correctness (implemented)
**Goal:** remove hybrid “reads from everywhere” behavior and make Status/Data Quality deterministic.

Planned scope:
- Normalize live frame sync into `store.frame.latest` via throttled bridge updates
- Normalize calibration/reference sync into store-backed state nodes
- Make status/data-quality read primarily from store (fallbacks only as guards)
- Add explicit worker mode state (`auto|on|off`) instead of inferring from enabled/status
- Keep UI changes minimal (only readability/equal-height polish if needed)

Success criteria:
- Stable Status/Data Quality across reloads and mode switches
- Minimal direct reads from `window.SpectraCore` in render path
- No render-loop regressions

**Status:** `READY`

#### Step 3 — Phase 1.5 activation scaffold (load path + compatibility wrappers) (implemented)
**Goal:** make 14–20 load safely without breaking classic-script pages.

Planned scope:
- Convert Phase 1.5 scaffold modules from ESM `export` syntax to browser-safe namespace modules **or** add module loader wrapper
- Add safe script load path/order in `recording.html`
- Expose a single `sp.v15` namespace for panel integration
- Keep features default-off until each slice is wired

Success criteria:
- No `Unexpected token 'export'` errors
- Modules are loaded and inspectable
- CORE unaffected when idle

**Status:** `READY`

#### Step 4 — Phase 1.5 functional controls (incremental slices)
**Goal:** implement actual user-facing v5-style controls in small, testable slices.

Recommended order:
1. Display modes (14)
2. Y-axis controls (16)
3. Data Quality module integration (15)
4. Peak controls (17)
5. Graph appearance/fill (18)
6. Camera capability abstraction (19)
7. Calibration I/O + multipoint shell (20)

Success criteria:
- Each slice lands with CORE regression check
- Controls affect graph behavior intentionally (not placeholder-only)
- Features are safe to disable

**Status:** `IN PROGRESS`

### Phase 2 — Worker foundation + LAB MVP (after 1.5 shell activation)
**Goal:** live identification in LAB mode without freezing UI.

Key modules:
- `analysisWorkerClient.js`
- worker protocol/router/state + loader/index/query/matching pipeline files
- `subtraction.js`, `quickPeaks.js`, `processingPipeline.js`, `presets.js`, `library*` modules

Must be true before phase ends:
- Worker responds to `PING`
- Library can initialize/load (at least minimal atomic set)
- LAB mode can analyze throttled frames
- Top hits panel shows results
- Overlay labels work
- Dark/reference subtraction minimum path works

**Status:** `PARTIAL` (foundation/scaffold exists; full LAB integration not complete)

### Phase 3 — ASTRO MVP
**Goal:** make ASTRO mode meaningfully different and useful for solar/stellar data.

Must be true before phase ends:
- Continuum normalization available
- Absorption/emission handling works (auto/manual)
- Solar/Fraunhofer preset exists
- Offset estimate + QC shown
- Preliminary Doppler display quality-gated
- Basic molecular band matching first pass

**Status:** `SCAFFOLD/PARTIAL`

### Phase 4 — Response correction, profiles, export augmentation
**Goal:** improve measurement quality, reproducibility, and export completeness.

Must be true before phase ends:
- Response correction workflow works (basic)
- Instrument/observation profiles captured
- Export augmented with PRO metadata + QC

**Status:** `SCAFFOLD`

---

## Known risks / regression traps (must be remembered)

### GUI/dock risks
- `mod-panels.css` still contains historical layered hotfixes; newer patches currently win by appending authoritative overrides.
- Moving children inside `#graphSettingsDrawerLeft` can break General-tab rehosting if selectors/host timing are changed carelessly.
- Broad CSS resets can hide original graph controls and cause downstream null errors.

### Runtime integration risks
- Status/Data Quality now normalizes graph/calibration/reference into store; guarded fallbacks remain only as resilience if sync has not fired yet.
- Phase 1.5 scaffold modules are now classic-script-safe, but remain placeholder-only and must not silently alter CORE behavior until each Step 4 slice is wired and QA-tested.
- Worker controls in CORE-tab are now wired, but must remain optional and fail-safe.

---

## QA gates (minimum required checks)

### CORE gate (must pass before Phase 2 work expands)
- Camera starts/stops
- Stripe moves and updates graph
- Graph remains responsive
- Calibration still works
- Export still works
- No console errors from PRO scripts when mode=`CORE`

### LAB gate (before Phase 3)
- Worker loop does not tank FPS
- Top hits update and are mode-filtered
- Ratio/difference/absorbance produce expected changes
- Saturation warning appears when signal clips
- Turning overlays off restores clean graph

### ASTRO gate (before Phase 4)
- Continuum normalization improves line visibility on solar sample
- Fraunhofer preset reduces false positives vs general mode
- Offset/Doppler display hides at low confidence

---

## Patch maintenance protocol (how to update this file every patch)

Every patch session must update **all five**:
1. **Current status snapshot** (what is READY/PARTIAL/SCAFFOLD/TODO)
2. **Files touched** (exact list)
3. **What changed** (functional summary)
4. **What remains / known risks**
5. **Session log entry** (append-only)

This prevents “spec drift” where the GUI looks newer than the documentation.

---

## Session log (append-only)

### 2026-02-24 — GUI recovery + dock stabilization (v2/v3 hotfix line)
**Touched files (across hotfixes):**
- `docs/frontend/scripts/mod/proBootstrap.js`
- `docs/frontend/styles/mod-panels.css`
- (spec updated later)

**What changed**
- Recovered bottom-docked PRO layout after floating→bottom regression.
- Rebuilt a compatibility-first dock bootstrap.
- General tab now hosts real original graph controls (DOM rehosting, IDs preserved).
- Status/Data Quality rail restored on right side of dock.
- Drawer/dock CSS stabilized so bottom dock renders in normal flow.
- Fixed hidden-dock regression caused by legacy CSS selector expecting `#SpectraProDockHost` as direct child.
- Added status/data-quality live rendering improvements and drawer-height/overflow stabilizers (v3 CSS/JS hotfix line).

**Known remaining issues after this line**
- Status/Data Quality normalized to store-backed state with throttled graph/calibration/reference sync; guarded fallback reads remain.
- `mod-panels.css` still carries historical override baggage.

### 2026-02-25 — Phase 1→1.5 Step 1 shell wiring hardening
**Touched files:**
- `docs/frontend/scripts/mod/proBootstrap.js`
- `FunctionSpec.md`

**What changed**
- CORE-tab App mode control now uses `sp.appMode.setMode(...)` when available.
- Added safe worker client bootstrap (`analysisWorkerClient`) in `proBootstrap.js`.
- Wired worker mode (`Auto/On/Off`) to start/stop/lazy behavior with safe fallback.
- Wired `Ping worker` and `Init libraries` buttons to real worker-client methods when available.
- Added worker-event listeners to keep status UI refresh responsive.
- No layout/CSS/DOM refactor in this step.

**What passed (patch-level expectations)**
- No original control IDs renamed/removed.
- Shell wiring improved without changing recording.html script order.
- Fallback behavior remains when worker client is unavailable.

**What remains next**
- Step 3: safely load/activate Phase 1.5 scaffold modules.
- Step 4: implement 14–20 in small slices.
- Step 4: implement 14–20 in small slices.

---


### 2026-02-25 — Phase 1→1.5 Step 2 state normalization + status rail correctness
**Touched files:**
- `docs/frontend/scripts/mod/proBootstrap.js`
- `docs/frontend/scripts/mod/stateStore.js`
- `FunctionSpec.md`

**What changed**
- Added throttled store synchronization for `graphFrame` → `store.frame.latest/source` via `coreHooks` in `proBootstrap.js`.
- Added normalization for `calibrationChanged` and `referenceChanged` payloads into deterministic store nodes.
- Status/Data Quality render path now reads primarily from store-backed state (with guard fallbacks only).
- Added explicit `worker.mode` (`auto|on|off`) state and bound CORE worker select to that state.
- Reduced full-shell rerenders on high-frequency frame sync by routing frame/calibration/reference store updates to `renderStatus()` instead of `render()`.
- Status rail now reports reference state (`hasReference/count`) from store.

**What passed (patch-level expectations)**
- No original control IDs renamed/removed.
- No changes to `recording.html` load order.
- Frame sync is throttled via `requestAnimationFrame` to avoid render-loop pressure.

**What remains next**
- Step 4: implement 14–20 in small slices.


### 2026-02-25 — Phase 1→1.5 Step 3 activation scaffold (classic-script compatibility)
**Touched files:**
- `docs/frontend/pages/recording.html`
- `docs/frontend/scripts/mod/displayModes.js`
- `docs/frontend/scripts/mod/dataQualityPanel.js`
- `docs/frontend/scripts/mod/yAxisController.js`
- `docs/frontend/scripts/mod/peakControls.js`
- `docs/frontend/scripts/mod/graphAppearance.js`
- `docs/frontend/scripts/mod/cameraCapabilities.js`
- `docs/frontend/scripts/mod/calibrationIO.js`
- `docs/frontend/scripts/mod/calibrationPointManager.js`
- `docs/frontend/scripts/mod/proBootstrap.js`
- `FunctionSpec.md`

**What changed**
- Converted Phase 1.5 scaffold modules from ESM `export` syntax to classic-script-safe namespace modules under `window.SpectraPro.v15`.
- Added Phase 1.5 scaffold scripts to `recording.html` load order before `proBootstrap.js`.
- Added `sp.v15.registry` exposure/normalization in `proBootstrap.js` so loaded scaffold modules are discoverable/inspectable at runtime.
- Added lightweight status-line visibility of loaded v1.5 module count (scaffold activation only; no graph behavior changes).

**What passed (patch-level expectations)**
- No `export` syntax remains in the loaded Phase 1.5 scaffold files.
- `recording.html` still uses classic scripts (no `type=module` migration required).
- CORE DOM/selectors untouched.

**What remains next**
- Step 4: wire Phase 1.5 controls into actual graph behavior in small slices (start with Display modes + Y-axis). [IN PROGRESS: Display mode + Y-axis slice implemented]; Data Quality module + Peak controls slice implemented

### 2026-02-25 — CORE boundary cleanup + point 20 validation UX hardening (pre-LAB freeze prep)
**Touched files:**
- `FunctionSpec.md`
- `docs/frontend/scripts/mod/calibrationIO.js`
- `docs/frontend/scripts/mod/proBootstrap.js`
- `docs/frontend/styles/mod-panels.css`

**What changed**
- Added explicit **Ownership and duplication policy** section to separate original SPECTRA-1 responsibilities from SPECTRA-PRO Host/Bridge/Override roles without removing planned PRO features.
- Point 20 now shows a **validation preview** in `Other` tab (counts/warnings before apply), including invalid rows dropped, exact duplicate removal, duplicate `px`/`nm` warnings, sorting notice, and max-point trim notice.
- Apply feedback now includes normalization warnings, making shell→original calibration apply less opaque.

**What remains next (last CORE step before LAB freeze)**
- Final CORE QA freeze checklist pass (manual runtime smoke): worker modes, calibration apply, exports, no console nulls, drawer hide/show, display/y-axis/peaks/fill regressions.
- Optional polish (deferred): point disable/outlier UX and rollback affordance in point 20 shell.

## Final principle
SPECTRA-PRO should feel like a **real instrument first** and a smart analyzer second.

This spec therefore prioritizes:
- stable patch order,
- explicit file ownership,
- CORE safety,
- and honest status tracking over feature-hype.


### Session patch log (latest)
- Step 4 slice 2: integrated `dataQualityPanel.js` compute path into status rail and wired Peak controls (threshold/distance/smoothing) from CORE tab into `graphScript.js` peak detection.


## Patch Update — Step 4 follow-up hotfix (2026-02-25)

### Fixed
- **Data Quality saturation**: `dataQualityPanel.js` now prioritizes raw `frame.I` before normalized arrays (`combined/intensity`) and supports both **0..255** and **0..1** signal ranges when computing saturation. Added near-clipping fallback (`>=250`) so saturation is not misleadingly stuck at zero.
- **Peak controls input usability**: `spPeakThreshold`, `spPeakDistance`, `spPeakSmoothing` no longer get value-overwritten while typing due to frequent `renderStatus()` sync. Added focus guard in `proBootstrap.js` and switched peak inputs to `input` event updates with blur-time normalization.
- **Styling hooks / fixed widths**: Added explicit unique field wrapper ids and control classes in CORE controls UI (`spField*`, `.spctl-*`) plus fixed-width CSS rules for `select`/`input` ids to simplify future theming.

### Files changed in this hotfix
- `docs/frontend/scripts/mod/dataQualityPanel.js`
- `docs/frontend/scripts/mod/proBootstrap.js`
- `docs/frontend/styles/mod-panels.css`

### Notes
- No original SPECTRA-1 ids/selectors were renamed or removed.
- No layout structure changes; CSS additions are scoped to `#SpectraProDockHost`.



### 2026-02-25 — Step 4 slice 3: Graph appearance / fill modes (18)
**Touched files:**
- `docs/frontend/scripts/mod/graphAppearance.js`
- `docs/frontend/scripts/mod/stateStore.js`
- `docs/frontend/scripts/mod/proBootstrap.js`
- `docs/frontend/scripts/graphScript.js`
- `docs/frontend/styles/mod-panels.css`
- `FunctionSpec.md`

**What changed**
- Implemented `sp.v15.graphAppearance.getFillModes()` + `getEffective(...)` for normalized fill mode (`inherit|off|synthetic|source` with alias support for legacy `real_sampled`) and optional fill opacity.
- Added CORE controls for **Fill mode** and **Fill opacity** with store-backed state (`display.fillMode`, `display.fillOpacity`) and UI sync.
- Wired `graphScript.js` to honor PRO fill mode/opacity overrides:
  - `OFF` disables area fill even if original checkbox is on
  - `SYNTHETIC` forces fill on and uses spectral hue gradient by x-position
  - `SOURCE` (renamed from `REAL_SAMPLED`) forces fill on and uses existing sampled-color fill
  - `INHERIT` preserves original SPECTRA-1 behavior
- Added stable CSS hooks/widths for new controls (`#spFillMode`, `#spFillOpacity`, wrapper ids).

**What remains next**
- Step 4 slices: Camera capability abstraction (19), Calibration I/O + multipoint shell (20).


### 2026-02-25 — Step 4 slice 4: Camera capability abstraction (19) + fill UI polish
**Touched files:**
- `docs/frontend/scripts/mod/cameraCapabilities.js`
- `docs/frontend/scripts/mod/stateStore.js`
- `docs/frontend/scripts/mod/proBootstrap.js`
- `docs/frontend/scripts/mod/dataQualityPanel.js`
- `docs/frontend/scripts/mod/graphAppearance.js`
- `docs/frontend/scripts/graphScript.js`
- `docs/frontend/styles/mod-panels.css`
- `FunctionSpec.md`

**What changed**
- Implemented `cameraCapabilities` module as a real probe abstraction (classic-script safe) with:
  - `getActiveTrack()`
  - `probe(track)`
  - `probeCurrent()`
  - normalized `supported/values/ranges/summary/status`
- Added store-backed camera capability state (`state.camera.*`) and non-blocking capability probe on bootstrap.
- Added **Probe camera** button in CORE controls to re-probe current active camera track without touching original camera flow.
- Surface camera capability summary in Status rail (`Camera: status · resolution · exp/zoom support`) via `dataQualityPanel.js`.
- Renamed fill mode label/value from `REAL_SAMPLED` to **`SOURCE`** (legacy aliases preserved for compatibility).
- Converted **Fill opacity** control from numeric input to **slider** (`range`) with live numeric readout (`#spFillOpacityValue`).

**What remains next**
- Step 4 slice: Calibration I/O + multipoint shell (20).


### 2026-02-25 — Step 4 slice 5: Calibration I/O + multipoint shell (20) + UI action feedback hotfixes
- **Implemented point 20 shell** in `Other` tab:
  - calibration text area
  - format select (JSON/CSV)
  - actions: capture current points, export shell points, import to shell manager, clear shell
- `calibrationIO.js` upgraded from placeholder to basic JSON/CSV parse + serialize for `{px,nm,label}` points.
- `calibrationPointManager.js` upgraded from placeholder to simple validated point manager (`set/get/add/clear/count`).
- Added shell point count into state (`calibration.shellPointCount`) and surfaced in Status rail (`Calibration ... shell N`).
- CORE action buttons now provide visible feedback text (Init libraries, Ping worker, Refresh UI, Probe camera) so clicks are not silent.
- Fill opacity slider label value removed per UI request.
- Bottom drawer expand handle made visible/recoverable after collapse via fixed-position CSS override.

**Status update**
- Point **20 (Calibration I/O + multipoint manager shell)**: **PARTIAL → functional shell** (standalone shell manager + import/export text workflows).  
  Not yet applied to original calibration pipeline / coefficient solving automatically (kept isolated for compatibility).


### 2026-02-25 — Step 4 slice 6: CORE hardening (A+B) + point 20 apply bridge
- Added **Apply shell to calibration** action in `Other` tab (point 20) that safely maps shell points into original calibration input pairs and calls original `setCalibrationPoints()` pipeline.
- Added point normalization/validation helper in `calibrationIO.js` (sort by px, dedupe exact duplicates, min/max count guard).
- CORE action button hardening: clearer fallback feedback for `Ping worker` / `Init libraries`, timeout feedback, and more explicit refresh message.
- Data Quality hardening: averages/saturation percentage now use valid numeric sample count (avoids skew when arrays contain non-numeric values).

**Status update**
- Point **20 (Calibration I/O + multipoint manager shell)**: **PARTIAL → PARTIAL+** (shell + import/export + apply bridge to original calibration flow now wired).
- CORE hardening (A+B): in progress but materially improved feedback/error semantics for worker actions and DQ stability.

**What remains next (CORE before LAB freeze)**
- Final CORE QA freeze checklist pass (worker modes, calibration apply, exports, no console nulls).
- Optional polish (deferred): point disable/outlier UX and rollback affordance for point 20 shell.


## LAB Phase 2 – Step 1 (Implemented)
- LAB tab now renders functional UI (Analyze toggle, Max Hz, Preset placeholder, Init libraries, Ping worker).
- When App mode = LAB and Analyze enabled and libraries loaded, frames are sent to worker for analysis (throttled).
- Top hits and QC flags render from `state.analysis.topHits` / `state.analysis.qcFlags`.

## Patch log (curated)

> This log is intentionally short and accurate. Older duplicate/contradictory entries have been removed to prevent drift.

### 2026-02-26 — Spec audit + status correction
- Audited Phase **1.5** and **Phase 2** against the current codebase.
- Updated status snapshot so it matches what is truly implemented (no “wishful READY”).

### 2026-02-26 — LAB MVP loop + on-page console
- On-page PRO console (`sp.consoleLog`) renders in the dock and is used for action/event feedback.
- LAB panel renders as a 2-column split (QC + Top hits), and results populate from `state.analysis.*`.
- LAB analysis loop: when `App mode=LAB`, `Analyze=on`, libs initialized, frames are throttled (Max Hz) and sent to the worker.

### 2026-02-26 — Worker MVP protocol
- Worker supports `PING/PONG`, `INIT_LIBRARIES`, and `ANALYZE_FRAME`.
- Library loader currently uses a minimal **builtin-lite** atomic line set (placeholder for real libraries).

### 2026-02-26 — CORE-safe 1.5 controls and calibration shell
- CORE controls: Display mode, Y-axis mode/max, Peak threshold/distance/smoothing, Fill mode/opacity are wired through `sp.store` and applied in `graphScript.js` (reversible visual overrides).
- Calibration shell (Other tab): JSON/CSV parse/serialize + shell point manager + “Apply shell to calibration” bridge to the original calibration pipeline.

---
