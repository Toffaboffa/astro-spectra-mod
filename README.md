# SPECTRA PRO

**Current UI version: v2.3.6**

SPECTRA PRO is a browser-based spectroscopy workstation built on the original SPECTRA recording workflow. It keeps the direct camera → stripe → spectrum interaction model, then adds calibration, worker-based analysis, data-quality diagnostics, source-specific spectral interpretation, optional AI interpretation, an integrated help/manual system, and runtime English/Swedish UI switching.

The application is designed primarily for teaching, demonstrations, experimental spectroscopy, and exploratory analysis. Results are interpretation aids, not laboratory certification.

---

## Current status

The project is no longer a scaffold. The main Recording page is functional and currently includes:

- live camera acquisition and still-image loading
- built-in calibrated **Load Example** line-spectrum demo based on a SPECTRA-1 measurement
- movable/adjustable sampling stripe
- real-time spectrum graph
- pixel and calibrated wavelength axes
- multipoint wavelength calibration
- dark/reference workflows
- graph/reference comparison tools
- LAB worker analysis
- atomic and molecular matching
- curated atomic fingerprint scoring
- broadband fluorescence analysis
- Status and Data Quality diagnostics
- optional OpenAI-powered **AI Interpretation** through a secure backend
- built-in **HELP** modal with control reference, calibration guidance, preset explanations, Status/Data Quality definitions, AI documentation, and Q&A
- runtime **EN / SV** interface switching with English as the default language on every page load
- unified **EXPORT** workflow for source PNG, CSV data, rendered graph PNG, complete JSON analysis data and deterministic PDF reports

`ASTRO` is currently a staged/placeholder workspace in the visible UI. Do not treat the older roadmap/specification documents as proof that all ASTRO features are implemented.

---

## Built-in line-spectrum example

SPECTRA PRO v2.3.6 includes a **Load Example** button in the Source panel. It loads a bundled line-spectrum image through the normal still-image pipeline, so stripe extraction, graph rendering, calibration and LAB analysis use the same code paths as a user-loaded image.

The bundled catalog contains N₂ and Ne spectral-tube measurements recorded with SPECTRA-1. N₂ uses the original 1280×720 PNG; Ne is bundled as lossless WebP with identical decoded RGB values to the supplied 1280×720 source. The dialog uses color-coded spectral-tube icons: purple for N₂, orange for Ne, with the cyan variant bundled for future samples. Clicking a card selects it; **Load sample** confirms and loads the selection.

After a sample is selected and **Load sample** is pressed, SPECTRA PRO automatically:

- loads the selected bundled image at its original 1280×720 resolution
- places the sampling stripe through the bright spectral band and sets Stripe Width to 5 px
- applies the three reported SPECTRA-1 calibration anchors: 32 px → 388.86 nm, 515 px → 587.57 nm and 1110 px → 837.76 nm
- switches the graph X-axis directly to nm without showing the redundant wavelength-axis confirmation
- selects **Gas Tube** as the recommended LAB preset

The example does **not** enable LAB Analyze automatically. The user remains in control of when analysis starts. The calibration is applied through the existing calibration engine and therefore appears in CALIBRATE like an ordinary three-point calibration.

The historical report also records a SPECTRA-1 factory quadratic fit (a2 = 8.457e-06, a1 = 0.406760986, a0 = 375.834988). The current demo intentionally feeds the reported calibration anchors through the current SPECTRA calibration engine rather than overriding that engine with legacy coefficients.

---

## Interface language

SPECTRA PRO starts in **English on every page load**. A compact **EN / SV** switch is shown beside the HELP control in the PRO tab row.

- **EN** restores the original English source strings.
- **SV** translates the visible application UI to Swedish at runtime.
- Analysis data, wavelengths, units, chemical symbols, species labels and the scientific result values are not rewritten as language content.
- AI Interpretation output is intentionally independent of the UI language and continues to follow the language of the user's observation when that language can be identified.
- The language choice is not persisted across reloads in v2.3.6; English is always the clean baseline after a new load.

The translation layer is isolated from calibration, graph rendering and worker analysis. It observes the application UI only while Swedish is active, so the normal English path keeps the same behavior as before the language feature.

---

## Unified export

SPECTRA PRO v2.3.6 uses the visually buried CORE export entry point with a global **EXPORT** control beside the Dark/Ref capture controls in the left source panel. The Dark/Ref buttons are arranged as two centered, symmetric rows and the larger export button remains available regardless of the active PRO workspace.

The export dialog can generate any combination of:

- **Spectrum (source)** – PNG cropped to the central 25% of source-image height to retain the dispersed spectrum while removing unused dark area
- **Data points (.csv)** – current sampled px/nm/R/G/B/intensity values
- **Graph** – PNG of the graph exactly as currently rendered, including visible hit labels, annotations and overlays
- **Data analysis (.json)** – a single machine-readable snapshot containing application state, calibration, analysis settings, Status, Data Quality, UI control values, the full px/nm/R/G/B/intensity spectrum arrays, hits/candidates, fluorescence data and AI payload/result metadata when available
- **Report (.pdf)** – a locally generated structured report with the bundled SPECTRA PRO hero on the cover, a center-cropped spectrum source placed beside the rotated graph on one print-efficient page, automatic abstract, extended continuous analysis-method text, instrument/calibration information, primary indicators, compact two-column matched features, side-by-side Quality/Status, detailed analysis log and reproducibility data

The automatic PDF body is generated from SPECTRA PRO state and analysis rules rather than by AI. If an AI Interpretation has already been completed, that existing AI text is inserted verbatim into the **Abstract** with an explicit `AI interpretation:` / `AI-tolkning:` label. The large reference-line database is intentionally not embedded in the PDF.

After a completed AI Interpretation, an **Export** button also appears in the AI result dialog beside the copy/new-analysis controls and opens the same unified export dialog.

All selected export outputs are packaged into one timestamped **ZIP archive** using the JSZip library already bundled with the application.

PDF generation is performed in the browser. The report generator loads jsPDF and jsPDF-AutoTable from CDN only when PDF export is requested. The cover image supplied for SPECTRA PRO is bundled with the application, so report generation does not depend on k-aberg.se or cross-origin image loading.

---

## Main workspaces

### CORE
The baseline spectrometer workspace. It preserves the original instrument-style workflow and contains graph/display controls, peak visualization, zoom/pan, reference graphs, camera capability probing, export tools, and related controls.

### HARDWARE
Stores instrument metadata such as:

- wavelength range
- nominal FWHM resolution
- pixel resolution
- grating density
- spectrometer profile

These values provide instrument context and derived diagnostics. They do **not** replace wavelength calibration.

### CALIBRATE
Uses the existing SPECTRA calibration engine through the PRO shell. It supports editable multipoint pixel ↔ wavelength anchors, fitting, file load/save, fit diagnostics, and calibration-quality information.

### LAB
Runs spectral analysis in a Web Worker so the UI remains responsive. LAB libraries load automatically on first entry.

Current preset families include:

#### Base presets
- **Nearest**
- **Wide**
- **Tight**
- **Fast**
- **Lamp (Hg/Ar/Ne)**

These emphasize local wavelength proximity and are mainly useful for direct/manual line inspection.

#### Smart presets
- **Atomic**
- **Molecular**
- **Gas Tube**
- **Flame**
- **Fluorescent**

Smart presets use source-specific refinement instead of treating isolated wavelength coincidences as sufficient evidence.

### ASTRO
Reserved for astronomy-oriented analysis. The visible workspace is currently staged and should be considered incomplete.

### HELP
A global help/manual modal available from the main PRO tab row. The HELP button is visually distinct from the app-mode tabs.

Opening HELP pauses a running live camera stream to reduce rendering load. The stream resumes when HELP is closed only if it was playing before HELP was opened. Still images are unaffected.

---

## LAB analysis model

### Atomic fingerprints
SPECTRA PRO keeps the large general atomic line library for raw line lookup and graph annotations, but Smart atomic identification does not rely only on nearest-line coincidences.

The current fingerprint layer includes curated profiles for:

- H
- He
- Ne
- Ar
- Kr
- Xe
- Hg
- O

The refinement model considers multiple forms of evidence, including:

- matched diagnostic lines
- coherent multi-line patterns
- wavelength agreement
- strong-peak coverage
- missed important profile features
- isolated-coincidence penalties
- density/ambiguity effects

This is intended to reduce false source identification caused by dense atomic libraries where unrelated species may contain nearby catalog lines.

**Score Share is a relative ranking among positively scored candidates. It is not probability, concentration, or abundance.**

### Molecular analysis
Molecular analysis uses pattern/band evidence rather than pretending broad molecular structures are isolated atomic lines. Current molecular work includes curated handling for important N₂/N₂⁺ patterns and supporting molecular evidence logic.

### Gas Tube
Gas Tube combines source-family restrictions with atomic fingerprint and molecular evidence where relevant. Multiple species may coexist.

### Fluorescent
`Fluorescent` is a broadband-analysis mode, not an atomic source-identification mode.

Primary fluorescence output includes:

- emission maximum (`λmax`)
- centroid
- FWHM
- approximate band width/range
- asymmetry / red- or blue-tailed shape
- secondary shoulders when detected
- integrated baseline-corrected signal

Atomic line coincidences are hidden by default in this mode. A **Narrow-line overlay** can be enabled when lamp leakage or genuine narrow-line contamination is physically relevant.

A broad fluorescence band alone does not uniquely identify a fluorophore without an appropriate reference spectrum/library.

---

## Status and Data Quality

The right-hand diagnostic rail separates application state from measurement diagnostics.

### STATUS
Tracks values such as:

- active workspace
- worker state / analysis rate
- source and camera state
- loaded modules
- active preset
- analysis state
- axis / normalization state
- stripe position and height
- calibration state and point counts
- hardware range/profile
- dark/reference/reference-graph availability
- active processing mode

### DATA QUALITY
Tracks values such as:

- signal min/max
- average and dynamic range
- estimated baseline
- headroom before clipping
- saturation count/percentage
- detected and strong peak counts
- LAB hits / QC flags
- wavelength match error (`Peak Δ`)
- match confidence indicator
- estimated noise sigma
- estimated SNR
- calibrated nm/px sampling
- wavelength coverage
- calibration RMS error
- instrument FWHM
- approximate resolving power (`R ≈ λ/Δλ`)

The built-in HELP system contains a field-by-field explanation of what these values mean, how to interpret them, and when they are not applicable.

---

## AI Interpretation

SPECTRA PRO includes an optional **AI Interpretation** layer.

The AI does **not** replace the measurement/analysis engine. The intended flow is:

```text
camera or image
    ↓
stripe spectrum
    ↓
calibration + preprocessing
    ↓
SPECTRA PRO worker analysis
    ↓
compact scientific payload
    ↓
secure AI backend
    ↓
text interpretation
```

The payload can include:

- compact normalized spectral trace
- exact detected/matched features
- LAB preset/settings
- calibration state and coefficients/points
- data-quality/QC information
- fingerprint candidate evidence or fluorescence metrics
- optional user observation/context

The interpretation prompt is designed to distinguish:

1. measured features
2. SPECTRA PRO candidates/results
3. physical interpretation

It should not invent spectral lines, treat Score Share as probability, infer concentration from normalized intensity, or claim unique identification when the supplied evidence does not support it.

The AI normally replies in the language used in the user's observation text; otherwise English is used. This behavior is independent of the EN/SV interface switch.

### Security architecture

The OpenAI API key is **never stored in the public frontend repository**.

Current architecture:

```text
GitHub Pages frontend
       ↓ HTTPS POST
Cloudflare Worker backend
       ↓ server-side secret
OpenAI API
       ↓
structured/text result
       ↓
SPECTRA PRO popup
```

The backend lives under `backend/ai-worker/` and uses Cloudflare secrets/environment bindings for the OpenAI key and runtime configuration.

Do not commit API keys, Cloudflare secrets, or other credentials to this repository.

---

## HELP / in-app manual

The integrated HELP system currently includes:

- **CONTENTS**
- **QUICK START**
- **WORKSPACE**
- **CONTROLS**
- **STATUS & QUALITY**
- **CALIBRATION**
- **LAB & PRESETS**
- **AI INTERPRETATION**
- **Q&A**

The manual documents the main visible buttons, sliders, checkboxes, selectors, Match Score columns, fluorescence metrics, Status fields, and Data Quality values. The runtime language layer also translates the HELP navigation and documented UI terminology when Swedish is active.

Screenshot placeholders are intentionally included in the help content. They describe which screenshots should later be added to illustrate the relevant controls/workflows.

---

## Runtime architecture

### Fast path: instrument UI
The graph and source preview are updated from the camera/image and selected stripe. This path must remain responsive.

### Slow path: analysis worker
The Web Worker receives throttled frames and performs the heavier analysis work, including:

- preprocessing
- peak detection
- line/band matching
- candidate discovery
- fingerprint/profile refinement
- wavelength-offset estimation
- QC checks
- result packaging

The worker result is then stored in the central PRO state and rendered by the UI/overlay layer.

### Static frontend + optional backend
Most of SPECTRA PRO remains static and can be served from GitHub Pages.

The only current backend-dependent feature is optional AI Interpretation. Normal camera, graph, calibration, LAB, fluorescence analysis and EN/SV translation run locally in the browser.

---

## GitHub Pages

The repository is intended to publish from:

```text
branch: main
folder: /docs
```

The app lives under:

```text
docs/frontend/
```

`docs/index.html` redirects into the Recording application.

Use relative frontend paths so GitHub Pages continues to work correctly under the repository base URL.

---

## Important files

### Main application

`docs/frontend/pages/recording.html`  
Main Recording page, camera/source controls, graph area and PRO dock host.

`docs/frontend/scripts/graphScript.js`  
Core spectrum graph renderer and pixel/nm display behavior.

`docs/frontend/scripts/cameraScript.js`  
Camera stream, camera runtime bridge, exposure hooks, pause/play behavior.

`docs/frontend/scripts/stripeScript.js`  
Sampling stripe placement/width and source overlay.

`docs/frontend/scripts/calibrationScript.js`  
Core calibration engine, polynomial fit and pixel↔wavelength conversion.

### PRO frontend modules

`docs/frontend/scripts/mod/stateStore.js`  
Central application state and versioned module loading.

`docs/frontend/scripts/mod/proBootstrap.js`  
Main PRO bootstrap and CORE/HARDWARE/CALIBRATE/LAB/ASTRO integration.

`docs/frontend/scripts/mod/uiPanels.js`  
LAB controls, result panels, status/data-quality rendering and related UI behavior.

`docs/frontend/scripts/mod/analysisWorkerClient.js`  
Frontend bridge to the worker pipeline.

`docs/frontend/scripts/mod/overlays.js`  
Graph hit/label overlays.

`docs/frontend/scripts/mod/calibrationIO.js`  
Calibration import/export and startup calibration prompts.

`docs/frontend/scripts/mod/fluorescenceUi.js`  
Fluorescence-specific BAND FEATURES / FLUORESCENCE SUMMARY UI and narrow-line overlay behavior.

`docs/frontend/scripts/mod/aiAnalysisPayload.js`  
Builds the compact scientific payload for AI Interpretation.

`docs/frontend/scripts/mod/aiAnalysisService.js`  
Secure frontend transport to the AI backend.

`docs/frontend/scripts/mod/aiAnalysisUi.js`  
AI Interpretation dialog, result display and copy/new-analysis controls.

`docs/frontend/scripts/mod/helpUi.js`  
Integrated HELP/manual modal and documentation content.

`docs/frontend/scripts/mod/exportUi.js`  
Unified export dialog, source/graph capture, CSV/JSON export and deterministic browser-generated PDF report.

`docs/frontend/scripts/mod/i18nUi.js`  
Runtime EN/SV interface translation layer. English is always the initial source language; Swedish can be enabled without reloading or changing scientific data.

`docs/frontend/scripts/mod/uiTweaksV203.js`  
Current small UI/version integration layer. Despite the historical filename, it also carries current patch-level UI behavior and the visible SPECTRA PRO version badge.

### Worker analysis

`docs/frontend/workers/analysisPipeline.js`  
Main worker analysis pipeline.

`docs/frontend/workers/lineMatcher.js`  
General atomic line matching.

`docs/frontend/workers/atomicProfiles.js`  
Curated atomic fingerprint definitions.

`docs/frontend/workers/atomicFingerprint.js`  
Atomic fingerprint scoring/refinement.

`docs/frontend/workers/plasmaProfiles.js`  
Curated plasma/molecular fingerprints such as N₂/N₂⁺.

`docs/frontend/workers/molecularEvidencePatch.js`  
Additional molecular evidence/scoring logic.

`docs/frontend/workers/fluorescenceAnalysis.js`  
Broadband fluorescence shape analysis.

`docs/frontend/workers/libraryLoader.js` / `libraryIndex.js`  
Library normalization and indexing.

### AI backend

`backend/ai-worker/`  
Cloudflare Worker project used by AI Interpretation. The API key belongs in Cloudflare Secrets Store/environment configuration, never in frontend JavaScript.

---

## Development rules that matter

When modifying the application:

1. Preserve the original CORE measurement path.
2. Reuse central state and existing runtime bridges.
3. Do not create a second calibration engine, X-axis system or analysis loop.
4. Keep heavy analysis in the worker, not in UI rendering code.
5. Avoid recursive still-image reanalysis/redraw loops.
6. Treat raw line coincidences as weaker evidence than coherent physical patterns.
7. Keep Score Share semantics explicit: ranking, not probability/abundance.
8. Keep secrets/backend credentials out of the public frontend.
9. Visible UI changes should update the displayed patch version consistently.
10. Test live-camera and still-image paths separately.
11. Keep English as the source UI and default load language; translation must remain a presentation layer and must not mutate scientific state/data.

---

## Documentation status

`README.md` describes the current high-level v2.3.6 architecture and visible functionality.

`FunctionSpec.md` contains older planning/specification material and is **not yet fully synchronized with the current implementation**. It remains useful as historical design context, but current runtime behavior should be verified against the code and the in-app HELP guide until that document is revised.

Other files under `docs/` include older roadmap, migration and protocol notes. Some are historical and will be updated separately.

---

## Current priorities

- validate Swedish UI layout and expand translation coverage where real screenshots reveal wording/overflow problems
- continue validating Atomic/Gas Tube fingerprints against known spectra
- refine fluorescence band/shoulder handling with real measurements
- add screenshots to the integrated HELP guide
- update older Markdown/specification documentation to match the current implementation
- expand ASTRO only after the current CORE/LAB paths remain stable

The guiding principle remains simple:

> **Protect the instrument behavior first, then add interpretation on top of measured evidence.**

### v2.3.3 language and LAB performance fix

Swedish UI mode no longer recursively translates high-frequency Status, Data Quality and LAB result mutations. Dynamic panes are translated explicitly by their renderers, LAB worker results are committed as a single state transaction, live Status/DQ rendering is throttled, and the fluorescence UI ignores unrelated per-frame state changes. These changes prevent the main-thread lockup that could occur when Swedish UI and live LAB analysis were active together.
