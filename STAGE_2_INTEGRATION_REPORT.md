# Laporan Hasil Pengerjaan — Moza Studio × FigCraft

**Tahap:** 2 — Integrasi Dasar melalui iframe  
**Paket:** `Moza_Studio_V14_9_6_FigCraft_Stage2_v1.0.1_WASM_OPT_FIX`  
**Status:** Source patch selesai; build dan uji runtime menunggu deployment GitHub Actions.

## 1. Ringkasan hasil

Moza Studio tetap menjadi aplikasi induk dan Web Builder. FigCraft tetap menjadi aplikasi desain terpisah yang menggunakan engine Rust/WebAssembly aslinya. Integrasi dilakukan melalui iframe same-origin di `/figcraft/`, menggunakan host mode bawaan FigCraft (`?host=parent`).

FigCraft tidak dimuat ketika Moza pertama kali dibuka. Iframe baru diberi URL saat pengguna membuka **Design Editor**. Saat kembali ke Moza, iframe disembunyikan tetapi tidak dihancurkan, sehingga state FigCraft yang belum disimpan tetap berada di memori tab sampai halaman di-refresh.

Tidak ada copy-paste lintas-editor pada Tahap 2.

## 2. Perubahan file

### File baru

| File / folder | Fungsi |
|---|---|
| `.github/workflows/build-deploy-figcraft.yml` | Build FigCraft WebAssembly dan deploy situs gabungan ke GitHub Pages |
| `figcraft-source/` | Snapshot source FigCraft yang diperlukan workflow untuk build |
| `moza-figcraft-integration.js` | Lazy iframe, host bridge, storage, dirty guard, focus routing |
| `moza-figcraft-integration.css` | Workspace FigCraft, header, loading indicator, error panel, responsive header |
| `FIGCRAFT_STAGE2_DEPLOYMENT.md` | Panduan GitHub repository, Actions, Pages, MIME, same-origin, storage |
| `STAGE_2_CHANGELOG.md` | Changelog versi Stage 2 |
| `STAGE_2_INTEGRATION_REPORT.md` | Laporan implementasi dan hasil pemeriksaan |

### File Moza yang disentuh

`index.html` hanya mendapat dua referensi tambahan di bagian akhir:

```html
<link rel="stylesheet" href="./moza-figcraft-integration.css?v=stage2-1">
<script src="./moza-figcraft-integration.js?v=stage2-1"></script>
```

Tidak ada bagian internal `index.html` yang ditulis ulang. Perbandingan seluruh entri file Moza dari ZIP asli menunjukkan tidak ada file asli yang hilang atau berubah; satu-satunya perbedaan adalah dua referensi integrasi yang ditambahkan pada akhir `index.html`.

### Source yang dipertahankan

- Definisi dan state `S` Moza tidak diubah.
- Action registry `ACT` Moza tidak diubah.
- Implementasi `store` Moza tidak diubah; integrasi hanya memanggil metode `get`, `set`, dan `del` yang sudah ada.
- Renderer, model elemen, dan clipboard internal Moza tidak diubah.
- Engine Rust/WASM FigCraft tidak diubah. Perbandingan seluruh file dalam `figcraft-source/` dengan ZIP FigCraft asli menunjukkan tidak ada file yang hilang atau berubah (byte-for-byte identik).

## 3. Build dan deployment FigCraft

Workflow melakukan langkah berikut:

1. Checkout repository gabungan.
2. Memasang Rust stable dan target `wasm32-unknown-unknown`.
3. Memasang Binaryen (`wasm-opt`) dan Trunk.
4. Menjalankan `trunk build --release` dari `figcraft-source/apps/figcraft-web`.
5. Mengambil output Trunk dari `figcraft-source/dist/web`.
6. Menyalin hasil build ke folder publik `/figcraft/`.
7. Menyalin contoh `_headers`, `.htaccess`, dan hosting guide FigCraft.
8. Mengunggah situs gabungan dan deploy ke GitHub Pages.

Workflow berjalan saat push ke branch `main` atau saat dipicu manual. Jika repository memakai branch lain, nama branch pada workflow perlu disesuaikan.

### MIME dan GitHub Pages

FigCraft membutuhkan `.wasm` disajikan dengan `Content-Type: application/wasm`. GitHub Pages menggunakan MIME database untuk file statis, tetapi tidak menyediakan custom response header per repository. Karena itu, workflow tidak mengklaim dapat memaksa MIME melalui `_headers` atau `.htaccess` pada GitHub Pages. Sesudah deploy, pengguna tetap perlu memeriksa response `.wasm` di DevTools → Network → Headers.

Pada Cloudflare Pages/Netlify/Apache, file `_headers` atau `.htaccess` yang disertakan dapat digunakan sesuai dukungan host.

### Storage di GitHub Pages

GitHub Pages tidak menyediakan endpoint `/api/kv/` milik backend Moza. Pada domain `github.io`, deteksi server Moza mengarahkan aplikasi ke penyimpanan browser. Karena itu, file FigCraft akan menggunakan IndexedDB melalui `store` Moza, kecuali deployment menggunakan storage provider yang memang sudah dikonfigurasi.

## 4. Design Editor dan lazy loading

- Tombol **Design Editor** ditambahkan pada toolbar Moza.
- Pada menu mobile, tombol yang sama disisipkan ketika menu dibuka.
- Entry point dipasang melalui observer DOM, bukan dengan mengubah `renderTop` atau `ACT`.
- Workspace menggunakan iframe same-origin.
- Atribut `src` iframe baru diisi saat pengguna membuka editor.
- Loading indicator tetap terlihat sampai `figcraft:ready` diterima; `iframe load` saja tidak dianggap sebagai tanda WASM siap.
- Jika FigCraft gagal atau tidak mengirim ready dalam batas waktu, workspace menampilkan pesan error dan opsi retry.
- Tombol kembali menyembunyikan workspace tanpa menghapus iframe atau state Moza.

## 5. Host bridge dan keamanan

Integrasi mengikuti pesan host FigCraft:

| Pesan | Implementasi parent |
|---|---|
| `figcraft:ready` | Memvalidasi versi protokol, mengumumkan kemampuan host, lalu membuka file terakhir bila tersedia |
| `figcraft:open` | Dikirim parent ke FigCraft dengan nama file dan transferred ArrayBuffer |
| `figcraft:save` | Diterima parent; dokumen disimpan terpisah, ekspor non-dokumen diunduh |
| `figcraft:dirty` | Memperbarui status belum tersimpan |
| `figcraft:failed` | Menampilkan pesan kegagalan runtime |

Pesan masuk hanya diterima jika:

- `event.origin === window.location.origin`, dan
- `event.source === iframe.contentWindow`.

Pesan keluar memakai `window.location.origin` sebagai target origin, bukan `*`.

FigCraft source saat ini mengirim save tanpa acknowledgement ID (`post_save(..., None, save_as)`). Karena itu, parent tidak mengirim `figcraft:saved`; parent menyimpan file dan memberi notifikasi jika penyimpanan gagal. Jika save gagal, dirty guard pada sisi parent tetap diaktifkan agar pengguna tidak kehilangan peringatan.

## 6. Penyimpanan file desain

File dokumen `.figcraft` dan `.json` disimpan terpisah dari JSON proyek Moza:

| Key | Isi |
|---|---|
| `figcraft:index:<project-id>` | Daftar metadata file desain |
| `figcraft:last:<project-id>` | ID file terakhir yang dibuka/disimpan |
| `figcraft:file:<project-id>:<file-id>` | Isi file tersendiri, Base64 sebagai value penyimpanan |

Base64 berada pada key tersendiri, bukan pada `atelier:p:<project-id>`. Penyimpanan memanfaatkan `store` Moza yang ada. Setelah refresh, integrasi membaca index dan last-file key, lalu mengirim file terakhir ke FigCraft melalui `figcraft:open`.

File non-dokumen seperti PNG, SVG, PDF, dan format ekspor lain tidak ditambahkan ke daftar dokumen; parent memicu unduhan normal untuk format tersebut.

## 7. Isolasi dan fokus

- FigCraft berjalan dalam browsing context iframe sendiri.
- Saat FigCraft aktif, parent menangkap dan menghentikan shortcut/clipboard event yang berasal dari halaman Moza.
- Keyboard event yang terjadi di dalam iframe tetap berada di browsing context FigCraft.
- Saat kembali ke Moza, workspace disembunyikan, iframe diberi `pointer-events: none`, dan fokus dikembalikan ke pemicu pembukaan.
- Tidak ada perubahan pada listener clipboard internal Moza.

## 8. Pemeriksaan yang benar-benar dilakukan

| Pemeriksaan | Hasil | Catatan |
|---|---|---|
| `node --check moza-figcraft-integration.js` | **Lulus** | Tidak ada syntax error JavaScript |
| Pemeriksaan referensi HTML | **Lulus** | Parser HTML menemukan stylesheet dan script integrasi |
| Parse workflow YAML | **Lulus secara sintaks dasar** | Diparse dengan PyYAML; `actionlint` tidak tersedia di lingkungan ini |
| Diff `index.html` Moza | **Lulus** | Hanya dua referensi file integrasi ditambahkan |
| Pemeriksaan file engine FigCraft | **Lulus** | File host/runtime dan engine/document yang diperiksa identik dengan source ZIP |
| `trunk build --release` | **Belum dijalankan** | `cargo`, `rustc`, dan `trunk` tidak tersedia di lingkungan pengerjaan |
| Browser runtime Moza + iframe | **Belum terverifikasi** | Navigasi browser lokal diblokir oleh kebijakan lingkungan (`ERR_BLOCKED_BY_ADMINISTRATOR`) |
| Deploy GitHub Pages | **Belum dijalankan** | Membutuhkan repository dan izin GitHub pengguna |
| Save/restore `.figcraft` nyata | **Belum terverifikasi** | Memerlukan FigCraft WASM hasil build yang berjalan |
| Desktop / Tablet / HP nyata | **Belum terverifikasi** | Memerlukan pengujian browser dan perangkat target |

Tidak ada klaim bahwa build WebAssembly, deployment, save/restore runtime, atau uji perangkat sudah berhasil.

## 9. Batasan dan risiko tersisa

1. Penyimpanan IndexedDB bersifat lokal per browser/profile. Data tidak otomatis tersinkron antarperangkat jika backend KV tidak dikonfigurasi.
2. Base64 menambah ukuran data sekitar sepertiga dibanding bytes asli dan menggunakan kuota storage browser.
3. FigCraft host mode saat ini tidak menyediakan acknowledgement save ID pada panggilan `post_save` yang digunakan source ini. Parent tetap menampilkan error dan mempertahankan dirty guard jika penyimpanan gagal.
4. Browser harus mendukung WebAssembly SIMD dan WebGPU atau WebGL2.
5. GitHub Pages tidak mengizinkan custom response headers per repository. MIME aktual tetap harus dicek setelah deployment.
6. Pengujian keyboard virtual HP, touch, dan orientasi layar belum dilakukan.

## 10. Checklist pengujian pengguna

- [ ] Moza dibuka normal, tanpa regresi (editor, preview, upload, project linking).
- [ ] Tombol FigCraft membuka editor, loading muncul, tidak blank.
- [ ] FigCraft bisa dipakai di Desktop, Tablet, dan HP.
- [ ] Mengetik teks di FigCraft berfungsi (HP: keyboard layar muncul).
- [ ] Save di FigCraft → file tersimpan di Moza → muncul lagi setelah refresh.
- [ ] Shortcut keyboard tidak bentrok antara dua editor.
- [ ] Kembali ke Moza, proyek Moza tetap utuh.

## 11. Keputusan tahap berikutnya

Tahap 2 selesai pada tingkat source patch dan workflow. Tahap 3 (Shared Element Schema dan copy-paste lintas-editor) belum dimulai. Sebelum Tahap 3, jalankan workflow GitHub Actions, periksa MIME `.wasm`, lalu selesaikan checklist runtime di atas.

## 9. Follow-up fix — GitHub Actions `wasm-opt` failure (v1.0.1)

The user-provided Actions log showed that Rust compilation completed successfully (`Finished web-release profile [optimized]`) and the failure occurred only when Trunk invoked `/usr/bin/wasm-opt`. That system Binaryen executable rejected `--enable-bulk-memory-opt` with `Unknown option`, so the workflow stopped before website assembly and deployment.

**Patch applied:**

- `figcraft-source/apps/figcraft-web/Trunk.toml`: add `[tools] wasm_opt = "version_131"` so Trunk selects/downloads the pinned compatible Binaryen version rather than reusing an older system binary.
- `.github/workflows/build-deploy-figcraft.yml`: pin Trunk to `0.22.1` and remove the `apt-get install binaryen` step that exposed the older system tool.
- FigCraft's `index.html` keeps `data-wasm-opt="z"` and the original WebAssembly feature flags. WASM optimization remains enabled; this patch does not disable optimization or change the Rust/WASM engine.

**Verification:** the workflow and Trunk configuration were inspected and patched locally. The new GitHub Actions build has **not** been run from this environment. The next required verification is a fresh Actions run; expected log should show Trunk selecting/downloading `wasm-opt version_131`, followed by successful Trunk build. Website assembly, Pages deployment, and browser runtime remain unverified until that run completes.
