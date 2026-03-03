(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.dataQualityPanel || (v15.dataQualityPanel = {});


  function evalPoly(coeffs, x) {
    if (!Array.isArray(coeffs) || !coeffs.length) return null;
    let y = 0;
    for (let i = 0; i < coeffs.length; i += 1) y += (Number(coeffs[i]) || 0) * Math.pow(x, i);
    return Number.isFinite(y) ? y : null;
  }

  function estimateResolutionNmPerPx(state, latest) {
    const st = state || {};
    const cal = st.calibration || {};
    const coeffs = Array.isArray(cal.coefficients) ? cal.coefficients : [];
    const calibrated = !!(cal.isCalibrated || cal.calibrated || coeffs.length);
    if (!calibrated) return null;

    const signalArr = getSignalArray(latest) || getSignalArray((st.frame && st.frame.latest) || null);
    const pxArr = (latest && Array.isArray(latest.px)) ? latest.px : (((st.frame || {}).latest && Array.isArray(st.frame.latest.px)) ? st.frame.latest.px : null);
    const pixelWidth = Number(
      (latest && latest.pixelWidth) ||
      (signalArr && signalArr.length) ||
      (pxArr && pxArr.length) ||
      (st.frame && st.frame.pixelWidth) ||
      (st.camera && st.camera.values && st.camera.values.width) || 0
    );

    if (coeffs.length >= 1 && Number.isFinite(pixelWidth) && pixelWidth >= 2) {
      const nm0 = evalPoly(coeffs, 0);
      const nm1 = evalPoly(coeffs, pixelWidth - 1);
      if (Number.isFinite(nm0) && Number.isFinite(nm1)) {
        const res = Math.abs((nm1 - nm0) / Math.max(1, pixelWidth - 1));
        if (Number.isFinite(res) && res > 0) return res;
      }
    }

    const pts = Array.isArray(cal.points) ? cal.points.filter(function (p) {
      return p && Number.isFinite(Number(p.px)) && Number.isFinite(Number(p.nm));
    }) : [];
    if (pts.length >= 2) {
      let total = 0;
      let count = 0;
      for (let i = 1; i < pts.length; i += 1) {
        const dpx = Math.abs(Number(pts[i].px) - Number(pts[i - 1].px));
        const dnm = Math.abs(Number(pts[i].nm) - Number(pts[i - 1].nm));
        if (dpx > 0 && Number.isFinite(dnm)) {
          total += (dnm / dpx);
          count += 1;
        }
      }
      if (count > 0) {
        const res = total / count;
        if (Number.isFinite(res) && res > 0) return res;
      }
    }

    return null;
  }

  function getSignalArray(frame) {
    if (!frame || typeof frame !== 'object') return null;
    return Array.isArray(frame.I) ? frame.I
      : Array.isArray(frame.combined) ? frame.combined
      : Array.isArray(frame.intensity) ? frame.intensity
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
      let mn = Infinity, mx = -Infinity, sum = 0, sat = 0, validCount = 0;
      for (let i = 0; i < arr.length; i += 1) {
        const v = Number(arr[i]);
        if (!Number.isFinite(v)) continue;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
        sum += v;
        validCount += 1;
        if (v >= 254) sat += 1;
      }
      if (mn !== Infinity && mx !== -Infinity) {
        min = mn.toFixed(1);
        max = mx.toFixed(1);
        avg = (sum / Math.max(1, validCount)).toFixed(1);
        const dynamicRange = (mx - mn);
        dyn = dynamicRange.toFixed(1);
        // Support both raw 0..255 and normalized 0..1 arrays.
        if (mx <= 1.01) {
          sat = 0;
          for (let i = 0; i < arr.length; i += 1) {
            const vv = Number(arr[i]);
            if (Number.isFinite(vv) && vv >= 0.995) sat += 1;
          }
        } else if (sat === 0 && mx >= 250) {
          // Near-clipping fallback: count high values so DQ is useful even when source rarely hits 254+.
          sat = 0;
          for (let i = 0; i < arr.length; i += 1) {
            const vv = Number(arr[i]);
            if (Number.isFinite(vv) && vv >= 250) sat += 1;
          }
        }
        const pctBase = Math.max(1, validCount);
        const pct = ((sat / pctBase) * 100).toFixed(1);
        satText = `${sat}/${validCount} (${pct}%)`;
        const noiseFloor = Math.max(1, mn);
        snrText = (dynamicRange / noiseFloor).toFixed(2);
      }
    }

    const registryModules = (((window.SpectraPro || {}).v15 || {}).registry || {}).modules || {};
    const loadedV15 = Object.values(registryModules).filter(Boolean).length;
    const camera = st.camera || {};
    const camSummary = camera.summary || {};
    const camRes = camSummary.resolution || ((camera.values && camera.values.width && camera.values.height) ? `${camera.values.width}x${camera.values.height}` : '—');
    const camStatus = camera.status || 'unknown';
    const camExposure = (camera.supported && camera.supported.exposureTime) ? 'exp✓' : 'exp—';
    const camZoom = (camera.supported && camera.supported.zoom) ? 'zoom✓' : 'zoom—';

    const status = [
      `Mode: ${st.appMode || 'CORE'}`,
      `Worker: ${(st.worker && st.worker.status) || 'idle'}${(st.worker && st.worker.analysisHz) ? ` · ${st.worker.analysisHz} Hz` : ''}`,
      `Frame source: ${(latest && latest.source) || (st.frame && st.frame.source) || 'none'}${(latest && latest.pixelWidth) ? ` · ${latest.pixelWidth} px` : ''}`,
      `Calibration: ${(st.calibration && st.calibration.isCalibrated) ? 'calibrated' : 'uncalibrated'} · pts ${(st.calibration && (st.calibration.points || []).length) || (st.calibration && st.calibration.pointCount) || 0} · shell ${(st.calibration && st.calibration.shellPointCount) || 0}`,
      `Reference: ${(st.reference && st.reference.hasReference) ? 'yes' : 'no'} · count ${(st.reference && st.reference.count) || 0}`,
      `Camera: ${camStatus} · ${camRes} · ${camExposure} ${camZoom}`,
      `v1.5 modules: ${loadedV15}/8 loaded`
    ];

    const resolutionNmPerPx = estimateResolutionNmPerPx(st, latest);

    const dq = [
      `Signal: ${min} - ${max}`,
      `Avg: ${avg} · Dyn: ${dyn}`,
      `Saturation: ${satText}`,
      `SNR-ish: ${snrText} · Hits/QC: ${((st.analysis && st.analysis.topHits) || []).length}/${((st.analysis && st.analysis.qcFlags) || []).length}`
    ];
    if (Number.isFinite(resolutionNmPerPx)) dq.push(`Resolution: ${resolutionNmPerPx.toFixed(2)} nm/px`);

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
