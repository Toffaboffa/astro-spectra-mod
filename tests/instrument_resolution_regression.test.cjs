'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'docs/frontend/workers/instrumentResolution.js'), 'utf8');
const context = vm.createContext({ console, self: {} });
new vm.Script(source, { filename: 'instrumentResolution.js' }).runInContext(context);
const model = context.self.SPECTRA_PRO_instrumentResolution;
assert.ok(model && typeof model.build === 'function');

const fineFrame = { nm: Array.from({ length: 101 }, (_, i) => 500 + i * 0.1) };
const fine = model.build({ spectrometerResolutionFwhmNm: 0.5, pixelResolutionNm: 0.2 }, fineFrame);
assert.equal(fine.model, 'instrument-resolution-v1');
assert.ok(Math.abs(fine.samplingNmPerPixel - 0.1) < 1e-9, 'calibrated frame sampling must override declared pixel scale');
assert.ok(Math.abs(fine.effectiveResolutionFwhmNm - 0.5) < 1e-9);
assert.equal(fine.undersampled, false);

const coarse = model.build({ spectrometerResolutionFwhmNm: 12, pixelResolutionNm: 4 }, null);
assert.equal(coarse.samplingSource, 'hardware-profile');
assert.equal(coarse.effectiveResolutionFwhmNm, 12);
assert.equal(coarse.undersampled, false);

const hits = [
  { refNm: 500.0, obsNm: 500.1 },
  { refNm: 500.3, obsNm: 500.4 },
  { refNm: 510.0, obsNm: 510.1 }
];
const fineHits = model.annotateHits(hits, fine);
assert.equal(fineHits[0].resolutionBlendRisk, true, 'lines closer than FWHM should be marked as blend-risk');
assert.equal(fineHits[2].resolutionBlendRisk, false);

const coarseHits = model.annotateHits(hits, coarse);
assert.equal(coarseHits.every(hit => hit.resolutionBlendRisk), true, 'coarse instruments should expose unresolved accepted references without widening identity tolerance');

const pipeline = fs.readFileSync(path.join(root, 'docs/frontend/workers/analysisPipeline.js'), 'utf8');
const candidate = fs.readFileSync(path.join(root, 'docs/frontend/workers/candidateAnalysis.js'), 'utf8');
assert.ok(pipeline.includes('instrumentResolutionModel'), 'analysis result must expose the resolution model');
assert.ok(candidate.includes('const hardMaxDistanceNm = autoTuneEnabled ? 1.8 : requestedMaxDistanceNm;'), 'resolution work must not widen the existing Auto Tune identity hard cap');

console.log('Instrument resolution regression: PASS');
