(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const VERSION = '3.0.7';
  const BUTTON_ID = 'spLoadExampleBtn';
  const OVERLAY_ID = 'spExampleChooserOverlay';
  const STYLE_ID = 'spExampleChooserStyle';
  let loading = false;
  let selectedExampleId = 'n2-spectral-tube';

  const SAMPLE_ICONS = Object.freeze({
    purple: '../assets/examples/icons/spectral-tube-purple-128.png',
    orange: '../assets/examples/icons/spectral-tube-orange-128.png',
    cyan: '../assets/examples/icons/spectral-tube-cyan-128.png',
    solar: '../assets/examples/icons/solar-spectrum.png'
  });

  const SPECTRA1_CALIBRATION = Object.freeze({
    source: 'KVANT SPECTRA 1 factory calibration from SPECTRA v6 report',
    direction: 'nm-left-to-right',
    points: Object.freeze([
      Object.freeze({ px: 32, nm: 388.86 }),
      Object.freeze({ px: 515, nm: 587.57 }),
      Object.freeze({ px: 1110, nm: 837.76 })
    ]),
    reportedPolynomial: Object.freeze({
      a2: 8.457e-6,
      a1: 0.406760986,
      a0: 375.834988
    })
  });

  const EXAMPLES = Object.freeze([
    Object.freeze({
      id: 'n2-spectral-tube',
      kind: 'image',
      labelEn: 'N₂ spectral tube',
      labelSv: 'N₂ spektralrör',
      descriptionEn: 'Nitrogen discharge-tube spectrum recorded with SPECTRA-1.',
      descriptionSv: 'Kvävespektrum från spektralrör, registrerat med SPECTRA-1.',
      sourceLabelEn: 'N₂ spectral tube (calibrated)',
      sourceLabelSv: 'N₂ spektralrör (kalibrerat)',
      icon: SAMPLE_ICONS.purple,
      image: Object.freeze({
        path: '../assets/examples/n2-spectral-tube/n2-spectral-tube.png',
        width: 1280,
        height: 720,
        mime: 'image/png',
        sha256: 'dc624e7ca38032b9ca6c93e09f14feec476617c35742316e4f6063b050e3bbea'
      }),
      calibration: SPECTRA1_CALIBRATION,
      stripe: Object.freeze({ widthPx: 5, yNormalized: 0.544 }),
      recommendedPreset: 'smart-gastube'
    }),
    Object.freeze({
      id: 'ne-spectral-tube',
      kind: 'image',
      labelEn: 'Ne spectral tube',
      labelSv: 'Ne spektralrör',
      descriptionEn: 'Neon discharge-tube spectrum recorded with SPECTRA-1.',
      descriptionSv: 'Neonspektrum från spektralrör, registrerat med SPECTRA-1.',
      sourceLabelEn: 'Ne spectral tube (calibrated)',
      sourceLabelSv: 'Ne spektralrör (kalibrerat)',
      icon: SAMPLE_ICONS.orange,
      image: Object.freeze({
        path: '../assets/examples/ne-spectral-tube/ne-spectral-tube.png',
        width: 1280,
        height: 720,
        mime: 'image/png',
        sha256: 'fbef80cbc7637f3220e4eaba31ad4c9e1e8de987fdf93537ce653d5518cbd1f0'
      }),
      calibration: SPECTRA1_CALIBRATION,
      stripe: Object.freeze({ widthPx: 5, yNormalized: 0.546 }),
      recommendedPreset: 'smart-gastube'
    }),
    Object.freeze({
      id: 'ar-spectral-tube',
      kind: 'rgb-spectrum',
      labelEn: 'Ar spectral tube',
      labelSv: 'Ar spektralrör',
      descriptionEn: 'Measured argon discharge-tube spectrum recorded with SPECTRA-1.',
      descriptionSv: 'Uppmätt argonspektrum från spektralrör, registrerat med SPECTRA-1.',
      sourceLabelEn: 'Ar spectral tube (calibrated profile)',
      sourceLabelSv: 'Ar spektralrör (kalibrerad profil)',
      icon: SAMPLE_ICONS.cyan,
      badge: 'SPECTRA-1',
      metaEn: '1280 measured samples · 3-point calibration · Gas Tube preset',
      metaSv: '1280 uppmätta provpunkter · 3-punktskalibrering · Gas Tube-förval',
      spectrum: Object.freeze({
        path: '../data/examples/ar-spectral-tube.json',
        schema: 'spectra-pro-rgb-spectrum-example/v1',
        assetId: 'ar-spectral-tube',
        count: 1280
      }),
      calibration: SPECTRA1_CALIBRATION,
      recommendedPreset: 'smart-gastube',
      recommendedMode: 'LAB'
    }),
    Object.freeze({
      id: 'solar-tsis1-hsrs',
      kind: 'numeric',
      labelEn: 'Solar spectrum',
      labelSv: 'Solspektrum',
      descriptionEn: 'Measured TSIS-1 Hybrid Solar Reference Spectrum with an air-wavelength calibration.',
      descriptionSv: 'Uppmätt TSIS-1 Hybrid Solar Reference Spectrum med kalibrering i luftvåglängd.',
      sourceLabelEn: 'Solar spectrum — TSIS-1 HSRS (calibrated)',
      sourceLabelSv: 'Solspektrum — TSIS-1 HSRS (kalibrerat)',
      icon: SAMPLE_ICONS.solar,
      badge: 'TSIS-1 HSRS',
      metaEn: '388–670 nm · 0.2 nm sampling · calibrated numeric data',
      metaSv: '388–670 nm · 0,2 nm sampling · kalibrerade numeriska data',
      numeric: Object.freeze({
        path: '../data/examples/solar-tsis1-hsrs-visible-0p2nm.json',
        schema: 'spectra-pro-numeric-example/v1',
        assetId: 'solar-tsis1-hsrs-visible',
        count: 1411
      }),
      recommendedMode: 'ASTRO'
    })
  ]);

  function $(id) {
    return global.document ? global.document.getElementById(id) : null;
  }

  function isSwedish() {
    try {
      return !!(sp.i18n && typeof sp.i18n.getLanguage === 'function' && sp.i18n.getLanguage() === 'sv');
    } catch (_) {
      return false;
    }
  }

  function t(en, sv) {
    return isSwedish() ? sv : en;
  }

  function buttonLabel() {
    return t('Load Example', 'Ladda exempel');
  }

  function loadingLabel() {
    return t('Loading…', 'Laddar…');
  }

  function log(message) {
    try {
      if (sp.consoleLog && typeof sp.consoleLog.append === 'function') {
        sp.consoleLog.append('[EXAMPLE] ' + String(message));
      }
    } catch (_) {}
  }

  function getExample(id) {
    return EXAMPLES.find(function (item) { return item.id === id; }) || null;
  }

  function ensureStyle() {
    if (!global.document || $(STYLE_ID)) return;
    const style = global.document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '#' + OVERLAY_ID + '{position:fixed;inset:0;z-index:10040;background:rgba(2,8,23,.72);display:flex;align-items:center;justify-content:center;padding:20px;}',
      '#' + OVERLAY_ID + '[hidden]{display:none!important;}',
      '#' + OVERLAY_ID + ' .sp-example-dialog{width:min(560px,94vw);max-height:84vh;overflow:auto;background:#071b36;color:#d9fff3;border:1px solid rgba(16,185,129,.78);border-radius:10px;box-shadow:0 22px 70px rgba(0,0,0,.55);}',
      '#' + OVERLAY_ID + ' .sp-example-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(16,185,129,.35);}',
      '#' + OVERLAY_ID + ' .sp-example-head h2{font-size:1rem;margin:0;font-weight:800;letter-spacing:.03em;}',
      '#' + OVERLAY_ID + ' .sp-example-close{border:0;background:transparent;color:#9fffe5;font-size:24px;line-height:1;padding:0 4px;cursor:pointer;}',
      '#' + OVERLAY_ID + ' .sp-example-body{padding:14px 16px 16px;}',
      '#' + OVERLAY_ID + ' .sp-example-intro{margin:0 0 12px;color:#b6d9d0;font-size:.88rem;}',
      '#' + OVERLAY_ID + ' .sp-example-card{width:100%;text-align:left;background:#0a2445;color:#eafff9;border:1px solid rgba(159,255,229,.26);border-radius:8px;padding:11px 12px;cursor:pointer;transition:border-color .12s ease,background .12s ease;margin-bottom:9px;}',
      '#' + OVERLAY_ID + ' .sp-example-card:hover,#' + OVERLAY_ID + ' .sp-example-card:focus{outline:none;border-color:#9fffe5;background:#0d2b50;}',
      '#' + OVERLAY_ID + ' .sp-example-card.is-selected{border-color:#9fffe5;background:#0d3158;box-shadow:inset 0 0 0 1px rgba(159,255,229,.28);}',
      '#' + OVERLAY_ID + ' .sp-example-card__layout{display:grid;grid-template-columns:72px 1fr;gap:12px;align-items:center;}',
      '#' + OVERLAY_ID + ' .sp-example-card__icon{width:72px;height:72px;object-fit:contain;display:block;}',
      '#' + OVERLAY_ID + ' .sp-example-card__content{min-width:0;}',
      '#' + OVERLAY_ID + ' .sp-example-card__top{display:flex;align-items:center;justify-content:space-between;gap:12px;}',
      '#' + OVERLAY_ID + ' .sp-example-card__title{font-weight:800;font-size:1rem;}',
      '#' + OVERLAY_ID + ' .sp-example-card__badge{font-size:.72rem;font-weight:800;color:#071b36;background:#9fffe5;border-radius:999px;padding:3px 7px;white-space:nowrap;}',
      '#' + OVERLAY_ID + ' .sp-example-card p{margin:7px 0 8px;color:#b6d9d0;font-size:.84rem;}',
      '#' + OVERLAY_ID + ' .sp-example-meta{font-size:.75rem;color:#83c8b7;}',
      '#' + OVERLAY_ID + ' .sp-example-actions{display:flex;justify-content:flex-end;margin-top:12px;}',
      '#' + OVERLAY_ID + ' .sp-example-load{border:1px solid #9fffe5;background:#9fffe5;color:#071b36;border-radius:6px;padding:6px 11px;font-weight:800;cursor:pointer;}',
      '#' + OVERLAY_ID + ' .sp-example-load:disabled{opacity:.55;cursor:wait;}'
    ].join('');
    (global.document.head || global.document.documentElement).appendChild(style);
  }

  function closeChooser() {
    const overlay = $(OVERLAY_ID);
    if (!overlay) return;
    overlay.hidden = true;
  }

  function updateSelectionUi(overlay) {
    if (!overlay) return;
    overlay.querySelectorAll('.sp-example-card').forEach(function (card) {
      const selected = String(card.getAttribute('data-example-id') || '') === selectedExampleId;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });
    const loadButton = overlay.querySelector('.sp-example-load');
    if (loadButton) loadButton.disabled = loading || !getExample(selectedExampleId);
  }

  function renderChooser() {
    ensureStyle();
    let overlay = $(OVERLAY_ID);
    if (!overlay) {
      overlay = global.document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.hidden = true;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) closeChooser();
      });
      global.document.body.appendChild(overlay);
    }

    if (!getExample(selectedExampleId) && EXAMPLES.length) selectedExampleId = EXAMPLES[0].id;

    const swedish = isSwedish();
    const cards = EXAMPLES.map(function (sample) {
      const label = swedish ? sample.labelSv : sample.labelEn;
      const desc = swedish ? sample.descriptionSv : sample.descriptionEn;
      const badge = sample.badge || 'SPECTRA-1';
      const meta = swedish ? (sample.metaSv || '1280×720 px · 3-punktskalibrering · Gas Tube-förval') : (sample.metaEn || '1280×720 px · 3-point calibration · Gas Tube preset');
      const selected = sample.id === selectedExampleId;
      return [
        '<button type="button" class="sp-example-card' + (selected ? ' is-selected' : '') + '" data-example-id="' + sample.id + '" aria-pressed="' + (selected ? 'true' : 'false') + '">',
        '  <span class="sp-example-card__layout">',
        '    <img class="sp-example-card__icon" src="' + sample.icon + '?v=' + encodeURIComponent(VERSION) + '" alt="" aria-hidden="true">',
        '    <span class="sp-example-card__content">',
        '      <span class="sp-example-card__top"><span class="sp-example-card__title">' + label + '</span><span class="sp-example-card__badge">' + badge + '</span></span>',
        '      <p>' + desc + '</p>',
        '      <span class="sp-example-meta">' + meta + '</span>',
        '    </span>',
        '  </span>',
        '</button>'
      ].join('');
    }).join('');

    overlay.innerHTML = [
      '<section class="sp-example-dialog" aria-labelledby="spExampleChooserTitle">',
      '  <div class="sp-example-head">',
      '    <h2 id="spExampleChooserTitle">' + t('Choose sample', 'Välj prov') + '</h2>',
      '    <button type="button" class="sp-example-close" aria-label="' + t('Close', 'Stäng') + '">×</button>',
      '  </div>',
      '  <div class="sp-example-body">',
      '    <p class="sp-example-intro">' + t('Choose a bundled example measurement, then load the selected sample.', 'Välj en inbyggd exempelmätning och ladda sedan det valda provet.') + '</p>',
      cards,
      '    <div class="sp-example-actions"><button type="button" class="sp-example-load">' + t('Load sample', 'Ladda prov') + '</button></div>',
      '  </div>',
      '</section>'
    ].join('');

    const close = overlay.querySelector('.sp-example-close');
    if (close) close.addEventListener('click', closeChooser);

    overlay.querySelectorAll('.sp-example-card').forEach(function (card) {
      card.addEventListener('click', function () {
        const id = String(card.getAttribute('data-example-id') || '');
        if (!getExample(id)) return;
        selectedExampleId = id;
        updateSelectionUi(overlay);
      });
    });

    const loadButton = overlay.querySelector('.sp-example-load');
    if (loadButton) loadButton.addEventListener('click', function () { load(selectedExampleId); });

    updateSelectionUi(overlay);
    return overlay;
  }

  function openChooser() {
    const overlay = renderChooser();
    overlay.hidden = false;
    const selected = overlay.querySelector('.sp-example-card.is-selected') || overlay.querySelector('.sp-example-card');
    if (selected) {
      try { selected.focus(); } catch (_) {}
    }
  }

  function setBusy(busy) {
    loading = !!busy;
    const button = $(BUTTON_ID);
    if (button) {
      button.disabled = !!busy;
      button.textContent = busy ? loadingLabel() : buttonLabel();
    }
    const overlay = $(OVERLAY_ID);
    if (overlay) {
      overlay.querySelectorAll('button').forEach(function (el) {
        if (!el.classList.contains('sp-example-close')) el.disabled = !!busy;
      });
    }
  }

  function assetUrl(sample) {
    const asset = sample.kind === 'numeric'
      ? sample.numeric
      : (sample.kind === 'rgb-spectrum' ? sample.spectrum : sample.image);
    return asset.path + '?v=' + encodeURIComponent(VERSION);
  }

  function dimensionsMatch(sample, image) {
    return Number(image && image.naturalWidth) === Number(sample.image.width) &&
      Number(image && image.naturalHeight) === Number(sample.image.height);
  }

  function preloadAsset(sample) {
    return new Promise(function (resolve, reject) {
      if (typeof global.Image !== 'function') {
        reject(new Error('Image loading is unavailable in this browser.'));
        return;
      }
      const probe = new global.Image();
      probe.onload = function () {
        if (!dimensionsMatch(sample, probe)) {
          reject(new Error('Example image dimensions do not match the calibrated 1280×720 source.'));
          return;
        }
        resolve(assetUrl(sample));
      };
      probe.onerror = function () { reject(new Error('The bundled example image could not be loaded.')); };
      probe.src = assetUrl(sample);
    });
  }

  async function loadNumericAsset(sample) {
    const response = await global.fetch(assetUrl(sample), { cache: 'no-store' });
    if (!response.ok) throw new Error('The bundled numeric example could not be loaded (HTTP ' + response.status + ').');
    const asset = await response.json();
    const wavelengths = asset && asset.wavelengthNm;
    const intensities = asset && asset.irradianceWm2Nm;
    if (asset.schema !== sample.numeric.schema || asset.id !== sample.numeric.assetId) {
      throw new Error('The numeric example schema or identifier is invalid.');
    }
    if (!Array.isArray(wavelengths) || !Array.isArray(intensities) ||
        wavelengths.length !== sample.numeric.count || intensities.length !== wavelengths.length) {
      throw new Error('The numeric example arrays do not have the expected length.');
    }
    for (let i = 0; i < wavelengths.length; i += 1) {
      if (!Number.isFinite(wavelengths[i]) || !Number.isFinite(intensities[i]) || intensities[i] < 0) {
        throw new Error('The numeric example contains an invalid sample.');
      }
      if (i > 0 && !(wavelengths[i] > wavelengths[i - 1])) {
        throw new Error('The numeric example wavelength grid is not strictly increasing.');
      }
    }
    if (asset.wavelengthMedium !== 'standard-air' || !asset.provenance || !asset.provenance.primaryReferenceDoi) {
      throw new Error('The numeric example provenance or wavelength medium is incomplete.');
    }
    return asset;
  }

  async function loadRgbSpectrumAsset(sample) {
    const response = await global.fetch(assetUrl(sample), { cache: 'no-store' });
    if (!response.ok) throw new Error('The bundled measured spectrum could not be loaded (HTTP ' + response.status + ').');
    const asset = await response.json();
    if (!asset || asset.schema !== sample.spectrum.schema || asset.id !== sample.spectrum.assetId) {
      throw new Error('The measured-spectrum example schema or identifier is invalid.');
    }
    const keys = ['px', 'nm', 'R', 'G', 'B', 'I'];
    keys.forEach(function (key) {
      if (!Array.isArray(asset[key]) || asset[key].length !== sample.spectrum.count) {
        throw new Error('The measured-spectrum example has an invalid ' + key + ' array.');
      }
    });
    for (let i = 0; i < sample.spectrum.count; i += 1) {
      if (!Number.isFinite(asset.nm[i]) || !Number.isFinite(asset.I[i]) ||
          !Number.isFinite(asset.R[i]) || !Number.isFinite(asset.G[i]) || !Number.isFinite(asset.B[i])) {
        throw new Error('The measured-spectrum example contains an invalid sample.');
      }
      if (i > 0 && !(asset.nm[i] > asset.nm[i - 1])) {
        throw new Error('The measured-spectrum wavelength grid is not strictly increasing.');
      }
    }
    return asset;
  }

  function stopLiveSource() {
    try {
      const rt = sp.runtime || {};
      const current = typeof rt.getVideoElement === 'function' ? rt.getVideoElement() : null;
      if (current && current.srcObject && typeof current.srcObject.getTracks === 'function') {
        current.srcObject.getTracks().forEach(function (track) {
          try { track.stop(); } catch (_) {}
        });
        try { current.srcObject = null; } catch (_) {}
      }
      const mainVideo = $('videoMain');
      if (mainVideo && mainVideo.srcObject && typeof mainVideo.srcObject.getTracks === 'function') {
        mainVideo.srcObject.getTracks().forEach(function (track) {
          try { track.stop(); } catch (_) {}
        });
        try { mainVideo.srcObject = null; } catch (_) {}
      }
    } catch (_) {}
  }

  function applyCalibration(sample) {
    const points = sample.calibration.points;
    if (typeof global.resetCalibrationPoints !== 'function' ||
        typeof global.addInputPair !== 'function' ||
        typeof global.setCalibrationPoints !== 'function') {
      return { ok: false, reason: 'Calibration controls are unavailable.' };
    }

    try {
      global.resetCalibrationPoints();
      let guard = 0;
      while (!$('point' + points.length + 'px') && guard < 8) {
        global.addInputPair();
        guard += 1;
      }

      points.forEach(function (point, i) {
        const index = i + 1;
        const px = $('point' + index + 'px');
        const nm = $('point' + index + 'nm');
        if (!px || !nm) throw new Error('Calibration input #' + index + ' is unavailable.');
        px.value = String(point.px);
        nm.value = String(point.nm);
      });

      global.setCalibrationPoints();

      try {
        if (global.SpectraCore && global.SpectraCore.calibration &&
            typeof global.SpectraCore.calibration.emitCalibrationState === 'function') {
          global.SpectraCore.calibration.emitCalibrationState();
        }
      } catch (_) {}

      const calibrated = typeof global.isCalibrated === 'function' ? !!global.isCalibrated() : true;
      return { ok: calibrated, count: points.length, reason: calibrated ? '' : 'Calibration did not activate.' };
    } catch (error) {
      return { ok: false, reason: String(error && error.message || error) };
    }
  }

  function selectRecommendedPreset(sample) {
    try {
      if (sp.store && typeof sp.store.update === 'function') {
        sp.store.update('analysis.presetId', sample.recommendedPreset, { source: 'exampleSpectrum.preset' });
      }
      const preset = $('spLabPreset');
      if (preset) preset.value = sample.recommendedPreset;
      const client = sp.analysisWorkerClient;
      if (client && typeof client.setPreset === 'function') client.setPreset(sample.recommendedPreset);
    } catch (_) {}
  }

  function applyStripe(sample) {
    try {
      const stripe = global.SpectraCore && global.SpectraCore.stripe;
      if (stripe && typeof stripe.setStripeWidth === 'function') {
        stripe.setStripeWidth(sample.stripe.widthPx);
      } else {
        const width = $('stripeWidthRange');
        if (width) {
          width.value = String(sample.stripe.widthPx);
          if (typeof global.changeStripeWidth === 'function') global.changeStripeWidth(0);
        }
      }

      if (stripe && typeof stripe.setStripeY === 'function') {
        stripe.setStripeY(sample.stripe.yNormalized);
      } else {
        const place = $('stripePlacementRange');
        if (place) {
          const max = Number(place.max) || sample.image.height;
          place.value = String(Math.round(max * sample.stripe.yNormalized));
          if (typeof global.changeStripePlacement === 'function') global.changeStripePlacement(0);
        }
      }
    } catch (_) {}
  }

  function selectWavelengthAxis() {
    try {
      const nm = $('toggleXLabelsNm');
      if (!nm) return;
      nm.checked = true;
      const px = $('toggleXLabelsPx');
      if (px) px.checked = false;
      nm.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  function solarColorAtNm(nm) {
    const stops = [
      [380, 20, 0, 35], [400, 80, 0, 120], [430, 60, 0, 220],
      [460, 0, 90, 255], [490, 0, 210, 255], [530, 0, 255, 90],
      [575, 235, 255, 0], [590, 255, 220, 0], [610, 255, 120, 0],
      [650, 255, 0, 0], [700, 170, 0, 0]
    ];
    let left = stops[0];
    let right = stops[stops.length - 1];
    for (let i = 0; i < stops.length - 1; i += 1) {
      if (nm >= stops[i][0] && nm <= stops[i + 1][0]) {
        left = stops[i];
        right = stops[i + 1];
        break;
      }
    }
    const amount = Math.max(0, Math.min(1, (nm - left[0]) / Math.max(1, right[0] - left[0])));
    return [1, 2, 3].map(function (channel) {
      return Math.round(left[channel] + (right[channel] - left[channel]) * amount);
    });
  }

  function buildSolarSourceRgb(asset) {
    const values = asset.irradianceWm2Nm;
    const wavelengths = asset.wavelengthNm;
    const radius = 24;
    const upper = new Array(values.length);
    const sourceRgb = { R: new Array(values.length), G: new Array(values.length), B: new Array(values.length) };
    for (let i = 0; i < values.length; i += 1) {
      let localMax = 0;
      const start = Math.max(0, i - radius);
      const end = Math.min(values.length - 1, i + radius);
      for (let j = start; j <= end; j += 1) localMax = Math.max(localMax, Number(values[j]) || 0);
      upper[i] = localMax || 1;
    }
    for (let i = 0; i < values.length; i += 1) {
      const relative = Math.max(0, Math.min(1, (Number(values[i]) || 0) / upper[i]));
      const brightness = 0.08 + 0.92 * Math.pow(relative, 2.2);
      const rgb = solarColorAtNm(Number(wavelengths[i]));
      sourceRgb.R[i] = Math.round(rgb[0] * brightness);
      sourceRgb.G[i] = Math.round(rgb[1] * brightness);
      sourceRgb.B[i] = Math.round(rgb[2] * brightness);
    }
    return sourceRgb;
  }

  function renderSolarSourcePreview(asset) {
    const canvas = $('spFramePreviewCanvas');
    if (!canvas || !asset || !Array.isArray(asset.wavelengthNm) || !Array.isArray(asset.irradianceWm2Nm)) return null;
    const width = 1280;
    const height = 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);

    const sourceRgb = buildSolarSourceRgb(asset);
    const bandTop = 110;
    const bandHeight = 500;
    for (let x = 0; x < width; x += 1) {
      const index = Math.min(asset.wavelengthNm.length - 1, Math.round((x / (width - 1)) * (asset.wavelengthNm.length - 1)));
      ctx.fillStyle = 'rgb(' + sourceRgb.R[index] + ',' + sourceRgb.G[index] + ',' + sourceRgb.B[index] + ')';
      ctx.fillRect(x, bandTop, 1, bandHeight);
    }
    canvas.style.display = 'block';
    return sourceRgb;
  }

  function setGraphFillMode(mode) {
    try {
      if (sp.store && typeof sp.store.update === 'function') {
        sp.store.update('display.fillMode', mode, { source: 'exampleSpectrum.solarFill' });
      }
      const select = $('spFillMode');
      if (select) select.value = mode;
    } catch (_) {}
  }

  function renderRgbSpectrumPreview(asset) {
    const canvas = $('spFramePreviewCanvas');
    if (!canvas || !asset) return null;
    const width = Number(asset.preview && asset.preview.width) || 1280;
    const height = Number(asset.preview && asset.preview.height) || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    const top = Number.isFinite(Number(asset.preview && asset.preview.bandTopPx)) ? Number(asset.preview.bandTopPx) : Math.round(height * 0.375);
    const h = Number.isFinite(Number(asset.preview && asset.preview.bandHeightPx)) ? Number(asset.preview.bandHeightPx) : Math.round(height * 0.25);
    for (let x = 0; x < width; x += 1) {
      const index = Math.min(asset.I.length - 1, Math.round((x / Math.max(1, width - 1)) * (asset.I.length - 1)));
      const r = Math.max(0, Math.min(255, Math.round(Number(asset.R[index]) || 0)));
      const g = Math.max(0, Math.min(255, Math.round(Number(asset.G[index]) || 0)));
      const b = Math.max(0, Math.min(255, Math.round(Number(asset.B[index]) || 0)));
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fillRect(x, top, 1, h);
    }
    canvas.style.display = 'block';
    return { R: asset.R.slice(), G: asset.G.slice(), B: asset.B.slice() };
  }

  function configureSampleStripePreview(sample, asset, options) {
    try {
      const opts = options || {};
      const preview = asset && asset.preview ? asset.preview : {};
      const capture = asset && asset.capture ? asset.capture : {};
      const width = Math.max(2, Math.round(Number(opts.width || preview.width || capture.sourceWidthPx || 1280)));
      const height = Math.max(2, Math.round(Number(opts.height || preview.height || capture.sourceHeightPx || 720)));
      const bandTop = Math.max(1, Math.round(Number(opts.bandTop != null ? opts.bandTop : (preview.bandTopPx != null ? preview.bandTopPx : 1))));
      const bandHeight = Math.max(1, Math.round(Number(opts.bandHeight != null ? opts.bandHeight : (preview.bandHeightPx != null ? preview.bandHeightPx : height))));
      const bandBottom = Math.min(height, bandTop + bandHeight - 1);
      const stripeWidthPx = Math.max(1, Math.round(Number(opts.stripeWidthPx || capture.stripeWidthPx || (sample && sample.stripe && sample.stripe.widthPx) || 1)));
      const defaultY = Math.max(bandTop, Math.min(bandBottom, Math.round(Number(opts.stripeYpx || capture.stripeYpx || ((bandTop + bandBottom) / 2)))));

      const runtime = sp.runtime || {};
      if (typeof runtime.setSourceMetrics === 'function') runtime.setSourceMetrics(width, height);

      const overlay = $('cameraWindowCanvasRecording');
      if (overlay) {
        overlay.width = width;
        overlay.height = height;
        overlay.style.width = '100%';
        overlay.style.height = '100%';
      }

      const widthRange = $('stripeWidthRange');
      const widthValue = $('stripeWidthValue');
      const placeRange = $('stripePlacementRange');
      const placeValue = $('stripePlacementValue');

      if (widthRange) {
        widthRange.min = '1';
        widthRange.max = String(Math.max(1, Math.min(height, bandHeight)));
        widthRange.value = String(Math.min(stripeWidthPx, Number(widthRange.max) || stripeWidthPx));
      }
      if (placeRange) {
        const half = Math.max(0, Math.floor(stripeWidthPx / 2));
        placeRange.min = String(Math.max(1, bandTop + half));
        placeRange.max = String(Math.max(Number(placeRange.min) || 1, bandBottom - half));
        placeRange.value = String(Math.max(Number(placeRange.min) || 1, Math.min(Number(placeRange.max) || height, defaultY)));
      }
      if (widthValue && widthRange) widthValue.textContent = String(widthRange.value);

      if (typeof global.changeStripeWidth === 'function') global.changeStripeWidth(0);
      if (typeof global.changeStripePlacement === 'function') global.changeStripePlacement(0);
      if (placeValue && typeof global.getStripePositionRangeText === 'function') {
        placeValue.textContent = global.getStripePositionRangeText();
      }
      if (typeof global.drawSelectionLine === 'function') global.drawSelectionLine();
      if (typeof global.showSelectedStripe === 'function') global.showSelectedStripe();
    } catch (_) {}
  }

  function refreshImageSampleStripePreview() {
    try {
      if (typeof global.syncCanvasToVideo === 'function') global.syncCanvasToVideo();
      if (typeof global.drawSelectionLine === 'function') global.drawSelectionLine();
      if (typeof global.showSelectedStripe === 'function') global.showSelectedStripe();
    } catch (_) {}
  }

  function enableLabAnalysis(sample) {
    try {
      const labTab = global.document && global.document.querySelector('#spTabs .sp-tab[data-tab="lab"]');
      if (labTab && typeof labTab.click === 'function') labTab.click();
      if (sp.appMode && typeof sp.appMode.setMode === 'function') {
        sp.appMode.setMode('LAB', { source: 'exampleSpectrum.argon' });
      } else if (sp.store && typeof sp.store.update === 'function') {
        sp.store.update('appMode', 'LAB', { source: 'exampleSpectrum.argon' });
      }
      if (sp.store && typeof sp.store.update === 'function') {
        sp.store.update('analysis.enabled', true, { source: 'exampleSpectrum.argon' });
        sp.store.update('worker.mode', 'auto', { source: 'exampleSpectrum.argon' });
        sp.store.update('worker.enabled', true, { source: 'exampleSpectrum.argon' });
        sp.store.update('subtraction.mode', 'raw', { source: 'exampleSpectrum.argon' });
      }
      selectRecommendedPreset(sample);
      const client = sp.analysisWorkerClient;
      if (client && typeof client.start === 'function') client.start();
    } catch (_) {}
  }

  function finishLoadedRgbSpectrum(sample, asset) {
    const graph = global.SpectraCore && global.SpectraCore.graph;
    if (!graph || typeof graph.setNumericFrame !== 'function') {
      throw new Error('Measured-spectrum example support is unavailable.');
    }
    try {
      if (typeof global.switchLoadedImageSettings === 'function') {
        global.switchLoadedImageSettings(isSwedish() ? sample.sourceLabelSv : sample.sourceLabelEn);
      }
    } catch (_) {}
    const video = $('videoMain');
    const image = $('cameraImage');
    const sourceWindow = $('videoMainWindow');
    try {
      if (sp.framePreview && typeof sp.framePreview.clearSourceImage === 'function') sp.framePreview.clearSourceImage();
      else if (image) { image.onload = null; image.removeAttribute('src'); }
    } catch (_) {}
    if (sourceWindow) sourceWindow.classList.add('sp-numeric-source');
    if (video) video.style.display = 'none';
    if (image) image.style.display = 'none';
    const pause = $('pauseVideoButton');
    const play = $('playVideoButton');
    if (pause) pause.style.visibility = 'hidden';
    if (play) play.style.visibility = 'visible';

    const sourceRgb = renderRgbSpectrumPreview(asset);
    enableLabAnalysis(sample);
    setGraphFillMode('off');

    const cal = applyCalibration(sample);
    if (!cal.ok) throw new Error('Argon example calibration could not be activated: ' + cal.reason);
    selectWavelengthAxis();

    graph.setNumericFrame({
      px: asset.px,
      nm: asset.nm,
      R: asset.R,
      G: asset.G,
      B: asset.B,
      I: asset.I,
      sourceRgb: sourceRgb,
      calibrated: true,
      calibration: sample.calibration,
      hardware: asset.hardware || { spectrometerResolutionFwhmNm: 1.8, pixelResolutionNm: 0.5 },
      metadata: { schema: asset.schema, id: asset.id, scientificRole: asset.scientificRole, provenance: asset.provenance, capture: asset.capture || null },
      previewWidth: Number(asset.preview && asset.preview.width) || Number(asset.capture && asset.capture.sourceWidthPx) || 1280,
      previewHeight: Number(asset.preview && asset.preview.height) || Number(asset.capture && asset.capture.sourceHeightPx) || 720,
      sourceWidth: Number(asset.capture && asset.capture.sourceWidthPx) || 1280,
      sourceHeight: Number(asset.capture && asset.capture.sourceHeightPx) || 720,
      source: 'gas-example'
    });
    configureSampleStripePreview(sample, asset, {
      width: Number(asset.preview && asset.preview.width) || 1280,
      height: Number(asset.preview && asset.preview.height) || 720,
      bandTop: Number(asset.preview && asset.preview.bandTopPx),
      bandHeight: Number(asset.preview && asset.preview.bandHeightPx),
      stripeYpx: Number(asset.capture && asset.capture.stripeYpx),
      stripeWidthPx: Number(asset.capture && asset.capture.stripeWidthPx)
    });
    global.setTimeout(function () {
      try { if (typeof global.redrawGraphIfLoadedImage === 'function') global.redrawGraphIfLoadedImage(true); } catch (_) {}
      try { if (typeof global.showSelectedStripe === 'function') global.showSelectedStripe(); } catch (_) {}
    }, 300);
    log((isSwedish() ? sample.labelSv : sample.labelEn) + ' loaded · measured SPECTRA-1 profile · LAB Gas Tube analysis enabled.');
  }

  function finishLoadedImage(sample, image) {
    const sourceWindow = $('videoMainWindow');
    if (sourceWindow) sourceWindow.classList.remove('sp-numeric-source');
    const previewCanvas = $('spFramePreviewCanvas');
    if (previewCanvas) previewCanvas.style.display = 'none';
    try {
      const rt = sp.runtime || {};
      if (typeof rt.setVideoElement === 'function') rt.setVideoElement(image);
      if (typeof rt.refreshActiveSourceMetrics === 'function') rt.refreshActiveSourceMetrics();
    } catch (_) {}

    try { if (typeof global.initializeZoomList === 'function') global.initializeZoomList(); } catch (_) {}

    selectRecommendedPreset(sample);
    setGraphFillMode('off');
    applyStripe(sample);
    refreshImageSampleStripePreview();

    try {
      const calIo = sp.v15 && sp.v15.calibrationIO;
      if (calIo && typeof calIo.suppressAxisPromptFor === 'function') calIo.suppressAxisPromptFor(1500);
    } catch (_) {}

    const calibration = applyCalibration(sample);
    if (calibration.ok) {
      selectWavelengthAxis();
      log((isSwedish() ? sample.labelSv : sample.labelEn) + ': calibration loaded.');
    } else {
      log('Example image loaded, but calibration could not be applied: ' + calibration.reason);
    }

    try {
      if (typeof global.redrawGraphIfLoadedImage === 'function') global.redrawGraphIfLoadedImage(true);
      else if (typeof global.drawGraph === 'function') global.drawGraph();
    } catch (_) {}

    log((isSwedish() ? sample.labelSv : sample.labelEn) + ' loaded · 1280×720 px · stripe 5 px · Gas Tube preset.');
  }

  function enableAstroAnalysis() {
    try {
      const astroTab = global.document && global.document.querySelector('#spTabs .sp-tab[data-tab="astro"]');
      if (astroTab && typeof astroTab.click === 'function') astroTab.click();
      if (sp.appMode && typeof sp.appMode.setMode === 'function') {
        sp.appMode.setMode('ASTRO', { source: 'exampleSpectrum.solar' });
      } else if (sp.store && typeof sp.store.update === 'function') {
        sp.store.update('appMode', 'ASTRO', { source: 'exampleSpectrum.solar' });
      }
      if (sp.store && typeof sp.store.update === 'function') {
        sp.store.update('analysis.enabled', true, { source: 'exampleSpectrum.solar' });
        sp.store.update('worker.mode', 'auto', { source: 'exampleSpectrum.solar' });
        sp.store.update('worker.enabled', true, { source: 'exampleSpectrum.solar' });
        sp.store.update('subtraction.mode', 'raw', { source: 'exampleSpectrum.solar' });
      }
      const enabled = $('spAstroEnabled');
      if (enabled) enabled.checked = true;
      const client = sp.analysisWorkerClient;
      if (client && typeof client.start === 'function') client.start();
    } catch (_) {}
  }

  function finishLoadedNumeric(sample, asset) {
    const graph = global.SpectraCore && global.SpectraCore.graph;
    if (!graph || typeof graph.setNumericFrame !== 'function') {
      throw new Error('Numeric spectrum support is unavailable.');
    }

    try {
      if (typeof global.switchLoadedImageSettings === 'function') {
        global.switchLoadedImageSettings(isSwedish() ? sample.sourceLabelSv : sample.sourceLabelEn);
      }
    } catch (_) {}
    const video = $('videoMain');
    const image = $('cameraImage');
    const sourceWindow = $('videoMainWindow');
    try {
      if (sp.framePreview && typeof sp.framePreview.clearSourceImage === 'function') {
        sp.framePreview.clearSourceImage();
      } else if (image) {
        image.onload = null;
        image.removeAttribute('src');
      }
    } catch (_) {}
    if (sourceWindow) sourceWindow.classList.add('sp-numeric-source');
    if (video) video.style.display = 'none';
    if (image) image.style.display = 'none';
    const solarSourceRgb = renderSolarSourcePreview(asset);
    const pause = $('pauseVideoButton');
    const play = $('playVideoButton');
    if (pause) pause.style.visibility = 'hidden';
    if (play) play.style.visibility = 'visible';

    enableAstroAnalysis();
    setGraphFillMode('source');
    const calibration = applyCalibration({ calibration: asset.calibration });
    if (!calibration.ok) throw new Error('Solar calibration could not be activated: ' + calibration.reason);
    selectWavelengthAxis();

    graph.setNumericFrame({
      px: asset.wavelengthNm.map(function (_, index) { return index; }),
      nm: asset.wavelengthNm,
      I: asset.irradianceWm2Nm,
      sourceRgb: solarSourceRgb,
      calibrated: true,
      calibration: asset.calibration,
      hardware: { spectrometerResolutionFwhmNm: asset.grid.stepNm * 2, pixelResolutionNm: asset.grid.stepNm },
      metadata: { schema: asset.schema, id: asset.id, provenance: asset.provenance, units: asset.units },
      previewWidth: 1280,
      previewHeight: 720,
      sourceWidth: 1280,
      sourceHeight: 720,
      source: 'solar-example'
    });
    configureSampleStripePreview(sample, asset, {
      width: 1280,
      height: 720,
      bandTop: 110,
      bandHeight: 500,
      stripeYpx: 360,
      stripeWidthPx: 1
    });
    global.setTimeout(function () {
      try { if (typeof global.redrawGraphIfLoadedImage === 'function') global.redrawGraphIfLoadedImage(true); } catch (_) {}
      try { if (typeof global.showSelectedStripe === 'function') global.showSelectedStripe(); } catch (_) {}
    }, 300);
    log((isSwedish() ? sample.labelSv : sample.labelEn) + ' loaded · calibrated 388–670 nm numeric spectrum · ASTRO analysis enabled.');
  }

  async function load(id) {
    const sample = getExample(id || selectedExampleId || EXAMPLES[0].id);
    if (!sample || loading) return false;
    selectedExampleId = sample.id;
    setBusy(true);

    try {
      if (sample.kind === 'rgb-spectrum') {
        const spectrumAsset = await loadRgbSpectrumAsset(sample);
        stopLiveSource();
        closeChooser();
        finishLoadedRgbSpectrum(sample, spectrumAsset);
        return true;
      }
      if (sample.kind === 'numeric') {
        const numericAsset = await loadNumericAsset(sample);
        stopLiveSource();
        closeChooser();
        finishLoadedNumeric(sample, numericAsset);
        return true;
      }
      const imageUrl = await preloadAsset(sample);
      stopLiveSource();
      closeChooser();

      try {
        if (typeof global.switchLoadedImageSettings === 'function') {
          global.switchLoadedImageSettings(isSwedish() ? sample.sourceLabelSv : sample.sourceLabelEn);
        }
      } catch (_) {}

      const video = $('videoMain');
      if (video) video.style.display = 'none';

      const pause = $('pauseVideoButton');
      const play = $('playVideoButton');
      if (pause) pause.style.visibility = 'hidden';
      if (play) play.style.visibility = 'visible';

      const image = $('cameraImage');
      if (!image) throw new Error('Source image element is unavailable.');

      try {
        const rt = sp.runtime || {};
        if (typeof rt.setVideoElement === 'function') rt.setVideoElement(image);
      } catch (_) {}

      await new Promise(function (resolve, reject) {
        image.onload = function () {
          if (!dimensionsMatch(sample, image)) {
            reject(new Error('Example image dimensions do not match the calibrated 1280×720 source.'));
            return;
          }
          try {
            finishLoadedImage(sample, image);
            resolve();
          } catch (error) {
            reject(error);
          }
        };
        image.onerror = function () {
          reject(new Error('The bundled example image could not be decoded.'));
        };
        image.src = imageUrl;
        image.style.display = 'block';
      });

      return true;
    } catch (error) {
      log('Load failed: ' + String(error && error.message || error));
      try { global.console && global.console.error && global.console.error('[SPECTRA example]', error); } catch (_) {}
      return false;
    } finally {
      setBusy(false);
    }
  }

  function install() {
    const button = $(BUTTON_ID);
    if (!button || button.__spExampleBound) return false;
    button.__spExampleBound = true;
    button.addEventListener('click', openChooser);
    button.textContent = buttonLabel();
    button.title = t('Choose a bundled example measurement.', 'Välj en inbyggd exempelmätning.');
    return true;
  }

  sp.exampleSpectrumUi = {
    version: VERSION,
    open: openChooser,
    close: closeChooser,
    load: load,
    install: install,
    select: function (id) {
      if (!getExample(id)) return false;
      selectedExampleId = id;
      const overlay = $(OVERLAY_ID);
      if (overlay) updateSelectionUi(overlay);
      return true;
    },
    getSelectedId: function () { return selectedExampleId; },
    getCatalog: function () { return EXAMPLES.map(function (item) { return item.id; }); },
    getConfig: function (id) {
      const sample = getExample(id || selectedExampleId || EXAMPLES[0].id);
      return sample ? JSON.parse(JSON.stringify(sample)) : null;
    }
  };

  if (global.document) {
    global.document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') closeChooser();
    });
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
      install();
    }
    [80, 250, 700, 1400].forEach(function (delay) { global.setTimeout(install, delay); });
  }
})(window);
