'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'docs/frontend/workers');
const ctx = vm.createContext({ console });
ctx.self = ctx;
for (const file of ['plasmaProfiles.js', 'gasTubeSourceAssessment.js', 'analysisPipeline.js']) {
  new vm.Script(fs.readFileSync(path.join(dir, file), 'utf8'), { filename: file }).runInContext(ctx);
}
const engine = ctx.SPECTRA_PRO_gasTubeSourceAssessment;
const gate = ctx.SPECTRA_PRO_analysisPipeline.qualifyPrimaryEvidence;
const profileNames = Object.keys(ctx.SPECTRA_PRO_plasmaProfiles.profiles);
assert.ok(profileNames.length >= 5);

function assess(name, nms, values, extra = {}) {
  const peaks = nms.map((nm, index) => ({
    index: index + 100, nm: nm, prominence: values ? values[index] : 90
  }));
  const result = {
    ok: true, calibrated: true, presetId: 'smart-gastube', mode: 'lab',
    hardMatchCapNm: 1.8, peaks: peaks, diffractionCandidates: [],
    elementScores: [{ element: name, mode: 'molecular',
      evidenceModel: 'gastube-discharge-fingerprint-v1', matchedPeaks: peaks.length }],
    winnerBreakdown: { primaryEmitter: name },
    topHits: peaks.map(p => ({
      element: name, peakIndex: p.index, observedNm: p.nm,
      referenceNm: p.nm, deltaNm: 0
    })),
    calibrationDiagnostics: { anchorPixelCoverage: { min: 0, max: 1000 },
      anchorWavelengthCoverageNm: { min: 380, max: 900 } },
    ...extra
  };
  return engine.assess(result, { nm: [380, 900] });
}

const nitrogen = assess('N2', [389.46, 399.84, 405.94, 426.97, 434.36]);
assert.equal(nitrogen.gasTubeSourceAssessment.reportable, true);
assert.equal(nitrogen.gasTubeSourceAssessment.parentGasConfirmed, false);
assert.equal(nitrogen.gasTubeSourceAssessment.parentGasStatus, 'source-pattern-supported');
assert.ok(nitrogen.gasTubeSourceAssessment.emittingSpecies.some(e =>
  e.emitter === 'N2' && e.independentCount >= 3));
assert.ok(nitrogen.gasTubeSourceAssessment.sourceCandidates.some(p =>
  p.species === 'N2' && p.independentDirectCount >= 3));
assert.equal(gate(nitrogen).reportable, true);

const carbon = assess('CO2', [451.1, 483.5, 519.8, 561.0, 777.4, 844.6]);
assert.equal(carbon.gasTubeSourceAssessment.reportable, false);
assert.equal(carbon.gasTubeSourceAssessment.reason, 'emission-products-do-not-prove-parent-gas');
assert.ok(carbon.gasTubeSourceAssessment.emittingSpecies.some(e =>
  e.emitter === 'CO Angstrom' && e.independentCount >= 3));
assert.ok(carbon.gasTubeSourceAssessment.emittingSpecies.some(e => e.emitter === 'O I'));
assert.equal(gate(carbon).reportable, false);
assert.equal(gate(carbon).reason, 'parent-gas-profile-not-identified');

const water = assess('H2O', [486.13, 656.28, 777.4, 844.6]);
assert.equal(water.gasTubeSourceAssessment.reportable, false);
assert.ok(water.gasTubeSourceAssessment.emittingSpecies.some(e =>
  e.emitter === 'H-beta' || e.emitter === 'H-alpha'));
assert.equal(water.gasTubeSourceAssessment.parentGasConfirmed, false);

const oxygen = assess('O2', [762.0, 777.4, 844.6]);
assert.equal(oxygen.gasTubeSourceAssessment.reportable, false,
  'One direct O2 band plus atomic fragment lines cannot verify an O2 parent');
const onlyO = assess('O2', [777.4, 844.6]);
assert.equal(onlyO.gasTubeSourceAssessment.reportable, false);
assert.equal(onlyO.gasTubeSourceAssessment.parentGasConfirmed, false);

const none = assess('CO2', [532.3, 549.8, 591.2]);
assert.equal(none.gasTubeSourceAssessment.reportable, true,
  'Unrelated noise must not trigger a false parent veto for an otherwise ranked emitter');
assert.equal(none.gasTubeSourceAssessment.parentGasStatus, 'atomic-or-unprofiled-emitter');
assert.equal(none.gasTubeSourceAssessment.emittingSpecies.length, 0);

// Most important anti-hardcoding test: change the catalog at runtime. Two
// previously unknown source identifiers with the SAME measured wavelengths
// must be treated according to emitter identity, not gas names.
ctx.SPECTRA_PRO_plasmaProfiles.profiles.FOO = {
  label: 'Invented direct spectral fingerprint', strictAcceptance: true,
  minimumStrongEvidence: 3,
  anchors: [
    { nm: 611.1, emitter: 'FOO', group: 'direct' },
    { nm: 633.3, emitter: 'FOO', group: 'direct' },
    { nm: 688.8, emitter: 'FOO', group: 'direct' }
  ]
};
ctx.SPECTRA_PRO_plasmaProfiles.profiles.BAR = {
  label: 'Invented dissociation fingerprint', strictAcceptance: true,
  minimumStrongEvidence: 3,
  anchors: [
    { nm: 611.1, emitter: 'FRAGMENT', group: 'fragment' },
    { nm: 633.3, emitter: 'FRAGMENT', group: 'fragment' },
    { nm: 688.8, emitter: 'FRAGMENT', group: 'fragment' }
  ]
};
const unknownDirect = assess('FOO', [611.1, 633.3, 688.8]);
const unknownFragment = assess('BAR', [611.1, 633.3, 688.8]);
assert.equal(unknownDirect.gasTubeSourceAssessment.reportable, true);
assert.equal(unknownDirect.gasTubeSourceAssessment.parentGasStatus, 'source-pattern-supported');
assert.equal(unknownFragment.gasTubeSourceAssessment.reportable, false);
assert.equal(unknownFragment.gasTubeSourceAssessment.parentGasStatus, 'unresolved-indirect-emission');
assert.equal(unknownDirect.gasTubeSourceAssessment.reasonModel, 'same-rules-all-catalog-profiles');
assert.ok(unknownFragment.gasTubeSourceAssessment.emittingSpecies.some(e => e.emitter === 'FRAGMENT'));
assert.ok(unknownDirect.gasTubeSourceAssessment.sourceCandidates.every(p => p.parentGasConfirmed === false));

const atomic = assess('Ne', [585.249, 640.225, 703.241], null, {
  elementScores: [{ element: 'Ne', mode: 'atomic', matchedPeaks: 3 }],
  topHits: [
    { element: 'Ne', species: 'Ne I', observedNm: 585.249, referenceNm: 585.249,
      peakIndex: 100, deltaNm: 0 },
    { element: 'Ne', species: 'Ne I', observedNm: 640.225, referenceNm: 640.225,
      peakIndex: 101, deltaNm: 0 },
    { element: 'Ne', species: 'Ne I', observedNm: 703.241, referenceNm: 703.241,
      peakIndex: 102, deltaNm: 0 }
  ]
});
assert.equal(atomic.gasTubeSourceAssessment.reportable, true);
assert.ok(atomic.gasTubeSourceAssessment.emittingSpecies.some(e =>
  e.emitter === 'Ne I' && e.independentCount === 3));

const noEffect = engine.assess({ ok:true,calibrated:true,presetId:'smart-fluorescent' }, { nm:[380,900] });
assert.equal(noEffect.gasTubeSourceAssessment, undefined, 'Other presets must be unchanged');
console.log('Generic source/emitter model: positive/negative catalog, runtime-injected unknown source, mixtures and atomic emission PASS.');
