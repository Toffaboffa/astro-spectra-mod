/*
  CORE DOM sanity check (static)
  - Reads docs/frontend/pages/recording.html
  - Verifies that all critical element IDs expected by CORE scripts exist in the HTML.

  Run:
    node tests/core_dom_check.js

  Note:
  - Some elements are moved at runtime (General hosts original controls), but the IDs
    still must exist in the base HTML.
*/

const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(repoRoot, 'docs', 'frontend', 'pages', 'recording.html');

const html = fs.readFileSync(htmlPath, 'utf8');

// Keep this list aligned with graphScript.js + setupScript.js critical selectors.
const REQUIRED_IDS = [
  // graphScript.js
  'colorGraph',
  'gradientOpacitySlider',
  'gradientOpacitySliderContainer',
  'gradientOpacityValue',
  'graphCanvas',
  'graphWindowContainer',
  'mouseCoordinates',
  'peakSizeLower',
  'referenceGraphCheckbox',
  'referenceGraphControl',
  'resetZoomButton',
  'stepBackButton',
  'stepLeftButton',
  'stepRightButton',
  'toggleB',
  'toggleCombined',
  'toggleG',
  'togglePeaksCheckbox',
  'toggleR',
  'toggleXLabelsNm',
  'toggleXLabelsPx',
  'zoomScroller',

  // PRO docking targets
  'graphSettingsDrawer',
  'graphSettingsDrawerLeft',
  'graphSettingsDrawerRight',

  // setupScript.js popup targets
  'infoPopup',
  'infoPopupMessage',
  'infoPopupButtonContainer',
  'infoPopupBlock',
];

function hasId(id) {
  // naive but reliable enough for static HTML: id="..." or id='...'
  const re = new RegExp(`\\bid\\s*=\\s*(["'])${id}\\1`, 'm');
  return re.test(html);
}

const missing = [];
for (const id of REQUIRED_IDS) {
  if (!hasId(id)) missing.push(id);
}

if (missing.length) {
  console.error('CORE DOM CHECK: FAIL');
  console.error('Missing IDs in recording.html:');
  for (const id of missing) console.error(' -', id);
  process.exitCode = 1;
} else {
  console.log('CORE DOM CHECK: OK');
  console.log(`All ${REQUIRED_IDS.length} required IDs found in recording.html`);
}
