/* Moza x FigCraft - Tahap 3 / Langkah 2+3: Common Element Schema v1 + adapter Moza + adapter FigCraft.
   Tidak mengubah fungsi inti Moza/FigCraft. Logika murni (validate, konversi, buildBatch) bisa dites di Node. */
(function (root) {
  'use strict';
  const SCHEMA = 'moza-fc-common', VERSION = 1;
  const LIM = { json: 24e6, elements: 500, depth: 12, assets: 40, asset: 8e6, text: 20000, name: 120, native: 100e3, coord: 1e6, loss: 300 };
  const TYPES = ['text', 'rect', 'ellipse', 'image', 'group', 'frame', 'placeholder'];
  const MIME_OK = /^image\/(png|jpeg|webp|gif)$/;
  const FALLBACK_FONT = 'Inter';

  /* ---------- util ---------- */
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const num = (v, d, lo, hi) => { v = Number(v); if (!Number.isFinite(v)) v = d; return Math.min(hi === undefined ? LIM.coord : hi, Math.max(lo === undefined ? -LIM.coord : lo, v)); };
  const str = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, max || LIM.name);
  const r2 = n => Math.round(n * 100) / 100;
  const clone = o => JSON.parse(JSON.stringify(o));
  function newLoss() { const list = []; return { list, add(path, prop, reason, severity) { if (list.length < LIM.loss) list.push({ path, prop, reason, severity: severity || 'warn' }); } }; }
  const hex2 = n => ('0' + Math.round(Math.min(255, Math.max(0, n))).toString(16)).slice(-2);
  /* Warna -> {hex:'#rrggbb', a:0..1} atau null. Menerima #rgb/#rrggbb/#rrggbbaa/rgb()/rgba()/transparent. */
  function color(v) {
    if (typeof v !== 'string') return null; v = v.trim().toLowerCase();
    if (v === 'transparent') return { hex: '#000000', a: 0 };
    let m = /^#([0-9a-f]{3})$/.exec(v); if (m) { const s = m[1]; return { hex: '#' + s[0] + s[0] + s[1] + s[1] + s[2] + s[2], a: 1 }; }
    m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/.exec(v); if (m) return { hex: '#' + m[1], a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
    m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(v);
    if (m) { let a = 1; if (m[4] !== undefined) a = m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4]); return { hex: '#' + hex2(+m[1]) + hex2(+m[2]) + hex2(+m[3]), a: Math.min(1, Math.max(0, a)) }; }
    return null;
  }
  function stripHtml(s) {
    return String(s == null ? '' : s).replace(/<\s*br\s*\/?>/gi, '\n').replace(/<\/(p|div|h[1-6]|li)>/gi, '\n').replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/\n{3,}/g, '\n\n').replace(/\n$/, '');
  }
  async function sha256Hex(bytes) {
    const d = await (root.crypto && root.crypto.subtle ? root.crypto.subtle : require('crypto').webcrypto.subtle).digest('SHA-256', bytes);
    return Array.from(new Uint8Array(d)).map(b => ('0' + b.toString(16)).slice(-2)).join('');
  }
  function b64ToBytes(b64) { if (typeof atob === 'function') { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; } return new Uint8Array(Buffer.from(b64, 'base64')); }
  function dataUrlParts(u) { const m = /^data:([a-z0-9.+\/-]+);base64,([A-Za-z0-9+\/=\s]+)$/i.exec(String(u || '')); return m ? { mime: m[1].toLowerCase(), b64: m[2].replace(/\s/g, '') } : null; }

  /* ---------- font & weight mapping ---------- */
  const STYLE_WEIGHT = { thin: 100, extralight: 200, light: 300, regular: 400, normal: 400, italic: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };
  function styleToWeight(style) { const k = String(style || 'Regular').toLowerCase().replace(/[\s-]/g, '').replace(/italic$/, '') || 'regular'; return STYLE_WEIGHT[k] || 400; }
  /* Pilih style terdekat dari daftar style yang tersedia untuk weight (dan italic). */
  function pickStyle(styles, weight, italic) {
    const list = (styles && styles.length ? styles : ['Regular', 'Italic', 'SemiBold', 'Bold']).map(String);
    const wantItalic = !!italic && list.some(s => /italic/i.test(s));
    const pool = list.filter(s => /italic/i.test(s) === wantItalic && (wantItalic ? true : true));
    const cands = (pool.length ? pool : list);
    let best = cands[0], bd = 1e9;
    for (const s of cands) { const d = Math.abs(styleToWeight(s) - weight); if (d < bd) { bd = d; best = s; } }
    return best;
  }
  /* fonts: {family: [styles]} dari FigCraft (text.fonts). Tanpa daftar: hanya Inter dianggap ada. */
  function mapFont(family, weight, italic, fonts, loss, path) {
    const f = str(family, 80) || FALLBACK_FONT; const have = fonts || { [FALLBACK_FONT]: ['Regular', 'Italic', 'SemiBold', 'Bold'] };
    let fam = f;
    if (!have[f]) { const ci = Object.keys(have).find(k => k.toLowerCase() === f.toLowerCase()); if (ci) fam = ci; else { fam = have[FALLBACK_FONT] ? FALLBACK_FONT : (Object.keys(have)[0] || FALLBACK_FONT); loss && loss.add(path, 'fontFamily', 'Font "' + f + '" tidak tersedia di FigCraft; diganti "' + fam + '".'); } }
    const style = pickStyle(have[fam], weight, italic);
    if (loss && Math.abs(styleToWeight(style) - weight) >= 100) loss.add(path, 'fontWeight', 'Bobot ' + weight + ' dipetakan ke "' + style + '".', 'info');
    return { family: fam, style };
  }

  /* ---------- validasi & sanitasi payload ---------- */
  function sanitizeStyle(s, loss, path) {
    const o = {}; if (!isObj(s)) return o;
    const fill = (f, p) => { if (f == null) return null; const c = color(f && f.color); if (!c) { loss.add(path, p, 'Warna tidak valid; diabaikan.'); return null; } return { color: c.hex, alpha: r2(num(f.alpha, c.a, 0, 1)) }; };
    if (s.fill !== undefined) o.fill = fill(s.fill, 'fill');
    if (s.stroke) { const c = fill(s.stroke, 'stroke'); if (c) o.stroke = { color: c.color, alpha: c.alpha, width: num(s.stroke.width, 1, 0, 200) }; }
    if (s.radius !== undefined) o.radius = num(s.radius, 0, 0, 10000);
    if (s.opacity !== undefined) o.opacity = r2(num(s.opacity, 1, 0, 1));
    return o;
  }
  function sanitizeEl(e, depth, ctx, path) {
    if (!isObj(e)) { ctx.loss.add(path, 'element', 'Elemen bukan objek; dilewati.', 'error'); return null; }
    if (depth > LIM.depth) { ctx.loss.add(path, 'depth', 'Hierarki terlalu dalam; dipotong.', 'error'); return null; }
    if (++ctx.count > LIM.elements) { if (ctx.count === LIM.elements + 1) ctx.loss.add(path, 'count', 'Lebih dari ' + LIM.elements + ' elemen; sisanya dibuang.', 'error'); return null; }
    let type = str(e.type, 20);
    if (!TYPES.includes(type)) { ctx.loss.add(path, 'type', 'Tipe "' + type + '" tidak dikenal; jadi placeholder.'); type = 'placeholder'; }
    const o = { id: str(e.id, 64) || ('n' + ctx.count), type, name: str(e.name), x: num(e.x, 0), y: num(e.y, 0), w: num(e.w, 0, 0), h: num(e.h, 0, 0), rot: num(e.rot, 0, -360, 360), visible: e.visible !== false, style: sanitizeStyle(e.style, ctx.loss, path) };
    if (type === 'text') {
      const t = isObj(e.text) ? e.text : {}; const c = color(t.color) || { hex: '#000000', a: 1 };
      o.text = { content: str(t.content, LIM.text).replace(/\u0000/g, ''), fontFamily: str(t.fontFamily, 80) || FALLBACK_FONT, fontSize: num(t.fontSize, 16, 1, 1000), fontWeight: num(t.fontWeight, 400, 100, 900), italic: t.italic === true,
        align: ['left', 'center', 'right', 'justify'].includes(t.align) ? t.align : 'left', lineHeight: t.lineHeight == null ? null : num(t.lineHeight, 1.4, 0.2, 10), letterSpacing: num(t.letterSpacing, 0, -100, 1000), color: c.hex, alpha: r2(num(t.alpha, c.a, 0, 1)), underline: t.underline === true, transform: ['none', 'upper', 'lower', 'title'].includes(t.transform) ? t.transform : 'none' };
    }
    if (type === 'image') { const im = isObj(e.image) ? e.image : {}; o.image = { hash: /^[0-9a-f]{64}$/.test(im.hash) ? im.hash : '', fit: ['cover', 'contain', 'fill'].includes(im.fit) ? im.fit : 'cover', alt: str(im.alt, 300) }; }
    if (type === 'group' || type === 'frame') {
      o.children = []; if (Array.isArray(e.children)) e.children.forEach((c, i) => { const k = sanitizeEl(c, depth + 1, ctx, path + '.children[' + i + ']'); if (k) o.children.push(k); });
    }
    if (isObj(e.native) && /^[a-z]{1,20}$/.test(e.native.editor || '')) {
      let s = ''; try { s = JSON.stringify(e.native); } catch (_) {}
      if (s && s.length <= LIM.native) o.native = JSON.parse(s); else ctx.loss.add(path, 'native', 'Data native terlalu besar; dibuang (round-trip tidak penuh).', 'warn');
    }
    return o;
  }
  /* Tolak versi/skema tidak dikenal. Mengembalikan {ok, errors[], schema, loss[]}; schema = salinan tersanitasi. */
  function validate(input) {
    const errors = [], ctx = { count: 0, loss: newLoss() };
    let data = input;
    if (typeof input === 'string') { if (input.length > LIM.json) return { ok: false, errors: ['Payload melebihi ' + Math.round(LIM.json / 1e6) + ' MB.'], loss: [] }; try { data = JSON.parse(input); } catch (e) { return { ok: false, errors: ['JSON tidak valid: ' + e.message], loss: [] }; } }
    if (!isObj(data)) return { ok: false, errors: ['Payload harus objek JSON.'], loss: [] };
    if (data.schema !== SCHEMA) errors.push('Bukan skema "' + SCHEMA + '".');
    if (data.version !== VERSION) errors.push('Versi skema ' + str(data.version, 10) + ' tidak didukung (hanya ' + VERSION + ').');
    if (errors.length) return { ok: false, errors, loss: [] };
    (Array.isArray(data.lossReport) ? data.lossReport : []).slice(0, LIM.loss).forEach(l => { if (isObj(l)) ctx.loss.add(str(l.path, 120), str(l.prop, 40), str(l.reason, 300), ['info', 'warn', 'error'].includes(l.severity) ? l.severity : 'warn'); });
    const m = isObj(data.meta) ? data.meta : {};
    const meta = { source: ['moza', 'figcraft'].includes(m.source) ? m.source : 'unknown', docName: str(m.docName), transferId: str(m.transferId, 64), createdAt: str(m.createdAt, 40), bp: ['d', 't', 'm'].includes(m.bp) ? m.bp : 'd', bounds: { w: num(m.bounds && m.bounds.w, 0, 0), h: num(m.bounds && m.bounds.h, 0, 0) } };
    const elements = []; (Array.isArray(data.elements) ? data.elements : []).forEach((e, i) => { const k = sanitizeEl(e, 0, ctx, 'elements[' + i + ']'); if (k) elements.push(k); });
    const assets = [];
    (Array.isArray(data.assets) ? data.assets : []).slice(0, LIM.assets).forEach((a, i) => {
      if (!isObj(a)) return; const mime = str(a.mime, 40).toLowerCase(); const b64 = typeof a.bytes === 'string' ? a.bytes.replace(/\s/g, '') : '';
      if (!MIME_OK.test(mime)) { ctx.loss.add('assets[' + i + ']', 'mime', 'Tipe "' + mime + '" ditolak (hanya png/jpeg/webp/gif).', 'error'); return; }
      if (!/^[0-9a-f]{64}$/.test(a.hash || '')) { ctx.loss.add('assets[' + i + ']', 'hash', 'Hash SHA-256 tidak valid; aset ditolak.', 'error'); return; }
      if (!b64 || !/^[A-Za-z0-9+\/]*={0,2}$/.test(b64) || b64.length * 0.75 > LIM.asset) { ctx.loss.add('assets[' + i + ']', 'bytes', 'Bytes aset kosong, bukan base64, atau lebih dari ' + LIM.asset / 1e6 + ' MB.', 'error'); return; }
      assets.push({ hash: a.hash, mime, name: str(a.name), w: num(a.w, 0, 0, 20000), h: num(a.h, 0, 0, 20000), bytes: b64 });
    });
    const have = new Set(assets.map(a => a.hash));
    (function fix(list, p) { list.forEach((e, i) => { if (e.type === 'image' && !have.has(e.image.hash)) { ctx.loss.add(p + '[' + i + ']', 'image', 'Gambar tidak punya aset valid; jadi placeholder.'); e.type = 'placeholder'; e.style.fill = e.style.fill || { color: '#e5e7eb', alpha: 1 }; } if (e.children) fix(e.children, p + '[' + i + '].children'); }); })(elements, 'elements');
    return { ok: true, errors: [], schema: { schema: SCHEMA, version: VERSION, meta, elements, assets, lossReport: ctx.loss.list }, loss: ctx.loss.list };
  }
  const bytesLen = b64 => Math.floor(b64.length * 0.75);

  /* ======================= ADAPTER MOZA ======================= */
  const MOZA_TEXT = ['heading', 'subtitle', 'paragraph', 'caption', 'link'];
  function mozaEnv() {
    /* S, BP, effG, col, newEl, ... adalah global script Moza */
    return { S, BP, effG, col, uid, newEl, secInfo, selSecId, commit, discrete, renderCanvas, renderRight, renderLeft, theme: () => S.doc.theme, GOOGLE: typeof GOOGLE !== 'undefined' ? GOOGLE : [], toast: typeof toast === 'function' ? toast : () => {} };
  }
  function mozaColor(env, v) { if (!v) return null; return color(env.col(v)); }
  function realFontName(env, n) { const t = env.S.doc.theme || {}; return n === '$head' ? t.headFont : n === '$body' ? t.bodyFont : n; }
  function fillOf(env, f, loss, path) {
    if (!f) return null;
    if (f.t === 'grad' && f.g) { loss.add(path, 'fill', 'Gradien dijadikan warna tunggal (stop 1).'); const c = mozaColor(env, f.g.c1); return c && { color: c.hex, alpha: c.a }; }
    const c = mozaColor(env, f.c); return c && { color: c.hex, alpha: c.a };
  }
  /* Elemen Moza -> elemen skema. g(k) = geometri efektif breakpoint aktif. */
  async function mozaToEl(env, el, loss, path, assetsOut, depth) {
    const bp = env.S.bp, g = k => { const v = env.effG(el, bp, k); return Number.isFinite(+v) ? +v : 0; };
    const st = el.st || {};
    const base = { id: el.id, type: 'placeholder', name: el.name || el.type, x: r2(g('x')), y: r2(g('y')), w: r2(g('w')), h: r2(g('h')), rot: num(el.rot, 0, -360, 360), visible: !(el.hidden || (el.hideOn && el.hideOn[bp])), style: {}, native: { editor: 'moza', type: el.type } };
    const op = st.op == null ? 1 : +st.op; if (op !== 1) base.style.opacity = op;
    if (st.sh && st.sh.on) loss.add(path, 'shadow', 'Bayangan tidak dikonversi (v1).');
    if (st.tsh && st.tsh.on) loss.add(path, 'textShadow', 'Bayangan teks tidak dikonversi (v1).');
    if (el.ix && el.ix.length) loss.add(path, 'interaction', 'Interaksi/animasi Moza tidak dikonversi.');
    if (el.bp && Object.keys(el.bp).length) base.native.bpKeys = Object.keys(el.bp);
    if (el.link && (el.link.v || '')) base.native.link = { t: String(el.link.t || 'url'), v: String(el.link.v), nt: !!el.link.nt };
    if (MOZA_TEXT.includes(el.type) || el.type === 'button') {
      const fs = bp === 'd' ? (st.fs || 16) : g('fs') || st.fs || 16;
      const c = mozaColor(env, st.color) || { hex: '#000000', a: 1 };
            const t = { content: stripHtml(el.text), fontFamily: realFontName(env, st.ff) || FALLBACK_FONT, fontSize: fs, fontWeight: st.fw || 400, align: st.align === 'justify' ? 'justify' : (st.align || 'left'), lineHeight: st.lh || null, letterSpacing: st.ls || 0, color: c.hex, alpha: c.a, transform: st.tt === 'uppercase' ? 'upper' : st.tt === 'lowercase' ? 'lower' : st.tt === 'capitalize' ? 'title' : 'none' };
      if (String(el.text || '').includes('<')) loss.add(path, 'richText', 'Format teks kaya (tebal/miring/ukuran per bagian) diratakan jadi teks biasa.', 'info');
      if (el.type === 'button') {
        const bg = mozaColor(env, st.bg); const grp = { ...base, type: 'group', children: [] };
        grp.children.push({ id: el.id + '_bg', type: 'rect', name: (el.name || 'Button') + ' bg', x: 0, y: 0, w: base.w, h: base.h, rot: 0, visible: true, style: { fill: bg ? { color: bg.hex, alpha: bg.a } : null, radius: st.br || 0 } });
        grp.children.push({ id: el.id + '_tx', type: 'text', name: 'Label', x: 0, y: Math.max(0, r2((base.h - fs * (st.lh || 1.2)) / 2)), w: base.w, h: r2(fs * (st.lh || 1.2)), rot: 0, visible: true, style: {}, text: { ...t, align: 'center' } });
        grp.rot = base.rot; grp.x = base.x; grp.y = base.y; return grp;
      }
      return { ...base, type: 'text', text: t };
    }
    if (el.type === 'shape' && ['rect', 'rrect', 'circle', 'ellipse'].includes(el.shape)) {
      const isEll = el.shape === 'circle' || el.shape === 'ellipse'; const sc = (el.sw > 0) ? mozaColor(env, el.sc) : null;
      base.type = isEll ? 'ellipse' : 'rect'; base.style.fill = fillOf(env, el.fill, loss, path);
      if (!isEll) base.style.radius = el.shape === 'rrect' && !el.rad ? 26 : (el.rad || 0);
      if (sc) base.style.stroke = { color: sc.hex, alpha: sc.a, width: el.sw };
      return base;
    }
    if (el.type === 'container') { const bg = mozaColor(env, st.bg); base.type = 'rect'; base.style.fill = bg ? { color: bg.hex, alpha: bg.a } : null; base.style.radius = st.br || 0; if (st.bw > 0) { const bc = mozaColor(env, st.bc); bc && (base.style.stroke = { color: bc.hex, alpha: bc.a, width: st.bw }); } return base; }
    if (el.type === 'image') {
      const a = el.asset && env.S.assets.find(x => x.id === el.asset); const p = a && dataUrlParts(a.data);
      if (!a || !p || !MIME_OK.test(p.mime)) { loss.add(path, 'image', a ? 'Format gambar (' + (p ? p.mime : 'tidak dikenal') + ') tidak didukung; jadi placeholder.' : 'Gambar belum diisi; jadi placeholder.'); return base; }
      if (bytesLen(p.b64) > LIM.asset) { loss.add(path, 'image', 'Gambar lebih dari ' + LIM.asset / 1e6 + ' MB; jadi placeholder.'); return base; }
      const hash = await sha256Hex(b64ToBytes(p.b64));
      if (!assetsOut.find(x => x.hash === hash)) assetsOut.push({ hash, mime: p.mime, name: a.name || 'image', w: a.w || 0, h: a.h || 0, bytes: p.b64 });
      if (el.mask && el.mask !== 'none') loss.add(path, 'mask', 'Mask gambar tidak dikonversi.', 'info');
      if ((el.zoom && el.zoom !== 1) || (el.px !== undefined && el.px !== 50) || (el.py !== undefined && el.py !== 50)) loss.add(path, 'crop', 'Posisi/zoom pemotongan gambar tidak dipertahankan.', 'info');
      base.type = 'image'; base.image = { hash, fit: el.fit === 'contain' ? 'contain' : 'cover', alt: el.alt || '' }; base.native.fit = el.fit; base.native.px = el.px; base.native.py = el.py; base.native.zoom = el.zoom; return base;
    }
    if (el.type === 'group') {
      base.type = 'group'; base.children = [];
      for (const [i, c] of (el.children || []).entries()) base.children.push(await mozaToEl(env, c, loss, path + '.children[' + i + ']', assetsOut, depth + 1));
      return base;
    }
    base.style.fill = { color: '#e5e7eb', alpha: 1 }; base.style.stroke = { color: '#9ca3af', alpha: 1, width: 1 };
    loss.add(path, 'type', 'Elemen "' + el.type + (el.shape ? '/' + el.shape : '') + '" tidak didukung v1; diganti placeholder abu-abu (ukuran sama).');
    return base;
  }
  /* Ekspor elemen terpilih (atau ids) ke skema. Geometri = breakpoint aktif; koordinat dinormalkan ke pojok kiri-atas pilihan. */
  async function mozaExport(opts) {
    opts = opts || {}; const env = opts.env || mozaEnv(); const S = env.S;
    const ids = opts.ids || (S.multi && S.multi.length > 1 ? S.multi.slice() : (S.sel && S.sel.k === 'el' ? [S.sel.id] : []));
    const loss = newLoss(); const assets = []; const els = [];
    if (!ids.length) return { ok: false, errors: ['Tidak ada elemen terpilih.'], loss: [] };
    let sec = null;
    for (const [i, id] of ids.entries()) {
      const f = env.findEl ? env.findEl(id) : (typeof findEl === 'function' ? findEl(id) : null); if (!f) continue; sec = sec || f.sec;
      els.push(await mozaToEl(env, f.el, loss, 'elements[' + i + ']', assets, 0));
    }
    if (!els.length) return { ok: false, errors: ['Elemen tidak ditemukan.'], loss: loss.list };
    const minX = Math.min(...els.map(e => e.x)), minY = Math.min(...els.map(e => e.y));
    els.forEach(e => { e.x = r2(e.x - minX); e.y = r2(e.y - minY); });
    const w = Math.max(...els.map(e => e.x + e.w)), h = Math.max(...els.map(e => e.y + e.h));
    const raw = { schema: SCHEMA, version: VERSION, meta: { source: 'moza', docName: (S.doc && S.doc.name) || '', transferId: env.uid('t'), createdAt: new Date().toISOString(), bp: S.bp, bounds: { w: r2(w), h: r2(h) } }, elements: els, assets, lossReport: loss.list };
    return validate(raw);
  }
  /* Skema -> elemen Moza baru. ID baru; aset di-merge (hash sama = dipakai ulang); token warna sudah nyata. */
  const TOK_LINK = /^(url|page|section)$/;
  function safeLink(l) { if (!isObj(l) || !TOK_LINK.test(l.t || '') || typeof l.v !== 'string' || l.v.length > 2000) return null; if (/^\s*(javascript|data|vbscript):/i.test(l.v)) return null; return { t: l.t, v: l.v, nt: !!l.nt }; }
  function mozaBuild(env, schema, loss) {
    const BP = env.BP, mbp = schema.meta.bp, k = mbp === 'd' ? 1 : 1200 / BP[mbp];
    const S = env.S; const assetIds = new Map();
    const fontKnown = f => env.GOOGLE.some(x => x[0] === f) || (S.fonts || []).some(x => x.family === f) || f === (S.doc.theme && S.doc.theme.headFont) || f === (S.doc.theme && S.doc.theme.bodyFont);
    const geom = (el, e) => { const g = { x: r2(e.x * k), y: r2(e.y * k), w: Math.max(4, r2(e.w * k)), h: Math.max(1, r2(e.h * k)) }; Object.assign(el, g); if (mbp !== 'd') (el.bp = el.bp || {})[mbp] = { x: r2(e.x), y: r2(e.y), w: Math.max(4, r2(e.w)), h: Math.max(1, r2(e.h)) }; el.rot = e.rot || 0; el.hidden = e.visible === false; if (e.name) el.name = e.name; };
    const fillC = (f, def) => (f && f.alpha < 1 ? 'rgba(' + parseInt(f.color.slice(1, 3), 16) + ',' + parseInt(f.color.slice(3, 5), 16) + ',' + parseInt(f.color.slice(5, 7), 16) + ',' + f.alpha + ')' : f ? f.color : def);
    const build = (e, path) => {
      let el = null;
      if (e.type === 'text') {
        const t = e.text, sizeK = mbp === 'd' ? 1 : 1200 / BP[mbp];
        if (!fontKnown(t.fontFamily)) loss.add(path, 'fontFamily', 'Font "' + t.fontFamily + '" tidak ada di daftar font Moza; nama font dipertahankan, tampil fallback bila belum dimuat.', 'info');
        el = env.newEl('paragraph', { text: t.content, st: { fs: Math.max(8, Math.round(t.fontSize * (mbp === 'd' ? 1 : sizeK))), fw: t.fontWeight, ff: t.fontFamily, color: fillC({ color: t.color, alpha: t.alpha }), align: t.align, ls: t.letterSpacing, lh: t.lineHeight || 1.3, tt: t.transform === 'upper' ? 'uppercase' : t.transform === 'lower' ? 'lowercase' : t.transform === 'title' ? 'capitalize' : 'none', op: e.style.opacity == null ? 1 : e.style.opacity } });
        if (t.underline) loss.add(path, 'underline', 'Garis bawah teks tidak dikonversi.', 'info');
        if (t.italic) loss.add(path, 'italic', 'Teks miring tidak dikonversi.', 'info');
      } else if (e.type === 'rect' || e.type === 'ellipse') {
        el = env.newEl('shape', { shape: e.type === 'ellipse' ? 'ellipse' : 'rect', rad: e.style.radius || 0, fill: { t: 'solid', c: e.style.fill ? fillC(e.style.fill) : 'transparent', g: { c1: '#3a5bf0', c2: '#f2b84b', a: 135 } }, sc: e.style.stroke ? e.style.stroke.color : '#1c2027', sw: e.style.stroke ? e.style.stroke.width : 0, st: { op: e.style.opacity == null ? 1 : e.style.opacity } });
      } else if (e.type === 'image') {
        const a = schema.assets.find(x => x.hash === e.image.hash); let id = assetIds.get(e.image.hash);
        if (!id) { const have = S.assets.find(x => x.hash === e.image.hash); id = have ? have.id : env.uid('a'); if (!have) S.assets.push({ id, name: a.name || 'image', data: 'data:' + a.mime + ';base64,' + a.bytes, w: a.w, h: a.h, hash: a.hash, folder: null }); assetIds.set(e.image.hash, id); }
        el = env.newEl('image', { asset: id, fit: e.image.fit === 'contain' ? 'contain' : 'cover', alt: e.image.alt || '', st: { op: e.style.opacity == null ? 1 : e.style.opacity, br: e.style.radius || 0 } });
        const n = e.native; if (n && n.editor === 'moza' && n.type === 'image') { if (['cover', 'contain'].includes(n.fit)) el.fit = n.fit; if (Number.isFinite(n.px)) el.px = num(n.px, 50, 0, 100); if (Number.isFinite(n.py)) el.py = num(n.py, 50, 0, 100); if (Number.isFinite(n.zoom)) el.zoom = num(n.zoom, 1, 0.1, 10); }
      } else if (e.type === 'group' || e.type === 'frame') {
        el = env.newEl('group', { children: [] });
        if (e.type === 'frame') { if (e.style.fill || e.style.stroke) { const bg = env.newEl('shape', { shape: 'rect', rad: e.style.radius || 0, fill: { t: 'solid', c: e.style.fill ? fillC(e.style.fill) : 'transparent', g: { c1: '#3a5bf0', c2: '#f2b84b', a: 135 } }, sc: e.style.stroke ? e.style.stroke.color : '#1c2027', sw: e.style.stroke ? e.style.stroke.width : 0 }); geom(bg, { x: 0, y: 0, w: e.w, h: e.h, rot: 0, visible: true, name: (e.name || 'Frame') + ' bg' }); el.children.push(bg); } loss.add(path, 'frame', 'Frame menjadi Group Moza (fill/stroke jadi persegi latar; clip, auto layout, constraint tidak dikonversi).', 'info'); }
        e.children.forEach((c, i) => { const ch = build(c, path + '.children[' + i + ']'); ch && el.children.push(ch); });
      } else {
        el = env.newEl('shape', { shape: 'rect', fill: { t: 'solid', c: '#e5e7eb', g: { c1: '#3a5bf0', c2: '#f2b84b', a: 135 } }, sc: '#9ca3af', sw: 1 });
        loss.add(path, 'placeholder', 'Elemen placeholder diimpor sebagai persegi abu-abu.', 'info');
      }
      geom(el, e);
      const n = e.native; if (n && n.editor === 'moza' && ['text', 'image'].includes(e.type)) { const l = safeLink(n.link); if (l) el.link = l; }
      return el;
    };
    return schema.elements.map((e, i) => build(e, 'elements[' + i + ']'));
  }
  /* Impor ke section terpilih/aktif Moza. Tidak menyentuh elemen yang ada; bp hanya ditulis pada elemen baru. */
  function mozaImport(input, opts) {
    opts = opts || {}; const v = validate(input); if (!v.ok) return v;
    const env = opts.env || mozaEnv(); const loss = newLoss(); v.schema.lossReport.forEach(l => loss.list.push(l));
    const si = env.secInfo(opts.sectionId || env.selSecId()); if (!si) return { ok: false, errors: ['Tidak ada section Moza aktif.'], loss: loss.list };
    const els = mozaBuild(env, v.schema, loss);
    if (!opts.dryRun) {
      env.commit(env.discrete());
      const r = env.BP[env.S.bp] / 1200, cx = env.BP[env.S.bp] / 2, bw = v.schema.meta.bounds.w || 0, bh = v.schema.meta.bounds.h || 0;
      const kk = v.schema.meta.bp === 'd' ? 1 : 1200 / env.BP[v.schema.meta.bp];
      const offX = Math.round(cx / r - (bw * kk) / 2), offY = 40;
      (function shift(list, top) { list.forEach(el => { if (top) { el.x += offX; el.y += offY; if (el.bp) Object.values(el.bp).forEach(o => { if (o && o.x !== undefined) { o.x += Math.round(offX * r); o.y += Math.round(offY * r); } }); } }); })(els, true);
      els.forEach(el => si.sec.elements.push(el));
      env.S.sel = { k: 'el', id: els[els.length - 1].id }; env.S.multi = els.length > 1 ? els.map(x => x.id) : [];
      env.renderCanvas(); env.renderRight && env.renderRight();
    }
    return { ok: true, errors: [], elements: els, loss: loss.list, schema: v.schema };
  }

  /* ======================= ADAPTER FIGCRAFT ======================= */
  const lastOf = v => (Array.isArray(v) ? v[0] : v);
  function figNum(v, fs) { if (v == null) return null; if (typeof v === 'number') return v; const s = String(v).trim(); if (/^auto$/i.test(s)) return null; if (/%$/.test(s)) return parseFloat(s) / 100 * (fs || 1); const n = parseFloat(s); return Number.isFinite(n) ? n : null; }
  function figFill(fills, loss, path, prop) {
    const list = (Array.isArray(fills) ? fills : []).filter(f => f && f.visible !== false); if (!list.length) return { fill: null };
    const f = list[0];
    if (f.type === 'solid' || (f.color && !f.type)) { const c = color(f.color); return { fill: c ? { color: c.hex, alpha: r2(f.opacity == null ? c.a : f.opacity * c.a) } : null }; }
    if (f.type === 'image') return { image: f };
    loss.add(path, prop, 'Paint "' + f.type + '" tidak dikonversi; diganti abu-abu.'); return { fill: { color: '#9ca3af', alpha: 1 } };
  }
  /* node.get -> elemen skema. api dipakai hanya untuk gambar (ui.render ids) lewat opts.renderImage. */
  async function figNodeToEl(n, loss, path, assetsOut, opts, parentAbs) {
    const type = String(n.type || '').toUpperCase(); const ab = n.absoluteBounds || {};
    const e = { id: String(n.id), type: 'placeholder', name: n.name || '', x: r2(n.x || 0), y: r2(n.y || 0), w: r2(n.width || ab.width || 0), h: r2(n.height || ab.height || 0), rot: num(n.rotation, 0, -360, 360), visible: n.visible !== false, style: {}, native: { editor: 'figcraft', type } };
    if (n.opacity != null && n.opacity !== 1) e.style.opacity = n.opacity;
    if (Array.isArray(n.effects) && n.effects.some(x => x && x.visible !== false)) loss.add(path, 'effects', 'Efek (bayangan/blur) tidak dikonversi.');
    if (n.layout && n.layout.mode && n.layout.mode !== 'none') loss.add(path, 'autoLayout', 'Auto layout tidak dikonversi; posisi akhir dipakai.', 'info');
    if (typeof n.cornerRadius === 'number') e.style.radius = n.cornerRadius; else if (n.cornerRadius) loss.add(path, 'cornerRadius', 'Radius per-sudut tidak dikonversi.', 'info');
    const str0 = lastOf(n.strokes); if (str0 && str0.color) { const c = color(str0.color); c && (e.style.stroke = { color: c.hex, alpha: c.a, width: num(n.strokeWeight || (n.stroke && n.stroke.weight), 1, 0, 200) }); }
    const fr = figFill(n.fills, loss, path, 'fill');
    if (type === 'TEXT') {
      const fs = n.fontSize || 16, c = (fr.fill && { hex: fr.fill.color, a: fr.fill.alpha }) || { hex: '#000000', a: 1 }; const lh = figNum(n.lineHeight, fs), ls = figNum(n.letterSpacing, fs);
      const lsPx = /%$/.test(String(n.letterSpacing || '')) ? fs * parseFloat(n.letterSpacing) / 100 : (ls || 0);
      e.type = 'text'; e.text = { content: String(n.characters || ''), fontFamily: n.fontFamily || FALLBACK_FONT, fontSize: fs, fontWeight: styleToWeight(n.fontStyle), italic: /italic/i.test(n.fontStyle || ''), align: n.textAlign === 'justified' ? 'justify' : (n.textAlign || 'left'), lineHeight: lh ? r2(lh / fs) : null, letterSpacing: r2(lsPx), color: c.hex, alpha: c.a, underline: n.textDecoration === 'underline', transform: n.textCase === 'upper' ? 'upper' : n.textCase === 'lower' ? 'lower' : 'none' };
      if (n.textCase && !['original', 'upper', 'lower'].includes(n.textCase)) loss.add(path, 'textCase', 'Text case "' + n.textCase + '" tidak dikonversi.', 'info');
      return e;
    }
    if (type === 'RECTANGLE' || type === 'ELLIPSE') {
      if (fr.image) {
        const img = await opts.renderImage(n, fr.image, loss, path);
        if (img) { if (!assetsOut.find(x => x.hash === img.hash)) assetsOut.push(img); e.type = 'image'; e.image = { hash: img.hash, fit: /fit/i.test(fr.image.mode || fr.image.scaleMode || '') ? 'contain' : 'cover', alt: '' }; return e; }
        return e; /* placeholder + loss dari renderImage */
      }
      e.type = type === 'ELLIPSE' ? 'ellipse' : 'rect'; e.style.fill = fr.fill; if (Array.isArray(n.fills) && n.fills.length > 1) loss.add(path, 'fills', 'Hanya fill pertama yang dipakai.', 'info'); return e;
    }
    if (type === 'GROUP' || type === 'FRAME' || type === 'COMPONENT' || type === 'INSTANCE' || type === 'SECTION') {
      e.type = type === 'GROUP' ? 'group' : 'frame'; e.style.fill = type === 'GROUP' ? undefined : fr.fill; if (type !== 'GROUP' && type !== 'FRAME') loss.add(path, 'type', type + ' dijadikan frame biasa (komponen/instance tidak dipertahankan).', 'info');
      if (type !== 'GROUP' && n.clip) loss.add(path, 'clip', 'Clip content tidak dikonversi.', 'info');
      e.children = []; for (const [i, c] of (n.children || []).entries()) e.children.push(await figNodeToEl(c, loss, path + '.children[' + i + ']', assetsOut, opts));
      return e;
    }
    e.style.fill = { color: '#e5e7eb', alpha: 1 }; e.style.stroke = { color: '#9ca3af', alpha: 1, width: 1 };
    loss.add(path, 'type', 'Node "' + type + '" tidak didukung v1; diganti placeholder (bounding box).'); return e;
  }
  async function loadFonts(api) {
    const out = {}; try { const fams = await api.execute('text.fonts', {}); for (const f of (Array.isArray(fams) ? fams : []).map(x => typeof x === 'string' ? x : x && (x.family || x.name)).filter(Boolean)) { const st = await api.execute('text.fonts', { family: f }); out[f] = Array.isArray(st) ? st.map(String) : []; } } catch (_) {}
    return Object.keys(out).length ? out : null;
  }
  /* Baca node terpilih FigCraft -> skema. api = window.figcraft (iframe). */
  async function figRead(api, opts) {
    opts = opts || {}; const loss = newLoss(); const assets = [];
    const doc = await api.request('document.inspect', { depth: 0 });
    const ids = opts.ids || (doc && doc.selection) || []; if (!ids.length) return { ok: false, errors: ['Tidak ada objek terpilih di FigCraft.'], loss: [] };
    const renderImage = opts.renderImage || (async (n, fill, ls, path) => {
      /* Bytes asli tidak dibuka lewat control API: rasterisasi node (ui.render ids) sebagai PNG; hash = SHA-256 bytes PNG. */
      try { const r = await api.request('ui.render', { ids: [n.id], scale: 1 }); const b64 = r && r.data; if (!b64) throw new Error('tanpa data'); const hash = await sha256Hex(b64ToBytes(b64));
        ls.add(path, 'image', 'Gambar dirasterisasi dari render node (bytes asli tidak tersedia lewat control API); efek lain pada node ikut tergambar.', 'info'); return { hash, mime: 'image/png', name: n.name || 'image', w: Math.round(n.width || 0), h: Math.round(n.height || 0), bytes: b64 }; }
      catch (e) { ls.add(path, 'image', 'Gambar tidak dapat diambil (' + (e && e.message || e) + '); jadi placeholder.'); return null; } });
    const els = [];
    for (const [i, id] of ids.entries()) { const n = await api.request('node.get', { id, depth: 8 }); const nn = n && (n.node || n); els.push(await figNodeToEl(nn, loss, 'elements[' + i + ']', assets, { renderImage })); }
    /* koordinat top-level FigCraft relatif ke parent; pakai absoluteBounds untuk normalisasi bersama */
    const minX = Math.min(...els.map(e => e.x)), minY = Math.min(...els.map(e => e.y));
    els.forEach(e => { e.x = r2(e.x - minX); e.y = r2(e.y - minY); });
    const raw = { schema: SCHEMA, version: VERSION, meta: { source: 'figcraft', docName: (doc && doc.name) || '', transferId: 't' + Math.random().toString(36).slice(2, 9), createdAt: new Date().toISOString(), bp: 'd', bounds: { w: r2(Math.max(...els.map(e => e.x + e.w))), h: r2(Math.max(...els.map(e => e.y + e.h))) } }, elements: els, assets, lossReport: loss.list };
    return validate(raw);
  }
  /* Skema -> daftar step command.batch. Murni (tanpa api). Anak group memakai koordinat frame induk (group FigCraft tak punya ruang sendiri). */
  function buildBatch(input, opts) {
    opts = opts || {}; const v = validate(input); if (!v.ok) return v; const sc = v.schema, loss = newLoss(); sc.lossReport.forEach(l => loss.list.push(l));
    const fonts = opts.fonts || null, steps = [], ox = opts.x == null ? 80 : opts.x, oy = opts.y == null ? 80 : opts.y;
    const byHash = new Map(sc.assets.map(a => [a.hash, a]));
    const push = (command, params) => { steps.push({ command, params }); return steps.length - 1; };
    const fillProp = f => (f ? (f.alpha < 1 ? { type: 'solid', color: f.color, opacity: f.alpha } : f.color) : 'none');
    const walk = (e, parentStep, ax, ay, path) => {
      if (!e.visible && opts.skipHidden) return;
      const x = ax + e.x, y = ay + e.y; const parent = parentStep == null ? undefined : { $step: parentStep };
      const common = {}; if (e.style.opacity != null && e.style.opacity !== 1) common.opacity = e.style.opacity; if (e.rot) { common.rotation = e.rot; loss.add(path, 'rotation', 'Rotasi diterapkan; titik putar FigCraft (kiri-atas) bisa berbeda dari Moza (tengah).', 'info'); } if (!e.visible) common.visible = false;
      let id;
      if (e.type === 'text') {
        const t = e.text, f = mapFont(t.fontFamily, t.fontWeight, t.italic, fonts, loss, path);
        const props = { ...common, fontFamily: f.family, fontStyle: f.style, fontSize: t.fontSize, fill: t.alpha < 1 ? { type: 'solid', color: t.color, opacity: t.alpha } : t.color, textAlign: t.align === 'justify' ? 'justified' : t.align };
        if (t.lineHeight) props.lineHeight = r2(t.lineHeight * t.fontSize); if (t.letterSpacing) props.letterSpacing = t.letterSpacing; if (t.underline) props.textDecoration = 'underline'; if (t.transform !== 'none') props.textCase = t.transform;
        let text = t.content; if (t.transform === 'upper') text = text.toUpperCase(); if (t.transform === 'lower') text = text.toLowerCase();
        id = push('node.create', { type: 'text', name: e.name || undefined, text, x, y, width: e.w || undefined, parent, props, select: false });
      } else if (e.type === 'rect' || e.type === 'ellipse' || e.type === 'placeholder') {
        const props = { ...common, fill: fillProp(e.style.fill) }; if (e.style.radius && e.type !== 'ellipse') props.cornerRadius = e.style.radius; if (e.style.stroke) { props.stroke = e.style.stroke.color; props.strokeWeight = e.style.stroke.width; }
        id = push('node.create', { type: e.type === 'ellipse' ? 'ellipse' : 'rectangle', name: e.name || (e.type === 'placeholder' ? 'Placeholder' : undefined), x, y, width: e.w || 1, height: e.h || 1, parent, props, select: false });
      } else if (e.type === 'image') {
        const a = byHash.get(e.image.hash);
        id = push('image.place', { data: a.bytes, name: e.name || a.name, x, y, width: e.w || undefined, height: e.h || undefined, parent, mode: e.image.fit === 'contain' ? 'fit' : 'fill' });
        const extra = { ...common }; if (e.style.radius) extra.cornerRadius = e.style.radius; if (Object.keys(extra).length) push('node.set', { ids: [{ $step: id }], props: extra });
      } else if (e.type === 'group' || e.type === 'frame') {
        if (e.type === 'frame') { const props = { ...common, fill: fillProp(e.style.fill) }; if (e.style.radius) props.cornerRadius = e.style.radius; if (e.style.stroke) { props.stroke = e.style.stroke.color; props.strokeWeight = e.style.stroke.width; } id = push('node.create', { type: 'frame', name: e.name || undefined, x, y, width: e.w || 1, height: e.h || 1, parent, props, select: false }); e.children.forEach((c, i) => walk(c, id, 0, 0, path + '.children[' + i + ']')); return id; }
        /* group: dibuat kosong di parent-nya; anak memakai ruang frame induk => offset kumulatif */
        id = push('node.create', { type: 'group', name: e.name || undefined, parent, select: false, props: common });
        e.children.forEach((c, i) => walk(c, id, x, y, path + '.children[' + i + ']'));
        return id;
      }
      return id;
    };
    sc.elements.forEach((e, i) => walk(e, null, ox, oy, 'elements[' + i + ']'));
    return { ok: true, errors: [], steps, loss: loss.list, schema: sc };
  }
  /* Jalankan: satu command.batch = satu undo. Mengembalikan hasil + loss report. */
  async function figWrite(api, input, opts) {
    opts = opts || {}; const pre = validate(input); if (!pre.ok) return pre;
    const fonts = opts.fonts !== undefined ? opts.fonts : await loadFonts(api);
    const b = buildBatch(pre.schema, { ...opts, fonts }); if (!b.ok) return b; if (!b.steps.length) return { ok: false, errors: ['Tidak ada elemen untuk dibuat.'], loss: b.loss };
    const res = await api.execute('command.batch', { label: opts.label || 'Impor dari Moza', commands: b.steps });
    return { ok: true, errors: [], result: res, steps: b.steps.length, loss: b.loss };
  }

  root.MozaCommon = { SCHEMA, VERSION, LIMITS: LIM, validate, color, stripHtml, mapFont, pickStyle, styleToWeight, sha256Hex,
    moza: { export: mozaExport, import: mozaImport, toEl: mozaToEl, build: mozaBuild },
    figcraft: { read: figRead, write: figWrite, buildBatch, loadFonts, nodeToEl: figNodeToEl } };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MozaCommon;
})(typeof window !== 'undefined' ? window : globalThis);
