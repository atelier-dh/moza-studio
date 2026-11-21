# Laporan Pengerjaan — Tahap M1.5 Probe Perangkat

## Ringkasan

Membuat panel diagnostik DEV-only pada Moza Studio untuk memeriksa API kontrol FigCraft dan mengumpulkan hasil tes perangkat nyata. Probe menggunakan iframe diagnostik tersendiri, dibuka melalui `?host=parent&control=1`, sehingga tidak mengganti dokumen pada iframe FigCraft produksi.

## File berubah / ditambahkan

1. `index.html`
   - Baris 21096–21098: menambahkan komentar DEV-only, stylesheet probe, dan script probe.
2. `moza-figcraft-probe.js` (file baru)
   - Namespace: `MozaStudio.Diagnostics.FigCraftProbe`.
   - Aktivasi hanya jika URL memiliki `?devprobe=1`.
   - Membuka iframe same-origin `/figcraft/?host=parent&control=1&probe=1&session=...`.
   - Memvalidasi `event.origin` dan `event.source` pada handshake `figcraft:ready`.
   - Menjalankan tes API dan menyusun laporan teks.
3. `moza-figcraft-probe.css` (file baru)
   - Semua selector memakai prefix `mz-fcp-`.
   - Layout desktop dua kolom dan mobile bertumpuk.
   - Menggunakan `100dvh` dan safe-area insets.

## Detail implementasi

### Command inventory
- Memanggil `figcraft.commands()`.
- Menampilkan jumlah command dan status masing-masing 25 identifier yang diminta.
- Membedakan engine commands dari control methods. `ui.pointer`, `ui.key`, `ui.type`, `document.inspect`, dan `node.get` diverifikasi melalui `figcraft.request()`.

### Tes dokumen aman
- `file.new` membuat dokumen khusus di iframe probe.
- `node.create` membuat satu rectangle dan satu text.
- Menjalankan duplicate → undo → copy → paste → delete.
- Memeriksa hasil setiap mutasi melalui `document.inspect`.
- `node.get` membaca node rectangle dan text.

### Input dan render teks
- `ui.pointer` melakukan click dan shift-click pada objek uji.
- `ui.key` mengirim Enter, Escape, dan Delete pada objek uji.
- `text.edit.begin`, `ui.type`, dan `text.edit.insert` memasukkan teks.
- `ui.render` mengambil render sebelum/sesudah input; pixel-diff dipakai sebagai bukti otomatis apakah render dokumen berubah.
- Preview PNG ditampilkan agar penguji dapat memeriksa glyph secara visual.

### Tes manual dan perangkat
- Event listeners pasif/capture pada iframe memantau pointer duration, contextmenu, dblclick/click, focusin, dan visualViewport resize.
- Setiap tes manual memiliki tombol Lulus/Gagal.
- Laporan memuat UA, DPR, viewport, pointer coarse/fine, WebGPU, dan WebGL2.

## Isolasi dan keselamatan

- Tidak menggunakan atau mengubah `S`, `ACT`, `store`, renderer, clipboard, atau model elemen Moza.
- Tidak mengubah file Rust/WASM FigCraft.
- Iframe probe terpisah dari iframe produksi.
- Dokumen probe tidak dikirim ke storage Moza.
- `figcraft:host` hanya dikirim ke iframe probe dengan target origin eksplisit.
- Probe tidak ditampilkan pada URL normal tanpa `?devprobe=1`.

## Sudah dites

- `node --check moza-figcraft-probe.js`: lulus.
- Pemeriksaan referensi script dan stylesheet pada `index.html`: lulus.
- Pemeriksaan bahwa 25 identifier command yang diminta tercantum: lulus.
- Pemeriksaan bahwa URL probe menyetel `host=parent` dan `control=1`: lulus.
- Pemeriksaan scope: tidak ada akses ke `S`, `ACT`, atau `store` pada file probe.
- Struktur ZIP: lulus.

## Belum dites

- Build / deploy GitHub Pages aktual.
- FigCraft WASM berjalan pada iframe probe setelah deployment.
- Eksekusi runtime seluruh API command.
- Hasil pixel-diff teks di browser aktual.
- Long-press, double-tap, keyboard layar, dan keyboard occlusion pada HP/tablet nyata.
- WebGPU/WebGL2 availability pada perangkat pengguna.

Tes-tes tersebut sengaja dijalankan dari panel probe setelah patch di-deploy. Laporan yang disalin dari panel akan menjadi hasil runtime yang sebenarnya, bukan klaim pengujian dari lingkungan pengembangan.
