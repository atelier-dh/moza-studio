# Changelog — M1.5 Probe Perangkat

## v1.0.0 — 2026-11-21

### Added
- Tombol DEV-only `Probe FigCraft`, hanya tampil dengan `?devprobe=1`.
- Panel diagnostik dengan iframe FigCraft terpisah.
- Iframe probe dibuka dengan `?host=parent&control=1` (plus penanda `probe=1` dan session unik).
- Same-origin dan `event.source` validation untuk handshake `figcraft:ready`.
- Pengecekan daftar engine command lewat `figcraft.commands()`.
- Pengecekan metode kontrol lewat `figcraft.request()`.
- Tes dokumen baru: rectangle dan text, duplicate, undo, copy, paste, delete.
- Verifikasi perubahan dokumen melalui `document.inspect`.
- Tes multi-select `ui.pointer` dengan `shift: true`.
- Tes `ui.key` Delete, Enter, Escape.
- Tes `ui.type` dan `text.edit.insert`, termasuk render PNG sebelum/sesudah teks dan pixel-diff.
- Telemetri long-press, context menu event, double-click, focus target, dan soft keyboard via `visualViewport`.
- Informasi user agent, DPR, viewport, pointer coarse/fine, WebGPU, WebGL2.
- Tombol Lulus/Gagal untuk tes manual dan tombol Salin laporan teks.

### Safety / scope
- Tes dijalankan pada iframe FigCraft kedua yang terisolasi, bukan iframe produksi.
- Dokumen uji tidak disimpan ke project Moza.
- Tidak mengubah engine FigCraft/Rust/WASM.
- Tidak mengubah fungsi inti Moza, store, renderer, clipboard, atau model elemen.
- Probe sepenuhnya tidak aktif tanpa query `?devprobe=1`.

### Changed files
- `index.html` — tambahan 3 baris di akhir file (baris 21096–21098).
- `moza-figcraft-probe.js` — file baru.
- `moza-figcraft-probe.css` — file baru.

### Validation
- JavaScript syntax check: passed with `node --check`.
- Patch ZIP integrity: passed.
- Runtime build/deploy and real-device tests: not run in this environment; require GitHub Pages and target devices.
