(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};
  const PROFILE_SCHEMA = 'spectra-pro-response-profile/v1';

  function median(values) {
    const sorted = values.slice().sort(function (a, b) { return a - b; });
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function validateProfile(profile) {
    if (!profile || typeof profile !== 'object') return { valid: false, reason: 'profile-unavailable' };
    if (profile.schema !== PROFILE_SCHEMA) return { valid: false, reason: 'unsupported-profile-schema' };
    const wavelengths = Array.isArray(profile.wavelengthsNm) ? profile.wavelengthsNm.map(Number) : [];
    const response = Array.isArray(profile.relativeResponse) ? profile.relativeResponse.map(Number) : [];
    if (wavelengths.length < 3 || wavelengths.length !== response.length) return { valid: false, reason: 'invalid-profile-length' };
    for (let index = 0; index < wavelengths.length; index += 1) {
      if (!Number.isFinite(wavelengths[index]) || !Number.isFinite(response[index]) || !(response[index] > 0)) return { valid: false, reason: 'invalid-profile-values' };
      if (index && !(wavelengths[index] > wavelengths[index - 1])) return { valid: false, reason: 'non-monotonic-profile-axis' };
    }
    const applicable = Array.isArray(profile.applicableHardwareProfileIds) ? profile.applicableHardwareProfileIds.map(String).filter(Boolean) : [];
    return {
      valid: true,
      reason: null,
      profileId: String(profile.id || ''),
      label: String(profile.label || profile.id || 'Response profile'),
      source: String(profile.source || 'unspecified'),
      wavelengthMedium: String(profile.wavelengthMedium || 'unspecified'),
      coverageNm: { min: wavelengths[0], max: wavelengths[wavelengths.length - 1] },
      sampleCount: wavelengths.length,
      applicableHardwareProfileIds: applicable
    };
  }

  function interpolate(x, wavelengths, response) {
    if (x < wavelengths[0] || x > wavelengths[wavelengths.length - 1]) return null;
    let lo = 0;
    let hi = wavelengths.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (wavelengths[mid] <= x) lo = mid;
      else hi = mid;
    }
    if (wavelengths[lo] === x) return response[lo];
    const span = wavelengths[hi] - wavelengths[lo];
    if (!(span > 0)) return null;
    const ratio = (x - wavelengths[lo]) / span;
    return response[lo] + ratio * (response[hi] - response[lo]);
  }

  function unavailable(source, reason, validation, extra) {
    return Object.assign({
      values: source.slice(), applied: false, status: 'unavailable', reason: reason,
      profile: validation && validation.valid ? validation : null,
      intensityBasis: 'uncorrected-relative-intensity', warnings: [reason]
    }, extra || {});
  }

  function prepare(values, wavelengthsInput, configInput) {
    const source = Array.isArray(values) ? values.map(function (value) {
      const numeric = Number(value);
      return Number.isFinite(numeric) ? numeric : 0;
    }) : [];
    let wavelengths = wavelengthsInput;
    let opts = configInput;
    // Preserve the legacy two-argument validation interface.
    if (!Array.isArray(wavelengthsInput) && configInput === undefined) {
      opts = wavelengthsInput;
      wavelengths = opts && opts.wavelengthsNm;
    }
    opts = opts && typeof opts === 'object' ? opts : {};
    if (!opts.enabled) {
      return {
        values: source, applied: false, status: 'disabled', reason: 'response-correction-disabled', profile: null,
        intensityBasis: 'uncorrected-relative-intensity', warnings: []
      };
    }
    const validation = validateProfile(opts.profile);
    if (!validation.valid) return unavailable(source, validation.reason, validation);
    const inputMode = String(opts.inputMode || 'raw').toLowerCase();
    if (['ratio', 'transmittance', 'absorbance'].indexOf(inputMode) !== -1) {
      return unavailable(source, 'response-correction-incompatible-with-reference-transform', validation, { inputMode: inputMode });
    }
    if (!Array.isArray(wavelengths) || wavelengths.length !== source.length || source.length < 3 || !wavelengths.every(function (value) { return Number.isFinite(Number(value)); })) {
      return unavailable(source, 'calibrated-wavelength-axis-required', validation);
    }
    const hardwareId = String(opts.hardwareProfileId || '');
    if (validation.applicableHardwareProfileIds.length && validation.applicableHardwareProfileIds.indexOf(hardwareId) === -1) {
      return unavailable(source, 'response-profile-hardware-mismatch', validation, { hardwareProfileId: hardwareId || null });
    }
    const axis = wavelengths.map(Number);
    const frameMin = Math.min.apply(null, axis);
    const frameMax = Math.max.apply(null, axis);
    if (frameMin < validation.coverageNm.min || frameMax > validation.coverageNm.max) {
      return unavailable(source, 'response-profile-does-not-cover-frame', validation, {
        frameCoverageNm: { min: frameMin, max: frameMax },
        extrapolatedSampleCount: axis.filter(function (nm) { return nm < validation.coverageNm.min || nm > validation.coverageNm.max; }).length
      });
    }
    const profileWavelengths = opts.profile.wavelengthsNm.map(Number);
    const profileResponse = opts.profile.relativeResponse.map(Number);
    const sampledResponse = axis.map(function (nm) { return interpolate(nm, profileWavelengths, profileResponse); });
    if (sampledResponse.some(function (value) { return !Number.isFinite(value) || !(value > 0); })) return unavailable(source, 'response-interpolation-failed', validation);
    const normalizationResponse = median(sampledResponse);
    if (!(normalizationResponse > 0)) return unavailable(source, 'invalid-response-normalization', validation);
    const maxCorrectionFactor = Math.max(1, Math.min(20, Number(opts.maxCorrectionFactor) || 5));
    let clampedSampleCount = 0;
    const correctionFactors = sampledResponse.map(function (response) {
      const rawFactor = normalizationResponse / response;
      if (rawFactor > maxCorrectionFactor) {
        clampedSampleCount += 1;
        return maxCorrectionFactor;
      }
      return rawFactor;
    });
    const corrected = source.map(function (value, index) { return value * correctionFactors[index]; });
    return {
      values: corrected, applied: true, status: 'applied', reason: null, profile: validation,
      intensityBasis: 'response-corrected-relative-intensity', normalizationResponse: normalizationResponse,
      maxCorrectionFactor: maxCorrectionFactor, clampedSampleCount: clampedSampleCount, extrapolatedSampleCount: 0,
      correctionFactorRange: { min: Math.min.apply(null, correctionFactors), max: Math.max.apply(null, correctionFactors) },
      warnings: clampedSampleCount ? ['response-amplification-limited'] : []
    };
  }

  sp.instrumentResponse = { profileSchema: PROFILE_SCHEMA, validateProfile: validateProfile, prepare: prepare };
})(window);
