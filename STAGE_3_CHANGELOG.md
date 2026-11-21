# Tahap 3 — Changelog (Langkah 0, 1, 2, 3)

## Status ringkas
| Langkah | Status | Dites |
|---|---|---|
| 0 Prasyarat | LULUS | runtime (desktop, laporan Probe M1.5 v1.1) |
| 1 Bar aksi | kode selesai | hanya `node --check` — BELUM runtime |
| 2 Schema v1 | selesai | unit test Node (25 lulus) |
| 3 Adapter + panel uji | selesai | unit test Node dengan Moza/FigCraft TIRUAN; BELUM runtime nyata |

## File baru
moza-figcraft-actionbar.js/.css (L1) · moza-common-schema.js (L2+3) · moza-common-devpanel.js (L3, hanya ?devprobe=1) · tests/common-schema.test.js · COMMON_ELEMENT_SCHEMA_V1.md · dokumen ini
## File berubah
index.html — 4 baris tag link/script (setelah script integrasi FigCraft). Tidak diubah: integrasi Stage 2, engine Rust, clipboard Moza/FigCraft, fungsi inti Moza.

## Sudah dites (Node, `node tests/common-schema.test.js`, 25 tes)
Validasi (versi/skema asing, JSON rusak, ukuran, tipe tak dikenal, batas elemen/kedalaman, sanitasi angka/string, aset: mime SVG/hash palsu/base64 rusak, native besar) · parser warna · stripHtml · pemetaan font/bobot · ekspor Moza (token→hex, breakpoint efektif, elemen asal tidak berubah, button→group, vector/carousel→placeholder, gambar→hash SHA-256 + dedup) · impor Moza (ID baru, aset di-merge, bp hanya pada elemen baru, link `javascript:` ditolak, dry-run tidak mengubah dokumen, satu commit) · buildBatch FigCraft (urutan, `$step`, offset group, fallback font, hanya key `command`/`params`) · `figcraft.write` memanggil tepat satu `command.batch` dan tidak memanggil api bila payload buruk · baca node FigCraft (teks, frame, vector placeholder, gambar dirasterisasi) · round-trip Moza→skema→batch.
Dua bug ditemukan dan diperbaiki oleh tes: loss report konversi hilang saat validasi; `figWrite` memanggil api sebelum validasi.

## BELUM dites (perlu browser nyata)
- Bar aksi (L1) di HP/tablet/desktop.
- Ekspor/impor Moza pada dokumen nyata (global `S`, `effG`, render) — env tiruan mengikuti kode Moza tetapi bukan Moza.
- `command.batch` dengan `parent {$step}` pada group/frame, dan `image.place` di runtime FigCraft; apakah `node.create type:"group"` kosong menghasilkan group yang benar (jika tidak, ganti: buat anak lalu `object.group`).
- Nama field `node.get` untuk stroke (`strokes`/`strokeWeight`), image fill (`hash`) dan `text.fonts` pada runtime — dibaca dari source/tes engine, bukan dari run.
- Titik putar rotasi FigCraft vs Moza.

## Checklist tes HP / tablet / desktop (buka `?devprobe=1`)
Panel: tombol **Uji Skema** (kiri-bawah).
1. [ ] "Jalankan tes contoh (tiap jenis)": semua ✅ (HP, tablet, desktop).
2. [ ] "Isi contoh" → "Validasi": VALID, loss report tampil ringkas.
3. [ ] Ubah `"version": 2` → "Validasi": DITOLAK.
4. [ ] Moza: pilih 1 teks + 1 shape + 1 gambar → "Moza terpilih → Skema": hex warna nyata, loss tampil.
5. [ ] "Skema → Moza (sisipkan)": elemen baru muncul di section aktif; Undo Moza menghapusnya; elemen lama tak berubah. Ulangi di breakpoint Mobile (cek `el.bp` elemen lama utuh).
6. [ ] Buka Design Editor → "Skema → FigCraft (jalankan)": objek muncul di canvas; **satu** Undo (tombol bar) menghapus semuanya; teks tergambar.
7. [ ] Di FigCraft pilih objek → "FigCraft terpilih → Skema" → "Skema → Moza (sisipkan)".
8. [ ] Elemen vector/carousel/form → jadi placeholder + masuk loss report (tidak diam-diam).
9. [ ] Tablet portrait/landscape: panel dan bar aksi tidak menutupi canvas.
