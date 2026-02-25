(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.calibrationIO || (v15.calibrationIO = {});

  function toNum(v) {
    const n = Number(String(v).trim());
    return Number.isFinite(n) ? n : null;
  }
  function normalizePoint(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const px = toNum(obj.px != null ? obj.px : (obj.pixel != null ? obj.pixel : obj.x));
    const nm = toNum(obj.nm != null ? obj.nm : (obj.wavelength != null ? obj.wavelength : obj.y));
    if (px == null || nm == null) return null;
    const out = { px, nm };
    if (obj.label != null && String(obj.label).trim()) out.label = String(obj.label).trim();
    return out;
  }
  mod.parseCalibrationFile = function parseCalibrationFile(text, opts) {
    const raw = String(text || '').trim();
    if (!raw) return [];
    const options = opts || {};
    const points = [];
    if (!options.formatHint || options.formatHint === 'json') {
      try {
        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.points) ? parsed.points : null);
        if (arr) {
          arr.forEach(function (p) { const n = normalizePoint(p); if (n) points.push(n); });
          return points;
        }
      } catch (_) {}
    }
    raw.split(/\r?\n/).forEach(function (line) {
      const s = String(line || '').trim();
      if (!s || s.startsWith('#')) return;
      const parts = s.split(/[;,\t]/).map(function (x) { return String(x).trim(); });
      if (parts.length < 2) return;
      if (/^px$/i.test(parts[0]) || /^pixel$/i.test(parts[0])) return;
      const px = toNum(parts[0]);
      const nm = toNum(parts[1]);
      if (px == null || nm == null) return;
      const p = { px, nm };
      if (parts[2]) p.label = parts[2];
      points.push(p);
    });
    return points;
  };
  mod.serializeCalibrationPoints = function serializeCalibrationPoints(points, opts) {
    const arr = Array.isArray(points) ? points.map(normalizePoint).filter(Boolean) : [];
    const format = String((opts && opts.format) || 'json').toLowerCase();
    if (format === 'csv') {
      const lines = ['px,nm,label'];
      arr.forEach(function (p) { lines.push([p.px, p.nm, p.label || ''].join(',')); });
      return lines.join('\n');
    }
    return JSON.stringify({ points: arr, count: arr.length, exportedAt: Date.now() }, null, 2);
  };
  mod.version = 'step4-calibration-io-shell';
})();
