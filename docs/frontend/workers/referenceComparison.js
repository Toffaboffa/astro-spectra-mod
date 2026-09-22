(function (root) {
  'use strict';

  function finiteArray(values) {
    return Array.isArray(values) && values.length >= 3 && values.every(function (value) {
      return Number.isFinite(Number(value));
    });
  }

  function orderedPairs(wavelengths, intensities) {
    const pairs = wavelengths.map(function (nm, index) {
      return { nm: Number(nm), intensity: Number(intensities[index]) };
    }).filter(function (item) {
      return Number.isFinite(item.nm) && Number.isFinite(item.intensity);
    }).sort(function (a, b) { return a.nm - b.nm; });
    return {
      nm: pairs.map(function (item) { return item.nm; }),
      intensity: pairs.map(function (item) { return item.intensity; })
    };
  }

  function interpolate(x, sourceX, sourceY) {
    if (x < sourceX[0] || x > sourceX[sourceX.length - 1]) return null;
    let lo = 0;
    let hi = sourceX.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (sourceX[mid] <= x) lo = mid;
      else hi = mid;
    }
    if (sourceX[lo] === x || lo === hi) return sourceY[lo];
    const span = sourceX[hi] - sourceX[lo];
    if (!(span > 0)) return sourceY[lo];
    const ratio = (x - sourceX[lo]) / span;
    return sourceY[lo] + ratio * (sourceY[hi] - sourceY[lo]);
  }

  function medianSpacing(values) {
    const steps = [];
    for (let index = 1; index < values.length; index += 1) {
      const step = values[index] - values[index - 1];
      if (step > 0 && Number.isFinite(step)) steps.push(step);
    }
    if (!steps.length) return null;
    steps.sort(function (a, b) { return a - b; });
    const middle = Math.floor(steps.length / 2);
    return steps.length % 2 ? steps[middle] : (steps[middle - 1] + steps[middle]) / 2;
  }

  function lineTemplate(wavelengths, lines, widthNm, shiftNm) {
    const sigma = Math.max(0.01, Number(widthNm) / 2.354820045);
    return wavelengths.map(function (nm) {
      let value = 0;
      lines.forEach(function (line) {
        const center = Number(line.nm) + shiftNm;
        const weight = Number.isFinite(Number(line.weight)) ? Number(line.weight) : 1;
        value += weight * Math.exp(-0.5 * Math.pow((nm - center) / sigma, 2));
      });
      return value;
    });
  }

  function sampleReference(reference, wavelengths, shiftNm, options) {
    if (reference.kind === 'line-list' && Array.isArray(reference.lines)) {
      const hardwareWidth = Number(options && options.resolutionFwhmNm);
      const configuredWidth = Number(reference.defaultFwhmNm);
      const spacing = medianSpacing(wavelengths) || 0.2;
      const width = Number.isFinite(hardwareWidth) && hardwareWidth > 0
        ? hardwareWidth
        : (Number.isFinite(configuredWidth) && configuredWidth > 0 ? configuredWidth : Math.max(0.4, spacing * 2));
      return lineTemplate(wavelengths, reference.lines, width, shiftNm);
    }
    const sourceNm = reference.wavelengthNm;
    const sourceI = reference.intensity;
    return wavelengths.map(function (nm) {
      return interpolate(nm - shiftNm, sourceNm, sourceI);
    });
  }

  function pairedValues(measured, reference) {
    const left = [];
    const right = [];
    const indices = [];
    for (let index = 0; index < measured.length; index += 1) {
      const a = Number(measured[index]);
      const b = reference[index];
      if (Number.isFinite(a) && Number.isFinite(b)) {
        left.push(a);
        right.push(Number(b));
        indices.push(index);
      }
    }
    return { measured: left, reference: right, indices: indices };
  }

  function normalize(values, mode) {
    if (!values.length) return [];
    const selected = String(mode || 'min-max').toLowerCase();
    if (selected === 'none') return values.slice();
    if (selected === 'area') {
      const sum = values.reduce(function (total, value) { return total + Math.abs(value); }, 0);
      return sum > 0 ? values.map(function (value) { return value / sum; }) : values.map(function () { return 0; });
    }
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const span = max - min;
    return span > 0 ? values.map(function (value) { return (value - min) / span; }) : values.map(function () { return 0; });
  }

  function correlation(a, b) {
    if (a.length < 3 || a.length !== b.length) return null;
    const meanA = a.reduce(function (sum, value) { return sum + value; }, 0) / a.length;
    const meanB = b.reduce(function (sum, value) { return sum + value; }, 0) / b.length;
    let covariance = 0;
    let varianceA = 0;
    let varianceB = 0;
    for (let index = 0; index < a.length; index += 1) {
      const da = a[index] - meanA;
      const db = b[index] - meanB;
      covariance += da * db;
      varianceA += da * da;
      varianceB += db * db;
    }
    const denominator = Math.sqrt(varianceA * varianceB);
    return denominator > 0 ? covariance / denominator : null;
  }

  function scoreShift(measured, sampled, normalization) {
    const pairs = pairedValues(measured, sampled);
    if (pairs.measured.length < 3) return { score: null, count: pairs.measured.length };
    const measuredNorm = normalize(pairs.measured, normalization);
    const referenceNorm = normalize(pairs.reference, normalization);
    return { score: correlation(measuredNorm, referenceNorm), count: pairs.measured.length };
  }

  function findAutomaticShift(wavelengths, measured, reference, options) {
    const maxShift = Math.max(0, Math.min(20, Number(options.maxAutoShiftNm) || 2));
    const spacing = medianSpacing(wavelengths) || 0.1;
    const requestedStep = Number(options.autoStepNm);
    const step = Math.max(0.01, Number.isFinite(requestedStep) && requestedStep > 0 ? requestedStep : Math.min(0.1, spacing));
    const steps = Math.min(200, Math.max(1, Math.ceil(maxShift / step)));
    let best = { shiftNm: 0, score: -Infinity, count: 0 };
    for (let index = -steps; index <= steps; index += 1) {
      const shiftNm = index * maxShift / steps;
      const sampled = sampleReference(reference, wavelengths, shiftNm, options);
      const scored = scoreShift(measured, sampled, options.normalization);
      if (Number.isFinite(scored.score) && (scored.score > best.score + 1e-12 ||
          (Math.abs(scored.score - best.score) <= 1e-12 && Math.abs(shiftNm) < Math.abs(best.shiftNm)))) {
        best = { shiftNm: shiftNm, score: scored.score, count: scored.count };
      }
    }
    return best.score === -Infinity ? null : best;
  }

  function prepareReference(reference) {
    if (!reference || typeof reference !== 'object') return null;
    if (reference.kind === 'line-list') {
      const lines = (Array.isArray(reference.lines) ? reference.lines : []).map(function (line) {
        return { nm: Number(line && line.nm), weight: Number(line && line.weight) };
      }).filter(function (line) { return Number.isFinite(line.nm); });
      return lines.length ? Object.assign({}, reference, { lines: lines }) : null;
    }
    if (!finiteArray(reference.wavelengthNm) || !finiteArray(reference.intensity) || reference.wavelengthNm.length !== reference.intensity.length) return null;
    const ordered = orderedPairs(reference.wavelengthNm, reference.intensity);
    return Object.assign({}, reference, { kind: 'spectrum', wavelengthNm: ordered.nm, intensity: ordered.intensity });
  }

  function compare(frame, referenceInput, optionsInput) {
    const options = optionsInput || {};
    const wavelengths = frame && finiteArray(frame.nm) ? frame.nm.map(Number) : null;
    const measured = frame && wavelengths && finiteArray(frame.processedI) && frame.processedI.length === wavelengths.length
      ? frame.processedI.map(Number)
      : (frame && finiteArray(frame.I) && wavelengths && frame.I.length === wavelengths.length ? frame.I.map(Number) : null);
    const reference = prepareReference(referenceInput);
    if (!wavelengths || !measured) return { state: 'unavailable', reason: 'calibrated-wavelengths-required' };
    if (!reference) return { state: 'unavailable', reason: 'invalid-reference' };

    const alignmentMode = ['none', 'manual', 'auto'].indexOf(String(options.alignmentMode || 'none').toLowerCase()) !== -1
      ? String(options.alignmentMode || 'none').toLowerCase()
      : 'none';
    let shiftNm = alignmentMode === 'manual' ? Number(options.manualShiftNm) || 0 : 0;
    let auto = null;
    if (alignmentMode === 'auto') {
      auto = findAutomaticShift(wavelengths, measured, reference, options);
      if (!auto) return { state: 'unavailable', reason: 'automatic-alignment-failed' };
      shiftNm = auto.shiftNm;
    }

    const sampled = sampleReference(reference, wavelengths, shiftNm, options);
    const pairs = pairedValues(measured, sampled);
    if (pairs.measured.length < 3) return { state: 'unavailable', reason: 'insufficient-overlap', sampleCount: pairs.measured.length };
    const measuredSpan = Math.max.apply(null, pairs.measured) - Math.min.apply(null, pairs.measured);
    const referenceSpan = Math.max.apply(null, pairs.reference) - Math.min.apply(null, pairs.reference);
    if (!(measuredSpan > 0) || !(referenceSpan > 0)) {
      return { state: 'unavailable', reason: 'insufficient-variation', sampleCount: pairs.measured.length };
    }
    const normalization = ['none', 'area', 'min-max'].indexOf(String(options.normalization || 'min-max').toLowerCase()) !== -1
      ? String(options.normalization || 'min-max').toLowerCase()
      : 'min-max';
    const measuredNorm = normalize(pairs.measured, normalization);
    const referenceNorm = normalize(pairs.reference, normalization);
    const residual = measuredNorm.map(function (value, index) { return value - referenceNorm[index]; });
    const mae = residual.reduce(function (sum, value) { return sum + Math.abs(value); }, 0) / residual.length;
    const rmse = Math.sqrt(residual.reduce(function (sum, value) { return sum + value * value; }, 0) / residual.length);
    const alignedReferenceI = wavelengths.map(function () { return null; });
    const normalizedMeasuredI = wavelengths.map(function () { return null; });
    const residualI = wavelengths.map(function () { return null; });
    pairs.indices.forEach(function (originalIndex, pairIndex) {
      alignedReferenceI[originalIndex] = referenceNorm[pairIndex];
      normalizedMeasuredI[originalIndex] = measuredNorm[pairIndex];
      residualI[originalIndex] = residual[pairIndex];
    });

    return {
      state: 'available',
      schema: 'spectra-pro-reference-comparison/v1',
      referenceId: String(reference.id || 'custom'),
      referenceLabel: String(reference.label || reference.id || 'Custom reference'),
      referenceKind: reference.kind,
      normalization: normalization,
      alignment: {
        mode: alignmentMode,
        shiftNm: +shiftNm.toFixed(6),
        source: alignmentMode === 'auto' ? 'comparison-cross-correlation' : (alignmentMode === 'manual' ? 'manual-comparison-control' : 'none'),
        score: auto && Number.isFinite(auto.score) ? +auto.score.toFixed(6) : null,
        radialVelocityMeasurement: false
      },
      overlap: {
        minNm: wavelengths[pairs.indices[0]],
        maxNm: wavelengths[pairs.indices[pairs.indices.length - 1]],
        sampleCount: pairs.indices.length,
        fraction: +(pairs.indices.length / wavelengths.length).toFixed(6)
      },
      metrics: {
        correlation: (function () { const value = correlation(measuredNorm, referenceNorm); return Number.isFinite(value) ? +value.toFixed(6) : null; })(),
        mae: +mae.toFixed(8),
        rmse: +rmse.toFixed(8)
      },
      wavelengthNm: wavelengths.slice(),
      normalizedMeasuredI: normalizedMeasuredI,
      alignedReferenceI: alignedReferenceI,
      residualI: residualI,
      limitations: [
        'comparison-alignment-is-not-a-radial-velocity-measurement',
        'residuals-depend-on-selected-normalization'
      ]
    };
  }

  root.SPECTRA_PRO_referenceComparison = {
    compare: compare,
    normalize: normalize,
    correlation: correlation
  };
})(typeof self !== 'undefined' ? self : this);
