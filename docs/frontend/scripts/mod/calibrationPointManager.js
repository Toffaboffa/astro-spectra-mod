(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.calibrationPointManager || (v15.calibrationPointManager = {});
  function normPoint(p) {
    if (!p || typeof p !== 'object') return null;
    const px = Number(p.px != null ? p.px : p.pixel);
    const nm = Number(p.nm != null ? p.nm : p.wavelength);
    if (!Number.isFinite(px) || !Number.isFinite(nm)) return null;
    const out = { px, nm };
    if (p.label != null && String(p.label).trim()) out.label = String(p.label).trim();
    return out;
  }
  mod.create = function createCalibrationPointManager() {
    return {
      points: [],
      placeholder: false,
      setPoints: function setPoints(next) { this.points = Array.isArray(next) ? next.map(normPoint).filter(Boolean) : []; return this.getPoints(); },
      getPoints: function getPoints() { return Array.isArray(this.points) ? this.points.map(function (p) { return Object.assign({}, p); }) : []; },
      addPoint: function addPoint(p) { const n = normPoint(p); if (!n) return this.getPoints(); this.points.push(n); return this.getPoints(); },
      clear: function clear() { this.points = []; return []; },
      count: function count() { return Array.isArray(this.points) ? this.points.length : 0; }
    };
  };
  mod.version = 'step4-calibration-point-manager-shell';
})();
