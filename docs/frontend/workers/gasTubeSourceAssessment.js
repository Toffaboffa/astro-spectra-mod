(function (root) {
  'use strict';

  // Emitters (atoms seen in the light) and parent gas (contents of the tube)
  // are different claims. This conservative conflict check never changes
  // atomic/molecular line scores and never turns O I into confirmed O2.
  const MODEL = 'gastube-emitter-parent-separation-v1';
  const CO_BANDS = [451.1, 483.5, 519.8, 561.0];
  const O_LINES = [777.4, 844.6];

  function number(value) {
    if (value == null || value === '' || typeof value === 'boolean') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function matchPeak(peaks, wavelength, tolerance, used) {
    let best = null;
    for (const peak of peaks) {
      const nm = number(peak && peak.nm);
      const index = number(peak && peak.index);
      if (nm === null || index === null || (used && used.has(index))) continue;
      const delta = nm - wavelength;
      if (Math.abs(delta) > tolerance) continue;
      const prom = Math.max(0, number(peak.prominence != null ? peak.prominence : peak.value) || 0);
      if (!best || Math.abs(delta) < Math.abs(best.deltaNm)) {
        best = { referenceNm: wavelength, observedNm: +nm.toFixed(4),
          deltaNm: +delta.toFixed(4), peakIndex: index, prominence: +prom.toFixed(3) };
      }
    }
    return best;
  }

  function assess(result, frame) {
    if (!result || result.ok !== true || result.calibrated !== true ||
        String(result.presetId || '') !== 'smart-gastube') return result;
    const excluded = new Set((Array.isArray(result.diffractionCandidates) ? result.diffractionCandidates : [])
      .map(function (x) { return number(x && x.childSampleIndex); }).filter(function (n) { return n !== null; }));
    const peaks = (Array.isArray(result.peaks) ? result.peaks : []).filter(function (p) {
      return !excluded.has(number(p && p.index)) && number(p && p.nm) !== null;
    });
    if (!peaks.length) return result;
    const maxProm = Math.max(1, ...peaks.map(function (p) {
      return Math.max(0, number(p.prominence != null ? p.prominence : p.value) || 0);
    }));
    const reportedCap = number(result.maxDistanceNm);
    const strict = Math.min(1.8, Math.max(0.2, reportedCap === null ? 1.8 : reportedCap));
    const pixelAnchors = result.calibrationDiagnostics && result.calibrationDiagnostics.anchorPixelCoverage;
    const coverage = frame && Array.isArray(frame.nm) ? frame.nm.map(number).filter(function (n) { return n !== null; }) : [];
    const coversOxygen = coverage.length &&
      Math.min(...coverage) <= O_LINES[0] && Math.max(...coverage) >= O_LINES[1];
    const lineHits = O_LINES.map(function (nm) {
      const hit = matchPeak(peaks, nm, nm === O_LINES[0] ? 3.0 : strict);
      if (!hit) return null;
      const accepted = Math.abs(hit.deltaNm) <= strict;
      const extrapolated = pixelAnchors &&
        number(pixelAnchors.min) !== null && number(pixelAnchors.max) !== null
        ? hit.peakIndex < Number(pixelAnchors.min) || hit.peakIndex > Number(pixelAnchors.max)
        : null;
      return Object.assign({}, hit, {
        emitter: 'O I', status: accepted ? 'strict-match' : 'possible-near-miss',
        accepted: accepted, calibrationExtrapolated: extrapolated
      });
    }).filter(Boolean);

    const used = new Set();
    const coHits = CO_BANDS.map(function (nm) {
      const hit = matchPeak(peaks, nm, strict, used);
      if (hit) used.add(hit.peakIndex);
      return hit;
    }).filter(Boolean);

    const oxygenStrong = coversOxygen && lineHits.length === 2 &&
      lineHits.every(function (hit) { return hit.prominence >= maxProm * 0.50; });
    const oxygenProm = lineHits.reduce(function (sum, hit) { return sum + hit.prominence; }, 0);
    const coProm = coHits.reduce(function (sum, hit) { return sum + hit.prominence; }, 0);
    const oxygenDominant = !!(oxygenStrong && oxygenProm >= coProm * 1.10);
    const competingCo = coHits.length >= 2;
    const rows = Array.isArray(result.elementScores) ? result.elementScores : [];
    const winner = rows[0] ? String(rows[0].element || '') : '';
    // This is a conflict veto, not a rule that converts the answer to O2.
    const contestedCo2 = winner === 'CO2' && oxygenDominant;
    const parentState = contestedCo2 && competingCo ? 'unresolved-competing-emission'
      : oxygenDominant && !competingCo ? 'unresolved-oxygen-emission'
        : winner ? 'ranked-candidate' : 'insufficient-evidence';

    result.gasTubeSourceAssessment = {
      model: MODEL, basis: 'relative-peak-prominence-not-gas-probability',
      candidate: winner || null,
      parentGasStatus: parentState,
      parentGasConfirmed: false,
      reportable: !contestedCo2,
      reason: contestedCo2 ? 'dominant-atomic-oxygen-versus-co-bands'
        : oxygenDominant ? 'atomic-oxygen-is-not-parent-gas-proof'
          : 'no-strong-atomic-oxygen-conflict',
      atomicOxygen: {
        status: oxygenStrong ? 'strong-emission-evidence' : lineHits.length ? 'partial-emission-evidence' : 'not-established',
        independentObservedFeatures: lineHits.length,
        lineHits: lineHits,
        nearMissesNotAccepted: lineHits.filter(function (h) { return !h.accepted; }).length,
        calibratedCoverageIncludesBothLines: !!coversOxygen
      },
      coBands: { referenceType: 'CO Angstrom-system candidates',
        acceptedCount: coHits.length, hits: coHits },
      oxygenDominant: oxygenDominant, oxygenProminence: +oxygenProm.toFixed(3),
      coProminence: +coProm.toFixed(3),
      caveat: 'O I emission may be a dissociation product. It does not establish an O2 tube. CO band coincidences must also be investigated; source identity remains tentative.'
    };
    return result;
  }
  root.SPECTRA_PRO_gasTubeSourceAssessment = { model: MODEL, assess: assess };
})(typeof self !== 'undefined' ? self : this);
