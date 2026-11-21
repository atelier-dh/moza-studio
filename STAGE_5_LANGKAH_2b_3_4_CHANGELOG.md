# Tahap 5 — Langkah 2b, 3, 4: Grup Animasi (State Group), tombol "Jadikan Grup Animasi", tes e2e

Basis: `index.html` dari patch Langkah 2 (yang sudah memuat Stage 4 + Meja Kerja + pencocokan jalur nama).
Hanya `index.html` yang berubah (+ tests). Tidak disentuh: Stage 3 (moza-common-schema.js, actionbar), integrasi FigCraft,
engine Rust, clipboard Moza/FigCraft.

## Koreksi atas Langkah 2 sebelumnya
Patch Langkah 2 hanya berisi pencocokan jalur nama + flag `animGroup`. Bagian "state berurutan berbasis urutan anak"
(pemicu, delay, durasi per transisi) BELUM ada saat itu. Bagian itu baru dikerjakan di patch ini (2b).

## Yang baru
**Grup Animasi (`el.stateGroup`, hanya `type:'group'`, bukan mask).** Anak grup = state berurutan; anak pertama (teratas di
daftar anak) tampil awal. `stateGroup.trans[i]` = transisi dari state i ke i+1: `tr` (click | delay), `delay` (detik),
`anim` (smart | dissolve | instant), `dur` (ms), `ease`. Runtime memakai URUTAN ANAK; tidak ada ID elemen, jadi
copy-paste/duplikat aman.
- Ekspor: grup mendapat `data-sg='[...]'`; tiap state mendapat `data-sgs` dan `data-ag`. Tanpa Grup Animasi, ekspor
  proyek lama identik dengan Langkah 2 di luar skrip runtime.
- Runtime (`sgPrep/sgGo/sgSched/sgInit`, dipanggil dari `armIn`): hanya state pertama tampil; klik pada grup pindah ke state
  berikutnya; trigger delay dihitung SETELAH animasi sebelumnya selesai. Memakai ulang `smart()`/`saCollect` yang sudah ada.
  Pencocokan layer antar state = jalur nama relatif ke akar state, nama kembar dipasangkan berurutan.
- State tersembunyi diperlakukan sebagai tersembunyi oleh `inHiddenSet` (trigger delay di dalam state tersembunyi tidak jalan).

**Langkah 3: tombol "Jadikan Grup Animasi"** (mode Prototype > Inspector > "Animation Group (states)"):
- Pilih 2+ elemen/grup (Shift-klik) lalu klik: dibungkus jadi satu grup induk, urutan state = urutan layer.
- Atau pilih satu grup biasa dengan 2+ anak: anak-anaknya jadi state.
- Default: state 1 → klik → state 2 → delay 0,01 dtk → state 3, Smart animate 600 ms (transisi pertama klik, sisanya delay).
- Inspector menampilkan konfigurasi tiap transisi + tombol "Hapus Grup Animasi". Badge **SG n** di canvas.

## SUDAH dites (Chromium nyata) — `tests/stategroup.test.py`
- Tombol: 3 elemen → satu grup, urutan Closed/Opened/CardOut, default sesuai spesifikasi; satu grup biasa; Hapus; Inspector
  menampilkan konfigurasi dan perubahan durasi tersimpan.
- E2E editor → `siteHTML` → klik di halaman ekspor: awal hanya state 1; klik → state 2; setelah animasi + delay → state 3.
- Nama kembar: dua layer "Dot" dalam satu state dipasangkan berurutan (offset persis (0,-70) dan (0,-140)); layer "Card" yang
  baru muncul fade-in tanpa pasangan palsu.
- Setelah Duplikat elemen (`dupEl`), copy + paste ke section lain, copy/paste section ke halaman lain, copy/paste halaman:
  grup salinan berjalan sendiri (3 state) tanpa wiring ulang; grup lain tidak ikut berubah.
- Hasil paste: konfigurasi identik, nama/urutan anak sama, tidak ada ID bentrok.
- Tanpa Grup Animasi: ekspor tidak memuat data-sg; ekspor proyek lama identik dengan Langkah 2. Tes Langkah 1 dan Langkah 2 lulus.
- Play/Preview memakai `siteHTML` yang sama (dibaca di kode; tidak diuji terpisah di modal Play).

## BELUM dites / batasan
- HP/sentuh sungguhan, Safari/Firefox (tes hanya Chromium desktop). Klik di runtime memakai event `click`.
- Di editor (mode Design/Prototype) ketiga state tampil bertumpuk; pilih state lewat panel Layers. Belum ada pratinjau state per state.
- Delay otomatis hanya aktif untuk grup di halaman dan Switch Content; grup di dalam overlay tidak berjalan otomatis (klik berfungsi, tapi
  state tidak di-reset saat overlay dibuka ulang).
- Grup Animasi bersarang di dalam Grup Animasi lain, state yang berbeda ukuran/posisi akar, dan kinerja banyak elemen.
- Klik pada elemen anak yang punya interaksi sendiri (ia menghentikan propagasi, jadi tidak memicu transisi grup).
- Publish ke server dan Passgate (`mzPgSite`), serta item BELUM dites dari Langkah 1 dan 2.
- Tes Stage 4 (4 berkas) tidak ada di unggahan ini, jadi tidak dijalankan ulang.
- Temuan Langkah 0 (wiring Switch Content putus di `dupEl`/Paste Section/Duplikat Section) TIDAK diperbaiki; Grup Animasi tidak
  memakainya sehingga tidak terpengaruh, tetapi Switch Content lama masih berisiko.

## Atribusi
Aturan pencocokan layer (nama jalur dari akar, nama kembar dipasangkan berurutan) mengikuti `name_path` dan `match_layers` di
FigCraft `crates/ui-egui/src/present/transition.rs`. Per NOTICE/ATTRIBUTION.md, FigCraft berlisensi MIT atau Apache-2.0
(pilih salah satu; dipilih Apache-2.0 untuk atribusi ini). Tidak ada kode Rust yang disalin; hanya algoritmanya yang diimplementasikan ulang di JS.

## Perbaikan tambahan: Play/Preview dari halaman Meja Kerja tampil putih
Penyebab: di Langkah 1 saya ikut mengecualikan Meja Kerja dari Preview/Play (spesifikasi hanya menyebut publish, ekspor, navigasi).
Akibatnya menekan Play/Preview saat berada di halaman Meja Kerja menampilkan halaman publik lain, yang putih jika masih kosong.
Perbaikan: Preview/Play yang dibuka dari halaman Meja Kerja menampilkan halaman itu (`pvPgs`, `WB_INC` di `siteHTML`). Publish dan ekspor tetap
mengecualikan Meja Kerja. Catatan: di jendela Preview itu, halaman Meja Kerja ikut muncul di navigasi/dropdown halaman.
Tes: `tests/play-workbench.test.py` (Play, Preview, ekspor tidak bocor, perilaku dari halaman publik tidak berubah).
Penyebab ini adalah dugaan terkuat yang bisa direproduksi; layar putih karena sebab lain di HP belum bisa dipastikan.
