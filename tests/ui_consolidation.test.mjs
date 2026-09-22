import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bootstrap = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/proBootstrap.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'docs/frontend/styles/mod-panels.css'), 'utf8');
const mainStyles = fs.readFileSync(path.join(root, 'docs/frontend/styles/styles.css'), 'utf8');
const examples = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/exampleSpectrumUi.js'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/i18nUi.js'), 'utf8');

function markupCount(id) {
  return (bootstrap.match(new RegExp('id=["\\\']' + id + '["\\\']', 'g')) || []).length;
}

const labPrimary = bootstrap.indexOf('class="sp-lab-primary"');
const labAdvanced = bootstrap.indexOf('id="spLabAdvanced"');
const labResults = bootstrap.indexOf('id="spLabHits"');
assert.ok(labPrimary >= 0 && labAdvanced > labPrimary && labResults > labAdvanced, 'LAB must expose primary controls before collapsed expert controls and results');
for (const id of ['spLabEnabled', 'spLabPreset', 'spLabSubMode']) {
  const position = bootstrap.indexOf('id="' + id + '"', labPrimary);
  assert.ok(position > labPrimary && position < labAdvanced, id + ' must remain a primary LAB control');
}
for (const id of ['spLabMaxHz', 'spLabShowHits', 'spLabWeak', 'spLabStable', 'spLabSmart', 'spLabAutoTune', 'spLabRgb', 'spLabStrongPeak', 'spLabPeakThr', 'spLabPeakDist', 'spLabMaxDist', 'spLabInitLibBtn', 'spLabPingBtn', 'spLabQueryBtn']) {
  assert.ok(bootstrap.indexOf('id="' + id + '"', labAdvanced) > labAdvanced, id + ' must remain available under LAB Advanced');
  assert.equal(markupCount(id), 1, id + ' markup must remain unique');
}
assert.ok(bootstrap.indexOf('class="sp-actions sp-actions--lab"') < labAdvanced, 'AI/interpretation actions must not be buried under LAB Advanced');

const astroCard = bootstrap.indexOf("card.id = 'spAstroCard'");
const astroAdvanced = bootstrap.indexOf('id="spAstroAdvanced"', astroCard);
for (const id of ['spAstroEnabled', 'spAstroContinuum', 'spAstroQuality', 'spAstroVelocity', 'spAstroClassification', 'spAstroFeatures', 'spAstroMatches']) {
  const position = bootstrap.indexOf('id="' + id + '"', astroCard);
  assert.ok(position > astroCard && position < astroAdvanced, id + ' must remain in the focused ASTRO view');
}
assert.ok(bootstrap.indexOf('id="spAstroContinuumAdvanced"', astroAdvanced) > astroAdvanced, 'continuum diagnostics must use ASTRO Advanced');
assert.ok(bootstrap.includes("el('details', 'sp-card sp-card--flat sp-advanced sp-reference-comparison')"), 'reference comparison controls must use collapsed progressive disclosure');
assert.ok(bootstrap.includes('class="sp-astro-summary-grid"'), 'ASTRO summaries must use the compact desktop grid');
assert.ok(bootstrap.includes('class="sp-card-sub sp-hw-response"'), 'instrument response must use the compact hardware section');

assert.ok(styles.includes('#spPanel-astro .sp-analysis-layout'), 'LAB/ASTRO must share responsive analysis layout rules');
assert.ok(styles.includes('#spPanel-astro .sp-subtitle'), 'ASTRO subtitles must use dock typography instead of browser heading defaults');
assert.ok(styles.includes('#spPanel-astro .sp-lab-head{display:none !important;}'), 'ASTRO must not add a heading that LAB omits');
assert.ok(styles.includes('min-height:125px'), 'analysis tables must be allowed to shrink inside the fixed desktop dock');
assert.ok(styles.includes('#SpectraProDockHost .sp-advanced > summary:focus-visible'), 'Advanced summaries must retain keyboard focus visibility');
assert.ok(styles.includes('@media (max-width: 900px)'), 'normal-width layout must have a compact responsive fallback');
assert.ok(mainStyles.includes('#videoMainWindow.sp-numeric-source'), 'numeric examples must reserve the normal source-view height');
assert.ok(mainStyles.includes('pointer-events:none'), 'the numeric source placeholder must not block source controls');
assert.ok(examples.includes("sourceWindow.classList.add('sp-numeric-source')"), 'numeric examples must activate the reserved source view');
assert.ok(examples.includes("sourceWindow.classList.remove('sp-numeric-source')"), 'image examples must restore the normal source view');
for (const label of ['Advanced analysis settings', 'Advanced ASTRO details', 'Advanced: reference spectrum comparison', 'Continuum diagnostics']) {
  assert.ok(i18n.includes("'" + label + "':"), label + ' must remain translatable in EN/SV UI');
}

console.log('UI consolidation regression: primary workflows, Advanced groups and responsive hierarchy passed.');
