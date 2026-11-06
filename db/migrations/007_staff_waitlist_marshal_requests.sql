CREATE TABLE IF NOT EXISTS booking_marshal_checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  hole_number smallint NOT NULL CHECK (hole_number IN (9, 18)),
  observed_at timestamptz NOT NULL DEFAULT now(),
  note text,
  recorded_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (note IS NULL OR char_length(note) <= 500),
  UNIQUE (booking_id, hole_number)
);
CREATE INDEX IF NOT EXISTS idx_booking_marshal_checkpoints_booking
  ON booking_marshal_checkpoints (booking_id, observed_at DESC);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS requested_caddy text,
  ADD COLUMN IF NOT EXISTS rental_needs text,
  ADD CONSTRAINT bookings_requested_caddy_length
    CHECK (requested_caddy IS NULL OR char_length(requested_caddy) <= 120),
  ADD CONSTRAINT bookings_rental_needs_length
    CHECK (rental_needs IS NULL OR char_length(rental_needs) <= 300);
