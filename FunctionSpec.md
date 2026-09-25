# SPECTRA PRO — Current implementation and reproducibility contract

This document describes the implementation that exists in the repository. It is not
a promise that roadmap ideas are already functional. Status labels are:

- **IMPLEMENTED** — present in the runtime path and covered by focused checks.
- **EXPERIMENTAL** — functional, but scientifically or operationally limited.
- **PLANNED** — intentionally absent; no result should imply that it exists.

Current UI version: **3.1.5**.

## Architecture

SPECTRA PRO preserves the original browser measurement path:

```text
camera or image → sampling stripe → spectrum frame → calibration/preprocessing
                → shared analysis worker → LAB or ASTRO interpretation → UI/export/AI
```

There is one central frontend state store, one wavelength-calibration path, one
preprocessing path and one analysis worker. ASTRO does not have a parallel worker or
calibration engine. Numerically expensive analysis stays worker-side.

Primary runtime entry points:

- `docs/frontend/pages/recording.html` — application page and load order.
- `docs/frontend/scripts/mod/stateStore.js` — shared state.
- `docs/frontend/scripts/mod/proBootstrap.js` — PRO workspace and UI integration.
- `docs/frontend/scripts/mod/processingPipeline.js` — ordered preprocessing.
- `docs/frontend/scripts/mod/analysisWorkerClient.js` — worker bridge.
- `docs/frontend/workers/analysis.worker.js` — worker entry point.
- `docs/frontend/workers/analysisPipeline.js` — shared analysis orchestrator.
- `docs/frontend/scripts/mod/exportUi.js` — reproducibility/export contract.
- `backend/ai-worker/` — optional secure AI Interpretation boundary.

## Implementation status

### Core measurement workflow — IMPLEMENTED

- Live camera and still-image input.
- Sampling stripe and RGB/intensity extraction.
- Spectrum graph, zoom and calibrated wavelength display.
- Existing Dark/Reference capture and transforms.
- Polynomial wavelength calibration and calibration file/point workflows.
- Reference graph display and standard exports.
- Runtime EN/SV interface translation.

Browser/device behavior still depends on camera drivers and permissions and therefore
requires manual validation on target devices.

### Shared scientific infrastructure — IMPLEMENTED

- Compact deterministic numeric regression fixtures.
- Shared finite-value, interpolation, smoothing, statistics and integration helpers.
- Central preset resolution that preserves the main-compatible `lamp-hg` workflow
  while also providing the newer `smart-gastube` analysis.
- Unified emission/absorption feature representation with center uncertainty,
  polarity, prominence, FWHM, equivalent width, local continuum and quality flags.
- Calibration diagnostics: fitted points, residuals, RMS/max residual, wavelength
  coverage, sampling and extrapolation state.
- Uncertainty-aware matching informed by calibration, sampling, feature-center
  uncertainty and instrument resolution.
- Deterministic multidimensional measurement quality and one dominant limitation.
- Ordered preprocessing provenance:

```text
raw → dark subtraction → reference transform → instrument-response correction
    → smoothing → baseline/continuum processing → optional normalization → analysis
```

Only configured stages with valid inputs are applied; missing prerequisites are
reported rather than fabricated.

### LAB — IMPLEMENTED

- Base local matching presets: Nearest, Wide, Tight, Fast and Lamp (Hg/Ar/Ne).
- Smart Atomic, Molecular, Gas Tube, Flame and Fluorescent workflows.
- Multi-line atomic fingerprint evidence and missed-feature penalties.
- Molecular/multi-band evidence.
- Broadband fluorescence λmax, centroid, FWHM, band range, asymmetry, shoulders and
  integrated relative signal.
- Candidate rankings, hits and QC, plus coherent fingerprint-supported narrow-line
  fluorescence matches shown automatically in the graph/peak inspector and an optional
  weaker raw-coincidence overlay.
- Progressive disclosure: Analyze, Preset, Mode and results remain primary; detailed
  thresholds, weighting and worker diagnostics are under Advanced settings.

Score Share is a relative ranking, not probability, concentration or abundance.

### ASTRO foundation — IMPLEMENTED

- Robust rolling upper-quantile relative-continuum estimate.
- Aligned raw, continuum and continuum-normalized arrays.
- Calibrated absorption-feature measurement with depth, FWHM, negative equivalent
  width, SNR and quality flags.
- Curated low-resolution standard-air references for Balmer, Ca II H/K, Na I D and
  selected He/Mg features.
- Focused ASTRO UI with continuum state, features, reference matches, quality,
  radial velocity and broad stellar-class evidence.
- Numeric TSIS-1 HSRS-derived Solar example with checked-in provenance and checksum.

### Radial velocity — EXPERIMENTAL

- Relativistic wavelength-ratio equation per reliable matched line.
- Uncertainty-aware multi-line combination and deterministic outlier rejection.
- Per-line results, combined velocity, uncertainty, line counts and exclusions.
- Positive velocity means redshift/receding.

Limitations: low-resolution input can produce large uncertainty; no barycentric or
heliocentric correction is applied; one line is not promoted to a combined result.

### Stellar spectral-class evidence — EXPERIMENTAL

- Broad O/B/A/F/G/K/M evidence from coherent Balmer, helium, metal and TiO patterns.
- Visible reasons, compatible range, conflicts, evidence strength and insufficient-data
  outcomes.

This is heuristic broad-class evidence, not probability, exact subclass, luminosity
class, temperature or composition. Uncorrected continuum shape is excluded.

### Reference spectrum comparison — EXPERIMENTAL

- Curated H, He, Ne, Hg and measured Solar references plus custom numeric JSON/CSV.
- Interpolation, overlap checks, optional normalization, manual/automatic comparison
  alignment, correlation, MAE, RMSE, residual arrays and overlay.

Comparison alignment is not a radial-velocity measurement.

### Instrument-response correction — EXPERIMENTAL

- Validated relative-response JSON/CSV profiles.
- Wavelength interpolation, full-coverage guard, hardware applicability checks,
  division-near-zero protection and configurable amplification cap.
- Explicit corrected/uncorrected relative-intensity labels and export provenance.

No measured bundled SPECTRA profile is currently available, so the bundled profile
catalog is intentionally empty. Correction is not absolute radiometric calibration.

### AI Interpretation — EXPERIMENTAL and optional

- Explicit `lab-atomic`, `lab-molecular`, `fluorescence` and `astro` contexts.
- Compact deterministic measurement, calibration, quality and result evidence.
- Default limits of 112 trace points, 28 prioritized hits, 6 candidates and 600
  observation characters, with a dense-input CI budget of approximately 2500 tokens.
- Server-side API key, origin validation, body limits, rate limiting, no-store behavior,
  structured response schema and a non-repetitive 100–170-word output policy.
- Prompt rules prohibit invented features, probability claims from rankings,
  unsupported abundance/class claims, continuum-temperature misuse and radial-velocity
  overprecision.

The backend must be deployed/configured separately. AI does not replace deterministic
analysis and its prose remains model-generated.

### UI consolidation — IMPLEMENTED

- LAB and ASTRO share a responsive result layout.
- Primary workflows remain visible on normal displays.
- Expert controls use native keyboard-accessible Advanced disclosure sections.
- Reference-comparison controls are collapsed by default.

## Reproducibility and export

`Data analysis (.json)` uses `spectra-pro-export/v2`. It retains the complete state and
adds an explicit `scientificAnalysis` snapshot containing:

- analysis context and preset;
- calibration state, diagnostics and match-uncertainty model;
- preprocessing configuration, applied operations and warnings;
- instrument-response configuration/result and intensity basis;
- deterministic measurement-quality summary;
- detected spectral features;
- LAB hits, candidates, winner/fluorescence evidence and QC;
- ASTRO continuum/features/matches, radial velocity and stellar-class evidence;
- reference-spectrum comparison;
- full numeric spectrum arrays and optional AI payload/result metadata.

Export snapshots are detached from live state. CSV and deterministic PDF exports remain
available. The PDF abstract and main narrative are generated locally from deterministic
state. An already completed AI interpretation may be included only in a separate,
explicitly labelled optional section with a disclaimer; the complete AI result remains
available in the versioned JSON snapshot.

## PLANNED / intentionally unsupported

- Exact stellar subclasses and luminosity classes.
- Barycentric or heliocentric velocity correction.
- Chemical abundance/composition inference.
- Absolute radiometric calibration or absolute spectral irradiance.
- A fabricated bundled response profile when measured profile data is unavailable.
- Automated visual-regression assets or generated screenshots.
- Production-grade empirical stellar template library beyond documented references.

## Deterministic validation

Run from the repository root:

```text
node tests/main_compatibility.test.mjs
node tests/analysis_regression.test.js
node tests/ai_context_regression.test.mjs
node tests/ai_token_budget.test.mjs
node tests/ui_consolidation.test.mjs
node tests/export_reproducibility.test.mjs
node tests/pdf_report_contract.test.mjs
node tests/repository_contract.test.mjs
```

These checks use compact numeric/JSON data and static integration assertions. They do
not require a browser, camera, network, OpenAI call, screenshots or generated images.

## Manual validation boundary

Before a production release, manually verify camera permissions/devices, loaded-image
interaction, calibration editing, supported desktop layouts, EN/SV switching, download
behavior for every export type, graph/source image output, PDF pagination, custom
response/reference imports and the deployed AI backend. These checks are intentionally
not represented as already completed by deterministic unit tests.
