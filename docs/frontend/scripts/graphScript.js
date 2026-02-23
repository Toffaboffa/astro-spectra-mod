(function (global) {
  'use strict';

  const core = global.SpectraCore = global.SpectraCore || {};
  const sp = global.SpectraPro = global.SpectraPro || {};
  let rafId = null;
  let t0 = 0;

  function makeDemoFrame(n) {
    const px = [];
    const R = [], G = [], B = [], I = [];
    for (let i = 0; i < n; i += 1) {
      const x = i / (n - 1);
      const r = Math.max(0, Math.exp(-Math.pow((x - 0.25) / 0.04, 2)) * 0.9 + 0.08 * Math.sin(i / 9));
      const g = Math.max(0, Math.exp(-Math.pow((x - 0.52) / 0.05, 2)) * 1.0 + 0.07 * Math.sin(i / 15));
      const b = Math.max(0, Math.exp(-Math.pow((x - 0.75) / 0.03, 2)) * 0.85 + 0.06 * Math.sin(i / 6));
      px.push(i);
      R.push(+r.toFixed(4)); G.push(+g.toFixed(4)); B.push(+b.toFixed(4));
      I.push(Math.max(r, g, b));
    }
    return { px: px, R: R, G: G, B: B, I: I, timestamp: Date.now(), source: 'phase0-demo' };
  }

  function drawFrame(canvas, frame) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#08111f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#1f3555';
    ctx.lineWidth = 1;
    for (let k = 1; k < 4; k += 1) {
      const y = (h * k) / 4;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    function plot(arr, stroke) {
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      for (let i = 0; i < arr.length; i += 1) {
        const x = i / (arr.length - 1) * (w - 1);
        const y = h - (Math.max(0, Math.min(1.2, arr[i])) / 1.2) * (h - 1);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    plot(frame.R, '#ff5c5c');
    plot(frame.G, '#47d17c');
    plot(frame.B, '#5ca9ff');
    plot(frame.I, '#e9f2ff');

    if (sp.coreHooks) sp.coreHooks.emit('graphRenderAfter', { canvas: canvas, ctx: ctx, frame: frame });
  }

  function renderLoop() {
    const canvas = document.getElementById('graphCanvas');
    if (!canvas) return;
    if (!t0) t0 = performance.now();
    const dt = performance.now() - t0;
    const frame = makeDemoFrame(512);
    // tiny drift to make it feel alive
    frame.I = frame.I.map(function(v, i){ return Math.max(0, v + 0.03 * Math.sin((i + dt / 25) / 18)); });
    core.lastFrame = frame;
    if (sp.coreBridge) sp.coreBridge.frame = frame;
    if (sp.coreHooks) sp.coreHooks.emit('graphFrame', frame);
    drawFrame(canvas, frame);
    rafId = requestAnimationFrame(renderLoop);
  }

  core.graph = core.graph || {};
  core.graph.start = function () {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(renderLoop);
  };
  core.graph.stop = function () {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  };

  global.plotRGBLineFromCamera = global.plotRGBLineFromCamera || function () {
    // Placeholder compatibility shim. Real SPECTRA file will replace this.
    if (core.graph && typeof core.graph.start === 'function') core.graph.start();
  };
})(window);
