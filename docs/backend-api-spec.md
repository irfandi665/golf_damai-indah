# Spesifikasi API dan Database — Damai Indah Golf

**Versi:** 1.4
**Status:** Spesifikasi untuk implementasi  
**Tanggal:** 5 November 2026  
**Audiens:** Backend, DevOps, QA, dan frontend

Dokumen ini merinci penggantian mock `fetchTeeTimes`, `createBooking`, dan
`fetchMemberData` pada frontend. API route, migrasi skema, autentikasi member,
alur inti booking/member, dan endpoint staff/admin yang tercantum di bawah
telah disiapkan. Server adalah sumber kebenaran untuk ketersediaan, tarif,
total booking, handicap, poin, tier, dan cashback. Worker outbox serta
pengujian integrasi database tetap diperlukan sebelum peluncuran penuh.

**Disclaimer transaksi:** aplikasi ini hanya menerima reservasi tee time.
Semua pembayaran/penyelesaian transaksi dilakukan langsung di lokasi klub;
aplikasi tidak memproses pembayaran online, menyimpan detail pembayaran,
ataupun mengonfirmasi penerimaan uang. Lihat
[backend-api-setup.md](./backend-api-setup.md).

## 1. Keputusan arsitektur

| Area | Keputusan |
|---|---|
| Database | PostgreSQL 15+; transaksi ACID, foreign key, `CHECK`, partial index |
| Cache/job | Redis untuk rate limit, cache ketersediaan 15 detik, dan antrean job |
| Zona waktu | Jam tee time adalah waktu lokal `Asia/Jakarta`; tanggal dan jam disimpan terpisah. Timestamp audit/transaksi memakai `timestamptz` UTC |
| Mata uang | Rupiah sebagai integer (`BIGINT` di penyimpanan); tidak menggunakan floating point |
| Harga | Ditentukan server dari `rate_cards`, layanan aktif, dan snapshot pajak. `clientTotal` hanya untuk mendeteksi perubahan |
| Kapasitas | Baris `tee_slots` menjadi penghitung kapasitas atomik untuk booking dan hold aktif |
| Pembayaran | Seluruh pembayaran diselesaikan langsung di lokasi klub; aplikasi tidak memproses pembayaran |
| Pencatatan pembayaran | Role staff/admin dapat mencatat `unpaid`, `down_payment`, atau `paid` sebagai informasi operasional, bukan bukti transaksi |
| Mode pembayaran | Reservasi dikonfirmasi online; pembayaran dilakukan di lokasi klub |

### Kontrak terhadap frontend

- `GET /tee-times` menyediakan `time`, `spotsLeft`, `tier`, dan
  `pricePerPlayer` yang digunakan komponen jadwal, ditambah `slotId` dan
  `status`.
- `POST /quotes` memakai pilihan caddy, buggy, dan extras seperti kalkulasi
  frontend, tetapi nilai hasil server yang menjadi acuan.
- `POST /bookings` menerima `holdId`; frontend tidak mengirim harga sebagai
  nilai otoritatif.
- `GET /me/dashboard` menggantikan pemuatan mock dashboard member.
- UI menampilkan total dari server dan menyatakan pembayaran dilakukan di
  lokasi. Aplikasi tidak memproses atau memverifikasi pembayaran.

## 2. Konvensi API

- Base path: `/api/v1`; JSON menggunakan `camelCase`.
- Tanggal: `YYYY-MM-DD`; jam lokal lapangan: `HH:mm`; timestamp: ISO 8601 UTC.
- Semua endpoint yang mengubah state memerlukan HTTPS, cookie sesi
  `HttpOnly; Secure; SameSite=Lax`, dan pemeriksaan CSRF. Sesi tamu memperoleh
  cookie anonim acak yang tidak berisi data pribadi.
- Endpoint publik tetap dibatasi rate limit. Identitas klien untuk hold berasal
  dari sesi anonim atau sesi member, bukan ID sesi yang dipercaya dari body.
- `Idempotency-Key` berupa UUID wajib pada pembuatan booking, pembatalan, dan
  penukaran reward. Scope kunci mencakup aktor dan metode/path.
  Body identik mengembalikan status dan body tersimpan; body berbeda memberi
  `409 idempotency_conflict`.
- Daftar memakai cursor (`limit` default 20, maksimum 100).
- Kesalahan menggunakan `application/problem+json`:

```json
{
  "type": "https://api.example.com/problems/slot-unavailable",
  "title": "Tee time tidak tersedia",
  "status": 409,
  "code": "slot_unavailable",
  "detail": "Kapasitas yang tersisa tidak cukup untuk jumlah pemain.",
  "errors": [{ "field": "players", "message": "availableSpots: 1" }]
}
```

| HTTP | `code` | Makna |
|---|---|---|
| 400 | `validation_error` | Format atau nilai field tidak valid |
| 401 / 403 | `unauthenticated` / `forbidden` | Belum login atau role tidak cukup |
| 404 | `not_found` | Resource tidak ada atau bukan milik pemanggil |
| 409 | `slot_unavailable` | Kapasitas tidak cukup; sertakan `availableSpots` |
| 409 | `hold_expired` | Hold sudah berakhir/dilepas |
| 409 | `price_changed` | Total server berbeda; sertakan quote baru |
| 409 | `idempotency_conflict` | Kunci yang sama dikirim dengan body berbeda |
| 409 | `duplicate_round` | Ronde member untuk tanggal itu sudah tercatat |
| 422 | `booking_window_closed`, `lead_time_passed`, `not_cancellable` | Aturan bisnis tidak terpenuhi |
| 422 | `insufficient_points` | Saldo poin tidak cukup |
| 429 | `rate_limited` | Batas request; sertakan `Retry-After` |

## 3. Skema database

DDL berikut menunjukkan struktur inti. Migrasi produksi harus menambahkan
`updated_at` trigger/maintenance yang konsisten, ownership role database, serta
retensi dan backup sesuai kebijakan operasional.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TYPE booking_status AS ENUM (
  'confirmed', 'checked_in', 'completed', 'cancelled', 'expired', 'no_show'
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  phone text NOT NULL,
  full_name text NOT NULL,
  password_hash text,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'starter', 'front_desk', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE tiers (
  code text PRIMARY KEY,
  min_rounds smallint NOT NULL CHECK (min_rounds >= 0),
  cashback_bps smallint NOT NULL CHECK (cashback_bps BETWEEN 0 AND 10000),
  advance_days smallint NOT NULL CHECK (advance_days >= 0)
);
INSERT INTO tiers (code, min_rounds, cashback_bps, advance_days) VALUES
  ('silver', 0, 100, 0), ('gold', 12, 200, 7), ('black', 30, 300, 14);

CREATE TABLE members (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  member_no text NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'silver' REFERENCES tiers(code),
  joined_at date NOT NULL DEFAULT current_date
);

CREATE TABLE member_balances (
  user_id uuid PRIMARY KEY REFERENCES members(user_id),
  points bigint NOT NULL DEFAULT 0 CHECK (points >= 0),
  wallet_idr bigint NOT NULL DEFAULT 0 CHECK (wallet_idr >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  id smallint PRIMARY KEY,
  name text NOT NULL,
  par smallint NOT NULL CHECK (par BETWEEN 1 AND 100),
  rating numeric(4,1) NOT NULL CHECK (rating > 0),
  slope smallint NOT NULL CHECK (slope > 0),
  timezone text NOT NULL DEFAULT 'Asia/Jakarta'
);

CREATE TABLE premium_dates (
  course_id smallint NOT NULL REFERENCES courses(id),
  day date NOT NULL,
  note text,
  PRIMARY KEY (course_id, day)
);

CREATE TABLE rate_cards (
  id bigserial PRIMARY KEY,
  course_id smallint NOT NULL REFERENCES courses(id),
  day_type text NOT NULL CHECK (day_type IN ('weekday', 'premium')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  tier text NOT NULL CHECK (tier IN ('peak', 'standard', 'twilight')),
  price_per_player_idr bigint NOT NULL CHECK (price_per_player_idr >= 0),
  valid_from date NOT NULL,
  valid_to date,
  CHECK (start_time < end_time),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);
-- Admin API menolak rentang waktu/tanggal yang tumpang tindih untuk
-- course_id + day_type + tier sebelum rate card diterbitkan.

CREATE TABLE service_items (
  code text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('caddy', 'buggy', 'extra')),
  label text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('per_player', 'per_cart', 'per_unit')),
  unit_price_idr bigint NOT NULL CHECK (unit_price_idr >= 0),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE tee_slots (
  id bigserial PRIMARY KEY,
  course_id smallint NOT NULL REFERENCES courses(id),
  tee_date date NOT NULL,
  tee_time time NOT NULL,
  capacity smallint NOT NULL DEFAULT 4 CHECK (capacity BETWEEN 1 AND 20),
  booked_spots smallint NOT NULL DEFAULT 0 CHECK (booked_spots >= 0),
  held_spots smallint NOT NULL DEFAULT 0 CHECK (held_spots >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'blocked')),
  block_reason text,
  UNIQUE (course_id, tee_date, tee_time),
  CHECK (booked_spots + held_spots <= capacity)
);

CREATE TABLE slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id bigint NOT NULL REFERENCES tee_slots(id),
  user_id uuid REFERENCES users(id),
  session_id text NOT NULL,
  players smallint NOT NULL CHECK (players BETWEEN 1 AND 4),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'converted', 'released', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_holds_expiry ON slot_holds (expires_at) WHERE status = 'active';
CREATE INDEX idx_holds_session ON slot_holds (session_id) WHERE status = 'active';

CREATE TABLE bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id), -- NULL untuk tamu
  slot_id bigint NOT NULL REFERENCES tee_slots(id),
  hold_id uuid UNIQUE REFERENCES slot_holds(id),
  players smallint NOT NULL CHECK (players BETWEEN 1 AND 4),
  status booking_status NOT NULL,
  payment_mode text NOT NULL DEFAULT 'pay_at_club' CHECK (payment_mode = 'pay_at_club'),
  guest_name text NOT NULL,
  guest_phone text NOT NULL,
  guest_email citext NOT NULL,
  notes text,
  caddy_code text REFERENCES service_items(code),
  buggy boolean NOT NULL DEFAULT false,
  tax_rate_bps smallint NOT NULL CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  subtotal_idr bigint NOT NULL CHECK (subtotal_idr >= 0),
  tax_idr bigint NOT NULL CHECK (tax_idr >= 0),
  total_idr bigint NOT NULL CHECK (total_idr >= 0),
  terms_accepted_at timestamptz NOT NULL,
  cancel_kind text CHECK (cancel_kind IN ('free', 'late')),
  cancelled_at timestamptz,
  checked_in_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (total_idr = subtotal_idr + tax_idr)
);
CREATE INDEX idx_bookings_user ON bookings (user_id, created_at DESC);
CREATE INDEX idx_bookings_slot ON bookings (slot_id);
CREATE UNIQUE INDEX uq_active_booking_user_slot
  ON bookings (user_id, slot_id)
  WHERE user_id IS NOT NULL AND status IN ('confirmed', 'checked_in');

CREATE TABLE booking_items (
  id bigserial PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  label text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_idr bigint NOT NULL CHECK (unit_price_idr >= 0),
  amount_idr bigint NOT NULL CHECK (amount_idr >= 0),
  CHECK (amount_idr = quantity * unit_price_idr)
);

CREATE TABLE rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES members(user_id),
  course_id smallint NOT NULL REFERENCES courses(id),
  played_on date NOT NULL,
  gross_score smallint NOT NULL CHECK (gross_score BETWEEN 50 AND 150),
  course_rating numeric(4,1) NOT NULL,
  slope smallint NOT NULL CHECK (slope > 0),
  differential numeric(4,1) NOT NULL,
  source text NOT NULL CHECK (source IN ('self', 'caddy', 'marshal')),
  booking_id uuid REFERENCES bookings(id),
  verified_at timestamptz,
  verified_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, played_on)
);
CREATE INDEX idx_rounds_user_date ON rounds (user_id, played_on DESC);

CREATE TABLE handicap_snapshots (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES members(user_id),
  index_value numeric(3,1),
  rounds_considered smallint NOT NULL,
  rounds_used smallint NOT NULL,
  trigger_round_id uuid REFERENCES rounds(id),
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE points_ledger (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES members(user_id),
  entry_type text NOT NULL
    CHECK (entry_type IN ('earn', 'bonus', 'redeem', 'expire', 'adjust')),
  points integer NOT NULL CHECK (points <> 0),
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  ref_type text,
  ref_id text,
  description text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_points_user ON points_ledger (user_id, created_at DESC);

CREATE TABLE wallet_ledger (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES members(user_id),
  entry_type text NOT NULL
    CHECK (entry_type IN ('cashback', 'topup', 'spend', 'refund', 'adjust')),
  amount_idr bigint NOT NULL CHECK (amount_idr <> 0),
  balance_after bigint NOT NULL CHECK (balance_after >= 0),
  ref_type text,
  ref_id text,
  description text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallet_user ON wallet_ledger (user_id, created_at DESC);

CREATE TABLE rewards (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text,
  cost_points integer NOT NULL CHECK (cost_points > 0),
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES members(user_id),
  code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('reward', 'rain_check')),
  label text NOT NULL,
  source text NOT NULL,
  value_idr bigint NOT NULL DEFAULT 0 CHECK (value_idr >= 0),
  valid_until date NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'used', 'expired', 'void')),
  used_booking_id uuid REFERENCES bookings(id),
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_vouchers_user ON vouchers (user_id, status);

CREATE TABLE booking_access_tokens (
  token_hash bytea PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE idempotency_keys (
  scope text NOT NULL,
  key uuid NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

CREATE TABLE outbox_events (
  id bigserial PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0
);

CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

### Integritas ledger

`points_ledger` dan `wallet_ledger` bersifat append-only: role aplikasi tidak
boleh `UPDATE` atau `DELETE`; trigger database menolak perubahan tersebut.
Setiap mutasi saldo harus mengunci/memperbarui `member_balances` dan menulis
ledger dalam transaksi yang sama. `balance_after` adalah saldo sesudah entry.
Untuk debit, saldo diperiksa dengan `UPDATE ... WHERE balance >= debit`; nol
baris berarti saldo tidak cukup.

### Tambahan migrasi 004

- `tee_time_waitlist` menyimpan pendaftar, slot, jumlah pemain, status
  verifikasi/hold, serta hash token verifikasi dan klaim sekali pakai.
- `member_notification_preferences` menyimpan consent email, pengingat tee
  time, status lapangan, frekuensi update (langsung/harian), dan lead time
  pengingat (24 atau 3 jam).
- `email_outbox.category` memisahkan pesan transaksional dari notifikasi
  opsional agar email opsional yang belum terkirim dapat dihapus saat consent
  dicabut.

## 4. Aturan validasi server

Validasi bentuk request dilakukan sebelum transaksi; validasi kepemilikan,
status, tarif, saldo, dan kapasitas diulang di dalam transaksi yang relevan.

### Format dan batas

- `players`: integer 1–4; quantity extra: integer 0–`players`. Field extra yang
  tidak dikenal ditolak.
- Tanggal harus valid, tidak di masa lalu, berada dalam jendela booking publik
  60 hari ditambah hak `advance_days` member, dan tee time minimal 60 menit dari
  sekarang.
- Nomor telepon dinormalisasi ke format E.164 Indonesia sebelum penyimpanan.
  Email divalidasi dan dinormalisasi; nama wajib minimal dua karakter setelah
  trim. `notes` dibatasi panjangnya dan di-escape saat ditampilkan.
- `termsAccepted` wajib `true`; server mencatat waktu penerimaan.
- `grossScore`: integer 50–150. `playedOn`: tidak di masa depan, maksimum 60
  hari sebelumnya; satu ronde per member per hari dan maksimal 3 ronde mandiri
  per 7 hari.
- ID slot, hold, booking, reward, voucher, dan entitas member diperiksa
  kepemilikannya. Resource orang lain dikembalikan sebagai `404`.
- Nilai harga, pajak, tier, poin, dan status pembayaran dari browser tidak
  dipercaya.

### Tarif dan quote

Green fee diambil dari rate card yang cocok dengan course, tanggal (weekend
atau hari premium), waktu, tier harga, dan masa berlaku. Harga layanan harus
aktif. Harga dan label setiap item disalin ke `booking_items` agar perubahan
tarif berikutnya tidak mengubah booking lama.

```text
subtotal = sum(item.quantity * item.unitPriceIdr)
tax      = round(subtotal * taxRateBps / 10_000)
total    = subtotal + tax
```

Pajak awal sesuai frontend adalah 11% (`taxRateBps = 1100`), tetapi nilainya
merupakan konfigurasi server dan snapshot pada booking. `clientTotal` opsional
untuk quote; saat dikirim pada pembuatan booking harus sama dengan total server.
Jika berbeda, balas `409 price_changed` dengan quote terbaru; jangan membuat
booking.

### Anti double-booking dan hold

`booked_spots` mencakup booking `confirmed` dan `checked_in`; `held_spots`
hanya mencakup hold aktif. Dengan demikian:

```text
booked_spots + held_spots <= capacity
```

Semua operasi hold/booking/release pada suatu slot wajib dilakukan dalam
transaksi database dan mengunci row slot yang sama (`SELECT ... FOR UPDATE`)
atau memakai conditional `UPDATE`. Alur wajib:

1. Kunci slot, validasi status, tanggal, lead time, dan jumlah pemain.
2. Tandai hold yang sudah kedaluwarsa pada slot tersebut sebagai `expired` dan
   kurangi `held_spots` tepat sekali.
3. Buat hold hanya jika `booked_spots + held_spots + players <= capacity`;
   tambah `held_spots` dalam transaksi yang sama. Hold berlaku 10 menit.
4. Batasi maksimal dua hold aktif per sesi dan per IP. Hold baru oleh sesi yang
   sama untuk slot yang sama menggantikan hold lama secara atomik.
5. Konversi hold menjadi booking dalam transaksi: kurangi `held_spots`, tambah
   `booked_spots`, ubah hold menjadi `converted`, lalu buat booking dan item.
   `hold_id UNIQUE` mencegah hold dipakai dua kali.
6. Reservasi langsung dikonfirmasi (`confirmed`); aplikasi tidak memproses
   transaksi pembayaran. Hold yang sudah dikonversi tidak lagi menjadi
   penghitung kapasitas.
7. Cancel/expire melepas `booked_spots` hanya jika status sebelumnya masih
   mengunci kapasitas; perubahan status dan pengurangan penghitung harus dalam
   transaksi yang sama. Job bersifat idempotent.

Constraint `CHECK` pada `tee_slots` adalah pertahanan terakhir. Cache
ketersediaan hanya untuk tampilan dan tidak pernah dipakai untuk mengonfirmasi
hold atau booking. Pembaruan rate card/slot block mengunci slot terkait dan
menolak perubahan yang menimpa booking aktif, kecuali alur admin memindahkan
booking secara eksplisit dan mencatat audit.

## 5. Endpoint

### 5.1 Tee time, hold, dan quote

#### `GET /api/v1/tee-times?courseId=1&date=2026-11-14&players=2`

Publik, cache maksimum 15 detik. Member terautentikasi memakai tier untuk
jendela booking.

```json
{
  "date": "2026-11-14",
  "courseId": 1,
  "players": 2,
  "slots": [
    {
      "slotId": "48213",
      "time": "07:10",
      "spotsLeft": 2,
      "tier": "peak",
      "pricePerPlayer": 2130000,
      "status": "limited"
    }
  ]
}
```

`status`: `available`, `limited` (sisa satu atau dua), `full`, `closed`
(lead time kurang dari 60 menit), atau `blocked`. `spotsLeft` untuk UI tidak
menjamin slot bisa di-hold; endpoint hold selalu memvalidasi ulang.

#### `POST /api/v1/tee-times/holds`

Publik dengan sesi anonim/member; rate limit per sesi dan IP.

Request: `{ "slotId": "48213", "players": 2 }`  
`201`: `{ "holdId": "uuid", "slotId": "48213", "players": 2, "expiresAt": "2026-11-05T02:10:00Z" }`  
`409`: `slot_unavailable` dan `availableSpots`.

#### `DELETE /api/v1/tee-times/holds/{holdId}`

Pemilik sesi/member. Idempotent: hold aktif menjadi `released` dan kuota
dikembalikan; hold nonaktif tidak mengubah penghitung.

#### `POST /api/v1/quotes`

Request:

```json
{
  "holdId": "uuid",
  "caddy": "standard",
  "buggy": true,
  "extras": { "rentalClubs": 0, "rangeWarmup": 2, "halfwayOrder": 0 }
}
```

Server memverifikasi hold aktif milik sesi, lalu menghitung ulang tarif.
Response `200`:

```json
{
  "lines": [
    { "id": "greenFee", "label": "Green Fee", "detail": "2 x Rp2.130.000", "amount": 4260000 }
  ],
  "subtotal": 6410000,
  "taxRateBps": 1100,
  "tax": 705100,
  "total": 7115100,
  "perPlayer": 3557550
}
```

### 5.2 Booking

#### `POST /api/v1/bookings`

Header `Idempotency-Key` wajib. Tamu maupun member; hold harus dimiliki sesi
pemanggil.

```json
{
  "holdId": "uuid",
  "caddy": "standard",
  "buggy": true,
  "extras": { "rentalClubs": 0, "rangeWarmup": 2, "halfwayOrder": 0 },
  "guest": {
    "name": "Rizky Pratama",
    "phone": "081234567890",
    "email": "rizky@example.com"
  },
  "notes": "",
  "termsAccepted": true,
  "clientTotal": 7115100
}
```

Dalam transaksi database, server mengunci hold/slot, memvalidasi owner dan
expiry, menghitung quote dari data server, membandingkan `clientTotal`,
mengonversi hold, lalu menyimpan booking dan snapshot item.

- Booking langsung berstatus `confirmed`; respons `201` berisi referensi,
  total, dan `paymentMode: "pay_at_club"`.
- Ini hanya reservasi. Total dibayarkan langsung di lokasi saat check-in;
  aplikasi tidak menerima, memproses, atau mengonfirmasi pembayaran.
- Jika quote berubah: `409 price_changed` dan quote baru, tanpa booking yang
  terbuat.

Contoh respons:

```json
{
  "id": "uuid",
  "reference": "DIG-7K3Q9M",
  "status": "confirmed",
  "total": 7115100,
  "paymentMode": "pay_at_club"
}
```

#### `GET /api/v1/bookings/{id}`

Pemilik member atau tamu dengan bearer access token terbatas yang diterbitkan
saat booking. Token disimpan sebagai hash, memiliki expiry dan hanya memberi
akses baca ke booking tersebut.

#### `GET /api/v1/me/bookings?status=upcoming|past&limit=20&cursor=...`

Member terautentikasi. `upcoming` mencakup booking mendatang yang `confirmed`;
`past` memuat status final dan ronde lampau.

#### `POST /api/v1/bookings/{id}/cancel`

Header `Idempotency-Key` wajib. Hanya pemilik; status yang dapat dibatalkan
adalah `confirmed`.

- Jika dibatalkan sebelum `teeAt - 24 jam`: `kind: free`; batalkan booking
  dan lepas kapasitas. Tidak ada refund di aplikasi karena pembayaran belum
  dilakukan melalui aplikasi.
- Jika dibatalkan dalam 24 jam tetapi sebelum tee time: `kind: late`; lepas
  kapasitas, tidak ada refund tunai, dan buat voucher rain-check sebesar total
  green fee booking dengan masa berlaku 90 hari.
- Pada atau setelah tee time, atau status `checked_in`/final: `422
  not_cancellable`.
- Pembatalan dan pelepasan kapasitas/voucher dicatat atomik. Penanganan biaya
  atau pengembalian uang, bila ada, dilakukan langsung di lokasi klub.

Response: `{ "booking": {...}, "kind": "free|late", "voucher": {...}|null }`.

#### `POST /api/v1/bookings/{id}/reschedule`

Khusus member pemilik booking berstatus `confirmed`; membutuhkan header
`Idempotency-Key`. Hanya dapat dilakukan setidaknya 24 jam sebelum tee time
asal. Jumlah pemain dan layanan yang dipilih tetap; tee time tujuan harus
tersedia, terbuka, berada dalam jendela 60 hari, dan minimal 60 menit dari
waktu permintaan. Server mengunci kedua slot, memindahkan kapasitas secara
atomik, menghitung ulang green fee dan pajak, serta mencatat audit.
Selisih harga diselesaikan di klub; tidak ada pembayaran/refund di aplikasi.

#### Waitlist

| Method dan path | Auth | Fungsi |
|---|---|---|
| `POST /api/v1/waitlist` | Sesi + CSRF | Member terverifikasi atau tamu mendaftar untuk slot yang tidak cukup kapasitasnya |
| `POST /api/v1/waitlist/verify` | Sesi + CSRF + token | Verifikasi email tamu melalui tautan sekali pakai |
| `POST /api/v1/waitlist/claim` | Sesi + CSRF + token | Klaim hold yang dibuat otomatis; token dapat dipakai ulang hanya pada sesi klaim yang sama |
| `GET /api/v1/me/waitlist` | Member | Daftar tunggu aktif milik member |
| `DELETE /api/v1/me/waitlist/{id}` | Member + CSRF | Keluar dari daftar tunggu dan lepaskan hold jika sedang ditawarkan |

Member harus sudah memverifikasi email. Tamu memasukkan nama, telepon, dan
email, lalu harus memverifikasi email sebelum masuk antrean. Saat kapasitas
terbuka, sistem memilih pendaftar tertua yang jumlah pemainnya muat, membuat
hold 10 menit, dan mengirim link booking melalui email outbox. Slot belum
menjadi booking sampai alur booking selesai. Tanpa Resend, email tetap antre
dan pengguna tidak dapat mengetahui tawaran sebelum pesan terkirim.

#### Preferensi notifikasi

| Method dan path | Auth | Fungsi |
|---|---|---|
| `GET /api/v1/me/notifications` | Member | Baca consent, pengingat, update lapangan, dan frekuensi |
| `PATCH /api/v1/me/notifications` | Member + CSRF | Simpan consent dan preferensi email |
| `POST /api/v1/jobs/notifications/process` | Bearer `NOTIFICATION_JOB_TOKEN` | Antrekan pengingat, digest harian, tawaran waitlist dari hold kedaluwarsa, dan proses outbox |

Pengingat tee time dapat dipilih 24 atau 3 jam sebelumnya. Update lapangan
dikirim langsung atau sebagai digest harian. Consent opsional harus aktif dan
email member terverifikasi; mencabut consent menghapus notifikasi opsional
yang belum terkirim. Konfirmasi/cancel booking tetap email transaksional.

Job notifikasi harus dijadwalkan setiap 5–15 menit dengan token rahasia
`NOTIFICATION_JOB_TOKEN`; pengiriman Resend memerlukan konfigurasi provider.
Jangan jadwalkan endpoint ini sebelum token dan email provider diatur.

Kebijakan no-show dan penalti belum ditetapkan klub, sehingga penandaan
no-show, biaya, dan penalti **belum diterapkan**. Tee sheet hanya menampilkan
status yang sudah ada; laporan harian merangkum confirmed, checked-in,
completed, cancelled, kapasitas, booked, held, dan available.

#### `GET /api/v1/bookings/{id}/qr`

Pemilik. Menghasilkan QR bertanda tangan berumur pendek untuk ditampilkan di
area member. E-ticket email memakai token opaque HMAC yang hash-nya disimpan
di booking; token tersebut tidak memuat booking ID atau PII. Keduanya divalidasi
di server. Tiket email juga dilampirkan sebagai PDF dan memuat tee box (`Tee 1`
atau `Tee 10`), paket (`Weekday`/`Weekend`), ketentuan pembatalan H-1, dan
dress code/etiket.

### 5.3 Pembayaran di lokasi

Tidak ada endpoint payment gateway, checkout, refund, atau webhook. Reservasi
dikonfirmasi oleh aplikasi; seluruh pengumpulan pembayaran dan penyelesaian
transaksi dilakukan langsung oleh klub di lokasi. `payment_status` adalah
pencatatan operasional manual oleh staff/admin (`unpaid`, `down_payment`,
`paid`), bukan konfirmasi pembayaran oleh aplikasi atau integrasi kasir.
Aturan refund atau penyesuaian biaya, bila berlaku, ditangani klub di lokasi.

### 5.4 Member dan handicap

| Method dan path | Auth | Fungsi |
|---|---|---|
| `GET /api/v1/me` | Member | Profil, tier, nomor member |
| `PATCH /api/v1/me` | Member | Ubah nama/telepon; perubahan email memerlukan verifikasi |
| `GET /api/v1/me/dashboard` | Member | Agregat profil, ronde, booking, points ledger, voucher, wallet |
| `GET /api/v1/me/handicap` | Member | Index indikatif, jumlah sample/used, tren |
| `GET /api/v1/me/rounds?limit=&cursor=` | Member | Riwayat ronde |
| `POST /api/v1/me/rounds` | Member | Catat ronde mandiri |
| `GET /api/v1/me/tier` | Member | Tier dan progres berdasarkan ronde terverifikasi 365 hari |

`POST /me/rounds` menerima `{ "playedOn": "2026-11-03", "grossScore": 86 }`.
Server mengambil rating/slope course, menghitung differential indikatif
`(113 / slope) * (grossScore - courseRating)`, dan menyimpan snapshot. Ronde
mandiri memiliki `source=self`, belum diverifikasi; tetap dapat dipakai untuk
index indikatif tetapi tidak untuk tier. Index memakai 20 ronde terbaru dan
aturan pemilihan differential yang sama dengan helper frontend; dibatasi
0–54.0, pembulatan satu desimal, dan diberi label indikatif (bukan handicap
resmi asosiasi).

Konflik satu ronde per tanggal menjawab `409 duplicate_round`. Batas tiga
ronde mandiri per tujuh hari diperiksa dalam transaksi dengan penguncian member
agar request bersamaan tidak melewati batas. Staff verify menyimpan
`verified_at`/`verified_by`, memicu hitung ulang handicap/tier dan event outbox.

### 5.5 Loyalty ledger

| Method dan path | Auth | Fungsi |
|---|---|---|
| `GET /api/v1/me/points?limit=&cursor=` | Member | Saldo poin dan ledger |
| `GET /api/v1/me/wallet?limit=&cursor=` | Member | Saldo Fairway Wallet dan ledger |
| `GET /api/v1/rewards` | Publik/member | Katalog reward aktif |
| `POST /api/v1/me/rewards/{code}/redeem` | Member | Tukar poin secara idempotent |
| `GET /api/v1/me/vouchers?status=active` | Member | Voucher milik member |
| `PATCH /api/v1/me/password` | Member + CSRF | Ganti password dan cabut sesi aktif |
| `POST /api/v1/auth/password/forgot` | Publik, rate-limited | Minta tautan reset secara generik |
| `POST /api/v1/auth/password/reset` | Token email | Reset password dan cabut sesi |
| `POST /api/v1/auth/email/verification` | Member + CSRF | Kirim tautan verifikasi melalui email |
| `POST /api/v1/auth/email/verify` | Token email | Verifikasi alamat email |

Verifikasi nomor telepon belum aktif sampai provider SMS/OTP dikonfigurasi.
Booking dan pembatalan membuat pesan konfirmasi dalam email outbox. Konfirmasi
booking menyertakan HTML premium dengan QR inline dan PDF e-ticket. Pengiriman
menggunakan Resend (`RESEND_API_KEY`, `EMAIL_FROM`); tanpa konfigurasi atau saat
`EMAIL_DELIVERY_DISABLED=true`, pesan tetap tertunda dan admin dapat memantau
outbox atau mencoba ulang. Inquiry publik tersimpan untuk tindak lanjut staf;
pemberitahuan email memerlukan `CLUB_CONTACT_EMAIL`.

Penukaran poin menggunakan satu transaksi dan conditional debit:

```sql
UPDATE member_balances
SET points = points - :cost, updated_at = now()
WHERE user_id = :user_id AND points >= :cost
RETURNING points;
```

Nol baris berarti `422 insufficient_points`. Dalam transaksi yang sama, insert
entry negatif ke `points_ledger` dan voucher. Unique idempotency key mencegah
debit/ voucher ganda. Respons `201`: `{ "voucher": {...}, "pointsBalance": 7669 }`.

Ketika booking member menjadi `completed`, satu transaksi idempotent:

- earn `floor(total_idr / 10000)` poin; key `earn:booking:{bookingId}`;
- cashback `round(total_idr * cashback_bps / 10000)` rupiah; key
  `cashback:booking:{bookingId}`;
- update `member_balances`, tulis ledger, dan tulis event outbox.

Tier cashback yang dipakai adalah tier saat booking diselesaikan, dicatat pada
event/snapshot agar retry tidak menghasilkan nilai berbeda. Booking tamu
tanpa `user_id` tidak memperoleh poin/cashback; klaim setelah registrasi hanya
boleh melalui proses verifikasi email dan tidak boleh menghasilkan earn ganda.

## 6. Staff, admin, dan pekerjaan terjadwal

### Role operasional

| Role | Izin |
|---|---|
| `starter` | Tee sheet, pencarian/check-in, penyelesaian ronde, catatan booking, kesiapan layanan, dan mengajukan update kondisi lapangan |
| `front_desk` | Izin `starter`, laporan/ekspor harian, serta mencatat status pembayaran manual |
| `admin` | Semua izin operasional, override kehadiran, blokir slot, persetujuan update lapangan, perubahan role, konfigurasi, dan audit |

Akun ber-role `staff` yang sudah ada dimigrasikan menjadi `front_desk`.
Perubahan role hanya dilakukan admin; admin tidak dapat mengubah role akunnya
sendiri. Sembunyikan kontrol di UI bukan pengganti pemeriksaan role pada API.

### Endpoint operasional

| Endpoint | Role | Aturan |
|---|---|---|
| `GET /api/v1/staff/session` | Starter/front desk/admin | Mengembalikan role sesi aktif |
| `POST /api/v1/staff/check-in` | Starter/front desk/admin + CSRF | Verifikasi token QR dan check-in atomik; hanya booking aktif pada tanggal lokal tee time |
| `POST /api/v1/staff/tickets/validate` | Starter/front desk/admin | Validasi tiket tanpa mengubah status kehadiran |
| `POST /api/v1/staff/bookings/{id}/check-in` | Starter/front desk/admin + CSRF | Check-in manual berdasarkan ID; hanya pada tanggal tee time |
| `POST /api/v1/staff/bookings/{id}/notes` | Starter/front desk/admin + CSRF | Tambahkan catatan operasional internal, 1–1000 karakter |
| `PUT /api/v1/staff/bookings/{id}/services` | Starter/front desk/admin + CSRF | Catat penugasan/status `pending` atau `ready` untuk caddy/buggy yang dipesan |
| `PATCH /api/v1/staff/bookings/{id}/payment` | Front desk/admin + CSRF | Catat `unpaid`, `down_payment`, atau `paid`; bukan bukti transaksi |
| `POST /api/v1/staff/bookings/{id}/complete` | Starter/front desk/admin + CSRF | Selesaikan ronde; idempotently memicu earn, cashback, outbox |
| `POST /api/v1/staff/rounds/{id}/verify` | Starter/front desk/admin + CSRF | Verifikasi skor/sumber, hitung ulang handicap dan tier |
| `POST /api/v1/staff/vouchers/{code}/redeem` | Front desk/admin + CSRF | Gunakan voucher aktif, kaitkan ke booking dalam transaksi |
| `GET /api/v1/staff/tee-sheet?date=YYYY-MM-DD&q=...` | Starter/front desk/admin | Cari reference, nama, atau telepon; tampilkan kapasitas, booking, hold, status, dan ringkasan harian |
| `POST /api/v1/staff/course-updates` | Starter/front desk + CSRF | Ajukan perubahan kondisi lapangan berstatus pending; belum tampil publik |
| `GET /api/v1/admin/bookings?date=YYYY-MM-DD&attendance=all|not_arrived|arrived&payment=all|unpaid|down_payment|paid&q=...` | Front desk/admin | Laporan reservasi harian; `format=csv` mengekspor rekap, termasuk status pembayaran manual |
| `PATCH /api/v1/admin/bookings/{id}` | Admin + CSRF | Override `attendanceStatus` (`confirmed`/`checked_in`) dan/atau `paymentStatus`; mencatat audit dan `checkedInAt` |
| `PUT /api/v1/admin/tee-sheet/blocks` | Admin + CSRF | Blokir/buka slot dengan alasan; slot dengan booking atau hold aktif ditolak |
| `GET /api/v1/admin/course-updates/pending` | Admin | Daftar usulan update lapangan yang menunggu persetujuan |
| `POST /api/v1/admin/course-updates/{id}/approve` | Admin + CSRF | Setujui dan publikasikan usulan; antrekan notifikasi sesuai preferensi member |
| `GET /api/v1/admin/staff?email=...` | Admin | Cari akun aktif berdasarkan email |
| `PATCH /api/v1/admin/staff/{userId}` | Admin + CSRF | Ubah role ke `member`, `starter`, `front_desk`, atau `admin`; tidak dapat mengubah role sendiri |
| `GET /api/v1/admin/audit?date=&action=&entityType=` | Admin | Filter audit berdasarkan tanggal Jakarta, aksi, dan tipe entitas (maksimum 200) |
| `PUT /api/v1/admin/rate-cards` | Admin + CSRF | Ubah tarif untuk booking baru; validasi overlap |
| `PUT /api/v1/admin/service-items` | Admin + CSRF | Kelola harga/layanan aktif untuk booking baru |
| `POST /api/v1/admin/course-updates` | Admin + CSRF | Publikasikan status operasional lapangan |
| `POST /api/v1/admin/announcements` | Admin + CSRF | Publikasikan pengumuman in-app member |
| `GET/PATCH /api/v1/admin/inquiries[/{id}]` | Admin | Tinjau inquiry dan ubah status tindak lanjut |
| `GET /api/v1/admin/email-outbox` | Admin | Pantau status pengiriman email |
| `POST /api/v1/admin/email-outbox/process` | Admin + CSRF | Coba kirim ulang pesan email tertunda |

Migrasi `006_staff_operations.sql` menambahkan role operasional baru, catatan
booking, status kesiapan layanan, serta alur approval update kondisi lapangan.
Seluruh perubahan operasional penting ditulis ke `audit_log`.
| `PUT /api/v1/admin/rate-cards` | Admin | Ubah tarif untuk booking baru; validasi overlap |
| `PUT /api/v1/admin/service-items` | Admin | Kelola harga/layanan aktif untuk booking baru |
| `POST /api/v1/admin/course-updates` | Admin | Publikasikan status operasional lapangan |
| `POST /api/v1/admin/announcements` | Admin | Publikasikan pengumuman in-app member |
| `GET/PATCH /api/v1/admin/inquiries[/{id}]` | Admin | Tinjau inquiry dan ubah status tindak lanjut |
| `POST /api/v1/admin/email-outbox/process` | Admin | Coba kirim ulang pesan email tertunda |

Endpoint publik `GET /api/v1/pricing`, `/course-updates`, dan `/announcements`
menyediakan rate/service aktif, status operasional, serta pengumuman. `POST
/api/v1/inquiries` menyimpan inquiry event, Academy, atau kontak dengan
validasi dan rate limit. Form event/Academy adalah permintaan informasi, bukan
pendaftaran acara atau reservasi kelas terkonfirmasi. Data alamat, jam buka,
kalender event, instruktur, dan peta harus diverifikasi klub sebelum diisi;
status cuaca langsung memerlukan provider yang belum dikonfigurasi.

Semua aksi staff/admin menulis `audit_log` dengan aktor, aksi, entitas, serta
state sebelum/sesudah. PII sensitif tidak disalin ke audit yang tidak
diperlukan.

### Job terjadwal

| Job | Frekuensi | Tindakan |
|---|---|---|
| `generate-slots` | Harian 00:30 | Buat slot hingga 74 hari (60 hari publik + 14 hari tier Black); `UNIQUE` membuat job idempotent |
| `sweep-holds` | 30 detik | Tandai hold expired dan lepaskan `held_spots` tepat sekali |
| `evaluate-tiers` | Harian dan saat ronde diverifikasi | Hitung ronde terverifikasi 365 hari dan perbarui tier |
| `expire-vouchers` | Harian | Tandai voucher lewat `valid_until` sebagai expired |
| `notifications` | 5–15 menit | Antrekan reminder/digest, tawaran waitlist untuk hold kedaluwarsa, dan proses email outbox |

No-show job ditunda sampai kebijakan klub disetujui. Job notifikasi tersedia
melalui endpoint internal bertoken; pengelola hosting harus menjadwalkan
pemanggilannya.

Job harus aman dijalankan lebih dari sekali dan memakai transaksi/conditional
update yang sama dengan request interaktif.

## 7. Batas keamanan dan operasional

- Otorisasi dilakukan per resource di server; jangan percaya `userId`, role,
  price, balance, atau status booking dari request.
- Terapkan CSRF pada cookie auth dan rate limit khusus hold, login, redemption,
  serta booking.
- Gunakan query parameterized, validasi allowlist field update, output encoding,
  dan sanitasi log. Jangan mengembalikan stack trace atau payload PII pada error.
- Simpan hash access token tamu dan secrets di secret manager. Batasi masa
  hidup QR/access token.
- Gunakan transactional outbox untuk email/WhatsApp; jangan memanggil layanan
  eksternal sambil memegang lock/transaksi database.
- Monitor jumlah slot occupied, booking, hold kedaluwarsa, dan outbox tertahan.

## 8. Kriteria penerimaan QA

1. Dua request hold bersamaan untuk kapasitas terakhir tidak dapat keduanya
   sukses; `booked_spots + held_spots` tidak pernah melebihi capacity.
2. Hold yang sama hanya dapat dikonversi sekali; retry dengan idempotency key
   dan body identik memberikan booking yang sama.
3. Hold expired/released tidak dapat membuat booking; slot dapat dipesan lagi
   setelah kapasitas dilepas.
4. Harga yang diubah klien, caddy/extra nonaktif, jumlah di luar batas, atau
   `clientTotal` usang ditolak tanpa booking.
5. Booking dikonfirmasi saat reservasi dibuat; pembayaran tidak diproses atau
   dikonfirmasi oleh aplikasi dan hanya diselesaikan di lokasi klub.
6. Pembatalan gratis/terlambat mengikuti batas 24 jam; late cancel memberi
   voucher nilai green fee.
7. Dua redemption paralel dengan saldo cukup untuk satu transaksi hanya
   menghasilkan satu debit dan satu voucher.
8. Earn/cashback booking completed idempotent; booking tamu tidak mendapat
    saldo member.
9. Self-reported round tervalidasi, tidak dapat dihitung untuk tier sebelum
    verified, dan pengiriman paralel tidak melewati batas ronde mingguan.
10. Semua endpoint member menyembunyikan resource pengguna lain sebagai 404;
    endpoint staff/admin menolak role yang tidak sesuai dan menulis audit log.
