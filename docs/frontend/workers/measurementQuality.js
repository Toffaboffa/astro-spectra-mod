(function (root) {
  'use strict';

  const MODEL = 'measurement-quality-v1';

  function finite(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function rounded(value, digits) {
    const numeric = finite(value);
    return numeric === null ? null : +numeric.toFixed(digits == null ? 4 : digits);
  }

  function dimension(status, reason, metrics) {
    return { status: status, reason: reason, metrics: metrics || {} };
  }

  function downgrade(status) {
    if (status === 'good') return 'moderate';
    if (status === 'moderate') return 'poor';
    return status;
  }

  function featureDimension(features, qcFlags) {
    const list = Array.isArray(features) ? features : [];
    if (!list.length) {
      return dimension(qcFlags.indexOf('NO_SIGNAL') !== -1 ? 'poor' : 'unavailable', 'no-measurable-features', { featureCount: 0 });
    }
    let reliable = 0;
    let limited = 0;
    list.forEach(function (feature) {
      const flags = Array.isArray(feature && feature.qualityFlags) ? feature.qualityFlags : [];
      if (!flags.length && feature && feature.quality === 'good') reliable += 1;
      else limited += 1;
    });
    const fraction = reliable / list.length;
    const status = fraction >= 0.75 ? 'good' : (fraction >= 0.4 ? 'moderate' : 'poor');
    return dimension(status, status === 'good' ? 'features-reliable' : 'features-have-quality-flags', {
      featureCount: list.length,
      reliableFeatureCount: reliable,
      limitedFeatureCount: limited,
      reliableFraction: rounded(fraction, 4)
    });
  }

  function build(result, frame, options) {
    const output = result || {};
    const opt = options && typeof options === 'object' ? options : {};
    const qcRules = root.SPECTRA_PRO_qcRules;
    const qc = opt.qc || (qcRules && qcRules.evaluateQC ? qcRules.evaluateQC({ frame: frame }) : { flags: [], metrics: {} });
    const flags = Array.isArray(qc.flags) ? qc.flags.slice() : [];
    const metrics = qc.metrics || {};
    const diagnostics = output.calibrationDiagnostics || {};
    const uncertainty = output.matchUncertaintyModel || {};
    const hardware = opt.hardware || {};
    const dimensions = {};

    if (flags.indexOf('FRAME_TOO_SMALL') !== -1 || flags.indexOf('INVALID_SAMPLES') !== -1) {
      dimensions.signal = dimension('poor', 'invalid-or-insufficient-samples', {
        sampleCount: metrics.sampleCount || 0,
        validFraction: rounded(metrics.validFraction, 4)
      });
    } else if (flags.indexOf('NO_SIGNAL') !== -1) {
      dimensions.signal = dimension('poor', 'insufficient-dynamic-range', { dynamicRange: rounded(metrics.dynamicRange, 4) });
    } else {
      dimensions.signal = dimension('good', 'usable-dynamic-range', { dynamicRange: rounded(metrics.dynamicRange, 4) });
    }

    const snr = finite(metrics.snr);
    dimensions.noise = snr === null
      ? dimension(flags.indexOf('NO_SIGNAL') !== -1 ? 'poor' : 'unavailable', 'snr-unavailable', { snr: null, noiseSigma: rounded(metrics.noiseSigma, 4) })
      : dimension(snr < 3 ? 'poor' : (snr < 8 ? 'moderate' : 'good'), snr < 3 ? 'low-snr' : (snr < 8 ? 'limited-snr' : 'usable-snr'), {
          snr: rounded(snr, 3), noiseSigma: rounded(metrics.noiseSigma, 4)
        });

    const saturationFraction = finite(metrics.saturationFraction);
    dimensions.saturation = saturationFraction === null
      ? dimension('unavailable', 'saturation-unavailable', {})
      : dimension(saturationFraction > 0.01 ? 'poor' : (saturationFraction > 0 ? 'moderate' : 'good'), saturationFraction > 0 ? 'clipped-samples' : 'no-clipping-detected', {
          saturatedSamples: metrics.saturationCount || 0,
          saturationFraction: rounded(saturationFraction, 4)
        });

    const calibrated = !!output.calibrated;
    const calibrationRms = finite(diagnostics.rmsResidualNm);
    const sampling = finite(diagnostics.samplingNmPerPixel);
    const instrumentFwhm = finite(hardware.spectrometerResolutionFwhmNm);
    const calibrationScale = Math.max(0.05, sampling || 0, instrumentFwhm ? instrumentFwhm / 2.355 : 0);
    if (!calibrated || !diagnostics.available) {
      dimensions.calibration = dimension('unavailable', 'wavelength-calibration-unavailable', {
        pointCount: diagnostics.pointCount || 0, rmsResidualNm: calibrationRms
      });
    } else {
      let calibrationStatus = calibrationRms === null ? 'unavailable'
        : (calibrationRms <= calibrationScale * 0.5 ? 'good' : (calibrationRms <= calibrationScale ? 'moderate' : 'poor'));
      if (diagnostics.extrapolation && diagnostics.extrapolation.any) calibrationStatus = downgrade(calibrationStatus);
      dimensions.calibration = dimension(calibrationStatus,
        diagnostics.extrapolation && diagnostics.extrapolation.any ? 'calibration-extrapolation' : 'calibration-fit-residual', {
          pointCount: diagnostics.pointCount || 0,
          polynomialOrder: diagnostics.polynomialOrder == null ? null : diagnostics.polynomialOrder,
          rmsResidualNm: rounded(calibrationRms, 4),
          maxAbsResidualNm: rounded(diagnostics.maxAbsResidualNm, 4),
          extrapolated: !!(diagnostics.extrapolation && diagnostics.extrapolation.any)
        });
    }

    if (sampling === null || sampling <= 0 || instrumentFwhm === null || instrumentFwhm <= 0) {
      dimensions.sampling = dimension('unavailable', 'sampling-or-instrument-width-unavailable', {
        samplingNmPerPixel: rounded(sampling, 4), instrumentFwhmNm: rounded(instrumentFwhm, 4)
      });
    } else {
      const samplesPerFwhm = instrumentFwhm / sampling;
      dimensions.sampling = dimension(samplesPerFwhm >= 2 ? 'good' : (samplesPerFwhm >= 1 ? 'moderate' : 'poor'),
        samplesPerFwhm >= 2 ? 'instrument-width-adequately-sampled' : 'instrument-width-undersampled', {
          samplingNmPerPixel: rounded(sampling, 4), samplesPerInstrumentFwhm: rounded(samplesPerFwhm, 3)
        });
    }

    const effectiveTolerance = finite(uncertainty.effectiveToleranceNm);
    if (instrumentFwhm === null || instrumentFwhm <= 0 || effectiveTolerance === null || effectiveTolerance <= 0) {
      dimensions.resolution = dimension('unavailable', 'resolution-context-unavailable', {
        instrumentFwhmNm: rounded(instrumentFwhm, 4), effectiveToleranceNm: rounded(effectiveTolerance, 4)
      });
    } else {
      const ratio = instrumentFwhm / effectiveTolerance;
      dimensions.resolution = dimension(ratio <= 1 ? 'good' : (ratio <= 2 ? 'moderate' : 'poor'),
        ratio <= 1 ? 'resolution-supports-match-window' : 'resolution-limits-match-discrimination', {
          instrumentFwhmNm: rounded(instrumentFwhm, 4), effectiveToleranceNm: rounded(effectiveTolerance, 4), fwhmToToleranceRatio: rounded(ratio, 3)
        });
    }

    const coverage = diagnostics.wavelengthCoverageNm;
    dimensions.coverage = calibrated && coverage && finite(coverage.min) !== null && finite(coverage.max) !== null
      ? dimension(diagnostics.extrapolation && diagnostics.extrapolation.any ? 'poor' : 'good', diagnostics.extrapolation && diagnostics.extrapolation.any ? 'coverage-includes-extrapolation' : 'calibrated-coverage-available', {
          minNm: rounded(coverage.min, 4), maxNm: rounded(coverage.max, 4), extrapolated: !!(diagnostics.extrapolation && diagnostics.extrapolation.any)
        })
      : dimension('unavailable', 'calibrated-coverage-unavailable', {});

    dimensions.features = featureDimension(output.features, flags);

    const priority = ['signal', 'saturation', 'calibration', 'noise', 'sampling', 'resolution', 'coverage', 'features'];
    const severity = { poor: 3, moderate: 2, unavailable: 1, good: 0 };
    let mainKey = null;
    let mainSeverity = 0;
    priority.forEach(function (key) {
      const value = dimensions[key];
      const score = severity[value && value.status] || 0;
      if (score > mainSeverity) {
        mainKey = key;
        mainSeverity = score;
      }
    });
    const main = mainKey ? dimensions[mainKey] : null;
    const availableStatuses = Object.keys(dimensions).map(function (key) { return dimensions[key].status; }).filter(function (status) { return status !== 'unavailable'; });
    const overallStatus = availableStatuses.indexOf('poor') !== -1 ? 'poor'
      : (availableStatuses.indexOf('moderate') !== -1 ? 'moderate' : (availableStatuses.length ? 'good' : 'unavailable'));

    return {
      model: MODEL,
      overallStatus: overallStatus,
      mainLimitation: mainKey ? { code: mainKey, status: main.status, reason: main.reason } : null,
      dimensions: dimensions,
      qcFlags: flags
    };
  }

  root.SPECTRA_PRO_measurementQuality = { model: MODEL, build: build };
})(typeof self !== 'undefined' ? self : this);
