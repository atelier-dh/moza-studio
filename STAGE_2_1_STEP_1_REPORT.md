# Tahap 2.1 — Laporan Perbaikan Langkah 1: Font dan pemuatan FigCraft

## Status

**Patch source v1.0.4 selesai.** Langkah 1 masih menunggu build GitHub Actions dan tes perangkat nyata. Sesuai aturan kerja, Langkah 2–4 belum diubah.

## Diagnosis dari source dan screenshot

1. `figcraft-source/packaging/web/README.md` menyatakan web build menggambar teks dengan font yang disertakan saat build. Font web ditanam ke dalam WebAssembly, bukan dipublikasikan sebagai file `.ttf`/`.otf` terpisah.
2. `figcraft-source/crates/text/build.rs` membaca `CRAFT_FONTS_DIR`. Jika variabel ini tidak tersedia, katalog font dapat kosong dan build biasa tetap dapat berjalan. Dengan `CRAFT_FONTS_REQUIRED=1`, build wajib memiliki Inter Regular, Inter SemiBold, Noto Sans Georgian Regular, dan Noto Sans Arabic Regular.
3. `figcraft-source/crates/text/src/fontdb.rs` memuat `CRAFT_FONTS` ke database font. `crates/ui-egui/src/theme.rs::install_fonts()` juga menggunakan katalog ini untuk memasang font UI. Karena itu, font harus benar-benar tersedia ketika target WASM dikompilasi.
4. Screenshot terakhir memperlihatkan pesan `figcraft-fonts.json` HTTP 404. Itu membuktikan file manifest diagnostik tidak ditemukan pada URL yang diminta, tetapi **tidak membuktikan font tertanam di WASM hilang**. Manifest JSON bukan payload font; payload font berada di file `*_bg.wasm`.
5. Kode integrasi sebelumnya menghitung lokasi manifest dari `document.baseURI` dan langsung menganggap 404 manifest sebagai kegagalan font. Ini terlalu rapuh dan menghasilkan peringatan yang bisa menyesatkan. Selain itu, iframe `load` tidak membedakan halaman FigCraft yang benar dari halaman 404 GitHub Pages, sehingga pengguna dapat melihat spinner sampai timeout.

Kesimpulan: workflow harus memastikan font wajib tertanam pada saat build, sedangkan diagnostik runtime harus memeriksa dokumen FigCraft dan file WASM aktual. Pemeriksaan manifest JSON hanya boleh menjadi fallback, bukan satu-satunya sumber kebenaran.

## Perubahan v1.0.4

### 1. `.github/workflows/build-deploy-figcraft.yml`

- Tetap checkout `storytold/craft-fonts` pada revision `37827adc41fd165f9a9234ac40f94dbad353aa69`.
- Tetap set `CRAFT_FONTS_DIR` dan `CRAFT_FONTS_REQUIRED=1`; build gagal jika required faces tidak tersedia.
- Menggunakan path absolut `$GITHUB_WORKSPACE/figcraft-source/dist/web` untuk verifikasi output Trunk, menghindari ketergantungan pada working directory step.
- Membuat `figcraft-fonts.json` dan menyisipkan marker `<meta name="figcraft-embedded-fonts">` ke `dist/web/index.html` setelah build sukses. Marker hanya ditulis setelah build strict font berhasil.
- Memastikan file manifest, marker HTML, dan file `*_bg.wasm` benar-benar ada dan tidak kosong di folder hasil assembly final `$SITE/figcraft/` sebelum artifact diunggah ke GitHub Pages.
- Membuat pengumpulan nama lisensi idempotent agar file lisensi yang sudah ada tidak menyebabkan false failure.

### 2. `moza-figcraft-integration.js`

- Menentukan URL `/figcraft/` dari direktori proyek Moza saat ini, bukan dari `document.baseURI` yang dapat dipengaruhi elemen `<base>`.
- Menjalankan diagnostik setelah iframe selesai memuat.
- Memeriksa apakah dokumen iframe benar-benar memiliki `#figcraft_canvas`. Jika GitHub Pages mengembalikan halaman 404, Moza langsung menampilkan error yang menyebut URL iframe, bukan menunggu spinner selama 180 detik.
- Memeriksa marker font dari dokumen iframe same-origin.
- Memeriksa request resource `*_bg.wasm` yang benar-benar dimuat oleh iframe, lalu memverifikasi HTTP status dan MIME `application/wasm`.
- Tetap mendukung `figcraft-fonts.json` sebagai fallback untuk build sebelumnya, tetapi 404 manifest tidak lagi otomatis dianggap sebagai 404 font jika marker dan WASM aktual sudah valid.
- Tidak mengubah host protocol, penyimpanan, command engine, atau model data.

### 3. Konfigurasi build yang dipertahankan

- Trunk `0.22.1`.
- `figcraft-source/apps/figcraft-web/Trunk.toml`: `wasm_opt = "version_131"`.
- FigCraft tetap dibangun melalui `trunk build --release`.
- Font tetap embedded di WASM; tidak ada file font terpisah yang harus disalin ke `/figcraft/`.

## File yang berubah

1. `.github/workflows/build-deploy-figcraft.yml`
2. `moza-figcraft-integration.js`
3. `STAGE_2_1_STEP_1_REPORT.md`
4. `STAGE_2_1_CHANGELOG.md`
5. `FIGCRAFT_STAGE2_DEPLOYMENT.md`

`Trunk.toml` disertakan dalam paket lengkap dan tetap mempertahankan pin `version_131`, tetapi tidak diubah pada v1.0.4. Tidak ada perubahan pada source Rust FigCraft atau fungsi inti Moza.

## Pengujian

### Sudah dites secara lokal

- `node --check moza-figcraft-integration.js` — lulus.
- Parse YAML workflow — lulus.
- `bash -n` pada script `run:` yang diekstrak dari workflow — lulus.
- Pemeriksaan tidak ada merge-conflict marker — lulus.
- Pemeriksaan pin Trunk `0.22.1` dan Binaryen `version_131` — lulus.
- Pemeriksaan workflow memuat `cargo clean -p figcraft-text` sebelum build — lulus.
- Simulasi step verifikasi font dengan fixture manifest/font/license dan file WASM dummy — lulus.
- Simulasi assembly website — lulus; `index.html` dengan marker, `figcraft-fonts.json`, dan file WASM berada di `/figcraft/` pada artifact simulasi.
- Pemeriksaan integritas ZIP — lulus.

### Belum dites / perlu tes pengguna

- Checkout revision `craft-fonts` sesungguhnya pada GitHub Actions.
- Kompilasi Rust/WASM nyata dengan font sebenarnya.
- Ukuran dan isi WASM hasil build nyata.
- Deployment GitHub Pages dan response MIME aktual.
- Teks tampil di canvas FigCraft pada browser/perangkat nyata.
- Uji error 404 pada URL iframe dan WASM melalui GitHub Pages.

Tidak ada klaim bahwa build/deployment GitHub atau tes perangkat nyata telah berhasil pada patch ini.

## Langkah pengguna berikutnya

1. Terapkan patch v1.0.4 pada repository dengan struktur path yang sama.
2. Commit ke branch `main` dan tunggu workflow.
3. Pastikan step `Build FigCraft WebAssembly application`, `Verify embedded fonts and write diagnostic manifest`, dan `Assemble same-origin static website` semuanya berhasil.
4. Buka `https://atelier-dh.github.io/moza-studio/figcraft/` dan pastikan halaman FigCraft memuat canvas.
5. Dari Moza, buat text layer dan pastikan teks terlihat di canvas.

**STOP di akhir Langkah 1.** Langkah 2 (layar awal/header FigCraft di HP), Langkah 3 (toolbar Moza HP), dan Langkah 4 (modal Cloud B2) belum dikerjakan.
