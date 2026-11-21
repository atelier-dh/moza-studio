# Moza Studio × FigCraft — Probe Perangkat M1.5 v1.1.0

## Tujuan

Patch ini memperbaiki hasil probe M1.5 v1.0.0. Probe tetap DEV-only dan memakai iframe FigCraft diagnostik yang terpisah dari iframe editor produksi.

Alamat aktivasi:

`https://atelier-dh.github.io/moza-studio/?devprobe=1`

Iframe diagnostik selalu dibuka dengan:

`/figcraft/?host=parent&control=1&probe=1&session=...`

## Instalasi

1. Unduh ZIP patch ini.
2. Ekstrak ke root repository `atelier-dh/moza-studio`.
3. Timpa `index.html`, `moza-figcraft-probe.js`, dan `moza-figcraft-probe.css`.
4. File `M1_5_PROBE_README.md`, `M1_5_PROBE_CHANGELOG.md`, dan `M1_5_PROBE_REPORT.md` hanya dokumentasi.
5. Commit dan push ke branch deployment.
6. Buka URL di atas. Jika browser masih memakai cache, lakukan hard refresh.
7. Klik **Probe FigCraft**, lalu **Jalankan tes otomatis**.
8. Periksa kedua screenshot sebelum/sesudah, panel font, panel asset, dan hasil command.
9. Jalankan tes manual hanya dari HP/tablet layar sentuh. Klik **Salin laporan** untuk menyalin hasil aktual.

## Perbaikan v1.1.0

### 1. Bukti visual teks

- Menggunakan `figcraft.screenshot()` sebelum dan sesudah `ui.type` + `text.edit.insert`.
- Kedua PNG ditampilkan berdampingan di panel.
- Pixel comparison dilakukan terhadap dua screenshot PNG tersebut; tidak lagi bergantung pada `ui.render` atau API `pixelDiff` terpisah.
- Jika screenshot tidak tersedia, tes menampilkan error yang sebenarnya dan tidak mengklaim bukti visual berhasil.

### 2. Diagnostik font dan asset

- Membaca text node melalui `document.inspect`.
- Menampilkan `fontFamily`, `fontStyle`, `fontSize`, dan cuplikan karakter tiap text node.
- Memanggil `text.fonts` untuk memeriksa apakah family/style benar-benar tersedia di font database FigCraft.
- Mengamati request resource iframe melalui Performance Resource Timing dan event error.
- Memeriksa `figcraft/index.html` di situs, membaca referensi script/CSS/WASM/asset, lalu mengecek status HTTP file yang dirujuk.
- Melaporkan file font terpisah bila direferensikan dan request font/asset yang gagal.

Catatan: FigCraft web build meng-embed katalog font ke WASM melalui `CRAFT_FONTS_DIR`. Karena itu, tidak adanya file `.woff`/`.ttf` di folder publik `figcraft/` bukan otomatis kesalahan. `text.fonts` memeriksa face yang tersedia di database engine. GitHub Pages tidak menyediakan directory listing umum, sehingga browser tidak dapat menampilkan seluruh isi folder `figcraft/`; probe memeriksa file yang direferensikan `index.html` dan resource yang benar-benar diminta.

### 3. Eksekusi command nyata

- `node.set` benar-benar mengubah karakter teks, warna fill, dan ukuran font; hasilnya diverifikasi melalui `node.get`.
- `command.batch` benar-benar menjalankan tiga `node.create` dalam satu batch.
- Probe memanggil satu `edit.undo`, lalu memeriksa `document.inspect` untuk memastikan ketiga node hilang bersama. Ini menguji apakah satu batch menjadi satu langkah undo.

### 4. Validitas tes manual

- Jika `(pointer: coarse)` tidak terdeteksi, tes manual 5–9 otomatis berstatus **TIDAK VALID** dan tombol Lulus/Gagal tidak ditampilkan.
- Pada tes 7–9, tombol Lulus dinonaktifkan sampai keyboard layar terdeteksi melalui perubahan `visualViewport.height`.
- Klik Lulus yang dipicu sebelum keyboard terdeteksi tetap ditolak oleh pemeriksaan JavaScript.

### 5. URL laporan

- URL situs kanonis ditampilkan sebagai `https://atelier-dh.github.io/moza-studio/`.
- Parameter `utm_source` dihapus dari URL aktual yang ditampilkan dalam laporan.

## Ruang lingkup / keamanan

- Tidak ada perubahan pada fungsi inti Moza.
- Tidak ada perubahan pada FigCraft engine, model dokumen, renderer, clipboard, atau source Rust/WASM.
- Tidak ada perubahan workflow GitHub Actions atau Trunk.
- Semua command yang mengubah dokumen hanya berjalan pada dokumen uji di iframe probe terpisah.
- Probe tidak aktif tanpa `?devprobe=1`.

## Menonaktifkan

Hapus `?devprobe=1` dari URL. Tombol dan panel probe tidak akan dimuat pada URL normal.
