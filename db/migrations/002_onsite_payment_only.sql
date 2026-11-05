DROP INDEX IF EXISTS idx_bookings_payment_expiry;
DROP INDEX IF EXISTS uq_active_booking_user_slot;

ALTER TABLE bookings
  DROP CONSTRAINT IF EXISTS bookings_payment_mode_check;

UPDATE bookings
SET status = 'confirmed',
    payment_mode = 'pay_at_club'
WHERE status::text = 'pending_payment'
   OR payment_mode <> 'pay_at_club';

ALTER TABLE bookings
  ALTER COLUMN payment_mode SET DEFAULT 'pay_at_club',
  DROP COLUMN IF EXISTS payment_expires_at,
  ADD CONSTRAINT bookings_payment_mode_check CHECK (payment_mode = 'pay_at_club');

CREATE UNIQUE INDEX uq_active_booking_user_slot
  ON bookings (user_id, slot_id)
  WHERE user_id IS NOT NULL AND status IN ('confirmed', 'checked_in');
