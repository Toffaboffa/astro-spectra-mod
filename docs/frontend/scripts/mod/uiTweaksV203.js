(function (global) {
  'use strict';

  const sp = global.SpectraPro = global.SpectraPro || {};
  const VERSION = 'v3.0.8';
  let initialStripeCentered = false;
  let helpClickBound = false;
  let helpPausedByHelp = false;
  let helpPausedVideo = null;
  let helpCloseObserver = null;

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

  function installHelpPolishStyle() {
    if (document.getElementById('spHelpTabV224Style')) return;
    const style = document.createElement('style');
    style.id = 'spHelpTabV224Style';
    style.textContent = [
      '#SpectraProDockHost #spTabs .sp-help-launch{',
      'margin-left:auto!important;',
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
      '#SpectraProDockHost #spTabs .sp-help-launch__q{display:none!important;}',
      'body.sp-help-open .sp-help-overlay{backdrop-filter:none!important;padding:2.2vh 2vw!important;}',
      'body.sp-help-open .sp-help-dialog{height:min(950px,95vh)!important;}',
      'body.sp-help-open .sp-help-head{gap:10px!important;padding:9px 14px!important;}',
      'body.sp-help-open .sp-help-head__sub{margin-top:1px!important;}',
      'body.sp-help-open .sp-help-tabs{gap:2px!important;padding:5px 9px 0!important;}',
      'body.sp-help-open .sp-help-tab{padding:6px 9px!important;}',
      'body.sp-help-open .sp-help-body{padding:13px 17px 18px!important;}',
      'body.sp-help-open .sp-help-hero{gap:14px!important;padding:2px 0 9px!important;}',
      'body.sp-help-open .sp-help-hero h1{margin:2px 0 5px!important;}',
      'body.sp-help-open .sp-help-version{padding:7px 9px!important;}',
      'body.sp-help-open .sp-help-callout{margin:9px 0!important;padding:8px 10px!important;}',
      'body.sp-help-open .sp-help-toc{gap:6px!important;margin:9px 0 13px!important;}',
      'body.sp-help-open .sp-help-toc-card{gap:8px!important;padding:9px!important;min-height:62px!important;}',
      'body.sp-help-open .sp-help-toc-card b{margin-bottom:3px!important;}',
      'body.sp-help-open .sp-help-section{margin:0 0 13px!important;}',
      'body.sp-help-open .sp-help-section h2{margin:0 0 5px!important;}',
      'body.sp-help-open .sp-help-section h3{margin:9px 0 5px!important;}',
      'body.sp-help-open .sp-help-section p,body.sp-help-open .sp-help-section li{line-height:1.5!important;}',
      'body.sp-help-open .sp-help-section ul,body.sp-help-open .sp-help-section ol{margin-top:5px!important;margin-bottom:7px!important;}',
      'body.sp-help-open .sp-help-grid2{gap:7px!important;margin:5px 0 13px!important;}',
      'body.sp-help-open .sp-help-card{padding:9px 10px!important;}',
      'body.sp-help-open .sp-help-card h3{margin:0 0 4px!important;}',
      'body.sp-help-open .sp-help-card p{margin:4px 0!important;line-height:1.5!important;}',
      'body.sp-help-open .sp-help-preset-grid{gap:6px!important;}',
      'body.sp-help-open .sp-help-steps{gap:5px!important;margin:5px 0 13px!important;}',
      'body.sp-help-open .sp-help-step{gap:8px!important;padding:8px 10px!important;}',
      'body.sp-help-open .sp-help-step h3{margin:1px 0 2px!important;}',
      'body.sp-help-open .sp-help-step p{line-height:1.48!important;}',
      'body.sp-help-open .sp-help-dl{gap:2px 10px!important;line-height:1.48!important;}',
      'body.sp-help-open .sp-help-dl dt,body.sp-help-open .sp-help-dl dd{padding:3px 0!important;}',
      'body.sp-help-open .sp-help-table-wrap{margin-top:5px!important;}',
      'body.sp-help-open .sp-help-ref{line-height:1.4!important;}',
      'body.sp-help-open .sp-help-ref th,body.sp-help-open .sp-help-ref td{padding:5px 7px!important;}',
      'body.sp-help-open .sp-help-shot{margin:13px 0!important;}',
      'body.sp-help-open .sp-help-shot__frame{min-height:120px!important;padding:12px 16px!important;}',
      'body.sp-help-open .sp-help-shot__frame strong{margin:4px 0!important;}',
      'body.sp-help-open .sp-help-shot__frame small{margin-top:5px!important;}',
      'body.sp-help-open .sp-help-qa{margin:3px 0!important;}',
      'body.sp-help-open .sp-help-qa summary{padding:8px 10px!important;}',
      'body.sp-help-open .sp-help-qa p{padding:8px 10px!important;line-height:1.5!important;}'
    ].join('');
    document.head.appendChild(style);
  }

  function patchHelpVersionAndRuntimeNote() {
    try {
      if (sp.helpUi) sp.helpUi.version = VERSION.replace(/^v/, '');
      const guideVersion = document.querySelector('#spHelpOverlay .sp-help-version b');
      if (guideVersion) guideVersion.textContent = VERSION;
      document.querySelectorAll('#spHelpOverlay .sp-help-card p').forEach(function (p) {
        const text = String(p.textContent || '');
        if (text.indexOf('HELP opens this modal without changing app mode or stopping the current measurement.') >= 0) {
          p.textContent = 'HELP opens this modal without changing app mode. A live camera is paused while the guide is open and resumes when the guide closes; an already-paused camera stays paused.';
        }
      });
    } catch (_) {}
  }

  function normalizeHelpButtonRight() {
    const tabs = document.getElementById('spTabs');
    const button = document.getElementById('spHelpLaunch');
    if (!tabs || !button) return false;

    button.classList.remove('sp-tab');
    button.classList.add('sp-help-launch');
    button.textContent = 'HELP';
    button.title = 'Open the SPECTRA PRO help guide.';
    if (button.parentElement !== tabs || button.nextElementSibling) tabs.appendChild(button);
    patchHelpVersionAndRuntimeNote();
    return true;
  }

  function getLiveVideoElement() {
    try {
      const rt = sp.runtime || {};
      const video = (typeof rt.getVideoElement === 'function') ? rt.getVideoElement() : document.getElementById('videoMain');
      if (!video || String(video.tagName || '').toUpperCase() !== 'VIDEO') return null;
      const live = (typeof rt.isSourceLive === 'function') ? rt.isSourceLive() : !!video.srcObject;
      return live ? video : null;
    } catch (_) {
      return null;
    }
  }

  function pauseLiveVideoForHelp() {
    if (helpPausedByHelp) return;
    const video = getLiveVideoElement();
    if (!video || video.paused || video.ended) return;

    helpPausedByHelp = true;
    helpPausedVideo = video;
    try {
      if (typeof global.pauseVideo === 'function') global.pauseVideo();
      else video.pause();
    } catch (_) {
      helpPausedByHelp = false;
      helpPausedVideo = null;
    }
  }

  function resumeLiveVideoAfterHelp() {
    if (!helpPausedByHelp) return;
    const video = helpPausedVideo;
    helpPausedByHelp = false;
    helpPausedVideo = null;

    try {
      const rt = sp.runtime || {};
      const current = (typeof rt.getVideoElement === 'function') ? rt.getVideoElement() : document.getElementById('videoMain');
      const stillLive = (typeof rt.isSourceLive === 'function') ? rt.isSourceLive() : !!(video && video.srcObject);
      if (!video || current !== video || !stillLive || !video.paused) return;
      if (typeof global.playVideo === 'function') global.playVideo();
      else {
        const promise = video.play();
        if (promise && typeof promise.catch === 'function') promise.catch(function () {});
      }
    } catch (_) {}
  }

  function armHelpCloseObserver() {
    if (helpCloseObserver) {
      helpCloseObserver.disconnect();
      helpCloseObserver = null;
    }
    if (!helpPausedByHelp || typeof MutationObserver === 'undefined') return;

    const overlay = document.getElementById('spHelpOverlay');
    if (!overlay || !overlay.parentNode) {
      resumeLiveVideoAfterHelp();
      return;
    }

    const parent = overlay.parentNode;
    helpCloseObserver = new MutationObserver(function () {
      if (document.getElementById('spHelpOverlay')) return;
      helpCloseObserver.disconnect();
      helpCloseObserver = null;
      resumeLiveVideoAfterHelp();
    });
    helpCloseObserver.observe(parent, { childList: true });
  }

  function installHelpBehavior() {
    installHelpPolishStyle();
    [0, 80, 180, 350, 700, 1200, 2000].forEach(function (delay) {
      global.setTimeout(normalizeHelpButtonRight, delay);
    });

    if (helpClickBound) return;
    helpClickBound = true;
    document.addEventListener('click', function (event) {
      const target = event.target && event.target.closest ? event.target.closest('#spHelpLaunch') : null;
      if (!target) return;
      pauseLiveVideoForHelp();
      global.setTimeout(function () {
        normalizeHelpButtonRight();
        patchHelpVersionAndRuntimeNote();
        armHelpCloseObserver();
      }, 0);
    }, true);
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
    installHelpBehavior();
    updateVersionBadge();
    global.setTimeout(updateVersionBadge, 350);
    global.setTimeout(function () {
      positionCalibrationPrompt();
      normalizeHelpButtonRight();
      updateVersionBadge();
    }, 700);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})(window);
