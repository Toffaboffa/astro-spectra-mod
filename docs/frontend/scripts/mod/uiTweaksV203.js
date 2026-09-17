(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const VERSION = 'v2.2.3';
  let initialStripeCentered = false;
  let helpClickBound = false;

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

  function installHelpTabStyle() {
    if (!document.getElementById('spHelpTabV223Style')) {
      const style = document.createElement('style');
      style.id = 'spHelpTabV223Style';
      style.textContent = [
        '#SpectraProDockHost #spTabs .sp-help-launch{',
        'margin-left:0!important;',
        'display:inline-flex!important;',
        'align-items:center!important;',
        'justify-content:center!important;',
        'gap:0!important;',
        'border:1px solid rgba(16,185,129,.85)!important;',
        'border-bottom:0!important;',
        'background:#9fffe5!important;',
        'color:#071b36!important;',
        'border-radius:8px 8px 0 0!important;',
        'padding:6px 10px!important;',
        'font-size:inherit!important;',
        'font-weight:700!important;',
        'line-height:1.1!important;',
        'letter-spacing:normal!important;',
        'box-shadow:none!important;',
        'cursor:pointer!important;',
        '}',
        '#SpectraProDockHost #spTabs .sp-help-launch:hover,#SpectraProDockHost #spTabs .sp-help-launch:focus-visible{',
        'background:#6efcd5!important;',
        'color:#04172a!important;',
        'outline:none!important;',
        '}',
        '#SpectraProDockHost #spTabs .sp-help-launch__q{display:none!important;}'
      ].join('');
      document.head.appendChild(style);
    }
  }

  function patchHelpVersion() {
    try {
      if (sp.helpUi) sp.helpUi.version = VERSION.replace(/^v/, '');
      const guideVersion = document.querySelector('#spHelpOverlay .sp-help-version b');
      if (guideVersion) guideVersion.textContent = VERSION;
    } catch (_) {}
  }

  function placeHelpAfterAstro() {
    const tabs = document.getElementById('spTabs');
    const button = document.getElementById('spHelpLaunch');
    if (!tabs || !button) return false;

    const astro = tabs.querySelector('.sp-tab[data-tab="astro"]');
    button.classList.add('sp-help-launch');
    button.textContent = 'HELP';
    button.title = 'Open the SPECTRA PRO help guide.';

    if (astro && astro.nextElementSibling !== button) {
      astro.insertAdjacentElement('afterend', button);
    } else if (!astro && button.parentElement !== tabs) {
      tabs.appendChild(button);
    }

    patchHelpVersion();
    return true;
  }

  function installHelpTabPolish() {
    installHelpTabStyle();
    [0, 80, 180, 350, 700, 1200, 2000].forEach(function (delay) {
      global.setTimeout(placeHelpAfterAstro, delay);
    });

    if (!helpClickBound) {
      helpClickBound = true;
      document.addEventListener('click', function (event) {
        const target = event.target && event.target.closest ? event.target.closest('#spHelpLaunch') : null;
        if (!target) return;
        global.setTimeout(function () {
          placeHelpAfterAstro();
          patchHelpVersion();
        }, 0);
      });
    }
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
    installHelpTabPolish();
    updateVersionBadge();
    global.setTimeout(updateVersionBadge, 350);
    global.setTimeout(function () {
      positionCalibrationPrompt();
      placeHelpAfterAstro();
      updateVersionBadge();
    }, 700);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})(window);