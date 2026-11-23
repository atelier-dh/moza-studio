# Flip & Rotate (rot-r1)

File baru: `moza-flip-rotate.js` — dimuat paling akhir di `index.html` (1 baris `<script>` ditambah setelah `moza-envelope-rig.js`).

## Fitur
- **Flip** di dock (foto, shape, icon; multi-select didukung): dropdown *Flip horizontal* / *Flip vertical* dengan tanda ✓.
- **Rotate** di dock (1 elemen): dial putar + input derajat, tombol −90° / 0° / +90°. Shift = per 15°, Alt = tanpa snap.
- **Badge derajat live** saat menarik handle rotasi di kanvas (snap halus ke kelipatan 45°).

## Perbaikan bug pada elemen ter-flip (sebelumnya)
- Handle resize terbalik (tarik ke kanan malah menyusut) -> sisi handle ditukar sesuai posisi visual.
- Handle rotasi berputar ke arah berlawanan dengan pointer.
- Flip + rotasi: sekarang mirror terjadi di frame lokal elemen, jadi sudut visual selalu sama dengan angka `Rotation`.
  Data lama aman (`flipX`/`flipY`/`rot` tidak berubah format). Output publish ikut dikoreksi (`transform` + `data-sr`).

## Test
`python3 tests/flip-rotate.test.py`

## Catatan
Belum dites di perangkat iOS/Android sungguhan (hanya viewport mobile 390px di Chromium).

---

# Mask foto -> shape (mask-r1)

File baru: `moza-mask-fit.js` (1 baris `<script>` lagi di `index.html`, setelah `moza-flip-rotate.js`). Test: `python3 tests/mask-fit.test.py`

## Masalah
Tombol **Mask** di dock (Ctrl+Alt+M) adalah *clipping group*: layer paling atas jadi cetakan **gaib** (tidak digambar), layer di bawahnya
cuma terlihat di area yang **bertumpuk** dengan cetakan. Foto + shape yang tidak bertumpuk -> hasil kosong/salah.
`outlineOf()` cuma mengenali triangle/star/polygon/path/blob, jadi hati, diamond, hexagon, dll dipotong sebagai KOTAK.
`maskClip()` juga hanya memakai koordinat desktop (tidak peduli layout tablet/mobile).

## Perilaku baru (persis 1 shape + 1 foto yang dipilih)
- Shape punya padanan frame foto (heart, circle, star, diamond, hexagon, ... ) -> foto dimasukkan ke bentuk itu (`image.mask`), shape dihapus.
  Posisi/ukuran/rotasi/flip dan override tablet/mobile ikut tersalin. Bentuk bisa diganti lagi lewat Image > Mask. Undo 1 langkah.
- Tidak ada padanan (cloud, svg, arrow, ...) -> clipping group lama, tapi foto di-fit ke area shape dulu (tidak kosong) + toast penjelasan.
- Kombinasi lain (3+ layer, banyak foto) -> perilaku lama, tidak berubah.

---

# Continuous 3D Curve di mobile (arc3d-r1)

Perubahan langsung di `index.html` (di dalam `carRuntime`, karena fungsi itu di-embed ke HTML Preview/Publish lewat `toString()`).
Test: `python3 tests/arc3d-mobile.test.py`

## Masalah
Preview mobile tampak miring/terdistorsi: CSS `.car.dh-arc3d{perspective:clamp(560px,110vw,1400px)}` memakai lebar *viewport*, jadi
di layar 375px perspektif mentok 560px (desktop ~1400px), sementara kedalaman kartu (`arcDepth` 150px) tidak ikut mengecil.
Hasil: kartu sisi menyusut ~18% + sudut putar terasa ekstrem, hanya ~2,5 kartu terlihat.

## Perbaikan
Di mode `arc3d`, kedalaman (z) dan perspektif diskalakan dengan ukuran kartu (acuan kartu 180px, skala 0.5-1).
Kartu < 180px (mobile / container sempit) -> busur = desktop yang diperkecil secara proporsional.
Kartu >= 180px (desktop) -> TIDAK berubah (perspektif tetap dari CSS, z tetap).
Sudut tilt (`arcTilt`), rise, dan semua properti di Properties tetap berfungsi.

---

# Mask gabungan: 1 foto + banyak shape (mask-r2)

`moza-mask-fit.js` diperluas (cache-buster di `index.html` jadi `mask-r2`). Test: `python3 tests/mask-compound.test.py`

Pilih **1 foto + 2 atau lebih shape** (atau group yang isinya shape) lalu Mask (dock / Ctrl+Alt+M): semua shape digabung jadi satu cetakan,
foto hanya terlihat di dalam shape-shape itu (celah kosong), seperti "Use as mask" Figma dengan beberapa blob.

- Hasil = SATU elemen foto: `mask:'compound'` + `maskPath` (path SVG 0..1 terhadap kotak foto), dirender dengan CSS `mask-image` (SVG) di `.imw`.
  Responsif, bisa di-resize/di-crop, foto bisa diganti, tersimpan di project, ikut ke Preview/Publish. Undo 1 langkah.
- Shape menimpa foto -> foto TIDAK digeser/diskalakan (bagian yang terlihat = bagian foto di bawah shape).
  Shape di luar foto -> foto di-fit (cover) ke kotak gabungan shape.
- Shape didukung: circle/ellipse, rect, rrect, triangle, star, polygon, path (pen), blob, abstract, dan bentuk berpoligon di daftar frame (heart, diamond, hexagon, ...).
  Bentuk lain (mis. cloud/svg) dipakai sebagai kotak + toast pemberitahuan. Rotasi/flip shape dan foto diperhitungkan.
- Batasan: bentuk mask dihitung dari layout desktop; di tablet/mobile ia ikut proporsi kotak foto. Shape tidak bisa diedit lagi setelah digabung (seperti Flatten).
