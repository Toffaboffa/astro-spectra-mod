/*
 * Reproducible, real-observation evidence from seven SPECTRA PRO 1.4.1 exports
 * recorded 2026-10-24. No fabricated intensities or inferred tube labels.
 *
 * Scope: replay ALL exported detected peaks through the PRODUCTION atomic and
 * molecular fingerprint scorers, without camera extraction/preprocessing.
 * Original full-resolution user ZIPs are the authoritative raw source;
 * fixture keeps its SHA-256 to tie these reduced observations back to them.
 *
 * Known science defects are described in the docs and TODO tests below. We
 * intentionally do NOT assert that an observed bug must keep happening.
 *
 * node tests/spectral_tube_real_exports_regression.test.cjs
 */
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'spectral_tubes_20261024.json'), 'utf8'));
const byId = Object.fromEntries(data.cases.map((item) => [item.id.slice(-6), item]));

function peaksOf(item) {
  return item.peaks.map(([index, nm, prominence]) => ({ index, nm, prominence, value: prominence }));
}
function rangeOf(item) {
  return { min: item.wavelengthCoverageNm[0], max: item.wavelengthCoverageNm[1] };
}
function nearest(item, nm) {
  return peaksOf(item).reduce((best, p) =>
    !best || Math.abs(p.nm - nm) < Math.abs(best.nm - nm) ? p : best, null);
}
function loadScorers() {
  const context = vm.createContext({ console });
  context.self = context;
  context.SPECTRA_PRO_analysisPipeline = {
    analyzeFrame(frame, _state, options) {
      return {
        ok: true, calibrated: true, presetId: options.preset,
        autoTune: options.autoTune !== false, maxDistanceNm: 1.8,
        peaks: frame.observedPeaks, diffractionCandidates: [],
        elementScores: [], topHits: [], overlayHits: []
      };
    }
  };
  for (const name of [
    'spectrumMath.js',
    'plasmaProfiles.js',
    'molecularEvidencePatch.js',
    'atomicProfiles.js',
    'atomicEvidence.js'
  ]) {
    new vm.Script(fs.readFileSync(path.join(root, 'docs', 'frontend', 'workers', name), 'utf8'), { filename: name }).runInContext(context);
  }
  return context;
}

const modules = loadScorers();
function replayMolecular(item) {
  return modules.SPECTRA_PRO_analysisPipeline.analyzeFrame({
    nm: item.wavelengthCoverageNm,
    observedPeaks: peaksOf(item)
  }, {}, { preset: 'smart-gastube', autoTune: true });
}
function scoreAtomic(item, element, toleranceNm) {
  const profile = modules.SPECTRA_PRO_atomicProfiles.profiles[element];
  assert.ok(profile, 'Missing production atomic fingerprint: ' + element);
  return modules.SPECTRA_PRO_atomicEvidence.scoreProfile(profile, peaksOf(item), toleranceNm, rangeOf(item));
}

test('provenance and structural integrity of all seven real exported measurements', () => {
  assert.equal(data.schema, 'spectra-pro-real-export-peaks/v1');
  assert.equal(data.captureDate, '2026-10-24');
  assert.equal(data.cases.length, 7);
  assert.deepEqual(data.cases.map((c) => c.id.slice(-6)), [
    '201443', '203804', '204112', '204319', '204418', '204650', '211000'
  ]);
  for (const item of data.cases) {
    assert.match(item.sourceFilename, /^SPECTRA_PRO_20261024_\d{6}_analysis\.json$/);
    assert.match(item.sourceAnalysisSha256, /^[0-9a-f]{64}$/);
    assert.equal(item.fullSpectrumSamples, 1280);
    assert.equal(item.preset, 'smart-gastube');
    assert.equal(item.autoTune, true);
    assert.equal(item.hardMatchCapNm, 1.8);
    assert.equal(item.detectedPeakCount, item.peaks.length,
      item.id + ': lost an exported peak');
    assert.ok(item.calibrationAnchors.length >= 3, item.id + ': calibration lost');
    assert.ok(item.wavelengthCoverageNm[0] < item.wavelengthCoverageNm[1]);
    const seen = new Set();
    for (const [index, nm, prominence] of item.peaks) {
      assert.ok(Number.isInteger(index) && index >= 0 && index < 1280);
      assert.ok(Number.isFinite(nm) && nm > 200 && nm < 1100);
      assert.ok(Number.isFinite(prominence) && prominence >= 0);
      assert.ok(!seen.has(index), item.id + ': duplicate peak pixel');
      seen.add(index);
    }
  }
});

test('known tube provenance: H, Ne, Hg, N2; oxygen identity remains explicitly tentative', () => {
  assert.deepEqual(data.cases.map((c) => c.referenceGas),
    ['N2', 'H', 'O2', 'Ne', 'H', 'O2', 'Hg']);
  assert.deepEqual(data.cases.map((c) => c.exportedBestMatch),
    ['N2', 'H', 'CO2', 'Ne', 'H', 'CO2', 'Hg']);
  for (const id of ['204112', '204650']) {
    assert.equal(byId[id].identityStatus, 'tentative-user-identification');
  }
});

test('two actual H spectra retain the strong H-alpha peak and broad-pass evidence', () => {
  for (const id of ['203804', '204418']) {
    const item = byId[id];
    const strongest = Math.max(...peaksOf(item).map((p) => p.prominence));
    const alpha = nearest(item, 656.281);
    const offset = Math.abs(alpha.nm - 656.281);
    assert.ok(alpha.prominence / strongest > 0.9, id + ': H-alpha is no longer among the strongest peaks');
    assert.ok(offset > 1.8 && offset < 2.0, id + ': review the measured H-alpha offset');
    const broad = scoreAtomic(item, 'H', 3.0);
    assert.ok(broad && broad.hits.some((h) => Math.abs(h.referenceNm - 656.281) < 0.01),
      id + ': H-alpha must remain available as a broad confirmation candidate');
    const narrow = scoreAtomic(item, 'H', 1.8);
    assert.ok(narrow && narrow.hits.length >= 2, id + ': two narrow Balmer matches missing');
    // Deliberately NO assertion that narrow matching must reject H-alpha:
    // step 2 should eliminate this defect, not break CI by fixing it.
  }
});

test('both tentative oxygen exports preserve strong O I 777/845 nm evidence and extrapolation risk', () => {
  for (const id of ['204112', '204650']) {
    const item = byId[id];
    const oxygen777 = nearest(item, 777.35);
    const oxygen845 = nearest(item, 844.65);
    const highest = Math.max(...peaksOf(item).map((p) => p.prominence));
    assert.ok(Math.abs(oxygen777.nm - 777.35) > 1.8 &&
      Math.abs(oxygen777.nm - 777.35) < 3, id + ': check O I 777 center');
    assert.ok(Math.abs(oxygen845.nm - 844.65) < 0.5, id + ': O I 845 missing');
    assert.ok(oxygen777.prominence > highest * 0.9, id + ': O I 777 is no longer a leading peak');
    assert.ok(oxygen845.prominence > highest * 0.5, id + ': O I 845 is no longer prominent');
    assert.ok(oxygen845.index > item.calibrationAnchors.at(-1)[0],
      id + ': 845 nm peak should flag calibration extrapolation');
    const atomic = scoreAtomic(item, 'O', 3.0);
    assert.ok(atomic && atomic.hits.some((h) => Math.abs(h.referenceNm - 777.35) < 0.02));
    assert.ok(atomic.hits.some((h) => Math.abs(h.referenceNm - 844.65) < 0.02));
    const molecular = replayMolecular(item);
    assert.ok(molecular.ok && Array.isArray(molecular.elementScores));
    // We do NOT assert a CO2 winner. This is the contested behavior to fix.
  }
});

test('known Ne and Hg controls retain multiple independent production fingerprint hits', () => {
  const neon = scoreAtomic(byId['204319'], 'Ne', 1.8);
  const mercury = scoreAtomic(byId['211000'], 'Hg', 1.8);
  assert.ok(neon && neon.hits.length >= 7, 'Measured neon fingerprint became unrecognizable');
  assert.ok(mercury && mercury.hits.length >= 3, 'Measured mercury fingerprint became unrecognizable');
  assert.ok(neon.hits.some((h) => Math.abs(h.referenceNm - 585.249) < 0.01));
  assert.ok(mercury.hits.some((h) => Math.abs(h.referenceNm - 546.074) < 0.01));
});

test('real N2 export still matches the production molecular gas-tube fingerprint', () => {
  const result = replayMolecular(byId['201443']);
  const nitrogen = result.elementScores.find((row) => row.element === 'N2');
  assert.ok(nitrogen, 'Measured N2 bands are no longer identified');
  assert.ok(nitrogen.matchedCount >= 3, 'Insufficient measured N2 bands');
});

// Scientific acceptance criteria for later stages, deliberately not greenwashed
// or frozen as assertions that the current known faults are correct:
test('STEP 2: both real H exports show H-alpha as possible, NOT accepted evidence', () => {
  for (const id of ['203804', '204418']) {
    const item = byId[id];
    const out = modules.SPECTRA_PRO_atomicEvidence.enhance({
      ok: true, calibrated: true, presetId: 'smart-gastube',
      autoTune: true, maxDistanceNm: 1.8, peaks: peaksOf(item),
      elementScores: [], topHits: [], overlayHits: [],
      calibrationDiagnostics: {
        fitResidualIndependent: false,
        anchorPixelCoverage: {
          min: item.calibrationAnchors[0][0],
          max: item.calibrationAnchors.at(-1)[0]
        }
      }
    }, { nm: item.wavelengthCoverageNm }, {}, {});
    const alpha = (out.tentativeLineMatches || []).find((hit) =>
      hit.element === 'H' && Math.abs(hit.referenceNm - 656.281) < 0.01);
    assert.ok(alpha, id + ': H-alpha 656.281 nm must be shown as a review-only strong near-miss');
    assert.ok(Math.abs(alpha.observedNm - nearest(item, 656.281).nm) < 0.001);
    assert.equal(alpha.accepted, false);
    assert.equal(alpha.excludedFromScoring, true);
    assert.equal(alpha.status, 'possible');
    assert.equal(alpha.calibrationExtrapolated, false);
    assert.equal(alpha.fitResidualIndependent, false);
    assert.ok(alpha.confirmedDiagnosticLines >= 2);
    assert.ok((out.topHits || []).every((hit) => Math.abs(Number(hit.deltaNm)) <= 1.8 + 1e-9),
      'Review-only H-alpha must not leak into accepted topHits or ranking');
    assert.ok(!(out.topHits || []).some((hit) => hit.element === 'H' &&
      Math.abs(Number(hit.referenceNm) - 656.281) < 0.01));
    assert.equal(out.referenceLineConsistency.element, 'H');
    assert.equal(out.referenceLineConsistency.independentWavelengthStandard, false);
    assert.equal(out.referenceLineConsistency.needsCalibrationReview, true);
    assert.ok(out.referenceLineConsistency.residualSpreadNm > 2.5);
  }
});

test('STEP 2: broad candidate window alone cannot create an accepted identity', () => {
  const atom = modules.SPECTRA_PRO_atomicEvidence;
  const h = modules.SPECTRA_PRO_atomicProfiles.profiles.H;
  const all = peaksOf(byId['203804']);
  const single = [all.find((peak) => Math.abs(peak.nm - 654.44) < 0.02)];
  assert.equal(atom.scoreProfile(h, single, 1.8, rangeOf(byId['203804'])), null);
  // The production scorer intentionally rejects a single-line fingerprint.
  // Construct ONE strictly qualified hit to exercise the near-miss gate in isolation.
  const oneStrictHit = [{
    element: 'H', referenceNm: 434.046, observedNm: 434.3831,
    peakIndex: 142, deltaNm: 0.3371
  }];
  assert.equal(atom.reviewStrongNearMisses(
    [{ element: 'H', mode: 'atomic', matchedPeaks: 1, diagnosticMatchedPeaks: 1 }],
    all, oneStrictHit, {}, 1.8
  ).length, 0, 'One confirmed line must not enable broad near-miss evidence');
  const broadOnly = atom.reviewStrongNearMisses(
    [{ element: 'H', mode: 'atomic', matchedPeaks: 2, diagnosticMatchedPeaks: 2 }],
    all, [], {}, 1.8
  );
  assert.equal(broadOnly.length, 0, 'Without two strict accepted lines there are no possible hits');
});

test.todo('STEP 3: qualify the parent gas independently of atomic oxygen; no unjustified confident CO2 winner');
test.todo('STEP 4: molecular Best Match must pass the same evidence sufficiency gate as atomic candidates');

console.log('Real spectral tube fixtures: 7 exports (full detected-peak sets), production fingerprint replay; known defects tracked as TODO.');
