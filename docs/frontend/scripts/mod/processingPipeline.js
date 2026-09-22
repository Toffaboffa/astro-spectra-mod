(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};
  const SCHEMA = 'spectra-pro-preprocessing/v1';

  function normalize01(values) {
    if (!Array.isArray(values) || !values.length) return [];
    const finite = values.map(function (value) { return Number(value); }).filter(Number.isFinite);
    if (!finite.length) return values.map(function () { return 0; });
    const min = Math.min.apply(null, finite);
    const max = Math.max.apply(null, finite);
    const range = max - min;
    return values.map(function (value) {
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || !(range > 0)) return 0;
      return (numeric - min) / range;
    });
  }

  function smooth(values, passes) {
    let count = Math.max(0, Math.min(8, Math.round(Number(passes) || 0)));
    let source = Array.isArray(values) ? values.slice() : [];
    while (count-- > 0 && source.length >= 3) {
      const output = source.slice();
      for (let index = 1; index < source.length - 1; index += 1) {
        output[index] = (source[index - 1] + source[index] + source[index + 1]) / 3;
      }
      source = output;
    }
    return source;
  }

  function stage(id, status, details) {
    return Object.assign({ id: id, status: status, applied: status === 'applied' }, details || {});
  }

  function run(frame, options) {
    const opts = Object.assign({
      subtractionMode: 'raw',
      smoothingPasses: 0,
      baselineMode: 'none',
      normalizationMode: 'none',
      quickPeakThreshold: 0.2,
      quickPeakDistance: 4,
      responseCorrection: { enabled: false, profile: null }
    }, options || {});
    const raw = frame && Array.isArray(frame.I) ? frame.I.map(function (value) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }) : [];
    const stages = [stage('raw-input', raw.length ? 'applied' : 'unavailable', { sampleCount: raw.length })];
    const warnings = [];

    const subtraction = sp.subtraction && typeof sp.subtraction.process === 'function'
      ? sp.subtraction.process(raw, opts.referenceI || null, opts.darkI || null, opts.subtractionMode)
      : { values: raw.slice(), effectiveMode: 'raw', darkApplied: false, referenceApplied: false, darkAvailable: false, referenceAvailable: false, warnings: ['subtraction-module-unavailable'], diagnostics: {} };
    warnings.push.apply(warnings, subtraction.warnings || []);
    const mode = String(subtraction.effectiveMode || 'raw');
    const darkRequested = mode === 'raw-dark' || mode === 'transmittance' || mode === 'absorbance';
    const referenceRequested = ['difference', 'ratio', 'transmittance', 'absorbance'].indexOf(mode) !== -1;
    stages.push(stage('dark-subtraction', subtraction.darkApplied ? 'applied' : (darkRequested ? 'unavailable' : 'disabled'), {
      available: !!subtraction.darkAvailable
    }));
    stages.push(stage('reference-correction', subtraction.referenceApplied ? 'applied' : (referenceRequested ? 'unavailable' : 'disabled'), {
      mode: mode,
      available: !!subtraction.referenceAvailable,
      invalidDivisionCount: subtraction.diagnostics && subtraction.diagnostics.invalidDivisionCount || 0,
      invalidLogCount: subtraction.diagnostics && subtraction.diagnostics.invalidLogCount || 0
    }));

    let processed = subtraction.values.slice();
    const response = sp.instrumentResponse && typeof sp.instrumentResponse.prepare === 'function'
      ? sp.instrumentResponse.prepare(processed, frame && frame.nm, Object.assign({}, opts.responseCorrection, { inputMode: mode }))
      : { values: processed.slice(), applied: false, status: 'unavailable', reason: 'response-interface-unavailable', profile: null };
    processed = response.values.slice();
    stages.push(stage('instrument-response', response.applied ? 'applied' : response.status, {
      reason: response.reason,
      profileId: response.profile && response.profile.profileId || null,
      profileLabel: response.profile && response.profile.label || null,
      intensityBasis: response.intensityBasis || 'uncorrected-relative-intensity',
      maxCorrectionFactor: response.maxCorrectionFactor || null,
      clampedSampleCount: response.clampedSampleCount || 0,
      extrapolatedSampleCount: response.extrapolatedSampleCount || 0
    }));
    if (response.status === 'unavailable' && opts.responseCorrection && opts.responseCorrection.enabled) warnings.push(response.reason);
    warnings.push.apply(warnings, response.warnings || []);

    const smoothingPasses = Math.max(0, Math.min(8, Math.round(Number(opts.smoothingPasses) || 0)));
    processed = smooth(processed, smoothingPasses);
    stages.push(stage('smoothing', smoothingPasses > 0 ? 'applied' : 'disabled', { method: 'three-point-moving-average', passes: smoothingPasses }));

    const baselineMode = String(opts.baselineMode || 'none').toLowerCase();
    stages.push(stage('baseline-continuum', baselineMode === 'none' ? 'disabled' : 'unavailable', {
      mode: baselineMode,
      reason: baselineMode === 'none' ? null : 'baseline-method-not-implemented'
    }));
    if (baselineMode !== 'none') warnings.push('baseline-method-not-implemented');

    const normalized = normalize01(processed);
    const normalizationMode = String(opts.normalizationMode || 'none').toLowerCase();
    const analysisI = normalizationMode === 'min-max' ? normalized.slice() : processed.slice();
    const normalizationApplied = normalizationMode === 'min-max';
    const normalizationStatus = normalizationApplied ? 'applied' : (normalizationMode === 'none' ? 'disabled' : 'unavailable');
    stages.push(stage('normalization', normalizationStatus, {
      mode: normalizationMode,
      quickPeakPreviewNormalized: true,
      reason: normalizationStatus === 'unavailable' ? 'normalization-method-not-implemented' : null
    }));
    if (normalizationStatus === 'unavailable') warnings.push('normalization-method-not-implemented');

    const peaks = sp.quickPeaks
      ? sp.quickPeaks.detectQuickPeaks(normalized, { threshold: opts.quickPeakThreshold, distance: opts.quickPeakDistance })
      : [];
    const activeOperations = stages.filter(function (item) { return item.applied && item.id !== 'raw-input'; }).map(function (item) { return item.id; });
    return {
      processedI: analysisI,
      normalizedI: normalized,
      quickPeaks: peaks,
      meta: {
        schema: SCHEMA,
        order: stages.map(function (item) { return item.id; }),
        stages: stages,
        activeOperations: activeOperations,
        warnings: Array.from(new Set(warnings)),
        inputSampleCount: raw.length,
        outputSampleCount: analysisI.length,
        analysisSignal: normalizationApplied ? 'normalizedI' : 'processedI',
        intensityBasis: response.intensityBasis || 'uncorrected-relative-intensity',
        responseCorrection: {
          enabled: !!(opts.responseCorrection && opts.responseCorrection.enabled),
          applied: !!response.applied,
          profileId: response.profile && response.profile.profileId || null,
          profileLabel: response.profile && response.profile.label || null,
          coverageNm: response.profile && response.profile.coverageNm || null,
          maxCorrectionFactor: response.maxCorrectionFactor || null,
          clampedSampleCount: response.clampedSampleCount || 0,
          extrapolatedSampleCount: response.extrapolatedSampleCount || 0
        },
        requestedSubtractionMode: String(opts.subtractionMode || 'raw'),
        effectiveSubtractionMode: mode
      }
    };
  }

  sp.processingPipeline = { schema: SCHEMA, normalize01: normalize01, smooth: smooth, run: run };
})(window);
