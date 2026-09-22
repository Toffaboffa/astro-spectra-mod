(function (root) {
  'use strict';

  const MODEL = 'stellar-class-evidence-v1';
  const CLASS_ORDER = ['O', 'B', 'A', 'F', 'G', 'K', 'M'];
  const TIO_BANDHEADS_NM = [495.4, 516.7, 544.8, 584.7, 615.8, 665.8];

  function median(values) {
    const finite = values.map(Number).filter(Number.isFinite).sort(function (a, b) { return a - b; });
    if (!finite.length) return null;
    const middle = Math.floor(finite.length / 2);
    return finite.length % 2 ? finite[middle] : (finite[middle - 1] + finite[middle]) / 2;
  }

  function uniqueHits(hits) {
    const seen = Object.create(null);
    return (Array.isArray(hits) ? hits : []).filter(function (hit) {
      if (!hit) return false;
      const key = String(hit.referenceId || hit.label || hit.speciesKey || hit.referenceNm || '');
      if (!key || seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function matchesAny(hit, expressions) {
    const text = [hit.label, hit.family, hit.species, hit.speciesKey, hit.element].join(' ').toLowerCase();
    return expressions.some(function (expression) { return expression.test(text); });
  }

  function responseCorrectionApplied(result, frame) {
    const preprocessing = result && result.preprocessing || frame && frame.preprocessing;
    const stages = preprocessing && Array.isArray(preprocessing.stages) ? preprocessing.stages : [];
    return stages.some(function (stage) { return stage && stage.id === 'instrument-response' && stage.applied === true; });
  }

  function findTioBands(features) {
    const found = Object.create(null);
    (Array.isArray(features) ? features : []).forEach(function (feature) {
      const center = Number(feature && feature.centerNm);
      const width = Number(feature && feature.fwhmNm);
      const depth = Number(feature && feature.depth);
      if (!Number.isFinite(center) || !Number.isFinite(width) || width < 0.8 || !Number.isFinite(depth) || depth < 0.03) return;
      let nearest = null;
      TIO_BANDHEADS_NM.forEach(function (anchor) {
        if (Math.abs(center - anchor) <= 1.2 && (nearest === null || Math.abs(center - anchor) < Math.abs(center - nearest))) nearest = anchor;
      });
      if (nearest !== null) found[String(nearest)] = feature;
    });
    return Object.keys(found).map(function (key) { return found[key]; });
  }

  function observedRange(frame) {
    const nm = frame && Array.isArray(frame.nm) ? frame.nm.map(Number).filter(Number.isFinite) : [];
    return nm.length ? { minNm: Math.min.apply(null, nm), maxNm: Math.max.apply(null, nm) } : null;
  }

  function assess(result, frame) {
    const hits = uniqueHits(result && result.topHits);
    const features = result && Array.isArray(result.features) ? result.features : [];
    const calibrated = !!(result && result.calibrated && frame && Array.isArray(frame.nm));
    const groups = {
      balmer: hits.filter(function (hit) { return matchesAny(hit, [/balmer/, /h[αβγδ]/, /h-(?:alpha|beta|gamma|delta)/]); }),
      heliumI: hits.filter(function (hit) { return matchesAny(hit, [/he i(?!i)/, /helium-i/]); }),
      heliumII: hits.filter(function (hit) { return matchesAny(hit, [/he ii/, /helium-ii/]); }),
      calcium: hits.filter(function (hit) { return matchesAny(hit, [/calcium/, /ca i/, /ca ii/]); }),
      magnesium: hits.filter(function (hit) { return matchesAny(hit, [/magnesium/, /mg i/, /mg ii/]); }),
      sodium: hits.filter(function (hit) { return matchesAny(hit, [/sodium/, /na i/]); })
    };
    groups.metals = uniqueHits(groups.calcium.concat(groups.magnesium, groups.sodium));
    groups.tio = findTioBands(features);
    const metalFamilyCount = [groups.calcium, groups.magnesium, groups.sodium].filter(function (group) { return group.length > 0; }).length;

    const depth = {
      balmer: median(groups.balmer.map(function (hit) { return hit.depth; })),
      heliumI: median(groups.heliumI.map(function (hit) { return hit.depth; })),
      heliumII: median(groups.heliumII.map(function (hit) { return hit.depth; })),
      metals: median(groups.metals.map(function (hit) { return hit.depth; })),
      tio: median(groups.tio.map(function (feature) { return feature.depth; }))
    };
    const scores = CLASS_ORDER.map(function (stellarClass) {
      return { class: stellarClass, evidencePoints: 0, reasons: [], conflicts: [] };
    });
    function profile(stellarClass) { return scores[CLASS_ORDER.indexOf(stellarClass)]; }
    function support(stellarClass, points, reason) {
      const item = profile(stellarClass); item.evidencePoints += points; item.reasons.push(reason);
    }
    function conflict(stellarClass, points, reason) {
      const item = profile(stellarClass); item.evidencePoints -= points; item.conflicts.push(reason);
    }

    if (groups.heliumII.length >= 2) support('O', 8, 'multiple He II absorption features');
    else if (groups.heliumII.length === 1 && groups.heliumI.length) support('O', 5, 'combined He II and He I evidence');
    if (groups.balmer.length >= 2) support('O', 1, 'supporting Balmer absorption');
    if (groups.metals.length >= 3 && metalFamilyCount >= 2) conflict('O', 2, 'strong cool-star metal pattern');
    if (groups.tio.length) conflict('O', 7, 'broad TiO evidence conflicts with an O spectrum');

    if (groups.heliumI.length >= 2) support('B', 6, 'multiple He I absorption features');
    if (groups.balmer.length >= 2) support('B', 3, 'coherent Balmer series');
    if (groups.heliumII.length === 1) support('B', 1, 'weak early-type He II support');
    if (groups.tio.length) conflict('B', 7, 'broad TiO evidence conflicts with a B spectrum');

    if (groups.balmer.length >= 3) support('A', 8, 'three or more Balmer absorption features');
    if (groups.balmer.length >= 3 && Number(depth.balmer) >= 0.08) support('A', 2, 'strong median Balmer depth');
    if (groups.heliumI.length >= 2) conflict('A', 3, 'multiple He I features favor an earlier class');
    if (groups.metals.length >= 3 && metalFamilyCount >= 2) conflict('A', 2, 'coherent metal pattern favors a later class');

    if (groups.balmer.length >= 2) support('F', 4, 'moderate Balmer series');
    if (groups.calcium.length >= 1) support('F', 3, 'Ca absorption accompanies Balmer evidence');
    if (groups.metals.length >= 1) support('F', 2, 'metal absorption is present');
    if (groups.tio.length >= 2) conflict('F', 5, 'multiple broad TiO features favor a cooler class');

    if (groups.calcium.length >= 2) support('G', 4, 'Ca II H/K pair');
    if (groups.metals.length >= 3 && metalFamilyCount >= 2) support('G', 5, 'coherent multi-species metal pattern');
    if (groups.balmer.length >= 1) support('G', 1, 'weak-to-moderate Balmer support');
    if (groups.tio.length >= 2) conflict('G', 4, 'multiple broad TiO features favor a cooler class');

    if (groups.metals.length >= 3 && metalFamilyCount >= 2) support('K', 6, 'strong multi-species metal pattern');
    if (groups.sodium.length >= 1) support('K', 2, 'Na I D absorption');
    if (groups.calcium.length >= 1) support('K', 2, 'calcium absorption');
    if (groups.balmer.length >= 3) conflict('K', 3, 'strong coherent Balmer series favors an earlier class');
    if (groups.tio.length === 1) support('K', 1, 'one broad TiO-like feature is compatible with late K');

    if (groups.tio.length >= 2) support('M', 9, 'multiple broad TiO bandhead features');
    if (groups.metals.length >= 1) support('M', 1, 'supporting cool-star metal absorption');
    if (groups.balmer.length >= 2) conflict('M', 3, 'coherent Balmer series conflicts with a typical M spectrum');

    scores.forEach(function (item) { item.evidencePoints = Math.max(0, item.evidencePoints); });
    scores.sort(function (a, b) {
      return b.evidencePoints - a.evidencePoints || CLASS_ORDER.indexOf(a.class) - CLASS_ORDER.indexOf(b.class);
    });
    const best = scores[0];
    const runnerUp = scores[1];
    const margin = best.evidencePoints - runnerUp.evidencePoints;
    const hotCoolConflict = groups.heliumII.length > 0 && groups.tio.length > 0;
    const globalConflicts = hotCoolConflict ? ['He II and broad TiO evidence imply incompatible temperature regimes'] : [];
    const enoughEvidence = calibrated && hits.length + groups.tio.length >= 2 && best.evidencePoints >= 5;
    const conflicting = enoughEvidence && (margin === 0 || hotCoolConflict);
    let strength = 'insufficient';
    if (enoughEvidence && !conflicting) {
      if (best.evidencePoints >= 8 && margin >= 2) strength = 'strong';
      else if (best.evidencePoints >= 7 && margin >= 1) strength = 'moderate';
      else strength = 'weak';
    } else if (conflicting) {
      strength = 'conflicting';
    }
    const qualityStatus = String(result && result.measurementQuality && result.measurementQuality.overallStatus || 'unavailable').toLowerCase();
    if (qualityStatus === 'poor' && (strength === 'strong' || strength === 'moderate')) strength = 'weak';
    const compatible = enoughEvidence
      ? scores.filter(function (item) { return best.evidencePoints - item.evidencePoints <= 2 && item.evidencePoints >= 5; }).map(function (item) { return item.class; }).sort(function (a, b) { return CLASS_ORDER.indexOf(a) - CLASS_ORDER.indexOf(b); })
      : [];
    const range = observedRange(frame);
    const responseCorrected = responseCorrectionApplied(result, frame);
    const limitations = [
      'broad-temperature-class-evidence-only',
      'no-subclass-or-luminosity-class',
      'heuristic-evidence-points-are-not-probabilities',
      'metallicity-gravity-rotation-reddening-binarity-and-emission-can-alter-line-patterns',
      responseCorrected ? 'continuum-shape-not-used-by-this-line-evidence-model' : 'continuum-shape-excluded-without-instrument-response-correction'
    ];
    if (!calibrated) limitations.push('calibrated-wavelengths-required');
    if (range && (range.minNm > 440 || range.maxNm < 590)) limitations.push('limited-wavelength-coverage');
    if (qualityStatus === 'poor') limitations.push('poor-measurement-quality-limits-class-evidence');

    return {
      model: MODEL,
      state: !enoughEvidence ? 'insufficient-data' : (conflicting ? 'conflicting-evidence' : 'available'),
      bestClass: enoughEvidence ? best.class : null,
      compatibleClasses: compatible,
      compatibleRange: compatible.length ? (compatible[0] === compatible[compatible.length - 1] ? compatible[0] : compatible[0] + '–' + compatible[compatible.length - 1]) : null,
      evidenceStrength: strength,
      reasons: enoughEvidence ? best.reasons.slice() : [],
      conflictingEvidence: enoughEvidence ? globalConflicts.concat(best.conflicts).slice() : [],
      ranking: scores.map(function (item) {
        return { class: item.class, evidencePoints: item.evidencePoints, reasons: item.reasons.slice(), conflicts: item.conflicts.slice() };
      }),
      diagnostics: {
        matchedFeatureCount: hits.length,
        balmerCount: groups.balmer.length,
        heliumICount: groups.heliumI.length,
        heliumIICount: groups.heliumII.length,
        calciumCount: groups.calcium.length,
        magnesiumCount: groups.magnesium.length,
        sodiumCount: groups.sodium.length,
        metalFamilyCount: metalFamilyCount,
        broadTioBandCount: groups.tio.length,
        medianDepths: depth,
        wavelengthRangeNm: range,
        continuumEligible: responseCorrected,
        continuumUsed: false,
        measurementQualityStatus: qualityStatus
      },
      limitations: limitations,
      referenceBasis: {
        method: 'broad low-resolution line-pattern evidence',
        sources: [
          'Evans et al. (2004), MNRAS 353, 601-623, O/B/A/F/G temperature-sequence criteria',
          'Raddi et al. (2013), MNRAS 430, 2169-2191, He I/Mg II/Balmer criteria',
          'Dorda et al. (2018), A&A 618, A137, G/K/M and TiO criteria'
        ],
        sourceUrls: [
          'https://academic.oup.com/mnras/article/353/2/601/1109626',
          'https://academic.oup.com/mnras/article/430/3/2169/981490',
          'https://www.aanda.org/articles/aa/abs/2018/10/aa33219-18/aa33219-18.html'
        ]
      }
    };
  }

  root.SPECTRA_PRO_stellarClassification = {
    model: MODEL,
    classes: CLASS_ORDER.slice(),
    tioBandheadsNm: TIO_BANDHEADS_NM.slice(),
    assess: assess
  };
})(typeof self !== 'undefined' ? self : this);
