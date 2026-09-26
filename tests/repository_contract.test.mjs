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
assert.ok(spec.includes('Current UI version: **3.1.7**'));
assert.ok(readme.includes('Current UI version: v3.1.7'));

const releaseSources = [
  'docs/frontend/scripts/mod/uiPanels.js',
  'docs/frontend/scripts/mod/calibrationIO.js',
  'docs/frontend/scripts/mod/stateStore.js',
  'docs/frontend/scripts/mod/exampleSpectrumUi.js',
  'docs/frontend/scripts/mod/calibrationPointManager.js',
  'docs/frontend/scripts/mod/proBootstrap.js'
];
for (const relative of releaseSources) {
  assert.ok(read(relative).includes('3.1.7'), relative + ' must carry the v3.1.7 release version');
}
const spectraproPage = read('docs/frontend/pages/spectrapro.html');
assert.ok(spectraproPage.includes('?v=3.1.7'), 'canonical application page must publish 3.1.7 cache keys');
assert.ok(spectraproPage.includes('calibrationScript.js?v=3.1.7'), 'canonical calibration engine must use the v3.1.7 release cache key');
assert.ok(!spectraproPage.includes('phase1-bridge'), 'duplicate calibration bridge must not return');

const lateUiVersionSources = [
  'docs/frontend/scripts/mod/uiTweaksV203.js',
  'docs/frontend/scripts/mod/exportUi.js',
  'docs/frontend/scripts/mod/i18nUi.js'
];
for (const relative of lateUiVersionSources) {
  const source = read(relative);
  assert.ok(source.includes('3.1.7'), relative + ' must carry the v3.1.7 app version');
  assert.ok(!source.includes('3.0.8'), relative + ' must not downgrade the runtime app version to v3.0.8');
}
const calibrationEngine = read('docs/frontend/scripts/calibrationScript.js');
assert.ok(calibrationEngine.includes('commitCalibrationStateToSpectraPro'), 'calibration engine must directly commit canonical PRO state');
assert.ok(calibrationEngine.includes("sp.store.update('calibration', canonical"), 'calibration engine must not depend on an event listener to populate PRO store');
assert.ok(calibrationEngine.includes('sp.calibrationPointManager = manager'), 'calibration engine must synchronize CALIBRATE points directly');

const uiTweaks = read('docs/frontend/scripts/mod/uiTweaksV203.js');
assert.ok(uiTweaks.includes("const VERSION = 'v3.1.7';"), 'late UI tweaks must publish the v3.1.7 badge');
const bootstrap316 = read('docs/frontend/scripts/mod/proBootstrap.js');
for (const id of ['spGraphXAxisMode', 'spGraphYAxisMode', 'spGraphPeaks', 'spGraphOverlaysMenu']) {
  assert.ok(bootstrap316.includes('id="' + id + '"'), id + ' must remain in the simplified persistent graph toolbar');
}
for (const removedId of ['spGraphFillMode', 'spGraphAnalyze', 'spXAxisMode', 'spYAxisMode', 'spToggleNmPeaks']) {
  assert.ok(!bootstrap316.includes('id="' + removedId + '"'), removedId + ' must not duplicate graph controls');
}
assert.ok(bootstrap316.includes('class="sp-graph-overlays__panel"'), 'secondary overlay controls must live in the Overlays popup');
assert.ok(bootstrap316.includes("setVal('display.normalizeYAxis', normalize)"), 'persistent Y-axis must own the display scale state directly');
assert.ok(bootstrap316.includes('<span>Diffraction</span><input id="spToggleDiffractionOverlay"'), 'Diffraction checkbox must remain right-aligned in Overlays');
assert.ok(bootstrap316.includes('<span>Extrapolation</span><input id="spToggleCalibrationExtrapolation"'), 'Extrapolation checkbox must remain right-aligned in Overlays');
assert.ok(bootstrap316.includes('class="sp-core-settings-row sp-core-settings-row--display"'), 'CORE must keep its ordered display row');
assert.ok(bootstrap316.includes('class="sp-core-settings-row sp-core-settings-row--peaks"'), 'CORE must keep its ordered peak row');
assert.ok(!bootstrap316.includes('sp-form-grid sp-form-grid--core-8'), 'obsolete CORE 8-column markup must not return');
assert.ok(uiTweaks.includes('badge.textContent = VERSION;'), 'version badge write must remain tied to the release version');

const aiWorker = read('backend/ai-worker/src/index.js');
assert.ok(aiWorker.includes("appVersion: '3.1.7'"), 'AI Worker responses must expose application release 3.1.7');
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
