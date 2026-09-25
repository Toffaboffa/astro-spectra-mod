(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const SCHEMA_VERSION = 'spectra-pro-ai-analysis/v1';
  const DEFAULT_MAX_TRACE_POINTS = 112;
  const DEFAULT_MAX_HITS = 28;
  const DEFAULT_MAX_CANDIDATES = 6;
  const MAX_OBSERVATION_CHARS = 600;

  function finiteNumber(value) {
    if (value == null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function rounded(value, digits) {
    const n = finiteNumber(value);
    if (n == null) return null;
    const p = Math.pow(10, Number.isFinite(digits) ? digits : 3);
    return Math.round(n * p) / p;
  }

  function cleanString(value, maxLength) {
    const text = String(value == null ? '' : value).trim();
    if (!text) return '';
    const limit = Math.max(0, Number(maxLength) || 0);
    return limit && text.length > limit ? text.slice(0, limit) : text;
  }

  function compactPrimitiveObject(source, allowedKeys) {
    const src = source && typeof source === 'object' ? source : {};
    const out = {};
    (allowedKeys || []).forEach(function (key) {
      const value = src[key];
      if (value == null) return;
      if (typeof value === 'number') {
        if (Number.isFinite(value)) out[key] = value;
      } else if (typeof value === 'string' || typeof value === 'boolean') {
        out[key] = value;
      }
    });
    return out;
  }

  function getState() {
    try { return sp.store && sp.store.getState ? (sp.store.getState() || {}) : {}; }
    catch (_) { return {}; }
  }

  function getAppVersion() {
    const direct = cleanString(sp.version || sp.VERSION || sp.appVersion || '', 32);
    if (direct) return direct;
    try {
      const badge = global.document && global.document.getElementById('spVersionBadge');
      return cleanString(badge && badge.textContent, 32) || null;
    } catch (_) { return null; }
  }

  function getDetailedCalibrationState() {
    try {
      const core = global.SpectraCore && global.SpectraCore.calibration;
      if (core && typeof core.getDetailedState === 'function') return core.getDetailedState() || null;
      if (core && typeof core.getState === 'function') return core.getState() || null;
    } catch (_) {}
    return null;
  }

  function buildCalibration(state, frame) {
    const stored = state && state.calibration && typeof state.calibration === 'object' ? state.calibration : {};
    const detailed = getDetailedCalibrationState() || {};
    const pointSource = Array.isArray(stored.points) && stored.points.length ? stored.points : (Array.isArray(detailed.points) ? detailed.points : []);
    const coeffSource = Array.isArray(stored.coefficients) && stored.coefficients.length ? stored.coefficients : (Array.isArray(detailed.coefficients) ? detailed.coefficients : []);
    const points = pointSource.map(function (p) {
      const px = finiteNumber(p && p.px), nm = finiteNumber(p && p.nm);
      return px == null || nm == null ? null : { px: rounded(px, 3), nm: rounded(nm, 4) };
    }).filter(Boolean).slice(0, 20);
    const coefficients = coeffSource.map(function (v) { return rounded(v, 10); }).filter(function (v) { return v != null; }).slice(0, 8);
    const frameNm = frame && Array.isArray(frame.nm) ? frame.nm.map(finiteNumber).filter(function (v) { return v != null; }) : [];
    return {
      calibrated: !!(stored.isCalibrated || detailed.isCalibrated || detailed.calibrated || coefficients.length || frameNm.length),
      pointCount: finiteNumber(stored.pointCount) != null ? Number(stored.pointCount) : points.length,
      points: points,
      coefficients: coefficients,
      residualStatus: cleanString(stored.residualStatus || detailed.residualStatus || '', 48) || null,
      spectralRangeNm: frameNm.length ? { min: rounded(Math.min.apply(null, frameNm), 3), max: rounded(Math.max.apply(null, frameNm), 3) } : null
    };
  }

  function compactCandidate(row, index) {
    if (!row || typeof row !== 'object') return null;
    const species = cleanString(row.element || row.species || row.speciesKey || row.name || '', 80);
    if (!species) return null;
    const out = { rank: finiteNumber(row.rank) != null ? Number(row.rank) : index + 1, species: species };
    Object.assign(out, compactPrimitiveObject(row, [
      'mode', 'family', 'scoreSharePct', 'likelyPct', 'totalScore', 'score',
      'matchedPeaks', 'matchedCount', 'matchedExpected', 'matchCount', 'lineCount',
      'missedStrong', 'medianDeltaNm', 'avgDeltaNm', 'explainedProm',
      'explainedIntensityPct', 'explainedPeaks', 'explainedPeaksPct', 'explainedShare',
      'closenessScore', 'rgbSupport', 'evidenceModel', 'evidenceFactor',
      'diagnosticMatchedPeaks', 'diagnosticScore', 'plasmaMatchedBands',
      'profileExpected', 'diagnosticExpected', 'missingImportant', 'patternCoveragePct', 'fingerprintScore'
    ]));
    if (Array.isArray(row.supportLines)) out.supportLines = row.supportLines.map(function (v) { return rounded(v, 4); }).filter(function (v) { return v != null; }).slice(0, 16);
    if (Array.isArray(row.diagnosticSupportLines)) out.diagnosticSupportLines = row.diagnosticSupportLines.map(function (v) { return rounded(v, 4); }).filter(function (v) { return v != null; }).slice(0, 16);
    return out;
  }

  function compactHit(hit) {
    if (!hit || typeof hit !== 'object') return null;
    const species = cleanString(hit.element || hit.speciesKey || hit.species || hit.label || hit.name || '', 96);
    if (!species) return null;
    const out = { species: species };
    const numeric = {
      observedNm: hit.observedNm != null ? hit.observedNm : hit.obsNm,
      referenceNm: hit.referenceNm != null ? hit.referenceNm : hit.refNm,
      deltaNm: hit.deltaNm, confidence: hit.confidence, score: hit.score, rawScore: hit.rawScore,
      prominence: hit.prominence, peakIndex: hit.peakIndex, peakValue: hit.peakValue,
      bandMinNm: hit.bandMinNm, bandMaxNm: hit.bandMaxNm, bandPeakCount: hit.bandPeakCount,
      bandProminence: hit.bandProminence, stableCount: hit.stableCount,
      smartGroupRank: hit.smartGroupRank, smartGroupScore: hit.smartGroupScore
    };
    Object.keys(numeric).forEach(function (key) {
      const n = finiteNumber(numeric[key]);
      if (n == null) return;
      out[key] = rounded(n, /Index|Count|Rank/.test(key) ? 0 : 4);
    });
    ['kind', 'evidenceModel'].forEach(function (key) {
      const value = cleanString(hit[key], 64);
      if (value) out[key] = value;
    });
    if (hit.smartFind === true) out.smartFind = true;
    return out;
  }

  function compactWinnerBreakdown(winner) {
    if (!winner || typeof winner !== 'object') return null;
    const out = compactPrimitiveObject(winner, [
      'preset', 'primaryEmitter', 'primaryLikelyPct', 'explainedPeaksPct',
      'explainedIntensityPct', 'expectedMissed', 'scoreSemantics', 'evidenceModel'
    ]);
    if (Array.isArray(winner.expectedFound)) out.expectedFound = winner.expectedFound.map(function (v) { return rounded(v, 4); }).filter(function (v) { return v != null; }).slice(0, 16);
    if (Array.isArray(winner.possibleBands)) out.possibleBands = winner.possibleBands.slice(0, 12).map(function (v) { return cleanString(v, 64); }).filter(Boolean);
    if (Array.isArray(winner.backgroundComponents)) out.backgroundComponents = winner.backgroundComponents.slice(0, 12).map(function (v) { return cleanString(v, 64); }).filter(Boolean);
    if (Array.isArray(winner.secondaryContributors)) {
      out.secondaryContributors = winner.secondaryContributors.slice(0, 4).map(function (row) {
        if (!row || typeof row !== 'object') return null;
        const item = compactPrimitiveObject(row, ['element', 'likelyPct', 'scoreSharePct', 'explainedIntensityPct', 'explainedPeaksPct']);
        if (!item.element) item.element = cleanString(row.species || row.name || '', 80);
        return item.element ? item : null;
      }).filter(Boolean);
    }
    return Object.keys(out).length ? out : null;
  }

  function compactFluorescence(summary) {
    if (!summary || typeof summary !== 'object') return null;
    const out = compactPrimitiveObject(summary, [
      'model', 'spectrumType', 'broadbandDetected', 'lambdaMaxNm', 'centroidNm', 'fwhmNm',
      'bandMinNm', 'bandMaxNm', 'bandWidthNm', 'asymmetry', 'asymmetryRatio',
      'integratedIntensity', 'peakIntensity', 'baselineIntensity', 'smoothingWindowNm'
    ]);
    if (Array.isArray(summary.shoulders)) {
      out.shoulders = summary.shoulders.slice(0, 4).map(function (sh) {
        return { nm: rounded(sh && sh.nm, 3), relativeHeight: rounded(sh && sh.relativeHeight, 4) };
      }).filter(function (sh) { return sh.nm != null; });
    }
    return Object.keys(out).length ? out : null;
  }

  function selectHits(hits, bestSpecies, maxHits) {
    const list = Array.isArray(hits) ? hits.filter(Boolean) : [];
    const best = cleanString(bestSpecies, 96);
    const primary = [], secondary = [];
    list.forEach(function (hit) {
      const species = cleanString(hit && (hit.element || hit.speciesKey || hit.species || hit.name), 96);
      (best && species === best ? primary : secondary).push(hit);
    });
    return primary.concat(secondary).slice(0, maxHits).map(compactHit).filter(Boolean);
  }

  function traceSource(frame) {
    if (!frame || typeof frame !== 'object') return null;
    const intensity = Array.isArray(frame.I) ? frame.I
      : (Array.isArray(frame.intensity) ? frame.intensity
      : (Array.isArray(frame.combined) ? frame.combined
      : (Array.isArray(frame.values) ? frame.values : null)));
    if (!intensity || !intensity.length) return null;
    const n = intensity.length;
    if (Array.isArray(frame.nm) && frame.nm.length === n) return { x: frame.nm, y: intensity, xUnit: 'nm' };
    if (Array.isArray(frame.px) && frame.px.length === n) return { x: frame.px, y: intensity, xUnit: 'px' };
    return { x: Array.from({ length: n }, function (_, i) { return i; }), y: intensity, xUnit: 'px' };
  }

  function downsampleEnvelope(x, y, maxPoints) {
    const n = Math.min(Array.isArray(x) ? x.length : 0, Array.isArray(y) ? y.length : 0);
    if (!n) return [];
    const cap = Math.max(16, Math.floor(finiteNumber(maxPoints) || DEFAULT_MAX_TRACE_POINTS));
    const finite = [];
    for (let i = 0; i < n; i += 1) {
      const xv = finiteNumber(x[i]), yv = finiteNumber(y[i]);
      if (xv != null && yv != null) finite.push({ index: i, x: xv, y: yv });
    }
    if (finite.length <= cap) return finite;
    const bucketCount = Math.max(1, Math.floor((cap - 2) / 2));
    const bucketSize = finite.length / bucketCount;
    const selected = [];
    for (let b = 0; b < bucketCount; b += 1) {
      const start = Math.floor(b * bucketSize), end = Math.min(finite.length, Math.floor((b + 1) * bucketSize));
      if (start >= end) continue;
      let minPoint = finite[start], maxPoint = finite[start];
      for (let i = start + 1; i < end; i += 1) {
        if (finite[i].y < minPoint.y) minPoint = finite[i];
        if (finite[i].y > maxPoint.y) maxPoint = finite[i];
      }
      if (minPoint.index <= maxPoint.index) {
        selected.push(minPoint);
        if (maxPoint.index !== minPoint.index) selected.push(maxPoint);
      } else {
        selected.push(maxPoint);
        if (maxPoint.index !== minPoint.index) selected.push(minPoint);
      }
    }
    if (selected.length && selected[0].index !== finite[0].index) selected.unshift(finite[0]);
    const last = finite[finite.length - 1];
    if (selected.length && selected[selected.length - 1].index !== last.index) selected.push(last);
    const seen = Object.create(null);
    return selected.filter(function (p) {
      if (seen[p.index]) return false;
      seen[p.index] = true;
      return true;
    }).slice(0, cap);
  }

  function buildTrace(frame, maxPoints) {
    const source = traceSource(frame);
    if (!source) return null;
    const yFinite = source.y.map(finiteNumber).filter(function (v) { return v != null; });
    if (!yFinite.length) return null;
    const minY = Math.min.apply(null, yFinite), maxY = Math.max.apply(null, yFinite), span = maxY - minY;
    const points = downsampleEnvelope(source.x, source.y, maxPoints).map(function (p) {
      return [rounded(p.x, source.xUnit === 'nm' ? 3 : 1), rounded(span > 0 ? (p.y - minY) / span : 0, 4)];
    });
    return {
      columns: ['x', 'i'], xUnit: source.xUnit, intensityScale: 'normalized-0-1',
      sourceSamples: source.y.length, transmittedSamples: points.length,
      rawIntensityMin: rounded(minY, 4), rawIntensityMax: rounded(maxY, 4), points: points
    };
  }

  function buildQuality(frame, analysis, trace) {
    const source = traceSource(frame);
    const values = source ? source.y.map(finiteNumber).filter(function (v) { return v != null; }) : [];
    const sum = values.reduce(function (a, b) { return a + b; }, 0);
    return {
      qcFlags: Array.isArray(analysis.qcFlags) ? analysis.qcFlags.slice(0, 24).map(function (v) { return cleanString(v, 96); }).filter(Boolean) : [],
      measurement: compactMeasurementQuality(analysis.measurementQuality),
      offsetNm: rounded(analysis.offsetNm, 4),
      rawMatchOffsetNm: rounded(analysis.rawMatchOffsetNm, 4),
      offsetBasis: cleanString(analysis.offsetBasis, 48) || null,
      sampleCount: values.length,
      intensityMean: values.length ? rounded(sum / values.length, 4) : null,
      intensityMin: values.length ? rounded(Math.min.apply(null, values), 4) : null,
      intensityMax: values.length ? rounded(Math.max.apply(null, values), 4) : null,
      traceTransmittedSamples: trace && finiteNumber(trace.transmittedSamples) != null ? trace.transmittedSamples : 0
    };
  }

  function resolveAnalysisContext(state, analysis) {
    const mode = cleanString(state && state.appMode, 24).toLowerCase();
    const resultContext = cleanString(analysis && analysis.resultContext, 24).toLowerCase();
    const preset = cleanString(analysis && analysis.presetId, 64).toLowerCase();
    if (mode === 'astro' || resultContext === 'astro' || (analysis && analysis.astro)) return 'astro';
    if (analysis && analysis.fluorescenceSummary) return 'fluorescence';
    if (preset.indexOf('fluorescent') !== -1) return 'fluorescence';
    if (preset.indexOf('molecular') !== -1) return 'lab-molecular';
    const groups = analysis && Array.isArray(analysis.smartFindGroups) ? analysis.smartFindGroups : [];
    if (groups.some(function (group) { return /molecular|plasma-diagnostic/i.test(String(group && group.evidenceModel || '')); })) return 'lab-molecular';
    return 'lab-atomic';
  }

  function compactFeature(feature) {
    if (!feature || typeof feature !== 'object') return null;
    const centerNm = rounded(feature.centerNm, 4);
    if (centerNm == null && finiteNumber(feature.sampleIndex) == null) return null;
    return {
      centerNm: centerNm,
      centerUncertaintyNm: rounded(feature.centerUncertaintyNm, 4),
      sampleIndex: rounded(feature.sampleIndex, 0),
      polarity: cleanString(feature.polarity, 16) || null,
      depth: rounded(feature.depth, 5),
      amplitude: rounded(feature.amplitude, 5),
      prominence: rounded(feature.prominence, 5),
      fwhmNm: rounded(feature.fwhmNm, 4),
      equivalentWidthNm: rounded(feature.equivalentWidthNm, 5),
      snr: rounded(feature.snr, 3),
      quality: cleanString(feature.quality, 24) || null,
      qualityFlags: (Array.isArray(feature.qualityFlags) ? feature.qualityFlags : []).slice(0, 8).map(function (value) { return cleanString(value, 64); }).filter(Boolean)
    };
  }

  function compactRadialVelocity(value) {
    if (!value || typeof value !== 'object') return null;
    return {
      state: cleanString(value.state, 32) || 'unavailable',
      velocityKmS: rounded(value.velocityKmS, 3),
      uncertaintyKmS: rounded(value.uncertaintyKmS, 3),
      quality: cleanString(value.quality, 24) || null,
      signConvention: cleanString(value.signConvention, 96) || null,
      lineCountTotal: rounded(value.lineCountTotal, 0),
      lineCountUsed: rounded(value.lineCountUsed, 0),
      excludedLineCount: rounded(value.excludedLineCount, 0),
      corrections: value.corrections && typeof value.corrections === 'object' ? {
        barycentric: !!value.corrections.barycentric,
        heliocentric: !!value.corrections.heliocentric
      } : null,
      lines: (Array.isArray(value.lines) ? value.lines : []).slice(0, 16).map(function (line) {
        return {
          label: cleanString(line && (line.label || line.speciesKey || line.species), 80) || null,
          observedNm: rounded(line && line.observedNm, 4),
          referenceNm: rounded(line && line.referenceNm, 4),
          wavelengthShiftNm: rounded(line && line.wavelengthShiftNm, 5),
          velocityKmS: rounded(line && line.velocityKmS, 3),
          uncertaintyKmS: rounded(line && line.uncertaintyKmS, 3),
          quality: cleanString(line && line.quality, 24) || null,
          included: !!(line && line.included),
          exclusionReason: cleanString(line && line.exclusionReason, 80) || null
        };
      }),
      limitations: (Array.isArray(value.limitations) ? value.limitations : []).slice(0, 8).map(function (item) { return cleanString(item, 96); }).filter(Boolean)
    };
  }

  function compactStellarClassification(value) {
    if (!value || typeof value !== 'object') return null;
    return {
      state: cleanString(value.state, 32) || 'insufficient-data',
      bestClass: cleanString(value.bestClass, 8) || null,
      compatibleRange: cleanString(value.compatibleRange, 24) || null,
      evidenceStrength: cleanString(value.evidenceStrength, 24) || null,
      reasons: (Array.isArray(value.reasons) ? value.reasons : []).slice(0, 8).map(function (item) { return cleanString(item, 120); }).filter(Boolean),
      conflictingEvidence: (Array.isArray(value.conflictingEvidence) ? value.conflictingEvidence : []).slice(0, 8).map(function (item) { return cleanString(item, 120); }).filter(Boolean),
      ranking: (Array.isArray(value.ranking) ? value.ranking : []).slice(0, 7).map(function (row) {
        return { class: cleanString(row && row.class, 8), evidencePoints: rounded(row && row.evidencePoints, 3) };
      }),
      limitations: (Array.isArray(value.limitations) ? value.limitations : []).slice(0, 8).map(function (item) { return cleanString(item, 96); }).filter(Boolean)
    };
  }

  function compactAstro(astro) {
    if (!astro || typeof astro !== 'object') return null;
    const continuum = astro.continuum && typeof astro.continuum === 'object' ? astro.continuum : {};
    return {
      model: cleanString(astro.model, 64) || null,
      continuum: {
        state: cleanString(continuum.state, 32) || 'unavailable',
        method: cleanString(continuum.method, 64) || null,
        sampleCount: Array.isArray(continuum.normalized) ? continuum.normalized.length : 0,
        windowRadiusPx: rounded(continuum.windowRadiusPx, 0),
        quantile: rounded(continuum.quantile, 3),
        warnings: (Array.isArray(continuum.warnings) ? continuum.warnings : []).slice(0, 8).map(function (item) { return cleanString(item, 96); }).filter(Boolean)
      },
      absorptionFeatures: (Array.isArray(astro.absorptionFeatures) ? astro.absorptionFeatures : []).slice(0, 24).map(compactFeature).filter(Boolean),
      referenceMatches: (Array.isArray(astro.referenceMatches) ? astro.referenceMatches : []).slice(0, 32).map(compactHit).filter(Boolean),
      radialVelocity: compactRadialVelocity(astro.radialVelocity),
      stellarClassification: compactStellarClassification(astro.stellarClassification),
      referenceSet: astro.referenceSet && typeof astro.referenceSet === 'object' ? {
        id: cleanString(astro.referenceSet.id, 96) || null,
        wavelengthMedium: cleanString(astro.referenceSet.wavelengthMedium, 32) || null,
        source: cleanString(astro.referenceSet.source, 160) || null,
        lineCount: rounded(astro.referenceSet.lineCount, 0)
      } : null,
      limitations: (Array.isArray(astro.limitations) ? astro.limitations : []).slice(0, 12).map(function (item) { return cleanString(item, 120); }).filter(Boolean)
    };
  }

  function compactCalibrationDiagnostics(value) {
    if (!value || typeof value !== 'object') return null;
    return {
      status: cleanString(value.status, 32) || null,
      pointCount: rounded(value.pointCount, 0),
      polynomialOrder: rounded(value.polynomialOrder, 0),
      rmsResidualNm: rounded(value.rmsResidualNm, 5),
      maxAbsResidualNm: rounded(value.maxAbsResidualNm, 5),
      samplingNmPerPx: rounded(value.samplingNmPerPx, 5),
      coverageNm: value.coverageNm && typeof value.coverageNm === 'object' ? {
        min: rounded(value.coverageNm.min, 3), max: rounded(value.coverageNm.max, 3)
      } : null,
      extrapolated: !!value.extrapolated
    };
  }

  function compactReferenceComparison(value) {
    if (!value || typeof value !== 'object') return null;
    return {
      state: cleanString(value.state, 24) || 'unavailable',
      referenceId: cleanString(value.referenceId, 96) || null,
      referenceLabel: cleanString(value.referenceLabel, 120) || null,
      normalization: cleanString(value.normalization, 24) || null,
      alignment: value.alignment && typeof value.alignment === 'object' ? {
        mode: cleanString(value.alignment.mode, 24) || null,
        shiftNm: rounded(value.alignment.shiftNm, 5),
        source: cleanString(value.alignment.source, 64) || null,
        radialVelocityMeasurement: value.alignment.radialVelocityMeasurement === true
      } : null,
      overlap: value.overlap && typeof value.overlap === 'object' ? {
        minNm: rounded(value.overlap.minNm, 3), maxNm: rounded(value.overlap.maxNm, 3),
        sampleCount: rounded(value.overlap.sampleCount, 0), fraction: rounded(value.overlap.fraction, 4)
      } : null,
      metrics: value.metrics && typeof value.metrics === 'object' ? {
        correlation: rounded(value.metrics.correlation, 5), mae: rounded(value.metrics.mae, 6), rmse: rounded(value.metrics.rmse, 6)
      } : null,
      limitations: (Array.isArray(value.limitations) ? value.limitations : []).slice(0, 8).map(function (item) { return cleanString(item, 96); }).filter(Boolean)
    };
  }

  function compactMeasurementQuality(source) {
    if (!source || typeof source !== 'object') return null;
    const dimensions = {};
    Object.keys(source.dimensions || {}).slice(0, 12).forEach(function (key) {
      const row = source.dimensions[key] || {};
      dimensions[cleanString(key, 40)] = {
        status: cleanString(row.status, 24) || 'unavailable',
        reason: cleanString(row.reason, 96) || null,
        metrics: compactPrimitiveObject(row.metrics, Object.keys(row.metrics || {}).slice(0, 16))
      };
    });
    const limitation = source.mainLimitation || {};
    return {
      model: cleanString(source.model, 64) || null,
      overallStatus: cleanString(source.overallStatus, 24) || 'unavailable',
      mainLimitation: limitation.code ? {
        code: cleanString(limitation.code, 40),
        status: cleanString(limitation.status, 24),
        reason: cleanString(limitation.reason, 96)
      } : null,
      dimensions: dimensions
    };
  }

  function buildSettings(state) {
    const analysis = state.analysis || {}, peaks = state.peaks || {}, subtraction = state.subtraction || {}, display = state.display || {};
    return {
      presetId: cleanString(analysis.presetId, 64) || null,
      includeWeakPeaks: !!analysis.includeWeakPeaks,
      peakThresholdRel: rounded(analysis.peakThresholdRel, 4),
      peakDistancePx: rounded(analysis.peakDistancePx, 2),
      maxDistanceNm: rounded(analysis.maxDistanceNm, 3),
      strongPeakLevel: rounded(analysis.strongPeakLevel, 2),
      useRgbScore: !!analysis.useRgbScore,
      stableHits: !!analysis.stableHits,
      smartFindEnabled: analysis.smartFindEnabled !== false,
      narrowLineOverlay: !!analysis.narrowLineOverlay,
      subtractionMode: cleanString(subtraction.mode || 'raw', 32),
      displayMode: cleanString(display.mode || 'normal', 32),
      graphPeakThreshold: rounded(peaks.threshold, 3),
      graphPeakDistance: rounded(peaks.distance, 3),
      graphSmoothing: rounded(peaks.smoothing, 3)
    };
  }

  function buildInstrument(state) {
    const out = compactPrimitiveObject(state.hardware || {}, [
      'profileId', 'profileName', 'spectralRangeMinNm', 'spectralRangeMaxNm',
      'spectrometerResolutionFwhmNm', 'pixelResolutionNm', 'gratingLinesPerMm'
    ]);
    return Object.keys(out).length ? out : null;
  }

  function compactPreprocessing(source) {
    if (!source || typeof source !== 'object') return null;
    const stages = (Array.isArray(source.stages) ? source.stages : []).slice(0, 12).map(function (item) {
      return {
        id: cleanString(item && item.id, 48),
        status: cleanString(item && item.status, 24),
        applied: !!(item && item.applied)
      };
    });
    return {
      schema: cleanString(source.schema, 64) || null,
      analysisSignal: cleanString(source.analysisSignal, 32) || null,
      intensityBasis: cleanString(source.intensityBasis, 64) || 'uncorrected-relative-intensity',
      effectiveSubtractionMode: cleanString(source.effectiveSubtractionMode, 32) || null,
      responseCorrection: source.responseCorrection && typeof source.responseCorrection === 'object' ? {
        enabled: !!source.responseCorrection.enabled,
        applied: !!source.responseCorrection.applied,
        profileId: cleanString(source.responseCorrection.profileId, 96) || null,
        profileLabel: cleanString(source.responseCorrection.profileLabel, 120) || null,
        maxCorrectionFactor: rounded(source.responseCorrection.maxCorrectionFactor, 3),
        clampedSampleCount: rounded(source.responseCorrection.clampedSampleCount, 0),
        extrapolatedSampleCount: rounded(source.responseCorrection.extrapolatedSampleCount, 0)
      } : null,
      activeOperations: (Array.isArray(source.activeOperations) ? source.activeOperations : []).slice(0, 12).map(function (value) { return cleanString(value, 48); }).filter(Boolean),
      warnings: (Array.isArray(source.warnings) ? source.warnings : []).slice(0, 12).map(function (value) { return cleanString(value, 96); }).filter(Boolean),
      stages: stages
    };
  }

  function build(options) {
    const opts = options && typeof options === 'object' ? options : {};
    const state = getState(), analysis = state.analysis || {};
    const frame = state.frame && state.frame.latest ? state.frame.latest : null;
    const maxTracePoints = Math.max(16, Math.min(512, Math.floor(finiteNumber(opts.maxTracePoints) || DEFAULT_MAX_TRACE_POINTS)));
    const maxHits = Math.max(8, Math.min(160, Math.floor(finiteNumber(opts.maxHits) || DEFAULT_MAX_HITS)));
    const maxCandidates = Math.max(1, Math.min(12, Math.floor(finiteNumber(opts.maxCandidates) || DEFAULT_MAX_CANDIDATES)));
    const candidateRows = Array.isArray(analysis.elementScores) && analysis.elementScores.length ? analysis.elementScores : (Array.isArray(analysis.smartFindGroups) ? analysis.smartFindGroups : []);
    const candidates = candidateRows.slice(0, maxCandidates).map(compactCandidate).filter(Boolean);
    const bestMatch = candidates.length ? candidates[0] : null;
    const rawHits = Array.isArray(analysis.rawTopHits) && analysis.rawTopHits.length ? analysis.rawTopHits : (Array.isArray(analysis.topHits) ? analysis.topHits : []);
    const fluorescence = compactFluorescence(analysis.fluorescenceSummary);
    const narrowHits = Array.isArray(analysis.narrowLineCandidates) ? analysis.narrowLineCandidates.slice(0, 24).map(compactHit).filter(Boolean) : [];
    const trace = buildTrace(frame, maxTracePoints);
    const calibration = buildCalibration(state, frame);
    const analysisContext = resolveAnalysisContext(state, analysis);
    const astro = compactAstro(analysis.astro);

    return {
      schema: SCHEMA_VERSION,
      generatedAt: new Date().toISOString(),
      app: { name: 'SPECTRA PRO', version: getAppVersion() },
      observation: cleanString(opts.observation, MAX_OBSERVATION_CHARS) || null,
      context: {
        appMode: cleanString(state.appMode || '', 24) || null,
        analysisContext: analysisContext,
        deterministicAnalysis: true,
        frameSource: cleanString((state.frame && state.frame.source) || (frame && frame.source) || '', 48) || null,
        frameTimestamp: frame && frame.timestamp ? frame.timestamp : null,
        workerResultTimestamp: state.worker && state.worker.lastResultAt ? state.worker.lastResultAt : null
      },
      settings: buildSettings(state),
      instrument: buildInstrument(state),
      preprocessing: compactPreprocessing(analysis.preprocessing),
      calibration: calibration,
      quality: buildQuality(frame, analysis, trace),
      analysis: {
        scoreSemantics: analysisContext === 'astro' ? 'deterministic-astro-measurements-not-probabilities' : (fluorescence ? 'broadband-fluorescence-shape' : 'relative-score-share-not-probability-or-abundance'),
        calibrationDiagnostics: compactCalibrationDiagnostics(analysis.calibrationDiagnostics),
        bestMatch: bestMatch,
        candidates: candidates,
        winnerBreakdown: compactWinnerBreakdown(analysis.winnerBreakdown),
        fluorescence: fluorescence,
        narrowLineCandidates: narrowHits,
        hits: selectHits(rawHits, bestMatch && bestMatch.species, maxHits),
        astro: astro,
        referenceComparison: compactReferenceComparison(analysis.referenceComparison)
      },
      trace: trace,
      readiness: {
        hasFrame: !!trace,
        calibrated: !!calibration.calibrated,
        hasAnalysisResult: !!(astro || fluorescence || bestMatch || rawHits.length)
      }
    };
  }

  sp.aiAnalysisPayload = {
    schema: SCHEMA_VERSION,
    build: build,
    defaults: { maxTracePoints: DEFAULT_MAX_TRACE_POINTS, maxHits: DEFAULT_MAX_HITS, maxCandidates: DEFAULT_MAX_CANDIDATES }
  };
})(window);
