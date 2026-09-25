(function (root) {
  'use strict';

  const MODEL = 'calibration-match-uncertainty-v1';
  const math = root.SPECTRA_PRO_spectrumMath;
  if (!math) return;

  function finite(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function evaluatePolynomial(coefficients, pixel) {
    if (!Array.isArray(coefficients) || !coefficients.length || !Number.isFinite(pixel)) return null;
    let wavelength = 0;
    for (let order = 0; order < coefficients.length; order += 1) {
      const coefficient = finite(coefficients[order]);
      if (coefficient === null) return null;
      wavelength += coefficient * Math.pow(pixel, order);
    }
    return Number.isFinite(wavelength) ? wavelength : null;
  }

  function finiteRange(values) {
    const clean = (Array.isArray(values) ? values : []).map(finite).filter(function (value) { return value !== null; });
    return clean.length ? { min: Math.min.apply(null, clean), max: Math.max.apply(null, clean) } : null;
  }

  function samplingNmPerPixel(frame) {
    const nm = frame && Array.isArray(frame.nm) ? frame.nm.map(finite) : [];
    if (nm.length < 2 || nm.some(function (value) { return value === null; })) return null;
    const differences = [];
    for (let index = 1; index < nm.length; index += 1) {
      const difference = Math.abs(nm[index] - nm[index - 1]);
      if (difference > 0) differences.push(difference);
    }
    return math.median(differences);
  }

  function framePixelRange(frame) {
    const count = frame && Array.isArray(frame.I) ? frame.I.length : 0;
    if (!count) return null;
    const px = Array.isArray(frame.px) && frame.px.length === count
      ? frame.px.map(finite)
      : Array.from({ length: count }, function (_, index) { return index; });
    if (px.some(function (value) { return value === null; })) return null;
    return finiteRange(px);
  }

  function evaluate(calibration, frame) {
    const source = calibration && typeof calibration === 'object' ? calibration : {};
    const rawCoefficients = (Array.isArray(source.coefficients) ? source.coefficients : []).map(finite);
    const coefficients = rawCoefficients.length && rawCoefficients.every(function (value) { return value !== null; })
      ? rawCoefficients
      : [];
    const points = (Array.isArray(source.points) ? source.points : []).map(function (point) {
      const px = finite(point && point.px);
      const wavelength = finite(point && point.nm);
      if (px === null || wavelength === null) return null;
      const fitted = evaluatePolynomial(coefficients, px);
      const residual = fitted === null ? null : fitted - wavelength;
      return {
        px: px,
        nm: wavelength,
        fittedNm: fitted === null ? null : +fitted.toFixed(6),
        residualNm: residual === null ? null : +residual.toFixed(6)
      };
    }).filter(Boolean);
    const residuals = points.map(function (point) { return point.residualNm; }).filter(Number.isFinite);
    const rms = residuals.length
      ? Math.sqrt(residuals.reduce(function (sum, residual) { return sum + residual * residual; }, 0) / residuals.length)
      : null;
    const maximumResidual = residuals.length
      ? Math.max.apply(null, residuals.map(function (residual) { return Math.abs(residual); }))
      : null;
    const wavelengthCoverage = finiteRange(frame && frame.nm);
    const anchorPixelCoverage = finiteRange(points.map(function (point) { return point.px; }));
    const anchorWavelengthCoverage = finiteRange(points.map(function (point) { return point.nm; }));
    const pixels = framePixelRange(frame);
    const extrapolatedLeft = !!(pixels && anchorPixelCoverage && pixels.min < anchorPixelCoverage.min);
    const extrapolatedRight = !!(pixels && anchorPixelCoverage && pixels.max > anchorPixelCoverage.max);

    return {
      model: MODEL,
      available: coefficients.length > 0 && points.length > 0,
      pointCount: points.length,
      polynomialOrder: coefficients.length ? coefficients.length - 1 : null,
      coefficients: coefficients,
      points: points,
      rmsResidualNm: Number.isFinite(rms) ? +rms.toFixed(6) : null,
      maxAbsResidualNm: Number.isFinite(maximumResidual) ? +maximumResidual.toFixed(6) : null,
      wavelengthCoverageNm: wavelengthCoverage,
      anchorPixelCoverage: anchorPixelCoverage,
      anchorWavelengthCoverageNm: anchorWavelengthCoverage,
      samplingNmPerPixel: finite(samplingNmPerPixel(frame)),
      extrapolation: {
        any: extrapolatedLeft || extrapolatedRight,
        left: extrapolatedLeft,
        right: extrapolatedRight
      }
    };
  }

  function medianFeatureUncertainty(features) {
    return math.median((Array.isArray(features) ? features : []).map(function (feature) {
      return finite(feature && feature.centerUncertaintyNm);
    }).filter(function (value) { return value !== null && value >= 0; }));
  }

  function createMatchingModel(diagnostics, hardware, features, hardCapNm, fallbackToleranceNm) {
    const diag = diagnostics || {};
    const hw = hardware && typeof hardware === 'object' ? hardware : {};
    const hardCap = Math.max(0.2, finite(hardCapNm) || 5);
    const fallback = Math.max(0.2, finite(fallbackToleranceNm) || hardCap);
    const calibrationSigma = finite(diag.rmsResidualNm);
    const measuredSampling = finite(diag.samplingNmPerPixel);
    const declaredSampling = finite(hw.pixelResolutionNm);
    const sampling = measuredSampling !== null && measuredSampling > 0 ? measuredSampling : declaredSampling;
    const samplingSigma = sampling !== null && sampling > 0 ? sampling / Math.sqrt(12) : null;
    const instrumentFwhm = finite(hw.spectrometerResolutionFwhmNm);
    const instrumentSigma = instrumentFwhm !== null && instrumentFwhm > 0 ? instrumentFwhm / 2.355 : null;
    const featureSigma = medianFeatureUncertainty(features);
    const components = [calibrationSigma, samplingSigma, instrumentSigma, featureSigma]
      .filter(function (value) { return value !== null && value >= 0; });
    const combinedSigma = components.length
      ? Math.sqrt(components.reduce(function (sum, value) { return sum + value * value; }, 0))
      : null;
    const uncertaintyTolerance = combinedSigma !== null ? Math.max(0.2, combinedSigma * 3) : fallback;
    const effectiveTolerance = Math.min(hardCap, fallback, uncertaintyTolerance);
    const resolutionScale = Math.max(0.05, instrumentSigma || sampling || featureSigma || fallback / 3);
    const calibrationConfidenceFactor = calibrationSigma !== null
      ? math.clamp(resolutionScale / (resolutionScale + calibrationSigma), 0.35, 1)
      : 1;

    return {
      model: MODEL,
      sigmaMultiplier: 3,
      combinedUncertaintyNm: combinedSigma === null ? null : +combinedSigma.toFixed(6),
      effectiveToleranceNm: +effectiveTolerance.toFixed(6),
      hardCapNm: +hardCap.toFixed(6),
      calibrationConfidenceFactor: +math.clamp(calibrationConfidenceFactor, 0, 1).toFixed(4),
      componentsNm: {
        calibrationRms: calibrationSigma,
        sampling: samplingSigma,
        instrument: instrumentSigma,
        featureCenter: featureSigma
      }
    };
  }

  function isExtrapolated(peakIndex, diagnostics, frame) {
    const coverage = diagnostics && diagnostics.anchorPixelCoverage;
    if (!coverage || !Number.isFinite(Number(peakIndex))) return false;
    const index = Math.round(Number(peakIndex));
    const pixel = frame && Array.isArray(frame.px) && Number.isFinite(Number(frame.px[index]))
      ? Number(frame.px[index])
      : index;
    return pixel < coverage.min || pixel > coverage.max;
  }

  function annotateHit(hit, model, diagnostics, frame) {
    const output = Object.assign({}, hit || {});
    const delta = Math.abs(Number(output.deltaNm));
    const sigma = finite(model && model.combinedUncertaintyNm);
    const tolerance = finite(model && model.effectiveToleranceNm);
    const extrapolated = isExtrapolated(output.peakIndex, diagnostics, frame);
    let quality = 'unavailable';
    if (Number.isFinite(delta) && sigma !== null && sigma > 0) {
      quality = delta <= sigma ? 'good' : (delta <= sigma * 2 ? 'moderate' : 'poor');
    } else if (Number.isFinite(delta) && tolerance !== null) {
      quality = delta <= tolerance * 0.5 ? 'good' : 'poor';
    }
    let factor = finite(model && model.calibrationConfidenceFactor);
    if (factor === null) factor = 1;
    if (extrapolated) factor *= 0.8;
    if (Number.isFinite(Number(output.confidence))) output.confidence = +(Number(output.confidence) * factor).toFixed(3);
    output.effectiveToleranceNm = tolerance;
    output.matchUncertaintyNm = sigma;
    output.matchQuality = quality;
    output.extrapolated = extrapolated;
    return output;
  }

  root.SPECTRA_PRO_calibrationDiagnostics = {
    model: MODEL,
    evaluatePolynomial: evaluatePolynomial,
    evaluate: evaluate,
    createMatchingModel: createMatchingModel,
    annotateHit: annotateHit
  };
})(typeof self !== 'undefined' ? self : this);
