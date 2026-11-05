import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getPool, inTransaction } from './db';
import { ApiError, assert } from './errors';
import { ensureSlots } from './booking-service';

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validTime(value, allowEndOfDay = false) {
  if (allowEndOfDay && value === '24:00') return true;
  if (!/^\d{2}:\d{2}$/.test(value || '')) return false;
  const [hours, minutes] = value.split(':').map(Number);
  return hours < 24 && minutes < 60;
}

function qrSecret() {
  const secret = process.env.QR_SIGNING_SECRET;
  assert(secret, 503, 'service_unavailable', 'QR_SIGNING_SECRET is not configured.');
  return secret;
}

function signature(payload) {
  return createHmac('sha256', qrSecret()).update(payload).digest('base64url');
}

export async function makeBookingQr({ bookingId, session }) {
  const result = await getPool().query(
    `SELECT id,status,user_id,session_id FROM bookings
     WHERE id=$1 AND (user_id=$2 OR session_id=$3)`,
    [bookingId, session.userId, session.id],
  );
  assert(result.rowCount && result.rows[0].status === 'confirmed', 404, 'not_found', 'A confirmed booking was not found.');
  const expiresAt = Math.floor(Date.now() / 1000) + 120;
  const nonce = randomBytes(12).toString('base64url');
  const payload = `${bookingId}.${expiresAt}.${nonce}`;
  return { qrToken: `${payload}.${signature(payload)}`, expiresAt: new Date(expiresAt * 1000).toISOString() };
}

function validQrToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 4) return null;
  const [bookingId, expiry, nonce, received] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(bookingId) || !/^\d+$/.test(expiry) || !nonce || Number(expiry) <= Date.now() / 1000) return null;
  const payload = `${bookingId}.${expiry}.${nonce}`;
  const expected = Buffer.from(signature(payload));
  const actual = Buffer.from(received);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? bookingId : null;
}

export async function checkInBooking({ staffId, qrToken }) {
  const bookingId = validQrToken(qrToken);
  assert(bookingId, 400, 'invalid_qr', 'The QR token is invalid or expired.');
  return inTransaction(async (client) => {
    const result = await client.query(
      `SELECT b.id,b.reference,b.status,ts.tee_date
       FROM bookings b JOIN tee_slots ts ON ts.id=b.slot_id
       WHERE b.id=$1 FOR UPDATE OF b`,
      [bookingId],
    );
    assert(result.rowCount, 404, 'not_found', 'Booking was not found.');
    const booking = result.rows[0];
    assert(booking.status === 'confirmed', 422, 'checkin_not_allowed', 'Only a confirmed booking can be checked in.');
    const today = await client.query("SELECT timezone('Asia/Jakarta',now())::date AS today");
    assert(String(booking.tee_date).slice(0, 10) === String(today.rows[0].today).slice(0, 10), 422, 'checkin_date_mismatch', 'The QR token is not valid for today.');
    await client.query("UPDATE bookings SET status='checked_in',checked_in_at=now(),updated_at=now() WHERE id=$1", [bookingId]);
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
       VALUES($1,'booking.check_in','booking',$2,$3)`,
      [staffId, bookingId, { status: 'checked_in', reference: booking.reference }],
    );
    return { id: bookingId, reference: booking.reference, status: 'checked_in' };
  });
}

export async function completeBooking({ staffId, bookingId }) {
  return inTransaction(async (client) => {
    const result = await client.query(
      `SELECT id,user_id,reference,status,total_idr FROM bookings
       WHERE id=$1 FOR UPDATE`,
      [bookingId],
    );
    assert(result.rowCount, 404, 'not_found', 'Booking was not found.');
    const booking = result.rows[0];
    if (booking.status === 'completed') return { id: booking.id, status: 'completed', alreadyCompleted: true };
    assert(booking.status === 'checked_in', 422, 'booking_not_checked_in', 'Check in the booking before marking it complete.');

    await client.query("UPDATE bookings SET status='completed',completed_at=now(),updated_at=now() WHERE id=$1", [bookingId]);
    if (booking.user_id) {
      const tier = await client.query(
        'SELECT t.cashback_bps FROM members m JOIN tiers t ON t.code=m.tier WHERE m.user_id=$1 FOR UPDATE OF m',
        [booking.user_id],
      );
      const cashbackBps = tier.rows[0]?.cashback_bps || 0;
      const earned = Math.floor(Number(booking.total_idr) / 10000);
      const cashback = Math.round(Number(booking.total_idr) * cashbackBps / 10000);
      const balance = await client.query(
        `UPDATE member_balances
         SET points=points+$2,wallet_idr=wallet_idr+$3,updated_at=now()
         WHERE user_id=$1 RETURNING points,wallet_idr`,
        [booking.user_id, earned, cashback],
      );
      if (earned > 0) {
        await client.query(
          `INSERT INTO points_ledger(user_id,entry_type,points,balance_after,ref_type,ref_id,description,idempotency_key)
           VALUES($1,'earn',$2,$3,'booking',$4,$5,$6)
           ON CONFLICT(idempotency_key) DO NOTHING`,
          [booking.user_id, earned, balance.rows[0].points, bookingId, `Round ${booking.reference}`, `earn:booking:${bookingId}`],
        );
      }
      if (cashback > 0) {
        await client.query(
          `INSERT INTO wallet_ledger(user_id,entry_type,amount_idr,balance_after,ref_type,ref_id,description,idempotency_key)
           VALUES($1,'cashback',$2,$3,'booking',$4,$5,$6)
           ON CONFLICT(idempotency_key) DO NOTHING`,
          [booking.user_id, cashback, balance.rows[0].wallet_idr, bookingId, `Cashback for ${booking.reference}`, `cashback:booking:${bookingId}`],
        );
      }
    }

    await client.query(
      `INSERT INTO outbox_events(topic,payload) VALUES('booking.completed',$1)`,
      [{ bookingId, reference: booking.reference }],
    );
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
       VALUES($1,'booking.complete','booking',$2,$3)`,
      [staffId, bookingId, { status: 'completed' }],
    );
    return { id: bookingId, status: 'completed' };
  });
}

async function updateMemberTier(client, userId) {
  const count = await client.query(
    `SELECT count(*)::int AS rounds FROM rounds
     WHERE user_id=$1 AND verified_at IS NOT NULL AND played_on >= current_date-365`,
    [userId],
  );
  const tier = await client.query(
    'SELECT code FROM tiers WHERE min_rounds <= $1 ORDER BY min_rounds DESC LIMIT 1',
    [count.rows[0].rounds],
  );
  await client.query('UPDATE members SET tier=$2 WHERE user_id=$1', [userId, tier.rows[0].code]);
}

export async function verifyRound({ staffId, roundId, source }) {
  assert(['caddy', 'marshal'].includes(source), 400, 'validation_error', 'source must be caddy or marshal.');
  return inTransaction(async (client) => {
    const result = await client.query('SELECT * FROM rounds WHERE id=$1 FOR UPDATE', [roundId]);
    assert(result.rowCount, 404, 'not_found', 'Round was not found.');
    const round = result.rows[0];
    if (round.verified_at) return { id: round.id, verified: true, alreadyVerified: true };
    await client.query(
      `UPDATE rounds SET source=$2,verified_at=now(),verified_by=$3 WHERE id=$1`,
      [roundId, source, staffId],
    );
    await updateMemberTier(client, round.user_id);
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,before_state,after_state)
       VALUES($1,'round.verify','round',$2,$3,$4)`,
      [staffId, roundId, { verified: false, source: round.source }, { verified: true, source }],
    );
    await client.query(
      `INSERT INTO outbox_events(topic,payload) VALUES('round.verified',$1)`,
      [{ roundId, userId: round.user_id }],
    );
    return { id: roundId, verified: true, source };
  });
}

export async function redeemVoucher({ staffId, code, bookingId }) {
  assert(typeof bookingId === 'string', 400, 'validation_error', 'bookingId is required.');
  return inTransaction(async (client) => {
    const result = await client.query(
      `SELECT v.*,b.status AS booking_status,b.user_id AS booking_user_id,
         (v.valid_until >= timezone('Asia/Jakarta',now())::date) AS valid
       FROM vouchers v JOIN bookings b ON b.id=$2
       WHERE v.code=$1 FOR UPDATE OF v,b`,
      [code, bookingId],
    );
    assert(result.rowCount && result.rows[0].status === 'active', 404, 'not_found', 'An active voucher was not found.');
    const voucher = result.rows[0];
    assert(voucher.valid, 422, 'voucher_expired', 'The voucher has expired.');
    assert(voucher.booking_user_id === voucher.user_id, 422, 'voucher_owner_mismatch', 'The voucher does not belong to this booking member.');
    assert(['confirmed', 'checked_in'].includes(voucher.booking_status), 422, 'voucher_not_applicable', 'The booking cannot use this voucher.');
    await client.query(
      `UPDATE vouchers SET status='used',used_booking_id=$2,used_at=now() WHERE id=$1`,
      [voucher.id, bookingId],
    );
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
       VALUES($1,'voucher.redeem','voucher',$2,$3)`,
      [staffId, voucher.id, { bookingId }],
    );
    return { id: voucher.id, code, status: 'used', bookingId };
  });
}

export async function getTeeSheet({ date, courseId = 1 }) {
  assert(validDate(date), 400, 'validation_error', 'date must use a valid YYYY-MM-DD date.');
  assert(Number.isInteger(Number(courseId)) && Number(courseId) > 0, 400, 'validation_error', 'courseId must be a positive integer.');
  return inTransaction(async (client) => {
    await ensureSlots(client, Number(courseId), date);
    const result = await client.query(
      `SELECT ts.id,to_char(ts.tee_time,'HH24:MI') AS tee_time,ts.capacity,
         ts.booked_spots,ts.held_spots,ts.status,ts.block_reason,
         COALESCE(json_agg(json_build_object(
           'id',b.id,'reference',b.reference,'status',b.status,'players',b.players,
           'guestName',b.guest_name,'guestPhone',b.guest_phone
         ) ORDER BY b.created_at) FILTER (WHERE b.id IS NOT NULL),'[]'::json) AS bookings
       FROM tee_slots ts
       LEFT JOIN bookings b ON b.slot_id=ts.id AND b.status IN ('confirmed','checked_in','completed')
       WHERE ts.course_id=$1 AND ts.tee_date=$2::date
       GROUP BY ts.id ORDER BY ts.tee_time`,
      [Number(courseId), date],
    );
    return {
      date,
      courseId: Number(courseId),
      slots: result.rows.map((slot) => ({
        id: String(slot.id),
        time: slot.tee_time,
        capacity: slot.capacity,
        booked: slot.booked_spots,
        held: slot.held_spots,
        available: slot.capacity - slot.booked_spots - slot.held_spots,
        status: slot.status,
        reason: slot.block_reason,
        bookings: slot.bookings,
      })),
    };
  });
}

export async function blockTeeSlots({ adminId, courseId, date, slotIds, blocked, reason }) {
  assert(Number.isInteger(courseId) && courseId > 0, 400, 'validation_error', 'courseId must be a positive integer.');
  assert(validDate(date), 400, 'validation_error', 'date must use a valid YYYY-MM-DD date.');
  assert(Array.isArray(slotIds) && slotIds.length > 0 && slotIds.length <= 100, 400, 'validation_error', 'Provide 1 to 100 slotIds.');
  assert(typeof blocked === 'boolean', 400, 'validation_error', 'blocked must be a boolean.');
  return inTransaction(async (client) => {
    const slots = await client.query(
      `SELECT * FROM tee_slots WHERE course_id=$1 AND tee_date=$2 AND id=ANY($3::bigint[])
       ORDER BY id FOR UPDATE`,
      [courseId, date, slotIds],
    );
    assert(slots.rowCount === slotIds.length, 404, 'not_found', 'One or more tee slots were not found.');
    if (blocked) {
      const occupied = slots.rows.find((slot) => slot.booked_spots > 0 || slot.held_spots > 0);
      assert(!occupied, 409, 'slot_occupied', 'Cannot block a tee time with active bookings or holds.');
    }
    const updated = [];
    for (const slot of slots.rows) {
      const before = { status: slot.status, reason: slot.block_reason };
      const after = await client.query(
        `UPDATE tee_slots SET status=$2,block_reason=$3
         WHERE id=$1 RETURNING id,status,block_reason`,
        [slot.id, blocked ? 'blocked' : 'open', blocked ? String(reason || '').slice(0, 250) || null : null],
      );
      updated.push(after.rows[0]);
      await client.query(
        `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,before_state,after_state)
         VALUES($1,'tee_slot.block','tee_slot',$2,$3,$4)`,
        [adminId, String(slot.id), before, after.rows[0]],
      );
    }
    return { slots: updated };
  });
}

export async function updateRateCard({ adminId, item }) {
  assert(item && Number.isInteger(Number(item.courseId)) && Number(item.courseId) > 0 && Number(item.courseId) <= 32767 && ['weekday', 'premium'].includes(item.dayType), 400, 'validation_error', 'Invalid rate card course or day type.');
  assert(['peak', 'standard', 'twilight'].includes(item.tier), 400, 'validation_error', 'Invalid rate tier.');
  assert(validTime(item.startTime) && validTime(item.endTime, true) && item.startTime < item.endTime, 400, 'validation_error', 'Provide a valid increasing time range using HH:mm.');
  assert(Number.isSafeInteger(item.pricePerPlayer) && item.pricePerPlayer >= 0, 400, 'validation_error', 'Price must be a non-negative integer.');
  assert(validDate(item.validFrom) && (!item.validTo || validDate(item.validTo)) && (!item.validTo || item.validTo >= item.validFrom), 400, 'validation_error', 'Provide a valid date range using YYYY-MM-DD.');

  return inTransaction(async (client) => {
    const overlap = await client.query(
      `SELECT id FROM rate_cards
       WHERE course_id=$1 AND day_type=$2 AND id<>COALESCE($3,0)
         AND tier=$8
         AND daterange(valid_from,COALESCE(valid_to,'infinity'::date),'[]') &&
             daterange($4::date,COALESCE($5::date,'infinity'::date),'[]')
         AND start_time < $7::time AND end_time > $6::time
       LIMIT 1`,
      [item.courseId, item.dayType, item.id || null, item.validFrom, item.validTo || null, item.startTime, item.endTime, item.tier],
    );
    assert(!overlap.rowCount, 409, 'rate_card_overlap', 'The rate card overlaps an existing active date/time range.');
    const result = item.id
      ? await client.query(
        `UPDATE rate_cards SET course_id=$2,day_type=$3,start_time=$4,end_time=$5,tier=$6,
           price_per_player_idr=$7,valid_from=$8,valid_to=$9 WHERE id=$1 RETURNING *`,
        [item.id, item.courseId, item.dayType, item.startTime, item.endTime, item.tier, item.pricePerPlayer, item.validFrom, item.validTo || null],
      )
      : await client.query(
        `INSERT INTO rate_cards(course_id,day_type,start_time,end_time,tier,price_per_player_idr,valid_from,valid_to)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
        [item.courseId, item.dayType, item.startTime, item.endTime, item.tier, item.pricePerPlayer, item.validFrom, item.validTo || null],
      );
    assert(result.rowCount, 404, 'not_found', 'Rate card was not found.');
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
       VALUES($1,'rate_card.upsert','rate_card',$2,$3)`,
      [adminId, String(result.rows[0].id), result.rows[0]],
    );
    return result.rows[0];
  });
}

export async function updateServiceItem({ adminId, item }) {
  assert(item && /^[a-zA-Z][a-zA-Z0-9_-]{1,39}$/.test(item.code), 400, 'validation_error', 'Invalid service code.');
  assert(['caddy', 'buggy', 'extra'].includes(item.kind), 400, 'validation_error', 'Invalid service kind.');
  assert(['per_player', 'per_cart', 'per_unit'].includes(item.unit), 400, 'validation_error', 'Invalid service unit.');
  assert(typeof item.label === 'string' && item.label.trim().length > 0, 400, 'validation_error', 'Service label is required.');
  assert(Number.isSafeInteger(item.unitPrice) && item.unitPrice >= 0, 400, 'validation_error', 'Service price must be a non-negative integer.');
  return inTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO service_items(code,kind,label,unit,unit_price_idr,active)
       VALUES($1,$2,$3,$4,$5,$6)
       ON CONFLICT(code) DO UPDATE SET kind=EXCLUDED.kind,label=EXCLUDED.label,
         unit=EXCLUDED.unit,unit_price_idr=EXCLUDED.unit_price_idr,active=EXCLUDED.active
       RETURNING *`,
      [item.code, item.kind, item.label.trim(), item.unit, item.unitPrice, item.active !== false],
    );
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
       VALUES($1,'service_item.upsert','service_item',$2,$3)`,
      [adminId, item.code, result.rows[0]],
    );
    return result.rows[0];
  });
}
