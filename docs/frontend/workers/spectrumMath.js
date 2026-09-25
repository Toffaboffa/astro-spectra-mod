(function (root) {
  'use strict';

  function clamp(value, lower, upper) {
    return Math.max(lower, Math.min(upper, value));
  }

  function median(values) {
    const arr = (Array.isArray(values) ? values : [])
      .map(Number)
      .filter(Number.isFinite)
      .sort(function (a, b) { return a - b; });
    if (!arr.length) return null;
    return percentileSorted(arr, 0.5);
  }

  function percentileSorted(sortedValues, q) {
    if (!sortedValues.length) return null;
    const position = clamp(Number(q) || 0, 0, 1) * (sortedValues.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const fraction = position - lower;
    return sortedValues[lower] * (1 - fraction) + sortedValues[upper] * fraction;
  }

  function percentile(values, q) {
    const arr = (Array.isArray(values) ? values : [])
      .map(Number)
      .filter(Number.isFinite)
      .sort(function (a, b) { return a - b; });
    return percentileSorted(arr, q);
  }

  function observedRange(frame, peaks) {
    const values = [];
    if (frame && Array.isArray(frame.nm)) {
      frame.nm.forEach(function (value) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) values.push(numeric);
      });
    }
    if (!values.length && Array.isArray(peaks)) {
      peaks.forEach(function (peak) {
        const numeric = Number(peak && peak.nm);
        if (Number.isFinite(numeric)) values.push(numeric);
      });
    }
    if (!values.length) return { min: 380, max: 900 };
    return { min: Math.min.apply(null, values), max: Math.max.apply(null, values) };
  }

  function observedResolutionNm(peaks) {
    const values = (Array.isArray(peaks) ? peaks : [])
      .map(function (peak) { return Number(peak && peak.nm); })
      .filter(Number.isFinite)
      .sort(function (a, b) { return a - b; });
    if (values.length < 2) return 1.2;
    const differences = [];
    for (let index = 1; index < values.length; index += 1) {
      const difference = values[index] - values[index - 1];
      if (difference > 0.05 && difference < 30) differences.push(difference);
    }
    const middle = median(differences);
    return clamp(Number.isFinite(middle) ? middle : 1.2, 0.4, 6);
  }

  function matchOffsetNm(matches) {
    if (!Array.isArray(matches) || !matches.length) return null;
    const offsets = matches
      .map(function (match) { return Number(match && match.deltaNm); })
      .filter(Number.isFinite);
    if (!offsets.length) return null;
    return median(offsets);
  }

  root.SPECTRA_PRO_spectrumMath = {
    clamp: clamp,
    median: median,
    percentile: percentile,
    observedRange: observedRange,
    observedResolutionNm: observedResolutionNm,
    matchOffsetNm: matchOffsetNm
  };
})(typeof self !== 'undefined' ? self : this);
