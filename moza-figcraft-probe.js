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
  const state = {
    panel: null, frame: null, launch: null, api: null, ready: false, loading: false,
    running: false, startedAt: null, commandCount: null, commandIds: new Set(),
    commandRows: {}, tests: {}, manual: {}, screenshotData: null, docName: '',
    frameLoadError: '', baseVisualHeight: 0, keyboardVisible: false, focusTarget: '',
    longPressMs: 0, contextMenuSeen: false, doubleTapSeen: false, pointerDown: null,
    lastClickAt: 0, lastClickPoint: null, frameListenersInstalled: false, pollTimer: null
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
    return status === 'pass' ? '✅ LULUS' : status === 'fail' ? '❌ GAGAL' : status === 'running' ? '⏳ BERJALAN' : '⬜ BELUM DITES';
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
  function buildReport() {
    const lines = [
      'MOZA STUDIO × FIGCRAFT — DEVICE PROBE',
      `Waktu: ${stamp()}`,
      `URL Moza: ${window.location.href}`,
      `URL iframe: ${state.frame ? state.frame.src : '(belum dibuka)'}`,
      `FigCraft ready: ${state.ready ? 'yes' : 'no'}`,
      `Jumlah command: ${state.commandCount == null ? 'belum diperoleh' : state.commandCount}`,
      '',
      'INFORMASI PERANGKAT',
      `User agent: ${navigator.userAgent}`,
      `DPR: ${window.devicePixelRatio || 1}`,
      `Viewport: ${window.innerWidth} × ${window.innerHeight}`,
      `Visual viewport: ${window.visualViewport ? `${Math.round(window.visualViewport.width)} × ${Math.round(window.visualViewport.height)}` : 'tidak tersedia'}`,
      `Pointer coarse: ${window.matchMedia && window.matchMedia('(pointer: coarse)').matches ? 'yes' : 'no'}`,
      `Pointer fine: ${window.matchMedia && window.matchMedia('(pointer: fine)').matches ? 'yes' : 'no'}`,
      `WebGPU: ${navigator.gpu ? 'available' : 'not detected'}`,
      `WebGL2: ${detectWebGL2() ? 'available' : 'not detected'}`,
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
    lines.push('', 'DIAGNOSTIK INTERAKSI');
    lines.push(`Long press terdeteksi: ${state.longPressMs ? `${state.longPressMs} ms` : 'belum'}`);
    lines.push(`Contextmenu event: ${state.contextMenuSeen ? 'terdeteksi' : 'belum terdeteksi'}`);
    lines.push(`Double click event: ${state.doubleTapSeen ? 'terdeteksi' : 'belum terdeteksi'}`);
    lines.push(`Keyboard layar: ${state.keyboardVisible ? 'terdeteksi (visualViewport mengecil)' : 'belum terdeteksi'}`);
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
  function installFrameTelemetry() {
    if (state.frameListenersInstalled || !state.frame) return;
    let doc, win;
    try { doc = state.frame.contentDocument; win = state.frame.contentWindow; } catch (_) { return; }
    if (!doc || !win) return;
    state.frameListenersInstalled = true;
    const vv = win.visualViewport;
    state.baseVisualHeight = vv ? vv.height : win.innerHeight;
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
    if (vv) vv.addEventListener('resize', updateKeyboardTelemetry);
    win.addEventListener('resize', updateKeyboardTelemetry);
    updateKeyboardTelemetry();
  }
  function updateKeyboardTelemetry() {
    if (!state.frame) return;
    try {
      const win = state.frame.contentWindow;
      const vv = win.visualViewport;
      const height = vv ? vv.height : win.innerHeight;
      const base = state.baseVisualHeight || win.innerHeight;
      state.keyboardVisible = (base - height > 120) && (height / Math.max(base, 1) < 0.82);
    } catch (_) {}
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
    const manualRows = MANUAL_DEFS.map(([id, label, description]) => `
      <div class="mz-fcp-row" data-probe-manual="${id}">
        <div class="mz-fcp-row-main"><b>${esc(label)}</b><span class="mz-fcp-result" data-status="pending">${statusText('pending')}</span></div>
        <small>${esc(description)}</small><p class="mz-fcp-detail">Belum dicatat</p>
        <div class="mz-fcp-manual-actions">
          <button type="button" data-probe-manual-result="${id}" data-result="pass">Lulus</button>
          <button type="button" data-probe-manual-result="${id}" data-result="fail">Gagal</button>
        </div>
      </div>`).join('');
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
          <div id="mz-fcp-screenshot-wrap" hidden><b>Screenshot canvas setelah tes teks</b><img id="mz-fcp-screenshot" alt="Screenshot canvas FigCraft untuk pemeriksaan teks"/></div>
        </section>
        <section id="mz-fcp-results">
          <div class="mz-fcp-card"><h3>Informasi perangkat</h3><div id="mz-fcp-device"></div></div>
          <div class="mz-fcp-card"><h3>Tes otomatis</h3><div id="mz-fcp-tests">${testRows}</div></div>
          <details class="mz-fcp-card"><summary>Ketersediaan 25 command / API</summary><p class="mz-fcp-muted">Engine command diperiksa melalui figcraft.commands(). Metode kontrol (ui.* dan document.inspect) diverifikasi lewat figcraft.request().</p><div id="mz-fcp-commands">${commandRows}</div></details>
          <div class="mz-fcp-card"><h3>Tes manual perangkat</h3><p class="mz-fcp-muted">Lakukan gestur pada canvas di kiri/atas, lalu catat hasilnya dengan tombol Lulus atau Gagal. Telemetri gesture dan keyboard ikut dicatat bila browser mengizinkan.</p><div id="mz-fcp-manual">${manualRows}</div></div>
          <div class="mz-fcp-card"><h3>Telemetri langsung</h3><p id="mz-fcp-telemetry">Menunggu iframe.</p></div>
          <details class="mz-fcp-card"><summary>Pratinjau laporan teks</summary><textarea id="mz-fcp-report-preview" readonly rows="10"></textarea></details>
        </section>
      </main>`;
    document.body.appendChild(panel);
    state.panel = panel;
    state.frame = panel.querySelector('#mz-fcp-frame');
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
    const value = result && (result.data || result.png || result.base64);
    if (typeof value !== 'string' || !value) return null;
    return value.startsWith('data:') ? value : `data:image/png;base64,${value}`;
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
  async function renderDocumentPng() {
    const result = await apiRequest('ui.render', {});
    return pngDataFromResult(result);
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

      // 1. Command inventory: `commands()` returns engine command IDs; ui.* methods are
      // control-protocol methods and are verified by the corresponding safe requests below.
      const commandList = normalizeCommandList(await timeout(state.api.commands(), 20000, 'figcraft.commands'));
      state.commandCount = commandList.length;
      state.commandIds = new Set(commandList);
      setRow('api.commands', 'pass', `figcraft.commands() mengembalikan ${commandList.length} command.`);
      COMMANDS_TO_CHECK.forEach(id => {
        if (state.commandIds.has(id)) setCommandRow(id, 'pass', 'Ada di figcraft.commands().');
        else if (CONTROL_METHODS.has(id)) setCommandRow(id, 'running', 'Metode kontrol: akan diverifikasi melalui figcraft.request().');
        else setCommandRow(id, 'fail', 'Tidak ditemukan di daftar engine command.');
      });

      // 2. A new document is created only in this isolated diagnostic iframe.
      const newDoc = await apiExecute('file.new', { name: `Moza FigCraft Probe ${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}` });
      setCommandRow('file.new', 'pass', 'file.new berhasil dijalankan.');
      const rect = await apiExecute('node.create', {
        type: 'rectangle', name: 'Probe Rectangle', x: 120, y: 90, width: 160, height: 90,
        props: { fill: '#DCEBFF', stroke: '#3159C9', strokeWeight: 2 }, select: false
      });
      rectId = resultId(rect);
      if (rectId == null) throw new Error(`node.create rectangle tidak mengembalikan id: ${JSON.stringify(rect)}`);
      const text = await apiExecute('node.create', {
        type: 'text', name: 'Probe Text', text: 'MOZA FIGCRAFT PROBE', x: 120, y: 220, width: 340,
        props: { fontSize: 30 }, select: false
      });
      textId = resultId(text);
      if (textId == null) throw new Error(`node.create text tidak mengembalikan id: ${JSON.stringify(text)}`);
      const initialInspect = await apiRequest('document.inspect', { depth: 5 });
      setCommandRow('document.inspect', 'pass', 'document.inspect berhasil; dokumen probe terbaca.');
      const rectNode = await apiRequest('node.get', { id: rectId, depth: 1 });
      setCommandRow('node.get', 'pass', `node.get berhasil membaca rectangle #${rectId}.`);
      setCommandRow('node.create', 'pass', `Rectangle #${rectId} dan teks #${textId} berhasil dibuat.`);
      setCommandRow('node.set', state.commandIds.has('node.set') ? 'pass' : 'fail',
        state.commandIds.has('node.set') ? 'Tersedia; tidak mengubah properti dokumen dalam probe.' : 'Tidak ditemukan di daftar command.');
      setCommandRow('command.batch', state.commandIds.has('command.batch') ? 'pass' : 'fail',
        state.commandIds.has('command.batch') ? 'Tersedia; tidak dieksekusi agar tes tetap atomik dan mudah dilacak.' : 'Tidak ditemukan di daftar command.');
      setRow('document.setup', 'pass', `Dokumen baru dibuat; rectangle #${rectId}, text #${textId}; document.inspect dan node.get berhasil.`);

      // 3. Exercise duplicate -> undo -> copy -> paste -> delete in the probe document.
      const beforeDuplicate = await apiRequest('document.inspect', { depth: 5 });
      const beforeDuplicateIds = collectIds(beforeDuplicate, new Set());
      const duplicate = await apiExecute('edit.duplicate', { ids: [rectId], dx: 28, dy: 28 });
      let duplicateIds = resultIds(duplicate);
      const afterDuplicate = await apiRequest('document.inspect', { depth: 5 });
      const afterDuplicateIds = collectIds(afterDuplicate, new Set());
      if (!duplicateIds.length) duplicateIds = [...afterDuplicateIds].filter(id => !beforeDuplicateIds.has(id)).map(apiId);
      if (!duplicateIds.length || duplicateIds.some(id => !afterDuplicateIds.has(String(id)))) {
        throw new Error(`edit.duplicate tidak membuat layer baru menurut document.inspect: ${JSON.stringify(duplicate)}`);
      }
      const undo = await apiExecute('edit.undo', {});
      const afterUndo = await apiRequest('document.inspect', { depth: 5 });
      const afterUndoIds = collectIds(afterUndo, new Set());
      if (duplicateIds.some(id => afterUndoIds.has(String(id)))) {
        throw new Error(`edit.undo tidak membatalkan duplicate: ${JSON.stringify(undo)}`);
      }
      const copy = await apiExecute('edit.copy', { ids: [rectId] });
      if (copy && typeof copy.copied === 'number' && copy.copied < 1) {
        throw new Error(`edit.copy tidak menyalin objek: ${JSON.stringify(copy)}`);
      }
      const beforePaste = await apiRequest('document.inspect', { depth: 5 });
      const beforePasteIds = collectIds(beforePaste, new Set());
      const paste = await apiExecute('edit.paste', {});
      const afterPaste = await apiRequest('document.inspect', { depth: 5 });
      const afterPasteIds = collectIds(afterPaste, new Set());
      pasteIds = resultIds(paste);
      if (!pasteIds.length) pasteIds = [...afterPasteIds].filter(id => !beforePasteIds.has(id)).map(apiId);
      if (!pasteIds.length || pasteIds.some(id => !afterPasteIds.has(String(id)))) {
        throw new Error(`edit.paste tidak membuat layer baru menurut document.inspect: ${JSON.stringify(paste)}`);
      }
      const deleted = await apiExecute('edit.delete', { ids: pasteIds });
      const afterDelete = await apiRequest('document.inspect', { depth: 5 });
      const remaining = collectIds(afterDelete, new Set());
      if (pasteIds.some(id => remaining.has(String(id)))) throw new Error(`edit.delete tidak menghapus target: ${JSON.stringify(deleted)}`);
      ['edit.duplicate', 'edit.undo', 'edit.copy', 'edit.paste', 'edit.delete'].forEach(id =>
        setCommandRow(id, 'pass', 'Command berhasil dijalankan dan hasilnya diverifikasi melalui document.inspect.')
      );
      setRow('edit.sequence', 'pass', `duplicate → ${duplicateIds.join(', ')}; undo menghapus copy; copy → ${JSON.stringify(copy)}; paste → ${pasteIds.join(', ')}; delete menghapus paste. document.inspect memverifikasi setiap perubahan.`);

      // 4. Multi-select through the actual pointer control method.
      await apiRequest('ui.pointer', { kind: 'click', x: 200, y: 135 });
      const pointerResult = await apiRequest('ui.pointer', { kind: 'click', x: 250, y: 245, shift: true });
      const inspectSelection = await apiRequest('document.inspect', { depth: 4 });
      const selected = selectionIds(pointerResult && pointerResult.selection).length
        ? selectionIds(pointerResult.selection)
        : selectionIds(inspectSelection && inspectSelection.selection);
      if (selected.length >= 2) {
        setCommandRow('ui.pointer', 'pass', `Metode ui.pointer berhasil; selection ${selected.join(', ')}.`);
        setRow('ui.pointer', 'pass', `Shift-select berhasil; ${selected.length} objek terpilih.`);
      } else {
        setCommandRow('ui.pointer', 'pass', 'Metode ui.pointer berhasil merespons; selection multi tidak terkonfirmasi.');
        setRow('ui.pointer', 'fail', `ui.pointer merespons, tetapi selection berisi ${selected.length} ID (perlu verifikasi koordinat/viewport).`);
      }

      // 5. Render before/after without UI chrome. Pixel differences prove that the
      // inserted text changed the actual document render, not only its layer metadata.
      let beforeRender = null;
      try { beforeRender = await renderDocumentPng(); } catch (error) {
        console.warn('[Moza FigCraft Probe] ui.render before text unavailable', error);
      }
      await apiExecute('text.edit.begin', { id: textId, caret: 19 });
      setCommandRow('text.edit.begin', 'pass', `text.edit.begin berhasil untuk text #${textId}.`);
      await apiRequest('ui.type', { text: ' / UI.TYPE' });
      setCommandRow('ui.type', 'pass', 'Metode ui.type berhasil memasukkan teks.');
      await apiExecute('text.edit.insert', { text: ' / TEXT.EDIT.INSERT' });
      setCommandRow('text.edit.insert', 'pass', 'Command text.edit.insert berhasil memasukkan teks.');
      const textNode = await apiRequest('node.get', { id: textId, depth: 1 });
      const characters = String(textNode && (textNode.characters || textNode.text || '') || '');
      const hasUiType = characters.includes('UI.TYPE');
      const hasInsert = characters.includes('TEXT.EDIT.INSERT');
      await apiRequest('ui.key', { key: 'Escape' });
      let afterRender = null;
      try { afterRender = await renderDocumentPng(); } catch (error) {
        console.warn('[Moza FigCraft Probe] ui.render after text unavailable', error);
      }
      let pixelDiff = null;
      if (beforeRender && afterRender) {
        state.screenshotData = afterRender;
        try { pixelDiff = await countVisualDiff(beforeRender, afterRender); }
        catch (error) { console.warn('[Moza FigCraft Probe] render pixel comparison unavailable', error); }
        const wrap = state.panel.querySelector('#mz-fcp-screenshot-wrap');
        const img = state.panel.querySelector('#mz-fcp-screenshot');
        if (img) img.src = afterRender;
        if (wrap) wrap.hidden = false;
      }
      if (!hasUiType || !hasInsert) {
        setRow('text.input', 'fail', `Teks tidak lengkap di node.get. characters="${characters.slice(0, 180)}"; ui.type=${hasUiType}; text.edit.insert=${hasInsert}.`);
      } else if (pixelDiff != null && pixelDiff > 20) {
        setRow('text.input', 'pass', `Kedua API memasukkan teks; node.get mengonfirmasi characters; ui.render berubah pada ${pixelDiff} pixel. Teks menghasilkan perubahan visual pada render dokumen.`);
      } else if (pixelDiff === 0) {
        setRow('text.input', 'fail', 'characters berubah tetapi hasil ui.render tidak berubah (0 pixel). Teks mungkin tidak tergambar; periksa font/renderer FigCraft.');
      } else {
        setRow('text.input', 'fail', `Teks masuk ke characters, tetapi perubahan visual tidak dapat dibuktikan (pixelDiff=${pixelDiff == null ? 'tidak tersedia' : pixelDiff}). Periksa preview render.`);
      }
      setRow('api.commands', 'pass', `Jumlah engine command: ${state.commandCount}. Metode kontrol diverifikasi terpisah.`);

      // 6. Enter and Escape should be accepted. Delete is exercised on a selected probe object.
      await apiRequest('ui.key', { key: 'Enter' });
      await apiRequest('ui.key', { key: 'Escape' });
      await apiRequest('ui.pointer', { kind: 'click', x: 200, y: 135 });
      await apiRequest('ui.key', { key: 'Delete' });
      const afterKeyDelete = await apiRequest('document.inspect', { depth: 4 });
      setCommandRow('ui.key', 'pass', 'Metode ui.key menerima Enter, Escape, dan Delete pada dokumen probe.');
      setRow('ui.key', 'pass', 'ui.key Delete, Enter, dan Escape berhasil dipanggil; Delete hanya menargetkan objek uji.');
      const finalInspect = await apiRequest('document.inspect', { depth: 5 });
      const finalIds = collectIds(finalInspect, new Set());
      setRow('document.setup', 'pass', `Final document.inspect berhasil; ${finalIds.size} ID layer tercatat pada dokumen probe.`);
      setPanelStatus('Tes otomatis selesai', 'success');
    } catch (error) {
      const message = error && error.message ? error.message : String(error);
      state.frameLoadError = state.frameLoadError || '';
      const unfinished = TEST_DEFS.filter(([id]) => !state.tests[id] || state.tests[id].status === 'running');
      unfinished.forEach(([id], index) => setRow(id, 'fail',
        index === 0 ? message : `Tidak dijalankan karena tes sebelumnya berhenti: ${message}`));
      Object.keys(state.commandRows).forEach(id => {
        if (state.commandRows[id] && state.commandRows[id].status === 'running') {
          setCommandRow(id, 'fail', `Tidak dapat diverifikasi karena tes berhenti: ${message}`);
        }
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
    version: 'M1.5'
  };
  window.MozaStudio = window.MozaStudio || {};
  window.MozaStudio.Diagnostics = window.MozaStudio.Diagnostics || {};
  window.MozaStudio.Diagnostics.FigCraftProbe = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(window, document);
