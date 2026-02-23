
(function (global) {
  'use strict';
  const sp = global.SpectraPro = global.SpectraPro || {};

  async function fetchJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to load ' + url + ' (' + res.status + ')');
    return res.json();
  }

  async function loadManifest(url) {
    const manifest = await fetchJson(url || '../data/library_manifest.json');
    return manifest;
  }

  sp.libraryClient = { fetchJson, loadManifest };
})(window);
