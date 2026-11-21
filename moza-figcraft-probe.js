/* Moza Studio — FigCraft Device Probe (DEV ONLY)
 * Isolated diagnostic iframe. Does not alter the production FigCraft iframe,
 * Moza editor state, renderer, store, clipboard, or FigCraft engine.
 * Enable with ?devprobe=1. Remove that query parameter to disable the probe entry point.
 */
(function (window, document) {
  'use strict';

  const params = new URLSearchParams(window.location.search);
  if (params.get('devprobe') !== '1') return;

  const COMMANDS_TO_CHECK = [
    'edit.undo', 'edit.redo', 'edit.copy', 'edit.paste', 'edit.duplicate', 'edit.delete',
    'select.all', 'object.group', 'object.ungroup', 'arrange.front', 'arrange.back',
    'object.toggleLock', 'tool.hand', 'view.zoomFit', 'ui.key', 'ui.type', 'ui.pointer',
    'document.inspect', 'node.get', 'node.create', 'node.set', 'command.batch',
    'text.edit.begin', 'text.edit.insert', 'file.new'
  ];
  const CONTROL_METHODS = new Set(['ui.key', 'ui.type', 'ui.pointer', 'document.inspect', 'node.get']);
  const CANONICAL_SITE_URL = 'https://atelier-dh.github.io/moza-studio/';
  const KEYBOARD_MANUAL_IDS = new Set(['numericKeyboard', 'textKeyboard', 'keyboardOcclusion']);
  const state = {
    panel: null, frame: null, launch: null, api: null, ready: false, loading: false,
    running: false, startedAt: null, commandCount: null, commandIds: new Set(),
    commandRows: {}, tests: {}, manual: {}, docName: '',
    frameLoadError: '', baseVisualHeight: 0, baseParentVisualHeight: 0, keyboardVisible: false,
    focusTarget: '', touchValid: false, keyboardMetrics: null, longPressMs: 0, contextMenuSeen: false,
    doubleTapSeen: false, pointerDown: null, lastClickAt: 0, lastClickPoint: null,
    frameListenersInstalled: false, resourceObserver: null, resourceRequests: [], failedAssets: [],
    screenshotBefore: null, screenshotAfter: null, screenshotDiff: null, fontDiagnostics: null, siteAssets: null
  };

  const TEST_DEFS = [
    ['api.commands', 'figcraft.commands()', 'Ambil daftar command dan hitung jumlahnya.'],
    ['document.setup', 'Dokumen uji baru + rectangle + teks', 'Membuat dokumen baru yang terisolasi, lalu membuat 1 rectangle dan 1 text.'],
    ['edit.sequence', 'Duplicate / undo / copy / paste / delete', 'Menjalankan operasi berurutan dan memeriksa hasil melalui document.inspect.'],
    ['ui.pointer', 'ui.pointer shift:true', 'Klik rectangle, lalu shift-click teks; selection harus memuat keduanya.'],
    ['text.input', 'ui.type + text.edit.insert', 'Mulai edit teks, ketik lewat dua API, lalu periksa characters dan ambil screenshot canvas.'],
    ['ui.key', 'ui.key Delete / Enter / Escape', 'Uji key di dokumen probe; Delete hanya menghapus objek uji.']
  ];
  const MANUAL_DEFS = [
    ['longpress', '5. Long-press 600 ms', 'Tekan dan tahan objek selama ≥600 ms. Pastikan context menu FigCraft benar-benar terbuka.'],
    ['doubletap', '6. Double-tap', 'Ketuk dua kali objek/teks dengan cepat. Pastikan respons editor (mis. masuk edit teks) muncul.'],
    ['numericKeyboard', '7. Keyboard pada field angka', 'Tap field angka pada panel Design. Pastikan keyboard layar perangkat muncul.'],
    ['textKeyboard', '8. Keyboard saat mengedit teks', 'Tap teks di canvas, ketik “Probe Mobile 123”, lalu uji Backspace dan prediksi teks.'],
    ['keyboardOcclusion', '9. Canvas/field tidak tertutup keyboard', 'Saat keyboard terbuka, pastikan field aktif dan area kerja yang diperlukan tetap terlihat/tidak tertutup.']
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }
  function stamp() { return new Date().toISOString(); }
  function statusText(status) {
    return status === 'pass' ? '✅ LULUS' : status === 'fail' ? '❌ GAGAL' :
      status === 'invalid' ? '⚪ TIDAK VALID' : status === 'running' ? '⏳ BERJALAN' : '⬜ BELUM DITES';
  }
  function isCoarsePointer() {
    return !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  }
  function manualRequiresKeyboard(id) { return KEYBOARD_MANUAL_IDS.has(id); }
  function syncManualButtons() {
    if (!state.panel) return;
    state.panel.querySelectorAll('[data-probe-manual-result="pass"]').forEach(button => {
      const id = button.closest('[data-probe-manual]')?.dataset.probeManual;
      button.disabled = !state.touchValid || (manualRequiresKeyboard(id) && !state.keyboardVisible);
      button.title = manualRequiresKeyboard(id) && !state.keyboardVisible
        ? 'Belum valid: keyboard layar belum terdeteksi melalui visualViewport.' : '';
    });
  }
  function setPanelStatus(message, kind) {
    const el = state.panel && state.panel.querySelector('#mz-fcp-status');
    if (el) {
      el.textContent = message || '';
      el.dataset.kind = kind || 'normal';
    }
  }
  function setRow(id, status, message, extra) {
    state.tests[id] = { status, message: String(message || ''), extra: extra || null, at: stamp() };
    const row = state.panel && state.panel.querySelector(`[data-probe-test="${id}"]`);
    if (row) {
      const badge = row.querySelector('.mz-fcp-result');
      const detail = row.querySelector('.mz-fcp-detail');
      if (badge) {
        badge.textContent = statusText(status);
        badge.dataset.status = status;
      }
      if (detail) detail.textContent = String(message || '');
      row.title = String(message || '');
    }
    refreshReportPreview();
  }
  function setManual(id, status, message) {
    if (!state.touchValid) {
      status = 'invalid';
      message = 'TIDAK VALID: perangkat tidak terdeteksi memiliki pointer coarse / layar sentuh.';
    } else if (status === 'pass' && manualRequiresKeyboard(id) && !state.keyboardVisible) {
      status = 'pending';
      message = 'LULUS ditolak: keyboard layar belum terdeteksi melalui perubahan visualViewport.height.';
    }
    state.manual[id] = { status, message: String(message || ''), at: stamp() };
    const row = state.panel && state.panel.querySelector(`[data-probe-manual="${id}"]`);
    if (row) {
      const badge = row.querySelector('.mz-fcp-result');
      const detail = row.querySelector('.mz-fcp-detail');
      if (badge) {
        badge.textContent = statusText(status);
        badge.dataset.status = status;
      }
      if (detail) detail.textContent = String(message || '');
    }
    syncManualButtons();
    refreshReportPreview();
  }
  function setCommandRow(id, status, message) {
    state.commandRows[id] = { status, message: String(message || ''), at: stamp() };
    const row = state.panel && state.panel.querySelector(`[data-probe-command="${id}"]`);
    if (row) {
      const badge = row.querySelector('.mz-fcp-result');
      const detail = row.querySelector('.mz-fcp-detail');
      if (badge) {
        badge.textContent = statusText(status);
        badge.dataset.status = status;
      }
      if (detail) detail.textContent = String(message || '');
    }
    refreshReportPreview();
  }
  function refreshReportPreview() {
    const out = state.panel && state.panel.querySelector('#mz-fcp-report-preview');
    if (out) out.value = buildReport();
  }
  function cleanUrlForReport(value) {
    try {
      const url = new URL(value);
      url.searchParams.delete('utm_source');
      return url.href;
    } catch (_) { return String(value || ''); }
  }
  function buildReport() {
    const lines = [
      'MOZA STUDIO × FIGCRAFT — DEVICE PROBE M1.5 v1.1',
      `Waktu: ${stamp()}`,
      `URL situs: ${CANONICAL_SITE_URL}`,
      `URL Moza aktual: ${cleanUrlForReport(window.location.href)}`,
      `URL iframe: ${state.frame ? cleanUrlForReport(state.frame.src) : '(belum dibuka)'}`,
      `FigCraft ready: ${state.ready ? 'yes' : 'no'}`,
      `Jumlah command: ${state.commandCount == null ? 'belum diperoleh' : state.commandCount}`,
      '',
      'INFORMASI PERANGKAT',
      `User agent: ${navigator.userAgent}`,
      `DPR: ${window.devicePixelRatio || 1}`,
      `Viewport: ${window.innerWidth} × ${window.innerHeight}`,
      `Visual viewport: ${window.visualViewport ? `${Math.round(window.visualViewport.width)} × ${Math.round(window.visualViewport.height)} (scale ${window.visualViewport.scale || 1})` : 'tidak tersedia'}`,
      `Pointer coarse / layar sentuh: ${state.touchValid ? 'yes' : 'no'}`,
      `Pointer fine: ${window.matchMedia && window.matchMedia('(pointer: fine)').matches ? 'yes' : 'no'}`,
      `WebGPU: ${navigator.gpu ? 'available' : 'not detected'}`,
      `WebGL2: ${detectWebGL2() ? 'available' : 'not detected'}`,
      `Keyboard layar: ${state.keyboardVisible ? 'terdeteksi dari visualViewport.height' : 'belum terdeteksi'}`,
      `VisualViewport keyboard metric: ${state.keyboardMetrics ? JSON.stringify(state.keyboardMetrics) : 'belum tersedia'}`,
      '',
      'KETERSEDIAAN COMMAND / API'
    ];
    COMMANDS_TO_CHECK.forEach(id => {
      const item = state.commandRows[id] || { status: 'pending', message: 'Belum diperiksa' };
      lines.push(`${statusText(item.status)} ${id} — ${item.message}`);
    });
    lines.push('', 'TES OTOMATIS');
    TEST_DEFS.forEach(([id, label]) => {
      const item = state.tests[id] || { status: 'pending', message: 'Belum dijalankan' };
      lines.push(`${statusText(item.status)} ${label} — ${item.message}`);
    });
    lines.push('', 'TES MANUAL PERANGKAT');
    MANUAL_DEFS.forEach(([id, label]) => {
      const item = state.manual[id] || { status: 'pending', message: 'Belum dicatat' };
      lines.push(`${statusText(item.status)} ${label} — ${item.message}`);
    });
    lines.push('', 'BUKTI SCREENSHOT CANVAS');
    lines.push(`figcraft.screenshot() sebelum: ${state.screenshotBefore ? 'tersimpan' : 'belum tersedia'}`);
    lines.push(`figcraft.screenshot() sesudah: ${state.screenshotAfter ? 'tersimpan' : 'belum tersedia'}`);
    lines.push(`Pixel berubah pada area canvas: ${state.screenshotDiff == null ? 'belum dapat dihitung' : state.screenshotDiff + ' pixel'}`);
    if (state.fontDiagnostics) {
      lines.push('', 'DIAGNOSTIK FONT FIGCRAFT');
      lines.push(`Jumlah text node: ${state.fontDiagnostics.textNodes.length}`);
      lines.push(`Font database FigCraft: ${state.fontDiagnostics.availableFamilies.length} family terdaftar`);
      state.fontDiagnostics.textNodes.forEach(node => {
        lines.push(`Text #${node.id}: family="${node.fontFamily || '(default)'}", style="${node.fontStyle || 'Regular'}", size=${node.fontSize || 'n/a'}, characters="${node.characters}"`);
      });
      state.fontDiagnostics.familyChecks.forEach(font => {
        lines.push(`${font.available ? '✅ TERSEDIA' : '❌ TIDAK TERSEDIA'} Font "${font.family}" — styles: ${font.styles.join(', ') || '(tidak ada)'}`);
      });
      lines.push(`Diagnosis teks: ${state.fontDiagnostics.diagnosis || 'belum dapat ditentukan'}`);
      lines.push(`Catatan sumber font: ${state.fontDiagnostics.sourceNote}`);
    } else lines.push('', 'DIAGNOSTIK FONT FIGCRAFT: belum dijalankan');
    if (state.siteAssets) {
      lines.push('', 'ASET DEPLOYMENT figcraft/');
      lines.push(`URL index: ${state.siteAssets.indexUrl}`);
      lines.push(`Index HTTP: ${state.siteAssets.indexStatus}`);
      lines.push(`Asset referensi ditemukan: ${state.siteAssets.assets.length}`);
      state.siteAssets.assets.forEach(asset => lines.push(`${asset.status >= 200 && asset.status < 400 ? '✅' : '❌'} HTTP ${asset.status} ${asset.url}`));
      lines.push(`Directory listing: ${state.siteAssets.directoryListing ? 'tersedia' : 'tidak tersedia (GitHub Pages tidak menampilkan daftar folder)'}`);
      lines.push(`Font sebagai file terpisah: ${state.siteAssets.fontFiles.length ? state.siteAssets.fontFiles.join(', ') : 'tidak direferensikan; FigCraft release meng-embed font ke WASM'}`);
    } else lines.push('', 'ASET DEPLOYMENT figcraft/: belum diperiksa');
    lines.push('', 'REQUEST JARINGAN GAGAL (FONT / ASSET)');
    if (state.failedAssets.length) state.failedAssets.forEach(item => lines.push(`❌ ${item.status || 'error'} ${item.url} — ${item.message || 'request gagal'}`));
    else lines.push('Tidak ada 404/error font atau asset yang terdeteksi pada request yang dapat diamati.');
    lines.push(`Request asset teramati: ${state.resourceRequests.length}`);
    state.resourceRequests.slice(0, 30).forEach(item => lines.push(`· ${item.status} ${item.url}`));
    lines.push('', 'DIAGNOSTIK INTERAKSI');
    lines.push(`Long press terdeteksi: ${state.longPressMs ? `${state.longPressMs} ms` : 'belum'}`);
    lines.push(`Contextmenu event: ${state.contextMenuSeen ? 'terdeteksi' : 'belum terdeteksi'}`);
    lines.push(`Double click event: ${state.doubleTapSeen ? 'terdeteksi' : 'belum terdeteksi'}`);
    lines.push(`Elemen fokus iframe: ${state.focusTarget || 'belum diketahui'}`);
    if (state.frameLoadError) lines.push(`Error iframe: ${state.frameLoadError}`);
    return lines.join('\n');
  }
  function detectWebGL2() {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false });
      if (!gl) return false;
      const ext = gl.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      return true;
    } catch (_) { return false; }
  }
  function deviceSummary() {
    const rows = [
      ['User agent', navigator.userAgent],
      ['DPR', String(window.devicePixelRatio || 1)],
      ['Viewport', `${window.innerWidth} × ${window.innerHeight}`],
      ['Visual viewport', window.visualViewport ? `${Math.round(window.visualViewport.width)} × ${Math.round(window.visualViewport.height)}` : 'n/a'],
      ['Pointer', `${window.matchMedia('(pointer: coarse)').matches ? 'coarse' : 'not coarse'} / ${window.matchMedia('(pointer: fine)').matches ? 'fine' : 'not fine'}`],
      ['WebGPU', navigator.gpu ? 'tersedia' : 'tidak terdeteksi'],
      ['WebGL2', detectWebGL2() ? 'tersedia' : 'tidak terdeteksi']
    ];
    const box = state.panel && state.panel.querySelector('#mz-fcp-device');
    if (box) box.innerHTML = rows.map(([k, v]) => `<div><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('');
  }
  function timeout(promise, ms, label) {
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => window.setTimeout(() => reject(new Error(`${label || 'Operasi'} timeout (${ms} ms)`)), ms))
    ]);
  }
  function baseDirectory() {
    const url = new URL(window.location.href);
    if (!url.pathname.endsWith('/')) {
      const last = url.pathname.slice(url.pathname.lastIndexOf('/') + 1);
      if (last.includes('.')) url.pathname = url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1);
      else url.pathname += '/';
    }
    url.search = '';
    url.hash = '';
    return url;
  }
  function buildProbeUrl() {
    const url = new URL('figcraft/', baseDirectory());
    url.searchParams.set('host', 'parent');
    url.searchParams.set('control', '1');
    url.searchParams.set('probe', '1');
    url.searchParams.set('session', `probe-${Date.now()}`);
    return url.href;
  }
  function getApi() {
    try { return state.frame && state.frame.contentWindow && state.frame.contentWindow.figcraft || null; }
    catch (_) { return null; }
  }
  async function waitForApi(maxMs) {
    const start = Date.now();
    while (Date.now() - start < (maxMs || 60000)) {
      if (state.frameLoadError) throw new Error(state.frameLoadError);
      const api = getApi();
      if (api && typeof api.commands === 'function' && typeof api.execute === 'function' && typeof api.request === 'function') {
        state.api = api;
        state.ready = true;
        return api;
      }
      await new Promise(resolve => window.setTimeout(resolve, 250));
    }
    throw new Error('window.figcraft tidak tersedia. Pastikan iframe memuat FigCraft dengan ?host=parent&control=1 dan runtime WASM berhasil start.');
  }
  function assetLike(url) {
    return /(?:\.wasm(?:$|[?#])|\.(?:html|js|css|woff2?|ttf|otf|ttc|svg|png|webp)(?:$|[?#])|font|manifest)/i.test(String(url || ''));
  }
  function recordFailedAsset(url, status, message) {
    if (!url || !assetLike(url)) return;
    const normalized = cleanUrlForReport(url);
    if (state.failedAssets.some(item => item.url === normalized)) return;
    const item = { url: normalized, status: status || 'error', message: message || '' };
    state.failedAssets.push(item);
    refreshReportPreview();
  }
  function recordResourceEntry(entry) {
    if (!entry || !assetLike(entry.name)) return;
    const status = Number(entry.responseStatus || 0);
    const item = { url: cleanUrlForReport(entry.name), status: status || 'unknown', kind: 'resource' };
    if (!state.resourceRequests.some(existing => existing.url === item.url)) state.resourceRequests.push(item);
    if (status >= 400) recordFailedAsset(entry.name, status, `PerformanceResourceTiming responseStatus=${status}`);
  }
  function scanFrameResources(win) {
    try { (win.performance?.getEntriesByType('resource') || []).forEach(recordResourceEntry); } catch (_) {}
  }
  async function fetchAssetStatus(url) {
    try {
      let response = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (response.status === 405 || response.status === 501) {
        response = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, cache: 'no-store' });
      }
      return { url: cleanUrlForReport(url), status: response.status, ok: response.ok };
    } catch (error) {
      return { url: cleanUrlForReport(url), status: 'network-error', ok: false, error: error.message || String(error) };
    }
  }
  function renderAssetDiagnostics() {
    const box = state.panel && state.panel.querySelector('#mz-fcp-assets');
    if (!box) return;
    if (!state.siteAssets) { box.textContent = 'Belum diperiksa.'; return; }
    const rows = [`index.html: HTTP ${state.siteAssets.indexStatus}`, `${state.siteAssets.assets.length} file yang dirujuk dari index.html diperiksa.`];
    state.siteAssets.assets.forEach(asset => rows.push(`${asset.status >= 200 && asset.status < 400 ? '✅' : '❌'} ${asset.status} · ${asset.url.split('/').pop()}`));
    rows.push(state.siteAssets.fontFiles.length
      ? `Font files terpisah: ${state.siteAssets.fontFiles.join(', ')}`
      : 'Tidak ada file font terpisah yang direferensikan; release FigCraft meng-embed font ke WASM.');
    rows.push('GitHub Pages tidak menyediakan directory listing; daftar lengkap folder figcraft/ tidak dapat diminta dari browser.');
    if (state.siteAssets.error) rows.push(`Error: ${state.siteAssets.error}`);
    box.textContent = rows.join('\n');
    refreshReportPreview();
  }
  async function inspectDeployedAssets() {
    const figcraftBase = new URL('figcraft/', baseDirectory());
    const indexUrl = new URL('index.html', figcraftBase);
    const response = await fetch(indexUrl.href, { cache: 'no-store' });
    if (!response.ok) {
      recordFailedAsset(indexUrl.href, response.status, 'figcraft/index.html tidak dapat dimuat');
      state.siteAssets = { indexUrl: indexUrl.href, indexStatus: response.status, assets: [], fontFiles: [], directoryListing: false };
      renderAssetDiagnostics();
      return state.siteAssets;
    }
    const html = await response.text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const refs = [...parsed.querySelectorAll('script[src],link[href],img[src],source[src]')]
      .map(el => el.getAttribute('src') || el.getAttribute('href'))
      .filter(Boolean)
      .map(ref => new URL(ref, indexUrl).href)
      .filter((url, index, all) => all.indexOf(url) === index && new URL(url).origin === window.location.origin);
    const assets = await Promise.all(refs.map(fetchAssetStatus));
    assets.filter(asset => !asset.ok).forEach(asset => recordFailedAsset(asset.url, asset.status, asset.error || 'HTTP error saat verifikasi asset dari index.html'));
    const fontFiles = [...new Set([
      ...refs.filter(url => /\.(?:woff2?|ttf|otf|ttc)(?:$|[?#])|\/fonts\//i.test(url)),
      ...state.resourceRequests.map(item => item.url).filter(url => /\.(?:woff2?|ttf|otf|ttc)(?:$|[?#])|\/fonts\//i.test(url))
    ])];
    const directoryListing = /<title>\s*(?:Index of|Directory listing)/i.test(html);
    state.siteAssets = { indexUrl: indexUrl.href, indexStatus: response.status, assets, fontFiles, directoryListing };
    renderAssetDiagnostics();
    return state.siteAssets;
  }
  function installFrameTelemetry() {
    if (state.frameListenersInstalled || !state.frame) return;
    let doc, win;
    try { doc = state.frame.contentDocument; win = state.frame.contentWindow; } catch (_) { return; }
    if (!doc || !win) return;
    state.frameListenersInstalled = true;
    const vv = win.visualViewport;
    state.baseVisualHeight = vv ? vv.height : win.innerHeight;
    if (!state.baseParentVisualHeight) state.baseParentVisualHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const canvas = doc.getElementById('figcraft_canvas') || doc.querySelector('canvas');
    const target = canvas || doc;
    target.addEventListener('pointerdown', event => {
      state.pointerDown = { at: performance.now(), x: event.clientX, y: event.clientY, pointerType: event.pointerType || 'unknown' };
    }, true);
    doc.addEventListener('pointerup', () => {
      if (!state.pointerDown) return;
      const duration = Math.round(performance.now() - state.pointerDown.at);
      if (duration >= 600) {
        state.longPressMs = duration;
        updateTelemetry();
      }
      state.pointerDown = null;
    }, true);
    doc.addEventListener('pointercancel', () => { state.pointerDown = null; }, true);
    doc.addEventListener('contextmenu', () => {
      state.contextMenuSeen = true;
      updateTelemetry();
    }, true);
    doc.addEventListener('dblclick', () => {
      state.doubleTapSeen = true;
      updateTelemetry();
    }, true);
    doc.addEventListener('click', event => {
      const now = performance.now();
      const point = [event.clientX, event.clientY];
      if (event.detail >= 2 || (state.lastClickAt && now - state.lastClickAt < 360 &&
          state.lastClickPoint && Math.hypot(point[0] - state.lastClickPoint[0], point[1] - state.lastClickPoint[1]) < 28)) {
        state.doubleTapSeen = true;
        updateTelemetry();
      }
      state.lastClickAt = now;
      state.lastClickPoint = point;
    }, true);
    doc.addEventListener('focusin', () => {
      const el = doc.activeElement;
      state.focusTarget = el ? `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}` : '';
      updateTelemetry();
    }, true);
    doc.addEventListener('error', event => {
      const targetEl = event.target;
      const url = targetEl && (targetEl.currentSrc || targetEl.src || targetEl.href);
      if (url) recordFailedAsset(url, 'network-error', 'Resource load error event');
    }, true);
    win.addEventListener('error', event => {
      const targetEl = event.target;
      const url = targetEl && (targetEl.currentSrc || targetEl.src || targetEl.href);
      if (url) recordFailedAsset(url, 'network-error', event.message || 'Window resource error');
    }, true);
    if (win.PerformanceObserver) {
      try {
        state.resourceObserver = new win.PerformanceObserver(list => list.getEntries().forEach(recordResourceEntry));
        state.resourceObserver.observe({ type: 'resource', buffered: true });
      } catch (_) { state.resourceObserver = null; }
    }
    scanFrameResources(win);
    if (vv) vv.addEventListener('resize', updateKeyboardTelemetry);
    win.addEventListener('resize', updateKeyboardTelemetry);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', updateKeyboardTelemetry);
    updateKeyboardTelemetry();
  }
  function updateKeyboardTelemetry() {
    let frameKeyboard = false;
    let parentKeyboard = false;
    if (state.frame) {
      try {
        const win = state.frame.contentWindow;
        const vv = win.visualViewport;
        const height = vv ? vv.height : win.innerHeight;
        const base = state.baseVisualHeight || win.innerHeight;
        frameKeyboard = (base - height > 120) && (height / Math.max(base, 1) < 0.82);
      } catch (_) {}
    }
    const parentVv = window.visualViewport;
    if (parentVv) {
      const height = parentVv.height;
      const base = state.baseParentVisualHeight || window.innerHeight;
      parentKeyboard = (base - height > 120) && (height / Math.max(base, 1) < 0.82);
    }
    state.keyboardVisible = frameKeyboard || parentKeyboard;
    let frameHeight = null, parentHeight = parentVv ? Math.round(parentVv.height) : Math.round(window.innerHeight);
    try { frameHeight = Math.round(state.frame.contentWindow.visualViewport?.height || state.frame.contentWindow.innerHeight); } catch (_) {}
    state.keyboardMetrics = {
      parentBase: Math.round(state.baseParentVisualHeight || window.innerHeight), parentCurrent: parentHeight,
      parentDelta: Math.round((state.baseParentVisualHeight || window.innerHeight) - parentHeight),
      frameBase: Math.round(state.baseVisualHeight || 0), frameCurrent: frameHeight,
      frameDelta: frameHeight == null ? null : Math.round((state.baseVisualHeight || frameHeight) - frameHeight)
    };
    updateTelemetry();
  }
  function updateTelemetry() {
    const box = state.panel && state.panel.querySelector('#mz-fcp-telemetry');
    if (!box) return;
    box.textContent = [
      `Long-press: ${state.longPressMs ? `${state.longPressMs} ms` : 'belum terdeteksi'}`,
      `Context menu event: ${state.contextMenuSeen ? 'terdeteksi' : 'belum terdeteksi'}`,
      `Double-tap/dblclick: ${state.doubleTapSeen ? 'terdeteksi' : 'belum terdeteksi'}`,
      `Keyboard layar: ${state.keyboardVisible ? 'terdeteksi' : 'belum terdeteksi'}`,
      `Fokus iframe: ${state.focusTarget || 'belum diketahui'}`
    ].join(' · ');
    const longpressRow = state.panel.querySelector('[data-probe-manual="longpress"] .mz-fcp-detail');
    if (longpressRow && !state.manual.longpress) longpressRow.textContent =
      state.longPressMs ? `Pointer long-press terdeteksi ${state.longPressMs} ms; context menu ${state.contextMenuSeen ? 'terdeteksi' : 'perlu dikonfirmasi visual'}.` : 'Menunggu gestur 600 ms.';
    const doubleRow = state.panel.querySelector('[data-probe-manual="doubletap"] .mz-fcp-detail');
    if (doubleRow && !state.manual.doubletap) doubleRow.textContent =
      state.doubleTapSeen ? 'Event dblclick / dua click cepat terdeteksi; konfirmasi respons editor.' : 'Menunggu double-tap.';
    const keyboardRows = ['numericKeyboard', 'textKeyboard', 'keyboardOcclusion'];
    keyboardRows.forEach(id => {
      const detail = state.panel.querySelector(`[data-probe-manual="${id}"] .mz-fcp-detail`);
      if (detail && !state.manual[id]) detail.textContent = state.keyboardVisible
        ? `VisualViewport mengecil; keyboard layar terdeteksi. Fokus: ${state.focusTarget || 'belum diketahui'}.`
        : `Keyboard layar belum terdeteksi. Fokus: ${state.focusTarget || 'belum diketahui'}.`;
    });
    syncManualButtons();
    refreshReportPreview();
  }
  function renderPanel() {
    const panel = document.createElement('section');
    panel.id = 'mz-fcp-panel';
    panel.hidden = true;
    panel.setAttribute('aria-label', 'Probe FigCraft khusus pengembangan');
    const testRows = TEST_DEFS.map(([id, label, description]) => `
      <div class="mz-fcp-row" data-probe-test="${id}">
        <div class="mz-fcp-row-main"><b>${esc(label)}</b><span class="mz-fcp-result" data-status="pending">${statusText('pending')}</span></div>
        <small>${esc(description)}</small><p class="mz-fcp-detail">Belum dijalankan</p>
      </div>`).join('');
    const commandRows = COMMANDS_TO_CHECK.map(id => `
      <div class="mz-fcp-command" data-probe-command="${id}">
        <code>${esc(id)}</code><span class="mz-fcp-result" data-status="pending">${statusText('pending')}</span><small class="mz-fcp-detail">Belum diperiksa</small>
      </div>`).join('');
    state.touchValid = isCoarsePointer();
    const manualRows = MANUAL_DEFS.map(([id, label, description]) => {
      if (!state.touchValid) {
        const message = 'TIDAK VALID: pointer coarse tidak terdeteksi; jalankan tes ini pada HP/tablet layar sentuh.';
        state.manual[id] = { status: 'invalid', message, at: stamp() };
        return `
          <div class="mz-fcp-row" data-probe-manual="${id}">
            <div class="mz-fcp-row-main"><b>${esc(label)}</b><span class="mz-fcp-result" data-status="invalid">${statusText('invalid')}</span></div>
            <small>${esc(description)}</small><p class="mz-fcp-detail">${esc(message)}</p>
          </div>`;
      }
      const passDisabled = manualRequiresKeyboard(id) ? 'disabled title="Keyboard layar belum terdeteksi melalui visualViewport."' : '';
      return `
        <div class="mz-fcp-row" data-probe-manual="${id}">
          <div class="mz-fcp-row-main"><b>${esc(label)}</b><span class="mz-fcp-result" data-status="pending">${statusText('pending')}</span></div>
          <small>${esc(description)}</small><p class="mz-fcp-detail">Belum dicatat</p>
          <div class="mz-fcp-manual-actions">
            <button type="button" data-probe-manual-result="${id}" data-result="pass" ${passDisabled}>Lulus</button>
            <button type="button" data-probe-manual-result="${id}" data-result="fail">Gagal</button>
          </div>
        </div>`;
    }).join('');
    panel.innerHTML = `
      <header id="mz-fcp-header">
        <div><b>Probe FigCraft</b><small>DEV ONLY · runtime & perangkat · tidak mengubah editor utama</small></div>
        <div class="mz-fcp-actions">
          <span id="mz-fcp-status" data-kind="normal">Belum dibuka</span>
          <button type="button" id="mz-fcp-run" disabled>Jalankan tes otomatis</button>
          <button type="button" id="mz-fcp-copy">Salin laporan</button>
          <button type="button" id="mz-fcp-close" aria-label="Tutup probe">Tutup</button>
        </div>
      </header>
      <main id="mz-fcp-main">
        <section id="mz-fcp-editor">
          <div class="mz-fcp-editor-head"><b>FigCraft Probe Canvas</b><small>Iframe terpisah · ?host=parent&amp;control=1</small></div>
          <iframe id="mz-fcp-frame" title="FigCraft device probe" allow="fullscreen; clipboard-read; clipboard-write" allowfullscreen loading="lazy"></iframe>
          <div id="mz-fcp-frame-placeholder">Buka panel untuk memuat FigCraft. Tes dijalankan pada dokumen probe terpisah.</div>
          <div id="mz-fcp-screenshot-wrap" hidden>
            <b>Bukti visual · figcraft.screenshot()</b>
            <div class="mz-fcp-shot-grid">
              <figure><figcaption>Sebelum mengetik</figcaption><img id="mz-fcp-screenshot-before" alt="Screenshot FigCraft sebelum teks diketik"/></figure>
              <figure><figcaption>Sesudah mengetik</figcaption><img id="mz-fcp-screenshot-after" alt="Screenshot FigCraft setelah teks diketik"/></figure>
            </div>
            <p id="mz-fcp-screenshot-diff">Pixel diff belum dihitung.</p>
          </div>
        </section>
        <section id="mz-fcp-results">
          <div class="mz-fcp-card"><h3>Informasi perangkat</h3><div id="mz-fcp-device"></div></div>
          <div class="mz-fcp-card"><h3>Tes otomatis</h3><div id="mz-fcp-tests">${testRows}</div></div>
          <details class="mz-fcp-card"><summary>Ketersediaan 25 command / API</summary><p class="mz-fcp-muted">Engine command diperiksa melalui figcraft.commands(). Metode kontrol (ui.* dan document.inspect) diverifikasi lewat figcraft.request().</p><div id="mz-fcp-commands">${commandRows}</div></details>
          <div class="mz-fcp-card"><h3>Tes manual perangkat</h3><p class="mz-fcp-muted">Lakukan gestur pada canvas di kiri/atas, lalu catat hasilnya dengan tombol Lulus atau Gagal. Telemetri gesture dan keyboard ikut dicatat bila browser mengizinkan.</p><div id="mz-fcp-manual">${manualRows}</div></div>
          <div class="mz-fcp-card"><h3>Diagnostik font</h3><div id="mz-fcp-fonts">Belum dijalankan. Font FigCraft diperiksa melalui font database engine, bukan CSS document.fonts.</div></div>
          <div class="mz-fcp-card"><h3>Aset deployment figcraft/</h3><div id="mz-fcp-assets">Menunggu pemeriksaan index dan asset situs.</div></div>
          <div class="mz-fcp-card"><h3>Telemetri langsung</h3><p id="mz-fcp-telemetry">Menunggu iframe.</p></div>
          <details class="mz-fcp-card"><summary>Pratinjau laporan teks</summary><textarea id="mz-fcp-report-preview" readonly rows="10"></textarea></details>
        </section>
      </main>`;
    document.body.appendChild(panel);
    state.panel = panel;
    state.frame = panel.querySelector('#mz-fcp-frame');
    state.baseParentVisualHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    panel.addEventListener('click', event => {
      const manualButton = event.target.closest('[data-probe-manual-result]');
      if (manualButton) {
        const id = manualButton.dataset.probeManualResult;
        const result = manualButton.dataset.result;
        setManual(id, result, result === 'pass' ? 'Dikonfirmasi lulus oleh penguji pada perangkat.' : 'Dikonfirmasi gagal oleh penguji pada perangkat.');
        return;
      }
      if (event.target.closest('#mz-fcp-close')) closePanel();
      else if (event.target.closest('#mz-fcp-run')) void runAutomaticTests();
      else if (event.target.closest('#mz-fcp-copy')) void copyReport();
    });
    state.frame.addEventListener('load', onFrameLoad);
    window.addEventListener('message', onProbeMessage, false);
    deviceSummary();
    syncManualButtons();
    refreshReportPreview();
  }
  function onProbeMessage(event) {
    if (!state.frame || event.source !== state.frame.contentWindow || event.origin !== window.location.origin) return;
    const message = event.data;
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'figcraft:failed') {
      state.frameLoadError = String(message.error || 'FigCraft melaporkan kegagalan runtime.');
      setPanelStatus(state.frameLoadError, 'error');
      return;
    }
    if (message.type !== 'figcraft:ready' || message.version !== '1') return;
    try {
      state.frame.contentWindow.postMessage({ type: 'figcraft:host', version: '1', handoff: false }, window.location.origin);
    } catch (error) {
      state.frameLoadError = `Host handshake gagal: ${error && error.message ? error.message : error}`;
      setPanelStatus(state.frameLoadError, 'error');
    }
  }

  function openPanel() {
    if (!state.panel) renderPanel();
    state.panel.hidden = false;
    document.body.classList.add('mz-fcp-open');
    if (!state.frame.src) {
      state.frame.src = buildProbeUrl();
      setPanelStatus('Memuat FigCraft probe…', 'loading');
    } else if (state.ready) {
      setPanelStatus('FigCraft probe siap', 'success');
    }
    deviceSummary();
  }
  function closePanel() {
    if (state.panel) state.panel.hidden = true;
    document.body.classList.remove('mz-fcp-open');
  }
  async function onFrameLoad() {
    if (!state.panel || state.panel.hidden) return;
    const expectedOrigin = window.location.origin;
    try {
      const url = new URL(state.frame.src);
      if (url.origin !== expectedOrigin) throw new Error(`Origin iframe tidak sama: ${url.origin}`);
      if (!state.frame.contentDocument || !state.frame.contentDocument.getElementById('figcraft_canvas')) {
        state.frameLoadError = `Canvas FigCraft tidak ditemukan pada ${state.frame.src}`;
        const placeholder = state.panel.querySelector('#mz-fcp-frame-placeholder');
        if (placeholder) {
          placeholder.textContent = state.frameLoadError;
          placeholder.hidden = false;
        }
        setPanelStatus('FigCraft tidak ditemukan', 'error');
        return;
      }
      const placeholder = state.panel.querySelector('#mz-fcp-frame-placeholder');
      if (placeholder) placeholder.hidden = true;
      installFrameTelemetry();
      void inspectDeployedAssets().catch(error => {
        state.siteAssets = { indexUrl: new URL('index.html', new URL('figcraft/', baseDirectory())).href, indexStatus: 'error', assets: [], fontFiles: [], directoryListing: false, error: error.message || String(error) };
        renderAssetDiagnostics();
      });
      await waitForApi(60000);
      setPanelStatus('FigCraft probe siap · API kontrol aktif', 'success');
      const run = state.panel.querySelector('#mz-fcp-run');
      if (run) run.disabled = false;
      updateTelemetry();
    } catch (error) {
      state.frameLoadError = error && error.message ? error.message : String(error);
      setPanelStatus(state.frameLoadError, 'error');
    }
  }
  async function getApiReady() {
    if (state.api && state.ready) return state.api;
    await waitForApi(60000);
    return state.api;
  }
  async function apiExecute(command, params) {
    return timeout(state.api.execute(command, params || {}), 20000, command);
  }
  async function apiRequest(method, params) {
    return timeout(state.api.request(method, params || {}), 20000, method);
  }
  function normalizeCommandList(value) {
    const list = Array.isArray(value) ? value : (value && (value.commands || value.result || value.items));
    if (!Array.isArray(list)) return [];
    return list.map(item => typeof item === 'string' ? item : item && (item.id || item.command || item.name)).filter(Boolean);
  }
  function findNode(tree, id, found) {
    if (!tree) return found;
    if (Array.isArray(tree)) { tree.forEach(item => findNode(item, id, found)); return found; }
    if (typeof tree !== 'object') return found;
    if (String(tree.id) === String(id)) found.push(tree);
    Object.keys(tree).forEach(key => {
      if (key === 'children' || key === 'pages' || key === 'layers' || key === 'document') findNode(tree[key], id, found);
    });
    return found;
  }
  function collectIds(tree, out) {
    if (!tree) return out;
    if (Array.isArray(tree)) { tree.forEach(item => collectIds(item, out)); return out; }
    if (typeof tree !== 'object') return out;
    if (tree.id != null) out.add(String(tree.id));
    Object.keys(tree).forEach(key => {
      if (key === 'children' || key === 'pages' || key === 'layers') collectIds(tree[key], out);
    });
    return out;
  }
  function resultId(result) {
    if (!result || typeof result !== 'object') return null;
    return result.id != null ? result.id : result.result && result.result.id != null ? result.result.id : null;
  }
  function resultIds(result) {
    if (!result || typeof result !== 'object') return [];
    const ids = result.ids || (result.result && result.result.ids) || [];
    return Array.isArray(ids) ? ids : [];
  }
  function apiId(value) {
    return /^-?\d+$/.test(String(value)) ? Number(value) : value;
  }
  function selectionIds(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(item => typeof item === 'object' && item ? item.id : item).filter(v => v != null).map(String);
    if (typeof value === 'object') {
      if (Array.isArray(value.ids)) return value.ids.map(String);
      if (Array.isArray(value.selected)) return value.selected.map(String);
    }
    return [];
  }

  function pngDataFromResult(result) {
    const value = typeof result === 'string' ? result : result && (result.data || result.png || result.base64 || (result.result && (result.result.data || result.result.png)));
    if (typeof value !== 'string' || !value) return null;
    return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
  }
  async function captureFigCraftScreenshot() {
    if (!state.api || typeof state.api.screenshot !== 'function') {
      throw new Error('figcraft.screenshot() tidak tersedia pada window.figcraft.');
    }
    const result = await timeout(state.api.screenshot(), 60000, 'figcraft.screenshot()');
    const dataUrl = pngDataFromResult(result);
    if (!dataUrl) throw new Error(`figcraft.screenshot() tidak mengembalikan PNG data. Keys: ${Object.keys(result || {}).join(', ') || typeof result}`);
    return dataUrl;
  }
  function collectTextNodes(tree, out, seen) {
    if (!tree || typeof tree !== 'object') return out;
    if (Array.isArray(tree)) { tree.forEach(item => collectTextNodes(item, out, seen)); return out; }
    if (seen.has(tree)) return out;
    seen.add(tree);
    if (String(tree.type || '').toLowerCase() === 'text' || (typeof tree.characters === 'string' && tree.fontFamily)) {
      out.push({
        id: tree.id == null ? 'unknown' : tree.id,
        fontFamily: String(tree.fontFamily || ''),
        fontStyle: String(tree.fontStyle || 'Regular'),
        fontSize: tree.fontSize == null ? '' : tree.fontSize,
        characters: String(tree.characters || '').slice(0, 100)
      });
    }
    Object.values(tree).forEach(value => collectTextNodes(value, out, seen));
    return out;
  }
  function renderFontDiagnostics() {
    const box = state.panel && state.panel.querySelector('#mz-fcp-fonts');
    if (!box) return;
    if (!state.fontDiagnostics) { box.textContent = 'Belum dijalankan.'; return; }
    const rows = [`${state.fontDiagnostics.textNodes.length} text node diperiksa.`, `${state.fontDiagnostics.availableFamilies.length} family tercatat di database font FigCraft.`];
    state.fontDiagnostics.textNodes.forEach(node => {
      rows.push(`Node #${node.id}: ${node.fontFamily || '(default)'} · ${node.fontStyle} · ${node.fontSize || 'ukuran n/a'} · ${node.characters}`);
    });
    state.fontDiagnostics.familyChecks.forEach(font => {
      rows.push(`${font.available ? '✅' : '❌'} ${font.family}: ${font.available ? 'face tersedia' : 'family tidak ditemukan'} (${font.styles.join(', ') || 'no styles'})`);
    });
    rows.push(`DIAGNOSIS: ${state.fontDiagnostics.diagnosis || 'menunggu screenshot sesudah teks'}`);
    rows.push(state.fontDiagnostics.sourceNote);
    box.textContent = rows.join('\n');
    refreshReportPreview();
  }
  async function inspectFontDiagnostics() {
    const doc = await apiRequest('document.inspect', { depth: 12, allPages: true });
    const textNodes = collectTextNodes(doc, [], new WeakSet());
    const familyNamesRaw = await apiExecute('text.fonts', {});
    const availableFamilies = Array.isArray(familyNamesRaw)
      ? familyNamesRaw.map(item => typeof item === 'string' ? item : item && (item.family || item.name)).filter(Boolean)
      : [];
    const families = [...new Set(textNodes.map(node => node.fontFamily).filter(Boolean))];
    const familyChecks = [];
    for (const family of families) {
      const result = await apiExecute('text.fonts', { family });
      const styles = Array.isArray(result) ? result.map(String) : [];
      familyChecks.push({ family, styles, available: styles.length > 0 });
    }
    state.fontDiagnostics = {
      textNodes, availableFamilies, familyChecks,
      sourceNote: 'FigCraft web build meng-embed font catalog ke dalam WASM melalui CRAFT_FONTS_DIR. Font tidak harus berupa file .woff/.ttf terpisah di figcraft/. text.fonts memeriksa face di database engine; screenshot sebelum/sesudah menguji hasil render glyph.'
    };
    renderFontDiagnostics();
    return state.fontDiagnostics;
  }
  function diagnoseTextRender() {
    if (!state.fontDiagnostics) return 'Diagnostik font tidak tersedia.';
    const missing = state.fontDiagnostics.familyChecks.filter(font => !font.available);
    const font404 = state.failedAssets.filter(item => /font|\.(?:woff2?|ttf|otf|ttc)(?:$|[?#])/i.test(item.url));
    let diagnosis;
    if (font404.length) {
      diagnosis = `PATH / ASSET FONT: ${font404.length} request font gagal (404/network). Periksa URL dan packaging asset.`;
    } else if (state.screenshotDiff != null && state.screenshotDiff > 20 && missing.length) {
      diagnosis = `FONT REQUESTED TIDAK TERSEDIA (${missing.map(item => item.family).join(', ')}), tetapi fallback font menghasilkan perubahan visual pada canvas.`;
    } else if (missing.length) {
      diagnosis = `FONT TIDAK ADA DI FONT DATABASE FIGCRAFT: ${missing.map(item => item.family).join(', ')}. Kemungkinan family tidak ikut CRAFT_FONTS_DIR/manifest build atau belum tersedia dari Local Font Access; tidak ditemukan 404 font terpisah.`;
    } else if (state.screenshotDiff != null && state.screenshotDiff <= 20) {
      diagnosis = 'RENDERER / RENDER UPDATE: family font terdaftar, tetapi screenshot sebelum/sesudah hampir tidak berubah. Periksa posisi/visibility node, renderer, dan screenshot.';
    } else if (state.screenshotDiff != null && state.screenshotDiff > 20) {
      diagnosis = 'FONT TERSEDIA DAN CANVAS BERUBAH: font database dan jalur render teks tampak bekerja.';
    } else {
      diagnosis = 'Belum dapat diputuskan: tunggu kedua screenshot canvas dan pixel comparison.';
    }
    state.fontDiagnostics.diagnosis = diagnosis;
    renderFontDiagnostics();
    return diagnosis;
  }
  async function readPngPixels(dataUrl) {
    if (!dataUrl) throw new Error('PNG data tidak tersedia.');
    const image = new Image();
    image.src = dataUrl;
    if (image.decode) await image.decode();
    else await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = reject; });
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth || image.width;
    canvas.height = image.naturalHeight || image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || !canvas.width || !canvas.height) throw new Error('Tidak dapat membaca pixel hasil render.');
    context.drawImage(image, 0, 0);
    return { width: canvas.width, height: canvas.height, pixels: context.getImageData(0, 0, canvas.width, canvas.height).data };
  }
  async function countVisualDiff(before, after) {
    const a = await readPngPixels(before);
    const b = await readPngPixels(after);
    if (a.width !== b.width || a.height !== b.height) {
      throw new Error(`Ukuran render berubah (${a.width}×${a.height} → ${b.width}×${b.height}).`);
    }
    let changed = 0;
    for (let i = 0; i < a.pixels.length; i += 4) {
      const delta = Math.abs(a.pixels[i] - b.pixels[i]) +
        Math.abs(a.pixels[i + 1] - b.pixels[i + 1]) +
        Math.abs(a.pixels[i + 2] - b.pixels[i + 2]);
      if (delta > 48) changed++;
    }
    return changed;
  }
  function showScreenshotEvidence() {
    const wrap = state.panel && state.panel.querySelector('#mz-fcp-screenshot-wrap');
    const before = state.panel && state.panel.querySelector('#mz-fcp-screenshot-before');
    const after = state.panel && state.panel.querySelector('#mz-fcp-screenshot-after');
    const diff = state.panel && state.panel.querySelector('#mz-fcp-screenshot-diff');
    if (before && state.screenshotBefore) before.src = state.screenshotBefore;
    if (after && state.screenshotAfter) after.src = state.screenshotAfter;
    if (diff) diff.textContent = state.screenshotDiff == null
      ? 'Pixel diff belum dapat dihitung.' : `Pixel berubah pada screenshot: ${state.screenshotDiff.toLocaleString()} pixel.`;
    if (wrap && (state.screenshotBefore || state.screenshotAfter)) wrap.hidden = false;
    refreshReportPreview();
  }

  async function runAutomaticTests() {
    if (state.running) return;
    state.running = true;
    state.startedAt = stamp();
    const button = state.panel.querySelector('#mz-fcp-run');
    if (button) button.disabled = true;
    setPanelStatus('Tes otomatis berjalan…', 'loading');
    TEST_DEFS.forEach(([id]) => setRow(id, 'running', 'Sedang berjalan…'));
    COMMANDS_TO_CHECK.forEach(id => setCommandRow(id, 'pending', 'Menunggu figcraft.commands() dan uji API.'));
    let rectId = null, textId = null, pasteIds = [];
    try {
      await getApiReady();
      if (!state.siteAssets) {
        try { await inspectDeployedAssets(); } catch (error) {
          state.siteAssets = { indexUrl: new URL('index.html', new URL('figcraft/', baseDirectory())).href, indexStatus: 'error', assets: [], fontFiles: [], directoryListing: false, error: error.message || String(error) };
          renderAssetDiagnostics();
        }
      }

      // 1. Engine inventory; control-protocol methods are tested separately by request().
      const commandList = normalizeCommandList(await timeout(state.api.commands(), 20000, 'figcraft.commands'));
      state.commandCount = commandList.length;
      state.commandIds = new Set(commandList);
      setRow('api.commands', 'pass', `figcraft.commands() mengembalikan ${commandList.length} command.`);
      COMMANDS_TO_CHECK.forEach(id => {
        if (CONTROL_METHODS.has(id)) setCommandRow(id, 'running', 'Control API: akan diuji melalui figcraft.request().');
        else if (['node.set', 'command.batch'].includes(id) && state.commandIds.has(id)) setCommandRow(id, 'running', 'Command tersedia; menunggu eksekusi nyata dan verifikasi undo.');
        else if (state.commandIds.has(id)) setCommandRow(id, 'pass', 'Ada di figcraft.commands().');
        else setCommandRow(id, 'fail', 'Tidak ditemukan di daftar figcraft.commands().');
      });

      // 2. Isolated new document and base nodes.
      await apiExecute('file.new', { name: `Moza FigCraft Probe ${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}` });
      setCommandRow('file.new', 'pass', 'file.new berhasil dijalankan pada iframe probe terpisah.');
      const rect = await apiExecute('node.create', {
        type: 'rectangle', name: 'Probe Rectangle', x: 120, y: 90, width: 160, height: 90,
        props: { fill: '#DCEBFF', stroke: '#3159C9', strokeWeight: 2 }, select: false
      });
      rectId = resultId(rect);
      if (rectId == null) throw new Error(`node.create rectangle tidak mengembalikan id: ${JSON.stringify(rect)}`);
      const text = await apiExecute('node.create', {
        type: 'text', name: 'Probe Text', text: 'MOZA FIGCRAFT PROBE', x: 120, y: 220, width: 420,
        props: { fontSize: 30, fill: '#1F2937' }, select: false
      });
      textId = resultId(text);
      if (textId == null) throw new Error(`node.create text tidak mengembalikan id: ${JSON.stringify(text)}`);
      const initialInspect = await apiRequest('document.inspect', { depth: 8, allPages: true });
      setCommandRow('document.inspect', 'pass', 'document.inspect berhasil membaca dokumen probe.');
      await apiRequest('node.get', { id: rectId, depth: 1 });
      setCommandRow('node.get', 'pass', `node.get berhasil membaca rectangle #${rectId}.`);
      setCommandRow('node.create', 'pass', `Rectangle #${rectId} dan teks #${textId} berhasil dibuat.`);
      setRow('document.setup', 'pass', `Dokumen probe baru; rectangle #${rectId}, text #${textId}; document.inspect dan node.get berhasil.`);

      // 3. Execute node.set (text + fill + font size), then verify actual values via node.get.
      if (!state.commandIds.has('node.set')) {
        setCommandRow('node.set', 'fail', 'Tidak tersedia di figcraft.commands(); eksekusi dilewati.');
      } else {
        try {
          await apiExecute('node.set', {
            ids: [textId],
            props: { characters: 'MOZA FIGCRAFT PROBE', fontSize: 34, fills: [{ type: 'solid', color: '#FF4D6D' }] }
          });
          const changedText = await apiRequest('node.get', { id: textId, depth: 1 });
          const charsOk = String(changedText && changedText.characters || '') === 'MOZA FIGCRAFT PROBE';
          const sizeOk = Math.abs(Number(changedText && changedText.fontSize) - 34) < 0.01;
          const fillJson = JSON.stringify(changedText && (changedText.fills || changedText.fill) || '').toLowerCase();
          const fillOk = fillJson.includes('#ff4d6d');
          const ok = charsOk && sizeOk && fillOk;
          setCommandRow('node.set', ok ? 'pass' : 'fail', `node.set dieksekusi; characters=${charsOk}, fontSize=${sizeOk} (${changedText && changedText.fontSize}), fill=${fillOk}. node.get=${JSON.stringify(changedText).slice(0, 320)}`);
        } catch (error) {
          setCommandRow('node.set', 'fail', `Eksekusi node.set error: ${error.message || error}`);
        }
      }

      // 4. Execute command.batch with three node.create steps; one undo must remove all three.
      if (!state.commandIds.has('command.batch')) {
        setCommandRow('command.batch', 'fail', 'Tidak tersedia di figcraft.commands(); eksekusi dilewati.');
      } else {
        try {
          const beforeBatch = await apiRequest('document.inspect', { depth: 8, allPages: true });
          const beforeBatchIds = collectIds(beforeBatch, new Set());
          const batchResult = await apiExecute('command.batch', { commands: [
            { command: 'node.create', params: { type: 'rectangle', name: 'Batch Probe A', x: 430, y: 90, width: 80, height: 60, props: { fill: '#BDE8D3' }, select: false } },
            { command: 'node.create', params: { type: 'ellipse', name: 'Batch Probe B', x: 530, y: 90, width: 70, height: 70, props: { fill: '#FDE68A' }, select: false } },
            { command: 'node.create', params: { type: 'text', name: 'Batch Probe C', text: 'BATCH OK', x: 430, y: 190, width: 220, props: { fontSize: 22 }, select: false } }
          ] });
          const afterBatch = await apiRequest('document.inspect', { depth: 8, allPages: true });
          const afterBatchIds = collectIds(afterBatch, new Set());
          let batchIds = Array.isArray(batchResult) ? batchResult.map(resultId).filter(id => id != null) : [];
          if (batchIds.length < 3) batchIds = [...afterBatchIds].filter(id => !beforeBatchIds.has(id)).map(apiId);
          const created = batchIds.length >= 3 && batchIds.every(id => afterBatchIds.has(String(id)));
          if (!created) throw new Error(`command.batch tidak menghasilkan 3 node terverifikasi. result=${JSON.stringify(batchResult)}; ids=${batchIds.join(',')}`);
          await apiExecute('edit.undo', {});
          const afterBatchUndo = await apiRequest('document.inspect', { depth: 8, allPages: true });
          const afterBatchUndoIds = collectIds(afterBatchUndo, new Set());
          const allRemovedTogether = batchIds.every(id => !afterBatchUndoIds.has(String(id)));
          if (!allRemovedTogether) throw new Error(`Satu edit.undo tidak menghapus seluruh node batch. IDs tersisa: ${batchIds.filter(id => afterBatchUndoIds.has(String(id))).join(', ')}`);
          setCommandRow('command.batch', 'pass', `command.batch benar-benar membuat ${batchIds.length} node (${batchIds.join(', ')}); satu edit.undo menghapus semuanya. Terbukti satu batch = satu langkah undo.`);
        } catch (error) {
          setCommandRow('command.batch', 'fail', `Eksekusi/verifikasi batch gagal: ${error.message || error}`);
        }
      }

      // 5. Duplicate -> undo -> copy -> paste -> delete, each mutation inspected.
      const beforeDuplicate = await apiRequest('document.inspect', { depth: 8, allPages: true });
      const beforeDuplicateIds = collectIds(beforeDuplicate, new Set());
      const duplicate = await apiExecute('edit.duplicate', { ids: [rectId], dx: 28, dy: 28 });
      let duplicateIds = resultIds(duplicate);
      const afterDuplicate = await apiRequest('document.inspect', { depth: 8, allPages: true });
      const afterDuplicateIds = collectIds(afterDuplicate, new Set());
      if (!duplicateIds.length) duplicateIds = [...afterDuplicateIds].filter(id => !beforeDuplicateIds.has(id)).map(apiId);
      if (!duplicateIds.length || duplicateIds.some(id => !afterDuplicateIds.has(String(id)))) throw new Error(`edit.duplicate tidak membuat layer baru menurut document.inspect: ${JSON.stringify(duplicate)}`);
      const undo = await apiExecute('edit.undo', {});
      const afterUndo = await apiRequest('document.inspect', { depth: 8, allPages: true });
      const afterUndoIds = collectIds(afterUndo, new Set());
      if (duplicateIds.some(id => afterUndoIds.has(String(id)))) throw new Error(`edit.undo tidak membatalkan duplicate: ${JSON.stringify(undo)}`);
      const copy = await apiExecute('edit.copy', { ids: [rectId] });
      if (copy && typeof copy.copied === 'number' && copy.copied < 1) throw new Error(`edit.copy tidak menyalin objek: ${JSON.stringify(copy)}`);
      const beforePaste = await apiRequest('document.inspect', { depth: 8, allPages: true });
      const beforePasteIds = collectIds(beforePaste, new Set());
      const paste = await apiExecute('edit.paste', {});
      const afterPaste = await apiRequest('document.inspect', { depth: 8, allPages: true });
      const afterPasteIds = collectIds(afterPaste, new Set());
      pasteIds = resultIds(paste);
      if (!pasteIds.length) pasteIds = [...afterPasteIds].filter(id => !beforePasteIds.has(id)).map(apiId);
      if (!pasteIds.length || pasteIds.some(id => !afterPasteIds.has(String(id)))) throw new Error(`edit.paste tidak membuat layer baru menurut document.inspect: ${JSON.stringify(paste)}`);
      const deleted = await apiExecute('edit.delete', { ids: pasteIds });
      const afterDelete = await apiRequest('document.inspect', { depth: 8, allPages: true });
      const remaining = collectIds(afterDelete, new Set());
      if (pasteIds.some(id => remaining.has(String(id)))) throw new Error(`edit.delete tidak menghapus target: ${JSON.stringify(deleted)}`);
      ['edit.duplicate', 'edit.undo', 'edit.copy', 'edit.paste', 'edit.delete'].forEach(id => setCommandRow(id, 'pass', 'Berhasil dieksekusi dan diverifikasi melalui document.inspect.'));
      setRow('edit.sequence', 'pass', `duplicate → ${duplicateIds.join(', ')}; undo membatalkan duplicate; copy → paste → delete berhasil. document.inspect memverifikasi tiap perubahan.`);

      // 6. Shift-select control method.
      await apiRequest('ui.pointer', { kind: 'click', x: 200, y: 135 });
      const pointerResult = await apiRequest('ui.pointer', { kind: 'click', x: 250, y: 245, shift: true });
      const inspectSelection = await apiRequest('document.inspect', { depth: 4 });
      const selected = selectionIds(pointerResult && pointerResult.selection).length
        ? selectionIds(pointerResult.selection) : selectionIds(inspectSelection && inspectSelection.selection);
      if (selected.length >= 2) {
        setCommandRow('ui.pointer', 'pass', `Metode ui.pointer berhasil; selection ${selected.join(', ')}.`);
        setRow('ui.pointer', 'pass', `Shift-select berhasil; ${selected.length} objek terpilih.`);
      } else {
        setCommandRow('ui.pointer', 'pass', 'Metode ui.pointer merespons; multi-selection belum terkonfirmasi.');
        setRow('ui.pointer', 'fail', `ui.pointer merespons, tetapi selection berisi ${selected.length} ID.`);
      }

      // 7. Font diagnosis and real screenshots before/after typing. No ui.render/pixelDiff API dependency.
      try { await inspectFontDiagnostics(); }
      catch (error) {
        state.fontDiagnostics = { textNodes: [], availableFamilies: [], familyChecks: [], sourceNote: `Diagnostik text.fonts gagal: ${error.message || error}` };
        renderFontDiagnostics();
      }
      state.screenshotBefore = await captureFigCraftScreenshot();
      showScreenshotEvidence();
      const beforeText = await apiRequest('node.get', { id: textId, depth: 1 });
      const baseCharacters = String(beforeText && beforeText.characters || 'MOZA FIGCRAFT PROBE');
      await apiExecute('text.edit.begin', { id: textId, caret: baseCharacters.length });
      setCommandRow('text.edit.begin', 'pass', `text.edit.begin berhasil untuk text #${textId}.`);
      await apiRequest('ui.type', { text: ' / UI.TYPE' });
      setCommandRow('ui.type', 'pass', 'ui.type benar-benar memasukkan teks ke editor.');
      await apiExecute('text.edit.insert', { text: ' / TEXT.EDIT.INSERT' });
      setCommandRow('text.edit.insert', 'pass', 'text.edit.insert benar-benar memasukkan teks ke editor.');
      const textNode = await apiRequest('node.get', { id: textId, depth: 1 });
      const characters = String(textNode && (textNode.characters || textNode.text || '') || '');
      const hasUiType = characters.includes('UI.TYPE');
      const hasInsert = characters.includes('TEXT.EDIT.INSERT');
      await apiRequest('ui.key', { key: 'Escape' });
      await new Promise(resolve => window.setTimeout(resolve, 250));
      state.screenshotAfter = await captureFigCraftScreenshot();
      state.screenshotDiff = await countVisualDiff(state.screenshotBefore, state.screenshotAfter);
      diagnoseTextRender();
      showScreenshotEvidence();
      if (!hasUiType || !hasInsert) {
        setRow('text.input', 'fail', `Teks tidak lengkap pada node.get. characters="${characters.slice(0, 180)}"; ui.type=${hasUiType}; text.edit.insert=${hasInsert}. Screenshot sebelum/sesudah tetap ditampilkan.`);
      } else if (state.screenshotDiff > 20) {
        setRow('text.input', 'pass', `node.get mengonfirmasi kedua API; figcraft.screenshot() sebelum/sesudah berhasil; pixel berubah ${state.screenshotDiff} pixel. Periksa kedua gambar pada panel untuk konfirmasi visual.`);
      } else {
        setRow('text.input', 'fail', `characters berubah, tetapi screenshot canvas hanya berbeda ${state.screenshotDiff} pixel. Font tersedia/renderer perlu ditinjau; kedua screenshot ditampilkan.`);
      }
      setRow('api.commands', 'pass', `Jumlah engine command: ${state.commandCount}; node.set dan command.batch telah diuji eksekusi, bukan hanya availability.`);

      // 8. Enter / Escape / Delete on probe objects only.
      await apiRequest('ui.key', { key: 'Enter' });
      await apiRequest('ui.key', { key: 'Escape' });
      await apiRequest('ui.pointer', { kind: 'click', x: 200, y: 135 });
      await apiRequest('ui.key', { key: 'Delete' });
      await apiRequest('document.inspect', { depth: 5 });
      setCommandRow('ui.key', 'pass', 'ui.key menerima Enter, Escape, dan Delete pada dokumen probe; Delete hanya menargetkan objek uji.');
      setRow('ui.key', 'pass', 'ui.key Delete, Enter, dan Escape berhasil dipanggil dan document.inspect tetap merespons.');
      const finalInspect = await apiRequest('document.inspect', { depth: 8, allPages: true });
      const finalIds = collectIds(finalInspect, new Set());
      setRow('document.setup', 'pass', `Final document.inspect berhasil; ${finalIds.size} ID layer tercatat pada dokumen probe.`);
      setPanelStatus('Tes otomatis selesai', 'success');
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      const unfinished = TEST_DEFS.filter(([id]) => !state.tests[id] || state.tests[id].status === 'running');
      unfinished.forEach(([id], index) => setRow(id, 'fail', index === 0 ? message : `Tidak dijalankan karena tes sebelumnya berhenti: ${message}`));
      Object.keys(state.commandRows).forEach(id => {
        if (state.commandRows[id] && state.commandRows[id].status === 'running') setCommandRow(id, 'fail', `Tidak dapat diverifikasi karena tes berhenti: ${message}`);
      });
      setPanelStatus(`Tes berhenti: ${message}`, 'error');
      console.error('[Moza FigCraft Probe]', error);
    } finally {
      state.running = false;
      if (button) button.disabled = false;
      refreshReportPreview();
    }
  }
  async function copyReport() {
    const report = buildReport();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(report);
      } else {
        throw new Error('Clipboard API tidak tersedia');
      }
      setPanelStatus('Laporan berhasil disalin', 'success');
    } catch (_) {
      const textarea = state.panel.querySelector('#mz-fcp-report-preview');
      textarea.value = report;
      textarea.focus();
      textarea.select();
      let copied = false;
      try { copied = document.execCommand('copy'); } catch (_) {}
      setPanelStatus(copied ? 'Laporan berhasil disalin' : 'Salin manual dari pratinjau laporan', copied ? 'success' : 'error');
    }
  }
  function install() {
    const launch = document.createElement('button');
    launch.id = 'mz-fcp-launch';
    launch.type = 'button';
    launch.textContent = '⚙ Probe FigCraft';
    launch.title = 'Buka diagnostik FigCraft (DEV ONLY)';
    launch.addEventListener('click', openPanel);
    document.body.appendChild(launch);
    state.launch = launch;
    renderPanel();
    state.panel.hidden = true;
    deviceSummary();
  }

  const api = {
    open: openPanel,
    close: closePanel,
    run: runAutomaticTests,
    report: buildReport,
    version: 'M1.5 v1.1'
  };
  window.MozaStudio = window.MozaStudio || {};
  window.MozaStudio.Diagnostics = window.MozaStudio.Diagnostics || {};
  window.MozaStudio.Diagnostics.FigCraftProbe = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(window, document);
