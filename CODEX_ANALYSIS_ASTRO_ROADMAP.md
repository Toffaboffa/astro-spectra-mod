# SPECTRA PRO – Analysis Engine Refactor, Scientific Upgrade & ASTRO Implementation

You are working on the existing SPECTRA PRO repository.

Your task is to improve the scientific analysis architecture and then build the ASTRO analysis system in controlled, sequential stages.

This is NOT a request to implement everything at once.

The work must be performed stage by stage. Each major stage may contain several internal substeps, but you must finish and verify the current stage before proceeding.

After completing a major stage:

1. Run only the minimum targeted validation necessary for the code changed in that stage.
2. Do NOT run broad, repetitive, exhaustive, browser-heavy, screenshot-heavy or image-generating test workflows unless the user explicitly requests them.
3. Prefer focused unit/regression checks, static checks, lint/syntax checks, and existing cheap deterministic tests.
4. Do NOT generate screenshots, sample images, visual comparison assets, or other image outputs. The user will perform visual/image validation separately.
5. If comprehensive testing would be useful but expensive, list the recommended tests for the user instead of running them.
6. Inspect the resulting implementation for obvious regressions.
7. Update relevant documentation/version information where appropriate.
8. Provide a concise completion report containing:
   - what was changed,
   - which files were changed,
   - which targeted checks were run,
   - their results,
   - tests/visual checks intentionally NOT run,
   - known limitations or follow-up items.
9. Mark that stage as COMPLETE.
10. STOP.
11. Wait for explicit user instruction before beginning the next stage.

Do not automatically continue to the next major stage.

The user controls progression through the roadmap.

---

# TOKEN / TEST BUDGET RULE

Be conservative with context, tool calls, generated output and testing.

Do not repeatedly reread large files when a targeted read is sufficient.
Do not dump large files into the conversation unless necessary.
Do not repeatedly run the entire test suite after small edits.
Do not generate images or screenshots.
Do not launch broad exploratory test loops merely to increase confidence.

Use the smallest validation set that gives reasonable confidence in the current change.

Full regression testing, browser-level visual testing, image validation and generated-image inspection are user-controlled activities unless explicitly requested.

Scientific code still requires meaningful deterministic validation, but tests should be small, targeted and reusable rather than token-heavy ad hoc exploration.

---

# 0. CORE DEVELOPMENT PRINCIPLES

Before changing code, inspect the current repository and understand the existing implementation.

The current SPECTRA PRO architecture contains a working measurement application. Preserve it.

## Preserve the existing measurement path

Do not break or unnecessarily rewrite:

- camera acquisition,
- still-image loading,
- sampling stripe,
- spectrum extraction,
- graph rendering,
- calibration,
- Dark/Reference capture,
- reference graphs,
- existing LAB workflows,
- fluorescence analysis,
- export,
- AI Interpretation,
- EN/SV runtime translation.

Existing behavior should remain compatible unless a stage explicitly changes it.

## Do not create parallel engines

Reuse the existing central state, runtime bridges, calibration engine and worker architecture.

Do NOT create:

- a second wavelength-calibration system,
- a second spectrum representation without a strong reason,
- a second graph/X-axis system,
- a separate ASTRO worker duplicating LAB infrastructure,
- a second preprocessing pipeline.

LAB and ASTRO should eventually become different scientific interpretation layers operating on shared spectral-analysis infrastructure.

## Keep heavy computation out of the UI

Numerically expensive analysis belongs in worker-side modules.

UI modules should primarily collect settings, trigger analysis, render results and manage interaction.

## Scientific correctness takes priority over impressive output

Never convert heuristic scores into probabilities unless a real probabilistic model exists.

In particular:

- Score Share is NOT probability.
- Score Share is NOT abundance.
- normalized intensity is NOT concentration.
- a wavelength coincidence is NOT proof of identification.
- a spectral-class suggestion is NOT exact stellar classification unless evidence supports it.
- Doppler/radial-velocity results must include measurement limitations and uncertainty.

Prefer an explicit "insufficient evidence" result over a confident but unsupported result.

## Avoid unnecessary rewrites

Refactor incrementally.

Whenever possible:

1. establish focused tests,
2. isolate existing behavior,
3. move/refactor functionality,
4. verify equivalent behavior,
5. then improve the algorithm.

Do not combine major architectural refactoring and major algorithm changes in one uncontrolled patch.

---

# STAGE 1 – ANALYSIS REGRESSION TEST FOUNDATION

## Goal

Create a compact, deterministic numerical regression-test foundation before substantially changing the analysis engine.

The test suite must be designed to be cheap to run. Avoid browser automation, screenshots and generated images.

## Initial repository inspection

Before editing anything inspect the current worker analysis pipeline, peak detection, line matching, atomic/molecular fingerprint logic, fluorescence analysis, calibration data structures, existing test fixtures, package/test scripts and CI.

Identify which existing sample/fixture files are placeholders or incomplete.

Do not assume old specification documents represent implemented functionality. Verify implementation from current code.

## Build deterministic scientific fixtures

Create small numeric/JSON fixtures rather than image-based fixtures wherever possible.

Cover at least:

### Atomic emission
- Hydrogen
- Neon
- Mercury or another well-supported existing fingerprint species

### Molecular/band emission
- N₂ or another molecular species already supported by the current analysis system

### Broadband fluorescence
Create a compact controlled numeric profile with known λmax, FWHM, centroid and asymmetry where useful.

### Quality-control cases
Include small controlled spectra demonstrating low signal/noise, saturation, insufficient signal and ambiguous line matching where practical.

Fixtures may be synthetic if this gives better deterministic testing. Clearly identify synthetic fixtures as synthetic test data.

## Regression assertions

Verify scientifically meaningful outputs, not merely that functions return without throwing.

Examples:

- expected atomic candidate appears in the intended candidate set,
- coherent fingerprint evidence outranks obvious unrelated coincidences where the current model supports this,
- molecular pattern detection produces expected species evidence,
- fluorescence λmax and FWHM are within defined tolerances,
- saturation produces the correct QC state,
- invalid/insufficient spectra fail safely,
- calibration-dependent analysis does not silently treat pixel coordinates as calibrated wavelengths.

Use tolerances rather than brittle exact floating-point equality.

## CI

Integrate only the cheap deterministic scientific tests into CI.

Do not add screenshot generation, visual regression, browser farms or expensive image-processing workflows.

## Completion criteria

Stage 1 is complete when meaningful compact fixtures exist, core LAB/fluorescence/QC behavior has numerical regression coverage, the targeted tests have a documented command, and CI can execute those cheap tests.

Run the new targeted tests once plus any directly affected existing cheap checks. Do not repeatedly run the full suite.

STOP after Stage 1 and wait for user instruction.

---

# STAGE 2 – ANALYSIS PIPELINE MODULARIZATION

## Goal

Refactor the worker analysis architecture so `analysisPipeline.js` becomes primarily an orchestrator rather than the location of most scientific logic.

Do NOT change scientific behavior unnecessarily during this stage.

Stage 1 tests must protect the refactor.

## Inspect existing intended modules

Pay particular attention to existing files such as:

- `spectrumMath.js`
- `presetResolver.js`
- `autoMode.js`
- `dopplerEstimate.js`
- peak detection modules,
- line matcher modules,
- confidence/scoring modules,
- atomic/molecular profile modules,
- fluorescence modules.

Some may currently be placeholders.

Reuse these modules where their intended responsibilities remain sensible.

## Target conceptual architecture

Move toward:

    spectrum input
        ↓
    preprocessing
        ↓
    spectral feature detection
        ↓
    analysis mode / preset resolution
        ↓
    feature/reference matching
        ↓
    evidence evaluation
        ↓
    quality assessment
        ↓
    result packaging

Do not force exact naming if existing architecture suggests a cleaner compatible solution.

## spectrumMath

Implement shared numerical helpers required by multiple analysis modes. Candidates include finite-value filtering, interpolation, smoothing, percentile/statistical helpers, robust baseline helpers, normalization, integration and local-window operations.

Do not duplicate equivalent mathematical implementations across modules without reason.

## presetResolver

Move preset configuration/resolution toward a centralized mechanism. Where practical, move static preset configuration out of large procedural code blocks and into maintainable configuration structures.

Do not change preset behavior accidentally.

## Preserve worker API compatibility

Frontend code should not need to know that internal worker modules were reorganized unless necessary. Keep result schemas compatible during this refactor unless an explicitly documented extension is required.

## Completion criteria

`analysisPipeline.js` is materially reduced in responsibility, shared math and preset resolution are centralized, duplicate logic is reduced, and Stage 1 targeted regression tests pass.

Run only the targeted analysis tests and directly affected cheap checks.

STOP and wait for user instruction.

---

# STAGE 3 – REMOVE OBSOLETE BASIC LAMP PRESET

## Goal

Remove the old LAB basic preset:

**Lamp (Hg/Ar/Ne)**

This preset is unnecessary because newer smart analysis workflows supersede it.

## Required removal

Remove the preset from LAB UI, preset definitions, preset resolver/configuration, documentation/help, translations, tests, examples, default/fallback logic and any references elsewhere in the repository.

Search the repository for aliases, IDs, labels and references associated with this preset.

Do not remove Hg, Ar or Ne scientific data or fingerprints.

Only remove the obsolete basic Lamp preset.

## Compatibility

If old exported settings or persisted state can contain the removed preset ID, provide a safe migration/fallback to the most appropriate current smart preset rather than causing an error.

Document the chosen fallback.

## Completion criteria

No visible or active basic `Lamp (Hg/Ar/Ne)` preset remains and no unnecessary dead branches specific only to it remain.

Run only preset-related and directly affected cheap tests.

STOP and wait for user instruction.

---

# STAGE 4 – GENERAL SPECTRAL FEATURE ENGINE

## Goal

Replace simple peak-only thinking with a reusable spectral-feature representation suitable for both LAB emission spectra and future ASTRO absorption spectra.

Do not implement full ASTRO yet.

## Unified spectral feature representation

Create a feature model capable of representing emission and absorption features.

Where data quality permits, a feature should contain:

- center wavelength,
- center uncertainty,
- sample/index position,
- polarity,
- amplitude/depth,
- prominence,
- FWHM,
- equivalent width or appropriate equivalent metric,
- local continuum/baseline,
- SNR,
- feature quality flags.

Unavailable measurements should be explicit rather than fabricated.

## Improved feature center

Avoid relying only on the index of the highest/lowest sample when a more stable center estimate is possible. Use an appropriate centroid, interpolation or local-fit method while keeping computational cost suitable for browser worker execution.

## Feature width

Calculate FWHM where data supports it. Account for sampling resolution, local baseline, truncated features and blends. Flag unreliable widths instead of reporting misleading precision.

## Emission and absorption

Support positive emission features and negative absorption features while preserving LAB compatibility.

## Equivalent width

Add equivalent-width measurement where scientifically meaningful. Document sign convention explicitly.

## Tests

Use small synthetic numeric arrays with known line centers, widths, amplitudes and absorption depths. Do not generate spectrum images for tests.

## Completion criteria

A reusable tested feature detector exists, LAB can consume it without regression, and absorption features can be detected although full ASTRO interpretation is not yet implemented.

STOP and wait for user instruction.

---

# STAGE 5 – UNCERTAINTY-AWARE CALIBRATION AND MATCHING

## Goal

Make calibration quality and instrument resolution part of scientific matching decisions.

## Calibration diagnostics

Expose and standardize:

- calibration point count,
- polynomial order,
- fitted wavelength for each calibration point,
- residual for each point,
- RMS residual,
- maximum absolute residual,
- calibrated wavelength coverage,
- extrapolation status.

Do not create a second calibration engine.

## Match uncertainty

Replace purely arbitrary fixed wavelength tolerances where possible with an effective uncertainty model informed by calibration RMS, nm/pixel sampling, instrument FWHM/resolution, detected feature center uncertainty and preset-specific limits where still justified.

Document the formula and avoid false precision.

## Result information

Matches should report observed wavelength, reference wavelength, residual Δλ, relevant effective tolerance/uncertainty and match-quality information.

## Tests

Use small deterministic numeric cases showing good calibration, poor calibration and grossly inconsistent matches.

## Completion criteria

Calibration quality materially affects matching confidence/tolerance and existing LAB functionality remains usable.

STOP and wait for user instruction.

---

# STAGE 6 – MEASUREMENT QUALITY ENGINE

## Goal

Turn existing Data Quality metrics into a coherent deterministic scientific measurement-quality model.

Do NOT reduce quality to a misleading single percentage.

## Quality dimensions

Assess relevant dimensions such as signal quality, noise, saturation, calibration, sampling, spectral resolution, wavelength coverage and feature reliability.

Use explicit states such as good, moderate, poor or unavailable.

## Main limitation

Where possible, deterministically identify the dominant limitation such as low signal, saturation, calibration uncertainty, insufficient coverage or limited resolution.

Do not ask AI to decide basic measurement quality.

## Shared quality object

Produce a structured quality summary consumable by LAB UI, ASTRO UI, export and AI Interpretation.

## Completion criteria

A coherent deterministic quality summary exists while existing detailed Data Quality metrics remain available.

STOP and wait for user instruction.

---

# STAGE 7 – FORMAL PREPROCESSING PIPELINE

## Goal

Create a clear shared preprocessing pipeline without duplicating existing Dark/Reference functionality.

Conceptual sequence:

    Raw spectrum
        ↓
    Dark subtraction
        ↓
    Reference correction
        ↓
    Instrument-response correction
        ↓
    Smoothing
        ↓
    Baseline / continuum processing
        ↓
    Normalization
        ↓
    Analysis

Only apply stages that are enabled and scientifically available.

Reuse current Dark/Reference capture and state systems.

Analysis results and exports should record active preprocessing operations.

Prepare the architecture for response profiles. If reliable response correction cannot yet be implemented, create only the validated interface/data contract without pretending correction exists.

## Completion criteria

LAB uses the formalized shared preprocessing path without regression and ASTRO can later reuse it.

STOP and wait for user instruction.

---

# STAGE 8 – ASTRO FOUNDATION: CONTINUUM AND ABSORPTION ANALYSIS

## Goal

Begin real ASTRO implementation using shared infrastructure from previous stages.

## Continuum estimation

Implement robust astronomical continuum estimation that tolerates absorption features without fitting through every dip.

Provide raw spectrum, estimated continuum and continuum-normalized spectrum.

Document method and assumptions.

## Absorption feature analysis

Use the shared feature engine to identify absorption features and report center wavelength, depth, FWHM where reliable, equivalent width and SNR/quality.

## Initial astronomical line reference set

Add a curated documented initial reference set suitable for low-resolution educational spectroscopy, including important features where appropriate such as Hα, Hβ, Hγ, Hδ, Na D, Ca II H/K and selected He/Mg features.

Reference data must be documented. Do not dump an uncontrolled giant database into the engine.

## ASTRO UI

Replace the ASTRO placeholder with a focused functional view showing continuum state, detected absorption features, matched reference features and measurement-quality limitations.

Do not implement stellar classification yet.

Do not generate screenshots or visual assets. The user will inspect the UI separately.

## Completion criteria

ASTRO can perform continuum normalization and identify meaningful absorption features from calibrated spectra.

STOP and wait for user instruction.

---

# STAGE 9 – RADIAL VELOCITY / DOPPLER ANALYSIS

## Goal

Implement `dopplerEstimate.js` as a real scientific module.

Calculate per-line radial velocity from matched reference lines. Prefer a relativistically correct formulation internally where appropriate and document the equation.

Do not base the primary result on one line when multiple reliable features exist. Combine compatible lines using uncertainty-aware weighting and deterministic outlier handling.

Report per-line wavelength shift, per-line velocity, per-line quality/uncertainty, combined radial velocity, uncertainty, number of lines used and exclusions where relevant.

Calibration uncertainty must affect radial-velocity uncertainty.

Do not produce absurd precision from low-resolution spectra.

Document sign convention clearly, e.g. positive = redshift/receding and negative = blueshift/approaching.

## Tests

Use compact synthetic numeric shifted spectra with known velocities. Do not generate images.

## Completion criteria

ASTRO estimates radial velocity from multiple matched lines with explicit uncertainty and quality limits.

STOP and wait for user instruction.

---

# STAGE 10 – BUILT-IN SOLAR ASTRO EXAMPLE

## Goal

Provide a zero-setup ASTRO demonstration equivalent in spirit to existing bundled LAB examples.

## Solar sample

Add a bundled scientifically legitimate solar-spectrum example with known calibration metadata and documented provenance.

Do not fabricate measured provenance.

Prefer an existing numeric spectrum/data asset if suitable. Do not use AI-generated images. If an external image asset or manual visual preparation is required, STOP and specify exactly what asset the user needs to provide or create rather than generating it yourself.

## Example workflow

Loading the solar example should allow useful ASTRO analysis with minimal setup, including relevant Fraunhofer/Balmer/Na/Ca features where coverage permits.

## Tests

Use asset integrity and numeric expected-feature checks only. Do not perform screenshot/image-generation validation.

## Completion criteria

A user can load the Solar example and perform meaningful ASTRO absorption analysis without manual calibration.

STOP and wait for user instruction.

---

# STAGE 11 – STELLAR SPECTRAL-CLASS EVIDENCE

## Goal

Add cautious evidence-based broad O/B/A/F/G/K/M stellar classification suitable for low-resolution spectra.

Do not claim precise subclasses or luminosity classes unless evidence genuinely supports them.

Classification should consider coherent patterns such as Balmer strength, helium features, metal-line patterns and molecular bands.

Continuum characteristics may only be used when instrument response permits meaningful interpretation.

Instrument response must not be mistaken for intrinsic stellar continuum shape.

Output should use evidence language such as best matching class evidence, compatible range, strong/moderate/weak evidence, conflicting evidence or insufficient data.

Do not present heuristic ranking as probability.

## Completion criteria

ASTRO produces a transparent broad spectral-class assessment with visible reasons and limitations.

STOP and wait for user instruction.

---

# STAGE 12 – REFERENCE SPECTRUM COMPARISON

## Goal

Extend existing reference-graph concepts into reusable measured-vs-reference spectral comparison.

Support curated references such as Hydrogen, Helium, Neon, Mercury, Solar, selected stellar references where available and custom user reference.

Reuse existing infrastructure where sensible.

Allow overlay, normalization for visual comparison, wavelength alignment and residual inspection where useful.

For ASTRO, wavelength alignment may connect to Doppler estimation, but manual alignment must remain distinct from automatically measured radial velocity.

Do not generate visual reference assets or screenshots. If such assets are required, specify them for the user.

## Completion criteria

Reference comparison works coherently across appropriate LAB/ASTRO use cases.

STOP and wait for user instruction.

---

# STAGE 13 – INSTRUMENT RESPONSE PROFILES

## Goal

Implement practical relative instrument-response correction, not claimed absolute radiometric calibration.

Support None, known/bundled SPECTRA profile where valid and custom user response profile.

Apply correction in the shared preprocessing pipeline and protect against division near zero, unsupported wavelength regions, extrapolation and extreme noise amplification.

Clearly indicate whether intensity is uncorrected relative intensity or response-corrected relative intensity.

Never imply absolute spectral irradiance without actual radiometric calibration.

## Completion criteria

Instrument-response correction is functional, safe, reproducible and documented.

STOP and wait for user instruction.

---

# STAGE 14 – CONTEXT-AWARE AI INTERPRETATION

## Goal

Extend the existing secure AI Interpretation system so different scientific modes receive appropriate structured evidence.

Do not replace deterministic analysis with AI.

Introduce explicit contexts such as LAB atomic/molecular, fluorescence and ASTRO while reusing the existing secure backend architecture.

Provide deterministic measurement-quality summary to AI.

ASTRO payload may include continuum state, absorption features, reference matches, equivalent widths, radial velocity and uncertainty, broad spectral-class evidence, calibration quality, measurement limitations and user observation.

Maintain strict rules against inventing features, converting rankings to probabilities, claiming exact stellar classification without evidence, overstating velocity precision, treating uncorrected continuum as temperature evidence or inferring unsupported abundance/composition.

## Completion criteria

AI Interpretation changes scientific context appropriately while preserving existing security architecture and concise output behavior.

STOP and wait for user instruction.

---

# STAGE 15 – UI CONSOLIDATION AND ADVANCED CONTROLS

## Goal

Prevent the application from becoming overloaded as capability grows without redesigning the entire application.

Use progressive disclosure where appropriate: normal/basic controls plus expandable Advanced settings.

LAB should keep the main workflow focused on preset, analysis trigger and results.

ASTRO should focus on spectrum/continuum, identified features, radial velocity, spectral-class evidence and quality limitations.

Do not flood the default interface with intermediate numbers.

Do not generate screenshots or image mockups. The user will perform visual review separately.

## Completion criteria

The expanded system remains understandable on normal displays and primary workflows are not buried under expert controls.

STOP and wait for user instruction.

---

# STAGE 16 – DOCUMENTATION, REPRODUCIBILITY AND FINAL VALIDATION

## Goal

Bring documentation, tests, export and implementation status into alignment.

Clearly distinguish repository features as IMPLEMENTED, EXPERIMENTAL or PLANNED.

Update HELP for spectral features, emission vs absorption, FWHM, equivalent width, calibration residuals, measurement quality, continuum normalization, radial velocity, spectral classification, instrument-response correction and AI limitations.

Ensure export contains appropriate calibration diagnostics, preprocessing configuration, quality summary, detected features, LAB/ASTRO results, radial velocity, spectral-class evidence and response state.

## Final validation policy

Do NOT automatically run every possible test or browser/visual workflow.

Run the compact deterministic scientific regression suite and cheap static/integration checks.

Then provide a separate checklist of expensive/manual validation the user should perform, including browser/device testing and visual/image inspection.

Do not generate screenshots or test images.

## Cleanup

Search for obsolete preset references, dead placeholder code, duplicated numerical helpers, stale documentation, outdated version strings and unused migration modules.

## Final report

Provide architecture overview, completed roadmap stages, major scientific capabilities, targeted test coverage, manual validation still recommended, remaining limitations and intentionally deferred features.

STOP after completing this stage.

---

# VERSIONING RULE

Follow the repository's existing versioning conventions.

For visible functional releases, update all required version locations consistently.

Do not scatter inconsistent version strings across files.

Inspect and follow the existing patch/minor version policy rather than inventing a new convention.

---

# TESTING RULE

Never mark a stage complete merely because code was written.

A stage is complete after proportionate validation appropriate to the change.

However, validation must respect the token/test budget:

- prefer targeted deterministic tests,
- prefer small numeric fixtures,
- avoid full-suite repetition,
- avoid browser automation unless explicitly requested,
- avoid screenshots,
- never generate test images unless explicitly requested,
- list expensive/manual tests for the user instead of running them.

If a targeted test fails, investigate and fix the underlying problem. Do not weaken a scientifically valid regression test merely to obtain a green build.

---

# USER-CONTROLLED EXECUTION

This roadmap is intentionally sequential.

When initially instructed to use this file:

1. Read this entire roadmap.
2. Inspect the current repository efficiently.
3. Produce a concrete implementation plan ONLY for Stage 1.
4. Break Stage 1 into sensible internal substeps.
5. Implement Stage 1.
6. Run the minimum targeted deterministic validation required.
7. Report completion, including manual/expensive checks intentionally skipped.
8. STOP.

Do not begin Stage 2 until the user explicitly instructs you to continue.

For every later continuation command, work only on the next incomplete major stage unless the user explicitly requests something else.

Never silently skip a stage.
Never batch several major stages together merely because they appear straightforward.

The purpose of this workflow is controlled development, scientific verification, low token/test overhead and easy rollback, not maximum code output per session.
