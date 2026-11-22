# Envelope Rig — Tahap 1–5 (v1.1.0-s4)

## Perbaikan v1.1.1 — flap yang di-flip / diputar
Gejala: (1) flap yang diberi Flip atau Rotation 180° berjarak dari badan amplop walau satu grup; (2) saat dibuka, flap itu jatuh ke bawah, bukan naik.
Penyebab: rig memakai elemen luar layer sebagai engsel (`transform-origin` di tepi atas flap, aktif terus) dan MENGGANTI `transform` saat membuka.
Moza menyimpan rotasi di `transform:rotate()` dan flip di properti `scale` pada elemen yang sama dengan titik putar di tengah. Hasilnya: flip/rotasi
me-mirror flap terhadap tepi atas (loncat satu tinggi flap ke atas) dan, saat buka, `scale` flip membalik ayunan rotateX.
Perbaikan (`moza-envelope-rig.js`): untuk flap (dan segel mode "ikut flap"/"mengecil") rotasi + flip dicabut dari elemen luar (CSS `[data-rig-mv]`, `!important`)
dan dipasang pada anak pertamanya (`mvFlags` + `moveXform` di wrapper `groupHTML`). Proyek tanpa rig tidak berubah.
Catatan: proyek lama yang flap-nya sudah digeser untuk menutupi lompatan itu akan terlihat bergeser; kembalikan ke posisi semula.
Di editor, preview langsung saat memutar lewat handle baru ter-update setelah lepas mouse untuk layer berperan flap.
Tes: `tests/envelope-rig-flip.test.py`.

Status: Tahap 1–5 selesai dan dites di Chromium. Tahap 6–7 baru dites di level data/DOM, belum di HP sungguhan dan belum lewat UI klip/Project Linking.

## Tambahan v1.1.0 (Tahap 3–4)
- Panel "3 · Setelah terbuka": aksi (tetap / otomatis ke section berikutnya / otomatis ke halaman / gulir turun), jeda, amplop memudar (crossfade) atau tetap, tombol Skip, musik mulai di tap pertama.
- Preset "Seperti video referensi" sekarang: segel ikut flap + zoom + crossfade + otomatis ke section berikutnya.
- Aksi setelah terbuka dan musik HANYA jalan di situs terbit/preview. "Try opening" di editor tidak mengubah hash/scroll.
- Musik: memanggil `#bgm.play()` di dalam gestur tap (jika ada elemen musik situs). Pengatur musik lama tetap berjalan.
- Tes baru: `tests/envelope-rig-stage3-4.test.py`.
- SUDAH dites: aksi section (scroll jalan, amplop opacity 0), aksi halaman (`#/kedua`), Skip (instan), musik dipanggil 1× saat tap dan saat Skip (dengan stub audio), `dupEl` dan `dupSection` membawa rig+peran.
- BELUM dites: musik dengan file audio asli di HP/iOS, Paste Section lewat UI, Project Linking, Undo/Redo manual, Safari/Firefox, HP sungguhan.

## File berubah
- `moza-envelope-rig.js` — BARU (±280 baris). Seluruh fitur ada di sini.
- `index.html` — +3 baris saja, setelah baris 21198 (tag `<script src="./moza-envelope-rig.js?v=rig-s2">`).
- `tests/envelope-rig.test.py` — BARU, tes Chromium.
Tidak diubah: elemen `envelope` lama (`el.env`, `envelopeHTML`, `envelopePanel`), `moza-v14.9-revision.js`,
FigCraft, engine Rust, clipboard, Smart animate / Grup Animasi.

## Cara kerja (patch kecil, bukan tulis ulang)
Envelope Rig = **grup biasa** (Ctrl+G) + `g.rig` (pengaturan) + `anak.rigRole` (peran). Tipe tetap `group`,
jadi copy-paste, paste section, duplikat, ekspor dan Project Linking membawa field itu apa adanya.
Tiga fungsi inti hanya DIBUNGKUS (pola yang sama dengan `moza-v14.9-revision.js`), bukan ditulis ulang:
| Fungsi | Baris di moza-envelope-rig.js | Yang ditambah |
|---|---|---|
| `groupHTML` | ±176 | hanya jika `g.rig.on`: kelas `rig-root`, atribut `data-rig*`, `data-rig-role` di anak |
| `elPanel` | ±231 | panel "✉ Envelope Rig" di Properties grup (di bawah panel lama) |
| `siteHTML` | ±270 | menyisipkan CSS + runtime HANYA jika ada `data-rig="` di hasil |

## Tahap 1 — Peran layer
Properties grup → "✉ Envelope Rig" → **Jadikan Envelope Rig** → pilih peran tiap layer:
body, pocket, flap, seal, card, dekorasi. Semua tetap elemen biasa (geser, resize, ganti gambar/warna/teks).
Urutan lapisan otomatis menurut peran: body < kartu < pocket < flap < seal < dekorasi.

## Tahap 2 — Mesin animasi (CSS 3D; transform/translate/scale/opacity)
- Flap: `rotateX/rotateY` dengan titik putar di tepi engsel; arah naik/turun/kiri/kanan + sudut 10–180°. Flap pindah lapisan ke belakang kartu di tengah putaran lalu memudar.
- Segel: **Ikut flap terangkat** (titik putar dihitung dari posisi flap, seperti video referensi), memudar, mengecil, pecah (getar + hilang), bergeser.
- Kartu: naik keluar (% tinggi kartu) + skala, easing sendiri lewat easing global.
- Zoom kamera halus (skala grup), bayangan statis 0–100, blur ringan opsional khusus segel (0–8 px).
- Durasi, delay antar bagian (stagger), easing, arah. Preset: Klasik, Soft, Dramatis, "Seperti video referensi".
- Tombol **▶ Try opening** dan **↺ Reset** di panel.
- `prefers-reduced-motion`: langsung ke keadaan akhir.
- Pemicu DASAR (agar bisa dites di situs terbit): tap segel / tap di mana saja / otomatis.

## SUDAH dites (Chromium 157, Playwright, desktop + emulasi HP 390×844)
- Modul termuat tanpa error JS; panel muncul untuk grup biasa.
- Tetapkan peran lewat `<select>` → tersimpan di data dan di DOM (`data-rig-role`).
- Preset mengisi parameter; mengubah angka manual → preset jadi "kustom".
- Try opening: nilai terhitung berubah bertahap (flap berputar, z-index berpindah di tengah, flap dan segel memudar); Reset kembali ke `closed`.
- Titik putar segel = tepi flap (cocok dengan koordinat; dicek angkanya).
- Situs terbit: tap di body TIDAK membuka; tap segel membuka; "tap di mana saja" dan "otomatis" membuka; reduced-motion membuka seketika.
- `clone()` grup membawa `rig` dan semua `rigRole` (dasar copy-paste/duplikat).
- Proyek TANPA rig: `siteHTML` identik byte-per-byte dengan index.html sebelum patch (Math.random/Date di-seed).
- Tangkapan layar: tertutup → flap terangkat membawa segel (blur) → kartu terlihat.

## BELUM dites / BELUM dikerjakan
- (Tahap 3–4 sudah ada sejak v1.1.0, lihat bagian Tambahan di atas.)
- Tahap 6: skala otomatis HP sudah mengikuti persen grup, tapi belum diuji di HP sungguhan; Safari/Firefox belum dites.
- Tahap 7: copy-paste section lewat UI, Paste Section, Project Linking, publish ke server/Passgate: baru dicek di level data (`clone`), belum lewat UI aslinya.
- Duplikat elemen/Section: aturan "wiring putus" yang tercatat di audit Stage 5 tidak relevan di sini (rig tidak memakai ID), tapi belum dites lewat UI.
- Undo/Redo: memakai `commit(discrete())` seperti panel lain; belum dites manual.
- Sentuh/HP: Try opening, select peran di panel sempit.
- Blur dan drop-shadow memakai `filter` (bukan transform/opacity) → matikan (0) bila berat di HP lama.
- Efek "pecah" adalah simulasi (getar + skala + hilang), bukan pecahan nyata.

## Checklist tes manual
Desktop
1. Buat 5 layer (body, kartu, pocket, flap, segel) → pilih semua → Ctrl+G.
2. Pilih grup → Properties → Jadikan Envelope Rig → tetapkan peran → Try opening → Reset.
3. Ganti preset (4 buah) dan Arah flap (4 arah); pastikan segel ikut flap saat "Ikut flap terangkat".
4. Ctrl+Z / Ctrl+Shift+Z setelah ganti peran dan preset.
5. Copy-paste grup, duplikat, lalu Paste Section ke halaman lain: peran dan animasi masih ada.
6. Play (preview): tap segel membuka, tap body tidak. Coba pemicu "tap di mana saja" dan "otomatis".
7. Export/publish: buka hasilnya, ulangi nomor 6.
8. Buka proyek lama (envelope lama): tampil dan membuka seperti sebelumnya.
HP
9. Panel Properties: pilihan peran bisa ditekan dan di-scroll, tombol Try/Reset terjangkau.
10. Preview 375px: amplop mengecil mengikuti lebar; animasi halus (tidak patah) di HP.
11. Aktifkan "Kurangi gerakan" di pengaturan HP: amplop langsung terbuka.
