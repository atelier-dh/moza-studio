/* Moza x FigCraft - Tahap 3 / Langkah 3: panel UJI schema+adapter. Hanya aktif dengan ?devprobe=1. */
(function (window, document) {
  'use strict';
  if (!/[?&]devprobe=1(&|$)/.test(window.location.search) || !window.MozaCommon) return;
  const C = window.MozaCommon;
  const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const SAMPLES = {
    'Teks': { type: 'text', x: 0, y: 0, w: 320, h: 48, text: { content: 'Halo dari Moza', fontFamily: 'Inter', fontSize: 28, fontWeight: 700, color: '#1c2027', align: 'left', lineHeight: 1.3 } },
    'Rectangle': { type: 'rect', x: 0, y: 70, w: 160, h: 90, style: { fill: { color: '#3a5bf0', alpha: 1 }, radius: 12, stroke: { color: '#1c2027', alpha: 1, width: 2 } } },
    'Ellipse': { type: 'ellipse', x: 180, y: 70, w: 90, h: 90, style: { fill: { color: '#f2b84b', alpha: 0.8 } } },
    'Image': { type: 'image', x: 0, y: 180, w: 100, h: 60, image: { hash: '', fit: 'cover' } },
    'Group': { type: 'group', x: 120, y: 180, w: 140, h: 60, children: [{ type: 'rect', x: 0, y: 0, w: 140, h: 60, style: { fill: { color: '#e5e7eb', alpha: 1 }, radius: 8 } }, { type: 'text', x: 10, y: 14, w: 120, h: 30, text: { content: 'Di dalam group', fontFamily: 'Inter', fontSize: 14, color: '#111827' } }] },
    'Frame': { type: 'frame', x: 0, y: 260, w: 200, h: 100, style: { fill: { color: '#ffffff', alpha: 1 }, radius: 16 }, children: [{ type: 'ellipse', x: 10, y: 10, w: 30, h: 30, style: { fill: { color: '#10b981', alpha: 1 } } }] },
    'Vector (placeholder)': { type: 'vector', x: 220, y: 260, w: 80, h: 80 }
  };
  async function samplePayload() {
    const hash = await C.sha256Hex(Uint8Array.from(atob(PNG), c => c.charCodeAt(0)));
    const els = JSON.parse(JSON.stringify(Object.values(SAMPLES))); els[3].image.hash = hash;
    return { schema: C.SCHEMA, version: C.VERSION, meta: { source: 'moza', docName: 'Sampel', bp: 'd', bounds: { w: 320, h: 360 } }, elements: els, assets: [{ hash, mime: 'image/png', name: 'sampel.png', w: 1, h: 1, bytes: PNG }], lossReport: [] };
  }
  const fig = () => { try { const a = document.getElementById('mz-fc-frame').contentWindow.figcraft; return a && a.execute ? a : null; } catch (_) { return null; } };
  const el = (tag, css, html) => { const n = document.createElement(tag); if (css) n.style.cssText = css; if (html !== undefined) n.innerHTML = html; return n; };
  function fmtLoss(list) { return list.length ? list.map(l => '• [' + l.severity + '] ' + l.path + ' · ' + l.prop + ': ' + l.reason).join('\n') : '(loss report kosong)'; }

  const open = el('button', 'position:fixed;left:8px;bottom:8px;z-index:2147483600;min-height:40px;padding:6px 12px;border-radius:10px;border:1px solid #3a5bf0;background:#3a5bf0;color:#fff;font:600 12px system-ui;cursor:pointer', 'Uji Skema');
  const box = el('div', 'position:fixed;inset:auto 8px 56px 8px;max-height:75dvh;z-index:2147483600;display:none;flex-direction:column;gap:6px;padding:10px;background:#fff;color:#1c2027;border:1px solid #cdd5e4;border-radius:12px;box-shadow:0 10px 40px #0003;font:12px system-ui;overflow:auto');
  const ta = el('textarea', 'width:100%;min-height:110px;font:11px ui-monospace,monospace;border:1px solid #cdd5e4;border-radius:8px;padding:6px', ''); ta.placeholder = 'Tempel JSON schema moza-fc-common v1 di sini…';
  const out = el('pre', 'margin:0;white-space:pre-wrap;word-break:break-word;font:11px ui-monospace,monospace;background:#f4f6fa;border-radius:8px;padding:8px;max-height:30dvh;overflow:auto', 'Siap.');
  const row = el('div', 'display:flex;flex-wrap:wrap;gap:6px');
  const say = t => { out.textContent = t; }; const btn = (label, fn) => { const b = el('button', 'min-height:36px;padding:4px 10px;border:1px solid #cdd5e4;border-radius:8px;background:#f8f9fc;font:600 12px system-ui;cursor:pointer', label); b.addEventListener('click', async () => { try { await fn(); } catch (e) { say('ERROR: ' + (e && e.message || e)); } }); row.appendChild(b); };
  const parse = () => ta.value.trim() ? ta.value : null;

  btn('Isi contoh (semua jenis)', async () => { ta.value = JSON.stringify(await samplePayload(), null, 1); say('Contoh dimuat: teks, rect, ellipse, image, group, frame, vector.'); });
  btn('Validasi', () => { const p = parse(); if (!p) return say('Tempel JSON dulu.'); const r = C.validate(p); say(r.ok ? 'VALID · ' + r.schema.elements.length + ' elemen · ' + r.schema.assets.length + ' aset\n' + fmtLoss(r.loss) : 'DITOLAK\n' + r.errors.join('\n')); });
  btn('Skema → Moza (dry-run)', () => { const p = parse(); if (!p) return say('Tempel JSON dulu.'); const r = C.moza.import(p, { dryRun: true }); say(r.ok ? 'DRY-RUN OK · ' + r.elements.length + ' elemen Moza akan dibuat (tipe: ' + r.elements.map(e => e.type).join(', ') + ')\n' + fmtLoss(r.loss) : 'GAGAL\n' + r.errors.join('\n')); });
  btn('Skema → Moza (sisipkan)', () => { const p = parse(); if (!p) return say('Tempel JSON dulu.'); const r = C.moza.import(p); say(r.ok ? 'DISISIPKAN ' + r.elements.length + ' elemen ke section aktif (Undo Moza berlaku).\n' + fmtLoss(r.loss) : 'GAGAL\n' + r.errors.join('\n')); });
  btn('Moza terpilih → Skema', async () => { const r = await C.moza.export(); if (!r.ok) return say('GAGAL\n' + r.errors.join('\n')); ta.value = JSON.stringify(r.schema, null, 1); say('Diekspor ' + r.schema.elements.length + ' elemen (bp ' + r.schema.meta.bp + ').\n' + fmtLoss(r.loss)); });
  btn('Skema → batch FigCraft (pratinjau)', () => { const p = parse(); if (!p) return say('Tempel JSON dulu.'); const r = C.figcraft.buildBatch(p); say(r.ok ? r.steps.length + ' step command.batch:\n' + r.steps.map((s, i) => i + ' ' + s.command + ' ' + (s.params.type || '') + ' ' + (s.params.name || '')).join('\n') + '\n' + fmtLoss(r.loss) : 'GAGAL\n' + r.errors.join('\n')); });
  btn('Skema → FigCraft (jalankan)', async () => { const a = fig(); if (!a) return say('FigCraft belum terbuka. Buka Design Editor dulu.'); const p = parse(); if (!p) return say('Tempel JSON dulu.'); const r = await C.figcraft.write(a, p); say(r.ok ? 'DIBUAT ' + r.steps + ' step dalam SATU command.batch (satu Undo).\n' + fmtLoss(r.loss) : 'GAGAL\n' + r.errors.join('\n')); if (window.MozaFigCraftBar) window.MozaFigCraftBar.refresh(); });
  btn('FigCraft terpilih → Skema', async () => { const a = fig(); if (!a) return say('FigCraft belum terbuka.'); const r = await C.figcraft.read(a); if (!r.ok) return say('GAGAL\n' + r.errors.join('\n')); ta.value = JSON.stringify(r.schema, null, 1); say('Dibaca ' + r.schema.elements.length + ' elemen.\n' + fmtLoss(r.loss)); });
  btn('Jalankan tes contoh (tiap jenis)', async () => {
    const lines = []; const p = await samplePayload(); const names = Object.keys(SAMPLES);
    for (let i = 0; i < names.length; i++) {
      const one = { ...p, elements: [p.elements[i]] }; const v = C.validate(one); const m = v.ok ? C.moza.import(one, { dryRun: true }) : v; const f = v.ok ? C.figcraft.buildBatch(one) : v;
      lines.push((v.ok && m.ok && f.ok ? '✅' : '❌') + ' ' + names[i] + ' · validasi ' + (v.ok ? 'ok' : 'gagal') + ' · Moza ' + (m.ok ? 'ok' : 'gagal') + ' · batch ' + (f.ok ? f.steps.length + ' step' : 'gagal') + (v.ok ? ' · loss ' + v.loss.length : ''));
    }
    const bad = [['versi 2', { ...p, version: 2 }], ['skema asing', { schema: 'x', version: 1 }], ['mime svg', { ...p, assets: [{ ...p.assets[0], mime: 'image/svg+xml' }] }]];
    bad.forEach(([n, x]) => { const r = C.validate(x); lines.push((n === 'mime svg' ? (r.ok && r.schema.assets.length === 0) : !r.ok) ? '✅ ditolak: ' + n : '❌ tidak ditolak: ' + n); });
    say(lines.join('\n') + '\n\nCatatan: tes ini tidak mengubah dokumen (dry-run/pratinjau). Tes tulis nyata: "Skema → FigCraft (jalankan)".');
  });
  const close = el('button', 'align-self:flex-end;min-height:32px;border:0;background:none;font:600 12px system-ui;cursor:pointer;color:#667085', 'Tutup ✕'); close.addEventListener('click', () => { box.style.display = 'none'; });
  box.append(close, row, ta, out); open.addEventListener('click', () => { box.style.display = box.style.display === 'none' ? 'flex' : 'none'; });
  const mount = () => document.body.append(open, box); if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount);
})(window, document);
