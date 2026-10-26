(function (root) {
  'use strict';

  // No substance-specific wavelength or gas-name decisions here. Reference
  // fingerprints and physical emitters are supplied by the existing catalog.
  const MODEL = 'catalog-driven-discharge-evidence-v2';

  function finite(value) {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function strength(p) {
    return Math.max(0, finite(p && p.prominence) ?? finite(p && p.value) ?? 0);
  }
  function key(value) { return String(value == null ? '' : value).trim(); }
  function round(value, places) {
    const n = finite(value);
    return n === null ? null : +n.toFixed(places || 3);
  }
  function rangeOf(frame, result, peaks) {
    const axis = frame && Array.isArray(frame.nm) ? frame.nm : [];
    const vals = axis.map(finite).filter(function (n) { return n !== null; });
    if (vals.length) return { min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) };
    const diagnostic = result && result.calibrationDiagnostics && result.calibrationDiagnostics.wavelengthCoverageNm;
    if (diagnostic && finite(diagnostic.min) !== null && finite(diagnostic.max) !== null)
      return { min: Math.min(diagnostic.min, diagnostic.max), max: Math.max(diagnostic.min, diagnostic.max) };
    const seen = peaks.map(function (p) { return finite(p.nm); }).filter(function (n) { return n !== null; });
    return seen.length ? { min: Math.min.apply(null, seen), max: Math.max.apply(null, seen) } : null;
  }
  function independent(hits, resolutionNm) {
    const sorted = (Array.isArray(hits) ? hits : []).map(function (h) {
      return finite(h && h.observedNm);
    }).filter(function (n) { return n !== null; }).sort(function (a, b) { return a - b; });
    if (!sorted.length) return 0;
    const sep = resolutionNm && resolutionNm > 0 ? resolutionNm : 0.01;
    let last = null, count = 0;
    sorted.forEach(function (nm) {
      if (last === null || nm - last >= sep) { count += 1; last = nm; }
    });
    return count;
  }
  function matching(peaks, anchors, strict, review, range, pixelAnchors) {
    const used = new Set();
    const accepted = [], possible = [], expected = [];
    const valid = (Array.isArray(anchors) ? anchors : []).filter(function (a) {
      const nm = finite(a && a.nm);
      return nm !== null && (!range || nm >= range.min && nm <= range.max);
    });
    // Strongest diagnostic references first, to prevent one observation being
    // counted twice when two references overlap within one resolution element.
    const sorted = valid.slice().sort(function (a, b) {
      return (finite(b.weight) ?? 1) - (finite(a.weight) ?? 1);
    });
    sorted.forEach(function (a) {
      const ref = Number(a.nm);
      const emitter = key(a.emitter || a.species);
      const direct = emitter === key(a.species);
      expected.push({ referenceNm: ref, emitter: emitter, group: key(a.group),
        direct: direct, weight: finite(a.weight) ?? 1 });
      let best = null;
      peaks.forEach(function (peak) {
        const index = finite(peak.index);
        const nm = finite(peak.nm);
        if (index === null || nm === null || used.has(index)) return;
        const delta = nm - ref;
        if (Math.abs(delta) > review) return;
        const prominent = strength(peak);
        // Primary selection: strict before review, then reference residual
        // normalized by tolerance, then observed prominence.
        const within = Math.abs(delta) <= strict + 1e-9;
        const quality = (within ? 10 : 0) +
          1 - Math.abs(delta) / review + Math.min(1, prominent / 200) * 0.01;
        if (!best || quality > best.quality) best = { index: index, nm: nm,
          delta: delta, prominent: prominent, within: within, quality: quality };
      });
      if (!best) return;
      used.add(best.index);
      const extrapolated = pixelAnchors &&
        finite(pixelAnchors.min) !== null && finite(pixelAnchors.max) !== null
        ? best.index < pixelAnchors.min || best.index > pixelAnchors.max : null;
      const hit = {
        referenceNm: round(ref, 3), observedNm: round(best.nm, 4),
        deltaNm: round(best.delta, 4), peakIndex: best.index,
        prominence: round(best.prominent, 3), emitter: emitter,
        group: key(a.group), direct: direct,
        calibrationExtrapolated: extrapolated,
        accepted: best.within, excludedFromScoring: !best.within
      };
      if (best.within) accepted.push(hit);
      else possible.push(hit);
    });
    return { accepted: accepted, possible: possible, expected: expected };
  }

  function profileAssessment(species, profile, peaks, config) {
    const anchors = (Array.isArray(profile.anchors) ? profile.anchors : []).map(function (anchor) {
      return Object.assign({}, anchor, { species: key(species) });
    });
    const match = matching(peaks, anchors, config.strict, config.review,
      config.range, config.pixelAnchors);
    const accepted = match.accepted;
    const inAnchor = accepted.filter(function (hit) { return hit.calibrationExtrapolated !== true; });
    const min = Math.max(2, finite(profile.minimumStrongEvidence) || 2);
    const unique = independent(accepted, config.resolution);
    const direct = accepted.filter(function (hit) { return hit.direct; });
    const directInAnchor = inAnchor.filter(function (hit) { return hit.direct; });
    const expectedDirect = match.expected.filter(function (item) { return item.direct; });
    const presentGroupCount = {};
    accepted.forEach(function (hit) {
      if (hit.group) presentGroupCount[hit.group] = (presentGroupCount[hit.group] || 0) + 1;
    });
    const required = (Array.isArray(profile.requiredGroups) ? profile.requiredGroups : []);
    const requiredMin = profile.requiredGroupMinimums || {};
    const requiredGroupsMet = required.every(function (group) {
      const inRange = match.expected.some(function (item) { return item.group === group; });
      return !inRange || (presentGroupCount[group] || 0) >=
        Math.max(1, finite(requiredMin[group]) || 1);
    });
    const activeGroupCount = new Set(match.expected.map(function (a) { return a.group; })
      .filter(Boolean)).size;
    const groupCount = Object.keys(presentGroupCount).length;
    const groupsNeeded = Math.min(activeGroupCount,
      Math.max(0, finite(profile.minimumEvidenceGroups) || 0));
    const profileSupported = unique >= min && groupCount >= groupsNeeded && requiredGroupsMet;
    const independentDirect = independent(directInAnchor, config.resolution);
    const directExpected = expectedDirect.length;
    const directMatched = direct.length;
    // All discharge fragments may have different parent gases. Two distinct
    // in-anchor references of the parent emitter are needed for a persuasive
    // source-pattern claim; there is no magic name-/wavelength-based override.
    const parentPatternSupported = profileSupported && independentDirect >= 2;
    const directCoverage = directExpected ? directMatched / directExpected : 0;
    const expectedCoverage = match.expected.length
      ? accepted.length / match.expected.length : 0;
    const explained = accepted.reduce(function (sum, h) { return sum + h.prominence; }, 0) /
      config.totalProminence;
    const medianResidual = accepted.length
      ? accepted.map(function (h) { return Math.abs(h.deltaNm); })
        .sort(function (a, b) { return a - b; })[Math.floor(accepted.length / 2)] : null;
    // Relative evidence score for ordering *source hypotheses*, not a gas
    // probability or concentration estimate. No absolute source promotion.
    const evidenceScore = Math.round(100 * (
      Math.min(1, unique / Math.max(2, min)) * 0.25 +
      expectedCoverage * 0.2 + directCoverage * 0.25 +
      Math.min(1, explained) * 0.15 +
      (requiredGroupsMet ? 0.10 : 0) +
      (parentPatternSupported ? 0.05 : 0)
    ));
    return {
      species: key(species), emitterPattern: key(profile.label || species),
      status: parentPatternSupported ? 'source-pattern-supported'
        : profileSupported ? 'fragment-or-indirect-pattern'
          : accepted.length ? 'partial-pattern' : 'not-observed',
      parentGasConfirmed: false,
      parentPatternSupported: parentPatternSupported,
      profileSupported: profileSupported,
      acceptedCount: accepted.length,
      independentAcceptedCount: unique,
      directEmitterCount: directMatched,
      independentDirectCount: independentDirect,
      expectedDirectCount: directExpected,
      missingDirectCount: Math.max(0, directExpected - directMatched),
      inAnchorCount: inAnchor.length,
      expectedWithinRange: match.expected.length,
      requiredGroupsMet: requiredGroupsMet,
      evidenceGroups: Object.keys(presentGroupCount),
      evidenceScore: evidenceScore,
      medianResidualNm: round(medianResidual, 3),
      accepted: accepted, possible: match.possible
    };
  }

  function aggregateEmitters(profiles, rows, acceptedHits, resolutionNm) {
    const grouped = Object.create(null);
    function add(emitter, hit, from) {
      const name = key(emitter);
      if (!name) return;
      const bucket = grouped[name] || (grouped[name] = { name: name, hits: [], sources: new Set() });
      if (bucket.hits.some(function (existing) {
        return existing.peakIndex === hit.peakIndex &&
          Math.abs(existing.referenceNm - hit.referenceNm) < 0.08;
      })) return;
      bucket.hits.push(hit);
      bucket.sources.add(from);
    }
    profiles.forEach(function (profile) {
      profile.accepted.forEach(function (hit) { add(hit.emitter, hit, profile.species); });
      // Possible near-miss references are deliberately excluded here.
    });
    // Atomic fingerprint rows provide direct emitter evidence even when no
    // curated parent-gas fingerprint includes those wavelengths.
    const qualified = new Set(rows.filter(function (row) {
      return row && String(row.mode || '').toLowerCase() === 'atomic' &&
        Number(row.matchedPeaks || row.matchedCount || 0) >= 2;
    }).map(function (row) { return key(row.element); }));
    acceptedHits.forEach(function (hit) {
      if (!hit || !qualified.has(key(hit.element)) ||
          hit.excludedFromScoring === true || hit.accepted === false) return;
      const ref = finite(hit.referenceNm), obs = finite(hit.observedNm);
      const peak = finite(hit.peakIndex);
      if (ref === null || obs === null || peak === null) return;
      add(key(hit.species || hit.element), {
        referenceNm: ref, observedNm: obs, peakIndex: peak,
        prominence: finite(hit.prominence) ?? 0, accepted: true
      }, key(hit.element));
    });
    return Object.values(grouped).map(function (item) {
      const peaks = new Map();
      item.hits.forEach(function (h) {
        const prev = peaks.get(h.peakIndex);
        if (!prev || Math.abs(h.observedNm - h.referenceNm) <
            Math.abs(prev.observedNm - prev.referenceNm)) peaks.set(h.peakIndex, h);
      });
      const observations = Array.from(peaks.values());
      const independentCount = independent(observations, resolutionNm);
      const totalProminence = observations.reduce(function (sum, h) {
        return sum + (finite(h.prominence) ?? 0);
      }, 0);
      return { emitter: item.name, acceptedCount: observations.length,
        independentCount: independentCount,
        measuredProminence: round(totalProminence, 3),
        status: independentCount >= 2 ? 'coherent-emitter' : 'single-feature',
        // A characteristic emitter is NOT identical to a parent-gas claim.
        parentGasConfirmed: false
      };
    }).sort(function (a, b) {
      return b.independentCount - a.independentCount ||
        b.measuredProminence - a.measuredProminence;
    }).slice(0, 12);
  }

  function assess(result, frame) {
    if (!result || result.ok !== true || result.calibrated !== true ||
        String(result.presetId || '') !== 'smart-gastube') return result;
    const catalog = root.SPECTRA_PRO_plasmaProfiles && root.SPECTRA_PRO_plasmaProfiles.profiles;
    if (!catalog || !Object.keys(catalog).length) return result;
    const excluded = new Set((Array.isArray(result.diffractionCandidates) ? result.diffractionCandidates : [])
      .map(function (x) { return finite(x && x.childSampleIndex); }).filter(function (n) { return n !== null; }));
    const peaks = (Array.isArray(result.peaks) ? result.peaks : []).filter(function (p) {
      return !excluded.has(finite(p && p.index)) && finite(p && p.nm) !== null;
    });
    const rows = Array.isArray(result.elementScores) ? result.elementScores : [];
    const winner = rows[0] || null;
    const candidate = key(winner && winner.element);
    const strict = Math.min(1.8, Math.max(0.2, finite(result.hardMatchCapNm) ??
      finite(result.maxDistanceNm) ?? 1.8));
    const pixelAnchors = result.calibrationDiagnostics && result.calibrationDiagnostics.anchorPixelCoverage;
    const measuredResolution = finite(result.instrumentResolutionModel &&
      result.instrumentResolutionModel.effectiveResolutionFwhmNm);
    const sampling = finite(result.calibrationDiagnostics &&
      result.calibrationDiagnostics.samplingNmPerPixel);
    const resolution = measuredResolution ?? (sampling === null ? 1.8 : sampling * 2);
    const range = rangeOf(frame, result, peaks);
    const config = { strict: strict, review: Math.min(3, strict + 1.2),
      pixelAnchors: pixelAnchors, range: range,
      resolution: Math.max(0.2, resolution),
      totalProminence: Math.max(1, peaks.reduce(function (sum, p) { return sum + strength(p); }, 0)) };
    const assessed = Object.keys(catalog).map(function (species) {
      return profileAssessment(species, catalog[species], peaks, config);
    });
    const profile = assessed.find(function (a) { return a.species === candidate; });
    const emitters = aggregateEmitters(assessed, rows,
      Array.isArray(result.topHits) ? result.topHits : [], config.resolution);
    // Only profile-based parent-gas hypotheses are subject to the special
    // "parent" gate. Directly matched atomic emitters remain reportable under
    // the general atomic evidence requirements.
    const sourceCandidate = profile && (profile.profileSupported ||
      profile.acceptedCount > 0);
    const parentStatus = !candidate ? 'insufficient-evidence'
      : !sourceCandidate ? 'atomic-or-unprofiled-emitter'
        : profile.parentPatternSupported ? 'source-pattern-supported'
          : profile.profileSupported ? 'unresolved-indirect-emission'
            : 'unresolved-insufficient-profile-evidence';
    const reportable = !sourceCandidate || profile.parentPatternSupported;
    result.gasTubeSourceAssessment = {
      model: MODEL, candidate: candidate || null,
      parentGasStatus: parentStatus,
      parentGasConfirmed: false,
      reportable: reportable,
      reason: !sourceCandidate ? 'emitter-identity-not-parent-gas-proof'
        : profile.parentPatternSupported ? 'direct-source-pattern-supported'
          : profile.profileSupported ? 'emission-products-do-not-prove-parent-gas'
            : 'insufficient-independent-parent-profile-evidence',
      emittingSpecies: emitters,
      // Summaries use all catalog profiles, not the ground-truth label.
      sourceCandidates: assessed.filter(function (a) {
        return a.acceptedCount > 0;
      }).sort(function (a, b) {
        return b.evidenceScore - a.evidenceScore || b.independentAcceptedCount - a.independentAcceptedCount;
      }).slice(0, 8).map(function (a) {
        return {
          species: a.species, emitterPattern: a.emitterPattern,
          status: a.status, parentGasConfirmed: false,
          evidenceScore: a.evidenceScore, acceptedCount: a.acceptedCount,
          independentAcceptedCount: a.independentAcceptedCount,
          independentDirectCount: a.independentDirectCount,
          expectedDirectCount: a.expectedDirectCount,
          missingDirectCount: a.missingDirectCount,
          requiredGroupsMet: a.requiredGroupsMet,
          evidenceGroups: a.evidenceGroups,
          possibleCount: a.possible.length
        };
      }),
      strictToleranceNm: strict,
      reviewToleranceNm: config.review,
      reasonModel: 'same-rules-all-catalog-profiles',
      caveat: 'Observed atomic/molecular emitters and inferred discharge-tube contents are different claims. Fragment lines alone cannot establish the parent gas. Scores are relative heuristic evidence, not calibrated probabilities.'
    };
    return result;
  }
  root.SPECTRA_PRO_gasTubeSourceAssessment = {
    model: MODEL, assess: assess, profileAssessment: profileAssessment
  };
})(typeof self !== 'undefined' ? self : this);
