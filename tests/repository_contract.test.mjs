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
assert.ok(spec.includes('Current application version: **1.4.1**'));
assert.ok(spec.includes('analysis worker reports **1.4.1**'));
assert.ok(readme.includes('Current application version: v1.4.1'));
assert.ok(readme.includes('canonical semantic version `1.4.1`'));

const releaseSources = [
  'docs/frontend/scripts/mod/uiPanels.js',
  'docs/frontend/scripts/mod/calibrationIO.js',
  'docs/frontend/scripts/mod/stateStore.js',
  'docs/frontend/scripts/mod/exampleSpectrumUi.js',
  'docs/frontend/scripts/mod/calibrationPointManager.js',
  'docs/frontend/scripts/mod/proBootstrap.js'
];
for (const relative of releaseSources) {
  assert.ok(read(relative).includes('1.4.1'), relative + ' must carry the canonical 1.4.1 release version');
}
const spectraproPage = read('docs/frontend/pages/spectrapro.html');
assert.ok(spectraproPage.includes('?v=1.4.1'), 'canonical application page must publish 1.4.1 cache keys');
assert.ok(spectraproPage.includes('calibrationScript.js?v=1.4.1'), 'canonical calibration engine must use the v1.4 release cache key');
assert.ok(!spectraproPage.includes('phase1-bridge'), 'duplicate calibration bridge must not return');
assert.ok(!spectraproPage.includes('languageScript.js'), 'canonical application page must not load the retired query-parameter language loader');

const lateUiVersionSources = [
  'docs/frontend/scripts/mod/uiTweaks.js',
  'docs/frontend/scripts/mod/exportUi.js',
  'docs/frontend/scripts/mod/i18nUi.js'
];
for (const relative of lateUiVersionSources) {
  const source = read(relative);
  assert.ok(source.includes('1.4.1'), relative + ' must carry the canonical 1.4.1 app version');
  assert.ok(!/3\\.0\\.[0-9]/.test(source), relative + ' must not expose a stale 3.0.x runtime version');
}
const stateStore = read('docs/frontend/scripts/mod/stateStore.js');
const i18nUi = read('docs/frontend/scripts/mod/i18nUi.js');
assert.ok(stateStore.includes("script.src = '../scripts/mod/i18nUi.js?v=' + AI_ASSET_VERSION;"), 'modern EN/SV interface must remain loaded through the canonical state-store asset loader');
assert.ok(i18nUi.includes("currentLanguage = 'en';"), 'modern i18n must keep English as the initial interface language');
assert.ok(i18nUi.includes("String(lang || '').toLowerCase() === 'sv' ? 'sv' : 'en'"), 'modern i18n must keep the explicit EN/SV switch');
assert.ok(!i18nUi.includes('URLSearchParams'), 'modern i18n must not rewrite query parameters');
assert.ok(!i18nUi.includes('window.location') && !i18nUi.includes('global.location'), 'modern i18n must not redirect or replace the current URL');

const calibrationEngine = read('docs/frontend/scripts/calibrationScript.js');
assert.ok(calibrationEngine.includes('commitCalibrationStateToSpectraPro'), 'calibration engine must directly commit canonical PRO state');
assert.ok(calibrationEngine.includes("sp.store.update('calibration', canonical"), 'calibration engine must not depend on an event listener to populate PRO store');
assert.ok(calibrationEngine.includes('sp.calibrationPointManager = manager'), 'calibration engine must synchronize CALIBRATE points directly');

const uiTweaks = read('docs/frontend/scripts/mod/uiTweaks.js');
assert.ok(uiTweaks.includes("const APP_VERSION = '1.4.1';"), 'late UI tweaks must use canonical app version 1.4.1');
assert.ok(uiTweaks.includes("const DISPLAY_VERSION = 'v' + APP_VERSION;"), 'visible version badge must derive from canonical app version');
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
assert.ok(uiTweaks.includes('badge.textContent = DISPLAY_VERSION;'), 'version badge write must remain derived from the canonical release version');

const ciWorkflow = read('.github/workflows/ci.yml');
const backendJobStart = ciWorkflow.indexOf('  backend-tests:');
const frontendJobStart = ciWorkflow.indexOf('  frontend-smoke:');
assert.ok(backendJobStart >= 0 && frontendJobStart > backendJobStart, 'CI must define a dedicated backend-tests job');
const backendCi = ciWorkflow.slice(backendJobStart, frontendJobStart);
assert.ok(backendCi.includes('actions/setup-node@v4'), 'backend CI must use Node rather than the obsolete Python placeholder');
assert.ok(backendCi.includes('node-version: "20"'), 'backend CI must run on Node 20');
assert.ok(backendCi.includes('working-directory: backend/ai-worker'), 'backend CI must execute inside the Cloudflare Worker package');
assert.ok(backendCi.includes('npm install --no-audit --no-fund'), 'backend CI must install Worker dependencies');
assert.ok(backendCi.includes('npm test'), 'backend CI must run Worker unit/contract tests');
assert.ok(backendCi.includes('npm run check'), 'backend CI must run Wrangler dry-run build validation');
assert.ok(!backendCi.includes('setup-python') && !backendCi.includes('pytest'), 'backend CI must not regress to the old Python/pytest no-op job');

const backendPackage = JSON.parse(read('backend/ai-worker/package.json'));
assert.equal(backendPackage.scripts.test, 'node --test tests/*.test.mjs', 'AI Worker package must expose its backend test suite');
assert.equal(backendPackage.scripts.check, 'wrangler deploy --dry-run', 'AI Worker check must validate the Cloudflare build with Wrangler');
assert.ok(fs.existsSync(path.join(root, 'backend/ai-worker/tests/worker.test.mjs')), 'backend Worker request tests must remain in the repository');
assert.ok(fs.existsSync(path.join(root, 'backend/ai-worker/tests/contracts.test.mjs')), 'backend prompt/response contract tests must remain in the repository');
assert.ok(fs.existsSync(path.join(root, 'backend/ai-worker/tests/openaiClient.test.mjs')), 'backend OpenAI connector tests must remain in the repository');

const aiWorker = read('backend/ai-worker/src/index.js');
assert.ok(aiWorker.includes("appVersion: '1.4.1'"), 'AI Worker responses must expose application release 1.4.1');
const aiWorkerPackage = JSON.parse(read('backend/ai-worker/package.json'));
assert.equal(aiWorkerPackage.version, '1.4.1', 'AI Worker package metadata must align with the SPECTRA PRO 1.4.1 release');
const aiWorkerReadme = read('backend/ai-worker/README.md');
assert.ok(aiWorkerReadme.includes('appVersion: "1.4.1"'), 'AI Worker deployment documentation must show the current appVersion');
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
  'docs/frontend/styles/mod-panels.css.bak',
  'docs/frontend/scripts/languageScript.js',
  'docs/frontend/languages/en.json', 'docs/frontend/languages/sv.json'
];
for (const relative of removedPlaceholders) assert.equal(fs.existsSync(path.join(root, relative)), false, relative + ' must not return as dead scaffold');

assert.equal(fs.existsSync(path.join(root, 'docs/frontend/scripts/mod/uiTweaksV203.js')), false, 'legacy versioned uiTweaks filename must not return');

const versionedRuntimeSources = [
  'docs/frontend/scripts/mod/cameraCapabilities.js',
  'docs/frontend/scripts/mod/displayModes.js',
  'docs/frontend/scripts/mod/graphAppearance.js',
  'docs/frontend/scripts/mod/peakControls.js',
  'docs/frontend/scripts/mod/yAxisController.js',
  'docs/frontend/workers/workerRouter.js'
];
for (const relative of versionedRuntimeSources) {
  const source = read(relative);
  assert.ok(source.includes("'1.4.1'"), relative + ' must report canonical runtime version 1.4.1');
  assert.ok(!source.includes("'3.0.1'"), relative + ' must not report legacy runtime version 3.0.1');
}
const workerEntry = read('docs/frontend/workers/analysis.worker.js');
assert.ok(workerEntry.includes("const WORKER_ASSET_VERSION = '1.4.1-analysis-1';"), 'analysis worker imports must share a canonical 1.4.1 cache namespace');
assert.ok(!workerEntry.includes('?v=3.0.1') && !workerEntry.includes('?v=1.3.8'), 'analysis worker imports must not carry legacy app-version-looking cache keys');
const workerRouter = read('docs/frontend/workers/workerRouter.js');
assert.ok(workerRouter.includes("const ANALYSIS_VERSION = '1.4.1';"), 'analysis results must report canonical analysis version 1.4.1');
assert.ok(workerRouter.includes('out.analysisVersion = ANALYSIS_VERSION;'), 'analysis result metadata must derive from the canonical analysis version');
assert.ok(stateStore.includes("const AI_ASSET_VERSION = '1.4.1-versioning-1';"), 'dynamic frontend assets must use a 1.4.1 cache revision namespace');
assert.ok(stateStore.includes("../scripts/mod/uiTweaks.js?v="), 'dynamic loader must use the unversioned uiTweaks filename');

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
