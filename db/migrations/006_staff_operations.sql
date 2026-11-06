ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

UPDATE users SET role = 'front_desk' WHERE role = 'staff';

ALTER TABLE users
  ADD CONSTRAINT users_role_check CHECK (role IN ('member', 'starter', 'front_desk', 'admin'));

ALTER TABLE course_updates
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'approved'
    CHECK (approval_status IN ('pending', 'approved')),
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_course_updates_pending
  ON course_updates (created_at DESC) WHERE approval_status = 'pending';

CREATE TABLE IF NOT EXISTS booking_operational_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES users(id),
  note text NOT NULL CHECK (char_length(note) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_operational_notes_booking
  ON booking_operational_notes (booking_id, created_at DESC);

CREATE TABLE IF NOT EXISTS booking_service_readiness (
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_type text NOT NULL CHECK (service_type IN ('caddy', 'buggy')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready')),
  assigned_to text,
  note text,
  updated_by uuid NOT NULL REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_id, service_type),
  CHECK (assigned_to IS NULL OR char_length(assigned_to) <= 120),
  CHECK (note IS NULL OR char_length(note) <= 500)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created
  ON audit_log (created_at DESC);
