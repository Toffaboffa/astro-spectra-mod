(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.calibrationPointManager || (v15.calibrationPointManager = {});

  // Shell-side calibration point manager.
  // Adds: enabled/disabled points + simple undo stack.
  function normPoint(p) {
    if (!p || typeof p !== 'object') return null;
    const px = Number(p.px != null ? p.px : p.pixel);
    const nm = Number(p.nm != null ? p.nm : p.wavelength);
    if (!Number.isFinite(px) || !Number.isFinite(nm)) return null;
    const out = { px, nm };
    if (p.label != null && String(p.label).trim()) out.label = String(p.label).trim();
    // Default enabled unless explicitly false.
    out.enabled = (p.enabled === false) ? false : true;
    return out;
  }

  function clonePoints(arr) {
    return (Array.isArray(arr) ? arr : []).map(function (p) { return Object.assign({}, p); });
  }

  function clampHistory(history, max) {
    const m = Math.max(1, Number(max) || 10);
    while (history.length > m) history.shift();
  }
  mod.create = function createCalibrationPointManager() {
    return {
      points: [],
      history: [],
      maxHistory: 10,
      placeholder: false,
      snapshot: function snapshot() {
        this.history.push(clonePoints(this.points));
        clampHistory(this.history, this.maxHistory);
      },
      undo: function undo() {
        const prev = this.history.length ? this.history.pop() : null;
        if (prev) this.points = clonePoints(prev);
        return this.getPoints();
      },
      setPoints: function setPoints(next) {
        this.snapshot();
        this.points = Array.isArray(next) ? next.map(normPoint).filter(Boolean) : [];
        return this.getPoints();
      },
      getPoints: function getPoints() {
        return clonePoints(this.points);
      },
      getEnabledPoints: function getEnabledPoints() {
        return clonePoints(this.points).filter(function (p) { return p && p.enabled !== false; });
      },
      setEnabled: function setEnabled(index, enabled) {
        if (!Array.isArray(this.points)) this.points = [];
        const i = Number(index);
        if (!Number.isFinite(i) || i < 0 || i >= this.points.length) return this.getPoints();
        this.snapshot();
        this.points[i].enabled = !!enabled;
        return this.getPoints();
      },
      removeAt: function removeAt(index) {
        if (!Array.isArray(this.points)) this.points = [];
        const i = Number(index);
        if (!Number.isFinite(i) || i < 0 || i >= this.points.length) return this.getPoints();
        this.snapshot();
        this.points.splice(i, 1);
        return this.getPoints();
      },
      addPoint: function addPoint(p) {
        const n = normPoint(p);
        if (!n) return this.getPoints();
        this.snapshot();
        this.points.push(n);
        return this.getPoints();
      },
      clear: function clear() {
        this.snapshot();
        this.points = [];
        return [];
      },
      count: function count() {
        return Array.isArray(this.points) ? this.points.length : 0;
      },
      enabledCount: function enabledCount() {
        return this.getEnabledPoints().length;
      }
    };
  };
  mod.version = 'step4-calibration-point-manager-shell+disable+undo';
})();
