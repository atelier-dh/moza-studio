Moza Studio V14.8.17 — patch terarah dari V14.8.16 (tidak ada fitur dihapus)

A. Preview link biasa: anchor berlink proyek mendapat data-moza-project/page/section (HANYA di Preview,
   export tidak membawa atribut). Klik di Preview navigasi via ID seperti Smart Filter. Link tak dikenal
   diblokir + notice "Link tujuan tidak dikenali: <href>"; link eksternal dibuka di tab baru.
   Perbaikan: bare index.html tidak lagi cocok dengan */index.html; prefix path /repo/index.html.
B. Smart Filter: grup gaya "Small label (card)" dan "Categories / filter" terpisah (font, ukuran, weight,
   warna, huruf kapital, letter-spacing, + gaya tombol aktif), per Desktop/Tablet/Mobile, sparse (proyek lama identik).
C. Skala per perangkat: 0.9/0.8/0.75/0.6/0.5/0.3, 1x, Otomatis, input bebas (scaleD/T/M). Otomatis kini
   memakai LEBAR WIDGET NYATA / lebar desktop (ResizeObserver). Batas keterbacaan (isi>=10px, judul>=12px,
   tidak pernah menaikkan ukuran asli), kolom turun otomatis jika sempit, pengaman overflow, border ikut skala.
   Opsi "skalakan tinggi kotak" + lebar kotak tidak melebihi kanvas perangkat. Semua draft sampai UPLOAD.
Cache key: moza-cross-project.js?v=14_8_17, moza-visual-filter.js?v=14_8_17
Tahap lanjutan (belum): preset skala untuk elemen/grup kanvas lain di Responsive Sync.

V14.8.18 (hotfix): keputusan skala Otomatis dan jumlah kolom widget Smart Filter kini memakai window.innerWidth
dan mengabaikan lebar scrollbar (anti-getar saat scrollbar muncul/hilang). Cache key moza-visual-filter.js?v=14_8_18.

V14.8.19: lencana diagnostik widget Smart Filter. Klik di dalam widget lalu tekan Shift+D untuk menampilkan
lebar nyata iframe, lebar scrollbar, perangkat terdeteksi, skala, kolom, tinggi isi vs kotak. Shift+D lagi menyembunyikan.
Cache key moza-visual-filter.js?v=14_8_19
