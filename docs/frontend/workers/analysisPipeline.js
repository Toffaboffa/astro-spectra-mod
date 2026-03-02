(function (root) {
  'use strict';

  function inferPeaks(frame, peaks) {
    const nm = frame && Array.isArray(frame.nm) ? frame.nm : null;
    return (Array.isArray(peaks) ? peaks : []).map(function (p) {
      const idx = Number(p.index);
      const out = Object.assign({}, p);
      if (nm && Number.isInteger(idx) && idx >= 0 && idx < nm.length && Number.isFinite(nm[idx])) out.nm = nm[idx];
      return out;
    });
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function median(values) {
    const arr = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!arr.length) return null;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  }

  function estimateOffset(matches) {
    if (!Array.isArray(matches) || !matches.length) return null;
    const vals = matches.map(function (m) { return Number(m.deltaNm); }).filter(Number.isFinite);
    if (!vals.length) return null;
    vals.sort(function (a, b) { return a - b; });
    return vals[Math.floor(vals.length / 2)];
  }

  function getObservedRange(frame, peaks) {
    const vals = [];
    if (frame && Array.isArray(frame.nm)) {
      for (let i = 0; i < frame.nm.length; i += 1) {
        const nm = Number(frame.nm[i]);
        if (Number.isFinite(nm)) vals.push(nm);
      }
    }
    if (!vals.length && Array.isArray(peaks)) {
      for (let i = 0; i < peaks.length; i += 1) {
        const nm = Number(peaks[i] && peaks[i].nm);
        if (Number.isFinite(nm)) vals.push(nm);
      }
    }
    if (!vals.length) return { min: 380, max: 900 };
    return { min: Math.min.apply(null, vals), max: Math.max.apply(null, vals) };
  }

  function guessObservedResolutionNm(peaks) {
    const vals = (Array.isArray(peaks) ? peaks : []).map(function (p) { return Number(p && p.nm); }).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (vals.length < 2) return 1.2;
    const diffs = [];
    for (let i = 1; i < vals.length; i += 1) {
      const d = vals[i] - vals[i - 1];
      if (d > 0.05 && d < 30) diffs.push(d);
    }
    const med = median(diffs);
    return clamp(Number.isFinite(med) ? med : 1.2, 0.4, 6.0);
  }

  function getElementFamily(element) {
    const k = String(element || '').trim();
    const noble = { He: 1, Ne: 1, Ar: 1, Kr: 1, Xe: 1 };
    const lamp = { Hg: 1, Ar: 1, Ne: 1, Kr: 1, Xe: 1 };
    const flame = { Na: 1, K: 1, Li: 1, Ca: 1, Sr: 1, Ba: 1, Cu: 1, B: 1, C: 1, H: 1, O: 1 };
    if (noble[k]) return 'noble';
    if (lamp[k]) return 'lamp';
    if (flame[k]) return 'flame';
    return 'generic';
  }

  function getPresetConfig(rawPresetId) {
    const presetAliasMap = {
      general: 'nearest',
      'general-wide': 'wide',
      'general-tight': 'tight',
      smart: 'smart-atomic'
    };
    const presetId = presetAliasMap[String(rawPresetId || '').trim()] || String(rawPresetId || 'nearest').trim() || 'nearest';
    const configs = {
      nearest: { type: 'base', toleranceNm: 3.0, maxMatches: 10, maxPerPeak: 2 },
      tight: { type: 'base', toleranceNm: 1.5, maxMatches: 10, maxPerPeak: 2 },
      wide: { type: 'base', toleranceNm: 5.0, maxMatches: 14, maxPerPeak: 3 },
      fast: { type: 'base', toleranceNm: 3.0, maxMatches: 8, maxPerPeak: 1 },
      'lamp-hg': {
        type: 'base',
        toleranceNm: 2.8,
        maxMatches: 18,
        maxPerPeak: 3,
        allowedElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
        preferredElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
        familyWeights: { lamp: 1.12, noble: 1.06 }
      },
      'smart-atomic': {
        type: 'smart', mode: 'atomic',
        toleranceNm: 2.4, maxMatches: 140, maxPerPeak: 4,
        allowedElements: ['H', 'He', 'Ne', 'Ar', 'Kr', 'Xe', 'C', 'N', 'O', 'Na', 'Hg'],
        familyWeights: { noble: 1.18, lamp: 1.12, generic: 0.84 },
        candidateLimit: 8
      },
      'smart-molecular': {
        type: 'smart', mode: 'molecular',
        toleranceNm: 2.8, maxMatches: 160, maxPerPeak: 5,
        allowedMolecules: ['N2', 'O2', 'CN', 'CH', 'C2', 'OH'],
        familyWeights: { molecular: 1.18 },
        candidateLimit: 8
      },
      'smart-gastube': {
        type: 'smart', mode: 'mixture',
        toleranceNm: 2.6, maxMatches: 180, maxPerPeak: 5,
        allowedElements: ['H', 'He', 'Ne', 'Ar', 'Kr', 'Xe', 'Hg', 'N', 'O', 'C', 'Na'],
        allowedMolecules: ['N2', 'O2'],
        familyWeights: { noble: 1.18, lamp: 1.15, generic: 0.9, molecular: 1.05 },
        candidateLimit: 10
      },
      'smart-flame': {
        type: 'smart', mode: 'mixture',
        toleranceNm: 2.8, maxMatches: 180, maxPerPeak: 5,
        allowedElements: ['Na', 'K', 'Li', 'Ca', 'Sr', 'Ba', 'Cu', 'B', 'C', 'H', 'O'],
        allowedMolecules: ['O2', 'OH', 'CH', 'CN', 'C2'],
        familyWeights: { flame: 1.2, generic: 0.9, molecular: 1.12 },
        candidateLimit: 10
      },
      'smart-fluorescent': {
        type: 'smart', mode: 'mixture',
        toleranceNm: 2.6, maxMatches: 170, maxPerPeak: 5,
        allowedElements: ['Hg', 'Ar', 'Ne', 'Kr', 'Xe'],
        allowedMolecules: ['O2'],
        familyWeights: { lamp: 1.2, noble: 1.12, molecular: 0.94 },
        candidateLimit: 8
      }
    };
    return Object.assign({ id: presetId }, configs[presetId] || configs.nearest);
  }

  function filterAtomicLines(atomLines, presetCfg, range) {
    const allowed = Array.isArray(presetCfg.allowedElements) && presetCfg.allowedElements.length ? Object.create(null) : null;
    if (allowed) presetCfg.allowedElements.forEach(function (el) { allowed[String(el)] = true; });
    const minNm = Number(range && range.min) || 380;
    const maxNm = Number(range && range.max) || 900;
    return (Array.isArray(atomLines) ? atomLines : []).filter(function (line) {
      const nm = Number(line && line.nm);
      const el = String(line && line.element || '').trim();
      if (!Number.isFinite(nm) || !el) return false;
      if (nm < minNm - 2 || nm > maxNm + 2) return false;
      if (allowed && !allowed[el]) return false;
      return true;
    });
  }

  function filterMolecularBands(molecularBands, presetCfg, range) {
    const allowed = Array.isArray(presetCfg.allowedMolecules) && presetCfg.allowedMolecules.length ? Object.create(null) : null;
    if (allowed) presetCfg.allowedMolecules.forEach(function (el) { allowed[String(el)] = true; });
    const minNm = Number(range && range.min) || 380;
    const maxNm = Number(range && range.max) || 900;
    return (Array.isArray(molecularBands) ? molecularBands : []).filter(function (band) {
      const lo = Number(band && band.minNm);
      const hi = Number(band && band.maxNm);
      const species = String((band && band.species) || (band && band.element) || '').trim();
      if (!species || !Number.isFinite(lo) || !Number.isFinite(hi)) return false;
      if (hi < minNm - 4 || lo > maxNm + 4) return false;
      if (allowed && !allowed[species]) return false;
      return true;
    });
  }

  function buildMolecularMatches(peaks, molecularBands, hardMaxDistanceNm) {
    const out = [];
    const arr = Array.isArray(peaks) ? peaks : [];
    const bands = Array.isArray(molecularBands) ? molecularBands : [];
    const hardMax = Math.max(0.2, Number(hardMaxDistanceNm) || 5);
    const seen = Object.create(null);
    for (let i = 0; i < bands.length; i += 1) {
      const band = bands[i] || {};
      const species = String(band.species || band.element || '').trim();
      if (!species) continue;
      const lo = Number(band.minNm);
      const hi = Number(band.maxNm);
      const refNm = Number(band.refNm);
      if (!Number.isFinite(lo) || !Number.isFinite(hi)) continue;
      let best = null;
      let localCount = 0;
      let localProm = 0;
      for (let j = 0; j < arr.length; j += 1) {
        const p = arr[j] || {};
        const nm = Number(p.nm);
        if (!Number.isFinite(nm)) continue;
        const inRange = nm >= lo && nm <= hi;
        const edgeDelta = inRange ? 0 : Math.min(Math.abs(nm - lo), Math.abs(nm - hi));
        if (!inRange && edgeDelta > hardMax) continue;
        const prom = Number(p.prominence || p.value || 0) || 0;
        if (inRange) {
          localCount += 1;
          localProm += prom;
        }
        const rangeMid = Number.isFinite(refNm) ? refNm : ((lo + hi) / 2);
        const delta = Math.abs(nm - rangeMid);
        const rangeSpan = Math.max(0.8, (hi - lo) / 2);
        const closeness = Math.max(0, 1 - (delta / Math.max(rangeSpan, hardMax)));
        const candidate = { p: p, closeness: closeness, prom: prom, delta: delta };
        if (!best || candidate.prom > best.prom || (candidate.prom === best.prom && candidate.closeness > best.closeness)) best = candidate;
      }
      if (!best) continue;
      const key = species + '|' + (Number.isFinite(refNm) ? refNm.toFixed(2) : ((lo + hi) / 2).toFixed(2)) + '|' + String(best.p.index);
      if (seen[key]) continue;
      seen[key] = true;
      out.push({
        species: species,
        speciesKey: species,
        refNm: Number.isFinite(refNm) ? refNm : +(((lo + hi) / 2).toFixed(3)),
        obsNm: Number(best.p.nm),
        deltaNm: +(Number(best.p.nm) - (Number.isFinite(refNm) ? refNm : ((lo + hi) / 2))).toFixed(3),
        peakIndex: best.p.index,
        peakValue: best.p.value,
        prominence: best.prom,
        rawScore: +(0.35 + best.closeness * 0.45 + Math.min(0.35, localCount * 0.06)).toFixed(4),
        element: species,
        kind: 'molecular-band',
        bandMinNm: +lo.toFixed(3),
        bandMaxNm: +hi.toFixed(3),
        bandPeakCount: localCount,
        bandProminence: +localProm.toFixed(3)
      });
    }
    return out;
  }

  function buildAtomicProfiles(atomLines, range, hardMaxDistanceNm, resolutionNm) {
    const lines = Array.isArray(atomLines) ? atomLines : [];
    const minNm = Number(range && range.min) || 380;
    const maxNm = Number(range && range.max) || 900;
    const uniqWindow = Math.max(0.8, Math.min(2.5, Number(hardMaxDistanceNm) || 1.5));
    const sepWindow = Math.max(0.7, Math.min(6.0, Number(resolutionNm) || 1.2));
    const byElement = Object.create(null);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] || {};
      const nm = Number(line.nm);
      const el = String(line.element || '').trim();
      if (!el || !Number.isFinite(nm)) continue;
      if (nm < minNm - 1 || nm > maxNm + 1) continue;
      let nearbyElements = Object.create(null);
      nearbyElements[el] = true;
      for (let j = 0; j < lines.length; j += 1) {
        if (i === j) continue;
        const other = lines[j] || {};
        const onm = Number(other.nm);
        const oel = String(other.element || '').trim();
        if (!oel || !Number.isFinite(onm)) continue;
        if (Math.abs(onm - nm) <= uniqWindow) nearbyElements[oel] = true;
      }
      const lineUniq = 1 / Math.max(1, Object.keys(nearbyElements).length);
      if (!byElement[el]) byElement[el] = [];
      byElement[el].push({ nm: nm, element: el, species: String(line.species || el), uniqueness: lineUniq });
    }

    const profiles = Object.create(null);
    Object.keys(byElement).forEach(function (el) {
      const arr = byElement[el].slice().sort(function (a, b) {
        return (b.uniqueness - a.uniqueness) || (a.nm - b.nm);
      });
      const expected = [];
      for (let i = 0; i < arr.length; i += 1) {
        const ln = arr[i];
        let tooClose = false;
        for (let j = 0; j < expected.length; j += 1) {
          if (Math.abs(expected[j].nm - ln.nm) < sepWindow * 0.9) { tooClose = true; break; }
        }
        if (!tooClose) expected.push(ln);
        if (expected.length >= 14) break;
      }
      expected.sort(function (a, b) { return a.nm - b.nm; });
      const groups = [];
      let current = [];
      for (let i = 0; i < expected.length; i += 1) {
        const ln = expected[i];
        if (!current.length || Math.abs(ln.nm - current[current.length - 1].nm) <= Math.max(8, sepWindow * 4)) {
          current.push(ln.nm);
        } else {
          if (current.length >= 2) groups.push(current.slice());
          current = [ln.nm];
        }
      }
      if (current.length >= 2) groups.push(current.slice());
      profiles[el] = {
        element: el,
        expected: expected,
        density: byElement[el].length / Math.max(20, (maxNm - minNm)),
        groups: groups,
        family: getElementFamily(el)
      };
    });
    return profiles;
  }

  function buildMolecularProfiles(molecularBands, range) {
    const bands = Array.isArray(molecularBands) ? molecularBands : [];
    const minNm = Number(range && range.min) || 380;
    const maxNm = Number(range && range.max) || 900;
    const bySpecies = Object.create(null);
    for (let i = 0; i < bands.length; i += 1) {
      const b = bands[i] || {};
      const species = String(b.species || b.element || '').trim();
      const lo = Number(b.minNm);
      const hi = Number(b.maxNm);
      const ref = Number(b.refNm);
      if (!species || !Number.isFinite(lo) || !Number.isFinite(hi)) continue;
      if (hi < minNm - 2 || lo > maxNm + 2) continue;
      if (!bySpecies[species]) bySpecies[species] = [];
      bySpecies[species].push({ minNm: lo, maxNm: hi, refNm: Number.isFinite(ref) ? ref : ((lo + hi) / 2) });
    }
    Object.keys(bySpecies).forEach(function (k) {
      bySpecies[k].sort(function (a, b) { return a.refNm - b.refNm; });
    });
    return bySpecies;
  }

  function discoverCandidates(matches, limit) {
    const grouped = Object.create(null);
    (Array.isArray(matches) ? matches : []).forEach(function (m) {
      const el = String(m && (m.element || m.speciesKey || m.species) || '').trim();
      if (!el) return;
      if (!grouped[el]) grouped[el] = { element: el, score: 0, count: 0 };
      grouped[el].score += Number(m.rawScore || 0);
      grouped[el].count += 1;
    });
    return Object.keys(grouped).map(function (k) { return grouped[k]; }).sort(function (a, b) {
      return (b.score - a.score) || (b.count - a.count) || String(a.element).localeCompare(String(b.element));
    }).slice(0, Math.max(3, Math.min(12, Number(limit) || 8)));
  }

  function scoreAtomicCandidate(element, profiles, matches, peaks, hardMaxDistanceNm, familyWeights) {
    const profile = profiles[element];
    if (!profile) return null;
    const arr = matches.filter(function (m) { return String(m.element || '') === element && (!m.kind || m.kind === 'atom'); });
    const peakMap = Object.create(null);
    const matchMap = Object.create(null);
    const deltas = [];
    let matchedExpected = 0;
    let closenessScore = 0;
    let uniquenessScore = 0;
    let explainedProm = 0;
    const maxProm = Math.max(1, (Array.isArray(peaks) ? peaks : []).reduce(function (m, p) { return Math.max(m, Number((p && p.prominence) || (p && p.value) || 0) || 0); }, 0));
    arr.forEach(function (m) {
      const peakKey = Number.isFinite(Number(m.peakIndex)) ? String(Number(m.peakIndex)) : String(Number(m.obsNm).toFixed(3));
      if (!peakMap[peakKey] || Number(m.rawScore || 0) > Number(peakMap[peakKey].rawScore || 0)) peakMap[peakKey] = m;
    });
    const uniqueMatches = Object.keys(peakMap).map(function (k) { return peakMap[k]; }).sort(function (a, b) {
      return (Number(b.rawScore || 0) - Number(a.rawScore || 0)) || (Number(b.prominence || 0) - Number(a.prominence || 0));
    });

    profile.expected.forEach(function (ln) {
      let best = null;
      for (let i = 0; i < uniqueMatches.length; i += 1) {
        const m = uniqueMatches[i];
        const d = Math.abs(Number(m.obsNm) - Number(ln.nm));
        if (d > hardMaxDistanceNm) continue;
        if (!best || d < best.delta) best = { match: m, delta: d };
      }
      if (best) {
        matchedExpected += 1;
        deltas.push(best.delta);
        const closeNorm = Math.max(0, 1 - (best.delta / Math.max(0.4, hardMaxDistanceNm)));
        closenessScore += closeNorm;
        uniquenessScore += Number(ln.uniqueness || 0);
        explainedProm += Number(best.match.prominence || best.match.peakValue || 0) || 0;
        matchMap[String(ln.nm.toFixed(3))] = best.match;
      }
    });

    let groupBonus = 0;
    for (let g = 0; g < profile.groups.length; g += 1) {
      const group = profile.groups[g];
      let local = 0;
      for (let i = 0; i < group.length; i += 1) {
        if (matchMap[String(Number(group[i]).toFixed(3))]) local += 1;
      }
      if (local >= 2) groupBonus += 0.5 + (local - 2) * 0.25;
    }

    const matchedPeakCount = uniqueMatches.length;
    const missedExpected = Math.max(0, profile.expected.length - matchedExpected);
    const densityPenalty = Math.min(2.4, Math.max(0, (profile.density - 0.05) * 14));
    const familyWeight = Number((familyWeights || {})[profile.family] || (familyWeights || {}).generic || 1) || 1;
    const score = familyWeight * (
      matchedExpected * 2.7 +
      matchedPeakCount * 0.8 +
      closenessScore * 1.6 +
      uniquenessScore * 3.4 +
      groupBonus * 1.8 +
      (explainedProm / maxProm) * 0.55
    ) - missedExpected * 0.75 - densityPenalty;

    return {
      element: element,
      totalScore: +score.toFixed(3),
      matchedCount: matchedPeakCount,
      matchedExpected: matchedExpected,
      missedStrong: missedExpected,
      medianDeltaNm: +(Number(median(deltas) || 0).toFixed(3)),
      avgDeltaNm: +(deltas.length ? (deltas.reduce(function (a, b) { return a + b; }, 0) / deltas.length) : 0).toFixed(3),
      explainedProm: +explainedProm.toFixed(3),
      explainedIntensityPct: +Math.min(100, ((explainedProm / maxProm) * 100)).toFixed(1),
      supportLines: profile.expected.filter(function (ln) { return matchMap[String(Number(ln.nm).toFixed(3))]; }).slice(0, 6).map(function (ln) { return ln.nm; }),
      family: profile.family,
      mode: 'atomic'
    };
  }

  function scoreMolecularCandidate(species, profiles, matches, peaks, hardMaxDistanceNm, familyWeights) {
    const profile = profiles[species];
    if (!profile || !profile.length) return null;
    const arr = matches.filter(function (m) { return String(m.element || '') === species && String(m.kind || '') === 'molecular-band'; });
    const maxProm = Math.max(1, (Array.isArray(peaks) ? peaks : []).reduce(function (m, p) { return Math.max(m, Number((p && p.prominence) || (p && p.value) || 0) || 0); }, 0));
    let matchedBands = 0;
    let coveredPeakCount = 0;
    let explainedProm = 0;
    let deltaVals = [];
    profile.forEach(function (band) {
      let best = null;
      let peaksInside = 0;
      let promInside = 0;
      for (let i = 0; i < peaks.length; i += 1) {
        const p = peaks[i] || {};
        const nm = Number(p.nm);
        if (!Number.isFinite(nm)) continue;
        const inRange = nm >= band.minNm && nm <= band.maxNm;
        if (inRange) {
          peaksInside += 1;
          promInside += Number(p.prominence || p.value || 0) || 0;
        }
      }
      for (let i = 0; i < arr.length; i += 1) {
        const m = arr[i];
        if (Math.abs(Number(m.refNm) - Number(band.refNm)) > Math.max(hardMaxDistanceNm * 1.2, 3.5)) continue;
        const delta = Math.abs(Number(m.obsNm) - Number(band.refNm));
        if (!best || delta < best.delta) best = { match: m, delta: delta, peaksInside: peaksInside, promInside: promInside };
      }
      if (best) {
        matchedBands += 1;
        coveredPeakCount += best.peaksInside;
        explainedProm += best.promInside;
        deltaVals.push(best.delta);
      }
    });
    const missed = Math.max(0, profile.length - matchedBands);
    const familyWeight = Number((familyWeights || {}).molecular || 1) || 1;
    const score = familyWeight * (
      matchedBands * 3.2 +
      Math.min(6, coveredPeakCount) * 0.85 +
      Math.min(8, explainedProm / maxProm) * 0.55
    ) - missed * 0.45;
    return {
      element: species,
      totalScore: +score.toFixed(3),
      matchedCount: matchedBands,
      matchedExpected: matchedBands,
      missedStrong: missed,
      medianDeltaNm: +(Number(median(deltaVals) || 0).toFixed(3)),
      avgDeltaNm: +(deltaVals.length ? (deltaVals.reduce(function (a, b) { return a + b; }, 0) / deltaVals.length) : 0).toFixed(3),
      explainedProm: +explainedProm.toFixed(3),
      explainedIntensityPct: +Math.min(100, ((explainedProm / maxProm) * 100)).toFixed(1),
      supportLines: profile.slice(0, 6).map(function (b) { return b.refNm; }),
      family: 'molecular',
      mode: 'molecular'
    };
  }


  function addExplainedPeakMetrics(row, peaks, matches) {
    const out = Object.assign({}, row || {});
    const peakArr = Array.isArray(peaks) ? peaks : [];
    const relevant = (Array.isArray(matches) ? matches : []).filter(function (m) {
      return String(m && (m.element || m.speciesKey || m.species) || '') === String(out.element || '');
    });
    const usedPeakKeys = Object.create(null);
    relevant.forEach(function (m) {
      const key = Number.isFinite(Number(m && m.peakIndex)) ? String(Number(m.peakIndex)) : (Number.isFinite(Number(m && m.obsNm)) ? Number(m.obsNm).toFixed(3) : '');
      if (key) usedPeakKeys[key] = true;
    });
    const totalPeaks = peakArr.length || 1;
    const explainedPeaks = Object.keys(usedPeakKeys).length;
    out.explainedPeaks = explainedPeaks;
    out.explainedPeaksPct = +Math.min(100, (explainedPeaks / totalPeaks) * 100).toFixed(1);
    out.matchedPeaks = Number.isFinite(Number(out.matchedCount)) ? Number(out.matchedCount) : explainedPeaks;
    out.matchCount = out.matchedPeaks;
    out.explainedShare = Number.isFinite(Number(out.explainedIntensityPct)) ? +(Number(out.explainedIntensityPct) / 100).toFixed(4) : 0;
    out.closenessScore = Number.isFinite(Number(out.medianDeltaNm)) ? +Math.max(0, 1 - (Number(out.medianDeltaNm) / 5)).toFixed(4) : 0;
    return out;
  }

  function buildWinnerBreakdown(presetCfg, elementScores, matches) {
    const scores = Array.isArray(elementScores) ? elementScores.slice() : [];
    if (!scores.length) return null;
    const winner = scores[0];
    const kind = String((presetCfg && presetCfg.id) || '');
    const related = (Array.isArray(matches) ? matches : []).filter(function (m) {
      return String(m && (m.element || m.speciesKey || m.species) || '') === String(winner.element || '');
    }).sort(function (a, b) {
      return (Number(b.prominence || b.peakValue || 0) - Number(a.prominence || a.peakValue || 0)) || (Number(a.deltaNm || 99) - Number(b.deltaNm || 99));
    });
    const found = related.slice(0, 6).map(function (m) { return Number(m.refNm || m.obsNm); }).filter(Number.isFinite);
    const summary = {
      preset: kind,
      primaryEmitter: String(winner.element || ''),
      primaryLikelyPct: Number(winner.likelyPct || 0),
      explainedPeaksPct: Number(winner.explainedPeaksPct || 0),
      explainedIntensityPct: Number(winner.explainedIntensityPct || 0),
      expectedFound: found.slice(0, 5),
      expectedMissed: Number(winner.missedStrong || 0),
      secondaryContributors: [],
      backgroundComponents: [],
      possibleBands: []
    };
    const followers = scores.slice(1, 5);
    followers.forEach(function (row, idx) {
      const item = {
        element: String(row.element || '?'),
        likelyPct: Number(row.likelyPct || 0),
        explainedIntensityPct: Number(row.explainedIntensityPct || 0),
        explainedPeaksPct: Number(row.explainedPeaksPct || 0)
      };
      if (kind === 'smart-flame') {
        if (String(row.mode || '') === 'molecular' || /^(O2|OH|CH|CN|C2)$/i.test(String(row.element || ''))) summary.possibleBands.push(item);
        else if (idx < 2) summary.secondaryContributors.push(item);
        else summary.backgroundComponents.push(item);
      } else if (kind === 'smart-fluorescent') {
        if (/^O2$/i.test(String(row.element || ''))) summary.backgroundComponents.push(item);
        else summary.secondaryContributors.push(item);
      } else if (kind === 'smart-gastube') {
        if (String(row.mode || '') === 'molecular') summary.possibleBands.push(item);
        else summary.secondaryContributors.push(item);
      } else {
        summary.secondaryContributors.push(item);
      }
    });
    return summary;
  }

  function finalizeElementScores(scores) {
    const clean = (Array.isArray(scores) ? scores : []).filter(function (s) { return s && Number.isFinite(Number(s.totalScore)) && Number(s.totalScore) > 0; }).sort(function (a, b) {
      return (Number(b.totalScore) - Number(a.totalScore)) || (Number(b.matchedExpected || 0) - Number(a.matchedExpected || 0)) || (Number(a.medianDeltaNm || 99) - Number(b.medianDeltaNm || 99));
    });
    const sumTop = clean.slice(0, 8).reduce(function (a, b) { return a + Math.max(0, Number(b.totalScore) || 0); }, 0) || 1;
    return clean.map(function (row, idx) {
      const pct = Math.max(0, Math.round((Math.max(0, Number(row.totalScore) || 0) / sumTop) * 100));
      return Object.assign({}, row, {
        likelyPct: pct,
        rank: idx + 1,
        totalScore: +Number(row.totalScore).toFixed(1),
        matchedPeaks: Number.isFinite(Number(row.matchedCount)) ? Number(row.matchedCount) : 0,
        matchCount: Number.isFinite(Number(row.matchedCount)) ? Number(row.matchedCount) : 0
      });
    });
  }

  function selectTopHitsForSmart(topHits, elementScores, presetCfg) {
    const winners = (Array.isArray(elementScores) ? elementScores : []).slice(0, 3).map(function (s) { return String(s.element); });
    const allow = Object.create(null);
    winners.forEach(function (w) { allow[w] = true; });
    const prioritized = (Array.isArray(topHits) ? topHits : []).filter(function (h) {
      return allow[String(h.element || '')];
    }).sort(function (a, b) {
      const ia = winners.indexOf(String(a.element || ''));
      const ib = winners.indexOf(String(b.element || ''));
      return (ia - ib) || (Number(b.confidence || 0) - Number(a.confidence || 0));
    });
    if (presetCfg.id === 'smart-flame') return prioritized.slice(0, 36);
    if (presetCfg.id === 'smart-fluorescent') return prioritized.slice(0, 30);
    if (presetCfg.mode === 'molecular') return prioritized.slice(0, 18);
    if (presetCfg.mode === 'mixture') return prioritized.slice(0, 28);
    return prioritized.slice(0, 24);
  }

  function buildRefinedElementScores(ctx) {
    const atomicProfiles = buildAtomicProfiles(ctx.atomLines, ctx.range, ctx.hardMaxDistanceNm, ctx.resolutionNm);
    const molecularProfiles = buildMolecularProfiles(ctx.molecularBands, ctx.range);
    const discovery = discoverCandidates(ctx.matches, ctx.candidateLimit);
    const scores = [];
    const familyWeights = ctx.familyWeights || {};

    discovery.forEach(function (cand) {
      const element = String(cand.element || '');
      if (atomicProfiles[element] && ctx.mode !== 'molecular') {
        const scored = scoreAtomicCandidate(element, atomicProfiles, ctx.matches, ctx.peaks, ctx.hardMaxDistanceNm, familyWeights);
        if (scored) scores.push(scored);
      }
      if (molecularProfiles[element] && ctx.mode !== 'atomic') {
        const scoredMol = scoreMolecularCandidate(element, molecularProfiles, ctx.matches, ctx.peaks, ctx.hardMaxDistanceNm, familyWeights);
        if (scoredMol) scores.push(scoredMol);
      }
    });

    if (ctx.mode !== 'atomic') {
      Object.keys(molecularProfiles).forEach(function (species) {
        if (scores.some(function (s) { return String(s.element) === species; })) return;
        const scoredMol = scoreMolecularCandidate(species, molecularProfiles, ctx.matches, ctx.peaks, ctx.hardMaxDistanceNm, familyWeights);
        if (scoredMol && scoredMol.totalScore > 0) scores.push(scoredMol);
      });
    }

    const finalRows = finalizeElementScores(scores).map(function (row) {
      return addExplainedPeakMetrics(row, ctx.peaks, ctx.matches);
    });
    return finalRows;
  }

  function analyzeFrame(frame, state, options) {
    const peakDetect = root.SPECTRA_PRO_peakDetect;
    const peakScoring = root.SPECTRA_PRO_peakScoring;
    const lineMatcher = root.SPECTRA_PRO_lineMatcher;
    const qcRules = root.SPECTRA_PRO_qcRules;
    const confidenceModel = root.SPECTRA_PRO_confidenceModel;
    if (!frame || !frame.I || !peakDetect || !peakScoring || !lineMatcher) {
      return { ok: false, error: 'analysis-missing-deps' };
    }

    const I = frame.I;
    const opt = (options && typeof options === 'object') ? options : {};
    const requestedPresetId = String((opt && opt.preset) || (state && state.activePreset) || 'nearest').trim() || 'nearest';
    const presetCfg = getPresetConfig(requestedPresetId);
    const includeWeak = !!opt.includeWeakPeaks;
    const peakThresholdRel = Number.isFinite(Number(opt.peakThresholdRel)) ? Number(opt.peakThresholdRel) : (includeWeak ? 0.02 : 0.05);
    const peakDistancePx = Number.isFinite(Number(opt.peakDistancePx)) ? Number(opt.peakDistancePx) : (includeWeak ? 3 : 5);
    const hardMaxDistanceNm = Math.max(0.2, Math.min(50, Number.isFinite(Number(opt.maxDistanceNm)) ? Number(opt.maxDistanceNm) : 5));

    const rawPeaks = peakDetect.detectPeaks(I, { prominenceWindowPx: Math.max(4, peakDistancePx * 2) });
    const peaks = inferPeaks(frame, peakScoring.scorePeaks(rawPeaks, {
      maxPeaks: includeWeak ? 120 : 72,
      minRelHeight: Math.max(0.003, Math.min(0.95, peakThresholdRel)),
      minPeakDistancePx: Math.max(1, Math.min(64, Math.round(peakDistancePx)))
    }));

    const nmAvailable = !!(frame && frame.calibrated && Array.isArray(frame.nm));
    const range = getObservedRange(frame, peaks);
    const resolutionNm = guessObservedResolutionNm(peaks);
    const atomicLines = filterAtomicLines(state && state.atomLines || [], presetCfg, range);
    const molecularBands = filterMolecularBands(state && state.molecularBands || [], presetCfg, range);

    let matches = [];
    if (nmAvailable) {
      matches = lineMatcher.matchLines(peaks, atomicLines, {
        toleranceNm: presetCfg.toleranceNm,
        hardMaxDistanceNm: hardMaxDistanceNm,
        maxMatches: presetCfg.maxMatches,
        preferredElements: presetCfg.allowedElements || null,
        elementBoost: null,
        maxPerPeak: presetCfg.maxPerPeak || 2,
        seededMatches: null
      }) || [];

      if (presetCfg.type === 'smart' && presetCfg.mode !== 'atomic') {
        matches = matches.concat(buildMolecularMatches(peaks, molecularBands, hardMaxDistanceNm));
      }
    }

    matches = matches.filter(function (m) {
      return m && Number.isFinite(Number(m.obsNm)) && Number.isFinite(Number(m.refNm)) && Math.abs(Number(m.deltaNm)) <= hardMaxDistanceNm;
    }).sort(function (a, b) {
      return (Number(b.rawScore || 0) - Number(a.rawScore || 0)) || (Number(b.prominence || 0) - Number(a.prominence || 0));
    });

    const matchSeen = Object.create(null);
    matches = matches.filter(function (m) {
      const key = String(m.element || m.speciesKey || m.species || '') + '|' + (Number.isFinite(Number(m.refNm)) ? Number(m.refNm).toFixed(3) : '?') + '|' + (Number.isFinite(Number(m.peakIndex)) ? Number(m.peakIndex) : '?') + '|' + String(m.kind || 'atom');
      if (matchSeen[key]) return false;
      matchSeen[key] = true;
      return true;
    });

    const qc = qcRules.evaluateQC({ frame: frame, state: state });
    if (!nmAvailable) qc.flags = (qc.flags || []).concat(['uncalibrated']);
    const confidence = confidenceModel.buildConfidence(matches, qc);

    let maxPeak = 0;
    for (let i = 0; i < peaks.length; i += 1) {
      const v = +peaks[i].prominence || +peaks[i].value || 0;
      if (v > maxPeak) maxPeak = v;
    }
    if (!Number.isFinite(maxPeak) || maxPeak <= 0) maxPeak = 1;

    let topHits = matches.map(function (m) {
      const closeness = Math.max(0, Math.min(1.25, +m.rawScore || 0));
      const strength = Math.max(0, Math.min(1, ((+m.prominence || +m.peakValue || 0) / maxPeak)));
      const base = (0.7 * Math.min(1, closeness)) + (0.3 * strength);
      const conf = Math.max(0, Math.min(1, (0.14 + 0.86 * base) * (+confidence.qcFactor || +confidence.overall || 0)));
      return {
        species: m.species,
        element: (m.element || (m.speciesKey || m.species || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 3)),
        referenceNm: m.refNm,
        observedNm: m.obsNm,
        peakIndex: Number.isFinite(Number(m.peakIndex)) ? Number(m.peakIndex) : null,
        deltaNm: m.deltaNm,
        confidence: +conf.toFixed(3),
        score: +((m.rawScore || 0) * 100).toFixed(1),
        kind: m.kind || 'atom'
      };
    });
    const rawLineHits = topHits.slice();

    let elementScores = [];
    let winnerBreakdown = null;
    if (nmAvailable && presetCfg.type === 'smart') {
      elementScores = buildRefinedElementScores({
        matches: matches,
        peaks: peaks,
        atomLines: atomicLines,
        molecularBands: molecularBands,
        range: range,
        hardMaxDistanceNm: hardMaxDistanceNm,
        resolutionNm: resolutionNm,
        mode: presetCfg.mode,
        familyWeights: presetCfg.familyWeights,
        candidateLimit: presetCfg.candidateLimit
      }).slice(0, 8);
      if (elementScores.length) {
        topHits = selectTopHitsForSmart(topHits, elementScores, presetCfg);
        winnerBreakdown = buildWinnerBreakdown(presetCfg, elementScores, matches);
      }
    } else if (presetCfg.type !== 'smart') {
      topHits = topHits.slice(0, 36);
    }

    return {
      ok: true,
      topHits: topHits,
      overlayHits: rawLineHits.slice(0, 160),
      peaks: peaks.slice(0, 96),
      offsetNm: estimateOffset(matches),
      qcFlags: qc.flags || [],
      confidence: confidence.overall || 0,
      presetId: presetCfg.id,
      librariesLoaded: !!(state && state.librariesLoaded),
      calibrated: !!nmAvailable,
      maxDistanceNm: hardMaxDistanceNm,
      weakPeaksMode: {
        enabled: includeWeak,
        peakThresholdRel: peakThresholdRel,
        peakDistancePx: peakDistancePx,
        maxPeaks: includeWeak ? 120 : 72
      },
      elementScores: elementScores,
      winnerBreakdown: winnerBreakdown
    };
  }

  root.SPECTRA_PRO_analysisPipeline = { analyzeFrame: analyzeFrame };
})(typeof self !== 'undefined' ? self : this);
