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
assert.ok(spec.includes('Current UI version: **3.0.1**'));
assert.ok(readme.includes('Current UI version: v3.0.1'));

const archivedRoadmap = read('docs/archive/CODEX_ANALYSIS_ASTRO_ROADMAP_COMPLETED.md');
assert.ok(archivedRoadmap.includes('Status: **COMPLETE**'), 'The completed stages 1–16 roadmap must remain archived');
assert.ok(archivedRoadmap.includes('23af37278117c1629244d91ea35df7569da454a4'), 'The roadmap archive must retain its source commit');
assert.equal(fs.existsSync(path.join(root, 'CODEX_ANALYSIS_ASTRO_ROADMAP.md')), false, 'The completed roadmap must live in the archive, not remain active at repository root');

for (const relative of [
  'docs/frontend/pages/recording.html',
  'docs/frontend/workers/analysis.worker.js',
  'docs/frontend/scripts/mod/stateStore.js',
  'docs/frontend/scripts/mod/exportUi.js',
  'docs/frontend/scripts/mod/helpUi.js',
  'docs/frontend/scripts/mod/uiPanels.js',
  'docs/frontend/scripts/mod/cameraCapabilities.js',
  'docs/frontend/scripts/mod/displayModes.js',
  'docs/frontend/scripts/mod/graphAppearance.js',
  'docs/frontend/scripts/mod/i18nUi.js',
  'docs/frontend/scripts/mod/peakControls.js',
  'docs/frontend/scripts/mod/uiTweaksV203.js',
  'docs/frontend/scripts/mod/yAxisController.js'
]) {
  const source = read(relative);
  const previousPublicVersion = ['2', '3', '15'].join('.');
  assert.ok(source.includes('3.0.1'), relative + ' must carry the v3.0.1 release version');
  assert.ok(!source.includes(previousPublicVersion), relative + ' must not retain the previous public version');
  assert.ok(!source.includes('3.0.0'), relative + ' must not retain stale v3.0.0 runtime version markers');
}
const aiWorker = read('backend/ai-worker/src/index.js');
assert.ok(aiWorker.includes("appVersion: '3.0.1'"), 'AI Worker responses must expose the application release version');
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
