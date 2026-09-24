# SPECTRA PRO

**Current UI version: v3.1.4**

SPECTRA PRO is a browser-based spectroscopy workstation built on the original SPECTRA recording workflow. It keeps the direct camera → stripe → spectrum interaction model, then adds calibration, worker-based analysis, data-quality diagnostics, source-specific spectral interpretation, optional AI interpretation, an integrated help/manual system, and runtime English/Swedish UI switching.

The application is designed primarily for teaching, demonstrations, experimental spectroscopy, and exploratory analysis. Results are interpretation aids, not laboratory certification.

---

## Current status

The project is no longer a scaffold. The main Recording page is functional and currently includes:

- live camera acquisition and still-image loading
- built-in calibrated **Load Example** catalog with SPECTRA-1 line spectra and a measured solar reference spectrum
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

`ASTRO` provides relative-continuum estimation, absorption-feature measurement, curated reference matching, uncertainty-aware multi-line radial velocity and cautious broad O/B/A/F/G/K/M class evidence. A bundled, pre-calibrated solar example is available for immediate ASTRO use.

### Implementation status

- **IMPLEMENTED:** shared preprocessing/calibration/quality infrastructure, LAB atomic/molecular/fluorescence analysis, ASTRO continuum and absorption analysis, the numeric Solar example, context-aware export and responsive LAB/ASTRO workspaces.
- **EXPERIMENTAL:** low-resolution radial velocity, broad stellar-class evidence, reference-spectrum alignment, relative instrument-response correction and optional AI Interpretation. These are functional but retain explicit scientific or deployment limitations.
- **PLANNED / unsupported:** exact stellar subclasses or luminosity classes, barycentric/heliocentric correction, abundance/composition inference and absolute radiometric calibration.

The detailed implementation and reproducibility contract is maintained in `FunctionSpec.md`.

---

## Built-in spectrum examples

SPECTRA PRO v3.1.4 includes a **Load Example** button in the Source panel. The N₂ and Ne line-spectrum images use the normal still-image pipeline, so stripe extraction, graph rendering, calibration and LAB analysis use the same code paths as a user-loaded image.

The bundled catalog contains N₂ and Ne spectral-tube measurements recorded with SPECTRA-1. Both samples use their original 1280×720 PNG source images without format conversion or cropping. The catalog also contains a compact numeric solar spectrum for ASTRO. The dialog uses color-coded spectral-tube icons: purple for N₂, orange for Ne, with the cyan variant bundled for future samples. Clicking a card selects it; **Load sample** confirms and loads the selection.

After a sample is selected and **Load sample** is pressed, SPECTRA PRO automatically:

- loads the selected bundled image at its original 1280×720 resolution
- places the sampling stripe through the bright spectral band and sets Stripe Width to 5 px
- applies the three reported SPECTRA-1 calibration anchors: 32 px → 388.86 nm, 515 px → 587.57 nm and 1110 px → 837.76 nm
- switches the graph X-axis directly to nm without showing the redundant wavelength-axis confirmation
- selects **Gas Tube** as the recommended LAB preset

The example does **not** enable LAB Analyze automatically. The user remains in control of when analysis starts. The calibration is applied through the existing calibration engine and therefore appears in CALIBRATE like an ordinary three-point calibration.

The historical report also records a SPECTRA-1 factory quadratic fit (a2 = 8.457e-06, a1 = 0.406760986, a0 = 375.834988). The current demo intentionally feeds the reported calibration anchors through the current SPECTRA calibration engine rather than overriding that engine with legacy coefficients.

The solar example is derived from the LASP LISIRD **TSIS-1 Hybrid Solar Reference Spectrum (HSRS)** and cites Coddington et al. (2021), DOI `10.1029/2020GL091709`. The source product's vacuum wavelengths are converted to standard-air wavelengths with the documented Edlén (1966) formula, then averaged into 0.2 nm bins from 388 to 670 nm. The checked-in JSON records the provider, source URL, DOI, wavelength-medium conversion and resampling method. Loading it activates ASTRO analysis, applies its wavelength calibration and sends its numeric irradiance samples through the existing graph and worker paths; no image or visual fixture is involved. The coverage includes Ca II H/K, Balmer, Mg I and Na I D absorption features.

---

## Interface language

SPECTRA PRO starts in **English on every page load**. A compact **EN / SV** switch is shown beside the HELP control in the PRO tab row.

- **EN** restores the original English source strings.
- **SV** translates the visible application UI to Swedish at runtime.
- Analysis data, wavelengths, units, chemical symbols, species labels and the scientific result values are not rewritten as language content.
- AI Interpretation output is intentionally independent of the UI language and continues to follow the language of the user's observation when that language can be identified.
- The language choice is not persisted across reloads in v3.1.4; English is always the clean baseline after a new load.

The translation layer is isolated from calibration, graph rendering and worker analysis. It observes the application UI only while Swedish is active, so the normal English path keeps the same behavior as before the language feature.

---

## Unified export

SPECTRA PRO v3.1.4 uses the visually buried CORE export entry point with a global **EXPORT** control beside the Dark/Ref capture controls in the left source panel. The Dark/Ref buttons are arranged as two centered, symmetric rows and the larger export button remains available regardless of the active PRO workspace.

The export dialog can generate any combination of:

- **Spectrum (source)** – PNG cropped to the central 25% of source-image height to retain the dispersed spectrum while removing unused dark area
- **Data points (.csv)** – current sampled px/nm/R/G/B/intensity values
- **Graph** – PNG of the graph exactly as currently rendered, including visible hit labels, annotations and overlays
- **Data analysis (.json)** – a `spectra-pro-export/v2` reproducibility snapshot containing complete application state plus explicit calibration diagnostics, preprocessing/response state, measurement quality, detected features, LAB/ASTRO results, radial velocity, stellar-class evidence, reference comparison, UI controls, full px/nm/R/G/B/intensity arrays and AI metadata when available
- **Report (.pdf)** – a locally generated structured report with the bundled SPECTRA PRO hero on the cover, a center-cropped spectrum source placed beside the rotated graph on one print-efficient page, a deterministic abstract, concise analysis-method summary, instrument/calibration information, primary indicators, compact two-column matched features, side-by-side Quality/Status, a bounded analysis log and reproducibility data

The PDF's abstract and main report body are generated from SPECTRA PRO state and analysis rules rather than by AI. If an AI Interpretation has already been completed, a bounded copy is placed in a separate, clearly labelled optional section with a disclaimer; it never replaces or changes the deterministic report. The JSON reproducibility snapshot retains the complete AI text and metadata. The large reference-line database is intentionally not embedded in the PDF.

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

**Lamp (Hg/Ar/Ne)** remains available for compatibility with the main application
and its focused local discharge-line workflow. Smart **Gas Tube** is the recommended
newer workflow when coherent atomic and molecular evidence is wanted.

#### Smart presets
- **Atomic**
- **Molecular**
- **Gas Tube**
- **Flame**
- **Fluorescent**

Smart presets use source-specific refinement instead of treating isolated wavelength coincidences as sufficient evidence.

### ASTRO
ASTRO reuses the same frame, calibration, preprocessing, worker, feature and
measurement-quality infrastructure as LAB. Enable **Analyze** in the ASTRO tab to
estimate a rolling upper-quantile continuum and measure absorption features. The
result retains aligned raw, continuum and continuum-normalized arrays and reports
center, depth, FWHM where resolved, equivalent width, SNR and quality flags.

Calibrated spectra are matched against a deliberately small low-resolution teaching
set: Ca II H/K, Hα/Hβ/Hγ/Hδ, Na I D, selected He I/He II and Mg I/Mg II lines. Wavelengths
are air values rounded from the [NIST Handbook of Basic Atomic Spectroscopic Data](https://physics.nist.gov/PhysRefData/Handbook/periodictable.htm).
Matches remain proximity evidence. A separate deterministic layer ranks broad
O/B/A/F/G/K/M class evidence from coherent Balmer, helium, metal and broad TiO
patterns. It reports its reasons, compatible class range, conflicts and limitations.
The ranking is not a probability and does not calculate subclasses or luminosity
classes. Continuum shape remains excluded from the current line-evidence classifier;
the preprocessing metadata records whether relative response correction was applied.
Radial velocity uses
the relativistic wavelength-ratio equation per reliable line and combines compatible
lines with inverse-variance weighting after deterministic median/MAD outlier handling.
Calibration residual, sampling, feature-center uncertainty and instrument resolution
limit the reported uncertainty. Positive velocity means redshift/receding. No
barycentric or heliocentric correction is applied, and a one-line result is reported
as insufficient rather than promoted to the primary combined velocity.

Both LAB and ASTRO expose the same wavelength-aware **Reference spectrum comparison**.
Curated H, He, Ne and Hg line patterns reuse the NIST-based diagnostic catalog; the
measured TSIS-1 HSRS solar spectrum and user-supplied numeric JSON/CSV spectra use the
same path. The worker interpolates onto the measured wavelength grid, optionally
normalizes each trace, supports none/manual/automatic comparison alignment, and
returns overlap, correlation, MAE, RMSE and aligned residual samples. The purple
overlay is normalized only for visual comparison. Manual or cross-correlation shifts
are explicitly comparison controls and never replace ASTRO radial velocity.

The analysis workspaces use progressive disclosure on normal displays. LAB keeps
Analyze, Preset, Mode and the result panes visible while detection thresholds,
weighting, update rate and worker diagnostics live under **Advanced analysis
settings**. ASTRO keeps continuum state, absorption/reference evidence, measurement
quality, radial velocity and broad class evidence visible while continuum diagnostics
and reference-comparison alignment controls remain in collapsed Advanced sections.

### HELP
A global help/manual modal available from the main PRO tab row. The HELP button is visually distinct from the app-mode tabs.

Opening HELP pauses a running live camera stream to reduce rendering load. The stream resumes when HELP is closed only if it was playing before HELP was opened. Still images are unaffected.

---

## LAB analysis model

### Formal preprocessing

LAB analysis uses one ordered preprocessing contract:

```text
raw → dark subtraction → reference transform → instrument-response correction
    → smoothing → baseline/continuum stage → optional normalization → analysis
```

Only enabled and available operations are applied. Raw, Raw − Dark, Difference,
Ratio, Transmittance and Absorbance retain their established formulas. A missing or
length-mismatched Dark/Reference array is reported and skipped rather than replaced
with fabricated correction data. The existing Peak smoothing setting applies the
same deterministic three-point smoothing passes before worker analysis.

Every result records the ordered stages, operations actually applied, input/output
sample counts and warnings under `analysis.preprocessing`; JSON export and AI payloads
carry the same compact provenance. LAB baseline/continuum correction and analysis
normalization remain disabled by default. Dark/Reference capture continues to use
the existing shared state and capture workflows.

### Relative instrument-response correction

HARDWARE offers **None** or a validated custom numeric JSON/CSV response profile.
The bundled catalog loader also accepts traceable measured profiles with declared
hardware applicability, but no measured SPECTRA-1 response curve is currently in the
repository, so the bundled catalog is intentionally empty rather than fabricated.

Profiles use `spectra-pro-response-profile/v1`, with monotonic `wavelengthsNm` and
strictly positive `relativeResponse` arrays. Correction requires a calibrated axis
fully covered by the profile and refuses extrapolation or incompatible declared
hardware. The profile is linearly interpolated to the measured grid and normalized
by its median sampled response. Low-response gain is capped at ×5 by default and
limited samples are reported. Dimensionless Ratio, Transmittance and Absorbance
results are not multiplied by an intensity-response curve. Output is always labelled either **uncorrected relative
intensity** or **response-corrected relative intensity**; it is never presented as
absolute spectral irradiance or radiometric calibration.

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

- categorical measurement quality and the dominant limitation
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

The shared measurement-quality object keeps signal, noise, saturation, calibration,
sampling, resolution, wavelength coverage, and feature reliability as separate
dimensions with `good`, `moderate`, `poor`, or `unavailable` states. It also reports
one deterministic main limitation for prioritizing corrective action. This categorical
summary is not a probability, confidence percentage, or substitute for the detailed
Data Quality values.

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
- explicit `lab-atomic`, `lab-molecular`, `fluorescence`, or `astro` context
- LAB preset/settings
- calibration state and coefficients/points
- deterministic measurement-quality status and dominant limitation
- fingerprint candidate evidence or fluorescence metrics
- ASTRO continuum state, absorption features, reference matches, equivalent widths,
  radial velocity with uncertainty/correction status, and broad stellar-class evidence
- optional user observation/context

The default payload is deliberately bounded to 112 normalized trace points, 28
prioritized hits, 6 candidates and 600 characters of optional observation text. A
dense regression case must stay below 9 kB and approximately 2500 input tokens,
including scientific instructions and the structured-response schema. The model is
asked for 100–170 words, uses low reasoning/verbosity and has a 700-token hard output
limit. Calibration, dominant quality limits and diagnostic evidence are prioritized
over exhaustive raw lists.

The interpretation prompt is designed to distinguish:

1. measured features
2. SPECTRA PRO candidates/results
3. physical interpretation

It should not invent spectral lines, treat rankings as probability, infer abundance or
composition from normalized intensity/equivalent width alone, use uncorrected continuum
shape as temperature evidence, overstate radial-velocity precision, or claim an exact
stellar class when the supplied evidence does not support it. The LAB and ASTRO launch
controls use the same concise structured-response and security boundary.

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

Screenshot slots in HELP are **PLANNED documentation assets**, not implemented validation evidence. They describe which manually captured screenshots could later illustrate the relevant controls/workflows; no generated or synthetic screenshots are bundled.

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

`docs/frontend/scripts/mod/referenceCatalog.js`
Compact curated line-pattern catalog, measured solar reference loader and validated
custom numeric JSON/CSV import.

`docs/frontend/scripts/mod/instrumentResponse.js`, `responseProfileStore.js`

Validated relative-response correction, interpolation and safety limits plus bundled
catalog/custom JSON/CSV profile loading.

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
Thin worker analysis orchestrator that preserves the public `analyzeFrame` API.

`docs/frontend/workers/candidateAnalysis.js`

Internal calibrated peak matching and candidate-evidence stage used by the pipeline.

`docs/frontend/workers/spectrumMath.js`

Shared deterministic numerical helpers used across LAB, molecular and fluorescence analysis.

`docs/frontend/workers/spectralFeatures.js`

Shared emission/absorption feature measurement. Equivalent width uses the explicit
sign convention **positive for emission and negative for absorption**; unavailable
or unreliable wavelength/width measurements are returned as `null` with quality flags.

`docs/frontend/workers/astroContinuum.js`, `astroAnalysis.js`, `astroReferences.js`

Worker-side ASTRO continuum normalization, shared absorption-feature analysis and
the controlled low-resolution air-wavelength reference set. These modules run
through the existing `ANALYZE_FRAME` path; there is no separate ASTRO worker.

`docs/frontend/workers/dopplerEstimate.js`

Relativistic per-line Doppler velocities and uncertainty-aware multi-line radial
velocity. Ambiguous shared-feature matches and unreliable widths are excluded;
observer-motion corrections remain explicit and unapplied.

`docs/frontend/workers/referenceComparison.js`

Deterministic measured-vs-reference interpolation, normalization, comparison-only
wavelength alignment, residuals and scalar fit metrics shared by LAB and ASTRO.

`docs/frontend/workers/calibrationDiagnostics.js`

Derives matching diagnostics from the existing calibration coefficients and anchors;
it does not fit a second calibration. It reports per-anchor fitted wavelength and
residual (`fitted − reference`), RMS/max-absolute residual, calibrated coverage,
sampling, and extrapolation. Matching combines independent RMS, sampling (`step/√12`),
instrument (`FWHM/2.355`), and feature-center terms in quadrature. The default match
window is three times that combined uncertainty, capped by both the active preset and
the user hard limit. These rounded diagnostics express model limits, not additional
measurement precision.

`docs/frontend/workers/measurementQuality.js`

Combines existing worker QC, calibration diagnostics, hardware metadata, coverage,
sampling, and feature flags into the shared categorical measurement-quality object.
The detailed measurements remain available and are not collapsed into a single score.

`docs/frontend/workers/presetResolver.js`

Central preset aliases, analysis settings and reference-library filtering.

`docs/frontend/workers/lineMatcher.js`  
General atomic line matching.

`docs/frontend/workers/atomicProfiles.js`  
Curated atomic fingerprint definitions.

`docs/frontend/workers/atomicEvidence.js`

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

`README.md` describes the current high-level v3.0.1 architecture and visible functionality.

`FunctionSpec.md` is the synchronized implementation and reproducibility contract. It distinguishes **IMPLEMENTED**, **EXPERIMENTAL** and **PLANNED** behavior and records the deterministic validation boundary.

`tests/README.md` documents the compact deterministic suites and scientific fixtures. Older protocol or roadmap notes are historical context only; runtime code, `FunctionSpec.md`, README and in-app HELP are authoritative for current behavior.

The completed stages 1–16 implementation roadmap is preserved under
`docs/archive/CODEX_ANALYSIS_ASTRO_ROADMAP_COMPLETED.md`. `V3_RELEASE_PLAN.md`
records the final release gates. Version 3.0.0 must not be tagged until the deferred
desktop runtime acceptance has been completed manually.

---

## Remaining limitations and manual priorities

- validate English and Swedish layout at supported desktop viewport sizes
- validate Atomic/Gas Tube fingerprints and fluorescence band/shoulder behavior against additional real measurements
- validate camera/device behavior, desktop layout, export downloads and PDF pagination manually
- add only manually captured, representative screenshots to the integrated HELP guide
- obtain a measured SPECTRA instrument-response profile before bundling a default correction
- add barycentric/heliocentric correction or empirical stellar templates only with traceable scientific inputs

The guiding principle remains simple:

> **Protect the instrument behavior first, then add interpretation on top of measured evidence.**

### v2.3.3 language and LAB performance fix

Swedish UI mode no longer recursively translates high-frequency Status, Data Quality and LAB result mutations. Dynamic panes are translated explicitly by their renderers, LAB worker results are committed as a single state transaction, live Status/DQ rendering is throttled, and the fluorescence UI ignores unrelated per-frame state changes. These changes prevent the main-thread lockup that could occur when Swedish UI and live LAB analysis were active together.
