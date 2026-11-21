# Laporan Pengerjaan — M1.5 Probe Perangkat v1.1.0

## Ringkasan

Patch v1.1.0 menindaklanjuti kekurangan pada laporan probe M1.5 v1.0.0. Perubahan dibatasi pada panel diagnostik DEV, script probe, stylesheet probe, dan cache-buster pada `index.html`.

Probe tetap memakai iframe FigCraft terpisah dengan `?host=parent&control=1`; tidak menjalankan perubahan pada dokumen FigCraft produksi.

## Temuan source yang digunakan untuk perbaikan

1. `apps/figcraft-web/src/api.rs` mendokumentasikan `figcraft.screenshot()` sebagai API screenshot canvas yang mengembalikan PNG base64 melalui properti `data`.
2. `crates/ui-egui/src/control.rs` mendokumentasikan `ui.screenshot` dan `ui.render` sebagai dua metode berbeda. v1.1.0 memakai API publik `figcraft.screenshot()` yang diminta, bukan bergantung pada `ui.render`.
3. `crates/engine/src/cmd/create.rs` mendokumentasikan `node.create` dan parameter `select?`.
4. `crates/mcp/src/tools.rs` mendokumentasikan `node.set` untuk mengubah `characters`, `fill/fills`, dan `fontSize`.
5. `crates/engine/src/batch_undo_snapshot_tests.rs` menguji bahwa `command.batch` mempertahankan satu snapshot undo dan satu `edit.undo` membatalkan keseluruhan batch.
6. `crates/text/src/build.rs` dan `crates/text/src/fontdb.rs` menjelaskan bahwa katalog font web di-embed saat build dan face yang valid masuk ke font database. Karena itu, file font terpisah di folder publik bukan syarat umum.

## Perubahan yang dibuat

### 1. Bukti visual `ui.type` dan `text.edit.insert`

- Screenshot pertama diambil dengan `figcraft.screenshot()` setelah text node siap dan sebelum teks uji dimasukkan.
- Probe menjalankan `text.edit.begin`, `ui.type`, dan `text.edit.insert`.
- Screenshot kedua diambil dengan `figcraft.screenshot()` setelah Escape dan jeda render singkat.
- Dua PNG ditampilkan berdampingan di panel.
- Pixel comparison dihitung dari dua gambar PNG aktual.
- Status tes tidak lagi menganggap ketersediaan `pixelDiff` dari API lain sebagai syarat.

### 2. Diagnostik font

- `document.inspect` mengumpulkan text node pada dokumen probe.
- Setiap node menampilkan ID, font family, font style, font size, dan cuplikan teks.
- `text.fonts` dipanggil tanpa parameter untuk menghitung family dalam database, lalu dipanggil untuk setiap family yang digunakan guna memeriksa daftar style.
- Family yang memiliki style pada database FigCraft ditandai tersedia.
- Family yang tidak memiliki style ditandai tidak tersedia.
- Diagnosis menggabungkan hasil font database, pixel difference screenshot, dan request font yang gagal.

Interpretasi:
- Ada request font 404/network error → kemungkinan path/asset font salah atau file tidak ter-deploy.
- Family tidak ada pada database dan tidak ada 404 font → kemungkinan family tidak masuk manifest/CRAFT_FONTS_DIR build atau tidak tersedia melalui Local Font Access.
- Family tersedia tetapi screenshot hampir tidak berubah → kemungkinan masalah render/update/posisi/visibility atau renderer; screenshot harus diperiksa.
- Pixel berubah dan font tersedia → jalur render teks tampak bekerja.

### 3. Diagnostik request dan isi deployment

- Probe mengamati resource iframe melalui Performance Resource Timing dan event error.
- Probe mengambil `figcraft/index.html` dari alamat situs aktif.
- Semua `script[src]`, `link[href]`, `img[src]`, dan `source[src]` same-origin yang direferensikan oleh index dikumpulkan dan diperiksa status HTTP-nya.
- File font terpisah ditampilkan jika ditemukan pada referensi index atau resource aktual.
- Laporan menampilkan file yang dirujuk index, status HTTP, dan request font/asset yang gagal.

Batasan: GitHub Pages tidak menyediakan directory listing umum. Karena itu probe tidak mengklaim dapat menginventarisasi setiap file di folder `figcraft/`; pemeriksaan dilakukan terhadap file yang direferensikan index dan resource yang benar-benar diminta browser.

### 4. Eksekusi nyata `node.set`

Probe menjalankan `node.set` pada text node dengan perubahan:
- `characters` menjadi `MOZA FIGCRAFT PROBE`;
- `fontSize` menjadi 34;
- `fills` menjadi warna `#FF4D6D`.

Hasil diverifikasi melalui `node.get`. Status LULUS hanya diberikan jika teks, ukuran, dan warna terkonfirmasi dari hasil node.

### 5. Eksekusi nyata `command.batch`

Probe menjalankan tiga perintah `node.create` dalam satu `command.batch`:
- rectangle;
- ellipse;
- text.

`document.inspect` sebelum dan sesudah batch mengidentifikasi node baru. Probe kemudian menjalankan tepat satu `edit.undo` dan memeriksa ulang dokumen. Status LULUS hanya diberikan jika satu undo menghapus ketiga node tersebut.

### 6. Validitas tes manual

- Probe memeriksa `(pointer: coarse)`.
- Jika tidak terdeteksi, tes manual 5–9 ditandai **TIDAK VALID** dan tombol Lulus/Gagal tidak dibuat.
- Tes 7–9 membutuhkan deteksi keyboard layar.
- Deteksi memakai perubahan `visualViewport.height` pada parent dan iframe, dengan baseline sebelum keyboard dibuka.
- Tombol Lulus tes keyboard dinonaktifkan selama keyboard tidak terdeteksi; pemeriksaan saat klik juga menolak status LULUS.

### 7. URL laporan

- URL situs kanonis: `https://atelier-dh.github.io/moza-studio/`.
- URL aktual yang ditampilkan dibersihkan dari parameter `utm_source`.
- URL iframe probe juga dibersihkan dari `utm_source`.

## File berubah

| File | Perubahan |
|---|---|
| `index.html` | Cache-buster probe stylesheet/script diubah ke `m1_5_v11`; integrasi probe tetap DEV-only |
| `moza-figcraft-probe.js` | Screenshot before/after, pixel comparison, font/asset diagnostics, command execution, touch/keyboard gating, URL sanitization |
| `moza-figcraft-probe.css` | Layout dua screenshot, panel font/asset, status TIDAK VALID |
| `M1_5_PROBE_README.md` | Instruksi instalasi dan penggunaan v1.1.0 |
| `M1_5_PROBE_CHANGELOG.md` | Changelog v1.1.0 |

## Sudah dites di lingkungan pengerjaan

- `node --check moza-figcraft-probe.js` lulus.
- Referensi script dan stylesheet pada `index.html` diverifikasi.
- Cache-buster `m1_5_v11` diverifikasi.
- Pemanggilan `figcraft.screenshot()` cocok dengan API yang didokumentasikan source FigCraft pada project yang diperiksa.
- Parameter `node.set` dan format `command.batch` diverifikasi terhadap dokumentasi/source FigCraft yang diperiksa.
- Mekanisme satu undo untuk satu batch didukung oleh tes engine `batch_undo_snapshot_tests.rs`.
- Jalur font embedded dan API `text.fonts` diverifikasi terhadap source FigCraft.
- URL report menghapus `utm_source` dan mencantumkan domain `atelier-dh.github.io`.
- Tidak ada file Rust/WASM, fungsi inti Moza, atau workflow build yang diubah.

## Belum dites (memerlukan deployment dan browser aktual)

- GitHub Actions dan deployment GitHub Pages setelah ZIP diterapkan.
- Apakah `figcraft.screenshot()` berhasil mengembalikan PNG pada runtime situs yang sedang ter-deploy.
- Screenshot before/after dan pixel comparison pada browser aktual.
- Eksekusi runtime `node.set` dan `command.batch` pada FigCraft WASM live.
- Daftar font yang benar-benar tersedia pada deployment pengguna.
- Request 404 aktual dari GitHub Pages.
- Validitas long-press/double-tap pada HP Android.
- Deteksi keyboard layar dan keyboard occlusion pada Android Chrome.

## Build / deployment

Tidak diperlukan build Rust baru untuk patch probe ini karena tidak ada perubahan Rust/WASM. Workflow GitHub Actions, Trunk, Binaryen, dan konfigurasi font tidak diubah. Cukup deploy perubahan `index.html`, JS, dan CSS bersama source proyek yang saat ini digunakan.
