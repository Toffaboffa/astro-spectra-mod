# SPECTRA-PRO (working repo name: `astro-spectra-mod`)

SPECTRA-PRO is a **frontend-first spectrum analysis workstation** built on top of the SPECTRA recording workflow (camera → stripe → live spectrum graph), but expanded into a more capable tool for **teaching labs** and **astronomy**.

It keeps the thing that makes SPECTRA great — the direct *instrument feel* in the browser — while adding a layered analysis system that runs in a **Web Worker** so the UI stays responsive.

## What SPECTRA-PRO is supposed to do

At its core, SPECTRA-PRO is still a real-time spectrometer interface:
- start a camera (or load an image)
- choose a horizontal stripe in the image
- read pixel data from that stripe
- render a live spectrum graph in canvas

On top of that, SPECTRA-PRO adds three working modes:
- **CORE** — original SPECTRA-like behavior and controls
- **LAB** — line identification, subtraction, absorbance/transmittance workflows for classroom/lab use
- **ASTRO** — solar/stellar/planetary workflows with continuum normalization, absorption handling, molecular bands, and preliminary Doppler/offset tools

This repository is currently a **scaffold** (many files are placeholders) designed so we can patch in original SPECTRA files first, then add mod features step-by-step without breaking CORE.

---

## Design goals

### 1) Preserve CORE behavior
The original SPECTRA interaction model should remain usable even if all PRO features are disabled.

### 2) Two-speed architecture
- **UI render loop**: fast (30–60 fps target)
- **Worker analysis loop**: slower (2–5 Hz target)

This avoids lag while still enabling heavy matching and quality checks.

### 3) Frontend-only deployment
No backend is required. Heavy analysis is moved into a Web Worker, which keeps deployment simple (GitHub Pages / static hosting).

### 4) Schema-aware libraries
The app is built to ingest multiple line/band library formats (engine7-style atom/molecular/preset data), normalize them, and index them for fast querying.

---

## Core feature model (what the app will support)

## A. CORE instrument workflow (SPECTRA-compatible foundation)
- Live camera or loaded image source
- Stripe width and stripe position controls
- Stripe preview overlay in camera view
- Real-time graph rendering from stripe pixel data (RGB + combined intensity)
- Zoom / pan / reset / back / forward in the graph
- Peak visualization (basic)
- Reference curves / comparison curves
- Calibration px ↔ nm (polynomial fit)
- Residual / divergence view for calibration quality
- Export graph image, source image, and numeric data

## B. PRO modes
### CORE mode
Safe baseline mode. Behaves like original SPECTRA as much as possible.

### LAB mode
Adds live analysis for teaching/lab experiments:
- dark/reference/flat capture
- difference/ratio/transmittance/absorbance workflows
- atomic line matching
- top hits panel + overlays + confidence/QC
- lab presets (Hg/Ne/Ar/H/Na etc.)

### ASTRO mode
Adds astronomy-oriented workflows:
- continuum normalization
- absorption/emission/auto handling
- solar/Fraunhofer presets
- molecular band matching (staged rollout)
- preliminary wavelength offset / Doppler estimate with quality flags

---

## v5-inspired additions explicitly included in SPECTRA-PRO

These items were identified as valuable capabilities in the desktop v5 software and are now part of this mod specification.

1. **Explicit display modes** (separate from processing):
   - Normal
   - Difference
   - Ratio
   - (plus PRO modes like Transmittance / Absorbance)

2. **Saturation indicator**
   - Detect channel clipping (R/G/B)
   - Warn when results are unreliable due to saturation

3. **Y-axis scaling modes**
   - Auto
   - Fixed 0–255
   - Manual (planned)

4. **Peak controls (visual vs analysis)**
   - Separate settings for UI peaks and worker analysis peaks
   - Distance / threshold / smoothing parameters

5. **Graph fill modes**
   - Off / synthetic spectral colors / real sampled colors
   - Opacity control

6. **Camera capability abstraction**
   - Exposure / gain / low-light boost equivalent (where browser API allows)
   - Graceful unsupported-state handling across devices

7. **Calibration import/export + multipoint management**
   - txt/csv calibration point import/export
   - support for many points
   - outlier/disable-point workflow and better residual visibility

8. **Instrument response correction (camera/spectrometer response)**
   - create/apply response profile
   - white-light/flat-like correction workflow
   - profile storage and toggle

9. **Data Quality panel**
   - saturation, rough SNR, calibration health, reference presence, worker latency/status

10. **Reproducibility profiles**
   - separate **Instrument Profile** and **Observation Profile** for repeatable measurements/export

---


## GitHub Pages note (current repo setup)

This repo is intended to be published from **`main` + `/docs`** in GitHub Pages.
The web app lives under **`docs/frontend/`** (lowercase), and `docs/index.html` redirects into the app entry page.
Use relative paths in HTML/JS (especially for Web Workers) to avoid repo-base URL path issues on GitHub Pages.

## Runtime architecture (how it works in practice)

### Fast path (UI loop)
The graph is rendered directly from pixel data extracted from a selected stripe in the camera/image source.
This is the “instrument feel” and must stay fast.

### Slow path (Worker analysis)
A throttled worker loop receives the latest spectrum frame and performs:
- preprocessing
- peak/valley detection
- line/band matching
- offset estimation
- QC/confidence scoring
- result packaging for overlays and top-hits UI

The worker must never block the render loop.

---

## Repository structure (mapped file-by-file)

Below is the current scaffold structure and the intended responsibility of each file.
Some files are placeholders and will be implemented incrementally.

## Root

### `.gitignore`
Ignore editor/temp/build files.

### `LICENSE`
Project license placeholder.

### `README.md`
This document (project overview + architecture + file map).

### `FunctionSpec.md`
Build plan and implementation order for all modules (MVP phases, status tracking, patch strategy).

---

## `docs/`

### `docs/roadmap.md`
High-level roadmap notes (milestones and longer-term goals).

### `docs/worker_protocol.md`
UI ↔ Worker message contract (types, payloads, errors, versioning).

### `docs/library_format.md`
Internal normalized schema for atomic lines, molecular bands, metadata, tags.

### `docs/calibration_presets.md`
Calibration presets and anchor ideas (Hg/Ne/Ar/Fraunhofer/H-alpha rigs).

### `docs/migration_from_spectra.md`
Checklist for replacing placeholders with original SPECTRA files and patching safely.

### `docs/engine7_mapping_notes.md`
Notes mapping engine7 concepts to worker modules and UI behavior.

### `docs/v5_gap_additions.md`
Tracks v5-inspired feature additions adopted into SPECTRA-PRO.

---

## `docs/frontend/`

### `docs/frontend/index.html`
Simple redirect/entry page that points to `pages/recording.html`.

---

## `docs/frontend/pages/`

### `docs/frontend/pages/recording.html`
Main instrument page (eventually based on original SPECTRA recording page + SPECTRA-PRO panels/hooks).

Responsibilities after patching:
- original camera + graph UI
- CORE / LAB / ASTRO mode controls
- mod panel containers
- script loading order for legacy global scripts and mod scripts

---

## `docs/frontend/styles/`

### `docs/frontend/styles/styles.css`
Base SPECTRA styles (placeholder until original styles are copied in).

### `docs/frontend/styles/mod-panels.css`
Styles for PRO panels (mode tabs, top hits, presets, subtraction, quality panel, status widgets).

### `docs/frontend/styles/overlays.css`
Graph overlay styling (labels, confidence badges, band spans, legends).

### `docs/frontend/styles/mobile-tweaks.css`
Mobile/layout adjustments for new PRO UI while minimizing changes to CORE layout.

---

## `docs/frontend/languages/`

### `docs/frontend/languages/en.json`
English UI strings for PRO controls and status text.

### `docs/frontend/languages/sv.json`
Swedish UI strings for PRO controls and status text.

---

## `docs/frontend/assets/`

### `docs/frontend/assets/icons/`
Icons for mode buttons, status indicators, graph display modes, quality badges.

### `docs/frontend/assets/presets/`
Optional preset icons/illustrations.

### `docs/frontend/assets/examples/`
Example spectra/images for demos and manual testing.

---

## `docs/frontend/data/` (libraries, presets, manifests, profiles)

### `docs/frontend/data/line_library_general_atomic.json`
General atomic line library (LAB + ASTRO line matching foundation).

### `docs/frontend/data/molecular_bands_general_v2.json`
Primary molecular band library (v2 schema).

### `docs/frontend/data/molecular_bands_v2_merged_from_legacy.json`
Merged molecular band data from legacy sources.

### `docs/frontend/data/molecular_species_catalog_v2.json`
Species metadata catalog (aliases, categories, tags, display names).

### `docs/frontend/data/molecular_detection_presets_v1.json`
Preset rules for molecular detection workflows.

### `docs/frontend/data/molecular_sources_v1.json`
Metadata and provenance for molecular libraries.

### `docs/frontend/data/astro_presets.json`
Frontend ASTRO presets (Sun/Star/Planet/DeepSky analysis defaults).

### `docs/frontend/data/lab_presets.json`
Frontend LAB presets (Hg/Ne/Ar/H/Na etc.).

### `docs/frontend/data/library_manifest.json`
Manifest of libraries to load, versions, checksums, and feature flags.

### `docs/frontend/data/instrument_response_profiles.json`
Placeholder/local data slot for instrument response profile exports/imports.

---

## `docs/frontend/scripts/` (original SPECTRA placeholders)
These will later be replaced by original SPECTRA files. PRO hooks are designed to sit on top of them.

### `docs/frontend/scripts/polynomialRegressionScript.js`
Polynomial fit helper for calibration.

### `docs/frontend/scripts/zipScript.js`
Zip/export support used by original export workflows (if needed by imported SPECTRA files).

### `docs/frontend/scripts/languageScript.js`
Language handling (`?lang=` + translation bindings).

### `docs/frontend/scripts/dataSavingScript.js`
Export graph/image/data (later augmented with PRO metadata export).

### `docs/frontend/scripts/referenceGraphScript.js`
Reference curve handling and imports.

### `docs/frontend/scripts/imageLoadingScript.js`
Loading still images and comparison sources.

### `docs/frontend/scripts/setupScript.js`
General setup/init for original UI state.

### `docs/frontend/scripts/cameraScript.js`
Camera access, stream start/stop, exposure hooks, recording capture.

### `docs/frontend/scripts/stripeScript.js`
Stripe width/position controls and overlay synchronization.

### `docs/frontend/scripts/cameraSelection.js`
Camera selection and stripe preview logic.

### `docs/frontend/scripts/calibrationScript.js`
Calibration points, px↔nm conversion, polynomial fitting, divergence/residual visualization.

### `docs/frontend/scripts/graphScript.js`
Realtime graph renderer from stripe pixel data (core instrument heart).
Patched later with frame export + overlay hooks.

---

## `docs/frontend/scripts/mod/` (SPECTRA-PRO modules on top of SPECTRA)

### App shell / state / integration

#### `docs/frontend/scripts/mod/appMode.js`
Global mode state (`CORE`, `LAB`, `ASTRO`) and mode-change events.

#### `docs/frontend/scripts/mod/stateStore.js`
Central PRO state store (worker status, settings, references, presets, results).

#### `docs/frontend/scripts/mod/uiPanels.js`
Builds and wires PRO-side UI panels and widgets.

#### `docs/frontend/scripts/mod/eventBus.js`
Light pub/sub to reduce tight coupling between legacy scripts and PRO modules.

#### `docs/frontend/scripts/mod/spectrumFrameAdapter.js`
Transforms hooked graph/camera data into a standard frame shape for processing/worker.

#### `docs/frontend/scripts/mod/analysisWorkerClient.js`
Web Worker client, throttling, request IDs, stale result handling, timeouts.

#### `docs/frontend/scripts/mod/overlays.js`
Draws overlay markers/labels/bands on top of the graph canvas.

#### `docs/frontend/scripts/mod/utils.js`
Shared helper functions (debounce, clamp, formatting, stats helpers).

### v5-inspired UI/behavior modules (new)

#### `docs/frontend/scripts/mod/displayModes.js`
Separates **display mode** (normal/difference/ratio/transmittance/absorbance) from processing mode.

#### `docs/frontend/scripts/mod/dataQualityPanel.js`
Data quality/status panel (saturation, SNR estimate, calibration health, refs present/missing, worker latency).

#### `docs/frontend/scripts/mod/yAxisController.js`
Graph y-axis scaling state and integration hooks (Auto / Fixed 0–255 / Manual later).

#### `docs/frontend/scripts/mod/peakControls.js`
Separate controls for visual peaks vs worker analysis peaks (distance/threshold/smoothing).

#### `docs/frontend/scripts/mod/graphAppearance.js`
Graph fill/appearance controls (off/synthetic/real-sampled colors, opacity).

#### `docs/frontend/scripts/mod/cameraCapabilities.js`
Capability abstraction layer for exposure/gain/high-sensitivity-equivalent controls.

#### `docs/frontend/scripts/mod/calibrationIO.js`
Calibration point file parsing/serialization (txt/csv import/export).

#### `docs/frontend/scripts/mod/calibrationPointManager.js`
Multipoint calibration point list manager (sort, enable/disable, outlier flags, residual annotations).

#### `docs/frontend/scripts/mod/instrumentResponse.js`
Instrument response correction pipeline hooks (white-light response profile creation/application).

#### `docs/frontend/scripts/mod/responseProfileStore.js`
Stores response profiles (initially localStorage; can evolve to IndexedDB).

#### `docs/frontend/scripts/mod/instrumentProfile.js`
Builds reproducible instrument profiles (camera + stripe + calibration + response settings).

#### `docs/frontend/scripts/mod/observationProfile.js`
Builds reproducible observation profiles (mode, preset, subtraction state, notes, timestamps).

### Processing (LAB + ASTRO)

#### `docs/frontend/scripts/mod/processingPipeline.js`
Frontend preprocessing orchestration (normalize → dark/ref/flat → absorbance/transmittance → continuum → smoothing).

#### `docs/frontend/scripts/mod/subtraction.js`
Reference capture and subtraction math (dark/reference/flat, ratio, absorbance workflows).

#### `docs/frontend/scripts/mod/continuum.js`
Continuum estimation and normalization for ASTRO absorption workflows.

#### `docs/frontend/scripts/mod/smoothing.js`
Smoothing filters (median, SG-lite style).

#### `docs/frontend/scripts/mod/normalization.js`
Intensity normalization strategies (combined intensity, luminance, channel-specific, robust percentile).

#### `docs/frontend/scripts/mod/quickPeaks.js`
Fast local peak detection for UI responsiveness (not heavy matching).

#### `docs/frontend/scripts/mod/flatField.js`
Flat-field/instrument correction helper stage (used with instrument response workflows).

### Calibration & presets

#### `docs/frontend/scripts/mod/calibrationBridge.js`
Bridge to original `calibrationScript.js` state and methods.

#### `docs/frontend/scripts/mod/calibrationPresets.js`
Calibration presets and anchor suggestions (Hg/Ne/Ar/Fraunhofer etc.).

#### `docs/frontend/scripts/mod/presets.js`
High-level LAB/ASTRO preset manager (UI + processing + worker settings).

### Library/filter/search

#### `docs/frontend/scripts/mod/libraryClient.js`
Loads JSON libraries and builds client-side cache subsets.

#### `docs/frontend/scripts/mod/libraryFilters.js`
Transforms UI filters into worker-friendly filter objects.

#### `docs/frontend/scripts/mod/speciesSearch.js`
Species/molecule search/autocomplete + overlay linking.

### Session/export

#### `docs/frontend/scripts/mod/sessionCapture.js`
Captures session metadata snapshots (settings, calibration, hits, timestamps).

#### `docs/frontend/scripts/mod/exportAugment.js`
Augments original export flow with PRO metadata (mode, presets, QC, matches, offset/RV, profiles).

---

## `docs/frontend/workers/` (local analysis engine)

### `docs/frontend/workers/analysis.worker.js`
Worker entry point and message loop bootstrap.

### `docs/frontend/workers/workerRouter.js`
Routes worker messages (`INIT_LIBRARIES`, `ANALYZE_FRAME`, `SET_PRESET`, `QUERY_LIBRARY`, `PING`).

### `docs/frontend/workers/workerTypes.js`
Message type constants and payload/response shape definitions.

### `docs/frontend/workers/workerState.js`
Worker-internal state (loaded libs, indices, presets, caches, last analysis stats).

### `docs/frontend/workers/spectrumMath.js`
Shared spectral math utilities (normalization, inversion, derivatives, safe log/ratio ops).

### `docs/frontend/workers/peakDetect.js`
Peak/valley detection (including plateau handling for saturation cases).

### `docs/frontend/workers/peakScoring.js`
Scores candidate peaks (prominence, width, context).

### `docs/frontend/workers/autoMode.js`
Auto emission/absorption mode selection logic.

### `docs/frontend/workers/offsetEstimate.js`
Wavelength offset estimation from multiple matched lines.

### `docs/frontend/workers/dopplerEstimate.js`
Preliminary radial velocity estimation with quality flags.

### `docs/frontend/workers/lineMatcher.js`
Atomic line matching against wavelength libraries.

### `docs/frontend/workers/bandMatcher.js`
Molecular band/bandhead matching (broader features than narrow lines).

### `docs/frontend/workers/qcRules.js`
Domain-specific QC/gating rules to reduce false positives and over-labeling.

### `docs/frontend/workers/confidenceModel.js`
Combines peak score + match score + QC + preset fit into final confidence metrics.

### `docs/frontend/workers/libraryLoader.js`
Schema-aware loader for multiple library formats.

### `docs/frontend/workers/libraryIndex.js`
Indexing layer (wavelength buckets, species lookup, tags/categories).

### `docs/frontend/workers/libraryQuery.js`
Filter/query API over indexed libraries.

### `docs/frontend/workers/presetResolver.js`
Resolves presets into worker pipeline parameters and library filters.

### `docs/frontend/workers/downsample.js`
Downsampling helpers for faster analysis on large frames.

### `docs/frontend/workers/analysisPipeline.js`
Worker pipeline orchestration (preprocess → detect → match → offset → QC → response payload).

---

## `tests/`

### `tests/fixtures/sample_lab_spectrum.json`
Sample frame fixture for lab emission tests.

### `tests/fixtures/sample_solar_spectrum.json`
Sample frame fixture for solar absorption/continuum tests.

### `tests/fixtures/sample_molecular_band_spectrum.json`
Sample frame fixture for molecular band tests.

### `tests/manual-test-checklist.md`
Manual QA checklist (CORE regression + LAB/ASTRO sanity checks).

### `tests/test-worker-protocol.md`
Protocol test cases for UI ↔ Worker messaging and error handling.

---

## What is intentionally **not** in this scaffold yet
- No backend/Python service
- No production build tooling requirement (can be served statically)
- No full implementation in placeholders (many files are interface-level shells)
- No template cross-correlation module yet (deferred until later phase to avoid premature complexity)

---

## Immediate next practical step
1. Replace placeholder SPECTRA files in `docs/frontend/scripts/`, `docs/frontend/pages/recording.html`, and `docs/frontend/styles/styles.css` with original SPECTRA sources.
2. Patch safe hooks (graph frame export, calibration bridge, overlay hook).
3. Verify CORE behavior before enabling LAB/ASTRO analysis loops.

The philosophy here is simple: **protect the instrument feel first, then add the smart stuff.**


## Current scaffold progress

- Phase 2 foundation patch #1 added: event bus, state store, mode tabs, worker ping/analyze shell, and LAB pipeline stubs.
- Original SPECTRA files are still placeholders and must be imported before CORE integration work.
