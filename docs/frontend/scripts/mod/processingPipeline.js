
(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};

  function normalize01(arr) {
    if (!Array.isArray(arr) || !arr.length) return [];
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < arr.length; i += 1) { const v = +arr[i] || 0; if (v < min) min = v; if (v > max) max = v; }
    const range = max - min || 1;
    return arr.map(v => ((+v || 0) - min) / range);
  }

  function run(frame, options) {
    const opts = Object.assign({ subtractionMode: 'raw', quickPeakThreshold: 0.2, quickPeakDistance: 4 }, options || {});
    const Iraw = (frame && frame.I) || [];
    const raw = Array.isArray(Iraw) ? Iraw : [];
    const ref = opts.referenceI || null;
    const dark = opts.darkI || null;
    const processed = sp.subtraction ? sp.subtraction.applyMode(raw, ref, dark, opts.subtractionMode) : raw.slice();
    const normalized = normalize01(processed);
    const peaks = sp.quickPeaks ? sp.quickPeaks.detectQuickPeaks(normalized, { threshold: opts.quickPeakThreshold, distance: opts.quickPeakDistance }) : [];
    return { processedI: processed, normalizedI: normalized, quickPeaks: peaks, meta: { subtractionMode: opts.subtractionMode } };
  }

  sp.processingPipeline = { run };
})(window);
