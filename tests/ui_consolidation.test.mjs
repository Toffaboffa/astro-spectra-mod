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
const i18n = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/i18nUi.js'), 'utf8');

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
assert.ok(mainStyles.includes('pointer-events:none'), 'the numeric source placeholder must not block source controls');
assert.ok(examples.includes("sourceWindow.classList.add('sp-numeric-source')"), 'numeric examples must activate the reserved source view');
assert.ok(examples.includes("sourceWindow.classList.remove('sp-numeric-source')"), 'image examples must restore the normal source view');
assert.ok(examples.includes('sp.framePreview.clearSourceImage()'), 'numeric examples must forget a previously loaded source image');
assert.ok(framePreview.includes('api.clearSourceImage = function()'), 'frame preview must expose a safe source-image reset');
assert.ok(mainStyles.includes('#videoMainWindow.sp-numeric-source #cameraImage'), 'numeric examples must forcibly hide stale source images');
for (const label of ['Advanced analysis settings', 'Advanced ASTRO details', 'Advanced: reference spectrum comparison', 'Continuum diagnostics']) {
  assert.ok(i18n.includes("'" + label + "':"), label + ' must remain translatable in EN/SV UI');
}

console.log('UI consolidation regression: primary workflows, Advanced groups and responsive hierarchy passed.');
