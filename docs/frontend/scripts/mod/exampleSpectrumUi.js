(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const VERSION = '2.3.4';
  const BUTTON_ID = 'spLoadExampleBtn';
  let imageDataPromise = null;
  let loading = false;

  const EXAMPLE = Object.freeze({
    id: 'spectra1-line-spectrum-2025-09-15',
    label: 'SPECTRA-1 line spectrum example',
    image: {
      originalWidth: 1280,
      originalHeight: 720,
      cropYStart: 300,
      cropYEnd: 460,
      width: 1280,
      height: 160,
      mime: 'image/png',
      chunks: [
        '../assets/examples/spectra1-line-spectrum/chunk-01.txt',
        '../assets/examples/spectra1-line-spectrum/chunk-02.txt',
        '../assets/examples/spectra1-line-spectrum/chunk-03.txt',
        '../assets/examples/spectra1-line-spectrum/chunk-04.txt',
        '../assets/examples/spectra1-line-spectrum/chunk-05.txt',
        '../assets/examples/spectra1-line-spectrum/chunk-06.txt',
        '../assets/examples/spectra1-line-spectrum/chunk-07.txt'
      ]
    },
    calibration: {
      source: 'KVANT SPECTRA 1 factory calibration from SPECTRA v6 report',
      direction: 'nm-left-to-right',
      points: [
        { px: 32, nm: 388.86 },
        { px: 515, nm: 587.57 },
        { px: 1110, nm: 837.76 }
      ],
      reportedPolynomial: {
        a2: 8.457e-6,
        a1: 0.406760986,
        a0: 375.834988
      }
    },
    stripe: { widthPx: 5, yNormalized: 0.5 },
    recommendedPreset: 'smart-gastube'
  });

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

  function label() {
    return isSwedish() ? 'Ladda exempel' : 'Load Example';
  }

  function loadingLabel() {
    return isSwedish() ? 'Laddar…' : 'Loading…';
  }

  function log(message) {
    try {
      if (sp.consoleLog && typeof sp.consoleLog.append === 'function') {
        sp.consoleLog.append('[EXAMPLE] ' + String(message));
      }
    } catch (_) {}
  }

  function setButtonBusy(busy) {
    const button = $(BUTTON_ID);
    if (!button) return;
    button.disabled = !!busy;
    button.textContent = busy ? loadingLabel() : label();
  }

  async function readImageDataUrl() {
    if (imageDataPromise) return imageDataPromise;
    imageDataPromise = (async function () {
      const parts = [];
      for (let i = 0; i < EXAMPLE.image.chunks.length; i += 1) {
        const response = await global.fetch(EXAMPLE.image.chunks[i], { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Example image asset ' + (i + 1) + ' could not be loaded.');
        parts.push(String(await response.text()).trim());
      }
      const base64 = parts.join('');
      if (!base64 || base64.length !== 50840 || base64.slice(0, 8) !== 'iVBORw0K') {
        throw new Error('Example image asset is incomplete.');
      }
      return 'data:' + EXAMPLE.image.mime + ';base64,' + base64;
    })().catch(function (error) {
      imageDataPromise = null;
      throw error;
    });
    return imageDataPromise;
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

  function applyExampleCalibration() {
    const points = EXAMPLE.calibration.points;
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

      for (let i = 0; i < points.length; i += 1) {
        const index = i + 1;
        const px = $('point' + index + 'px');
        const nm = $('point' + index + 'nm');
        if (!px || !nm) return { ok: false, reason: 'Calibration input #' + index + ' is unavailable.' };
        px.value = String(points[i].px);
        nm.value = String(points[i].nm);
      }

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

  function applyStripeDefaults() {
    try {
      const stripe = global.SpectraCore && global.SpectraCore.stripe;
      if (stripe && typeof stripe.setStripeWidth === 'function') {
        stripe.setStripeWidth(EXAMPLE.stripe.widthPx);
      } else {
        const width = $('stripeWidthRange');
        if (width) {
          width.value = String(EXAMPLE.stripe.widthPx);
          if (typeof global.changeStripeWidth === 'function') global.changeStripeWidth(0);
        }
      }

      if (stripe && typeof stripe.setStripeY === 'function') {
        stripe.setStripeY(EXAMPLE.stripe.yNormalized);
      } else {
        const place = $('stripePlacementRange');
        if (place) {
          const max = Number(place.max) || EXAMPLE.image.height;
          place.value = String(Math.round(max * EXAMPLE.stripe.yNormalized));
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

  function selectRecommendedPreset() {
    try {
      if (sp.store && typeof sp.store.update === 'function') {
        sp.store.update('analysis.presetId', EXAMPLE.recommendedPreset, { source: 'exampleSpectrum.preset' });
      }

      const preset = $('spLabPreset');
      if (preset) preset.value = EXAMPLE.recommendedPreset;
    } catch (_) {}
  }

  function finishLoadedImage(image) {
    try {
      const rt = sp.runtime || {};
      if (typeof rt.setVideoElement === 'function') rt.setVideoElement(image);
      if (typeof rt.refreshActiveSourceMetrics === 'function') rt.refreshActiveSourceMetrics();
    } catch (_) {}

    try { if (typeof global.initializeZoomList === 'function') global.initializeZoomList(); } catch (_) {}

    // Put the intended physics in state before any stripe/axis redraw can trigger
    // an already-enabled LAB analysis.
    selectRecommendedPreset();
    applyStripeDefaults();

    const calibration = applyExampleCalibration();
    if (calibration.ok) {
      selectWavelengthAxis();
      log('SPECTRA-1 calibration loaded: 32→388.86 nm, 515→587.57 nm, 1110→837.76 nm.');
    } else {
      log('Example image loaded, but calibration could not be applied: ' + calibration.reason);
    }

    try {
      if (typeof global.redrawGraphIfLoadedImage === 'function') global.redrawGraphIfLoadedImage(true);
      else if (typeof global.drawGraph === 'function') global.drawGraph();
    } catch (_) {}

    log('Line-spectrum example loaded · 1280×160 px · stripe 5 px centered · recommended preset Gas Tube.');
  }

  async function load() {
    if (loading) return false;
    loading = true;
    setButtonBusy(true);

    try {
      const dataUrl = await readImageDataUrl();
      stopLiveSource();

      try {
        if (typeof global.switchLoadedImageSettings === 'function') {
          global.switchLoadedImageSettings(isSwedish() ? 'SPECTRA-1 exempel (kalibrerat)' : 'SPECTRA-1 example (calibrated)');
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
            finishLoadedImage(image);
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
      loading = false;
      setButtonBusy(false);
    }
  }

  function install() {
    const button = $(BUTTON_ID);
    if (!button || button.__spExampleBound) return false;
    button.__spExampleBound = true;
    button.addEventListener('click', function () { load(); });
    button.textContent = label();
    return true;
  }

  sp.exampleSpectrumUi = {
    version: VERSION,
    load: load,
    install: install,
    getConfig: function () { return JSON.parse(JSON.stringify(EXAMPLE)); }
  };

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', install, { once: true });
    } else {
      install();
    }
    [80, 250, 700, 1400].forEach(function (delay) { global.setTimeout(install, delay); });
  }
})(window);
