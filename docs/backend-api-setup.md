# Menjalankan backend API

## Disclaimer transaksi

Aplikasi ini hanya menangani reservasi tee time, harga booking, dan fitur
member. Semua pembayaran dilakukan langsung di lokasi klub. Tidak ada
checkout, payment gateway, pencatatan metode pembayaran, atau konfirmasi
penerimaan uang melalui aplikasi. Staf menyelesaikan transaksi menggunakan
proses kasir di lokasi.

## Prasyarat

- Node.js 20+
- PostgreSQL 15+
- Redis 7+ untuk menguji rate limit terdistribusi dan penggunaan production

PostgreSQL harus mengizinkan aplikasi menjalankan migrasi serta menggunakan
extension `pgcrypto` dan `citext` (atau extension tersebut sudah diaktifkan
oleh administrator database). Redis lokal dapat berjalan tanpa TLS; production
sebaiknya menggunakan Redis terkelola dengan autentikasi dan TLS.

## Persiapan layanan lokal

1. Buat database kosong bernama `golf` dan user khusus aplikasi dengan izin
   membuat/mengubah tabel pada database tersebut.
2. Jalankan PostgreSQL dan Redis, lalu pastikan koneksi siap:

   ```powershell
   pg_isready -h 127.0.0.1 -p 5432
   redis-cli -u redis://127.0.0.1:6379 ping
   ```

   Redis yang siap akan membalas `PONG`.
3. Salin `.env.example` ke `.env.local`, lalu atur `DATABASE_URL`,
   `REDIS_URL`, `APP_ORIGIN`, `HOLD_IP_HASH_SECRET`, dan
   `QR_SIGNING_SECRET` (diperlukan untuk alur QR/check-in). Untuk email,
   atur `RESEND_API_KEY`, `EMAIL_FROM`, serta `CLUB_CONTACT_EMAIL`. Gunakan
   domain pengirim yang telah diverifikasi Resend untuk production; alamat
   `onboarding@resend.dev` hanya untuk pengujian sesuai batas akun Resend.
   Jangan commit `.env.local` atau menyimpan secret di source control.
4. Jalankan migrasi. Script migrasi dijalankan langsung oleh Node dan tidak
   membaca `.env.local` secara otomatis; isi `DATABASE_URL` ke environment
   PowerShell sebelum menjalankannya:

   ```powershell
   $env:DATABASE_URL = "postgresql://golf_app:password@127.0.0.1:5432/golf"
   $env:DATABASE_SSL = "false"
   npm run db:migrate
   ```

5. Jalankan aplikasi:

   ```powershell
   npm run dev
   ```

   Next.js membaca `.env.local` untuk proses aplikasi. Untuk validasi server:

   ```powershell
   Invoke-RestMethod http://localhost:3000/api/v1/auth/session
   Invoke-RestMethod "http://localhost:3000/api/v1/tee-times?date=2026-11-14&players=2"
   ```

## Menyiapkan tes transaksi

- Untuk tes concurrency booking, siapkan PostgreSQL sungguhan dengan migrasi
  berhasil diterapkan; tes harus memakai koneksi/database khusus test karena
  akan membuat dan mengubah booking, hold, ledger, dan data slot.
- Untuk memvalidasi rate limit bersama antar proses, jalankan Redis dan set
  `REDIS_URL`. Tanpa Redis, development memakai limiter in-memory yang tidak
  cocok untuk menguji perilaku multi-instance/production.
- Gunakan data test terisolasi: course/rate/service seed dari migrasi, tanggal
  tee time mendatang, akun member/staff/admin test, dan slot dengan kapasitas
  yang diketahui. Jangan jalankan tes mutasi terhadap data production.
- Tes utama: dua hold bersamaan untuk kapasitas terakhir, hold kedaluwarsa,
  konversi hold ke booking, retry idempotency, pembatalan, redemption paralel,
  serta earn/cashback setelah ronde selesai.
- Suite integrasi API memakai Node.js built-in test runner.
  `npm run build` tetap tidak membuktikan transaksi database atau rate limit
  Redis; jalankan suite di bawah untuk memvalidasi kedua layanan tersebut.

## Menjalankan tes integrasi API

Tes integrasi membuat member dan booking sementara melalui API lokal, menguji
retry idempotency serta rate limit Redis, lalu menghapus data tes yang dibuat.
Gunakan database `golf` lokal atau database lokal dengan akhiran `_test`, dan
pastikan database tersebut bukan production. Tanggal tee time tes dipilih jauh
di masa depan; slot yang dibuat khusus oleh tes dibersihkan setelahnya.

Di terminal pertama, jalankan server dengan konfigurasi `.env` lokal:

```powershell
npm run dev
```

Di terminal kedua, jalankan:

```powershell
npm run test:integration
```

Suite akan menolak API, PostgreSQL, atau Redis non-lokal. Jika proses dihentikan
paksa, data sementara mungkin tertinggal; gunakan hanya database test dan
hapus akun berawalan `integration-` serta booking tes secara manual sebelum
mengulang pengujian.

Migrasi `002_onsite_payment_only.sql` mengubah booking lama yang masih menunggu
pembayaran menjadi reservasi terkonfirmasi dan menghapus expiry pembayaran.
Untuk menjaga riwayat finansial pada database yang sudah memakai migrasi lama,
tabel pembayaran lama tidak dihapus otomatis; aplikasi yang diperbarui tidak
lagi membaca atau menulis tabel tersebut.

## Batas yang belum siap untuk production

- Implementasikan worker untuk sweep hold expiry, outbox notification,
  tier/voucher expiry, dan no-show.
- Email booking, pembatalan, verifikasi, reset password, dan inquiry memakai
  Resend melalui outbox. Tanpa `RESEND_API_KEY`, pesan tetap antre dan perlu
  dikirim ulang dari panel admin setelah provider dikonfigurasi.
- Verifikasi nomor telepon belum aktif karena provider SMS/OTP belum
  dikonfigurasi. Halaman publik juga menandai alamat, jam buka, kalender acara,
  instruktur, dan detail fasilitas yang belum diverifikasi; inquiry acara dan
  Academy hanya permintaan informasi, bukan pendaftaran/pemesanan terkonfirmasi.
- Tambahkan kebijakan retensi PII, secret rotation, backup/restore test, serta
  observability dan alert operasional.
- Uji integrasi konkurensi dengan PostgreSQL dan Redis sebelum peluncuran.
