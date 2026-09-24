import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

const spec = read('FunctionSpec.md');
const readme = read('README.md');
for (const status of ['IMPLEMENTED', 'EXPERIMENTAL', 'PLANNED']) {
  assert.ok(spec.includes(status), 'FunctionSpec must define ' + status);
  assert.ok(readme.includes(status), 'README must expose ' + status);
}
assert.ok(spec.includes('spectra-pro-export/v2'));
assert.ok(spec.includes('Current UI version: **3.0.9**'));
assert.ok(readme.includes('Current UI version: v3.0.9'));

const releaseSources = [
  'docs/frontend/scripts/mod/uiPanels.js',
  'docs/frontend/scripts/mod/calibrationIO.js',
  'docs/frontend/scripts/mod/stateStore.js',
  'docs/frontend/scripts/mod/exampleSpectrumUi.js',
  'docs/frontend/scripts/mod/calibrationPointManager.js',
  'docs/frontend/scripts/mod/proBootstrap.js'
];
for (const relative of releaseSources) {
  assert.ok(read(relative).includes('3.0.9'), relative + ' must carry the v3.0.9 release version');
}
const spectraproPage = read('docs/frontend/pages/spectrapro.html');
assert.ok(spectraproPage.includes('?v=3.0.9'), 'canonical application page must publish 3.0.9 cache keys');
assert.ok(!spectraproPage.includes('phase1-bridge'), 'duplicate calibration bridge must not return');

const aiWorker = read('backend/ai-worker/src/index.js');
assert.ok(aiWorker.includes("appVersion: '3.0.9'"), 'AI Worker responses must expose application release 3.0.9');
assert.ok(!aiWorker.includes('stage: 6'), 'AI Worker responses must not expose a temporary roadmap-stage label');

const removedPlaceholders = [
  'docs/frontend/scripts/mod/calibrationBridge.js', 'docs/frontend/scripts/mod/calibrationPresets.js',
  'docs/frontend/scripts/mod/continuum.js', 'docs/frontend/scripts/mod/exportAugment.js',
  'docs/frontend/scripts/mod/flatField.js', 'docs/frontend/scripts/mod/instrumentProfile.js',
  'docs/frontend/scripts/mod/libraryFilters.js', 'docs/frontend/scripts/mod/normalization.js',
  'docs/frontend/scripts/mod/observationProfile.js', 'docs/frontend/scripts/mod/sessionCapture.js',
  'docs/frontend/scripts/mod/smoothing.js', 'docs/frontend/scripts/mod/speciesSearch.js',
  'docs/frontend/workers/autoMode.js', 'docs/frontend/workers/bandMatcher.js',
  'docs/frontend/workers/downsample.js', 'docs/frontend/workers/offsetEstimate.js',
  'docs/frontend/styles/mod-panels.css.bak'
];
for (const relative of removedPlaceholders) assert.equal(fs.existsSync(path.join(root, relative)), false, relative + ' must not return as dead scaffold');

const recordingPath = path.join(root, 'docs/frontend/pages/recording.html');
const recording = fs.readFileSync(recordingPath, 'utf8');
for (const match of recording.matchAll(/<(?:script|link)\b[^>]+(?:src|href)="([^"]+)"/g)) {
  const reference = match[1].split('?')[0];
  if (/^(?:https?:|data:|#)/.test(reference)) continue;
  assert.ok(fs.existsSync(path.resolve(path.dirname(recordingPath), reference)), 'missing recording asset: ' + reference);
}

const workerPath = path.join(root, 'docs/frontend/workers/analysis.worker.js');
const worker = fs.readFileSync(workerPath, 'utf8');
for (const match of worker.matchAll(/['"](\.\/[^'"]+?\.js)(?:\?[^'"]*)?['"]/g)) {
  assert.ok(fs.existsSync(path.resolve(path.dirname(workerPath), match[1])), 'missing worker module: ' + match[1]);
}

assert.ok(!read('docs/frontend/scripts/mod/displayModes.js').includes('scaffold'));
assert.ok(!read('docs/frontend/scripts/mod/yAxisController.js').includes('scaffold'));
assert.ok(!read('docs/frontend/scripts/mod/graphAppearance.js').includes('placeholder: true'));

console.log('Repository contract regression: status docs, runtime paths, worker modules and dead-scaffold cleanup passed.');
