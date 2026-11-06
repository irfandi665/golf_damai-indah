# Spesifikasi Operasional Staf dan Roadmap

**Project:** Damai Indah Golf  
**Versi:** 1.1  
**Status:** Spesifikasi implementasi bertahap  
**Tujuan:** Mengembangkan operasional booking dan staf tanpa menganggap fitur,
perangkat, kebijakan, atau transaksi yang belum tersedia sebagai sudah aktif.

## 1. Batas sistem dan kondisi saat ini

Website saat ini berfokus pada reservasi tee time, member, loyalty, serta
operasional harian. Fondasi staf yang tersedia:

- Role `starter`, `front_desk`, dan `admin`, dengan akun lama `staff`
  dimigrasikan menjadi `front_desk`.
- Tee sheet dengan pencarian booking, ringkasan kapasitas, check-in manual/QR,
  dan pencatatan ronde selesai.
- Catatan operasional internal dan status kesiapan caddy/buggy untuk layanan
  yang tercantum pada booking. Ini **bukan** inventaris caddy atau pelacakan
  unit buggy.
- Front desk/admin dapat mencatat status `unpaid`, `down_payment`, atau `paid`.
  Ini pencatatan operasional saja; aplikasi tidak menerima pembayaran.
- Admin dapat memblokir slot kosong, mengubah kehadiran secara manual,
  mengelola role, menyetujui usulan kondisi lapangan, serta melihat audit.
- Laporan booking harian dapat difilter dan diekspor sebagai CSV.

Dokumen ini tidak mengasumsikan adanya POS, payment gateway, iuran anggota,
RFID, geolokasi/telemetri buggy, payroll, WebSocket, atau integrasi turnamen.
Fitur tersebut memerlukan keputusan, data model, layanan eksternal, dan
pengujian tersendiri sebelum dijanjikan atau diaktifkan.

## 2. Akses dan keamanan staf

### 2.1 Model autentikasi dan otorisasi

Gunakan autentikasi sesi berbasis cookie yang sudah dipakai aplikasi. Jangan
mengganti ke JWT hanya untuk mengikuti rancangan awal dokumen ini. Setiap
endpoint memeriksa sesi, role, dan CSRF untuk mutasi; pembatasan UI hanya
melengkapi otorisasi server, bukan menggantikannya. Jangan percaya role atau
user ID yang dikirim dari browser.

### 2.2 Matriks izin

| Fitur | Starter | Front desk | Admin |
|---|:---:|:---:|:---:|
| Tee sheet, pencarian, validasi tiket, check-in, penyelesaian ronde | Ya | Ya | Ya |
| Catatan operasional dan kesiapan layanan booking | Ya | Ya | Ya |
| Mengajukan perubahan kondisi lapangan | Ya | Ya | Ya |
| Laporan booking harian dan ekspor CSV | Tidak | Ya | Ya |
| Mencatat status pembayaran manual | Tidak | Ya | Ya |
| Blokir/buka slot tee time | Tidak | Tidak | Ya |
| Override kehadiran | Tidak | Tidak | Ya |
| Menyetujui update kondisi lapangan | Tidak | Tidak | Ya |
| Mengelola role dan melihat audit | Tidak | Tidak | Ya |

Perubahan role hanya dilakukan admin, dicatat di audit, dan admin tidak boleh
mengubah role akunnya sendiri. Jangan membuat role tambahan atau izin
fine-grained baru sebelum kebutuhan operasionalnya disetujui.

## 3. Tee sheet dan reservasi

### Aturan backend

- Database adalah sumber kebenaran untuk kapasitas. Booking aktif dan hold
  harus tetap diperhitungkan secara atomik agar tidak terjadi double-booking.
- Admin hanya boleh memblokir slot tanpa booking atau hold aktif. Jika slot
  sudah terisi, proses pemindahan booking harus dirancang dan disetujui
  terpisah; jangan menghapus atau memindahkan reservasi diam-diam.
- Check-in hanya dapat dilakukan untuk booking aktif pada tanggal tee time
  lokal Asia/Jakarta. Check-in berulang harus ditolak dan perubahan status
  menyimpan timestamp serta aktor.
- Penyelesaian ronde hanya setelah check-in. Proses loyalty yang terkait harus
  idempotent.
- Kebijakan no-show dan penalti belum ditetapkan. Jangan mengaktifkan status,
  denda, atau job no-show sebelum klub menyetujui aturan dan alur sengketa.

### UI operasional

Tee sheet menampilkan waktu, kapasitas, jumlah booking/hold, status slot,
alasan blokir, pemain, dan status kehadiran. Sediakan pencarian berdasarkan
referensi, nama, atau nomor telepon. Tampilkan aksi sesuai role dan status
booking; berikan pesan jelas untuk booking sudah check-in, tanggal berbeda,
slot terisi, atau izin tidak cukup.

Warna/status visual hanya petunjuk dan tidak menggantikan label teks yang
aksesibel. Jangan menyebut data “real-time” kecuali pembaruan langsung
berbasis push benar-benar diimplementasikan; polling atau muat ulang manual
harus diberi label sesuai perilakunya.

## 4. Penugasan caddy dan buggy

### Cakupan yang ada

Untuk caddy atau buggy yang telah dipesan, staf dapat mencatat penanggung
jawab/unit, catatan persiapan, status `pending`/`ready`, waktu perubahan, dan
staf yang mengubahnya. Data ini melekat pada booking dan bukan sumber
ketersediaan unit.

### Pengembangan inventaris — tahap terpisah

Sebelum menerapkan roster FIFO caddy atau papan status armada buggy, tentukan:

1. Identitas unik, kepemilikan, status aktif, dan aturan pergantian shift.
2. Cara staf menetapkan/melepas penugasan dan menangani pembatalan atau
   perubahan tee time.
3. Siapa yang boleh melihat data personal staf dan riwayat performa.
4. Apakah pembaruan dilakukan manual, barcode, atau perangkat lain.

Jangan menjanjikan RFID, barcode otomatis, GPS, status pengisian daya, payroll,
tip, atau pengukuran pace-of-play tanpa perangkat, integrasi, dan persetujuan
kebijakan terkait.

## 5. Pembayaran, kasir, dan POS

Website saat ini tidak memproses uang. Status `unpaid`, `down_payment`, dan
`paid` adalah catatan manual front desk/admin; jangan menyebutnya bukti
settlement, rekonsiliasi kas, atau transaksi terverifikasi.

POS terpadu, keranjang lintas layanan, split billing, invoice grup, refund,
payment link, serta payment gateway tidak termasuk cakupan implementasi ini.
Sebelum merancangnya, klub harus menentukan sumber transaksi resmi, pajak,
diskon, aturan refund, metode pembayaran, pembatalan, rekonsiliasi, serta
kepemilikan integrasi. Jangan membuat draft invoice otomatis dari booking
sebelum kontrak data dan alur akuntansi disepakati.

## 6. Member, loyalty, dan handicap

- Profil, riwayat booking, handicap indikatif, serta ledger loyalty tersedia
  sesuai fitur aplikasi saat ini.
- Poin/cashback ronde diberikan melalui alur penyelesaian booking yang sudah
  ditentukan; jangan mengasumsikan semua pembelian restoran atau pro shop
  menghasilkan poin.
- Handicap yang dihitung aplikasi bersifat indikatif dan tidak boleh disebut
  handicap resmi WHS. Integrasi WHS memerlukan aturan validasi, sumber course
  rating/slope yang terverifikasi, persetujuan, serta pengujian terpisah.
- Iuran bulanan, tunggakan, penagihan otomatis tanggal tertentu, dan payment
  link belum menjadi kemampuan sistem. Tentukan jenis keanggotaan, periode,
  pengecualian, otorisasi penagihan, dan proses koreksi sebelum membangunnya.

## 7. Turnamen dan pelaporan

Pairing turnamen, pendaftaran, master tab, input skor live, leaderboard
WebSocket, dan integrasi tagihan grup merupakan modul baru; tidak boleh
mengubah booking atau ledger member tanpa alur yang disetujui.

Laporan saat ini berfokus pada booking harian dan status operasional. Jangan
menampilkan “pendapatan”, ARPU, tren F&B, atau rekonsiliasi sebelum sumber
transaksi finansial tersedia. Materialized view, target waktu respons, dan
pembaruan real-time harus ditentukan berdasarkan pengukuran beban, bukan
sebagai jaminan tanpa benchmark.

Audit operasional mencatat aksi aktor dan state yang relevan, tetapi jangan
mengklaim log immutable atau deteksi fraud kecuali privilege database,
kebijakan retensi, kontrol akses, dan mekanisme tamper-evidence sudah
diterapkan serta diuji.

## 8. Prioritas implementasi

### Tahap 1 — Operasional booking

Pertahankan/validasi tee sheet harian, pencarian manual, check-in QR/manual,
validasi tanggal dan status, ringkasan kapasitas, serta pembatasan aksi menurut
role. Pastikan API menolak akses yang dilarang meski dipanggil langsung tanpa
UI.

### Tahap 2 — Persiapan layanan dan kontrol kapasitas

Gunakan catatan operasional dan kesiapan layanan yang melekat pada booking.
Blokir hanya slot kosong; audit aktor, waktu, dan alasan. Verifikasi query dan
perilaku konkurensi menggunakan PostgreSQL.

### Tahap 3 — Pelaporan dan tata kelola

Validasi filter/ekspor harian, definisi kolom, perlindungan data pribadi,
audit role/update lapangan, dan prosedur pengelolaan akun. Status pembayaran
harus tetap dilabeli sebagai input manual.

### Tahap berikutnya — Perlu persetujuan dan rancangan tersendiri

Inventaris caddy/buggy, POS/pembayaran, iuran bulanan, no-show, turnamen, WHS,
RFID, notifikasi push, analitik pendapatan, atau integrasi perangkat.

## 9. Kriteria penerimaan sebelum rilis

- Role diuji pada endpoint server: starter ditolak untuk pembayaran/blokir,
  front desk ditolak untuk override/admin, dan hanya admin dapat menyetujui
  update lapangan atau mengubah role.
- Check-in ganda, tanggal yang salah, slot dengan booking/hold, dan request
  bersamaan menghasilkan hasil yang aman serta dapat dipahami staf.
- Catatan dan perubahan kesiapan/kehadiran/pembayaran menyimpan aktor dan
  timestamp yang benar; perubahan penting dapat ditelusuri di audit.
- CSV tidak mengekspor status pembayaran sebagai bukti transaksi dan tidak
  membuka formula injection di spreadsheet.
- Migrasi diuji pada database lokal/test sebelum production; jangan jalankan
  integration test mutatif terhadap database production.
- Kamera memerlukan izin pengguna dan HTTPS atau localhost. Sediakan cara
  pencarian/check-in manual saat kamera atau QR gagal.
- Email, notifikasi, perangkat keras, dan integrasi eksternal diuji terpisah;
  build aplikasi saja bukan bukti pengiriman atau konektivitas perangkat.

## 10. Keputusan bisnis yang masih diperlukan

Sebelum mengaktifkan no-show/penalti, POS, iuran, inventory, atau turnamen,
klub perlu menyetujui aturan bisnis, peran yang bertanggung jawab, alur
pengecualian/koreksi, data yang boleh diakses, dan cara audit. Sampai keputusan
tersebut tersedia, fitur-fitur itu tetap di luar cakupan rilis operasional
booking.

## 11. Waitlist dan pelepasan slot

### Kondisi yang sudah tersedia

Waitlist sudah diimplementasikan; jangan membuat tabel `waiting_lists` baru.
Data tersimpan di `tee_time_waitlist` dan terikat pada satu slot tee time
tertentu, bukan rentang jam. Member terverifikasi dan tamu dapat mendaftar;
email tamu perlu diverifikasi. Satu akun/email tidak dapat memiliki entri aktif
ganda untuk slot yang sama. Front desk/admin dapat melihat nama, kontak,
jumlah pemain, dan status penawaran pada `/staff`; starter hanya melihat
jumlah entri per slot pada tee sheet.

Saat slot tersedia, sistem memilih entri tertua yang jumlah pemainnya muat,
membuat hold sementara 10 menit, lalu mengirim email berisi tautan klaim.
Penawaran bukan booking terkonfirmasi: pemain masih harus mengklaim dan
menyelesaikan booking. Tidak ada pembayaran otomatis. Jika booking dibatalkan,
di-reschedule, atau hold dilepas, aplikasi mencoba menawarkan kapasitas yang
tersedia. Pengiriman email mengikuti status outbox dan dapat tertunda.

### Batasan dan pekerjaan lanjutan

- Waitlist saat ini exact-slot; pencarian berdasarkan rentang waktu seperti
  “06:00–08:00” membutuhkan aturan pemeringkatan, zona waktu, preferensi
  pergantian slot, dan perubahan model/API tersendiri.
- Penawaran dikirim melalui email; panel staf menampilkan entri aktif dan
  status waiting/held. Membuka kembali slot yang tadinya diblokir akan
  mencoba menawarkan kapasitas ke antrean setelah update database selesai.
  Kegagalan email tidak mengubah hold menjadi booking; periksa outbox.
- Panel menampilkan antrean, bukan tombol “Fill” untuk staf. Jangan
  mengonfirmasi booking atau melewati validasi kapasitas, hold, dan klaim
  pemain. Hindari animasi berkedip sebagai satu-satunya indikator; sediakan
  label/status yang aksesibel.
- Tentukan kebijakan antrean untuk kapasitas parsial, masa klaim, email gagal,
  entri yang kedaluwarsa, dan pembatalan tawaran sebelum mengubah aturan yang
  sudah berjalan.

---

## 12. Pace of play dan pencatatan marshal

### Cakupan yang diusulkan

Pencatatan manual checkpoint tersedia pada detail booking setelah check-in,
menggunakan role `starter`, `front_desk`, atau `admin`. Migrasi
`007_staff_waitlist_marshal_requests.sql` menambahkan tabel checkpoint dengan
catatan opsional dan aktor. Satu booking dapat memiliki satu catatan hole 9
dan satu hole 18; timestamp berasal dari server dan setiap pencatatan
tercantum pada audit. Booking mewakili satu flight, bukan catatan per pemain.

### Data dan aturan yang perlu ditentukan

- Catat flight/booking, checkpoint (hole 9 atau 18), waktu kejadian
  dari server, aktor, dan catatan operasional opsional. Cegah duplikasi atau
  koreksi tanpa audit.
- Waktu check-in bukan waktu tee-off dan tidak cukup untuk mengukur durasi
  ronde. Jika ingin membandingkan durasi aktual, catat waktu mulai/tee-off
  yang diamati staf atau gunakan acuan waktu lain yang disetujui.
- Klub harus menetapkan target per checkpoint, variasi course/format, zona
  waktu, toleransi, dan cara menangani keterlambatan yang disebabkan kondisi
  lapangan. Jangan menetapkan contoh durasi seperti 2 jam 15 menit sebagai
  kebijakan produksi tanpa persetujuan.
- Belum ada status `ON_PACE`/`WARNING`/`BEHIND` atau hitung otomatis. Jangan
  otomatis menunda flight lain; keputusan tindakan tetap pada petugas
  berwenang.
- Untuk saat ini tidak ada role `marshal` terpisah; izin memakai role staf
  yang ada. Jika butuh role baru, tentukan akses data, pencatatan/koreksi,
  laporan, migrasi, dan persetujuan tata kelola role.

### UI yang disarankan

Mulai dari tampilan mobile responsif dengan daftar flight hari ini yang
terbatas sesuai izin, kontrol checkpoint berlabel jelas, timestamp server,
dan input catatan opsional. Tampilkan indikator pada tee sheet hanya setelah
aturan perhitungan dan role disepakati. Jangan menyebutnya PWA/offline atau
real-time sebelum dukungan tersebut benar-benar dibuat dan diuji.

---

## 13. Kondisi lapangan terstruktur

Kondisi lapangan saat ini berupa update teks dengan severity, waktu berlaku,
dan persetujuan admin untuk usulan staf. Tabel `course_conditions` dengan
green speed, pin position, aturan buggy, dan aeration belum ada; data tersebut
memerlukan skema dan alur baru.

Sebelum implementasi, tentukan sumber dan definisi tiap nilai, satuan,
cakupan course/hole, siapa yang mencatat dan menyetujui, waktu mulai/berakhir,
serta bagaimana koreksi dan riwayat audit ditangani. Jangan menganggap semua
lapangan memakai kategori pin atau aturan cart yang sama, dan jangan
mewajibkan admin mengisi data tepat pukul 05:00 tanpa kesepakatan operasional.

Banner front desk/starter harus menunjukkan waktu pembaruan dan masa berlaku,
serta membedakan nilai yang belum diisi dari “normal”. Kondisi yang mengubah
akses atau keselamatan bermain perlu mengikuti prosedur publikasi klub; teks
yang belum disetujui tidak boleh ditampilkan sebagai instruksi resmi.

---

## 14. Permintaan layanan khusus booking

Booking kini dapat menyimpan soft-request opsional berupa nama caddy pilihan
dan kebutuhan peralatan. Field `requested_caddy` (maksimum 120 karakter) dan
`rental_needs` (maksimum 300 karakter) disimpan pada booking, divalidasi
server, dan tampil pada detail operasional staf. Permintaan tidak menjamin
ketersediaan atau penugasan inventaris.

Jangan mengumpulkan catatan medis/alergi pada field ini. Informasi tersebut
memerlukan dasar pengumpulan, persetujuan, akses terbatas, retensi, dan
prosedur penghapusan tersendiri. Label UI menyatakan bahwa permintaan tidak
dijamin dan tidak meminta data sensitif.
