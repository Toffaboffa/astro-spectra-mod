import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bootstrap = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/proBootstrap.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'docs/frontend/styles/mod-panels.css'), 'utf8');
const mainStyles = fs.readFileSync(path.join(root, 'docs/frontend/styles/styles.css'), 'utf8');
const examples = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/exampleSpectrumUi.js'), 'utf8');
const framePreview = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/framePreview.js'), 'utf8');
const graphScript = fs.readFileSync(path.join(root, 'docs/frontend/scripts/graphScript.js'), 'utf8');
const imageLoading = fs.readFileSync(path.join(root, 'docs/frontend/scripts/imageLoadingScript.js'), 'utf8');
const spectrapro = fs.readFileSync(path.join(root, 'docs/frontend/pages/spectrapro.html'), 'utf8');
const cameraScript = fs.readFileSync(path.join(root, 'docs/frontend/scripts/cameraScript.js'), 'utf8');
const stateStore = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/stateStore.js'), 'utf8');
const calibrationScript = fs.readFileSync(path.join(root, 'docs/frontend/scripts/calibrationScript.js'), 'utf8');
const calibrationIo = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/calibrationIO.js'), 'utf8');
const uiPanels = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/uiPanels.js'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/i18nUi.js'), 'utf8');
const recording = fs.readFileSync(path.join(root, 'docs/frontend/pages/recording.html'), 'utf8');
const solarIcon = fs.readFileSync(path.join(root, 'docs/frontend/assets/examples/icons/solar-spectrum.png'));
const argonAsset = JSON.parse(fs.readFileSync(path.join(root, 'docs/frontend/data/examples/ar-spectral-tube.json'), 'utf8'));

function markupCount(id) {
  return (bootstrap.match(new RegExp('id=["\\\']' + id + '["\\\']', 'g')) || []).length;
}

const labPrimary = bootstrap.indexOf('class="sp-lab-primary"');
const labAdvancedButton = bootstrap.indexOf('id="spLabAdvancedBtn"');
const labAdvanced = bootstrap.indexOf('id="spLabAdvanced"');
const labResults = bootstrap.indexOf('id="spLabHits"');
assert.ok(labPrimary >= 0 && labAdvancedButton > labPrimary && labResults > labAdvancedButton && labAdvanced > labResults, 'LAB must keep primary controls and results in the dock and expert controls in a popup');
for (const id of ['spLabEnabled', 'spLabPreset', 'spLabSubMode']) {
  const position = bootstrap.indexOf('id="' + id + '"', labPrimary);
  assert.ok(position > labPrimary && position < labAdvancedButton, id + ' must remain a primary LAB control');
}
for (const id of ['spLabMaxHz', 'spLabShowHits', 'spLabWeak', 'spLabStable', 'spLabSmart', 'spLabAutoTune', 'spLabRgb', 'spLabStrongPeak', 'spLabPeakThr', 'spLabPeakDist', 'spLabMaxDist', 'spLabInitLibBtn', 'spLabPingBtn', 'spLabQueryBtn']) {
  assert.ok(bootstrap.indexOf('id="' + id + '"', labAdvanced) > labAdvanced, id + ' must remain available under LAB Advanced');
  assert.equal(markupCount(id), 1, id + ' markup must remain unique');
}
assert.ok(bootstrap.indexOf('class="sp-actions sp-actions--lab"') < labAdvancedButton, 'AI/interpretation actions must not be buried in the LAB Advanced popup');

const astroCard = bootstrap.indexOf("card.id = 'spAstroCard'");
const astroAdvanced = bootstrap.indexOf('id="spAstroAdvanced"', astroCard);
for (const id of ['spAstroEnabled', 'spAstroContinuum', 'spAstroContinuumAdvanced', 'spAstroQuality', 'spAstroVelocity', 'spAstroClassification', 'spAstroFeatures', 'spAstroMatches']) {
  const position = bootstrap.indexOf('id="' + id + '"', astroCard);
  assert.ok(position > astroCard && position < astroAdvanced, id + ' must remain in the focused ASTRO view');
}
assert.ok(bootstrap.includes("embedded ? 'section' : 'details'"), 'reference comparison must embed inside the single Advanced region');
assert.ok(bootstrap.includes('id="spAstroReferenceMount"'), 'ASTRO reference controls must share ASTRO Advanced');
for (const id of ['spAstroShowLabels', 'spAstroLabelMinDepth', 'spAstroLabelSpacing']) {
  assert.ok(bootstrap.indexOf('id="' + id + '"', astroAdvanced) > astroAdvanced, id + ' must remain available under ASTRO Advanced');
  assert.equal(markupCount(id), 1, id + ' markup must remain unique');
}
assert.ok(bootstrap.includes('id="spLabReferenceMount"'), 'LAB reference controls must share LAB Advanced');
assert.ok(bootstrap.includes("ensureAnalysisModal('spLabAdvancedBtn'"), 'LAB Advanced must open as a popup');
assert.ok(bootstrap.includes("ensureAnalysisModal('spAstroAdvancedBtn'"), 'ASTRO Advanced must open as a popup');
assert.ok(bootstrap.includes("event.key === 'Escape'"), 'analysis popups must close with Escape');
assert.ok(bootstrap.includes('class="sp-astro-summary-grid"'), 'ASTRO summaries must use the compact desktop grid');
assert.ok(bootstrap.includes('class="sp-card-sub sp-hw-response"'), 'instrument response must use the compact hardware section');
assert.ok((bootstrap.match(/class="sp-analysis-toolbar"/g) || []).length >= 2, 'LAB and ASTRO must use the same toolbar structure');
assert.ok(styles.includes('#spPanel-lab .sp-analysis-toolbar{display:flex;flex-direction:column'), 'LAB actions must stay on their own compact row without colliding with Preset and Mode');

assert.ok(styles.includes('#spPanel-astro .sp-analysis-layout'), 'LAB/ASTRO must share responsive analysis layout rules');
assert.ok(styles.includes('#spPanel-astro .sp-subtitle'), 'ASTRO subtitles must use dock typography instead of browser heading defaults');
assert.ok(styles.includes('#spPanel-astro .sp-lab-head{display:none !important;}'), 'ASTRO must not add a heading that LAB omits');
assert.ok(styles.includes('border-right:2px solid #fff'), 'selected dock checkboxes must show a white check');
assert.ok(styles.includes('.sp-reference-comparison--embedded'), 'reference controls must not create a second expanding block');
assert.ok(styles.includes('box-sizing:border-box !important;'), 'fixed-height tab panels must include borders and padding in their measured height');
assert.ok(styles.includes('min-height:125px'), 'analysis tables must be allowed to shrink inside the fixed desktop dock');
assert.ok(styles.includes('.sp-modal__panel--analysis'), 'Advanced analysis controls must use a viewport-safe popup');
assert.ok(styles.includes('#spPanel-astro .sp-analysis-layout .sp-lab-hit strong{font-size:11px'), 'ASTRO result columns must use the same compact result typography');
assert.ok(styles.includes('grid-template-rows:auto minmax(0,1fr)'), 'ASTRO result rows must be constrained to the available panel height');
assert.ok(styles.includes('@media (max-width: 900px)'), 'normal-width layout must have a compact responsive fallback');
assert.ok(mainStyles.includes('#videoMainWindow.sp-numeric-source'), 'numeric examples must reserve the normal source-view height');
assert.ok(mainStyles.includes('aspect-ratio:16 / 9'), 'numeric source previews must use the same 16:9 geometry as the 1280x720 image examples');
assert.ok(mainStyles.includes('pointer-events:none'), 'the numeric source placeholder must not block source controls');
assert.ok(mainStyles.includes('background:#000'), 'numeric examples must use a plain black source preview until a matching preview exists');
assert.ok(!mainStyles.includes('TSIS-1 HSRS\\A'), 'the black numeric source preview must not contain placeholder text');
assert.ok(examples.includes("sourceWindow.classList.add('sp-numeric-source')"), 'numeric examples must activate the reserved source view');
assert.ok(examples.includes("sourceWindow.classList.remove('sp-numeric-source')"), 'image examples must restore the normal source view');
assert.ok(examples.includes('sp.framePreview.clearSourceImage()'), 'numeric examples must forget a previously loaded source image');
assert.ok(examples.includes('const width = 1280;') && examples.includes('const height = 720;'), 'solar preview must match the 1280x720 image examples');
assert.ok(examples.includes("setGraphFillMode('source')"), 'loading Solar must select SOURCE graph fill');
assert.ok(examples.includes("setGraphFillMode('off')"), 'loading a normal image example must restore the default OFF graph fill');
assert.ok(examples.includes('asset.irradianceWm2Nm'), 'solar preview must derive its Fraunhofer structure from the bundled numeric measurements');
assert.ok(examples.includes("id: 'ar-spectral-tube'"), 'Load Example chooser must expose the Argon spectral-tube sample');
assert.ok(examples.includes("kind: 'rgb-spectrum'"), 'Argon chooser sample must use the measured RGB spectrum loader');
assert.equal(argonAsset.schema, 'spectra-pro-rgb-spectrum-example/v1', 'Argon measured example must keep its versioned schema');
assert.equal(argonAsset.sampleCount, 1280, 'Argon measured example must keep all 1280 samples');
assert.ok(graphScript.includes('Array.isArray(numeric.R) ? numeric.R.slice() : null'), 'numeric LAB frames must preserve measured RGB channels');
assert.ok(examples.includes("solar: '../assets/examples/icons/solar-spectrum.png'"), 'Solar chooser card must use its dedicated spectrum icon');
assert.deepEqual([...solarIcon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'Solar chooser icon must be a real PNG');
assert.equal(solarIcon.readUInt32BE(16), 1280, 'Solar chooser icon must preserve the supplied width');
assert.equal(solarIcon.readUInt32BE(20), 426, 'Solar chooser icon must preserve the supplied height');
assert.equal(solarIcon[25], 6, 'Solar chooser icon must use RGBA PNG transparency');
assert.ok(framePreview.includes('api.clearSourceImage = function()'), 'frame preview must expose a safe source-image reset');
assert.ok(mainStyles.includes('#videoMainWindow.sp-numeric-source #cameraImage'), 'numeric examples must forcibly hide stale source images');
assert.ok(mainStyles.includes('#videoMainWindow.sp-numeric-source #spFramePreviewCanvas'), 'numeric examples must show their matching source preview canvas');
assert.ok(graphScript.includes('useNumericSourceFill'), 'SOURCE graph fill must use the calibrated numeric wavelength colors');
assert.ok(graphScript.includes('numericSourceRgb.R[zoomStart + x]'), 'SOURCE graph fill must use measured-preview RGB instead of the SYNTHETIC palette');
assert.ok(spectrapro.includes('graphScript.js?v=3.0.9'), 'published graph code must use a fresh cache key');
assert.ok(spectrapro.includes('stateStore.js?v=3.0.9'), 'dynamic ASTRO label UI loader must use a fresh cache key');
assert.ok(spectrapro.includes('uiPanels.js?v=3.0.9'), 'version badge UI must use a release cache key');
assert.ok(spectrapro.includes('styles.css?v=3.0.9'), 'published Solar preview CSS must use a fresh cache key');
assert.ok(spectrapro.includes('overlays.js?v=3.0.9'), 'published ASTRO overlay must use a fresh cache key');
assert.ok(spectrapro.includes('proBootstrap.js?v=3.0.9'), 'published ASTRO controls must use a fresh cache key');
assert.ok(spectrapro.includes('mod-panels.css?v=3.0.9'), 'published ASTRO control styles must use a fresh cache key');
assert.ok(!fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/aiAnalysisUi.js'), 'utf8').includes('sp-ai-launch__badge'), 'AI Interpretation must not show a NEW badge');
assert.ok(graphScript.includes('&& !numericFrame'), 'static numeric spectra must stop the live camera animation loop');
assert.ok(imageLoading.includes('resetBundledExampleStateForCamera()'), 'loading an external image must leave bundled-example calibration and preview state');
assert.ok(imageLoading.includes('runtime.setVideoElement(imageElement)'), 'external images must switch source through the runtime bridge so numeric frames are cleared');
assert.ok(imageLoading.includes('runtime.refreshActiveSourceMetrics()'), 'external image dimensions must refresh after decode');
assert.ok(imageLoading.includes("if (typeof syncCanvasToVideo === 'function') syncCanvasToVideo();"), 'external images must resync the source overlay geometry');
assert.ok(!imageLoading.includes("videoElement = document.getElementById('cameraImage')"), 'external images must not bypass the runtime source transition with the legacy direct assignment');
assert.ok(spectrapro.includes('imageLoadingScript.js?v=3.0.9'), 'published external-image loader must use a fresh cache key');
assert.ok(examples.includes('calibrationPointsEqual(activePoints, points)'), 'sample calibration must verify that the configured points actually became active');
assert.ok(!examples.includes('syncCalibrationShell(points)'), 'samples must not maintain a private CALIBRATE synchronization path');
assert.ok(examples.includes("typeof calibration.applyPoints !== 'function'"), 'samples must use the canonical calibration API');
assert.ok((examples.match(/resetActiveExampleBeforeLoad\(\);/g) || []).length >= 3, 'every bundled sample source type must clear the previous sample state before switching');
assert.ok(cameraScript.includes("if (!exampleId) return false;"), 'automatic calibration reset must be guarded by an active bundled-example marker');
assert.ok(cameraScript.includes("calibration.reset({ source: 'sample-exit' })"), 'sample exit must reset through the canonical calibration API');
assert.ok(imageLoading.includes("resetBundledExampleStateForCamera()"), 'external images must clear calibration only through the bundled-example guard');
assert.ok(calibrationScript.includes('function publishCalibrationState(meta)'), 'core calibration must publish canonical state directly');
assert.ok(calibrationScript.includes('applyPoints: applyCalibrationPoints'), 'core calibration must expose canonical point application');
assert.ok(bootstrap.includes('function syncCanonicalCalibration(payload, source)'), 'PRO must have one calibration synchronization path');
assert.ok(!spectrapro.includes('phase1-bridge'), 'published page must not register a second calibration-to-store bridge');
assert.ok(calibrationIo.includes('function isUsableCalibration(state)'), 'nm handoff must require verified points and coefficients');
assert.ok(!calibrationIo.includes('__spectraPromptBound'), 'calibration file import must not use the old timing guess');
assert.ok(uiPanels.includes("'calibration',"), 'root calibration state updates must reanalyze static images');
assert.ok(stateStore.includes("exampleSpectrumUi.js?v=' + AI_ASSET_VERSION"), 'dynamic sample loader must use the release cache key');
assert.ok(spectrapro.includes('calibrationScript.js?v=3.0.9'), 'canonical calibration engine must be cache-versioned');
assert.ok(spectrapro.includes('calibrationPointManager.js?v=3.0.9'), 'CALIBRATE point manager must be cache-versioned');
assert.ok(spectrapro.includes('stateStore.js?v=3.0.9'), 'published state store must use the 3.0.9 cache key');
assert.ok(spectrapro.includes('proBootstrap.js?v=3.0.9'), 'published PRO synchronization must use the 3.0.9 cache key');
assert.ok(!graphScript.includes("resizeCanvasToDisplaySize(graphCtx, graphCanvas, 'Normal');\n      if (typeof window.drawGraph === 'function') window.drawGraph();"), 'numeric spectrum loading must not redraw and emit the same frame twice');
for (const label of ['Advanced analysis settings', 'Advanced ASTRO details', 'Advanced: reference spectrum comparison', 'Continuum diagnostics']) {
  assert.ok(i18n.includes("'" + label + "':"), label + ' must remain translatable in EN/SV UI');
}

console.log('UI consolidation regression: primary workflows, Advanced groups and responsive hierarchy passed.');
