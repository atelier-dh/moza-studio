# Common Element Schema v1 (`moza-fc-common`)

Format tukar elemen antara Moza dan FigCraft. Implementasi: `moza-common-schema.js` (`window.MozaCommon`). Payload selalu divalidasi dan disanitasi (`MozaCommon.validate`) sebelum dipakai.

## Amplop
```json
{ "schema": "moza-fc-common", "version": 1,
  "meta": { "source": "moza|figcraft", "docName": "", "transferId": "", "createdAt": "ISO", "bp": "d|t|m", "bounds": {"w":0,"h":0} },
  "elements": [ Element ], "assets": [ Asset ], "lossReport": [ Loss ] }
```
Versi selain `1` atau `schema` selain `moza-fc-common` **ditolak** (tidak ada konversi diam-diam).

## Element
| Field | Keterangan |
|---|---|
| `id` | id sumber (importer selalu membuat ID baru) |
| `type` | `text` `rect` `ellipse` `image` `group` `frame` `placeholder` |
| `name` | maks 120 karakter |
| `x y w h` | px, **relatif terhadap parent**; elemen puncak dinormalkan ke pojok kiri-atas pilihan (0,0). Dari Moza = geometri efektif breakpoint aktif (`meta.bp`) |
| `rot` | derajat |
| `visible` | boolean |
| `style` | `fill {color:#rrggbb, alpha}`, `stroke {color, alpha, width}`, `radius`, `opacity`. Warna selalu hex nyata (token Moza seperti `tok:ink` sudah diselesaikan) |
| `text` | `content` (teks biasa), `fontFamily`, `fontSize`, `fontWeight` 100–900, `italic`, `align`, `lineHeight` (kelipatan, null = auto), `letterSpacing` (px), `color`, `alpha`, `underline`, `transform` (none/upper/lower/title) |
| `image` | `hash` (SHA-256 hex dari bytes aset), `fit` (cover/contain/fill), `alt` |
| `children` | khusus `group`/`frame` |
| `native` | data asal untuk round-trip: `{editor, type, ...}` (maks 100 KB). **Tidak dipercaya**: hanya key whitelist yang dipakai importer Moza (`link` yang lolos cek skema URL, `fit/px/py/zoom` gambar) |

## Asset
`{hash (sha256 hex), mime (png|jpeg|webp|gif), name, w, h, bytes (base64)}`. SVG ditolak. Maks 8 MB/aset, 40 aset. Aset sama (hash sama) dipakai ulang saat impor.

## Loss report
`[{path, prop, reason, severity: info|warn|error}]`. Semua yang tidak bisa dipertahankan dicatat; tidak ada konversi diam-diam. Loss report ikut di payload dan bertambah di tiap tahap konversi.

## Batas keamanan
JSON ≤ 24 MB · ≤ 500 elemen · kedalaman ≤ 12 · teks ≤ 20.000 karakter · angka dijepit ±1.000.000 · karakter kontrol dibuang · tipe tak dikenal → `placeholder` · gambar tanpa aset valid → `placeholder` · teks selalu dianggap teks biasa (HTML Moza dibersihkan, tidak pernah di-render dari payload).

## Cakupan v1 dan pemetaan
| Moza | Skema | FigCraft |
|---|---|---|
| heading/subtitle/paragraph/caption/link | `text` | TEXT |
| button | `group` [`rect` + `text`] | group (node.create group) + rect + text |
| shape rect/rrect/circle/ellipse, container | `rect` / `ellipse` | RECTANGLE / ELLIPSE |
| image | `image` + asset | `image.place` |
| group | `group` | GROUP |
| (tidak ada) | `frame` | FRAME ↔ Moza group + persegi latar |
| vector, carousel, form, video, countdown, embed, gallery, star/polygon/path/svg, interaksi | `placeholder` + loss | placeholder abu-abu (ukuran sama) |

Tidak dikonversi (masuk loss report): bayangan/efek, gradien (diganti stop 1), rich text per bagian, mask/crop gambar, auto layout, clip, radius per sudut, text case selain upper/lower, interaksi/animasi.

## Aturan adapter
**Moza → skema**: pakai `effG` breakpoint aktif; elemen Moza **tidak diubah** (`el.bp` utuh). **Skema → Moza**: elemen baru dengan ID baru; jika `meta.bp ≠ d`, geometri dasar di-skala `1200/BP[bp]` dan `el.bp[bp]` ditulis hanya pada elemen baru; satu `commit` (satu Undo Moza). **FigCraft → skema**: `document.inspect` (pilihan) + `node.get`; gambar tidak punya jalur baca bytes asli lewat control API, jadi node dirasterisasi (`ui.render ids`) → PNG, dicatat di loss. **Skema → FigCraft**: satu `command.batch` (satu Undo), parent lewat `{"$step": n}`; anak `group` memakai ruang frame induk (offset kumulatif) karena group FigCraft tidak punya ruang koordinat sendiri.

## Font
Daftar font FigCraft dari `text.fonts` (di runtime FigCraft hanya punya sedikit family, mis. Inter). Family tak ada → `Inter` + loss; bobot dipetakan ke style terdekat yang tersedia (mis. 500 → Regular) + loss info.
