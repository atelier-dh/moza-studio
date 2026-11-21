/* Moza Studio × FigCraft — Stage 2 integration shell.
 * Does not replace Moza state, renderer, element model, store, or clipboard.
 * FigCraft remains its own same-origin Rust/WASM app inside a lazy iframe.
 */
(function (window, document) {
  'use strict';

  const APP_ORIGIN = window.location.origin;
  const APP_PATH = 'figcraft/';
  const DOC_EXTENSIONS = new Set(['figcraft', 'json']);
  const MAX_NAME_LENGTH = 255;

  const state = {
    active: false,
    frameStarted: false,
    ready: false,
    dirty: false,
    saving: false,
    projectId: null,
    currentFileId: null,
    currentFileName: '',
    opener: null,
    shell: null,
    frame: null,
    loading: null,
    error: null,
    status: null,
    fontWarning: null,
    loadingTimer: null,
    saveSerial: Promise.resolve(),
    skipAutoOpen: false
  };

  function safeProjectId(value) {
    return String(value || 'default').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100) || 'default';
  }

  function keys(projectId) {
    const id = safeProjectId(projectId);
    return {
      index: `figcraft:index:${id}`,
      last: `figcraft:last:${id}`,
      file: fileId => `figcraft:file:${id}:${fileId}`
    };
  }

  function cleanName(value) {
    const name = String(value || 'Untitled.figcraft')
      .split(/[\\/]/).pop()
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .trim()
      .slice(0, MAX_NAME_LENGTH);
    return name || 'Untitled.figcraft';
  }

  function extensionOf(name) {
    const match = /\.([a-z0-9]+)$/i.exec(String(name || ''));
    return match ? match[1].toLowerCase() : '';
  }

  function isDocumentFile(name) {
    return DOC_EXTENSIONS.has(extensionOf(name));
  }

  function bytesView(value) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return null;
  }

  function bytesToBase64(value) {
    const bytes = bytesView(value);
    if (!bytes) throw new Error('FigCraft mengirim data file yang tidak valid.');
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length)));
    }
    return window.btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = window.atob(String(value || ''));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function readJson(value, fallback) {
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(value); } catch (_) { return fallback; }
  }

  async function readRecords(projectId) {
    const raw = await store.get(keys(projectId).index);
    const parsed = readJson(raw, []);
    return Array.isArray(parsed) ? parsed.filter(item => item && typeof item.id === 'string') : [];
  }

  function setStatus(text, kind) {
    if (!state.status) return;
    state.status.textContent = text || '';
    state.status.dataset.state = kind || 'normal';
  }

  function showLoading(show) {
    if (state.loading) state.loading.hidden = !show;
  }

  function showError(message) {
    if (!state.error) return;
    const target = state.error.querySelector('#mz-fc-error-message');
    if (target) target.textContent = String(message || 'FigCraft gagal dimuat.');
    state.error.hidden = false;
  }

  function hideError() {
    if (state.error) state.error.hidden = true;
  }

  function showFontWarning(message) {
    if (!state.fontWarning) return;
    state.fontWarning.textContent = String(message || 'Font FigCraft tidak dapat diverifikasi.');
    state.fontWarning.hidden = false;
  }

  function hideFontWarning() {
    if (state.fontWarning) state.fontWarning.hidden = true;
  }

  // FigCraft embeds its web fonts inside the WASM binary at build time; there are no
  // standalone .ttf/.woff requests. This diagnostic checks the generated build manifest
  // and the exact WASM asset URL so a stale/missing deployment is visible in Moza.
  async function diagnoseFontBundle() {
    const base = new URL(APP_PATH, document.baseURI);
    const manifestUrl = new URL('figcraft-fonts.json', base);
    try {
      const response = await fetch(manifestUrl.href, { cache: 'no-store', credentials: 'same-origin' });
      if (!response.ok) {
        showFontWarning(`Peringatan font FigCraft: manifest font tidak ditemukan (HTTP ${response.status}). Build yang ter-deploy mungkin belum menyertakan font ke dalam WebAssembly.`);
        return false;
      }
      const manifest = await response.json();
      const requiredFaces = [
        'Inter Regular',
        'Inter SemiBold',
        'Noto Sans Georgian Regular',
        'Noto Sans Arabic Regular'
      ];
      if (!manifest || manifest.schemaVersion !== 1 || manifest.embedded !== true ||
          manifest.fontPayload !== 'embedded-in-wasm' || !Array.isArray(manifest.requiredFaces) ||
          requiredFaces.some(face => !manifest.requiredFaces.includes(face))) {
        showFontWarning('Peringatan font FigCraft: manifest tidak valid atau font wajib belum tertanam. Jalankan ulang workflow build FigCraft.');
        return false;
      }
      const wasmAsset = String(manifest.wasmAsset || '');
      if (!/^[a-z0-9._-]+_bg\.wasm$/i.test(wasmAsset)) {
        showFontWarning('Peringatan font FigCraft: nama bundle WebAssembly pada manifest tidak valid.');
        return false;
      }
      const wasmUrl = new URL(wasmAsset, base);
      const wasmResponse = await fetch(wasmUrl.href, { method: 'HEAD', cache: 'no-store', credentials: 'same-origin' });
      if (!wasmResponse.ok) {
        showFontWarning(`Peringatan font FigCraft: bundle WebAssembly yang memuat font gagal diakses (HTTP ${wasmResponse.status}). Periksa folder /figcraft/ dan hasil deployment.`);
        return false;
      }
      const contentType = String(wasmResponse.headers.get('content-type') || '').toLowerCase();
      if (!contentType.includes('application/wasm')) {
        showFontWarning(`Peringatan font FigCraft: MIME bundle WASM tidak sesuai (${contentType || 'tidak diketahui'}); seharusnya application/wasm.`);
        return false;
      }
      hideFontWarning();
      return true;
    } catch (error) {
      showFontWarning(`Peringatan font FigCraft: pemeriksaan bundle gagal (${error && error.message ? error.message : error}).`);
      return false;
    }
  }

  function updateDirty(dirty) {
    state.dirty = !!dirty;
    if (state.dirty) {
      setStatus('Belum tersimpan', 'dirty');
    } else if (!state.saving) {
      setStatus(state.currentFileName ? `Tersimpan · ${state.currentFileName}` : 'Siap · desain baru', 'normal');
    }
  }

  function makeShell() {
    if (state.shell) return;
    const shell = document.createElement('section');
    shell.id = 'mz-fc-shell';
    shell.hidden = true;
    shell.setAttribute('aria-label', 'FigCraft Design Editor');
    shell.innerHTML = `
      <header id="mz-fc-header">
        <div id="mz-fc-brand"><strong>FigCraft Design Editor</strong><small>Terintegrasi dengan Moza Studio</small></div>
        <div id="mz-fc-status" role="status" aria-live="polite" data-state="normal">Belum dimuat</div>
        <div id="mz-fc-actions">
          <button type="button" data-mz-fc-action="retry" hidden>Reload editor</button>
          <button type="button" data-mz-fc-action="back" class="mz-fc-primary">← Kembali ke Moza</button>
        </div>
      </header>
      <div id="mz-fc-stage">
        <div id="mz-fc-font-warning" hidden role="alert" aria-live="polite"></div>
        <iframe id="mz-fc-frame" title="FigCraft Design Editor" allow="fullscreen; clipboard-read; clipboard-write" allowfullscreen loading="lazy" referrerpolicy="same-origin" tabindex="-1"></iframe>
        <div id="mz-fc-loading" role="status" aria-live="polite">
          <div id="mz-fc-spinner" aria-hidden="true"></div>
          <strong>Memuat FigCraft…</strong>
          <small>Engine WebAssembly sedang diunduh dan dijalankan. Pemuatan pertama dapat memerlukan waktu lebih lama.</small>
        </div>
        <div id="mz-fc-error" hidden role="alert">
          <div id="mz-fc-error-card">
            <strong>FigCraft tidak dapat dimulai</strong>
            <p id="mz-fc-error-message"></p>
            <button type="button" data-mz-fc-action="retry" class="mz-fc-primary">Coba lagi</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(shell);
    state.shell = shell;
    state.frame = shell.querySelector('#mz-fc-frame');
    state.loading = shell.querySelector('#mz-fc-loading');
    state.error = shell.querySelector('#mz-fc-error');
    state.status = shell.querySelector('#mz-fc-status');
    state.fontWarning = shell.querySelector('#mz-fc-font-warning');

    shell.addEventListener('click', event => {
      const button = event.target.closest('[data-mz-fc-action]');
      if (!button) return;
      event.preventDefault();
      const action = button.dataset.mzFcAction;
      if (action === 'back') closeEditor();
      else if (action === 'retry') retryEditor();
    });
    shell.addEventListener('pointerdown', event => event.stopPropagation(), true);
    shell.addEventListener('wheel', event => event.stopPropagation(), { capture: true, passive: true });
    state.frame.addEventListener('load', () => {
      // The document load is not the WASM-ready signal. Keep the host loader visible
      // until the official figcraft:ready message arrives.
      if (!state.ready && state.active) setStatus('Menyiapkan engine WebAssembly…', 'normal');
    });
  }

  function ensureTopButton() {
    const top = document.getElementById('top');
    if (!top || top.querySelector('[data-mz-fc-open]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn';
    button.dataset.mzFcOpen = 'true';
    button.title = 'Open FigCraft Design Editor';
    button.textContent = '✎ Design Editor';
    const preview = top.querySelector('[data-a="preview"]');
    if (preview) top.insertBefore(button, preview);
    else top.appendChild(button);
  }

  function ensureMobileMenuButton() {
    const menu = document.getElementById('tmenu');
    if (!menu || !menu.classList.contains('show') || menu.querySelector('[data-mz-fc-open]')) return;
    const divider = document.createElement('hr');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.mzFcOpen = 'true';
    button.innerHTML = '<span class="ck">✎</span>Design Editor · FigCraft';
    menu.append(divider, button);
  }

  function buildFrameUrl() {
    const url = new URL(APP_PATH, document.baseURI);
    url.searchParams.set('host', 'parent');
    // A changing session value forces a clean runtime when switching Moza projects.
    url.searchParams.set('session', `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    return url.href;
  }

  function sendToFigCraft(type, fields, transfer) {
    if (!state.frame || !state.frame.contentWindow || !state.ready) return false;
    if (!APP_ORIGIN || APP_ORIGIN === 'null') return false;
    const message = Object.assign({ type }, fields || {});
    try {
      if (transfer) state.frame.contentWindow.postMessage(message, APP_ORIGIN, transfer);
      else state.frame.contentWindow.postMessage(message, APP_ORIGIN);
      return true;
    } catch (error) {
      console.error('[Moza FigCraft] postMessage failed', error);
      return false;
    }
  }

  async function openLastSavedDesign() {
    if (state.skipAutoOpen) {
      state.skipAutoOpen = false;
      state.currentFileId = null;
      state.currentFileName = '';
      setStatus('Siap · desain baru', 'normal');
      return;
    }
    const projectId = state.projectId;
    const storageKeys = keys(projectId);
    const records = await readRecords(projectId);
    const lastId = await store.get(storageKeys.last);
    const record = records.find(item => item.id === lastId) || records.sort((a, b) => (b.updated || 0) - (a.updated || 0))[0];
    if (!record) {
      state.currentFileId = null;
      state.currentFileName = '';
      setStatus('Siap · desain baru', 'normal');
      return;
    }
    const fileKey = record.key || storageKeys.file(record.id);
    const encoded = await store.get(fileKey);
    if (typeof encoded !== 'string' || !encoded) {
      setStatus('File tersimpan tidak ditemukan', 'error');
      return;
    }
    const bytes = base64ToBytes(encoded);
    const name = cleanName(record.name);
    const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    state.currentFileId = record.id;
    state.currentFileName = name;
    if (!sendToFigCraft('figcraft:open', { name, bytes: buffer }, [buffer])) {
      throw new Error('Tidak dapat mengirim file tersimpan ke FigCraft.');
    }
    setStatus(`Membuka · ${name}`, 'normal');
  }

  function startFrame(projectId, skipAutoOpen) {
    state.projectId = safeProjectId(projectId);
    state.ready = false;
    state.frameStarted = true;
    state.dirty = false;
    state.saving = false;
    state.currentFileId = null;
    state.currentFileName = '';
    state.skipAutoOpen = !!skipAutoOpen;
    hideError();
    showLoading(true);
    setStatus('Mengunduh engine FigCraft…', 'normal');
    if (state.loadingTimer) window.clearTimeout(state.loadingTimer);
    state.loadingTimer = window.setTimeout(() => {
      if (!state.ready && state.active) {
        showLoading(false);
        showError('FigCraft belum mengirim sinyal siap. Periksa apakah folder /figcraft/ sudah ter-deploy dan file WebAssembly dapat dimuat.');
        const retry = state.shell && state.shell.querySelectorAll('[data-mz-fc-action="retry"]');
        retry && retry.forEach(button => { button.hidden = false; });
      }
    }, 180000);
    void diagnoseFontBundle();
    state.frame.src = buildFrameUrl();
  }

  async function openEditor() {
    makeShell();
    state.opener = document.activeElement;
    const currentProject = safeProjectId(typeof S !== 'undefined' ? S.pid : 'default');
    state.shell.hidden = false;
    state.shell.classList.add('mz-fc-active');
    state.active = true;
    state.frame.style.pointerEvents = 'auto';
    document.body.setAttribute('data-mz-fc-active', 'true');

    if (!APP_ORIGIN || APP_ORIGIN === 'null' || window.location.protocol === 'file:') {
      showLoading(false);
      showError('Moza dan FigCraft harus dibuka melalui alamat web yang sama (HTTPS atau localhost), bukan dengan membuka index.html langsung dari file lokal.');
      return;
    }

    if (!state.frameStarted) {
      startFrame(currentProject, false);
    } else if (state.projectId !== currentProject) {
      if (state.dirty) {
        const discard = window.confirm('Dokumen FigCraft dari proyek Moza sebelumnya belum tersimpan. Muat proyek baru dan buang perubahan yang belum tersimpan? Pilih Batal untuk tetap membuka dokumen sebelumnya.');
        if (!discard) {
          state.frame.focus();
          setStatus('Masih membuka dokumen proyek sebelumnya', 'dirty');
          return;
        }
      }
      startFrame(currentProject, false);
    }

    if (state.ready) {
      state.frame.focus();
      if (!state.currentFileId && !state.dirty) setStatus('Siap · desain baru', 'normal');
    } else {
      showLoading(true);
      state.frame.focus();
    }
  }

  function closeEditor() {
    if (!state.shell || !state.active) return;
    if (state.dirty) {
      const leave = window.confirm('Ada perubahan FigCraft yang belum tersimpan. Kembali ke Moza? Dokumen tetap berada di editor selama tab ini tidak dimuat ulang, tetapi sebaiknya simpan terlebih dahulu.');
      if (!leave) return;
    }
    state.active = false;
    state.shell.classList.remove('mz-fc-active');
    state.shell.hidden = true;
    state.frame.style.pointerEvents = 'none';
    state.frame.blur();
    document.body.removeAttribute('data-mz-fc-active');
    if (state.opener && typeof state.opener.focus === 'function' && state.opener.isConnected) state.opener.focus();
    else document.body.focus({ preventScroll: true });
  }

  function retryEditor() {
    const projectId = state.projectId || safeProjectId(typeof S !== 'undefined' ? S.pid : 'default');
    startFrame(projectId, false);
  }

  async function saveDesignFile(message) {
    const name = cleanName(message.name);
    const bytes = bytesView(message.bytes);
    if (!bytes) throw new Error('Data file dari FigCraft bukan ArrayBuffer/Uint8Array.');
    const projectId = state.projectId || safeProjectId(typeof S !== 'undefined' ? S.pid : 'default');
    const storageKeys = keys(projectId);
    const records = await readRecords(projectId);
    const saveAs = message.saveAs === true;
    let record = null;
    if (!saveAs && state.currentFileId) record = records.find(item => item.id === state.currentFileId) || null;
    if (!saveAs && !record) record = records.find(item => item.name === name) || null;
    const fileId = record ? record.id : `fc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
    const fileKey = storageKeys.file(fileId);
    const encoded = bytesToBase64(bytes);

    const fileSaved = await store.set(fileKey, encoded);
    if (!fileSaved) throw new Error('Penyimpanan file FigCraft gagal. Periksa kapasitas IndexedDB/KV dan koneksi penyimpanan.');

    const nextRecord = {
      id: fileId,
      name,
      key: fileKey,
      format: extensionOf(name),
      size: bytes.byteLength,
      updated: Date.now()
    };
    const nextRecords = records.filter(item => item.id !== fileId);
    nextRecords.unshift(nextRecord);
    const indexSaved = await store.set(storageKeys.index, JSON.stringify(nextRecords));
    if (!indexSaved) {
      // Do not delete fileKey here: on Save (not Save As) it may be the previous
      // committed file's key. Keep the bytes rather than risk deleting a good save.
      throw new Error('File berhasil ditulis, tetapi daftar file FigCraft gagal diperbarui.');
    }
    const lastSaved = await store.set(storageKeys.last, fileId);
    if (!lastSaved) console.warn('[Moza FigCraft] last-open pointer could not be updated; latest record can still be recovered from the index.');

    state.currentFileId = fileId;
    state.currentFileName = name;
    setStatus(`File tersimpan · ${name}`, 'normal');
    return nextRecord;
  }

  function downloadExport(name, value) {
    const bytes = bytesView(value);
    if (!bytes) throw new Error('Data ekspor FigCraft tidak valid.');
    const mimeByExtension = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml',
      pdf: 'application/pdf', webp: 'image/webp', csv: 'text/csv', json: 'application/json'
    };
    const mime = mimeByExtension[extensionOf(name)] || 'application/octet-stream';
    const blob = new Blob([bytes], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = cleanName(name);
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  function queueSave(message) {
    state.saveSerial = state.saveSerial.then(async () => {
      const name = cleanName(message.name);
      state.saving = true;
      setStatus(`Menyimpan · ${name}`, 'normal');
      try {
        if (isDocumentFile(name)) {
          await saveDesignFile(message);
        } else {
          // Host mode redirects exports as well as document saves. Preserve normal export
          // behaviour by downloading non-document formats in the parent page.
          downloadExport(name, message.bytes);
          setStatus(`Ekspor diunduh · ${name}`, 'normal');
        }
      } catch (error) {
        console.error('[Moza FigCraft] save failed', error);
        // The FigCraft bridge in this source version sends saves without an acknowledgement ID.
        // If parent persistence fails, keep a host-side dirty guard even if FigCraft has already
        // cleared its own flag after successfully posting the message.
        if (isDocumentFile(name)) state.dirty = true;
        setStatus(`Gagal menyimpan · ${error.message || error}`, 'error');
        window.alert(`Moza tidak dapat menyimpan file FigCraft:\n${error.message || error}`);
      } finally {
        state.saving = false;
        if (state.dirty) setStatus('Belum tersimpan', 'dirty');
      }
    }).catch(error => {
      console.error('[Moza FigCraft] save queue failed', error);
      state.saving = false;
    });
    return state.saveSerial;
  }

  function onMessage(event) {
    if (!state.frame || event.origin !== APP_ORIGIN || event.source !== state.frame.contentWindow) return;
    const message = event.data;
    if (!message || typeof message !== 'object' || typeof message.type !== 'string') return;

    switch (message.type) {
      case 'figcraft:ready':
        if (message.version !== '1') {
          showLoading(false);
          showError(`Versi protokol FigCraft tidak dikenali: ${String(message.version || 'kosong')}.`);
          return;
        }
        state.ready = true;
        if (state.loadingTimer) window.clearTimeout(state.loadingTimer);
        showLoading(false);
        hideError();
        const retryButtons = state.shell.querySelectorAll('[data-mz-fc-action="retry"]');
        retryButtons.forEach(button => { button.hidden = true; });
        // Optional host capability announcement from craft-web-host v1.
        sendToFigCraft('figcraft:host', { version: '1', handoff: false });
        openLastSavedDesign().catch(error => {
          console.error('[Moza FigCraft] could not restore saved design', error);
          setStatus(`Gagal membuka file tersimpan · ${error.message || error}`, 'error');
        });
        break;
      case 'figcraft:save':
        if (typeof message.name !== 'string' || !bytesView(message.bytes)) return;
        queueSave(message);
        break;
      case 'figcraft:dirty':
        updateDirty(message.dirty === true);
        break;
      case 'figcraft:failed':
        if (state.loadingTimer) window.clearTimeout(state.loadingTimer);
        showLoading(false);
        showError(message.error || 'FigCraft gagal memulai WebAssembly/WebGPU/WebGL2.');
        setStatus('Gagal memulai FigCraft', 'error');
        const retry = state.shell.querySelectorAll('[data-mz-fc-action="retry"]');
        retry.forEach(button => { button.hidden = false; });
        break;
      default:
        // Ignore messages outside the FigCraft host contract.
        break;
    }
  }

  function routeParentKeyboard(event) {
    if (!state.active) return;
    // Keyboard events inside the iframe stay in its own browsing context. This guard
    // only blocks parent-page events from reaching Moza's global shortcut handlers.
    if (event.key === 'Escape' && !state.frame.contains(event.target)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeEditor();
      return;
    }
    event.stopImmediatePropagation();
  }

  function routeParentClipboard(event) {
    if (!state.active) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  function protectBeforeUnload(event) {
    if (!state.dirty) return;
    event.preventDefault();
    event.returnValue = '';
  }

  function installEntryPointObservers() {
    const top = document.getElementById('top');
    if (top) {
      ensureTopButton();
      new MutationObserver(ensureTopButton).observe(top, { childList: true });
    }
    const attachMenuObserver = () => {
      const menu = document.getElementById('tmenu');
      if (!menu || menu.dataset.mzFcObserved) return false;
      menu.dataset.mzFcObserved = 'true';
      const ensureMenu = () => { if (menu.classList.contains('show')) ensureMobileMenuButton(); };
      new MutationObserver(ensureMenu).observe(menu, { childList: true, attributes: true, attributeFilter: ['class'] });
      return true;
    };
    if (!attachMenuObserver()) {
      // The mobile menu may be created by a later toolbar module. Stop watching the
      // document as soon as that one menu node exists.
      const watcher = new MutationObserver(() => { if (attachMenuObserver()) watcher.disconnect(); });
      watcher.observe(document.body, { childList: true, subtree: true });
    }
  }

  function install() {
    makeShell();
    installEntryPointObservers();
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-mz-fc-open]');
      if (!button) return;
      event.preventDefault();
      if (button.closest('#tmenu')) document.getElementById('tmenu')?.classList.remove('show');
      void openEditor();
    });

    window.addEventListener('message', onMessage, false);
    window.addEventListener('keydown', routeParentKeyboard, true);
    window.addEventListener('copy', routeParentClipboard, true);
    window.addEventListener('cut', routeParentClipboard, true);
    window.addEventListener('paste', routeParentClipboard, true);
    window.addEventListener('beforeunload', protectBeforeUnload, true);

    // If the core editor completed before this add-on loaded, make the entry point visible.
    if (typeof S !== 'undefined' && S.doc) ensureTopButton();
  }

  const api = {
    open: openEditor,
    close: closeEditor,
    getStatus: () => ({ active: state.active, ready: state.ready, dirty: state.dirty, projectId: state.projectId, fileName: state.currentFileName }),
    getSavedDesigns: async projectId => readRecords(projectId || state.projectId || (typeof S !== 'undefined' ? S.pid : 'default'))
  };

  window.MozaStudio = window.MozaStudio || {};
  window.MozaStudio.Integrations = window.MozaStudio.Integrations || {};
  window.MozaStudio.Integrations.FigCraft = api;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(window, document);
