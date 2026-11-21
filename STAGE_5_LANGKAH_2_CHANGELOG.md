# Tahap 5 — Langkah 2: Grup Animasi (pasangan anak berdasarkan jalur nama + urutan)

Status: Langkah 0, 1, 2 selesai. Langkah 3–4 BELUM dikerjakan.
Basis: `index.html` dari patch Langkah 1 (sudah memuat Stage 4 + Meja Kerja). Catatan: `index.html` di `moza-studio.zip`
lebih lama dari Stage 4, jadi JANGAN pakai itu sebagai basis. Patch ini hanya mengubah `index.html` (sekitar 25 baris).

## Masalah yang diperbaiki
Smart animate lama memasangkan elemen lewat slug nama layer dengan aturan "yang pertama menang". Dua layer
bernama sama (mis. tiga "Dot") semuanya meminjam posisi "Dot" pertama, dan "Title" di dalam "Card" bisa tertukar
dengan "Title" di dalam "Other".

## Yang berubah
- Properti baru `el.animGroup` (hanya untuk `type:'group'`). Mode Prototype > panel elemen > "Animation Group" >
  centang "Match children by name". Badge **AG** (hijau-tosca) di canvas.
- Ekspor: grup bertanda mendapat atribut `data-ag="1"`. Tanpa flag, HTML ekspor sama persis dengan Langkah 1
  (di luar skrip runtime).
- Runtime (`saKeys`, `saCollect`, `smart`): untuk anak di dalam Grup Animasi, kuncinya adalah jalur nama dari
  bawah grup sampai elemen, digabung dengan karakter 0x1F, ditambah nomor urut kemunculan jalur itu. Nama kembar
  dipasangkan berurutan (ke-1 dengan ke-1, dst.), mengikuti `match_layers` di FigCraft `transition.rs`.
  Anak tanpa pasangan: fade-in (perilaku lama untuk elemen baru). Elemen di luar Grup Animasi: kunci lama, tidak berubah.
- Berlaku di dua jalur smart animate: Switch Content (dalam satu halaman) dan transisi antar halaman.
- Jika grup itu sendiri adalah akar keadaan (elemen yang di-switch), namanya tidak perlu sama di kedua keadaan;
  jika grup bersarang di dalam keadaan, grup dipasangkan lewat slug + urutan, lalu anaknya lewat jalur.
- Anak yang ikut bergerak karena induknya sudah dianimasikan hanya mendapat selisih sisa (bisa 0). Ini disengaja
  dan benar secara visual (tidak bergerak dua kali).

## SUDAH dites (Chromium nyata) — `tests/animgroup.test.py`
- Ekspor: `data-ag` hanya muncul bila flag menyala.
- 3 "Dot" kembar berpasangan berurutan (offset Y -50/-80/-110, X 0); "Dot" ke-4 tanpa pasangan fade-in.
- Card/Other berpasangan lewat nama (-170/+130); Title di dalamnya tidak tertukar.
- Tanpa flag: perilaku lama terbukti sama persis (keempat Dot meminjam Dot pertama) dan tertukarnya Title tereproduksi.
- Panel muncul hanya untuk group; klik checkbox menyalakan flag, Undo mengembalikannya; badge AG tampil.
- Ekspor proyek lama identik dengan Langkah 1 di luar runtime. Tes Langkah 1 (`workbench-flag`) tetap lulus.

## BELUM dites
- Safari/Firefox, HP/sentuh.
- Group bersarang di dalam Grup Animasi lain (kode memakai grup terdekat, belum dites).
- Mask group (anak terakhir adalah mask; belum dites khusus).
- Smart animate antar halaman dengan Grup Animasi (kode sama dengan Switch Content, hanya Switch Content yang dites).
- Dampak kinerja pada halaman dengan ratusan elemen di satu keadaan.
- Publish ke server dan Passgate (`mzPgSite`), serta ketiga item BELUM dites dari Langkah 1.
- Tes Stage 4 (4 berkas) tidak ada di unggahan ini, jadi tidak dijalankan ulang.
