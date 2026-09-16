(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const VERSION = 'v2.0.8';
  let initialStripeCentered = false;

  function updateVersionBadge() {
    sp.version = VERSION;
    const badge = document.getElementById('spVersionBadge');
    if (!badge) return false;
    badge.textContent = VERSION;
    badge.title = 'SPECTRA PRO ' + VERSION;
    return true;
  }

  function positionCalibrationPrompt() {
    const prompt = document.getElementById('spCalibrationPrompt');
    const canvas = document.getElementById('graphCanvas');
    const host = document.getElementById('graphWindowContainer');
    if (!prompt || !canvas || !host) return false;

    const hostRect = host.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    if (!(canvasRect.width > 0) || !(canvasRect.height > 0)) return false;

    const left = (canvasRect.left - hostRect.left) + canvasRect.width / 2;
    const top = (canvasRect.top - hostRect.top) + canvasRect.height / 2;

    prompt.style.position = 'absolute';
    prompt.style.left = left + 'px';
    prompt.style.top = top + 'px';
    prompt.style.transform = 'translate(-50%, -50%)';
    prompt.style.zIndex = '2500';
    return true;
  }

  function installPromptPositioning() {
    const host = document.getElementById('graphWindowContainer');
    if (!host) return;
    try {
      if (global.getComputedStyle(host).position === 'static') host.style.position = 'relative';
    } catch (_) {
      host.style.position = 'relative';
    }

    positionCalibrationPrompt();

    if (typeof MutationObserver !== 'undefined' && !host.__spPromptCenterObserver) {
      const observer = new MutationObserver(function () {
        global.requestAnimationFrame(function () {
          positionCalibrationPrompt();
          updateVersionBadge();
        });
      });
      observer.observe(host, { childList: true, subtree: true });
      host.__spPromptCenterObserver = observer;
    }

    global.addEventListener('resize', function () {
      global.requestAnimationFrame(positionCalibrationPrompt);
    });
  }

  function getSourceHeight() {
    try {
      if (typeof global.getCameraResolutionHeight === 'function') {
        const h = Number(global.getCameraResolutionHeight());
        if (Number.isFinite(h) && h > 1) return h;
      }
    } catch (_) {}

    const img = document.getElementById('cameraImage');
    if (img && img.style.display !== 'none') {
      const h = Number(img.naturalHeight || img.height || 0);
      if (Number.isFinite(h) && h > 1) return h;
    }

    const video = document.getElementById('videoMain');
    if (video) {
      const h = Number(video.videoHeight || 0);
      if (Number.isFinite(h) && h > 1) return h;
    }

    const range = document.getElementById('stripePlacementRange');
    if (range) {
      const h = Number(range.max);
      if (Number.isFinite(h) && h > 1) return h;
    }
    return 0;
  }

  function centerStripe(force) {
    if (initialStripeCentered && !force) return true;

    const range = document.getElementById('stripePlacementRange');
    if (!range) return false;
    const sourceHeight = getSourceHeight();
    if (!(sourceHeight > 1)) return false;

    const middle = Math.max(1, Math.round(sourceHeight / 2));
    range.max = String(Math.round(sourceHeight));
    range.value = String(middle);

    try {
      if (typeof global.changeStripePlacement === 'function') {
        global.changeStripePlacement(0);
      } else {
        const label = document.getElementById('stripePlacementValue');
        if (label) label.textContent = '<' + middle + ',' + middle + '> px';
        if (typeof global.drawSelectionLine === 'function') global.drawSelectionLine();
      }
    } catch (_) {
      return false;
    }

    initialStripeCentered = true;
    return true;
  }

  function installInitialStripeCentering() {
    const video = document.getElementById('videoMain');
    const image = document.getElementById('cameraImage');

    if (video && !video.__spInitialStripeCenterBound) {
      video.__spInitialStripeCenterBound = true;
      video.addEventListener('loadedmetadata', function () {
        global.setTimeout(function () { centerStripe(false); }, 0);
      });
    }

    if (image && !image.__spInitialStripeCenterBound) {
      image.__spInitialStripeCenterBound = true;
      image.addEventListener('load', function () {
        global.setTimeout(function () { centerStripe(true); }, 0);
      });
    }

    [80, 300, 800, 1600].forEach(function (delay) {
      global.setTimeout(function () {
        if (!initialStripeCentered) centerStripe(false);
      }, delay);
    });
  }

  function install() {
    installPromptPositioning();
    installInitialStripeCentering();
    updateVersionBadge();
    global.setTimeout(updateVersionBadge, 350);
    global.setTimeout(function () {
      positionCalibrationPrompt();
      updateVersionBadge();
    }, 700);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})(window);
