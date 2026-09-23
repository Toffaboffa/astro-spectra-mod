import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'docs/frontend/scripts/mod/overlays.js'), 'utf8');

function renderWith(settings) {
  const labels = [];
  const intensity = Array.from({ length: 100 }, () => 100);
  intensity[10] = 55;
  intensity[12] = 35;
  intensity[60] = 65;
  const state = {
    frame: { latest: { I: intensity } },
    analysis: {
      enabled: true,
      astroLabels: settings,
      astro: {
        referenceMatches: [
          { label: 'Hα', species: 'H I', observedNm: 10, referenceNm: 10.1, peakIndex: 10, depth: 0.20, score: 0.7 },
          { label: 'Hβ', species: 'H I', observedNm: 12, referenceNm: 12.1, peakIndex: 12, depth: 0.30, score: 0.8 },
          { label: 'Ca II K', species: 'Ca II', observedNm: 60, referenceNm: 60.1, peakIndex: 60, depth: 0.15, score: 0.6 }
        ]
      }
    }
  };
  const ctx = {
    canvas: { width: 240, height: 140 },
    save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, fill() {},
    setLineDash() {}, quadraticCurveTo() {}, strokeText() {},
    measureText(text) { return { width: String(text).length * 6 }; },
    fillText(text) { labels.push(String(text)); },
    globalAlpha: 1, font: '', textBaseline: '', fillStyle: '', strokeStyle: '', lineWidth: 1
  };
  const window = {
    SpectraPro: {
      store: { getState: () => state },
      appMode: { getMode: () => 'ASTRO' },
      utils: { formatChemicalLabel: (value) => String(value) }
    },
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    getPxByWaveLengthBisection: (nm) => nm,
    calculateXPosition: (index) => 30 + index * 2,
    getGraphPlotBounds: () => ({ left: 30, right: 230, top: 20, bottom: 120 })
  };
  window.window = window;
  vm.runInNewContext(source, { window }, { filename: 'overlays.js' });
  const result = window.SpectraPro.overlays.drawOnGraph(ctx, {
    zoomStart: 0,
    zoomEnd: 100,
    padding: 30,
    cssWidth: 240
  });
  return { labels, result };
}

const filtered = renderWith({ enabled: true, minDepth: 0.18, minSpacingPx: 48 });
assert.equal(filtered.result.labels, 1, 'depth and spacing filters should keep one strong nearby match');
assert.deepEqual(filtered.labels, ['Hβ · H I'], 'the strongest nearby dip should win and identify its spectral species');

const separated = renderWith({ enabled: true, minDepth: 0.10, minSpacingPx: 48 });
assert.equal(separated.result.labels, 2, 'a sufficiently separated identified dip should receive a label');
assert.deepEqual(separated.labels, ['Hβ · H I', 'Ca II K'], 'labels should remain ordered by graph position after filtering');

const hidden = renderWith({ enabled: false, minDepth: 0.01, minSpacingPx: 8 });
assert.equal(hidden.result.labels, 0, 'disabled ASTRO labels should not draw');
assert.equal(hidden.result.hidden, true, 'disabled ASTRO labels should report hidden state');

console.log('ASTRO overlay regression: depth threshold, label spacing, species labels and visibility passed.');
