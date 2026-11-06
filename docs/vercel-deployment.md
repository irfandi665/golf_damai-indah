# Panduan Deploy Damai Indah Golf ke Vercel

Panduan ini mengatur deployment Next.js ke Vercel dengan PostgreSQL dan Redis
terkelola. Website hanya membuat reservasi; semua pembayaran dilakukan di
lokasi klub. Vercel bukan pengganti database, Redis, atau provider email.

## 0. Persiapan keamanan

Sebelum mulai:

- Pastikan `.env` tidak ikut di repository. `.env.example` boleh dipush karena
  hanya berisi nama konfigurasi dan placeholder.
- `.env` pernah masuk riwayat commit repository ini. Jika repository pernah
  dipush atau dibagikan, anggap semua kredensial yang ada di dalamnya telah
  terekspos: rotasi password database, kredensial Redis, Resend API key, dan
  `HOLD_IP_HASH_SECRET`, `QR_SIGNING_SECRET`, serta `NOTIFICATION_JOB_TOKEN`.
  Menghapus `.env` di commit terbaru tidak menghapus nilainya dari riwayat.
- Jangan menaruh secret di source code, screenshot, issue, atau chat.
- Jangan jalankan integration test terhadap database production.

Sebelum mendorong perubahan, periksa:

```powershell
git status --short
git ls-files .env .env.local .env.production
```

Perintah kedua seharusnya tidak menampilkan file apa pun. `.env.example` tetap
boleh terlacak.

## 1. Siapkan repository GitHub

1. Pastikan commit berisi source code, `package.json`, `package-lock.json`,
   migrasi, tes, dan dokumentasi.
2. Jangan tambahkan `.env`, `node_modules/`, atau `.next/`.
3. Jika `.env` pernah ter-push, rotasi semua secret terkait sebelum melanjutkan.
   Penghapusan dari riwayat Git adalah langkah terpisah dan mengubah riwayat;
   koordinasikan dengan semua kolaborator sebelum melakukannya.
4. Push branch yang akan dideploy ke GitHub.

## 2. Buat PostgreSQL production

Pilih provider PostgreSQL terkelola yang mendukung PostgreSQL 15 atau lebih
baru dan mengaktifkan extension `pgcrypto` serta `citext`.

1. Buat database production baru. Jangan gunakan database development atau
   integration test.
2. Simpan connection string privat dari provider. Gunakan pooled connection
   string bila tersedia dan ikuti rekomendasi SSL provider.
3. Siapkan backup dan cara restore sebelum menyimpan data booking sungguhan.
4. Perhatikan connection limit. Serverless dapat menjalankan beberapa fungsi
   sekaligus; gunakan pooler provider dan nilai `DB_POOL_MAX` kecil, misalnya
   `2`, lalu sesuaikan dengan kapasitas database.

## 3. Buat Redis production

Gunakan layanan Redis terkelola yang dapat diakses melalui TLS. Simpan URL
privat, biasanya berformat `rediss://...`, sesuai instruksi provider.

Redis digunakan untuk rate limit lintas instance; Redis tidak menggantikan
PostgreSQL sebagai penyimpanan booking.

## 4. Siapkan email

1. Buat atau gunakan akun Resend.
2. Verifikasi domain pengirim yang dimiliki klub.
3. Buat API key baru dan gunakan alamat `EMAIL_FROM` pada domain yang sudah
   diverifikasi.
4. Tetapkan alamat penerima inquiry klub pada `CLUB_CONTACT_EMAIL`.
5. Jangan gunakan API key yang pernah tersimpan di `.env` lama; buat key baru.

## 5. Import project ke Vercel

1. Masuk ke Vercel dan pilih **Add New → Project**.
2. Hubungkan akun GitHub jika diminta.
3. Import repository website ini.
4. Pastikan framework terdeteksi sebagai **Next.js**.
5. Gunakan Node.js **22.x** pada pengaturan project Vercel.
6. Jangan set custom Build Command kecuali ada kebutuhan khusus. Project
   menggunakan perintah build Next.js standar dan `package-lock.json`.
7. Pada awal setup, deploy branch staging jika tersedia. Jangan arahkan Preview
   deployment ke database production.

## 6. Tambahkan environment variables

Di Vercel buka **Project → Settings → Environment Variables**. Tambahkan setiap
variabel untuk environment yang sesuai. Gunakan koneksi database/Redis staging
terpisah untuk Preview dan data production untuk Production.

| Variable | Production value |
|---|---|
| `DATABASE_URL` | Connection string PostgreSQL production, sebaiknya pooled |
| `DATABASE_SSL` | `true` jika diwajibkan provider (umumnya `true`) |
| `DB_POOL_MAX` | Nilai kecil sesuai limit koneksi, misalnya `2` |
| `REDIS_URL` | URL Redis production dengan TLS jika disediakan (`rediss://`) |
| `APP_ORIGIN` | URL website canonical, contoh `https://golf.example.com` |
| `HOLD_IP_HASH_SECRET` | Secret acak baru, minimal 32 byte |
| `QR_SIGNING_SECRET` | Secret acak baru dan berbeda dari secret lainnya |
| `RESEND_API_KEY` | API key Resend yang baru |
| `EMAIL_FROM` | Alamat pengirim pada domain terverifikasi |
| `CLUB_CONTACT_EMAIL` | Alamat email klub untuk inquiry |
| `EMAIL_DELIVERY_DISABLED` | `false` |
| `NOTIFICATION_JOB_TOKEN` | Secret acak baru untuk endpoint job |

Buat secret acak secara lokal dengan Node.js; jalankan terpisah untuk setiap
secret:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Salin output langsung ke field Vercel yang sesuai. Jangan masukkan secret
tersebut ke Git. Setelah menambahkan atau mengubah environment variable,
lakukan deployment baru agar fungsi memakai nilai yang diperbarui.

`APP_ORIGIN` harus memakai URL HTTPS final karena link verifikasi email, reset
password, QR e-ticket, dan notifikasi dibangun dari nilai ini.

## 7. Terapkan migrasi database

Jalankan migrasi sebelum menerima booking. Buat backup database lebih dahulu,
kemudian jalankan dari terminal lokal tepercaya yang memiliki akses ke database
production. Gunakan nilai production hanya di environment proses sementara;
jangan simpan kredensial di file atau history shell yang dibagikan.

PowerShell:

```powershell
$env:DATABASE_URL = "<connection string PostgreSQL production>"
$env:DATABASE_SSL = "true"
npm run db:migrate
Remove-Item Env:DATABASE_URL
Remove-Item Env:DATABASE_SSL
```

Pastikan output migrasi menampilkan migrasi yang diterapkan atau sudah ada.
Script migrasi mengurutkan file dalam `db/migrations` dan mencatat hasilnya.
Jangan jalankan perintah integration test pada target ini.

## 8. Deploy dan pasang domain

1. Deploy branch staging dari Vercel dan tunggu build selesai.
2. Uji deployment staging terlebih dahulu.
3. Setelah lolos, deploy branch production atau promote deployment yang telah
   diuji.
4. Di **Project → Settings → Domains**, tambahkan domain klub.
5. Ikuti instruksi DNS Vercel dan tunggu sertifikat HTTPS aktif.
6. Atur `APP_ORIGIN` ke domain HTTPS final pada Production, lalu redeploy.

Jika Preview dan Production memakai database berbeda, pastikan setiap
environment Vercel mendapat `DATABASE_URL` dan `REDIS_URL` yang sesuai.

## 9. Verifikasi pasca-deploy

Periksa minimal hal-hal berikut:

- Beranda, `/booking`, halaman login/member, dan `/staff` merespons.
- API publik tee time menampilkan ketersediaan dan harga.
- Buat satu booking uji yang disetujui klub pada slot test yang disediakan;
  pastikan tidak ada booking ganda dan email masuk ke alamat test yang Anda
  kendalikan.
- Pastikan email berisi QR inline dan PDF e-ticket. Coba QR di `/staff` melalui
  HTTPS dan periksa bahwa validasi tidak check-in otomatis.
- Pastikan staff/admin hanya dapat mengakses operasi sesuai role.
- Periksa log deployment Vercel, log provider PostgreSQL/Redis, dan status
  email provider/outbox.
- Hapus booking uji melalui alur aplikasi/admin setelah tes; jangan menghapus
  data booking pelanggan.

Build yang sukses saja tidak membuktikan koneksi database, Redis, email, atau
alur booking production berfungsi. Untuk tes integration, gunakan layanan dan
server lokal terisolasi seperti dijelaskan di
[backend-api-setup.md](./backend-api-setup.md).

## 10. Jadwalkan notifikasi dan waitlist

`POST /api/v1/jobs/notifications/process` memerlukan:

```text
Authorization: Bearer <NOTIFICATION_JOB_TOKEN>
```

Endpoint ini memproses pengingat/digest, email outbox, dan tawaran waitlist.
Jadwalkan melalui scheduler eksternal yang dapat mengirim **HTTP POST** setiap
5–15 menit. Vercel Cron memanggil endpoint dengan **GET**, sehingga tidak dapat
langsung menjalankan endpoint POST ini tanpa route adapter yang aman atau
perubahan kode. Jangan menaruh token scheduler pada URL atau kode frontend.

Jika belum menyiapkan scheduler, booking masih tersimpan, tetapi pesan outbox
dan proses notifikasi terjadwal dapat tertunda. Pantau email dari dashboard
admin dan dashboard Resend.

## 11. Pembaruan dan rollback

- Push perubahan ke branch GitHub yang terhubung; Vercel akan membangun
  deployment baru.
- Uji Preview memakai database staging sebelum merge ke production.
- Untuk perubahan skema, backup dahulu dan rencanakan kompatibilitas aplikasi
  lama/baru. Migrasi otomatis tidak dijalankan saat build Vercel; jalankan
  migrasi secara terkontrol sebelum rilis yang membutuhkannya.
- Jika deployment aplikasi gagal, gunakan deployment sebelumnya di Vercel.
  Rollback kode tidak otomatis membatalkan perubahan database; pulihkan database
  hanya melalui prosedur backup/restore yang sudah diuji.

## Pembayaran

Website hanya membuat reservasi. Semua pembayaran dilakukan langsung di lokasi
klub; tidak ada payment gateway atau pembayaran online di aplikasi.
