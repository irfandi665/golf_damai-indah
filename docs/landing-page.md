# Panduan Perbaikan Landing Page

**Project:** Damai Indah Golf  
**Tujuan:** Panduan konten dan UI/UX untuk memperbaiki halaman beranda.  
**Status:** Panduan implementasi landing page; fakta dan materi klub tetap perlu diverifikasi sebelum dipublikasikan.

## 1. Kondisi halaman saat ini

Beranda (`app/page.jsx`) terdiri dari navigasi, hero, kartu course/booking/
member, alur reservasi, status operasional dari update terpublikasi, tautan
inquiry Academy/Events, dan CTA penutup. Copy beranda ditampilkan dalam bahasa
Inggris dan Indonesia secara berpasangan. Hero memakai latar dekoratif CSS
karena asset foto/video lokal belum tersedia; efek gerak menghormati preferensi
reduced motion. Navigasi menyediakan tautan ke course, pricing, events,
Academy, contact, member login, dan booking.

Dokumen ini adalah acuan untuk merapikan konten dan menentukan pengembangan
selanjutnya; jangan menganggap semua bagian yang diusulkan sudah ada di beranda.

## 2. Koreksi penting sebelum implementasi

Gunakan bahasa yang menarik, tetapi jangan menjadikan klaim yang belum
diverifikasi sebagai fakta. Konten publik harus konsisten dengan informasi
yang benar-benar dikonfirmasi klub dan kemampuan aplikasi.

- Jangan menyatakan lapangan dirancang oleh legenda tertentu, memiliki
  signature holes tertentu, berstandar turnamen setiap hari, atau memiliki
  kondisi green/fairway tertentu tanpa konfirmasi resmi.
- Jangan menampilkan cuaca, kondisi lapangan langsung, ketersediaan per slot
  secara real-time, yardage, atau peta hole sebagai fitur yang sudah ada.
  Informasi kondisi operasional tersedia pada halaman course bila ada update
  yang dipublikasikan; same-day weather tetap perlu dikonfirmasi ke klub.
- Jangan menjanjikan instruktur elit, teknologi latihan, restoran fine dining,
  private lounge, locker, club fitting, atau fasilitas/layanan lain sebelum
  klub mengonfirmasi ketersediaan dan detailnya.
- Halaman Events dan Academy menerima **inquiry**, bukan pendaftaran,
  reservasi kelas, RSVP, atau tiket yang sudah dikonfirmasi. Kalender event
  saat ini belum memiliki event yang dipublikasikan.
- Member memiliki fitur loyalty dan handicap indikatif. Hindari menyebut
  cashback sebagai uang tunai atau saldo yang dapat dicairkan; jangan
  menyebut handicap sebagai handicap resmi WHS.
- Booking adalah reservasi. Pembayaran diselesaikan di lokasi klub; aplikasi
  tidak memproses atau memverifikasi pembayaran online.
- Waitlist saat ini berbasis slot tee time tertentu, bukan “priority access”
  tanpa aturan. Jelaskan manfaatnya secara tepat dan jangan menjanjikan urutan
  prioritas selain kebijakan antrean yang berlaku.
- Jangan menambahkan klaim “keanggotaan eksklusif”, manfaat/biaya membership,
  atau CTA “Permohonan Keanggotaan” sebelum proses dan kebijakan membership
  tersedia.

Jika sebuah fakta belum diverifikasi, hilangkan dari copy publik atau tandai
sebagai informasi yang perlu dikonfirmasi; jangan mengisinya dengan teks
promosi yang terdengar meyakinkan.

## 3. Arah visual dan interaksi

- Pertahankan identitas yang sudah dipakai aplikasi: deep emerald (`#0F2A20`),
  aksen gold (`#C9A96E`), dan off-white (`#F6F2EA`). Hindari mengganti palet
  menjadi charcoal/amber yang tidak konsisten dengan halaman lain.
- Pertahankan tipografi heading dan sans-serif body dari design system proyek.
  Gunakan hierarki jelas, baris teks yang nyaman dibaca, dan ruang kosong yang
  cukup.
- Utamakan foto/video course yang resmi dan memiliki izin penggunaan.
  Jangan memakai materi stok seolah-olah menggambarkan fasilitas klub.
- Video harus dekoratif, muted, loop, dan tidak menghalangi konten. Sediakan
  poster/fallback, pertahankan reduced-motion behavior, dan hindari memuat
  media besar yang merusak LCP terutama di perangkat mobile.
- Animasi/parallax bersifat ringan dan opsional. Jangan membuat gerakan sebagai
  satu-satunya cara memahami konten atau status.
- Semua tautan dan tombol harus punya label yang jelas, fokus keyboard yang
  terlihat, kontras memadai, dan target sentuh yang nyaman. Pastikan layout
  berfungsi pada mobile dan desktop.

## 4. Struktur konten yang disarankan

### A. Hero — nilai utama dan aksi booking

Tujuan: dalam beberapa detik pengunjung memahami tempat ini, manfaat utama
booking online, dan langkah berikutnya.

- H1 singkat, spesifik, dan tidak memakai klaim prestise yang belum disetujui.
- Deskripsi dapat menyebut pengguna bisa memilih tanggal/tee time, melihat
  harga dari server, lalu menyelesaikan reservasi secara online.
- CTA utama: **Pesan Tee Time** → `/booking`.
- CTA sekunder: **Jelajahi Course & Fasilitas** → `/course` atau anchor bagian
  fitur yang benar-benar tersedia.
- Bila menggunakan angka seperti “18 holes” atau “Par 72”, pastikan konsisten
  dengan konfigurasi course yang sudah diverifikasi klub.

### B. Ringkasan course dan fasilitas

Tampilkan course/fasilitas yang telah disetujui klub. Untuk saat ini halaman
course menyatakan konfigurasi tee sheet 18-hole, par-72; informasi yardage,
course map, jam operasional, aksesibilitas, dan kondisi harian belum lengkap
atau perlu dikonfirmasi.

Setiap kartu sebaiknya memuat:

- Nama dan deskripsi faktual yang telah disetujui.
- Foto resmi yang sesuai dengan fasilitas yang disebut.
- Tautan menuju detail `/course`.
- Tidak menampilkan fasilitas yang masih belum dikonfirmasi sebagai fasilitas
  pasti.

### C. Cara booking dan manfaat digital

Jelaskan fitur yang benar-benar tersedia, misalnya memilih tee time, melihat
quote server setelah memilih layanan, membuat reservasi, menerima konfirmasi,
dan mengelola booking sesuai aturan. Jika menyebut waitlist, terangkan bahwa
pengguna bergabung untuk slot tertentu, penawaran dapat berupa hold sementara,
dan booking baru terkonfirmasi setelah alur reservasi diselesaikan.

Tambahkan pengingat singkat bahwa pembayaran dilakukan di lokasi klub.
Jangan menjanjikan stok layanan, kondisi cuaca, atau ketersediaan langsung
selain data yang benar-benar disediakan API.

### D. Member, Academy, dan Events

- Member: arahkan ke `/member`; jelaskan benefit hanya sesuai program aktif
  yang disetujui.
- Academy: tautkan ke `/academy` dan sebut formulir sebagai permintaan
  informasi/jadwal, bukan pemesanan pelajaran.
- Events: tautkan ke `/events` dan sebut formulir sebagai inquiry minat, bukan
  pendaftaran/RSVP terkonfirmasi.

Jangan menambahkan carousel promo, “Sunrise Privilege”, turnamen bulanan,
harga khusus, atau kuota sebelum ada data dan persetujuan klub.

### E. Kondisi operasional (opsional)

Jika ingin menampilkan pengumuman kondisi course di beranda, gunakan hanya
update yang sudah dipublikasikan melalui API. Tampilkan waktu/konteks yang
tersedia dan sediakan fallback yang jujur jika tidak ada update. Jangan
mengganti “tidak ada pengumuman” dengan klaim bahwa cuaca atau lapangan pasti
optimal.

### F. CTA penutup

Gunakan CTA yang tersedia dan tidak menyiratkan program baru:

- **Pesan Tee Time** → `/booking`.
- **Masuk / Daftar Member** → `/member`.
- **Hubungi Klub** → `/contact`.

Hindari “Permohonan Keanggotaan” kecuali klub telah menyediakan proses
membership yang terdefinisi.

## 5. SEO, aksesibilitas, dan kualitas

- Gunakan satu H1 yang menjelaskan Damai Indah Golf dan tujuan halaman.
- Pastikan title/description metadata akurat dan tidak mengklaim layanan yang
  belum tersedia.
- Gunakan heading berurutan, alt text untuk foto bermakna, dan alt kosong
  untuk media dekoratif.
- Hormati `prefers-reduced-motion`; sediakan kontrol/fallback bila media
  bergerak mengganggu.
- Ukur performa mobile, ukuran media, layout shift, dan keterbacaan teks di
  atas gambar.
- Uji setiap CTA, navigasi mobile, status fokus keyboard, dan tautan ke rute
  yang benar.

## 6. Kriteria penerimaan sebelum rilis

- Copy promosi telah dikonfirmasi klub; fakta yang belum diverifikasi tidak
  ditampilkan sebagai janji.
- CTA booking, course, member, contact, Academy, dan Events menuju tujuan yang
  benar dan labelnya sesuai dengan hasil yang akan diperoleh.
- Tidak ada klaim pembayaran online, event/kelas terdaftar, cuaca live,
  kondisi course optimal, inventaris layanan, atau benefit membership yang
  belum didukung.
- Layout diuji di mobile dan desktop; navigasi serta CTA dapat digunakan
  dengan keyboard dan screen reader.
- Media hero memiliki fallback yang layak, tidak memutar suara, dan tidak
  memaksa animasi bagi pengguna reduced-motion.
- Build dan tes yang relevan lulus setelah implementasi.

## 7. Referensi implementasi

- Beranda: `app/page.jsx`
- Hero: `components/HeroSection.jsx`
- Kartu fitur: `components/FeatureSection.jsx`
- Navigasi: `components/Navbar.jsx`
- Informasi course/kondisi operasional: `app/course/page.jsx` dan
  `components/public/CourseStatus.jsx`
- Events dan Academy inquiry: `app/events/page.jsx`, `app/academy/page.jsx`
- Batas fitur dan aturan bisnis: `PROJECT_CONTEXT.md` dan `docs/staff.md`
