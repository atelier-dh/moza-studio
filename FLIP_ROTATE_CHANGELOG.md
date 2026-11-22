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
