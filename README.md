# Damai Indah Golf

Website reservasi tee time dan portal member berbasis Next.js. Panduan ini
menjelaskan cara menyiapkan project di komputer lokal untuk pengembangan dan
pengujian.

> **Pembayaran:** website hanya membuat reservasi. Semua pembayaran dilakukan
> langsung di lokasi klub; aplikasi tidak memproses atau mengonfirmasi
> pembayaran online.

## Prasyarat

Pasang dan jalankan layanan berikut sebelum memulai:

- **Node.js 20 atau lebih baru** (termasuk npm).
- **PostgreSQL 15 atau lebih baru** (wajib untuk API dan data aplikasi).
- **Redis 7 atau lebih baru** untuk rate limit bersama, penggunaan production,
  dan pengujian integrasi. Development dapat berjalan dengan limiter
  in-memory, tetapi itu tidak cocok untuk beberapa instance.
- **Git**, jika mengambil source code dari repository.

Pastikan executable `node`, `npm`, `psql`, dan `redis-cli` dapat dijalankan
dari terminal. PostgreSQL harus berjalan saat aplikasi digunakan. Jalankan
Redis juga jika ingin memakai rate limit terdistribusi atau menjalankan tes
integrasi.

## 1. Dapatkan source code

Jika project berada di Git:

```bash
git clone <URL-REPOSITORY>
cd golf
```

Jika sudah menerima folder project, buka terminal pada folder tersebut.

## 2. Pasang package

```bash
npm install
```

## 3. Siapkan PostgreSQL dan Redis

Buat database kosong bernama `golf` menggunakan user PostgreSQL lokal Anda.
Contoh jika PostgreSQL terpasang dengan user administrator `postgres`:

```bash
psql -U postgres -h 127.0.0.1 -c "CREATE DATABASE golf;"
```

Jika database sudah ada, jangan jalankan perintah `CREATE DATABASE` lagi.
User aplikasi harus dapat membuat tabel dan extension `pgcrypto` serta
`citext`; migrasi akan mengaktifkan extension tersebut.

Jalankan Redis pada port `6379`. Verifikasi koneksi:

```bash
psql -U postgres -h 127.0.0.1 -d golf -c "SELECT 1;"
redis-cli -h 127.0.0.1 -p 6379 ping
```

Redis yang siap akan membalas `PONG`.

## 4. Atur environment

Salin `.env.example` menjadi `.env.local`, kemudian sesuaikan nilainya.
Next.js membaca `.env.local` saat menjalankan aplikasi.

Contoh PowerShell:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

Contoh macOS/Linux:

```bash
cp .env.example .env.local
nano .env.local
```

Isi konfigurasi lokal yang diperlukan:

```dotenv
DATABASE_URL=postgresql://postgres:KATA_SANDI@127.0.0.1:5432/golf
DATABASE_SSL=false
DB_POOL_MAX=10
REDIS_URL=redis://127.0.0.1:6379
APP_ORIGIN=http://localhost:3000
HOLD_IP_HASH_SECRET=GANTI_DENGAN_SECRET_ACAK
QR_SIGNING_SECRET=GANTI_DENGAN_SECRET_ACAK
```

Ganti user dan kata sandi database sesuai instalasi Anda. Buat nilai acak
terpisah untuk kedua secret; jangan gunakan contoh atau commit secret ke Git.
Untuk membuat secret dari terminal, jalankan perintah ini dua kali, lalu
salin masing-masing hasil ke `.env.local`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Konfigurasi email (`RESEND_API_KEY`, `EMAIL_FROM`, dan
`CLUB_CONTACT_EMAIL`) bersifat opsional untuk menjalankan aplikasi. Tanpanya,
notifikasi email akan tetap tertunda di outbox. Jangan pernah mengirim API key
atau kata sandi melalui chat atau memasukkannya ke source code.

## 5. Jalankan migrasi database

Migrasi menyiapkan tabel dan data awal. Script migrasi membaca konfigurasi
dari environment proses, bukan langsung dari `.env.local`.

PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://postgres:KATA_SANDI@127.0.0.1:5432/golf"
$env:DATABASE_SSL = "false"
npm run db:migrate
```

macOS/Linux:

```bash
DATABASE_URL='postgresql://postgres:KATA_SANDI@127.0.0.1:5432/golf' \
DATABASE_SSL=false npm run db:migrate
```

Pastikan URL di perintah migrasi sama dengan `DATABASE_URL` pada `.env.local`.
Perintah ini aman dijalankan ulang: migrasi yang sudah diterapkan akan dilewati.

## 6. Jalankan website

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000). Tekan `Ctrl+C` di terminal
untuk menghentikan server.

Untuk menjalankan versi production secara lokal:

```bash
npm run build
npm run start
```

## Pengujian

Build aplikasi:

```bash
npm run build
```

Suite integration menguji API, PostgreSQL, Redis, booking, dan rate limit.
Jalankan server pada terminal pertama:

```bash
npm run dev
```

Kemudian, di terminal kedua:

```bash
npm run test:integration
```

Tes hanya boleh dijalankan terhadap API, PostgreSQL, dan Redis lokal. Tes
membuat serta menghapus data sementara; **jangan gunakan database production
atau database yang berisi data penting**. Variabel `APP_ORIGIN`,
`DATABASE_URL`, dan `REDIS_URL` harus mengarah ke layanan lokal. Untuk detail
tentang layanan, migrasi, serta batas kesiapan production, lihat
[panduan backend](./docs/backend-api-setup.md).

## Fitur dan batasan penting

- Halaman publik: course & fasilitas, harga, event, Academy, dan kontak.
- Area member: dashboard, booking, profil, handicap, loyalty, serta keamanan
  akun.
- Waitlist dengan verifikasi email tamu, tawaran hold 10 menit, dan link untuk
  menyelesaikan booking; perubahan jadwal member tersedia hingga 24 jam sebelum
  waktu booking asal.
- Member dapat mengatur persetujuan email, pengingat tee time 24/3 jam, dan
  update lapangan langsung atau harian.
- Tee sheet staf menyediakan pencarian booking, check-in berdasarkan booking,
  kapasitas, serta ringkasan operasional harian.
- Panel `/staff` hanya dapat diakses akun yang telah diberi role staff/admin.
- Verifikasi nomor telepon belum aktif karena provider SMS/OTP belum
  dikonfigurasi.
- Event dan Academy menerima inquiry; formulirnya bukan pendaftaran atau
  pemesanan yang terkonfirmasi.
- Informasi klub yang belum diverifikasi ditandai pada website dan perlu
  dikonfirmasi sebelum dipakai sebagai informasi operasional.
- Sebelum production, siapkan konfigurasi email, secret yang aman, backup,
  serta observability. Untuk memproses email terjadwal/waitlist dan pengingat,
  atur `NOTIFICATION_JOB_TOKEN` serta konfigurasi Resend, kemudian jadwalkan
  `POST /api/v1/jobs/notifications/process` setiap 5–15 menit. Detail ada di
  [panduan backend](./docs/backend-api-setup.md).
- Kebijakan no-show dan penalti belum ditetapkan klub; fitur penandaan/penalti
  no-show sengaja belum diaktifkan.

## Pemecahan masalah

- **API menampilkan error database:** periksa PostgreSQL berjalan, database
  sudah dibuat, dan `DATABASE_URL` benar.
- **Rate limit atau tes Redis gagal:** periksa Redis berjalan dan
  `REDIS_URL=redis://127.0.0.1:6379` dapat dijangkau.
- **Migrasi gagal:** pastikan URL koneksi mengarah ke database project dan
  user memiliki izin membuat extension/tabel. Minta administrator database
  mengaktifkan `pgcrypto` dan `citext` jika user tidak memiliki izin.
- **Port 3000 sudah digunakan:** hentikan server lain atau jalankan
  `npm run dev -- --port 3001`, lalu buka `http://localhost:3001`.
