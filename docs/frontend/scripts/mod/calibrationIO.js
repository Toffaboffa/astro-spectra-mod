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
    if (obj.enabled === false) out.enabled = false;
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
      // Optional 4th column: enabled (0/1/true/false)
      if (parts[3]) {
        const e = String(parts[3]).toLowerCase();
        if (e === '0' || e === 'false' || e === 'no' || e === 'off') p.enabled = false;
      }
      points.push(p);
    });
    return points;
  };
  mod.serializeCalibrationPoints = function serializeCalibrationPoints(points, opts) {
    const arr = Array.isArray(points) ? points.map(normalizePoint).filter(Boolean) : [];
    const format = String((opts && opts.format) || 'json').toLowerCase();
    if (format === 'csv') {
      const lines = ['px,nm,label,enabled'];
      arr.forEach(function (p) { lines.push([p.px, p.nm, p.label || '', (p.enabled === false ? 0 : 1)].join(',')); });
      return lines.join('\n');
    }
    return JSON.stringify({ points: arr, count: arr.length, exportedAt: Date.now() }, null, 2);
  };

  mod.normalizeAndValidatePoints = function normalizeAndValidatePoints(points, opts) {
    const options = Object.assign({ minPoints: 2, maxPoints: 15, sortBy: 'px', dedupe: true }, opts || {});
    const inputArr = Array.isArray(points) ? points : [];
    const rawCount = inputArr.length;
    const arr = inputArr.map(normalizePoint).filter(Boolean);
    const invalidDropped = Math.max(0, rawCount - arr.length);
    const seenExact = new Set();
    const seenPx = new Set();
    const seenNm = new Set();
    let duplicateExact = 0;
    let duplicatePxOnly = 0;
    let duplicateNmOnly = 0;
    const out = [];
    for (let i = 0; i < arr.length; i += 1) {
      const p = arr[i];
      const keyExact = String(p.px) + '|' + String(p.nm);
      const keyPx = String(p.px);
      const keyNm = String(p.nm);
      if (seenPx.has(keyPx)) duplicatePxOnly += 1;
      if (seenNm.has(keyNm)) duplicateNmOnly += 1;
      if (options.dedupe && seenExact.has(keyExact)) {
        duplicateExact += 1;
        continue;
      }
      seenExact.add(keyExact);
      seenPx.add(keyPx);
      seenNm.add(keyNm);
      out.push(p);
    }
    let sorted = false;
    if (String(options.sortBy || '').toLowerCase() === 'px') {
      const before = JSON.stringify(out.map(function (p) { return [p.px, p.nm]; }));
      out.sort(function (a, b) { return (a.px - b.px) || (a.nm - b.nm); });
      sorted = before !== JSON.stringify(out.map(function (p) { return [p.px, p.nm]; }));
    }
    const maxPoints = Math.max(1, Number(options.maxPoints) || 15);
    const limited = out.slice(0, maxPoints);
    const minPoints = Math.max(2, Number(options.minPoints) || 2);
    const valid = limited.length >= minPoints;
    const truncated = out.length > limited.length;
    const warnings = [];
    if (invalidDropped) warnings.push(invalidDropped + ' invalid row(s) dropped');
    if (duplicateExact) warnings.push(duplicateExact + ' exact duplicate(s) removed');
    if (duplicatePxOnly > duplicateExact) warnings.push((duplicatePxOnly - duplicateExact) + ' duplicate px value(s) remain');
    if (duplicateNmOnly > duplicateExact) warnings.push((duplicateNmOnly - duplicateExact) + ' duplicate nm value(s) remain');
    if (sorted) warnings.push('points sorted by px');
    if (truncated) warnings.push('trimmed to max ' + maxPoints + ' points');
    const message = valid
      ? ('OK (' + limited.length + ' point(s))')
      : ('Need at least ' + minPoints + ' valid point(s), got ' + limited.length);
    return {
      ok: valid,
      points: limited,
      count: limited.length,
      truncated: truncated,
      message: message,
      warnings: warnings,
      stats: {
        rawCount: rawCount,
        validCount: arr.length,
        invalidDropped: invalidDropped,
        duplicateExactRemoved: duplicateExact,
        duplicatePxSeen: duplicatePxOnly,
        duplicateNmSeen: duplicateNmOnly,
        sortedByPx: sorted,
        trimmedToMax: truncated
      }
    };
  };

  mod.version = 'step6-calibration-io-apply-ready';
})();
