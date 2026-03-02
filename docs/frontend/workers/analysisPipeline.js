(function (root) {
  'use strict';
  function inferPeaks(frame, peaks){
    const nm = frame && Array.isArray(frame.nm) ? frame.nm : null;
    return (Array.isArray(peaks)?peaks:[]).map(function(p){
      const idx = Number(p.index);
      const out = Object.assign({}, p);
      if (nm && Number.isInteger(idx) && idx >= 0 && idx < nm.length && Number.isFinite(nm[idx])) out.nm = nm[idx];
      return out;
    });
  }

  function bestSignatureAlignment(peaks, signatureNm, toleranceNm) {
    const tol = Math.max(0.5, Number(toleranceNm) || 1.8);
    const arr = Array.isArray(peaks) ? peaks : [];
    const sig = Array.isArray(signatureNm) ? signatureNm.map(Number).filter(Number.isFinite) : [];
    let best = { count: 0, offset: 0, matched: [] };
    if (!arr.length || !sig.length) return best;
    for (let i = 0; i < arr.length; i += 1) {
      const obs = Number(arr[i] && arr[i].nm);
      if (!Number.isFinite(obs)) continue;
      for (let j = 0; j < sig.length; j += 1) {
        const ref = sig[j];
        const offset = obs - ref;
        const matched = [];
        let count = 0;
        for (let k = 0; k < sig.length; k += 1) {
          const target = sig[k] + offset;
          let found = null;
          for (let m = 0; m < arr.length; m += 1) {
            const nm = Number(arr[m] && arr[m].nm);
            if (!Number.isFinite(nm)) continue;
            const d = Math.abs(nm - target);
            if (d <= tol && (!found || d < found.delta)) found = { peak: arr[m], delta: d, refNm: sig[k] };
          }
          if (found) {
            count += 1;
            matched.push(found);
          }
        }
        if (count > best.count || (count === best.count && matched.length && matched.reduce(function(a,b){return a + (b.delta || 0);},0) < best.matched.reduce(function(a,b){return a + (b.delta || 0);},0))) {
          best = { count: count, offset: +offset.toFixed(3), matched: matched };
        }
      }
    }
    return best;
  }

  function buildSeededMatches(peaks, atomLines, elementKey, signatureNm, toleranceNm, boost, offsetNm) {
    const out = [];
    const tol = Math.max(0.5, Number(toleranceNm) || 1.8);
    const shift = Number(offsetNm) || 0;
    const lines = Array.isArray(atomLines) ? atomLines : [];
    const seen = Object.create(null);
    for (let i = 0; i < signatureNm.length; i += 1) {
      const targetRef = Number(signatureNm[i]);
      if (!Number.isFinite(targetRef)) continue;
      const targetObs = targetRef + shift;
      let bestPeak = null;
      for (let j = 0; j < peaks.length; j += 1) {
        const p = peaks[j];
        const nm = Number(p && p.nm);
        if (!Number.isFinite(nm)) continue;
        const d = Math.abs(nm - targetObs);
        if (d > tol) continue;
        if (!bestPeak || d < bestPeak.d || (+p.prominence || 0) > (+bestPeak.p.prominence || 0)) bestPeak = { p: p, d: d };
      }
      if (!bestPeak) continue;
      let bestLine = null;
      for (let j = 0; j < lines.length; j += 1) {
        const l = lines[j];
        if (String(l.element || '') !== String(elementKey || '')) continue;
        const d = Math.abs((+l.nm || 0) - targetRef);
        if (d > 0.35) continue;
        if (!bestLine || d < bestLine.d) bestLine = { l: l, d: d };
      }
      if (!bestLine) continue;
      const key = String(bestLine.l.speciesKey || bestLine.l.species || '') + '|' + Number(bestLine.l.nm).toFixed(3);
      if (seen[key]) continue;
      seen[key] = true;
      out.push({
        species: bestLine.l.species,
        speciesKey: bestLine.l.speciesKey || bestLine.l.species,
        refNm: bestLine.l.nm,
        obsNm: bestPeak.p.nm,
        deltaNm: +(bestPeak.p.nm - bestLine.l.nm).toFixed(3),
        peakIndex: bestPeak.p.index,
        peakValue: bestPeak.p.value,
        prominence: bestPeak.p.prominence || 0,
        rawScore: Math.max(0.9, 1 - (bestPeak.d / tol)) + boost,
        element: String(elementKey || '')
      });
    }
    return out;
  }

  function estimateOffset(matches){
    if (!Array.isArray(matches) || !matches.length) return null;
    const vals = matches.map(m => Number(m.deltaNm)).filter(Number.isFinite);
    if (!vals.length) return null;
    vals.sort((a,b)=>a-b);
    return vals[Math.floor(vals.length/2)];
  }

  function median(values) {
    const arr = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!arr.length) return null;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  function buildElementScores(ctx) {
    const matches = Array.isArray(ctx && ctx.matches) ? ctx.matches : [];
    const peaks = Array.isArray(ctx && ctx.peaks) ? ctx.peaks : [];
    const atomLines = Array.isArray(ctx && ctx.atomLines) ? ctx.atomLines : [];
    const frame = ctx && ctx.frame;
    const preferred = Array.isArray(ctx && ctx.preferredElements) ? ctx.preferredElements : [];
    const signatureProfiles = (ctx && ctx.signatureProfiles) || {};
    const hardMaxDistanceNm = Math.max(0.05, Number(ctx && ctx.hardMaxDistanceNm) || 5);
    const maxPeakProm = peaks.reduce(function (m, p) { return Math.max(m, Number((p && p.prominence) || (p && p.value) || 0) || 0); }, 0) || 1;
    const peakMap = Object.create(null);
    const frameNm = frame && Array.isArray(frame.nm) ? frame.nm.map(Number).filter(Number.isFinite) : [];
    const nmMin = frameNm.length ? Math.min.apply(null, frameNm) : 380;
    const nmMax = frameNm.length ? Math.max.apply(null, frameNm) : 780;
    const densityByElement = Object.create(null);
    const candidateSet = Object.create(null);

    for (let i = 0; i < matches.length; i += 1) {
      const m = matches[i] || {};
      const peakKey = Number.isFinite(Number(m.peakIndex)) ? String(Number(m.peakIndex)) : String(Number(m.obsNm).toFixed(3));
      if (!peakMap[peakKey]) peakMap[peakKey] = [];
      peakMap[peakKey].push(m);
      if (m.element) candidateSet[String(m.element)] = true;
    }
    for (let i = 0; i < preferred.length; i += 1) candidateSet[String(preferred[i])] = true;
    Object.keys(signatureProfiles).forEach(function (k) { candidateSet[k] = true; });
    for (let i = 0; i < atomLines.length; i += 1) {
      const line = atomLines[i] || {};
      const nm = Number(line.nm);
      const el = String(line.element || '').trim();
      if (!el || !Number.isFinite(nm) || nm < nmMin || nm > nmMax) continue;
      densityByElement[el] = (densityByElement[el] || 0) + 1;
    }

    const scores = Object.keys(candidateSet).map(function (element) {
      const elementMatches = matches.filter(function (m) { return String(m.element || '') === element; });
      const uniquePeaks = Object.create(null);
      const deltas = [];
      const contributions = [];
      let explainedProm = 0;
      let closenessSum = 0;
      let opportunisticPenalty = 0;
      for (let i = 0; i < elementMatches.length; i += 1) {
        const m = elementMatches[i] || {};
        const peakKey = Number.isFinite(Number(m.peakIndex)) ? String(Number(m.peakIndex)) : String(Number(m.obsNm).toFixed(3));
        if (uniquePeaks[peakKey]) continue;
        const contenders = (peakMap[peakKey] || []).slice().sort(function (a, b) {
          return (Number(b.rawScore) || 0) - (Number(a.rawScore) || 0);
        });
        const bestForPeak = contenders[0] || m;
        const ownScore = Number(m.rawScore) || 0;
        const bestScore = Number(bestForPeak.rawScore) || ownScore || 1;
        const share = Math.max(0.15, Math.min(1, ownScore / Math.max(0.001, bestScore)));
        const prom = Number(m.prominence || m.peakValue || 0) || 0;
        const promNorm = Math.max(0, Math.min(1, prom / maxPeakProm));
        const delta = Math.abs(Number(m.deltaNm) || 0);
        const closeNorm = Math.max(0, 1 - (delta / hardMaxDistanceNm));
        explainedProm += promNorm * share;
        closenessSum += closeNorm;
        deltas.push(delta);
        contributions.push({
          refNm: Number(m.refNm),
          obsNm: Number(m.obsNm),
          deltaNm: +delta.toFixed(3),
          prominence: prom,
          score: +(promNorm * 0.55 + closeNorm * 0.45 + share * 0.35).toFixed(4)
        });
        if (bestForPeak !== m) opportunisticPenalty += Math.max(0, 1 - share) * 0.8;
        uniquePeaks[peakKey] = true;
      }
      contributions.sort(function (a, b) { return (b.score - a.score) || (a.deltaNm - b.deltaNm); });
      const matchedPeaks = Object.keys(uniquePeaks).length;
      const totalPeaks = Math.max(1, peaks.length);
      const coverage = matchedPeaks / totalPeaks;
      const explainedShare = Math.max(0, Math.min(1.5, explainedProm / Math.max(1, matchedPeaks || 1)));
      const closenessScore = matchedPeaks ? closenessSum / matchedPeaks : 0;
      const medianDeltaNm = median(deltas);
      const sortedRefs = contributions.map(function (c) { return Number(c.refNm); }).filter(Number.isFinite).sort(function (a, b) { return a - b; });
      let clusterBonus = 0;
      for (let i = 1; i < sortedRefs.length; i += 1) {
        const gap = sortedRefs[i] - sortedRefs[i - 1];
        if (gap <= 18) clusterBonus += 0.55;
        else if (gap <= 35) clusterBonus += 0.22;
      }
      const signature = Array.isArray(signatureProfiles[element]) ? signatureProfiles[element].filter(function (nm) {
        return Number.isFinite(Number(nm)) && Number(nm) >= nmMin && Number(nm) <= nmMax;
      }) : [];
      let matchedSignature = 0;
      let missedStrong = 0;
      for (let i = 0; i < signature.length; i += 1) {
        const sigNm = Number(signature[i]);
        let ok = false;
        for (let j = 0; j < contributions.length; j += 1) {
          if (Math.abs(Number(contributions[j].refNm) - sigNm) <= 0.45) { ok = true; break; }
        }
        if (ok) matchedSignature += 1;
        else missedStrong += 1;
      }
      const diagnosticBonus = matchedSignature * 1.1;
      const density = densityByElement[element] || 0;
      const densityPenalty = Math.max(0, (Math.log(1 + density) / Math.log(2) - 2.5) * 0.33);
      const totalScore = (
        coverage * 8.5 +
        explainedShare * 5.2 +
        closenessScore * 4.4 +
        clusterBonus +
        diagnosticBonus -
        missedStrong * 0.8 -
        densityPenalty -
        opportunisticPenalty
      );
      return {
        element: element,
        totalScore: +totalScore.toFixed(3),
        matchedPeaks: matchedPeaks,
        matchCount: elementMatches.length,
        missedStrong: missedStrong,
        matchedSignature: matchedSignature,
        medianDeltaNm: medianDeltaNm == null ? null : +medianDeltaNm.toFixed(3),
        meanDeltaNm: deltas.length ? +(deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length).toFixed(3) : null,
        explainedShare: +explainedShare.toFixed(3),
        closenessScore: +closenessScore.toFixed(3),
        densityPenalty: +densityPenalty.toFixed(3),
        opportunisticPenalty: +opportunisticPenalty.toFixed(3),
        clusterBonus: +clusterBonus.toFixed(3),
        topLines: contributions.slice(0, 4).map(function (c) {
          return {
            refNm: Number.isFinite(c.refNm) ? +c.refNm.toFixed(3) : null,
            obsNm: Number.isFinite(c.obsNm) ? +c.obsNm.toFixed(3) : null,
            deltaNm: c.deltaNm,
            score: +c.score.toFixed(3)
          };
        })
      };
    }).filter(function (row) {
      return row && (row.matchedPeaks > 0 || row.matchedSignature > 0);
    }).sort(function (a, b) {
      return (b.totalScore - a.totalScore) || (b.matchedPeaks - a.matchedPeaks) || ((a.medianDeltaNm == null ? 99 : a.medianDeltaNm) - (b.medianDeltaNm == null ? 99 : b.medianDeltaNm)) || a.element.localeCompare(b.element);
    });

    const scored = scores.map(function (row) {
      return Object.assign({}, row, {
        _probWeight: Math.exp(Math.max(-8, Math.min(8, Number(row.totalScore || 0) * 0.32)))
      });
    });
    const totalProbWeight = scored.reduce(function (sum, row) {
      return sum + (Number(row._probWeight) || 0);
    }, 0) || 1;
    return scored.map(function (row, idx) {
      const likelyPct = Math.max(1, Math.min(99, Math.round(((Number(row._probWeight) || 0) / totalProbWeight) * 100)));
      const out = Object.assign({}, row, {
        rank: idx + 1,
        likelyPct: likelyPct
      });
      delete out._probWeight;
      return out;
    });
  }

  function reorderHitsForSmartMode(topHits, elementScores) {
    const hits = Array.isArray(topHits) ? topHits.slice() : [];
    const scores = Array.isArray(elementScores) ? elementScores.slice() : [];
    if (!hits.length || !scores.length) return hits;
    const winner = scores[0];
    const second = scores[1] || null;
    const allowed = Object.create(null);
    allowed[winner.element] = 0;
    if (second && second.totalScore >= winner.totalScore * 0.8) allowed[second.element] = 1;
    return hits
      .filter(function (h) { return Object.prototype.hasOwnProperty.call(allowed, String(h && h.element || '')); })
      .sort(function (a, b) {
        const ar = allowed[String(a && a.element || '')];
        const br = allowed[String(b && b.element || '')];
        return (ar - br) || ((Number(b.confidence) || 0) - (Number(a.confidence) || 0)) || (Math.abs(Number(a.deltaNm) || 0) - Math.abs(Number(b.deltaNm) || 0));
      });
  }

  function analyzeFrame(frame, state, options) {
    const peakDetect = root.SPECTRA_PRO_peakDetect;
    const peakScoring = root.SPECTRA_PRO_peakScoring;
    const qcRules = root.SPECTRA_PRO_qcRules;
    const confidenceModel = root.SPECTRA_PRO_confidenceModel;
    const lineMatcher = root.SPECTRA_PRO_lineMatcher;
    const I = frame && Array.isArray(frame.processedI)
      ? frame.processedI
      : (frame && Array.isArray(frame.I) ? frame.I : []);

    const presetId = (state && state.activePreset) ? String(state.activePreset) : '';
    const presetMap = {
      'general': { toleranceNm: 3.0, maxMatches: 10, maxPerPeak: 2 },
      'general-tight': { toleranceNm: 1.5, maxMatches: 10, maxPerPeak: 2 },
      'general-wide': { toleranceNm: 5.0, maxMatches: 12, maxPerPeak: 3 },
      'fast': { toleranceNm: 3.0, maxMatches: 8, maxPerPeak: 1 },
      'lamp-hg': {
        toleranceNm: 2.8,
        maxMatches: 18,
        maxPerPeak: 3,
        preferredElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
        elementBoost: { Hg: 0.12, Ar: 0.06, Ne: 0.06, Kr: 0.05, Xe: 0.05 }
      },
      'smart': {
        toleranceNm: 2.2,
        maxMatches: 18,
        maxPerPeak: 3,
        preferredElements: ['He', 'Hg', 'Ne', 'Ar', 'H', 'Na', 'Kr', 'Xe', 'O'],
        elementBoost: { He: 0.06, Hg: 0.05, Ne: 0.04, Ar: 0.04, H: 0.035, Na: 0.03, Kr: 0.025, Xe: 0.025, O: 0.02 }
      }
    };
    const preset = presetMap[presetId] || presetMap['general'];

    const opt = (options && typeof options === 'object') ? options : {};
    const includeWeak = !!opt.includeWeakPeaks;
    const peakThresholdRel = Number.isFinite(Number(opt.peakThresholdRel)) ? Number(opt.peakThresholdRel) : (includeWeak ? 0.02 : 0.05);
    const peakDistancePx = Number.isFinite(Number(opt.peakDistancePx)) ? Number(opt.peakDistancePx) : (includeWeak ? 3 : 5);
    const hardMaxDistanceNm = Math.max(0.2, Math.min(50, Number.isFinite(Number(opt.maxDistanceNm)) ? Number(opt.maxDistanceNm) : 5));

    const rawPeaks = peakDetect.detectPeaks(I, { prominenceWindowPx: Math.max(4, peakDistancePx * 2) });
    const peaks = inferPeaks(
      frame,
      peakScoring.scorePeaks(rawPeaks, {
        maxPeaks: includeWeak ? 96 : 56,
        minRelHeight: Math.max(0.003, Math.min(0.95, peakThresholdRel)),
        minPeakDistancePx: Math.max(1, Math.min(64, Math.round(peakDistancePx)))
      })
    );
    const nmAvailable = !!(frame && frame.calibrated && Array.isArray(frame.nm));
    let effectiveBoost = Object.assign({}, preset.elementBoost || null);
    let seededMatches = [];
    if ((presetId === 'smart' || presetId === 'lamp-hg') && nmAvailable) {
      const profiles = {
        He: [447.148, 492.193, 501.568, 587.562, 667.815, 706.519],
        Hg: [404.656, 435.833, 546.074, 576.960, 579.066],
        Ne: [540.056, 585.249, 614.306, 640.225, 703.241],
        H: [410.171, 434.047, 486.128, 656.281],
        Ar: [696.543, 706.722, 738.398, 750.387, 763.511, 772.376],
        Na: [588.995, 589.592]
      };
      const smartTol = presetId === 'smart' ? 2.4 : 2.2;
      const ranked = Object.keys(profiles).map(function (el) {
        const align = bestSignatureAlignment(peaks, profiles[el], smartTol);
        return {
          element: el,
          count: align.count,
          offset: align.offset,
          matched: align.matched,
          score: align.count * 10 - Math.min(6, Math.abs(align.offset || 0)) * 0.35 + (el === 'He' ? 1.2 : 0)
        };
      }).sort(function (a, b) {
        return (b.score - a.score) || (b.count - a.count) || (Math.abs(a.offset || 0) - Math.abs(b.offset || 0));
      });

      if (presetId === 'smart') {
        ranked.slice(0, 3).forEach(function (cand, idx) {
          if (!cand || cand.count < (idx === 0 ? 2 : 1)) return;
          const extra = cand.count >= 3 ? 0.22 : (cand.count >= 2 ? 0.14 : 0.06);
          effectiveBoost = Object.assign({}, effectiveBoost || {}, { [cand.element]: (Number((effectiveBoost || {})[cand.element]) || 0) + extra });
          if (cand.count >= 2) {
            seededMatches = seededMatches.concat(buildSeededMatches(peaks, state && state.atomLines || [], cand.element, profiles[cand.element], smartTol, extra, cand.offset));
          }
        });
      }

      const hgAlign = bestSignatureAlignment(peaks, profiles.Hg, presetId === 'smart' ? 1.8 : 2.2);
      if (presetId === 'smart' && hgAlign.count >= 3) {
        effectiveBoost = Object.assign({}, effectiveBoost || {}, { Hg: 0.38, Ar: 0.08, Ne: 0.07, Kr: 0.06, Xe: 0.06 });
      } else if (presetId === 'lamp-hg' && hgAlign.count >= 2) {
        effectiveBoost = Object.assign({}, effectiveBoost || {}, { Hg: 0.18, Ar: 0.08, Ne: 0.08, Kr: 0.06, Xe: 0.06 });
      }
    }
    const matches = nmAvailable
      ? lineMatcher.matchLines(peaks, state && state.atomLines || [], {
          toleranceNm: preset.toleranceNm,
          hardMaxDistanceNm: hardMaxDistanceNm,
          maxMatches: preset.maxMatches,
          preferredElements: preset.preferredElements || null,
          elementBoost: effectiveBoost || null,
          maxPerPeak: preset.maxPerPeak || 2,
          seededMatches: seededMatches
        })
      : [];
    const qc = qcRules.evaluateQC({ frame: frame, state: state });
    if (!nmAvailable) qc.flags = (qc.flags || []).concat(['uncalibrated']);
    const confidence = confidenceModel.buildConfidence(matches, qc);

    let maxPeak = 0;
    for (let i = 0; i < peaks.length; i += 1) {
      const v = +peaks[i].prominence || +peaks[i].value || 0;
      if (v > maxPeak) maxPeak = v;
    }
    if (!Number.isFinite(maxPeak) || maxPeak <= 0) maxPeak = 1;

    let topHits = matches.map(function(m){
      const closeness = Math.max(0, Math.min(1.2, +m.rawScore || 0));
      const strength = Math.max(0, Math.min(1, ((+m.prominence || +m.peakValue || 0) / maxPeak)));
      const base = (0.7 * Math.min(1, closeness)) + (0.3 * strength);
      const conf = Math.max(0, Math.min(1, (0.14 + 0.86 * base) * (+confidence.qcFactor || +confidence.overall || 0)));
      return {
        species: m.species,
        element: (m.element || (m.speciesKey || m.species || '').replace(/[^A-Za-z]/g,'').slice(0,2)),
        referenceNm: m.refNm,
        observedNm: m.obsNm,
        deltaNm: m.deltaNm,
        confidence: +conf.toFixed(3),
        score: +((m.rawScore || 0) * 100).toFixed(1)
      };
    });
    const signatureProfiles = {
      He: [447.148, 492.193, 501.568, 587.562, 667.815, 706.519],
      Hg: [404.656, 435.833, 546.074, 576.960, 579.066],
      Ne: [540.056, 585.249, 614.306, 640.225, 703.241],
      H: [410.171, 434.047, 486.128, 656.281],
      Ar: [696.543, 706.722, 738.398, 750.387, 763.511, 772.376],
      Na: [588.995, 589.592],
      Kr: [557.029, 587.092, 760.155],
      Xe: [467.122, 484.433, 823.163],
      O: [557.733, 630.030, 636.377, 777.194]
    };
    const elementScores = nmAvailable ? buildElementScores({
      matches: matches,
      peaks: peaks,
      atomLines: state && state.atomLines || [],
      frame: frame,
      preferredElements: preset.preferredElements || null,
      signatureProfiles: signatureProfiles,
      hardMaxDistanceNm: hardMaxDistanceNm
    }) : [];

    if (presetId === 'smart' && elementScores.length) {
      topHits = reorderHitsForSmartMode(topHits, elementScores).slice(0, 18);
    }

    return {
      ok: true,
      topHits: topHits,
      peaks: peaks.slice(0, 32),
      offsetNm: estimateOffset(matches),
      qcFlags: qc.flags || [],
      confidence: confidence.overall || 0,
      librariesLoaded: !!(state && state.librariesLoaded),
      calibrated: !!nmAvailable,
      maxDistanceNm: hardMaxDistanceNm,
      weakPeaksMode: {
        enabled: includeWeak,
        peakThresholdRel: peakThresholdRel,
        peakDistancePx: peakDistancePx,
        maxPeaks: includeWeak ? 96 : 56
      },
      elementScores: elementScores.slice(0, 8)
    };
  }
  root.SPECTRA_PRO_analysisPipeline = { analyzeFrame };
})(typeof self !== 'undefined' ? self : this);
