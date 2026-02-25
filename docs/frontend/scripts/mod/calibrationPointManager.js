(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.calibrationPointManager || (v15.calibrationPointManager = {});

  mod.create = function createCalibrationPointManager() {
    return {
      points: [],
      placeholder: true,
      setPoints: function setPoints(next) { this.points = Array.isArray(next) ? next.slice() : []; return this.points; },
      getPoints: function getPoints() { return Array.isArray(this.points) ? this.points.slice() : []; }
    };
  };
  mod.version = 'step3-scaffold';
})();
