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

  function finiteRange(values) {
    const clean = (Array.isArray(values) ? values : []).map(finite).filter(function (value) { return value !== null; });
    if (!clean.length) return null;
    return { min: Math.min.apply(null, clean), max: Math.max.apply(null, clean) };
  }

  function fluorescenceRelevantCoverage(output) {
    const source = output || {};
    if (String(source.presetId || '') !== 'smart-fluorescent' && !source.fluorescenceSummary) return null;
    const values = [];
    const summary = source.fluorescenceSummary && typeof source.fluorescenceSummary === 'object' ? source.fluorescenceSummary : {};
    [summary.bandMinNm, summary.bandMaxNm, summary.lambdaMaxNm, summary.centroidNm].forEach(function (value) {
      const numeric = finite(value);
      if (numeric !== null) values.push(numeric);
    });
    const hits = Array.isArray(source.clearNarrowLineHits) && source.clearNarrowLineHits.length
      ? source.clearNarrowLineHits
      : (Array.isArray(source.topHits) ? source.topHits : []);
    hits.forEach(function (hit) {
      [hit && hit.observedNm, hit && hit.referenceNm].forEach(function (value) {
        const numeric = finite(value);
        if (numeric !== null) values.push(numeric);
      });
    });
    const range = finiteRange(values);
    return range ? { min: range.min, max: range.max, basis: 'fluorescence-band-and-accepted-hits' } : null;
  }

  function calibrationCoverageContext(output, diagnostics) {
    const diag = diagnostics || {};
    const frameCoverage = diag.wavelengthCoverageNm && finite(diag.wavelengthCoverageNm.min) !== null && finite(diag.wavelengthCoverageNm.max) !== null
      ? { min: finite(diag.wavelengthCoverageNm.min), max: finite(diag.wavelengthCoverageNm.max) }
      : null;
    const anchorCoverage = diag.anchorWavelengthCoverageNm && finite(diag.anchorWavelengthCoverageNm.min) !== null && finite(diag.anchorWavelengthCoverageNm.max) !== null
      ? { min: finite(diag.anchorWavelengthCoverageNm.min), max: finite(diag.anchorWavelengthCoverageNm.max) }
      : null;
    const relevantCoverage = fluorescenceRelevantCoverage(output);
    const fullFrameExtrapolated = !!(diag.extrapolation && diag.extrapolation.any);
    const analysisRegionExtrapolated = relevantCoverage && anchorCoverage
      ? (relevantCoverage.min < anchorCoverage.min || relevantCoverage.max > anchorCoverage.max)
      : null;
    return {
      frameCoverage: frameCoverage,
      anchorCoverage: anchorCoverage,
      relevantCoverage: relevantCoverage,
      fullFrameExtrapolated: fullFrameExtrapolated,
      analysisRegionExtrapolated: analysisRegionExtrapolated
    };
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
    const coverageContext = calibrationCoverageContext(output, diagnostics);
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
      ? dimension(flags.indexOf('NO_SIGNAL') !== -1 ? 'poor' : 'unavailable', 'snr-unavailable', {
          snr: null,
          noiseSigma: rounded(metrics.noiseSigma, 4),
          signalSpanP95P05: rounded(metrics.signalSpanP95P05, 4),
          snrDefinition: metrics.snrDefinition || 'p95-p05-over-noise-sigma'
        })
      : dimension(snr < 3 ? 'poor' : (snr < 8 ? 'moderate' : 'good'), snr < 3 ? 'low-snr' : (snr < 8 ? 'limited-snr' : 'usable-snr'), {
          snr: rounded(snr, 3),
          noiseSigma: rounded(metrics.noiseSigma, 4),
          signalSpanP95P05: rounded(metrics.signalSpanP95P05, 4),
          snrDefinition: metrics.snrDefinition || 'p95-p05-over-noise-sigma'
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
      const relevantExtrapolationKnown = coverageContext.analysisRegionExtrapolated !== null;
      const resultRegionExtrapolated = relevantExtrapolationKnown
        ? coverageContext.analysisRegionExtrapolated
        : coverageContext.fullFrameExtrapolated;
      if (resultRegionExtrapolated) calibrationStatus = downgrade(calibrationStatus);
      dimensions.calibration = dimension(calibrationStatus,
        resultRegionExtrapolated
          ? (relevantExtrapolationKnown ? 'analysis-region-calibration-extrapolation' : 'calibration-extrapolation')
          : 'calibration-fit-residual', {
          pointCount: diagnostics.pointCount || 0,
          polynomialOrder: diagnostics.polynomialOrder == null ? null : diagnostics.polynomialOrder,
          rmsResidualNm: rounded(calibrationRms, 4),
          maxAbsResidualNm: rounded(diagnostics.maxAbsResidualNm, 4),
          extrapolated: resultRegionExtrapolated,
          fullFrameExtrapolated: coverageContext.fullFrameExtrapolated,
          analysisRegionExtrapolated: coverageContext.analysisRegionExtrapolated,
          analysisCoverageBasis: coverageContext.relevantCoverage ? coverageContext.relevantCoverage.basis : null
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

    const coverage = coverageContext.frameCoverage;
    if (calibrated && coverage) {
      const relevant = coverageContext.relevantCoverage;
      const anchors = coverageContext.anchorCoverage;
      const relevantKnown = !!(relevant && anchors);
      const relevantExtrapolated = relevantKnown ? coverageContext.analysisRegionExtrapolated : null;
      const coverageStatus = relevantKnown
        ? (relevantExtrapolated ? 'poor' : 'good')
        : (coverageContext.fullFrameExtrapolated ? 'poor' : 'good');
      const coverageReason = relevantKnown
        ? (relevantExtrapolated ? 'analysis-region-includes-extrapolation' : 'analysis-region-within-calibration-anchors')
        : (coverageContext.fullFrameExtrapolated ? 'coverage-includes-extrapolation' : 'calibrated-coverage-available');
      dimensions.coverage = dimension(coverageStatus, coverageReason, {
        minNm: rounded(coverage.min, 4),
        maxNm: rounded(coverage.max, 4),
        analysisMinNm: relevant ? rounded(relevant.min, 4) : null,
        analysisMaxNm: relevant ? rounded(relevant.max, 4) : null,
        anchorMinNm: anchors ? rounded(anchors.min, 4) : null,
        anchorMaxNm: anchors ? rounded(anchors.max, 4) : null,
        fullFrameMinNm: rounded(coverage.min, 4),
        fullFrameMaxNm: rounded(coverage.max, 4),
        extrapolated: coverageContext.fullFrameExtrapolated,
        fullFrameExtrapolated: coverageContext.fullFrameExtrapolated,
        analysisRegionExtrapolated: relevantExtrapolated,
        analysisCoverageBasis: relevant ? relevant.basis : null
      });
    } else {
      dimensions.coverage = dimension('unavailable', 'calibrated-coverage-unavailable', {});
    }

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
