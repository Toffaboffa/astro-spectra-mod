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
const workerClient = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/analysisWorkerClient.js'), 'utf8');
const fluorescenceUi = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/fluorescenceUi.js'), 'utf8');
const overlays = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/overlays.js'), 'utf8');
const recording = fs.readFileSync(path.join(root, 'docs/frontend/pages/recording.html'), 'utf8');
const solarIcon = fs.readFileSync(path.join(root, 'docs/frontend/assets/examples/icons/solar-spectrum.png'));
const fluorescentIcon = fs.readFileSync(path.join(root, 'docs/frontend/assets/examples/icons/fluorescent-tube-white-256.png'));
const fluorescentSpectrum = fs.readFileSync(path.join(root, 'docs/frontend/assets/examples/fluorescent-tube/fluorescent-tube.png'));
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
for (const id of ['spGraphXAxisMode', 'spGraphYAxisMode', 'spGraphPeaks', 'spGraphOverlaysMenu']) {
  assert.equal(markupCount(id), 1, id + ' persistent graph control markup must remain unique');
}
for (const removedId of ['spGraphFillMode', 'spGraphAnalyze', 'spXAxisMode', 'spYAxisMode', 'spToggleNmPeaks']) {
  assert.equal(markupCount(removedId), 0, removedId + ' must not duplicate controls between the persistent toolbar and CORE');
}
assert.ok(bootstrap.includes("graphXAxisSel && graphXAxisSel.addEventListener('change'"), 'persistent X-axis must control the legacy graph axis directly');
assert.ok(bootstrap.includes("const pxRadio = $('toggleXLabelsPx');") && bootstrap.includes("const nmRadio = $('toggleXLabelsNm');"), 'persistent X-axis must stay wired to the real graph axis controls');
assert.ok(bootstrap.includes("graphYAxisSel && graphYAxisSel.addEventListener('change'"), 'persistent Y-axis must update display state directly');
assert.ok(bootstrap.includes("setVal('display.normalizeYAxis', normalize)"), 'persistent Y-axis must keep normalization state canonical');
assert.ok(bootstrap.includes("graphPeaksInput && graphPeaksInput.addEventListener('change'"), 'persistent Peaks must control the existing peak toggle');
assert.ok(bootstrap.includes("const target = $('togglePeaksCheckbox');"), 'persistent Peaks must stay wired to the real peak toggle');
assert.ok(bootstrap.includes('class="sp-graph-overlays__panel"'), 'Diffraction, Extrapolation and Shade must live in the Overlays popup');
assert.ok(!bootstrap.includes('id="spGraphFillMode"'), 'Fill must remain a CORE detail instead of duplicating the toolbar');
assert.ok(!bootstrap.includes('id="spGraphAnalyze"'), 'Analyze must remain in LAB/ASTRO instead of duplicating the toolbar');
assert.ok(styles.includes('#SpectraProDockHost #spGraphXAxisMode{width:60px;}'), 'persistent X-axis select must leave room for its option labels');
assert.ok(styles.includes('#SpectraProDockHost #spGraphYAxisMode{width:104px;}'), 'persistent Y-axis select must fit NORMALIZE without clipping');
assert.ok(styles.includes('#SpectraProDockHost .sp-graph-overlays__panel{'), 'Overlays must use a compact popup panel');
assert.ok(bootstrap.includes('<span>Diffraction</span><input id="spToggleDiffractionOverlay"'), 'Diffraction checkbox must sit to the right of its label');
assert.ok(bootstrap.includes('<span>Extrapolation</span><input id="spToggleCalibrationExtrapolation"'), 'Extrapolation checkbox must sit to the right of its label');
assert.ok(styles.includes('grid-template-columns:repeat(5,max-content) minmax(0,1fr) minmax(320px,28%) !important;'), 'desktop toolbar must reserve the status-rail column so Peaks ends at the panel edge');
assert.ok(styles.includes('#SpectraProDockHost #spTabs > .sp-graph-tools{'), 'persistent graph tools must occupy the panel-width toolbar column');
assert.ok(bootstrap.includes('class="sp-core-settings-row sp-core-settings-row--display"'), 'CORE display controls must use an ordered display row');
assert.ok(bootstrap.includes('class="sp-core-settings-row sp-core-settings-row--peaks"'), 'CORE peak controls must use a dedicated peak row');
assert.ok(bootstrap.includes('class="sp-core-traces"'), 'CORE trace toggles must stay grouped together');
assert.ok(!bootstrap.includes('sp-form-grid sp-form-grid--core-8'), 'CORE must not fall back to the obsolete 8-column layout after controls move to the toolbar');
assert.ok(!bootstrap.includes('id="spFieldCorePlaceholder"'), 'CORE must not keep an empty placeholder from the old grid');

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
assert.ok(mainStyles.includes('--sp-source-primary-bg:#244a78'), 'primary Live/Pause controls must use the SPECTRA blue treatment');
assert.ok(mainStyles.includes('--sp-source-secondary-bg:#173d47'), 'secondary source controls must use the complementary teal treatment');
assert.ok(mainStyles.includes('#cameraPrimaryControlRow .btn,') && mainStyles.includes('height:30px !important'), 'both source-control rows must share the same 30 px button height');
assert.ok(!mainStyles.includes('TSIS-1 HSRS\\A'), 'the black numeric source preview must not contain placeholder text');
assert.ok(examples.includes("sourceWindow.classList.add('sp-numeric-source')"), 'numeric examples must activate the reserved source view');
assert.ok(examples.includes("sourceWindow.classList.remove('sp-numeric-source')"), 'image examples must restore the normal source view');
assert.ok(examples.includes('sp.framePreview.clearSourceImage()'), 'numeric examples must forget a previously loaded source image');
assert.ok(examples.includes('const width = 1280;') && examples.includes('const height = 720;'), 'solar preview must match the 1280x720 image examples');
assert.ok(examples.includes("setGraphFillMode('source')"), 'loading Solar must select SOURCE graph fill');
assert.ok(examples.includes("setGraphFillMode('off')"), 'loading a normal image example must restore the default OFF graph fill');
assert.ok(examples.includes('asset.irradianceWm2Nm'), 'solar preview must derive its Fraunhofer structure from the bundled numeric measurements');
assert.ok(examples.includes("id: 'ar-spectral-tube'"), 'Load Example chooser must expose the Argon spectral-tube sample');
assert.ok(examples.includes("id: 'fluorescent-tube'"), 'Load Example chooser must expose the fluorescent-tube sample');
assert.ok(examples.includes("fluorescent: '../assets/examples/icons/fluorescent-tube-white-256.png'"), 'Fluorescent chooser card must use its dedicated white tube icon');
assert.ok(examples.includes("recommendedPreset: 'smart-fluorescent'"), 'Fluorescent chooser sample must select the Fluorescent LAB preset');
assert.deepEqual([...fluorescentSpectrum.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'Fluorescent spectrum example must be a real PNG');
assert.equal(fluorescentSpectrum.readUInt32BE(16), 1280, 'Fluorescent spectrum example must be 1280 px wide');
assert.equal(fluorescentSpectrum.readUInt32BE(20), 720, 'Fluorescent spectrum example must be 720 px high');
assert.deepEqual([...fluorescentIcon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'Fluorescent chooser icon must be a real PNG');
assert.equal(fluorescentIcon.readUInt32BE(16), 256, 'Fluorescent chooser icon must preserve its width');
assert.equal(fluorescentIcon.readUInt32BE(20), 144, 'Fluorescent chooser icon must preserve its height');
assert.equal(fluorescentIcon[25], 6, 'Fluorescent chooser icon must preserve RGBA transparency');
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
assert.ok(spectrapro.includes('graphScript.js?v=3.1.5'), 'published graph code must use a fresh cache key');
assert.ok(spectrapro.includes('stateStore.js?v=3.1.5'), 'dynamic ASTRO label UI loader must use a fresh cache key');
assert.ok(spectrapro.includes('uiPanels.js?v=3.1.5'), 'version badge UI must use a release cache key');
assert.ok(spectrapro.includes('styles.css?v=3.1.5'), 'published Solar preview CSS must use a fresh cache key');
assert.ok(spectrapro.includes('overlays.js?v=3.1.5'), 'published ASTRO overlay must use a fresh cache key');
assert.ok(spectrapro.includes('proBootstrap.js?v=3.1.5'), 'published ASTRO controls must use a fresh cache key');
const renderStatusStart = bootstrap.indexOf('function renderStatus()');
const renderStatusEnd = bootstrap.indexOf('function syncDarkRefAvailability', renderStatusStart);
const renderStatusSource = bootstrap.slice(renderStatusStart, renderStatusEnd);
assert.ok(renderStatusSource.includes("const diffractionOverlayInput = $('spToggleDiffractionOverlay');"), 'STATUS rendering must declare the diffraction overlay control in its own scope');
assert.ok(bootstrap.includes('Initial UI render failed; analysis listeners will still be registered.'), 'a UI render failure must not abort LAB/ASTRO listener registration');
assert.ok(spectrapro.includes('proBootstrap.js?v=3.1.5'), 'published bootstrap must use a cache key that includes the LAB init fix');
assert.ok(spectrapro.includes('mod-panels.css?v=3.1.5'), 'published ASTRO control styles must use a fresh cache key');
assert.ok(!fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/aiAnalysisUi.js'), 'utf8').includes('sp-ai-launch__badge'), 'AI Interpretation must not show a NEW badge');
assert.ok(graphScript.includes('&& !numericFrame'), 'static numeric spectra must stop the live camera animation loop');
assert.ok(imageLoading.includes('resetBundledExampleStateForCamera()'), 'loading an external image must leave bundled-example calibration and preview state');
assert.ok(imageLoading.includes('runtime.setVideoElement(imageElement)'), 'external images must switch source through the runtime bridge so numeric frames are cleared');
assert.ok(imageLoading.includes('runtime.refreshActiveSourceMetrics()'), 'external image dimensions must refresh after decode');
assert.ok(imageLoading.includes("if (typeof syncCanvasToVideo === 'function') syncCanvasToVideo();"), 'external images must resync the source overlay geometry');
assert.ok(!imageLoading.includes("videoElement = document.getElementById('cameraImage')"), 'external images must not bypass the runtime source transition with the legacy direct assignment');
assert.ok(spectrapro.includes('imageLoadingScript.js?v=3.1.5'), 'published external-image loader must use a fresh cache key');
const primaryRow = spectrapro.indexOf('id="cameraPrimaryControlRow"');
const secondaryRow = spectrapro.indexOf('id="cameraSecondaryControlRow"');
assert.ok(primaryRow >= 0 && secondaryRow > primaryRow, 'camera controls must use explicit primary and secondary rows');
for (const id of ['liveVideoButton', 'pauseVideoButton', 'autoPauseButton']) {
  const position = spectrapro.indexOf('id="' + id + '"');
  assert.ok(position > primaryRow && position < secondaryRow, id + ' must remain on the top camera-control row');
}
for (const id of ['loadMultipleImagesButton', 'spLoadExampleBtn']) {
  assert.ok(spectrapro.indexOf('id="' + id + '"', secondaryRow) > secondaryRow, id + ' must remain on the lower source row');
}
assert.ok(spectrapro.indexOf('onclick="loadImageIntoCamera()"', secondaryRow) > secondaryRow, 'Load Image must remain on the lower source row');
assert.ok(spectrapro.indexOf('id="liveVideoButton"') < spectrapro.indexOf('id="pauseVideoButton"'), 'Live must appear before Pause');
assert.ok(spectrapro.indexOf('id="pauseVideoButton"') < spectrapro.indexOf('id="autoPauseButton"'), 'Pause must appear before Auto Pause');
assert.ok(cameraScript.includes('async function goLiveCamera(options = {})'), 'Live must explicitly restore the selected camera');
assert.ok(cameraScript.includes("sp.coreHooks.on('graphFrame', handleAutoPauseFrame)"), 'Auto Pause must monitor the real graph-frame stream');
assert.ok(cameraScript.includes('AUTO_PAUSE_TARGET_INTENSITY = 240'), 'Auto Pause target must default to 240');
assert.ok(cameraScript.includes('AUTO_PAUSE_TRIGGER_INTENSITY = 238'), 'Auto Pause must trigger when the live spectrum reaches the near-clipping threshold');
assert.ok(!cameraScript.includes('AUTO_PAUSE_MAX_INTENSITY'), 'Auto Pause must not ignore frames that overshoot the target');
assert.ok(cameraScript.includes('if (peak >= AUTO_PAUSE_TRIGGER_INTENSITY)'), 'Auto Pause must treat every threshold crossing, including saturation, as a capture condition');
assert.ok(cameraScript.includes("pauseVideo({ autoPause: true })"), 'Auto Pause must freeze through the normal Pause path');
assert.ok(spectrapro.includes('cameraScript.js?v=3.1.5'), 'published camera controller must use the Auto Pause cache key');
assert.ok(spectrapro.includes('imageLoadingScript.js?v=3.1.5'), 'published image loader must use the stable source-control cache key');
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
assert.ok(spectrapro.includes('calibrationScript.js?v=3.1.5'), 'canonical calibration engine must be cache-versioned');
assert.ok(spectrapro.includes('calibrationPointManager.js?v=3.1.5'), 'CALIBRATE point manager must be cache-versioned');
assert.ok(spectrapro.includes('stateStore.js?v=3.1.5'), 'published state store must use the 3.1.5 cache key');
assert.ok(spectrapro.includes('proBootstrap.js?v=3.1.5'), 'published PRO synchronization must use the 3.1.5 cache key');
assert.ok(!graphScript.includes("resizeCanvasToDisplaySize(graphCtx, graphCanvas, 'Normal');\n      if (typeof window.drawGraph === 'function') window.drawGraph();"), 'numeric spectrum loading must not redraw and emit the same frame twice');
for (const label of ['Advanced analysis settings', 'Advanced ASTRO details', 'Advanced: reference spectrum comparison', 'Continuum diagnostics']) {
  assert.ok(i18n.includes("'" + label + "':"), label + ' must remain translatable in EN/SV UI');
}
assert.ok(workerClient.includes('clearNarrowLineHits'), 'Fluorescent worker results must preserve clear coherent narrow-line hits');
assert.ok(workerClient.includes('weaker raw coincidences but never hides the clear fingerprint-supported hits'), 'Fluorescent clear line hits must remain visible independently of the optional raw overlay');
assert.ok(fluorescenceUi.includes('Click a peak to inspect it.'), 'Fluorescent result UI must explain that clear graph peaks are clickable');
assert.ok(overlays.includes("String(state.analysis && state.analysis.presetId || '') === 'smart-fluorescent'"), 'Fluorescent clear labels must bypass a stale hidden Show hits setting');
assert.ok(graphScript.includes('function getPeakInspectorMatch(peak)') && graphScript.includes('state.analysis.rawTopHits'), 'Peak inspector must resolve graph peaks against the active line-hit overlay');

console.log('UI consolidation regression: primary workflows, Advanced groups and responsive hierarchy passed.');
