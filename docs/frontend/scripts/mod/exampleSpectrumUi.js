(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const VERSION = '2.3.5';
  const BUTTON_ID = 'spLoadExampleBtn';
  const OVERLAY_ID = 'spExampleChooserOverlay';
  const STYLE_ID = 'spExampleChooserStyle';
  let imageDataPromises = {};
  let loading = false;

  const EXAMPLES = Object.freeze([
    Object.freeze({
      id: 'n2-spectral-tube',
      labelEn: 'N₂ spectral tube',
      labelSv: 'N₂ spektralrör',
      descriptionEn: 'Nitrogen discharge-tube spectrum recorded with SPECTRA-1.',
      descriptionSv: 'Kvävespektrum från spektralrör, registrerat med SPECTRA-1.',
      sourceLabelEn: 'N₂ spectral tube (calibrated)',
      sourceLabelSv: 'N₂ spektralrör (kalibrerat)',
      image: Object.freeze({
        width: 1280,
        height: 720,
        mime: 'image/png',
        base64Length: 109728,
        chunks: Object.freeze([
          '../assets/examples/n2-spectral-tube/chunk-01.txt',
          '../assets/examples/n2-spectral-tube/chunk-02.txt',
          '../assets/examples/n2-spectral-tube/chunk-03.txt',
          '../assets/examples/n2-spectral-tube/chunk-04.txt',
          '../assets/examples/n2-spectral-tube/chunk-05.txt',
          '../assets/examples/n2-spectral-tube/chunk-06.txt',
          '../assets/examples/n2-spectral-tube/chunk-07.txt',
          '../assets/examples/n2-spectral-tube/chunk-08.txt',
          '../assets/examples/n2-spectral-tube/chunk-09.txt',
          '../assets/examples/n2-spectral-tube/chunk-10.txt',
          '../assets/examples/n2-spectral-tube/chunk-11.txt',
          '../assets/examples/n2-spectral-tube/chunk-12.txt',
          '../assets/examples/n2-spectral-tube/chunk-13.txt',
          '../assets/examples/n2-spectral-tube/chunk-14.txt',
          '../assets/examples/n2-spectral-tube/chunk-15.txt',
          '../assets/examples/n2-spectral-tube/chunk-16.txt'
        ])
      }),
      calibration: Object.freeze({
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
      }),
      stripe: Object.freeze({ widthPx: 5, yNormalized: 0.54 }),
      recommendedPreset: 'smart-gastube'
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
      '#' + OVERLAY_ID + ' .sp-example-card{width:100%;text-align:left;background:#0a2445;color:#eafff9;border:1px solid rgba(159,255,229,.26);border-radius:8px;padding:13px 14px;cursor:pointer;transition:border-color .12s ease,background .12s ease;}',
      '#' + OVERLAY_ID + ' .sp-example-card:hover,#' + OVERLAY_ID + ' .sp-example-card:focus{outline:none;border-color:#9fffe5;background:#0d2b50;}',
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

    const swedish = isSwedish();
    const cards = EXAMPLES.map(function (sample) {
      const label = swedish ? sample.labelSv : sample.labelEn;
      const desc = swedish ? sample.descriptionSv : sample.descriptionEn;
      return [
        '<button type="button" class="sp-example-card" data-example-id="' + sample.id + '">',
        '  <span class="sp-example-card__top"><span class="sp-example-card__title">' + label + '</span><span class="sp-example-card__badge">N₂</span></span>',
        '  <p>' + desc + '</p>',
        '  <span class="sp-example-meta">1280×720 px · 3-point calibration · Gas Tube preset</span>',
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
      '    <p class="sp-example-intro">' + t('Choose a bundled example measurement to load into SPECTRA PRO.', 'Välj en inbyggd exempelmätning att ladda i SPECTRA PRO.') + '</p>',
      cards,
      '    <div class="sp-example-actions"><button type="button" class="sp-example-load" data-example-id="' + EXAMPLES[0].id + '">' + t('Load sample', 'Ladda prov') + '</button></div>',
      '  </div>',
      '</section>'
    ].join('');

    const close = overlay.querySelector('.sp-example-close');
    if (close) close.addEventListener('click', closeChooser);

    overlay.querySelectorAll('[data-example-id]').forEach(function (el) {
      el.addEventListener('click', function () {
        const id = String(el.getAttribute('data-example-id') || '');
        load(id);
      });
    });

    return overlay;
  }

  function openChooser() {
    const overlay = renderChooser();
    overlay.hidden = false;
    const first = overlay.querySelector('.sp-example-card');
    if (first) {
      try { first.focus(); } catch (_) {}
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

  async function readImageDataUrl(sample) {
    if (imageDataPromises[sample.id]) return imageDataPromises[sample.id];
    imageDataPromises[sample.id] = (async function () {
      const parts = [];
      for (let i = 0; i < sample.image.chunks.length; i += 1) {
        const response = await global.fetch(sample.image.chunks[i], { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Example image asset ' + (i + 1) + ' could not be loaded.');
        parts.push(String(await response.text()).trim());
      }
      const base64 = parts.join('');
      if (!base64 || base64.length !== sample.image.base64Length ||
          base64.slice(0, 8) !== 'iVBORw0K' ||
          base64.slice(-8) !== 'TkSuQmCC') {
        throw new Error('Example image asset is incomplete.');
      }
      return 'data:' + sample.image.mime + ';base64,' + base64;
    })().catch(function (error) {
      delete imageDataPromises[sample.id];
      throw error;
    });
    return imageDataPromises[sample.id];
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

  function finishLoadedImage(sample, image) {
    try {
      const rt = sp.runtime || {};
      if (typeof rt.setVideoElement === 'function') rt.setVideoElement(image);
      if (typeof rt.refreshActiveSourceMetrics === 'function') rt.refreshActiveSourceMetrics();
    } catch (_) {}

    try { if (typeof global.initializeZoomList === 'function') global.initializeZoomList(); } catch (_) {}

    selectRecommendedPreset(sample);
    applyStripe(sample);

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

  async function load(id) {
    const sample = getExample(id || EXAMPLES[0].id);
    if (!sample || loading) return false;
    setBusy(true);

    try {
      const dataUrl = await readImageDataUrl(sample);
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
        image.src = dataUrl;
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
    getCatalog: function () { return EXAMPLES.map(function (item) { return item.id; }); },
    getConfig: function (id) {
      const sample = getExample(id || EXAMPLES[0].id);
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
