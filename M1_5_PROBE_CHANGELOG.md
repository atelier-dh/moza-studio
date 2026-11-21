# Changelog — M1.5 FigCraft Device Probe

## v1.1.0 — 2026-11-21

### Fixed
- Mengganti bukti teks dari `ui.render` ke `figcraft.screenshot()`.
- Mengambil dan menampilkan screenshot sebelum dan sesudah teks dimasukkan.
- Menghitung perubahan pixel dari kedua PNG screenshot.
- Memperbaiki status tes manual agar tidak bisa dinyatakan lulus di perangkat non-touch.
- Mengunci tombol Lulus untuk tes keyboard sampai `visualViewport.height` menunjukkan keyboard layar.
- Menghapus `utm_source` dari URL yang ditampilkan dalam laporan.
- Menggunakan alamat situs kanonis `https://atelier-dh.github.io/moza-studio/`.

### Added
- Diagnostik font per text node menggunakan `document.inspect` dan `text.fonts`.
- Diagnostik request font/asset gagal melalui Performance Resource Timing dan event error.
- Pemeriksaan file yang dirujuk `figcraft/index.html` beserta status HTTP-nya.
- Diagnosis ringkas untuk membedakan font tidak tersedia, asset font 404, dan kemungkinan masalah renderer.
- Eksekusi nyata `node.set` untuk mengubah teks, fill, dan font size; verifikasi melalui `node.get`.
- Eksekusi `command.batch` dengan tiga `node.create`; satu `edit.undo` harus menghapus ketiganya.
- Cache-buster script/style probe diperbarui menjadi `m1_5_v11`.

### Unchanged
- Moza core, store, ACT/S, renderer, clipboard, document model.
- FigCraft Rust/WASM engine.
- GitHub Actions workflow dan konfigurasi Trunk.
- Iframe FigCraft produksi; probe tetap memakai iframe terpisah dengan `?host=parent&control=1`.

### Files in patch
- `index.html`
- `moza-figcraft-probe.js`
- `moza-figcraft-probe.css`
- `M1_5_PROBE_README.md`
- `M1_5_PROBE_CHANGELOG.md`
- `M1_5_PROBE_REPORT.md`
