# Tahap 5 — Langkah 1: Meja Kerja (halaman kerja yang tidak ikut publish)

Status: Langkah 0 (audit) dan Langkah 1 selesai. Langkah 2–4 (Grup Animasi) BELUM dikerjakan.

## Ringkas
Halaman bisa ditandai **Meja Kerja** (`page.workbench = true`). Halaman itu tetap ada di editor
untuk membuat animasi, tetapi tidak ikut publish, ekspor, preview, dan daftar tujuan navigasi.

## File berubah
`index.html` saja (sekitar 46 baris). Tidak diubah: integrasi FigCraft / Stage 3, engine Rust,
clipboard, fungsi inti lain.
- Helper baru `wbPages(doc)` dan `pubPgs()`: daftar halaman tanpa Meja Kerja. Jika SEMUA halaman
  ditandai Meja Kerja, dipakai semua halaman (supaya ekspor tidak crash).
- `siteHTML` (versi dasar): halaman, aturan CSS, nav, judul, dan overlay hanya dari halaman publik.
- Picker tujuan halaman tidak menampilkan Meja Kerja: Link nav (halaman/section), Interaction
  (Navigate to page / Scroll to section / Overlay), halaman awal (Start), halaman preview,
  "Next page" video, "Destination" Environment.
- Panel Pages: badge **Meja Kerja** dan tombol 🛠 untuk menyalakan/mematikan (Undo didukung).
  Menolak jika itu satu-satunya halaman publik atau halaman awal.
- Canvas: garis putus-putus oranye dan pita "MEJA KERJA — tidak ikut publish, ekspor, dan navigasi".

## Audit Langkah 0 (tanpa ubah kode) — ringkasan
Dites di Chromium: nama anak dan Content Set / Initially hidden selalu terbawa. Wiring Switch Content
(`ix.target`) AMAN di paste elemen, paste/duplikat halaman; PUTUS di Duplikat elemen (`dupEl`),
Paste Section, dan Duplikat Section (juga ID anak kembar). Belum diperbaiki (di luar Langkah 1).

## SUDAH dites (runtime nyata, Chromium) — `tests/workbench-flag.test.py`
- Ekspor memuat halaman biasa dan tidak memuat elemen/slug/judul Meja Kerja; data editor tetap utuh.
- Semua halaman Meja Kerja: tidak crash (fallback).
- Panel Pages: badge dan tombol; klik menyalakan dan mematikan flag; menolak satu-satunya halaman publik.
- Canvas: penanda hanya di halaman Meja Kerja (dicek juga lewat tangkapan layar).
- Picker "Navigate to page" tidak memuat Meja Kerja.
- Proyek tanpa fitur baru: ekspor IDENTIK dengan Stage 4 (hash sama, dengan Math.random di-seed).
- Tes Stage 4 (4 berkas) tetap lolos. `tests/audit-copy-paste.test.py`: audit Langkah 0.

## BELUM dites
- Publish ke server dan jalur `mzPgSite` / Passgate (diasumsikan memanggil `siteHTML`, belum diverifikasi).
- Link nav / interaksi LAMA yang sudah menunjuk halaman yang kemudian dijadikan Meja Kerja (tidak diubah otomatis).
- Aset yang hanya dipakai di Meja Kerja mungkin tetap terbawa ke ekspor (belum dicek).
- HP/sentuh (tombol 🛠, pita) dan Safari/Firefox.
