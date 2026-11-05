CREATE TABLE IF NOT EXISTS tee_time_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id bigint NOT NULL REFERENCES tee_slots(id),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES sessions(id),
  guest_name text NOT NULL,
  guest_phone text NOT NULL,
  guest_email citext NOT NULL,
  players smallint NOT NULL CHECK (players BETWEEN 1 AND 4),
  status text NOT NULL CHECK (status IN (
    'pending_verification', 'waiting', 'held', 'booked', 'expired', 'cancelled'
  )),
  hold_id uuid REFERENCES slot_holds(id),
  email_token_hash text,
  email_token_expires_at timestamptz,
  claim_token_hash text,
  claim_token_expires_at timestamptz,
  claim_token_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_slot_order
  ON tee_time_waitlist (slot_id, created_at)
  WHERE status = 'waiting';
CREATE UNIQUE INDEX IF NOT EXISTS uq_waitlist_member_active
  ON tee_time_waitlist (user_id, slot_id)
  WHERE user_id IS NOT NULL AND status IN ('pending_verification', 'waiting', 'held');
CREATE UNIQUE INDEX IF NOT EXISTS uq_waitlist_guest_active
  ON tee_time_waitlist (guest_email, slot_id)
  WHERE user_id IS NULL AND status IN ('pending_verification', 'waiting', 'held');

CREATE TABLE IF NOT EXISTS member_notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_consent_at timestamptz,
  tee_time_reminders boolean NOT NULL DEFAULT false,
  course_updates boolean NOT NULL DEFAULT false,
  digest_frequency text NOT NULL DEFAULT 'immediate'
    CHECK (digest_frequency IN ('immediate', 'daily')),
  reminder_hours smallint NOT NULL DEFAULT 24
    CHECK (reminder_hours IN (3, 24)),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'transactional';
ALTER TABLE email_outbox
  DROP CONSTRAINT IF EXISTS email_outbox_category_check;
ALTER TABLE email_outbox
  ADD CONSTRAINT email_outbox_category_check
  CHECK (category IN ('transactional', 'optional'));
