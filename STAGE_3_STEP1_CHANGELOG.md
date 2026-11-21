# Tahap 3 — Langkah 0 + Langkah 1 (bar aksi FigCraft)

## Langkah 0 (prasyarat) — LULUS, sudah diuji di runtime (desktop, Chrome 157, laporan Probe M1.5 v1.1)
- node.set (teks, fill #FF4D6D, ukuran 34): LULUS, diverifikasi node.get.
- command.batch (3 node.create): LULUS; satu edit.undo menghapus ketiganya (satu batch = satu undo).
- Teks tergambar di canvas: LULUS (font Inter tersedia, screenshot sebelum/sesudah berubah 27808 pixel).
- Belum dites: tes sentuh/keyboard layar di HP (tes manual 5-9 berstatus TIDAK VALID di desktop).

## Langkah 1 — Bar aksi (kode selesai, BELUM dites di runtime)
File baru: moza-figcraft-actionbar.js, moza-figcraft-actionbar.css
File berubah: index.html (2 baris: link CSS + script, setelah script integrasi)
Tidak diubah: moza-figcraft-integration.js, engine Rust, clipboard, fungsi inti Moza.

Perilaku:
- Tombol Undo, Redo, Copy, Paste, Duplikat, Hapus -> window.figcraft.execute(edit.undo / edit.redo / edit.copy / edit.paste / edit.duplicate / edit.delete). Satu tap = satu command.
- Status aktif/abu-abu dari document.inspect {depth:0}: Undo/Redo dari history.undo/redo, Copy/Duplikat/Hapus dari selection, Paste dari flag "sudah Copy" (FigCraft tidak membuka status clipboard lewat inspect). Pembaruan lewat event (pointerup/touchend/keyup di iframe, pesan figcraft:dirty/ready, setelah tiap command), debounce 140 ms, tanpa polling.
- Letak: anak terakhir #mz-fc-shell = di bawah canvas. HP/tablet: satu baris, tombol min 44x44 dengan ikon + label, geser horizontal, safe-area bawah, ikut 100dvh. Desktop (mouse): ringkas, ikon saja.
- Tombol sembunyi/tampil (pojok kanan bar); pilihan diingat di localStorage.
- Umpan balik: getar 12 ms (jika didukung), pesan error kecil 2,6 detik.
- Bar berada di luar iframe: tidak mengganggu pinch/2 jari/drag. mousedown di tombol di-preventDefault agar fokus canvas tidak hilang. Ctrl/Cmd+C/V/Z di iframe tidak disentuh.
- Slot Tahap 4: window.MozaFigCraftBar.registerAction({id,label,onClick,enabledWhen}) menambah tombol (mis. "Kirim ke FigCraft", "Ambil dari FigCraft").

Batasan yang diketahui:
- Status Paste memakai flag: setelah Copy lewat tombol atau Ctrl/Cmd+C/X di iframe. Jika clipboard terisi dengan cara lain, Paste tetap abu-abu sampai ada Copy.
- Di layar home FigCraft (belum ada dokumen) semua tombol abu-abu.

## Checklist tes (belum dijalankan)
HP (Android Chrome):
- [ ] Buka Design Editor: bar satu baris di bawah canvas, tidak menutupi canvas, tidak tertutup gesture bar.
- [ ] Buat persegi: Duplikat/Hapus/Copy menyala saat objek dipilih, abu-abu saat tidak.
- [ ] Copy -> Paste membuat salinan; Undo lalu Redo bekerja; Hapus lalu Undo mengembalikan.
- [ ] Pinch/2 jari/drag di canvas tetap normal.
- [ ] Geser bar ke samping saat layar sempit; tombol sembunyi/tampil bekerja.
- [ ] Keyboard layar muncul saat edit teks: bar tidak merusak layout.
Tablet:
- [ ] Portrait dan landscape: bar tetap terlihat, tombol >= 44 px.
Desktop:
- [ ] Bar ringkas (ikon) terlihat; Ctrl+C/V/Z tetap bekerja; Escape tetap kembali ke Moza.
