(function (root) {
  'use strict';

  const MODEL = 'spectral-feature-v1';
  const math = root.SPECTRA_PRO_spectrumMath;
  if (!math) return;

  function finiteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function sourceValues(frame) {
    if (!frame || typeof frame !== 'object') return [];
    if (Array.isArray(frame.processedI) && frame.processedI.length &&
        (!Array.isArray(frame.I) || frame.processedI.length === frame.I.length)) return frame.processedI;
    return Array.isArray(frame.I) ? frame.I : [];
  }

  function movingAverage(values, radius) {
    const size = values.length;
    const r = Math.max(0, Math.floor(Number(radius) || 0));
    if (!r) return values.slice();
    const output = new Array(size);
    for (let index = 0; index < size; index += 1) {
      let sum = 0;
      let count = 0;
      for (let offset = -r; offset <= r; offset += 1) {
        const value = values[index + offset];
        if (!Number.isFinite(value)) continue;
        sum += value;
        count += 1;
      }
      output[index] = count ? sum / count : 0;
    }
    return output;
  }

  function wavelengthAxis(frame, count) {
    if (!frame || frame.calibrated !== true || !Array.isArray(frame.nm) || frame.nm.length !== count) return null;
    const axis = frame.nm.map(finiteNumber);
    if (axis.some(function (value) { return value === null; })) return null;
    for (let index = 1; index < axis.length; index += 1) {
      if (!(axis[index] > axis[index - 1])) return null;
    }
    return axis;
  }

  function estimateNoise(values) {
    if (values.length < 7) return null;
    const differences = [];
    for (let index = 1; index < values.length; index += 1) {
      const difference = values[index] - values[index - 1];
      if (Number.isFinite(difference)) differences.push(difference);
    }
    const middle = math.median(differences);
    if (!Number.isFinite(middle)) return null;
    const deviations = differences.map(function (difference) { return Math.abs(difference - middle); });
    const mad = math.median(deviations);
    if (!Number.isFinite(mad) || mad <= 0) return null;
    return (mad * 1.4826) / Math.sqrt(2);
  }

  function interpolateCrossing(xs, signal, insideIndex, outsideIndex, level) {
    const inside = signal[insideIndex];
    const outside = signal[outsideIndex];
    const denominator = outside - inside;
    const fraction = Math.abs(denominator) > 1e-12 ? (level - inside) / denominator : 0;
    return xs[insideIndex] + (xs[outsideIndex] - xs[insideIndex]) * math.clamp(fraction, 0, 1);
  }

  function findHalfCrossing(xs, signal, start, direction, level) {
    let index = start;
    while (index + direction >= 0 && index + direction < signal.length) {
      const next = index + direction;
      if (signal[next] <= level) return interpolateCrossing(xs, signal, index, next, level);
      index = next;
    }
    return null;
  }

  function localContinuum(values, index, radius, polarity) {
    const window = values.slice(Math.max(0, index - radius), Math.min(values.length, index + radius + 1));
    return math.percentile(window, polarity === 'absorption' ? 0.8 : 0.2);
  }

  function measureAtIndex(frame, values, smoothed, axis, index, polarity, options, noise) {
    if (!(index >= 0 && index < values.length)) return null;
    const direction = polarity === 'absorption' ? -1 : 1;
    const radius = Math.max(3, Math.min(64, Math.round(Number(options.windowRadiusPx) || 10)));
    const continuum = localContinuum(smoothed, index, radius, polarity);
    if (!Number.isFinite(continuum)) return null;
    const signed = smoothed.map(function (value) { return direction * (value - continuum); });
    const amplitude = signed[index];
    if (!(amplitude > 0)) return null;

    const halfLevel = amplitude * 0.5;
    const positions = axis || values.map(function (_, sampleIndex) { return sampleIndex; });
    const halfLeft = findHalfCrossing(positions, signed, index, -1, halfLevel);
    const halfRight = findHalfCrossing(positions, signed, index, 1, halfLevel);
    const flags = [];
    if (index - radius <= 0 || index + radius >= values.length - 1) flags.push('EDGE_WINDOW_TRUNCATED');
    if (!Number.isFinite(halfLeft) || !Number.isFinite(halfRight)) flags.push('FWHM_UNAVAILABLE');

    let lowerIndex = index;
    let upperIndex = index;
    while (lowerIndex > 0 && signed[lowerIndex - 1] >= halfLevel) lowerIndex -= 1;
    while (upperIndex < signed.length - 1 && signed[upperIndex + 1] >= halfLevel) upperIndex += 1;
    let weightedPosition = 0;
    let totalWeight = 0;
    for (let sample = lowerIndex; sample <= upperIndex; sample += 1) {
      const weight = Math.max(0, signed[sample]);
      weightedPosition += positions[sample] * weight;
      totalWeight += weight;
    }
    const centerPosition = totalWeight > 0 ? weightedPosition / totalWeight : positions[index];

    let equivalentWidth = null;
    if (axis && Math.abs(continuum) > 1e-12) {
      let area = 0;
      const low = Math.max(0, index - radius);
      const high = Math.min(values.length - 1, index + radius);
      for (let sample = low + 1; sample <= high; sample += 1) {
        const leftSignal = direction * (values[sample - 1] - continuum);
        const rightSignal = direction * (values[sample] - continuum);
        area += (axis[sample] - axis[sample - 1]) * (Math.max(0, leftSignal) + Math.max(0, rightSignal)) * 0.5;
      }
      equivalentWidth = direction * area / Math.abs(continuum);
    } else if (axis) {
      flags.push('CONTINUUM_NONPOSITIVE');
    }

    const sampling = axis && axis.length > 1
      ? math.median(axis.slice(1).map(function (value, sample) { return value - axis[sample]; }))
      : 1;
    const snr = Number.isFinite(noise) && noise > 0 ? amplitude / noise : null;
    if (Number.isFinite(snr) && snr < 3) flags.push('LOW_SNR');
    const centerUncertainty = Number.isFinite(sampling)
      ? Math.abs(sampling) * (Number.isFinite(snr) && snr > 0 ? math.clamp(0.5 / Math.sqrt(snr), 0.1, 1) : 0.5)
      : null;

    return {
      model: MODEL,
      sampleIndex: index,
      sampleNm: axis ? axis[index] : null,
      centerIndex: axis ? null : +centerPosition.toFixed(4),
      centerNm: axis ? +centerPosition.toFixed(4) : null,
      centerUncertaintyNm: axis && Number.isFinite(centerUncertainty) ? +centerUncertainty.toFixed(4) : null,
      polarity: polarity,
      amplitude: +amplitude.toFixed(6),
      depth: polarity === 'absorption' ? +amplitude.toFixed(6) : null,
      prominence: +amplitude.toFixed(6),
      fwhmNm: axis && Number.isFinite(halfLeft) && Number.isFinite(halfRight) ? +(halfRight - halfLeft).toFixed(4) : null,
      fwhmSamples: !axis && Number.isFinite(halfLeft) && Number.isFinite(halfRight) ? +(halfRight - halfLeft).toFixed(4) : null,
      equivalentWidthNm: Number.isFinite(equivalentWidth) ? +equivalentWidth.toFixed(6) : null,
      localContinuum: +continuum.toFixed(6),
      snr: Number.isFinite(snr) ? +snr.toFixed(3) : null,
      qualityFlags: flags,
      quality: flags.length ? 'limited' : 'good'
    };
  }

  function markPossibleBlends(features) {
    for (let left = 0; left < features.length; left += 1) {
      for (let right = left + 1; right < features.length; right += 1) {
        if (features[left].polarity !== features[right].polarity) continue;
        const a = Number(features[left].centerNm != null ? features[left].centerNm : features[left].centerIndex);
        const b = Number(features[right].centerNm != null ? features[right].centerNm : features[right].centerIndex);
        const widthA = Number(features[left].fwhmNm != null ? features[left].fwhmNm : features[left].fwhmSamples);
        const widthB = Number(features[right].fwhmNm != null ? features[right].fwhmNm : features[right].fwhmSamples);
        if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(widthA) || !Number.isFinite(widthB)) continue;
        if (Math.abs(a - b) < (widthA + widthB) * 0.6) {
          if (features[left].qualityFlags.indexOf('POSSIBLE_BLEND') === -1) features[left].qualityFlags.push('POSSIBLE_BLEND');
          if (features[right].qualityFlags.indexOf('POSSIBLE_BLEND') === -1) features[right].qualityFlags.push('POSSIBLE_BLEND');
          features[left].quality = 'limited';
          features[right].quality = 'limited';
        }
      }
    }
    return features;
  }

  function prepare(frame, options) {
    const source = sourceValues(frame);
    const values = source.map(function (value) { return Number(value); });
    if (values.length < 3 || values.some(function (value) { return !Number.isFinite(value); })) return null;
    const opts = Object.assign({ smoothingRadiusPx: 1, windowRadiusPx: 10 }, options || {});
    return {
      values: values,
      smoothed: movingAverage(values, opts.smoothingRadiusPx),
      axis: wavelengthAxis(frame, values.length),
      noise: estimateNoise(values),
      options: opts
    };
  }

  function measureFeatures(frame, candidates, options) {
    const prepared = prepare(frame, options);
    if (!prepared) return [];
    const polarity = String(options && options.polarity || 'emission') === 'absorption' ? 'absorption' : 'emission';
    const seen = Object.create(null);
    const output = [];
    (Array.isArray(candidates) ? candidates : []).forEach(function (candidate) {
      const index = Math.round(Number(candidate && candidate.index));
      if (!Number.isInteger(index) || seen[index]) return;
      seen[index] = true;
      const feature = measureAtIndex(frame, prepared.values, prepared.smoothed, prepared.axis, index, polarity, prepared.options, prepared.noise);
      if (feature) output.push(feature);
    });
    return markPossibleBlends(output.sort(function (a, b) { return a.sampleIndex - b.sampleIndex; }));
  }

  function detectFeatures(frame, options) {
    const prepared = prepare(frame, options);
    if (!prepared) return [];
    const requested = String(options && options.polarity || 'both').toLowerCase();
    const polarities = requested === 'emission' || requested === 'absorption' ? [requested] : ['emission', 'absorption'];
    const range = Math.max.apply(null, prepared.smoothed) - Math.min.apply(null, prepared.smoothed);
    const minimumProminence = Math.max(Number(options && options.minProminence) || 0, range * (Number(options && options.minProminenceRel) || 0.03));
    const minimumDistance = Math.max(1, Math.round(Number(options && options.minDistancePx) || 2));
    const output = [];

    polarities.forEach(function (polarity) {
      const direction = polarity === 'absorption' ? -1 : 1;
      const candidates = [];
      for (let index = 1; index < prepared.smoothed.length - 1; index += 1) {
        const previous = direction * prepared.smoothed[index - 1];
        const current = direction * prepared.smoothed[index];
        const next = direction * prepared.smoothed[index + 1];
        if (!(current > previous && current >= next)) continue;
        const continuum = localContinuum(prepared.smoothed, index, prepared.options.windowRadiusPx, polarity);
        const prominence = direction * (prepared.smoothed[index] - continuum);
        if (prominence >= minimumProminence) candidates.push({ index: index, prominence: prominence });
      }
      candidates.sort(function (a, b) { return b.prominence - a.prominence; });
      const accepted = [];
      candidates.forEach(function (candidate) {
        if (accepted.some(function (kept) { return Math.abs(kept.index - candidate.index) < minimumDistance; })) return;
        accepted.push(candidate);
      });
      accepted.forEach(function (candidate) {
        const feature = measureAtIndex(frame, prepared.values, prepared.smoothed, prepared.axis, candidate.index, polarity, prepared.options, prepared.noise);
        if (feature) output.push(feature);
      });
    });

    return markPossibleBlends(output.sort(function (a, b) { return a.sampleIndex - b.sampleIndex; }));
  }

  root.SPECTRA_PRO_spectralFeatures = {
    model: MODEL,
    equivalentWidthConvention: 'positive-emission-negative-absorption',
    detectFeatures: detectFeatures,
    measureFeatures: measureFeatures
  };
})(typeof self !== 'undefined' ? self : this);
