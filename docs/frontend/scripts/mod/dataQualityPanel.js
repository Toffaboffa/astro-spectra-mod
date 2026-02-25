(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.dataQualityPanel || (v15.dataQualityPanel = {});

  function getSignalArray(frame) {
    if (!frame || typeof frame !== 'object') return null;
    return Array.isArray(frame.combined) ? frame.combined
      : Array.isArray(frame.intensity) ? frame.intensity
      : Array.isArray(frame.I) ? frame.I
      : Array.isArray(frame.values) ? frame.values
      : null;
  }

  function compute(state, opts) {
    const st = state || {};
    const options = opts || {};
    const latest = options.latestFrame || (st.frame && st.frame.latest) || null;
    const arr = getSignalArray(latest);
    let min = '—', max = '—', avg = '—', dyn = '—', satText = '0/0 (0%)', snrText = '—';

    if (arr && arr.length) {
      let mn = Infinity, mx = -Infinity, sum = 0, sat = 0;
      for (let i = 0; i < arr.length; i += 1) {
        const v = Number(arr[i]);
        if (!Number.isFinite(v)) continue;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
        sum += v;
        if (v >= 254) sat += 1;
      }
      if (mn !== Infinity && mx !== -Infinity) {
        min = mn.toFixed(1);
        max = mx.toFixed(1);
        avg = (sum / arr.length).toFixed(1);
        const dynamicRange = (mx - mn);
        dyn = dynamicRange.toFixed(1);
        const pct = arr.length ? ((sat / arr.length) * 100).toFixed(1) : '0.0';
        satText = `${sat}/${arr.length} (${pct}%)`;
        const noiseFloor = Math.max(1, mn);
        snrText = (dynamicRange / noiseFloor).toFixed(2);
      }
    }

    const registryModules = (((window.SpectraPro || {}).v15 || {}).registry || {}).modules || {};
    const loadedV15 = Object.values(registryModules).filter(Boolean).length;

    const status = [
      `Mode: ${st.appMode || 'CORE'}`,
      `Worker: ${(st.worker && st.worker.status) || 'idle'}${(st.worker && st.worker.analysisHz) ? ` · ${st.worker.analysisHz} Hz` : ''}`,
      `Frame source: ${(latest && latest.source) || (st.frame && st.frame.source) || 'none'}${(latest && latest.pixelWidth) ? ` · ${latest.pixelWidth} px` : ''}`,
      `Calibration: ${(st.calibration && st.calibration.isCalibrated) ? 'calibrated' : 'uncalibrated'} · pts ${(st.calibration && (st.calibration.points || []).length) || (st.calibration && st.calibration.pointCount) || 0}`,
      `Reference: ${(st.reference && st.reference.hasReference) ? 'yes' : 'no'} · count ${(st.reference && st.reference.count) || 0}`,
      `v1.5 modules: ${loadedV15}/8 loaded`
    ];

    const dq = [
      `Signal: ${min} - ${max}`,
      `Avg: ${avg} · Dyn: ${dyn}`,
      `Saturation: ${satText}`,
      `SNR-ish: ${snrText} · Hits/QC: ${((st.analysis && st.analysis.topHits) || []).length}/${((st.analysis && st.analysis.qcFlags) || []).length}`
    ];

    return { status, dq, metrics: { min, max, avg, dyn, saturation: satText, snr: snrText } };
  }

  mod.compute = compute;
  mod.init = function initDataQualityPanel(opts) {
    return {
      ok: true,
      active: true,
      placeholder: false,
      options: opts || {},
      compute: function (state, localOpts) { return compute(state, Object.assign({}, opts || {}, localOpts || {})); },
      destroy: function destroy() {}
    };
  };
  mod.version = 'step4-data-quality';
})();
