# Moza Studio × FigCraft — Probe Perangkat M1.5

## Fungsi

Probe diagnostik khusus pengembangan untuk memeriksa API kontrol FigCraft dan perilaku perangkat tanpa mengubah fungsi inti Moza atau engine FigCraft.

Probe memakai iframe terpisah dengan URL:

`/figcraft/?host=parent&control=1&probe=1&session=...`

Karena iframe diagnostik terpisah, dokumen uji tidak mengganti dokumen FigCraft utama yang mungkin sedang diedit. `file.new`, duplicate, paste, dan delete hanya dijalankan pada dokumen probe yang tidak disimpan ke project Moza.

## Cara mengaktifkan

1. Terapkan isi ZIP patch pada root repository `moza-studio` (timpa `index.html` dan tambahkan dua file probe).
2. Commit ke branch deployment (`main`).
3. Buka situs Moza dengan parameter DEV:

   `https://atelier-dh.github.io/moza-studio/?devprobe=1`

4. Klik tombol kecil **⚙ Probe FigCraft**.
5. Tunggu status **FigCraft probe siap · API kontrol aktif**.
6. Klik **Jalankan tes otomatis**.
7. Pada perangkat nyata, jalankan tes manual di canvas probe dan pilih **Lulus** atau **Gagal** untuk setiap baris.
8. Klik **Salin laporan** lalu tempel hasilnya ke chat.

Jika situs menggunakan URL/path lain, tambahkan `?devprobe=1` pada URL Moza yang aktif.

## Cara menonaktifkan

- Tutup panel dengan tombol **Tutup** untuk menyembunyikannya selama sesi halaman.
- Hapus parameter `devprobe=1` dari URL atau buka situs normal tanpa parameter itu untuk menyembunyikan tombol probe sepenuhnya.

Probe tidak aktif pada URL normal tanpa `devprobe=1`.

## Cakupan tes otomatis

- `figcraft.commands()` dan jumlah engine command.
- Ketersediaan 25 command/API yang diminta.
- Dokumen uji baru, 1 rectangle, 1 text melalui `node.create`.
- `edit.duplicate` → `edit.undo` → `edit.copy` → `edit.paste` → `edit.delete`, diverifikasi dengan `document.inspect`.
- `ui.pointer` shift-select.
- `ui.key` Delete, Enter, Escape.
- `ui.type` dan `text.edit.insert`.
- `ui.render` sebelum/sesudah teks dan perbandingan pixel untuk mendeteksi apakah render dokumen berubah.
- `node.get` dan `document.inspect`.

Catatan API: `figcraft.commands()` berisi engine command. Metode kontrol seperti `ui.pointer`, `ui.key`, `ui.type`, `document.inspect`, dan `node.get` juga diverifikasi lewat `figcraft.request(method, params)` agar tidak dinilai tidak tersedia hanya karena bukan engine command.

## Cakupan tes manual

5. Long-press ≥600 ms dan context menu.
6. Double-tap.
7. Keyboard layar pada field angka.
8. Keyboard layar pada text editing, teks tampil, Backspace, dan prediksi teks.
9. Apakah keyboard menutupi canvas/field yang dibutuhkan.

Probe merekam pointer duration, `contextmenu`, `dblclick`/dua click cepat, focus target, dan perubahan `visualViewport`. Penguji tetap harus menekan **Lulus/Gagal** untuk mengonfirmasi perilaku yang terlihat.

## Informasi perangkat

- User agent
- Device Pixel Ratio
- Viewport dan visual viewport
- Pointer coarse/fine
- WebGPU availability
- WebGL2 availability

## File patch

- `index.html`: menambahkan link CSS dan script probe pada akhir file.
- `moza-figcraft-probe.js`: UI probe, iframe control, tes API, telemetry, report copy.
- `moza-figcraft-probe.css`: layout responsif panel probe.

Tidak ada perubahan pada `S`, `ACT`, `store`, renderer, clipboard, model elemen Moza, atau source Rust/WASM FigCraft.
