(function () {
  'use strict';
  const sp = window.SpectraPro || (window.SpectraPro = {});
  const v15 = sp.v15 || (sp.v15 = {});
  const mod = v15.cameraCapabilities || (v15.cameraCapabilities = {});

  function safeObj(v) { return (v && typeof v === 'object') ? v : {}; }

  function pick(obj, keys) {
    const out = {};
    const src = safeObj(obj);
    keys.forEach(function (k) { if (k in src) out[k] = src[k]; });
    return out;
  }

  function getActiveTrack(videoEl) {
    const el = videoEl || document.getElementById('videoMain');
    try {
      const stream = el && el.srcObject;
      if (!stream || typeof stream.getVideoTracks !== 'function') return null;
      const tracks = stream.getVideoTracks();
      return tracks && tracks[0] ? tracks[0] : null;
    } catch (_) {
      return null;
    }
  }

  function summarize(track) {
    const settings = (track && typeof track.getSettings === 'function') ? safeObj(track.getSettings()) : {};
    const capabilities = (track && typeof track.getCapabilities === 'function') ? safeObj(track.getCapabilities()) : {};
    const constraints = (track && typeof track.getConstraints === 'function') ? safeObj(track.getConstraints()) : {};

    const supported = {
      exposureTime: ('exposureTime' in capabilities),
      exposureMode: ('exposureMode' in capabilities),
      focusMode: ('focusMode' in capabilities),
      whiteBalanceMode: ('whiteBalanceMode' in capabilities),
      zoom: ('zoom' in capabilities),
      torch: ('torch' in capabilities),
      frameRate: ('frameRate' in capabilities),
      width: ('width' in capabilities),
      height: ('height' in capabilities)
    };

    const values = {
      deviceId: settings.deviceId || null,
      width: settings.width || null,
      height: settings.height || null,
      frameRate: settings.frameRate || null,
      facingMode: settings.facingMode || null,
      exposureMode: settings.exposureMode || null,
      exposureTime: settings.exposureTime || null,
      focusMode: settings.focusMode || null,
      whiteBalanceMode: settings.whiteBalanceMode || null,
      zoom: settings.zoom || null
    };

    const ranges = {
      exposureTime: capabilities.exposureTime || null,
      zoom: capabilities.zoom || null,
      frameRate: capabilities.frameRate || null,
      width: capabilities.width || null,
      height: capabilities.height || null
    };

    return {
      placeholder: false,
      source: 'track',
      supported: supported,
      values: values,
      ranges: ranges,
      constraints: pick(constraints, ['width', 'height', 'frameRate', 'deviceId']),
      summary: {
        resolution: (values.width && values.height) ? (String(values.width) + 'x' + String(values.height)) : null,
        frameRate: values.frameRate || null,
        exposureSupported: !!supported.exposureTime,
        zoomSupported: !!supported.zoom
      }
    };
  }

  mod.getActiveTrack = getActiveTrack;

  mod.probe = async function probeCameraCapabilities(track) {
    if (!track) {
      return {
        placeholder: false,
        source: 'none',
        supported: {},
        values: {},
        ranges: {},
        constraints: {},
        summary: {},
        status: 'no-track'
      };
    }
    try {
      const result = summarize(track);
      result.status = 'ok';
      return result;
    } catch (err) {
      return {
        placeholder: false,
        source: 'track',
        supported: {},
        values: {},
        ranges: {},
        constraints: {},
        summary: {},
        status: 'error',
        error: String(err && err.message || err)
      };
    }
  };

  mod.probeCurrent = async function probeCurrentCameraCapabilities() {
    const track = getActiveTrack();
    return mod.probe(track);
  };

  // Apply a single constraint safely (zoom/exposureTime/etc.).
  // Returns {ok, applied, reason, value}.
  mod.applySetting = async function applyCameraSetting(key, value, videoEl) {
    const track = getActiveTrack(videoEl);
    if (!track || typeof track.applyConstraints !== 'function') {
      return { ok: false, applied: false, reason: 'no-track-or-unsupported', key: key, value: value };
    }
    try {
      const caps = (typeof track.getCapabilities === 'function') ? safeObj(track.getCapabilities()) : {};
      if (!(key in caps)) {
        return { ok: false, applied: false, reason: 'capability-not-supported', key: key, value: value };
      }
      const v = Number(value);
      if (!Number.isFinite(v)) return { ok: false, applied: false, reason: 'invalid-value', key: key, value: value };
      await track.applyConstraints({ advanced: [ { [key]: v } ] });
      return { ok: true, applied: true, key: key, value: v };
    } catch (err) {
      return { ok: false, applied: false, reason: String(err && err.message || err), key: key, value: value };
    }
  };

  mod.version = 'step4-camera-capabilities+apply';
})();