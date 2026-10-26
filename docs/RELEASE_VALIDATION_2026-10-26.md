# SPECTRA PRO 1.4.1: Stage 5 release validation

Updated: **2026-10-26**. Scope: \`Toffaboffa/astro-spectra-mod\`, \`main\`.
This is an evidence-backed engineering QA record, **not** scientific certification
or a declaration that every hardware workflow has been manually tested.

## What is automated in CI

| Scope | Test(s) / check | What is and is not verified |
|---|---|---|
| Original camera/stripe/graph behavior | \`main_compatibility\`, \`startup_flow_runtime\`, \`startup_flow_browser\`, \`ui_consolidation\` | DOM/API, startup transitions, load/import flow and a Chrome startup harness; **not physical USB/camera controls or frame-by-frame live performance** |
| Wavelength calibration | \`calibration_runtime_regression\`, scientific \`analysis_regression\` | Fit state, anchor/extrapolation model, independence warning, import/startup; **not a new independent wavelength calibration against withheld standards** |
| Gas Tube and Atomic LAB | \`gastube_fingerprint_regression\`, \`spectral_tube_real_exports_regression\`, real Ne/N2 regressions | Production profile scoring and source-identity gates, genuine user peak positions, negative controls, strict match cap |
| Molecular spectra | Scientific analysis tests + real-export tests | Generic/curated multi-band thresholds, non-overlapping evidence, blend and calibration-anchor safety; **no large blinded validation set** |
| ASTRO | Scientific analysis regressions | Continuum, radial velocity, correction limits, reference matches and stellar-class evidence contracts; **not an independent astronomical observation** |
| AI interpretation | \`ai_context_regression\`, token budget, AI Worker \`npm test\` + \`npm run check\` | Model input, token limits, deterministic gate preservation, source data as non-evidence, O I-versus-CO parent-gas uncertainty; **no external OpenAI request or prose quality guarantee** |
| Exports | \`export_reproducibility\`, \`pdf_report_contract\` | JSON/CSV structure, report model, missing-number behavior, provenance and quality narrative; **not visual PDF printing/pagination or a real ZIP download** |
| Language & responsive display | \`i18n_runtime_regression\`, \`ui_consolidation\`, \`scientific_ui_browser_regression\` | EN/SV text and LAB status/ambiguity layout in headless Chromium at nominal 390/1180px windows; **not all views, native touch, or physical phones/tablets** |
| Worker packaging & paths | \`repository_contract\`, worker build, CI assets checks | Module references, cache-version keys, assets, scripts/styles and backend build |

Commands for a checkout of the repo:

\`\`\`sh
node tests/spectral_tube_real_exports_regression.test.cjs
node tests/gastube_fingerprint_regression.test.cjs
node tests/analysis_regression.test.js
node tests/ai_context_regression.test.mjs
node tests/pdf_report_contract.test.mjs
node tests/scientific_ui_browser_regression.test.mjs
# Chromium must be available for the last command.
cd backend/ai-worker && npm install --no-audit --no-fund && npm test && npm run check
\`\`\`

CI runs the broader complete matrix, including startup Chrome testing. A green
workflow is required before calling this stage complete in code.

## Recorded evidence and key caveats

The seven **2026-10-24** user exports are preserved as complete **detected-peak
sets** with file digests, anchors and provenance. Their 1280-sample raw intensity
arrays/images are not embedded in the compact test fixture. Only the reference
gas labels for N2, H, Ne and Hg are user-reported; **both O2 labels are
tentative**. Do not use them as confirmed training labels.

1. **Hα:** peaks at approximately 654.44 nm were strong and close to
   656.281 nm but just outside the strict 1.8 nm acceptance gate. They are
   visible as *possible* strong lines, never silently accepted.
2. **O I vs parent gas:** strong lines near O I 777/845 nm and four candidate
   CO bands may coexist. Detection of atomic oxygen cannot establish O2,
   and CO-like band matches need not prove a CO2 parent tube. The conflicting
   parent-gas claim stays unresolved in UI, JSON, PDF and AI context.
3. **Calibration:** zero polynomial-fit residual with as many coefficients as
   anchors offers no independent validation. A bright O I 845-nm feature
   lies outside the last reference anchor (~837.76 nm). Avoid overstating
   wavelength accuracy.
4. **Three-level evidence status:** *strong support* means internally strong
   multi-feature evidence under the recorded QA gates, **not** a verified
   substance identity or statistical probability. *Possible* and
   *insufficient* states do not become AI Best Match. Percentages remain
   relative ranking shares.
5. **Curated vs generic bands:** two accepted independent in-anchor features
   may suffice for a curated discharge profile with group requirements,
   while general molecular database coincidences need three.

## Physical acceptance still required

These steps require someone operating the actual spectroscope or viewing
actual exports. They are deliberately **not marked PASS** based on CI alone.

- **Camera/stripe:** connect the KVANT Spectra-1 hardware; acquire and pause
  live frames, drag stripe and confirm peak updates without stalling at
  typical acquisition rates. Repeat after changing camera and reloading.
- **Calibration:** calibrate using known independent lines, ideally with at
  least one reference line *not* used in fitting; record its measured residual.
  Avoid extrapolation beyond the last anchor if a claimed feature matters.
- **Real tubes:** acquire new traces from **confirmed** H, Ne, Hg, N2,
  O2 and CO2 sources with the same optical settings. Review Hα line and
  O I 777/845 plus CO band overlap; compare against blinded reference labels.
  Calculate identity precision and abstention rate over more independent tubes.
- **LAB/ASTRO/fluorescence:** verify changing presets and source images does
  not leave stale previous-result status or speculative AI identity visible.
  Test ASTRO solar reference and fluorescence sample visually.
- **Phone/desktop:** check narrow mobile portrait + desktop around 1180px,
  EN/SV labels, controls, text wrapping, graph, dialogs and scroll behavior
  on actual devices. Automated Chrome tests are a partial safeguard.
- **Export:** download a multi-format ZIP, reopen its JSON/CSV, inspect source
  and graph PNGs, and check final PDF pages, fonts, clipped text and
  diagnostic/AI separation with/without AI. Check actual PDF printing.
- **External AI:** optionally run an explicit, paid end-to-end test after
  reviewing the request payload, verifying the model repeats uncertain
  source identity conservatively.

## Release decision

**Code/test gate:** all CI jobs must pass on the final \`main\` commit.
**Physical instrument / scientific identity / visual print gate: OPEN**
until the checklist above is completed. No version bump or v3 tag is implied
by this QA pass. \`V3_RELEASE_PLAN.md\` is historical and does not supersede
the current v1.4.1 application version.

The intended principle is to **prefer an explicit uncertain result over a
confident but unverified identification**.
