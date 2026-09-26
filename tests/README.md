# Tests

Run the compact deterministic scientific regression suite with:

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

The main-compatibility suite protects the existing application baseline while the
new analysis layers remain additive. It verifies the original preset catalog,
Dark/Reference formulas, critical runtime script paths, wavelength-axis prompt guard,
all existing export types and stable design selectors without launching a browser.

The suite uses synthetic numeric JSON fixtures and the production worker modules.
It covers calibrated atomic and molecular evidence, broadband fluorescence metrics,
quality-control flags, ambiguous matching, safe invalid-input handling, and the
calibration guard. It also verifies preset resolution and stable main preset IDs.
Synthetic feature profiles cover emission and absorption centers,
FWHM, amplitude/depth, equivalent-width sign, edge flags, and uncalibrated
sample-space measurements. Calibration cases verify point residuals, RMS and maximum
residual, wavelength coverage, extrapolation, uncertainty-aware tolerance, confidence
penalties, and rejection of grossly inconsistent matches.
Measurement-quality cases verify categorical signal, noise, saturation, calibration,
sampling, resolution, coverage, feature-reliability, and dominant-limitation output.
Formal-preprocessing cases verify operation order, Dark/Reference formulas, missing
reference handling, smoothing, processed-signal worker consumption and provenance.
The instrument-response case verifies relative correction recovery, interpolation,
full-coverage and calibration guards, hardware applicability, amplification limiting,
custom CSV parsing and explicit corrected/uncorrected intensity semantics.
The AI context suite verifies the four explicit interpretation contexts
(`lab-atomic`, `lab-molecular`, `fluorescence`, and `astro`), compact deterministic
measurement-quality transfer, bounded ASTRO evidence, backend validation, prompt-data
separation, radial-velocity uncertainty/correction caveats, broad stellar-class limits,
and the ASTRO launch control. It uses only small numeric/JSON fixtures and performs no
network, browser, image, or model call.
The AI token-budget suite builds a deliberately dense 1280-sample LAB state and
requires the transmitted evidence to remain at or below 9 kB and approximately 3500
input tokens including instructions and response schema. It also locks the compact
80-point trace, 20 accepted-hit, 6-candidate, 600-character observation and
100–170-word response contracts, and rejects raw-only/excluded diagnostic hits. The
estimate is deterministic and deliberately conservative; it does not call a tokenizer
service or model.
The UI consolidation suite statically verifies that LAB and ASTRO retain their primary
workflow controls/results, expert controls remain available in collapsed Advanced
groups, reference comparison uses progressive disclosure, IDs remain unique, and the
shared layout has keyboard-focus and narrow-display rules. It does not render a browser.
The export reproducibility suite verifies the versioned JSON contract and explicit,
detached snapshots of calibration diagnostics, preprocessing/response state,
measurement quality, detected features, LAB/ASTRO results, radial velocity,
stellar-class evidence and reference comparison. It uses numeric in-memory state only.
The PDF report-contract suite verifies that the human report remains a bounded summary,
keeps its deterministic abstract/results independent of AI, labels optional completed
AI prose separately, and directs complete state/numeric reproduction to JSON v2. It
does not load jsPDF, render pages, create a PDF file, or use a browser.
The repository contract suite verifies IMPLEMENTED/EXPERIMENTAL/PLANNED status
documentation, current version/export contracts, recording-page and worker module
paths, and removal of unreferenced placeholder-only modules and backup CSS.
The ASTRO cases verify robust continuum recovery, aligned raw/continuum/normalized
arrays, calibrated absorption centers, FWHM, negative equivalent widths, curated
reference matches, quality integration, and safe uncalibrated behavior. They also lock
the distinction between reference matching and classification, and require explicit
instrument-response context for interpreting uncorrected continuum shape.
The radial-velocity case verifies the relativistic red/blue-shift equation, known
synthetic multi-line velocity, finite uncertainty, sign convention, deterministic
outlier rejection and refusal to promote a single line to a combined result. Both
observer-motion corrections and the calibration/resolution precision limit remain
explicit in the result contract.
The bundled solar case verifies the checked-in numeric TSIS-1 HSRS derivative's
checksum, provenance, air-wavelength grid, finite irradiance samples, expected Ca,
Balmer and Na absorption dips, and production ASTRO reference matches. The test does
not fetch the source dataset at runtime. It does not use a browser, images, or screenshots.
The stellar-class case verifies compact synthetic O/B/A/F/G/K/M evidence patterns,
visible reasons, evidence strength, insufficient and conflicting outcomes, calibration
guarding, and the rule that heuristic evidence points are not probabilities. The Solar
integration regression ranks G-class evidence while explicitly excluding uncorrected
continuum shape.
The reference-comparison case verifies deterministic interpolation, min–max
normalization, known manual and automatic wavelength shifts, aligned residuals,
non-overlap failure, sparse line-pattern comparison, catalog coverage and custom
numeric CSV parsing. Comparison alignment is asserted not to be a radial-velocity
measurement.

`sample_astro_absorption_spectrum.json` is a compact parametric synthetic fixture.
`sample_solar_spectrum.json` is a compact expectation manifest for the non-synthetic
bundled asset; the measured numeric samples live under `docs/frontend/data/examples/`.
`sample_stellar_class_evidence.json` contains synthetic matched-feature patterns only;
it is not an empirical stellar spectral library.
`sample_reference_comparison.json` is a compact parametric Gaussian fixture; no image
or visual reference asset is used.
`sample_instrument_response.json` contains a compact synthetic response curve and
known relative input/output values. It is test data, not a measured hardware profile.
`sample_ai_contexts.json` contains only compact synthetic context and ASTRO evidence
used to verify AI payload and prompt behavior; it is not an empirical spectrum.
