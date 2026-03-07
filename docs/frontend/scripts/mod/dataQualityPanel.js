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
    return estimateHardwareRangeNm(st);
  }

  function estimateHardwareRangeNm(state) {
    const hw = getHardware(state || {});
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

  function line(label, value, title, group) {
    return { label: label, value: value, title: title, group: group };
  }

  function percentile(arr, q) {
    const vals = (Array.isArray(arr) ? arr : []).map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!vals.length) return null;
    const qq = Math.max(0, Math.min(1, Number(q) || 0));
    const pos = (vals.length - 1) * qq;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    if (lo === hi) return vals[lo];
    const t = pos - lo;
    return vals[lo] * (1 - t) + vals[hi] * t;
  }

  function fallbackPeakDetect(vals, threshold, distance) {
    const out = [];
    if (!Array.isArray(vals) || vals.length < 3) return out;
    const minHeight = Math.max(0, threshold || 0);
    for (let i = 1; i < vals.length - 1; i += 1) {
      const cur = Number(vals[i]);
      if (!Number.isFinite(cur) || cur < minHeight) continue;
      if (cur > Number(vals[i - 1]) && cur >= Number(vals[i + 1])) {
        if (out.length && i - out[out.length - 1].index < distance) {
          if (cur > out[out.length - 1].value) out[out.length - 1] = { index: i, value: cur };
        } else out.push({ index: i, value: cur });
      }
    }
    return out;
  }

  function computeSignalMetrics(arr) {
    const vals = Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    if (!vals.length) return { baseline: null, headroom: null, clipMax: null };
    const max = Math.max.apply(null, vals);
    const baseline = percentile(vals, 0.05);
    const clipMax = max <= 1.01 ? 1 : 255;
    const headroom = Number.isFinite(max) ? Math.max(0, clipMax - max) : null;
    return { baseline: baseline, headroom: headroom, clipMax: clipMax };
  }

  function computePeakMetrics(state, arr) {
    const vals = Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    if (vals.length < 3) return { peaks: [], strongCount: 0 };
    const normalized = normalizeArray01(vals);
    const st = state || {};
    const rel = Number(st.analysis && st.analysis.peakThresholdRel);
    const legacyThr = Number(st.peaks && st.peaks.threshold);
    const threshold = Number.isFinite(rel) && rel > 0 ? Math.max(0.003, Math.min(0.95, rel)) : Math.max(0.003, Math.min(0.95, (Number.isFinite(legacyThr) ? legacyThr : 20) / 255));
    const dist = Math.max(1, Math.min(64, Math.round(Number(st.analysis && st.analysis.peakDistancePx) || Number(st.peaks && st.peaks.distance) || 3)));
    let peaks = [];
    try {
      const detect = sp.quickPeaks && typeof sp.quickPeaks.detectQuickPeaks === 'function' ? sp.quickPeaks.detectQuickPeaks : null;
      peaks = detect ? detect(normalized, { threshold: threshold, distance: dist }) : [];
    } catch (_) { peaks = []; }
    if (!Array.isArray(peaks) || !peaks.length) peaks = fallbackPeakDetect(normalized, threshold, dist);
    return { peaks: peaks, strongCount: computeStrongPeakCount(state, peaks) };
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
    const hardwareRange = estimateHardwareRangeNm(st);
    const stripe = getStripeStatus();

    const status = [
      line('App:', `${st.appMode || 'CORE'}`, 'Current app mode/section.', 'system'),
      line('Worker:', `${(st.worker && st.worker.status) || 'idle'}${(st.worker && st.worker.analysisHz) ? ` · ${st.worker.analysisHz} Hz` : ''}`, 'Worker state and analysis refresh rate.', 'system'),
      line('Src:', `${(latest && latest.source) || (st.frame && st.frame.source) || 'none'}${(latest && latest.pixelWidth) ? ` · ${latest.pixelWidth} px` : ''}`, 'Current frame source and active signal width in pixels.', 'system'),
      line('Cam:', `${camStatus} · ${camRes} · ${camExposure} ${camZoom}`, 'Camera status, resolution, exposure control support and zoom support.', 'system'),
      line('Mods:', `${loadedV15}/8`, 'Loaded v1.5 frontend modules.', 'system'),
      line('Preset:', `${getPresetLabel(st)}`, 'Selected LAB/analysis preset.', 'analysis'),
      line('Analyze:', `${st.analysis && st.analysis.enabled ? 'on' : 'off'}`, 'Whether worker-based LAB analysis is enabled.', 'analysis'),
      line('Axis:', `${getAxisMode()}`, 'Current horizontal axis mode: raw pixels or calibrated wavelength.', 'analysis'),
      line('Norm:', `${st.display && st.display.normalizeYAxis ? 'on' : 'off'}`, 'Whether the graph Y-axis is normalized to the strongest peak.', 'analysis'),
      line('Stripe:', `y${Number.isFinite(stripe.y) ? stripe.y : '—'} · h${Number.isFinite(stripe.h) ? stripe.h : '—'}`, 'Stripe placement and stripe height used for the extracted spectrum.', 'analysis'),
      line('Cal:', `${(st.calibration && st.calibration.isCalibrated) ? 'yes' : 'no'} · pts ${(st.calibration && (st.calibration.points || []).length) || (st.calibration && st.calibration.pointCount) || 0} · sh ${(st.calibration && st.calibration.shellPointCount) || 0}`, 'Calibration state. pts = calibration points. sh = shell points.', 'calibration'),
      line('Range:', `${formatRange(hardwareRange.min, hardwareRange.max, 0)}${Number.isFinite(hardwareRange.min) && Number.isFinite(hardwareRange.max) ? ' nm' : ''}`, 'Configured hardware wavelength range from the Hardware panel.', 'hardware'),
      line('Dark:', `${(st.subtraction && st.subtraction.hasDark) ? 'yes' : 'no'}`, 'Whether a dark frame/reference image is loaded for subtraction.', 'processing'),
      line('Ref:', `${(st.subtraction && st.subtraction.hasReference) ? 'yes' : 'no'}`, 'Whether an imported reference image is loaded for processing.', 'processing'),
      line('RefG:', `${(st.reference && st.reference.hasReference) ? 'yes' : 'no'} · n ${(st.reference && st.reference.count) || 0}`, 'Reference graph overlay state. n = number of loaded reference graphs.', 'processing'),
      line('Proc:', `${formatSubMode((st.subtraction && st.subtraction.mode) || 'raw')}`, 'Active processing/subtraction mode for the plotted spectrum.', 'processing'),
      line('HW:', `${getHardwareLabel(st)}`, 'Active hardware profile, or CUSTOM when manual hardware values are applied.', 'hardware')
    ];

    const resolutionNmPerPx = estimateResolutionNmPerPx(st, latest);
    const noiseMetrics = estimateNoiseMetrics(arr || []);
    const peakResidualNm = hasLabAnalysis(st) ? estimatePeakMatchResidualNm(st) : null;
    const hw = getHardware(st), hwFwhmNm = Number(hw.spectrometerResolutionFwhmNm);
    const resolvingPower = computeResolvingPower(st, resolutionNmPerPx);
    const peakMetrics = computePeakMetrics(st, arr || []);
    const signalMetrics = computeSignalMetrics(arr || []);
    const quickPeaks = peakMetrics.peaks;
    const strongPeaks = peakMetrics.strongCount;
    const headroom = signalMetrics.headroom;
    const baseline = signalMetrics.baseline;
    const calRmsNm = computeCalibrationRmsNm(st);
    const conf = hasLabAnalysis(st) ? bestAnalysisConfidence(st) : null;

    const dq = [
      line('Signal:', `${formatMaybe(min, 1)}–${formatMaybe(max, 1)}`, 'Minimum and maximum signal intensity in the active stripe.', 'signal'),
      line('Avg/Dyn:', `${formatMaybe(avg, 1)} / ${formatMaybe(dyn, 1)}`, 'Average intensity and dynamic range (max - min).', 'signal'),
      line('Base:', `${formatMaybe(baseline, 1)}`, 'Estimated baseline floor from the lower 5% percentile of the active signal.', 'signal'),
      line('Headroom:', `${Number.isFinite(headroom) ? formatMaybe(headroom, (headroom <= 1.01 ? 3 : 1)) : '—'}`, 'Remaining headroom before clipping: clip max - strongest sample.', 'signal'),
      line('Sat:', `${satText}`, 'Clipped or near-clipped samples in the active signal.', 'signal'),
      line('Peaks:', `${quickPeaks.length}`, 'Detected local peaks in the current active signal using current threshold/distance settings.', 'analysis'),
      line('Strong:', `${strongPeaks}`, 'Peaks that pass the current Strong Peak level weighting (1–5).', 'analysis'),
      line('Hits/QC:', `${((st.analysis && st.analysis.topHits) || []).length}/${((st.analysis && st.analysis.qcFlags) || []).length}`, 'Top hits / QC flags from the current LAB analysis.', 'analysis'),
      line('Peak Δ:', `${hasLabAnalysis(st) ? (formatMaybe(peakResidualNm, 2) + ' nm') : '—'}`, 'Mean wavelength offset between matched peaks and library lines.', 'analysis'),
      line('Conf:', `${Number.isFinite(conf) ? formatMaybe(conf, 2) : '—'}`, 'Best current analysis confidence from the active top-hit set.', 'analysis'),
      line('Noise σ:', `${formatMaybe(noiseMetrics.sigma, 2)}`, 'Estimated noise sigma from residual signal fluctuations.', 'quality'),
      line('SNR:', `${formatMaybe(noiseMetrics.sn, 2)}`, 'Estimated signal-to-noise ratio.', 'quality'),
      line('Res:', `${Number.isFinite(resolutionNmPerPx) ? resolutionNmPerPx.toFixed(2) + ' nm/px' : '—'}`, 'Estimated calibration resolution in nm per pixel.', 'calibration'),
      line('Cov:', `${formatRange(coverage.min, coverage.max, 0)}${Number.isFinite(coverage.min) && Number.isFinite(coverage.max) ? ' nm' : ''}`, 'Calibrated wavelength coverage of the current active spectrum.', 'calibration'),
      line('Cal err:', `${Number.isFinite(calRmsNm) ? (formatMaybe(calRmsNm, 2) + ' nm') : '—'}`, 'RMS calibration fit error computed from calibration points and the active polynomial fit.', 'calibration'),
      line('FWHM:', `${Number.isFinite(hwFwhmNm) ? (formatMaybe(hwFwhmNm, 2) + ' nm') : '—'}`, 'Instrument full width at half maximum, if known from hardware data.', 'hardware'),
      line('Eff. R:', `${Number.isFinite(resolvingPower) ? ('R≈' + Math.round(resolvingPower)) : '—'}`, 'Approximate resolving power R ≈ λ/Δλ.', 'hardware')
    ];

    return { status, dq, metrics: { min, max, avg, dyn, validCount, saturation: satText, snr: snrText, peakResidualNm, noiseSigma: noiseMetrics.sigma, sn: noiseMetrics.sn, resolutionNmPerPx, hardwareFwhmNm: hwFwhmNm, resolvingPower, quickPeakCount: quickPeaks.length, strongPeakCount: strongPeaks, baseline: baseline, headroom, coverageMinNm: coverage.min, coverageMaxNm: coverage.max, bestConfidence: conf, calibrationRmsNm: calRmsNm } };
  }

  mod.compute = compute;
  mod.init = function initDataQualityPanel(opts) { return { ok: true, active: true, options: Object.assign({}, opts || {}) }; };
})();
