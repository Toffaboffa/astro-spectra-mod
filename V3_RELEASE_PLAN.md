# SPECTRA PRO v3.0 release plan

This is an upgrade of the existing SPECTRA PRO application, not a replacement app.
The existing camera, stripe, graph, calibration, Dark/Reference, LAB, help, language,
AI and export workflows remain the compatibility baseline. New analysis capabilities
extend that baseline and must not silently remove it.

## Phase 1 — main compatibility foundation

Status: **COMPLETE**

- Preserve the main runtime entry points and critical Recording-page DOM contract.
- Preserve every main LAB preset, including the local `Lamp (Hg/Ar/Ne)` workflow.
- Preserve the established Dark/Reference formulas for valid inputs while retaining
  explicit safe handling for missing or length-mismatched inputs.
- Preserve the calibration behavior that avoids asking to switch to wavelength when
  the wavelength axis is already selected.
- Preserve source PNG, CSV, graph PNG, JSON, PDF and ZIP export entry points.
- Preserve the main visual selector contract while allowing additive ASTRO and
  progressive-disclosure styling.
- Run the compact main-compatibility contract together with directly affected
  deterministic regressions.

## Phase 2 — desktop runtime acceptance

Status: **DEFERRED BY USER**

The user will later validate the real desktop camera, still-image, stripe, graph,
calibration, Dark/Reference, language, help and download workflows. This phase remains
a release gate for v3.0.

## Phase 3 — compact AI contract

Status: **COMPLETE**

- Dense LAB contract: at most 9 kB and approximately 2500 input tokens including
  developer instructions and structured-response schema.
- Default evidence limits: 112 trace points, 28 prioritized hits, 6 candidates and
  600 characters of optional observation context.
- Output contract: 100–170 words, low reasoning/verbosity and a 700-token hard limit.
- Prompt and response descriptions are compact and require non-repetitive fields while
  retaining calibration, quality, evidence and caveat fidelity.
- Deterministic token-budget and response-contract checks run in CI without a browser,
  network, tokenizer service or model call.

## Phase 4 — export and PDF release contract

Status: **COMPLETE**

- JSON v2 remains the complete reproducibility artifact with full state and numeric data.
- `spectra-pro-pdf-report/v1` defines a bounded human-readable summary separately from
  JSON completeness; method narrative is limited to three paragraphs and analysis log
  to twelve lines.
- Optional completed AI prose is excluded from the deterministic abstract, length
  bounded, clearly labelled and accompanied by a model-generated disclaimer.
- Structural PDF-contract tests run without jsPDF/browser rendering. Actual download,
  font, image and pagination acceptance remains part of deferred Phase 2.

## Phase 5 — ASTRO scientific validation

Status: **COMPLETE**

- Controlled compact numeric fixtures validate continuum recovery, absorption centers,
  widths and equivalent-width sign, curated reference matches, radial velocity,
  broad O/B/A/F/G/K/M class evidence and relative instrument-response correction.
- Regression contracts keep classification broad and low-resolution, require explicit
  uncertainty and observer-motion correction state for velocity, and prevent reference
  matches, uncorrected continuum shape or relative response correction from implying
  unsupported classification, precision or absolute radiometry.
- The validation remains separate from main compatibility and runs deterministically in
  the existing compact scientific regression suite without browser or image testing.

## Phase 6 — documentation and v3.0 release gate

Status: **COMPLETE — DESKTOP ACCEPTANCE PENDING**

- The completed stages 1–16 roadmap is preserved verbatim with its source commit under
  `docs/archive/CODEX_ANALYSIS_ASTRO_ROADMAP_COMPLETED.md`; the empty placeholder
  `docs/roadmap.md` was removed.
- README, FunctionSpec, HELP, AI/backend documentation, export wording and deterministic
  test documentation describe the same implemented/experimental/planned boundary.
- The public UI, asset cache keys, analysis result, export metadata, HELP and AI Worker
  identify version `3.0.0`; temporary implementation-stage labels were removed.
- CI requires the compact compatibility, scientific, AI, token-budget, UI structure,
  export, PDF and repository-contract checks.
- `v3.0.0` is a release candidate only. Do not tag or publish it until the deferred
  Phase 2 desktop acceptance has been completed by the user.

Work stops after each phase until the user explicitly requests the next phase.
