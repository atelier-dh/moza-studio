# Changelog — Moza Studio × FigCraft Stage 2.1

## v1.0.5 — Steps 2–4 (mobile layout) — patch kecil, tanpa ubah engine Rust / inti Moza

### Step 2 — Layar awal & header FigCraft di HP
- `moza-figcraft-integration.js`: iframe diberi `?control=1`; bila Moza tidak punya dokumen tersimpan, setelah `figcraft:ready` Moza memanggil `window.figcraft.execute('file.new')` (API `?control` bawaan FigCraft) agar layar Recents/Templates tidak tampil. Bila API tidak tersedia, FigCraft tampil normal (tidak error). Dokumen tersimpan tetap dibuka via `figcraft:open` seperti sebelumnya.
- Header workspace: tombol kembali dipindah ke kiri, jadi satu baris kecil di HP (`← Moza` + status kecil + Reload bila perlu), tinggi ±37px. Judul "FigCraft Design Editor" disembunyikan di HP.
- `moza-figcraft-integration.css`: shell memakai `100dvh`; header/stage memakai `env(safe-area-inset-*)`.

### Step 3 — Toolbar atas Moza di HP
- File baru `moza-stage21-mobile-fix.css` (dimuat paling akhir): `#top` bisa digeser horizontal (`overflow-x:auto`, `touch-action:pan-x`), tidak lagi `overflow:hidden`; padding safe-area atas; `html/body/#app` memakai `100dvh`; padding bawah `#rail` memperhitungkan gesture bar.
- Tombol "Design Editor" di HP hanya ikon (✎, 40px); tetap ada di menu ☰. Tombol Cloud tidak lagi disembunyikan di ≤380px.
- Dropdown "Advanced" di HP dibuat `position:fixed` supaya tidak terpotong bar yang bisa di-scroll.
- Perbaikan bug dari kode integrasi: `ensureTopButton()` memakai `top.insertBefore(btn, preview)` padahal di desktop tombol Preview ada di dalam `.v8-actions` → error `NotFoundError` (terdeteksi saat tes desktop). Sekarang memakai `preview.parentNode.insertBefore`.

### Polish UI (permintaan lanjutan)
- Dock alat mengambang di HP (Pilih/Duplikat/Copy/.../Skala/Gambar) bisa digeser sentuh (`touch-action:pan-x`), scrollbar disembunyikan.
- Panel di dalam FigCraft TIDAK diubah: source menunjukkan FigCraft sudah punya mode `narrow` (lebar < 760 px, panel jadi ala HP, `NARROW_WIDTH` di `crates/ui-egui/src/state.rs`). Yang tidak adaptif hanya layar Recents/Templates, dan itu sudah dilewati lewat dokumen kosong otomatis. Belum dites di perangkat nyata.

### Step 4 — Modal Cloud B2 tertutup bar atas (desktop)
- Penyebab (BUKAN dari integrasi FigCraft): `moza-v14.6-canvas-table-editor.js:411` menyuntik `#top{z-index:1200!important}`, sedangkan `#modal` hanya `z-index:150`. Terbukti di tes: tanpa patch, titik tombol Close tertangkap `#top`.
- Perbaikan terpisah di `moza-stage21-mobile-fix.css`: `#modal` z-index 2000, `#pop` 2100, `#tmenu/#gmenu` 2200, `#toast` 2300; `.mbox` `max-height` berbasis `dvh`; hanya `.mbody` yang scroll, `.mhead`/`.mfoot` tetap terlihat. Logika B2 tidak diubah.

### index.html (2 baris)
- Menambah `<link>` ke `moza-stage21-mobile-fix.css` dan menaikkan query versi integrasi ke `stage2-1-v105`.

### Sudah dites (Chromium headless lokal, tanpa build WASM)
- `node --check` JS lulus; tidak ada pageerror di desktop 1440×900 dan HP 390×844.
- Desktop: tombol Design Editor muncul tanpa error; modal tes — Close bisa diklik, body modal scroll; tanpa patch terbukti tertutup `#top`.
- HP 390 & 360: semua tombol toolbar muat; Design Editor ikon saja; `overflow-x:auto` + `touch-action:pan-x` aktif.
- HP 390: header shell FigCraft satu baris (tinggi 37px, tombol 68×30px), tinggi shell = tinggi viewport.

### Belum dites (perlu perangkat nyata / build GitHub)
- Build Rust/WASM + font (Step 1, v1.0.4) dan teks tampil di canvas.
- `file.new` via `window.figcraft.execute` — dari dokumentasi/source, belum dijalankan terhadap WASM asli.
- Geser sentuh toolbar, safe-area notch/gesture bar, dan `dvh` di Android/iOS nyata.
- Modal B2 dengan data cloud asli (tes memakai modal tiruan).

### Batasan yang diketahui
- UI di dalam canvas FigCraft (panel, toolbar egui) tetap layout desktop karena itu bagian engine Rust; tidak diubah. Perbaikan UI di dalam editor = pekerjaan terpisah.

## v1.0.4 — Step 1 diagnostic and deployment-path correction

- Kept the pinned `storytold/craft-fonts` revision and `CRAFT_FONTS_REQUIRED=1` strict web-font build.
- Added `cargo clean -p figcraft-text` before Trunk so a restored pre-font Cargo cache cannot keep an empty font catalog.
- Changed font verification and static assembly to use the absolute Trunk output path under `figcraft-source/dist/web`.
- Added a `figcraft-embedded-fonts` meta marker to the built FigCraft page after the strict font build succeeds.
- Added final-artifact checks to ensure `/figcraft/index.html`, the font marker, `figcraft-fonts.json`, and a non-empty `*_bg.wasm` are present before GitHub Pages upload.
- Fixed licence collection to remain idempotent when a licence file already exists.
- Updated Moza diagnostics to derive the FigCraft URL from the Moza project directory and inspect the actual same-origin iframe document and loaded WASM resource.
- A missing JSON diagnostic manifest is no longer incorrectly treated as proof that embedded fonts are missing when the HTML marker and WASM are valid.
- A GitHub Pages 404 page inside the iframe is detected immediately when `#figcraft_canvas` is absent, instead of leaving the loading spinner until timeout.
- Preserved Trunk `0.22.1` and Binaryen `wasm_opt = "version_131"` from v1.0.1.
- No Rust engine, Moza core state/store/renderer/element model, or internal clipboard changes.

### Not included in v1.0.4

- Mobile initial-screen and FigCraft compact-header changes (Step 2).
- Moza mobile top-toolbar horizontal scrolling and compact Design Editor button (Step 3).
- Cloud B2 modal layering and scrolling fix (Step 4).
- Cross-editor copy/paste.

### Verification

JavaScript syntax, YAML parsing, workflow shell syntax, fixture-based font manifest generation, and fixture-based static-site assembly passed locally. The real Rust/WASM build, GitHub Actions deployment, MIME response, and real-device text rendering remain untested until the patch is committed and deployed.

## Preserved from v1.0.2 / v1.0.3

- Pinned font checkout and strict embedded-font build.
- Clean workflow with no Git merge-conflict markers.
- Trunk `0.22.1` and Binaryen `version_131`.
- Same-origin `/figcraft/` static-site assembly and GitHub Pages deployment.
