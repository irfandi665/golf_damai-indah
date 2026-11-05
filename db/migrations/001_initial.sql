CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM (
    'confirmed', 'checked_in', 'completed', 'cancelled', 'expired', 'no_show'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  phone text NOT NULL,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'member'
    CHECK (role IN ('member', 'staff', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tiers (
  code text PRIMARY KEY,
  min_rounds smallint NOT NULL CHECK (min_rounds >= 0),
  cashback_bps smallint NOT NULL CHECK (cashback_bps BETWEEN 0 AND 10000),
  advance_days smallint NOT NULL CHECK (advance_days >= 0)
);

INSERT INTO tiers (code, min_rounds, cashback_bps, advance_days) VALUES
  ('silver', 0, 100, 0), ('gold', 12, 200, 7), ('black', 30, 300, 14)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS members (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  member_no text NOT NULL UNIQUE,
  tier text NOT NULL DEFAULT 'silver' REFERENCES tiers(code),
  joined_at date NOT NULL DEFAULT current_date
);

CREATE TABLE IF NOT EXISTS member_balances (
  user_id uuid PRIMARY KEY REFERENCES members(user_id),
  points bigint NOT NULL DEFAULT 0 CHECK (points >= 0),
  wallet_idr bigint NOT NULL DEFAULT 0 CHECK (wallet_idr >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  csrf_hash text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS courses (
  id smallint PRIMARY KEY,
  name text NOT NULL,
  par smallint NOT NULL CHECK (par BETWEEN 1 AND 100),
  rating numeric(4,1) NOT NULL CHECK (rating > 0),
  slope smallint NOT NULL CHECK (slope > 0),
  timezone text NOT NULL DEFAULT 'Asia/Jakarta'
);

INSERT INTO courses (id, name, par, rating, slope) VALUES
  (1, 'Championship Course', 72, 73.1, 134)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS premium_dates (
  course_id smallint NOT NULL REFERENCES courses(id),
  day date NOT NULL,
  note text,
  PRIMARY KEY (course_id, day)
);

CREATE TABLE IF NOT EXISTS rate_cards (
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

INSERT INTO rate_cards
  (course_id, day_type, start_time, end_time, tier, price_per_player_idr, valid_from)
VALUES
  (1, 'weekday', '06:00', '12:00', 'standard', 1250000, '2020-01-01'),
  (1, 'weekday', '12:00', '24:00', 'twilight',  940000, '2020-01-01'),
  (1, 'premium', '06:00', '09:30', 'peak',     2130000, '2020-01-01'),
  (1, 'premium', '09:30', '12:00', 'standard', 1850000, '2020-01-01'),
  (1, 'premium', '12:00', '24:00', 'twilight', 1390000, '2020-01-01')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS service_items (
  code text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('caddy', 'buggy', 'extra')),
  label text NOT NULL,
  unit text NOT NULL CHECK (unit IN ('per_player', 'per_cart', 'per_unit')),
  unit_price_idr bigint NOT NULL CHECK (unit_price_idr >= 0),
  active boolean NOT NULL DEFAULT true
);

INSERT INTO service_items (code, kind, label, unit, unit_price_idr) VALUES
  ('standard', 'caddy', 'Standard Caddy', 'per_player', 350000),
  ('senior', 'caddy', 'Senior Caddy', 'per_player', 500000),
  ('buggy', 'buggy', 'Golf Buggy', 'per_cart', 450000),
  ('rentalClubs', 'extra', 'Rental Club Set', 'per_unit', 600000),
  ('rangeWarmup', 'extra', 'Driving Range Warm-up', 'per_unit', 150000),
  ('halfwayOrder', 'extra', 'Halfway House Pre-order', 'per_unit', 250000)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS tee_slots (
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

CREATE TABLE IF NOT EXISTS slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id bigint NOT NULL REFERENCES tee_slots(id),
  user_id uuid REFERENCES users(id),
  session_id uuid NOT NULL REFERENCES sessions(id),
  client_ip_hash text NOT NULL,
  players smallint NOT NULL CHECK (players BETWEEN 1 AND 4),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'converted', 'released', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_holds_expiry ON slot_holds (expires_at)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_holds_session ON slot_holds (session_id)
  WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_holds_ip ON slot_holds (client_ip_hash, expires_at)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  user_id uuid REFERENCES users(id),
  session_id uuid REFERENCES sessions(id),
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
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings (slot_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_booking_user_slot
  ON bookings (user_id, slot_id)
  WHERE user_id IS NOT NULL AND status IN ('confirmed', 'checked_in');

CREATE TABLE IF NOT EXISTS booking_items (
  id bigserial PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  item_code text NOT NULL,
  label text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price_idr bigint NOT NULL CHECK (unit_price_idr >= 0),
  amount_idr bigint NOT NULL CHECK (amount_idr >= 0),
  CHECK (amount_idr = quantity * unit_price_idr)
);

CREATE TABLE IF NOT EXISTS rounds (
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
CREATE INDEX IF NOT EXISTS idx_rounds_user_date ON rounds (user_id, played_on DESC);

CREATE TABLE IF NOT EXISTS handicap_snapshots (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES members(user_id),
  index_value numeric(3,1),
  rounds_considered smallint NOT NULL,
  rounds_used smallint NOT NULL,
  trigger_round_id uuid REFERENCES rounds(id),
  computed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS points_ledger (
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
CREATE INDEX IF NOT EXISTS idx_points_user ON points_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wallet_ledger (
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
CREATE INDEX IF NOT EXISTS idx_wallet_user ON wallet_ledger (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS rewards (
  code text PRIMARY KEY,
  label text NOT NULL,
  description text,
  cost_points integer NOT NULL CHECK (cost_points > 0),
  active boolean NOT NULL DEFAULT true
);
INSERT INTO rewards (code, label, description, cost_points) VALUES
  ('range', 'Driving Range Bucket', 'One premium bucket to warm up before your round.', 500),
  ('buggy', 'Complimentary Buggy', 'One cart on your next round, on us.', 1200),
  ('clinic', '30-Minute Pro Clinic', 'One-to-one session with a resident professional.', 3000),
  ('round', 'Complimentary Green Fee', 'One weekday green fee for one player.', 5000)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS vouchers (
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
CREATE INDEX IF NOT EXISTS idx_vouchers_user ON vouchers (user_id, status);

CREATE TABLE IF NOT EXISTS booking_access_tokens (
  token_hash text PRIMARY KEY,
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  scope text NOT NULL,
  key uuid NOT NULL,
  request_hash text NOT NULL,
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key)
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id bigserial PRIMARY KEY,
  topic text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  attempts integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION forbid_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger is append-only';
END $$;

DROP TRIGGER IF EXISTS trg_points_immutable ON points_ledger;
CREATE TRIGGER trg_points_immutable BEFORE UPDATE OR DELETE ON points_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
DROP TRIGGER IF EXISTS trg_wallet_immutable ON wallet_ledger;
CREATE TRIGGER trg_wallet_immutable BEFORE UPDATE OR DELETE ON wallet_ledger
  FOR EACH ROW EXECUTE FUNCTION forbid_ledger_mutation();
