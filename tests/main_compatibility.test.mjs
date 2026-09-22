import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function loadCompatibilityRuntime() {
  const context = { console, Date, Math, JSON, setTimeout, clearTimeout };
  context.window = context;
  context.self = context;
  context.SpectraPro = {};
  vm.createContext(context);
  [
    'docs/frontend/scripts/mod/presets.js',
    'docs/frontend/workers/presetResolver.js',
    'docs/frontend/scripts/mod/stateStore.js',
    'docs/frontend/scripts/mod/subtraction.js'
  ].forEach((relative) => vm.runInContext(read(relative), context, { filename: relative }));
  return context;
}

const runtime = loadCompatibilityRuntime();
const presetGroups = runtime.SpectraPro.presets.getPresetGroups();
const presetIds = presetGroups.flatMap((group) => group.presets.map((preset) => preset.id));
const mainPresetIds = [
  'nearest', 'wide', 'tight', 'fast', 'lamp-hg',
  'smart-atomic', 'smart-molecular', 'smart-gastube', 'smart-flame', 'smart-fluorescent'
];
mainPresetIds.forEach((id) => assert.ok(presetIds.includes(id), `main preset must remain available: ${id}`));

const lamp = runtime.SPECTRA_PRO_presetResolver.resolve('lamp-hg');
assert.equal(lamp.id, 'lamp-hg');
assert.equal(lamp.type, 'base');
assert.equal(lamp.toleranceNm, 2.8);
assert.equal(lamp.maxMatches, 18);
assert.deepEqual(Array.from(lamp.allowedElements), ['Hg', 'Ar', 'Ne', 'Kr', 'Xe']);
assert.ok(
  read('docs/frontend/workers/candidateAnalysis.js').includes("['smart-gastube', 'smart-atomic', 'smart-molecular', 'lamp-hg']"),
  'Lamp must retain main-compatible Auto tune support'
);

const store = runtime.SpectraPro.createStateStore({ analysis: { presetId: 'lamp-hg' } });
assert.equal(store.getState().analysis.presetId, 'lamp-hg', 'main preset state must not be silently rewritten');
assert.ok(
  runtime.SpectraPro.createStateStore().getState().analysis.presetCatalog.groups
    .flatMap((group) => group.presets)
    .some((preset) => preset.id === 'lamp-hg'),
  'default state catalog must retain the main Lamp preset'
);

const subtraction = runtime.SpectraPro.subtraction;
const raw = [10, 20, 30];
const reference = [5, 10, 15];
const dark = [1, 2, 3];
assert.deepEqual(Array.from(subtraction.applyMode(raw, reference, dark, 'raw')), raw);
assert.deepEqual(Array.from(subtraction.applyMode(raw, reference, dark, 'raw-dark')), [9, 18, 27]);
assert.deepEqual(Array.from(subtraction.applyMode(raw, reference, dark, 'difference')), [5, 10, 15]);
assert.deepEqual(Array.from(subtraction.applyMode(raw, reference, dark, 'ratio')), [2, 2, 2]);
assert.deepEqual(Array.from(subtraction.applyMode(raw, reference, dark, 'transmittance')), [225, 225, 225]);
Array.from(subtraction.applyMode(raw, reference, dark, 'absorbance')).forEach((value) => {
  assert.ok(Math.abs(value + Math.log10(2.25)) < 1e-12, 'absorbance formula must remain compatible');
});
const safeMissingReference = subtraction.process(raw, null, dark, 'ratio');
assert.deepEqual(Array.from(safeMissingReference.values), raw, 'invalid reference input must preserve measured data');
assert.ok(safeMissingReference.warnings.includes('reference-unavailable-or-length-mismatch'));

const recording = read('docs/frontend/pages/recording.html');
[
  '../scripts/setupScript.js', '../scripts/cameraScript.js', '../scripts/stripeScript.js',
  '../scripts/cameraSelection.js', '../scripts/calibrationScript.js', '../scripts/graphScript.js'
].forEach((source) => assert.ok(recording.includes(source), `main runtime script must remain loaded: ${source}`));

const calibrationIo = read('docs/frontend/scripts/mod/calibrationIO.js');
assert.ok(calibrationIo.includes('function isWavelengthAxisSelected()'));
assert.ok(calibrationIo.includes('if (isWavelengthAxisSelected())'), 'calibration must not re-prompt when nm is already selected');

const exportUi = read('docs/frontend/scripts/mod/exportUi.js');
['source', 'csv', 'graph', 'json', 'pdf'].forEach((kind) => {
  assert.ok(exportUi.includes(`data-export-kind="${kind}"`), `main export type must remain available: ${kind}`);
});
assert.ok(exportUi.includes('new global.JSZip()'), 'main ZIP packaging must remain available');

const styles = read('docs/frontend/styles/mod-panels.css');
[
  '#SpectraProDockHost', '.sp-lab-layout', '.sp-lab-fields', '.sp-lab-table',
  '.sp-status-grid', '.sp-subtraction-controls'
].forEach((selector) => assert.ok(styles.includes(selector), `main design selector must remain available: ${selector}`));

console.log('MAIN COMPATIBILITY: legacy presets, processing formulas, runtime paths, calibration guard, exports and design selectors passed.');
