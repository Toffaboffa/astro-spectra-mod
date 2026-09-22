(function (root) {
  'use strict';

  const MODEL = 'relativistic-radial-velocity-v1';
  const SPEED_OF_LIGHT_KM_S = 299792.458;

  function finite(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function median(values) {
    const clean = (Array.isArray(values) ? values : []).map(finite).filter(function (value) { return value !== null; }).sort(function (a, b) { return a - b; });
    if (!clean.length) return null;
    const middle = Math.floor(clean.length / 2);
    return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
  }

  function velocityFromWavelengths(observedNm, referenceNm) {
    const observed = finite(observedNm);
    const reference = finite(referenceNm);
    if (observed === null || reference === null || observed <= 0 || reference <= 0) return null;
    const ratio = observed / reference;
    const ratioSquared = ratio * ratio;
    return SPEED_OF_LIGHT_KM_S * ((ratioSquared - 1) / (ratioSquared + 1));
  }

  function velocityUncertainty(observedNm, referenceNm, wavelengthUncertaintyNm) {
    const observed = finite(observedNm);
    const reference = finite(referenceNm);
    const sigmaNm = finite(wavelengthUncertaintyNm);
    if (observed === null || reference === null || sigmaNm === null || observed <= 0 || reference <= 0 || sigmaNm <= 0) return null;
    const ratio = observed / reference;
    const derivative = SPEED_OF_LIGHT_KM_S * (4 * ratio / Math.pow(ratio * ratio + 1, 2)) / reference;
    return Math.abs(derivative) * sigmaNm;
  }

  function perLineSigmaNm(match, uncertaintyModel) {
    const direct = finite(match && match.matchUncertaintyNm);
    const model = uncertaintyModel || {};
    const components = model.componentsNm || {};
    const featureSigma = finite(match && match.centerUncertaintyNm);
    const values = [
      finite(components.calibrationRms),
      finite(components.sampling),
      finite(components.instrument),
      featureSigma !== null ? featureSigma : finite(components.featureCenter)
    ].filter(function (value) { return value !== null && value >= 0; });
    if (values.length) return Math.sqrt(values.reduce(function (sum, value) { return sum + value * value; }, 0));
    return direct !== null && direct > 0 ? direct : finite(model.combinedUncertaintyNm);
  }

  function qualityForLine(sigmaVelocity, featureQuality) {
    let quality = sigmaVelocity <= 50 ? 'good' : (sigmaVelocity <= 200 ? 'moderate' : 'poor');
    if (featureQuality === 'limited') quality = quality === 'good' ? 'moderate' : 'poor';
    return quality;
  }

  function roundedForUncertainty(value, uncertainty) {
    if (!Number.isFinite(value)) return null;
    const sigma = Math.abs(Number(uncertainty));
    const digits = sigma >= 100 ? 0 : (sigma >= 1 ? 1 : 2);
    return +value.toFixed(digits);
  }

  function baseResult(state, lines, limitations) {
    const usedCount = lines.filter(function (line) { return line.included; }).length;
    return {
      model: MODEL,
      state: state,
      equation: 'beta=((lambdaObserved/lambdaReference)^2-1)/((lambdaObserved/lambdaReference)^2+1); v=c*beta',
      signConvention: 'positive-redshift-receding; negative-blueshift-approaching',
      speedOfLightKmS: SPEED_OF_LIGHT_KM_S,
      velocityKmS: null,
      uncertaintyKmS: null,
      quality: 'unavailable',
      lineCountTotal: lines.length,
      lineCountUsed: usedCount,
      excludedLineCount: lines.length - usedCount,
      minimumLines: 2,
      lines: lines,
      outlierMethod: 'median-MAD-with-uncertainty-floor',
      corrections: { barycentric: false, heliocentric: false },
      limitations: limitations
    };
  }

  function estimate(matches, context) {
    const input = Array.isArray(matches) ? matches : [];
    const ctx = context && typeof context === 'object' ? context : {};
    const uncertaintyModel = ctx.matchUncertaintyModel || {};
    const calibration = ctx.calibrationDiagnostics || {};
    const groups = Object.create(null);
    input.forEach(function (match, index) {
      const peakIndex = finite(match && match.peakIndex);
      const key = peakIndex === null ? 'row-' + index : 'peak-' + peakIndex;
      (groups[key] || (groups[key] = [])).push(match);
    });

    const lines = [];
    Object.keys(groups).forEach(function (key) {
      const group = groups[key];
      if (group.length > 1) {
        group.forEach(function (match) {
          lines.push(Object.assign({}, match, {
            wavelengthShiftNm: finite(match.observedNm) !== null && finite(match.referenceNm) !== null ? +(Number(match.observedNm) - Number(match.referenceNm)).toFixed(6) : null,
            velocityKmS: velocityFromWavelengths(match.observedNm, match.referenceNm),
            uncertaintyKmS: null,
            quality: 'poor',
            included: false,
            exclusionReason: 'ambiguous-reference-for-shared-feature'
          }));
        });
        return;
      }
      const match = group[0] || {};
      const observed = finite(match.observedNm);
      const reference = finite(match.referenceNm);
      const sigmaNm = perLineSigmaNm(match, uncertaintyModel);
      const velocity = velocityFromWavelengths(observed, reference);
      const sigmaVelocity = velocityUncertainty(observed, reference, sigmaNm);
      const flags = Array.isArray(match.featureQualityFlags) ? match.featureQualityFlags : [];
      const unreliableFlag = flags.find(function (flag) {
        return flag === 'EDGE_WINDOW_TRUNCATED' || flag === 'FWHM_UNAVAILABLE' || flag === 'POSSIBLE_BLEND';
      }) || null;
      const valid = velocity !== null && sigmaVelocity !== null && sigmaVelocity > 0 && !unreliableFlag;
      lines.push(Object.assign({}, match, {
        wavelengthShiftNm: observed !== null && reference !== null ? +(observed - reference).toFixed(6) : null,
        wavelengthUncertaintyNm: sigmaNm === null ? null : +sigmaNm.toFixed(6),
        velocityKmS: velocity === null ? null : roundedForUncertainty(velocity, sigmaVelocity),
        uncertaintyKmS: sigmaVelocity === null ? null : roundedForUncertainty(sigmaVelocity, sigmaVelocity),
        quality: sigmaVelocity === null ? 'unavailable' : qualityForLine(sigmaVelocity, match.featureQuality),
        included: valid,
        exclusionReason: valid ? null : (unreliableFlag ? 'unreliable-feature-' + unreliableFlag.toLowerCase() : 'velocity-uncertainty-unavailable')
      }));
    });

    const limitations = [
      'no-barycentric-or-heliocentric-correction',
      'result-is-limited-by-wavelength-calibration-and-instrument-resolution',
      'reference-wavelength-medium-must-match-calibration-convention'
    ];
    let eligible = lines.filter(function (line) { return line.included; });
    if (eligible.length < 2) return baseResult(eligible.length ? 'insufficient-lines' : 'unavailable', lines, limitations);

    const center = median(eligible.map(function (line) { return line.velocityKmS; }));
    const deviations = eligible.map(function (line) { return Math.abs(line.velocityKmS - center); });
    const mad = median(deviations) || 0;
    const robustSigma = 1.4826 * mad;
    const medianUncertainty = median(eligible.map(function (line) { return line.uncertaintyKmS; })) || 0;
    const outlierThreshold = Math.max(30, 3 * robustSigma, 2.5 * medianUncertainty);
    eligible.forEach(function (line) {
      if (Math.abs(line.velocityKmS - center) > outlierThreshold) {
        line.included = false;
        line.exclusionReason = 'velocity-outlier';
      }
    });
    eligible = lines.filter(function (line) { return line.included; });
    if (eligible.length < 2) return baseResult('insufficient-lines', lines, limitations);

    let sumWeight = 0;
    let weightedVelocity = 0;
    eligible.forEach(function (line) {
      const weight = 1 / Math.pow(line.uncertaintyKmS, 2);
      sumWeight += weight;
      weightedVelocity += weight * line.velocityKmS;
    });
    const velocity = weightedVelocity / sumWeight;
    const formalUncertainty = Math.sqrt(1 / sumWeight);
    const weightedScatter = Math.sqrt(eligible.reduce(function (sum, line) {
      const weight = 1 / Math.pow(line.uncertaintyKmS, 2);
      return sum + weight * Math.pow(line.velocityKmS - velocity, 2);
    }, 0) / sumWeight);
    const scatterUncertainty = weightedScatter / Math.sqrt(eligible.length);
    const calibrationRms = finite(calibration.rmsResidualNm);
    const representativeWavelength = median(eligible.map(function (line) { return line.referenceNm; }));
    const calibrationFloor = calibrationRms !== null && representativeWavelength
      ? velocityUncertainty(representativeWavelength, representativeWavelength, calibrationRms)
      : 0;
    const uncertainty = Math.max(formalUncertainty, scatterUncertainty, calibrationFloor || 0);
    const quality = uncertainty <= 50 ? 'good' : (uncertainty <= 200 ? 'moderate' : 'poor');

    return {
      model: MODEL,
      state: 'available',
      equation: 'beta=((lambdaObserved/lambdaReference)^2-1)/((lambdaObserved/lambdaReference)^2+1); v=c*beta',
      signConvention: 'positive-redshift-receding; negative-blueshift-approaching',
      speedOfLightKmS: SPEED_OF_LIGHT_KM_S,
      velocityKmS: roundedForUncertainty(velocity, uncertainty),
      uncertaintyKmS: roundedForUncertainty(uncertainty, uncertainty),
      quality: quality,
      lineCountTotal: lines.length,
      lineCountUsed: eligible.length,
      excludedLineCount: lines.length - eligible.length,
      minimumLines: 2,
      lines: lines,
      outlierMethod: 'median-MAD-with-uncertainty-floor',
      outlierCenterKmS: roundedForUncertainty(center, uncertainty),
      outlierThresholdKmS: roundedForUncertainty(outlierThreshold, uncertainty),
      uncertaintyComponentsKmS: {
        formal: roundedForUncertainty(formalUncertainty, uncertainty),
        scatter: roundedForUncertainty(scatterUncertainty, uncertainty),
        calibrationFloor: roundedForUncertainty(Number(calibrationFloor || 0), uncertainty)
      },
      corrections: { barycentric: false, heliocentric: false },
      limitations: limitations
    };
  }

  root.SPECTRA_PRO_dopplerEstimate = {
    model: MODEL,
    speedOfLightKmS: SPEED_OF_LIGHT_KM_S,
    velocityFromWavelengths: velocityFromWavelengths,
    velocityUncertainty: velocityUncertainty,
    estimate: estimate
  };
})(typeof self !== 'undefined' ? self : this);
