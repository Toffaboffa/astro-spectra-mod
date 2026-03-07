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

  function getSignalArray(frame) {
    if (!frame || typeof frame !== 'object') return null;
    return Array.isArray(frame.I) ? frame.I
      : Array.isArray(frame.combined) ? frame.combined
      : Array.isArray(frame.intensity) ? frame.intensity
      : Array.isArray(frame.values) ? frame.values
      : null;
  }

  function getPixelWidth(state, latest, signalArr) {
    const st = state || {};
    const pxArr = (latest && Array.isArray(latest.px)) ? latest.px : (((st.frame || {}).latest && Array.isArray(st.frame.latest.px)) ? st.frame.latest.px : null);
    return Number(
      (latest && latest.pixelWidth) ||
      (signalArr && signalArr.length) ||
      (pxArr && pxArr.length) ||
      (st.frame && st.frame.pixelWidth) ||
      (st.camera && st.camera.values && st.camera.values.width) || 0
    );
  }

  function estimateResolutionNmPerPx(state, latest) {
    const st = state || {};
    const cal = st.calibration || {};
    const coeffs = Array.isArray(cal.coefficients) ? cal.coefficients : [];
    const calibrated = !!(cal.isCalibrated || cal.calibrated || coeffs.length);
    if (!calibrated) return null;
    const signalArr = getSignalArray(latest) || getSignalArray((st.frame && st.frame.latest) || null);
    const pixelWidth = getPixelWidth(st, latest, signalArr);
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
      let total = 0; let count = 0;
      for (let i = 1; i < pts.length; i += 1) {
        const dpx = Math.abs(Number(pts[i].px) - Number(pts[i - 1].px));
        const dnm = Math.abs(Number(pts[i].nm) - Number(pts[i - 1].nm));
        if (dpx > 0 && Number.isFinite(dnm)) { total += (dnm / dpx); count += 1; }
      }
      if (count > 0) {
        const res = total / count;
        if (Number.isFinite(res) && res > 0) return res;
      }
    }
    return null;
  }

  function formatSubMode(mode) {
    const m = String(mode || 'raw').toLowerCase();
    if (m === 'raw') return 'Raw';
    if (m === 'raw-dark') return 'Raw - Dark';
    if (m === 'difference') return 'Difference';
    if (m === 'ratio') return 'Ratio';
    if (m === 'transmittance') return 'Transmittance %';
    if (m === 'absorbance') return 'Absorbance';
    return m;
  }

  function median(values) {
    const arr = (Array.isArray(values) ? values : []).filter(function (v) { return Number.isFinite(Number(v)); }).map(Number).sort(function (a, b) { return a - b; });
    if (!arr.length) return null;
    const mid = Math.floor(arr.length / 2);
    return (arr.length % 2) ? arr[mid] : ((arr[mid - 1] + arr[mid]) / 2);
  }

  function estimateNoiseMetrics(arr) {
    const out = { sigma: null, signal: null, sn: null };
    if (!Array.isArray(arr) || arr.length < 9) return out;
    const vals = arr.map(Number).filter(Number.isFinite);
    if (vals.length < 9) return out;
    const smooth = [];
    for (let i = 0; i < vals.length; i += 1) {
      let sum = 0; let count = 0;
      for (let k = -2; k <= 2; k += 1) {
        const j = i + k;
        if (j < 0 || j >= vals.length) continue;
        sum += vals[j]; count += 1;
      }
      smooth.push(count ? (sum / count) : vals[i]);
    }
    const residuals = vals.map(function (v, i) { return v - smooth[i]; });
    const absResiduals = residuals.map(function (v) { return Math.abs(v); });
    const mad = median(absResiduals);
    const sigma = Number.isFinite(mad) ? (mad * 1.4826) : null;
    const signal = median(smooth);
    const sn = (Number.isFinite(signal) && Number.isFinite(sigma) && sigma > 0) ? (signal / sigma) : null;
    out.sigma = sigma; out.signal = signal; out.sn = sn;
    return out;
  }

  function estimatePeakMatchResidualNm(state) {
    const hits = (((state || {}).analysis || {}).topHits) || [];
    if (!Array.isArray(hits) || !hits.length) return null;
    const deltas = hits.map(function (h) { return Math.abs(Number(h && h.deltaNm)); }).filter(Number.isFinite);
    if (!deltas.length) return null;
    return deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length;
  }

  function getHardware(state) { return ((state || {}).hardware) || {}; }

  function computeResolvingPower(state, resolutionNmPerPx) {
    const hw = getHardware(state);
    const fwhm = Number(hw.spectrometerResolutionFwhmNm);
    const rangeMin = Number(hw.spectralRangeMinNm);
    const rangeMax = Number(hw.spectralRangeMaxNm);
    const lambdaMid = (Number.isFinite(rangeMin) && Number.isFinite(rangeMax)) ? ((rangeMin + rangeMax) / 2) : 550;
    if (Number.isFinite(fwhm) && fwhm > 0) return lambdaMid / fwhm;
    if (Number.isFinite(resolutionNmPerPx) && resolutionNmPerPx > 0) return lambdaMid / resolutionNmPerPx;
    return null;
  }

  function formatMaybe(value, digits) { return Number.isFinite(value) ? Number(value).toFixed(Number.isFinite(digits) ? digits : 2) : '—'; }

  function hasLabAnalysis(state) {
    const st = state || {};
    const hits = (((st.analysis || {}).topHits) || []);
    return String(st.appMode || '').toUpperCase() === 'LAB' && Array.isArray(hits) && hits.length > 0;
  }

  function formatRange(min, max, digits) {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return '—';
    const d = Number.isFinite(digits) ? digits : 0;
    return Number(min).toFixed(d) + '–' + Number(max).toFixed(d);
  }

  function estimateCoverageNm(state, latest) {
    const st = state || {};
    if (latest && Array.isArray(latest.nm) && latest.nm.length >= 2) {
      const vals = latest.nm.map(Number).filter(Number.isFinite);
      if (vals.length >= 2) return { min: vals[0], max: vals[vals.length - 1] };
    }
    const coeffs = Array.isArray(st.calibration && st.calibration.coefficients) ? st.calibration.coefficients : [];
    const signalArr = getSignalArray(latest) || getSignalArray((st.frame && st.frame.latest) || null);
    const pixelWidth = getPixelWidth(st, latest, signalArr);
    if (coeffs.length && Number.isFinite(pixelWidth) && pixelWidth >= 2) {
      const a = evalPoly(coeffs, 0); const b = evalPoly(coeffs, pixelWidth - 1);
      if (Number.isFinite(a) && Number.isFinite(b)) return { min: Math.min(a, b), max: Math.max(a, b) };
    }
    const hw = getHardware(st);
    const hwMin = Number(hw.spectralRangeMinNm), hwMax = Number(hw.spectralRangeMaxNm);
    if (Number.isFinite(hwMin) && Number.isFinite(hwMax)) return { min: Math.min(hwMin, hwMax), max: Math.max(hwMin, hwMax) };
    return { min: null, max: null };
  }

  function computeCalibrationRmsNm(state) {
    const st = state || {}, cal = st.calibration || {};
    const coeffs = Array.isArray(cal.coefficients) ? cal.coefficients : [];
    const points = Array.isArray(cal.points) ? cal.points : [];
    if (!coeffs.length || points.length < 2) return null;
    const residuals = [];
    for (let i = 0; i < points.length; i += 1) {
      const px = Number(points[i] && points[i].px), nm = Number(points[i] && points[i].nm);
      if (!Number.isFinite(px) || !Number.isFinite(nm)) continue;
      const fit = evalPoly(coeffs, px);
      if (!Number.isFinite(fit)) continue;
      residuals.push(fit - nm);
    }
    if (!residuals.length) return null;
    const mse = residuals.reduce(function (acc, v) { return acc + (v * v); }, 0) / residuals.length;
    return Math.sqrt(mse);
  }

  function normalizeArray01(arr) {
    const vals = Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    if (!vals.length) return [];
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < vals.length; i += 1) { if (vals[i] < min) min = vals[i]; if (vals[i] > max) max = vals[i]; }
    const span = max - min;
    if (!(span > 0)) return vals.map(function () { return 0; });
    return vals.map(function (v) { return (v - min) / span; });
  }

  function detectQuickPeaksForMetrics(state, arr) {
    const vals = Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    if (vals.length < 3) return [];
    const detect = sp.quickPeaks && typeof sp.quickPeaks.detectQuickPeaks === 'function' ? sp.quickPeaks.detectQuickPeaks : null;
    if (!detect) return [];
    const st = state || {};
    const rel = Number(st.analysis && st.analysis.peakThresholdRel);
    const legacyThr = Number(st.peaks && st.peaks.threshold);
    const threshold = Number.isFinite(rel) && rel > 0 ? Math.max(0.003, Math.min(0.95, rel)) : Math.max(0.003, Math.min(0.95, (Number.isFinite(legacyThr) ? legacyThr : 20) / 255));
    const dist = Math.max(1, Math.min(64, Math.round(Number(st.analysis && st.analysis.peakDistancePx) || Number(st.peaks && st.peaks.distance) || 3)));
    return detect(normalizeArray01(vals), { threshold: threshold, distance: dist });
  }

  function computeStrongPeakCount(state, peaks) {
    const list = Array.isArray(peaks) ? peaks : [];
    if (!list.length) return 0;
    const level = Math.max(1, Math.min(5, Math.round(Number((state && state.analysis && state.analysis.strongPeakLevel) || 3))));
    const cutMap = { 1: 0.35, 2: 0.5, 3: 0.65, 4: 0.8, 5: 0.9 };
    const cut = cutMap[level] || 0.65;
    let count = 0;
    for (let i = 0; i < list.length; i += 1) {
      const v = Number(list[i] && list[i].value);
      if (Number.isFinite(v) && v >= cut) count += 1;
    }
    return count;
  }

  function bestAnalysisConfidence(state) {
    const hits = (((state || {}).analysis || {}).topHits) || [];
    if (!Array.isArray(hits) || !hits.length) return null;
    let best = null;
    for (let i = 0; i < hits.length; i += 1) {
      const c = Number(hits[i] && hits[i].confidence);
      if (!Number.isFinite(c)) continue;
      if (best == null || c > best) best = c;
    }
    return Number.isFinite(best) ? best : null;
  }

  function flattenPresetCatalog(catalog) {
    const groups = Array.isArray(catalog && catalog.groups) ? catalog.groups : [];
    const out = [];
    for (let g = 0; g < groups.length; g += 1) {
      const presets = Array.isArray(groups[g] && groups[g].presets) ? groups[g].presets : [];
      for (let i = 0; i < presets.length; i += 1) out.push(presets[i]);
    }
    return out;
  }

  function getPresetLabel(state) {
    const st = state || {}, presetId = st.analysis && st.analysis.presetId;
    if (!presetId) return '—';
    const items = flattenPresetCatalog(st.analysis && st.analysis.presetCatalog);
    for (let i = 0; i < items.length; i += 1) if (String(items[i] && items[i].id) === String(presetId)) return String(items[i].label || items[i].id);
    return String(presetId);
  }

  function getAxisMode() {
    try {
      const sel = document.getElementById('spXAxisMode');
      if (sel && sel.value) return String(sel.value).toLowerCase();
      const nm = document.getElementById('nmCheckbox');
      if (nm) return nm.checked ? 'nm' : 'px';
    } catch (_) {}
    return 'px';
  }

  function getStripeStatus() {
    try {
      const y = document.getElementById('stripePlacementRange');
      const h = document.getElementById('stripeWidthRange');
      const yv = y ? Number(y.value) : NaN, hv = h ? Number(h.value) : NaN;
      return { y: Number.isFinite(yv) ? Math.round(yv) : null, h: Number.isFinite(hv) ? Math.round(hv) : null };
    } catch (_) { return { y: null, h: null }; }
  }

  function getHardwareLabel(state) {
    const hw = getHardware(state);
    if (hw.profileName) return String(hw.profileName);
    const hasCustom = [hw.spectralRangeMinNm, hw.spectralRangeMaxNm, hw.spectrometerResolutionFwhmNm, hw.pixelResolutionNm, hw.gratingLinesPerMm].some(function (v) { return Number.isFinite(Number(v)); });
    return hasCustom ? 'CUSTOM' : '—';
  }

  function compute(state, opts) {
    const st = state || {};
    const latest = (opts && opts.latestFrame) || (st.frame && st.frame.latest) || null;
    const arr = getSignalArray(latest);
    let min = null, max = null, avg = null, dyn = null, satText = '0/0 (0%)', snrText = '—', validCount = 0;
    if (arr && arr.length) {
      let mn = Infinity, mx = -Infinity, sum = 0, sat = 0;
      for (let i = 0; i < arr.length; i += 1) {
        const v = Number(arr[i]);
        if (!Number.isFinite(v)) continue;
        if (v < mn) mn = v; if (v > mx) mx = v; sum += v; validCount += 1; if (v >= 254) sat += 1;
      }
      if (mn !== Infinity && mx !== -Infinity) {
        min = mn; max = mx; avg = sum / Math.max(1, validCount); dyn = mx - mn;
        if (mx <= 1.01) { sat = 0; for (let i = 0; i < arr.length; i += 1) { const vv = Number(arr[i]); if (Number.isFinite(vv) && vv >= 0.995) sat += 1; } }
        else if (sat === 0 && mx >= 250) { sat = 0; for (let i = 0; i < arr.length; i += 1) { const vv = Number(arr[i]); if (Number.isFinite(vv) && vv >= 250) sat += 1; } }
        const pct = ((sat / Math.max(1, validCount)) * 100).toFixed(1);
        satText = `${sat}/${validCount} (${pct}%)`;
        const noiseMetrics0 = estimateNoiseMetrics(arr);
        if (Number.isFinite(noiseMetrics0.sn)) snrText = noiseMetrics0.sn.toFixed(2);
      }
    }

    const registryModules = (((window.SpectraPro || {}).v15 || {}).registry || {}).modules || {};
    const loadedV15 = Object.values(registryModules).filter(Boolean).length;
    const camera = st.camera || {}, camSummary = camera.summary || {};
    const camRes = camSummary.resolution || ((camera.values && camera.values.width && camera.values.height) ? `${camera.values.width}x${camera.values.height}` : '—');
    const camStatus = camera.status || 'unknown';
    const camExposure = (camera.supported && camera.supported.exposureTime) ? 'exp✓' : 'exp—';
    const camZoom = (camera.supported && camera.supported.zoom) ? 'zoom✓' : 'zoom—';
    const coverage = estimateCoverageNm(st, latest);
    const stripe = getStripeStatus();

    const status = [
      { text: `App: ${st.appMode || 'CORE'}`, title: 'Current app mode/section.' },
      { text: `Worker: ${(st.worker && st.worker.status) || 'idle'}${(st.worker && st.worker.analysisHz) ? ` · ${st.worker.analysisHz} Hz` : ''}`, title: 'Worker state and analysis refresh rate.' },
      { text: `Src: ${(latest && latest.source) || (st.frame && st.frame.source) || 'none'}${(latest && latest.pixelWidth) ? ` · ${latest.pixelWidth} px` : ''}`, title: 'Current frame source and active signal width in pixels.' },
      { text: `Cal: ${(st.calibration && st.calibration.isCalibrated) ? 'yes' : 'no'} · pts ${(st.calibration && (st.calibration.points || []).length) || (st.calibration && st.calibration.pointCount) || 0} · sh ${(st.calibration && st.calibration.shellPointCount) || 0}`, title: 'Calibration state. pts = calibration points. sh = shell points.' },
      { text: `RefG: ${(st.reference && st.reference.hasReference) ? 'yes' : 'no'} · n ${(st.reference && st.reference.count) || 0}`, title: 'Reference graph overlay state. n = number of loaded reference graphs.' },
      { text: `Dark: ${(st.subtraction && st.subtraction.hasDark) ? 'yes' : 'no'}`, title: 'Whether a dark frame/reference image is loaded for subtraction.' },
      { text: `Ref: ${(st.subtraction && st.subtraction.hasReference) ? 'yes' : 'no'}`, title: 'Whether an imported reference image is loaded for processing.' },
      { text: `Proc: ${formatSubMode((st.subtraction && st.subtraction.mode) || 'raw')}`, title: 'Active processing/subtraction mode for the plotted spectrum.' },
      { text: `Cam: ${camStatus} · ${camRes} · ${camExposure} ${camZoom}`, title: 'Camera status, resolution, exposure control support and zoom support.' },
      { text: `Mods: ${loadedV15}/8`, title: 'Loaded v1.5 frontend modules.' },
      { text: `Preset: ${getPresetLabel(st)}`, title: 'Selected LAB/analysis preset.' },
      { text: `Axis: ${getAxisMode()}`, title: 'Current horizontal axis mode: raw pixels or calibrated wavelength.' },
      { text: `Analyze: ${st.analysis && st.analysis.enabled ? 'on' : 'off'}`, title: 'Whether worker-based LAB analysis is enabled.' },
      { text: `Stripe: y${Number.isFinite(stripe.y) ? stripe.y : '—'} · h${Number.isFinite(stripe.h) ? stripe.h : '—'}`, title: 'Stripe placement and stripe height used for the extracted spectrum.' },
      { text: `Norm: ${st.display && st.display.normalizeYAxis ? 'on' : 'off'}`, title: 'Whether the graph Y-axis is normalized to the strongest peak.' },
      { text: `HW: ${getHardwareLabel(st)}`, title: 'Active hardware profile, or CUSTOM when manual hardware values are applied.' },
      { text: `Range: ${formatRange(coverage.min, coverage.max, 0)}${Number.isFinite(coverage.min) && Number.isFinite(coverage.max) ? ' nm' : ''}`, title: 'Current calibrated wavelength span for the active spectrum, or hardware range when available.' }
    ];

    const resolutionNmPerPx = estimateResolutionNmPerPx(st, latest);
    const noiseMetrics = estimateNoiseMetrics(arr || []);
    const peakResidualNm = hasLabAnalysis(st) ? estimatePeakMatchResidualNm(st) : null;
    const hw = getHardware(st), hwFwhmNm = Number(hw.spectrometerResolutionFwhmNm);
    const resolvingPower = computeResolvingPower(st, resolutionNmPerPx);
    const quickPeaks = detectQuickPeaksForMetrics(st, arr || []);
    const strongPeaks = computeStrongPeakCount(st, quickPeaks);
    const headroom = Number.isFinite(max) ? ((max <= 1.01) ? (1 - max) : (255 - max)) : null;
    const calRmsNm = computeCalibrationRmsNm(st);
    const conf = hasLabAnalysis(st) ? bestAnalysisConfidence(st) : null;

    const dq = [
      { text: `Signal: ${formatMaybe(min, 1)}–${formatMaybe(max, 1)}`, title: 'Minimum and maximum signal intensity in the active stripe.' },
      { text: `Avg/Dyn: ${formatMaybe(avg, 1)} / ${formatMaybe(dyn, 1)}`, title: 'Average intensity and dynamic range (max - min).' },
      { text: `Sat: ${satText}`, title: 'Clipped or near-clipped samples in the active signal.' },
      { text: `Hits/QC: ${((st.analysis && st.analysis.topHits) || []).length}/${((st.analysis && st.analysis.qcFlags) || []).length}`, title: 'Top hits / QC flags from the current LAB analysis.' },
      { text: `Res: ${Number.isFinite(resolutionNmPerPx) ? resolutionNmPerPx.toFixed(2) + ' nm/px' : '—'}`, title: 'Estimated calibration resolution in nm per pixel.' },
      { text: `Peak Δ: ${hasLabAnalysis(st) ? (formatMaybe(peakResidualNm, 2) + ' nm') : '—'}`, title: 'Mean wavelength offset between matched peaks and library lines.' },
      { text: `Noise σ: ${hasLabAnalysis(st) ? formatMaybe(noiseMetrics.sigma, 2) : '—'}`, title: 'Estimated noise sigma from residual signal fluctuations.' },
      { text: `SNR: ${hasLabAnalysis(st) ? formatMaybe(noiseMetrics.sn, 2) : '—'}`, title: 'Estimated signal-to-noise ratio.' },
      { text: `FWHM: ${Number.isFinite(hwFwhmNm) ? (formatMaybe(hwFwhmNm, 2) + ' nm') : '—'}`, title: 'Instrument full width at half maximum, if known from hardware data.' },
      { text: `Eff. R: ${Number.isFinite(resolvingPower) ? ('R≈' + Math.round(resolvingPower)) : '—'}`, title: 'Approximate resolving power R ≈ λ/Δλ.' },
      { text: `Peaks: ${quickPeaks.length}`, title: 'Quick-detected local peaks in the current active signal using the current peak threshold/distance settings.' },
      { text: `Strong: ${strongPeaks}`, title: 'Peaks that pass the current Strong Peak level weighting (1–5).' },
      { text: `Base: ${formatMaybe(min, 1)}`, title: 'Estimated baseline floor in the active signal (same unit as Signal).' },
      { text: `Headroom: ${Number.isFinite(headroom) ? formatMaybe(headroom, (headroom <= 1.01 ? 3 : 1)) : '—'}`, title: 'Remaining headroom before clipping: 255 - max for raw data, or 1 - max for normalized data.' },
      { text: `Cov: ${formatRange(coverage.min, coverage.max, 0)}${Number.isFinite(coverage.min) && Number.isFinite(coverage.max) ? ' nm' : ''}`, title: 'Calibrated wavelength coverage of the current active spectrum.' },
      { text: `Conf: ${Number.isFinite(conf) ? formatMaybe(conf, 2) : '—'}`, title: 'Best current analysis confidence from the active top-hit set.' },
      { text: `Cal err: ${Number.isFinite(calRmsNm) ? (formatMaybe(calRmsNm, 2) + ' nm') : '—'}`, title: 'RMS calibration fit error computed from calibration points and the active polynomial fit.' }
    ];

    return { status, dq, metrics: { min, max, avg, dyn, validCount, saturation: satText, snr: snrText, peakResidualNm, noiseSigma: noiseMetrics.sigma, sn: noiseMetrics.sn, resolutionNmPerPx, hardwareFwhmNm: hwFwhmNm, resolvingPower, quickPeakCount: quickPeaks.length, strongPeakCount: strongPeaks, baseline: min, headroom, coverageMinNm: coverage.min, coverageMaxNm: coverage.max, bestConfidence: conf, calibrationRmsNm: calRmsNm } };
  }

  mod.compute = compute;
  mod.init = function initDataQualityPanel(opts) { return { ok: true, active: true, options: Object.assign({}, opts || {}) }; };
})();
