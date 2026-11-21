/* Moza x FigCraft - Tahap 3 / Langkah 1: bar aksi terlihat di luar canvas.
   Berdiri sendiri: tidak mengubah moza-figcraft-integration.js. Perintah lewat window.figcraft (control API,
   same-origin) -> engine command. Status dari document.inspect (history.undo/redo, selection). */
(function (window, document) {
  'use strict';
  if (window.MozaFigCraftBar) return;

  const ICONS = {
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/>',
    paste: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9z"/>',
    dup: '<rect x="3" y="3" width="12" height="12" rx="2"/><rect x="9" y="9" width="12" height="12" rx="2"/>',
    del: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',
    hide: '<path d="m6 9 6 6 6-6"/>',
    show: '<path d="m6 15 6-6 6 6"/>'
  };
  // Satu tap = satu command.
  const BUTTONS = [
    { id: 'undo', cmd: 'edit.undo', label: 'Undo', need: 'undo' },
    { id: 'redo', cmd: 'edit.redo', label: 'Redo', need: 'redo' },
    { sep: true },
    { id: 'copy', cmd: 'edit.copy', label: 'Copy', need: 'sel', after: 'copied' },
    { id: 'paste', cmd: 'edit.paste', label: 'Paste', need: 'clip' },
    { id: 'dup', cmd: 'edit.duplicate', label: 'Duplikat', need: 'sel', icon: 'dup' },
    { id: 'del', cmd: 'edit.delete', label: 'Hapus', need: 'sel', icon: 'del', danger: true }
  ];
  const HIDE_KEY = 'mz-fcb-hidden';
  const st = { bar: null, shell: null, frame: null, buttons: {}, extra: [], undo: 0, redo: 0, sel: 0, clip: false, hasDoc: false,
    busy: false, timer: 0, msgTimer: 0, boundWin: null, collapsed: false };

  const svg = k => '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[k] || '') + '</svg>';
  function api() {
    try { const a = st.frame && st.frame.contentWindow && st.frame.contentWindow.figcraft; return a && typeof a.execute === 'function' ? a : null; } catch (_) { return null; }
  }
  function say(text) {
    const m = st.bar && st.bar.querySelector('.mz-fcb-msg'); if (!m) return;
    m.textContent = text; m.hidden = false; clearTimeout(st.msgTimer);
    st.msgTimer = setTimeout(() => { m.hidden = true; }, 2600);
  }
  function buzz() { try { navigator.vibrate && navigator.vibrate(12); } catch (_) {} }

  function enabled(b) {
    if (!st.hasDoc || st.busy) return false;
    if (b.need === 'undo') return st.undo > 0;
    if (b.need === 'redo') return st.redo > 0;
    if (b.need === 'sel') return st.sel > 0;
    if (b.need === 'clip') return st.clip;
    return true;
  }
  function paint() {
    BUTTONS.forEach(b => { if (!b.sep) { const el = st.buttons[b.id]; if (el) el.disabled = !enabled(b); } });
    st.extra.forEach(x => { x.el.disabled = !st.hasDoc || st.busy || (typeof x.enabledWhen === 'function' && !x.enabledWhen(snapshot())); });
  }
  function snapshot() { return { hasDoc: st.hasDoc, selection: st.sel, canUndo: st.undo > 0, canRedo: st.redo > 0, clipboard: st.clip }; }

  // Status dari document.inspect (ringan: depth 0). Tanpa polling: dipanggil dari event.
  async function refresh() {
    const a = api();
    if (!a || typeof a.request !== 'function') { st.hasDoc = false; paint(); return; }
    try {
      const r = await a.request('document.inspect', { depth: 0 });
      const h = (r && r.history) || {};
      st.undo = Array.isArray(h.undo) ? h.undo.length : (Number(h.undo) || 0);
      st.redo = Array.isArray(h.redo) ? h.redo.length : (Number(h.redo) || 0);
      st.sel = Array.isArray(r && r.selection) ? r.selection.length : 0;
      st.hasDoc = !!r;
    } catch (_) { st.hasDoc = false; st.sel = 0; st.undo = 0; st.redo = 0; }
    paint();
  }
  function soon(ms) { clearTimeout(st.timer); st.timer = setTimeout(refresh, ms || 120); }

  async function run(b) {
    const a = api();
    if (!a || st.busy || !enabled(b)) return;
    st.busy = true; paint(); buzz();
    try {
      await a.execute(b.cmd, {});
      if (b.after === 'copied') st.clip = true;
    } catch (e) {
      say((b.label + ' gagal: ' + ((e && e.message) || e || 'error')).slice(0, 120));
    }
    st.busy = false;
    await refresh();
  }

  function setCollapsed(v) {
    st.collapsed = !!v;
    st.bar.classList.toggle('mz-fcb-collapsed', st.collapsed);
    const t = st.bar.querySelector('.mz-fcb-toggle');
    t.innerHTML = svg(st.collapsed ? 'show' : 'hide');
    t.setAttribute('aria-expanded', String(!st.collapsed));
    t.setAttribute('aria-label', st.collapsed ? 'Tampilkan bar aksi' : 'Sembunyikan bar aksi');
    try { localStorage.setItem(HIDE_KEY, st.collapsed ? '1' : '0'); } catch (_) {}
  }

  function bindFrame() {
    let w = null;
    try { w = st.frame.contentWindow; w && w.document; } catch (_) { w = null; }
    if (!w || w === st.boundWin) return;
    st.boundWin = w;
    // Pilihan berubah tanpa memicu "dirty": dengarkan akhir gestur / tombol di iframe (pasif, tanpa menghalangi gesture).
    ['pointerup', 'pointercancel', 'touchend', 'keyup'].forEach(n => w.addEventListener(n, () => soon(140), { passive: true, capture: true }));
    // Ctrl/Cmd+C/X dari keyboard: clipboard FigCraft terisi (tidak mengubah handler FigCraft).
    w.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && /^[cx]$/i.test(e.key) && st.sel > 0) st.clip = true;
    }, { passive: true, capture: true });
    soon(400);
  }

  function build(shell) {
    const bar = document.createElement('div');
    bar.id = 'mz-fcb'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Aksi FigCraft');
    bar.innerHTML = '<div class="mz-fcb-scroll"></div><button type="button" class="mz-fcb-toggle"></button><div class="mz-fcb-msg" role="status" aria-live="polite" hidden></div>';
    const row = bar.querySelector('.mz-fcb-scroll');
    BUTTONS.forEach(b => {
      if (b.sep) { const s = document.createElement('span'); s.className = 'mz-fcb-sep'; row.appendChild(s); return; }
      const el = document.createElement('button');
      el.type = 'button'; el.disabled = true; el.dataset.mzFcbCmd = b.cmd; el.setAttribute('aria-label', b.label); el.title = b.label;
      if (b.danger) el.className = 'mz-fcb-danger';
      el.innerHTML = svg(b.icon || b.id) + '<span class="mz-fcb-lbl">' + b.label + '</span>';
      st.buttons[b.id] = el; row.appendChild(el);
    });
    // Slot untuk "Kirim ke FigCraft" / "Ambil dari FigCraft" (Tahap 4): registerAction() mengisinya.
    const slot = document.createElement('span'); slot.className = 'mz-fcb-slotwrap'; slot.style.display = 'contents'; row.appendChild(slot);
    st.slot = slot;
    // Tombol dipencet tanpa mencuri fokus dari canvas
    bar.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
    bar.addEventListener('click', e => {
      const el = e.target.closest('button'); if (!el) return;
      if (el.classList.contains('mz-fcb-toggle')) { setCollapsed(!st.collapsed); return; }
      const b = BUTTONS.find(x => !x.sep && st.buttons[x.id] === el); if (b) run(b);
    });
    shell.appendChild(bar);   // anak terakhir shell = di BAWAH stage/canvas
    shell.classList.add('mz-fcb-on');
    st.bar = bar; st.shell = shell; st.frame = shell.querySelector('#mz-fc-frame');
    let hidden = false; try { hidden = localStorage.getItem(HIDE_KEY) === '1'; } catch (_) {}
    setCollapsed(hidden);
    st.frame.addEventListener('load', () => { st.boundWin = null; st.clip = false; st.hasDoc = false; paint(); bindFrame(); soon(600); });
    window.addEventListener('message', e => {
      if (e.origin !== window.location.origin || !st.frame || e.source !== st.frame.contentWindow) return;
      const d = e.data;
      if (d && typeof d === 'object' && (d.type === 'figcraft:dirty' || d.type === 'figcraft:ready')) { bindFrame(); soon(150); }
    });
    // Saat shell dibuka kembali, perbarui status sekali.
    new MutationObserver(() => { if (!shell.hidden) { bindFrame(); soon(200); } }).observe(shell, { attributes: true, attributeFilter: ['hidden', 'class'] });
    bindFrame(); soon(500);
  }

  function registerAction(def) {
    if (!st.slot || !def || typeof def.onClick !== 'function' || !def.id) return false;
    const el = document.createElement('button');
    el.type = 'button'; el.disabled = true; el.title = def.label || def.id; el.setAttribute('aria-label', def.label || def.id);
    el.innerHTML = '<span class="mz-fcb-lbl">' + String(def.label || def.id).replace(/[<>&]/g, '') + '</span>';
    el.addEventListener('click', async () => { buzz(); try { await def.onClick(snapshot()); } catch (e) { say(((e && e.message) || 'Gagal').slice(0, 120)); } soon(100); });
    st.slot.appendChild(el); st.extra.push({ el, enabledWhen: def.enabledWhen }); paint(); return true;
  }

  function init() {
    const existing = document.getElementById('mz-fc-shell');
    if (existing) { build(existing); return; }
    const mo = new MutationObserver(() => {
      const s = document.getElementById('mz-fc-shell');
      if (s) { mo.disconnect(); build(s); }
    });
    mo.observe(document.body, { childList: true });
  }

  window.MozaFigCraftBar = { registerAction, refresh, state: snapshot, version: 'stage3-step1' };
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})(window, document);
