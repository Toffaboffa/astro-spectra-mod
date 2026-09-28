'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const workerDir = path.join(root, 'docs', 'frontend', 'workers');

const context = vm.createContext({ console });
context.self = context;
context.SPECTRA_PRO_spectrumMath = {
  clamp(value, min, max) { return Math.max(min, Math.min(max, Number(value))); },
  median(values) {
    const arr = (values || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!arr.length) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }
};
context.SPECTRA_PRO_analysisPipeline = {
  analyzeFrame(frame, state, options) {
    return {
      ok: true,
      calibrated: true,
      presetId: String(options && options.preset || 'smart-gastube'),
      autoTune: options && options.autoTune !== false,
      maxDistanceNm: 1.8,
      peaks: (frame && frame.testPeaks) || [],
      diffractionCandidates: [],
      elementScores: [],
      topHits: [],
      overlayHits: []
    };
  }
};

for (const name of ['plasmaProfiles.js', 'molecularEvidencePatch.js']) {
  new vm.Script(fs.readFileSync(path.join(workerDir, name), 'utf8'), { filename: name }).runInContext(context);
}

function frame(startNm, endNm, peakNms) {
  return {
    calibrated: true,
    nm: [startNm, endNm],
    I: [0, 0],
    testPeaks: peakNms.map((nm, index) => ({
      index,
      nm,
      value: 100 - index,
      prominence: 100 - index
    }))
  };
}

function analyzeGas(startNm, endNm, peakNms, preset = 'smart-gastube') {
  return context.SPECTRA_PRO_analysisPipeline.analyzeFrame(
    frame(startNm, endNm, peakNms),
    {},
    { preset, autoTune: true }
  );
}

function row(result, species) {
  return (result.elementScores || []).find((item) => String(item.element) === species);
}

// CO2: several CO Angstrom bands identify the tube; oxygen fragments alone must not.
let result = analyzeGas(400, 900, [451.1, 483.5, 519.8, 777.4]);
assert.ok(row(result, 'CO2'), 'CO2 should be accepted from multiple CO bands with optional O support');
assert.equal(row(result, 'CO2').strictAccepted, true);
assert.ok(Number(row(result, 'CO2').evidenceGroupCounts['co-band']) >= 2);

result = analyzeGas(400, 900, [777.4, 844.6]);
assert.equal(row(result, 'CO2'), undefined, 'oxygen fragments alone must not identify CO2');

result = analyzeGas(400, 900, [451.1, 777.4, 844.6]);
assert.equal(row(result, 'CO2'), undefined, 'one CO band plus oxygen must not identify CO2');

// H2O: both visible Balmer anchors plus oxygen support are required in a visible-range instrument.
result = analyzeGas(400, 900, [486.13, 656.28, 777.4]);
assert.ok(row(result, 'H2O'), 'H2O should be accepted from H-beta + H-alpha + O support');
assert.ok(Number(row(result, 'H2O').evidenceGroupCounts.hydrogen) >= 2);

result = analyzeGas(400, 900, [656.28, 777.4, 844.6]);
assert.equal(row(result, 'H2O'), undefined, 'one hydrogen line plus oxygen must not identify H2O');

result = analyzeGas(400, 900, [656.28]);
assert.equal(row(result, 'H2O'), undefined, 'H-alpha alone must not identify H2O');

// O2: molecular O2 + atomic O support is coherent; atomic O alone is not.
result = analyzeGas(700, 900, [762.0, 777.4]);
assert.ok(row(result, 'O2'), 'O2 should require molecular and atomic-oxygen evidence when both are in range');
assert.ok(row(result, 'O2').evidenceGroups.includes('molecular-o2'));
assert.ok(row(result, 'O2').evidenceGroups.includes('atomic-o'));

result = analyzeGas(700, 900, [777.4, 844.6]);
assert.equal(row(result, 'O2'), undefined, 'atomic oxygen alone must not identify O2 when 762 nm is covered');

// Coverage must come from the calibrated frame, not from detected peak min/max.
result = analyzeGas(700, 900, [777.4, 844.6]);
assert.equal(row(result, 'O2'), undefined, 'missing 762 nm evidence must stay missing even if detected peaks start at 777 nm');

// A UV-capable instrument may use OH 309 nm as part of the H2O fingerprint.
result = analyzeGas(280, 900, [308.9, 486.13, 656.28]);
assert.ok(row(result, 'H2O'), 'UV OH plus both Balmer anchors should be usable on UV-capable hardware');

// Discharge-parent inference is deliberately limited to smart-gastube.
result = analyzeGas(400, 900, [451.1, 483.5, 519.8, 777.4], 'smart-molecular');
assert.equal(row(result, 'CO2'), undefined, 'CO2 discharge-parent inference must not leak into smart-molecular');

console.log('Gas-tube fingerprint regression: PASS');
