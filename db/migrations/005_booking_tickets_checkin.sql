ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS tee_box text NOT NULL DEFAULT 'Tee 1'
    CHECK (tee_box IN ('Tee 1', 'Tee 10')),
  ADD COLUMN IF NOT EXISTS package_type text NOT NULL DEFAULT 'Weekday'
    CHECK (package_type IN ('Weekday', 'Weekend')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'down_payment', 'paid')),
  ADD COLUMN IF NOT EXISTS ticket_token_hash text UNIQUE;

UPDATE bookings b
SET package_type = CASE
  WHEN extract(isodow FROM ts.tee_date) IN (6, 7) THEN 'Weekend'
  ELSE 'Weekday'
END
FROM tee_slots ts
WHERE ts.id = b.slot_id;

ALTER TABLE email_outbox
  ADD COLUMN IF NOT EXISTS html_body text,
  ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
