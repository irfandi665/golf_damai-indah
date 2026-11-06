import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getPool, inTransaction } from './db';
import { ApiError, assert } from './errors';
import { ensureSlots } from './booking-service';
import { hashBookingTicketToken } from './booking-ticket';

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

async function setBookingCheckedIn(client, staffId, bookingId) {
  const result = await client.query(
    `SELECT b.id,b.reference,b.status,b.guest_name,b.payment_status,b.payment_mode,
       ts.tee_date,to_char(ts.tee_time,'HH24:MI') AS tee_time
     FROM bookings b JOIN tee_slots ts ON ts.id=b.slot_id
     WHERE b.id=$1 FOR UPDATE OF b`,
    [bookingId],
  );
  assert(result.rowCount, 404, 'not_found', 'Booking was not found.');
  const booking = result.rows[0];
  assert(booking.status === 'confirmed', 422, 'checkin_not_allowed', 'Only a confirmed booking can be checked in.');
  const today = await client.query("SELECT timezone('Asia/Jakarta',now())::date AS today");
  assert(String(booking.tee_date).slice(0, 10) === String(today.rows[0].today).slice(0, 10), 422, 'checkin_date_mismatch', 'The booking is not scheduled for today.');
  await client.query("UPDATE bookings SET status='checked_in',checked_in_at=now(),updated_at=now() WHERE id=$1", [bookingId]);
  await client.query(
    `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
     VALUES($1,'booking.check_in','booking',$2,$3)`,
    [staffId, bookingId, { status: 'checked_in', reference: booking.reference }],
  );
  return {
    id: bookingId,
    reference: booking.reference,
    guestName: booking.guest_name,
    teeTime: booking.tee_time,
    paymentStatus: booking.payment_status,
    paymentMode: booking.payment_mode,
    status: 'checked_in',
    checkedInAt: new Date().toISOString(),
  };
}

export async function checkInBooking({ staffId, qrToken }) {
  const resolved = await resolveBookingTicket(qrToken);
  assert(resolved.valid, 422, 'checkin_not_allowed', resolved.message || 'This ticket is invalid or has already been used.');
  return inTransaction(async (client) => {
    return setBookingCheckedIn(client, staffId, resolved.booking.id);
  });
}

async function resolveBookingTicket(qrToken) {
  const value = String(qrToken || '').trim();
  if (!value || value.length > 2048) return { valid: false, code: 'invalid', message: 'Booking ticket is not valid.' };
  let bookingId = validQrToken(value);
  const ticketHash = /^[A-Za-z0-9_-]{40,64}$/.test(value) ? hashBookingTicketToken(value) : null;
  const result = await getPool().query(
    `SELECT b.id,b.reference,b.status,b.guest_name,b.payment_status,b.payment_mode,b.players,
       ts.tee_date,to_char(ts.tee_time,'HH24:MI') AS tee_time
     FROM bookings b JOIN tee_slots ts ON ts.id=b.slot_id
     WHERE ($1::uuid IS NOT NULL AND b.id=$1)
        OR ($2::text IS NOT NULL AND b.ticket_token_hash=$2)
     LIMIT 1`,
    [bookingId, ticketHash],
  );
  if (!result.rowCount) return { valid: false, code: 'not_found', message: 'Booking not found.' };
  const booking = result.rows[0];
  if (booking.status === 'checked_in') {
    return { valid: false, code: 'already_used', message: 'This booking has already been checked in.', booking: ticketSummary(booking) };
  }
  if (booking.status !== 'confirmed') {
    return { valid: false, code: 'not_confirmed', message: 'Booking is not active and cannot be checked in.', booking: ticketSummary(booking) };
  }
  const today = await getPool().query("SELECT timezone('Asia/Jakarta',now())::date AS today");
  if (String(booking.tee_date).slice(0, 10) !== String(today.rows[0].today).slice(0, 10)) {
    return { valid: false, code: 'wrong_date', message: 'This booking is not scheduled for today.', booking: ticketSummary(booking) };
  }
  return { valid: true, code: 'valid', message: 'Booking valid.', booking: ticketSummary(booking) };
}

function ticketSummary(booking) {
  return {
    id: booking.id,
    reference: booking.reference,
    guestName: booking.guest_name,
    teeTime: booking.tee_time,
    players: booking.players,
    paymentStatus: booking.payment_status,
    paymentMode: booking.payment_mode,
    attendanceStatus: booking.status,
  };
}

export async function validateBookingTicket({ qrToken }) {
  return resolveBookingTicket(qrToken);
}

export async function checkInBookingById({ staffId, bookingId }) {
  assert(/^[0-9a-f-]{36}$/i.test(bookingId || ''), 400, 'validation_error', 'A valid booking ID is required.');
  return inTransaction((client) => setBookingCheckedIn(client, staffId, bookingId));
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

export async function getTeeSheet({ date, courseId = 1, search = '' }) {
  assert(validDate(date), 400, 'validation_error', 'date must use a valid YYYY-MM-DD date.');
  assert(Number.isInteger(Number(courseId)) && Number(courseId) > 0, 400, 'validation_error', 'courseId must be a positive integer.');
  assert(typeof search === 'string' && search.length <= 120, 400, 'validation_error', 'Search text must be 120 characters or fewer.');
  return inTransaction(async (client) => {
    await ensureSlots(client, Number(courseId), date);
    const result = await client.query(
      `SELECT ts.id,to_char(ts.tee_time,'HH24:MI') AS tee_time,ts.capacity,
         ts.booked_spots,ts.held_spots,ts.status,ts.block_reason,
         (SELECT count(*)::int FROM tee_time_waitlist w
           WHERE w.slot_id=ts.id AND w.status IN ('waiting','held')) AS waitlist_count,
         COALESCE(json_agg(json_build_object(
           'id',b.id,'reference',b.reference,'status',b.status,'players',b.players,
           'guestName',b.guest_name,'guestPhone',b.guest_phone,'teeBox',b.tee_box,
           'paymentStatus',b.payment_status,'checkedInAt',b.checked_in_at,
           'caddyCode',b.caddy_code,'buggy',b.buggy,
           'serviceRequests',json_build_object(
             'preferredCaddy',b.requested_caddy,'rentalNeeds',b.rental_needs
           ),
           'marshalCheckpoints',COALESCE((SELECT json_agg(json_build_object(
             'holeNumber',mc.hole_number,'observedAt',mc.observed_at,'note',mc.note,
             'recordedBy',marshal_user.full_name
           ) ORDER BY mc.hole_number) FROM booking_marshal_checkpoints mc
             JOIN users marshal_user ON marshal_user.id=mc.recorded_by
             WHERE mc.booking_id=b.id),'[]'::json),
           'notes',COALESCE((SELECT json_agg(json_build_object(
             'id',n.id,'note',n.note,'author',u.full_name,'createdAt',n.created_at
           ) ORDER BY n.created_at DESC) FROM booking_operational_notes n
             JOIN users u ON u.id=n.author_user_id WHERE n.booking_id=b.id),'[]'::json),
           'services',COALESCE((SELECT json_agg(json_build_object(
             'serviceType',r.service_type,'status',r.status,'assignedTo',r.assigned_to,
             'note',r.note,'updatedAt',r.updated_at,'updatedBy',staff.full_name
           ) ORDER BY r.service_type) FROM booking_service_readiness r
             JOIN users staff ON staff.id=r.updated_by WHERE r.booking_id=b.id),'[]'::json)
         ) ORDER BY b.created_at) FILTER (WHERE b.id IS NOT NULL),'[]'::json) AS bookings
       FROM tee_slots ts
       LEFT JOIN bookings b ON b.slot_id=ts.id AND b.status IN ('confirmed','checked_in','completed')
         AND ($3::text='' OR b.reference ILIKE '%'||$3||'%' OR b.guest_name ILIKE '%'||$3||'%' OR b.guest_phone ILIKE '%'||$3||'%')
       WHERE ts.course_id=$1 AND ts.tee_date=$2::date
       GROUP BY ts.id ORDER BY ts.tee_time`,
      [Number(courseId), date, search.trim()],
    );
    const report = await client.query(
      `SELECT count(DISTINCT b.id) FILTER (WHERE b.status='confirmed')::int AS confirmed,
         count(DISTINCT b.id) FILTER (WHERE b.status='checked_in')::int AS checked_in,
         count(DISTINCT b.id) FILTER (WHERE b.status='completed')::int AS completed,
         count(DISTINCT b.id) FILTER (WHERE b.status='cancelled')::int AS cancelled,
         COALESCE(sum(ts.capacity),0)::int AS capacity,
         COALESCE(sum(ts.booked_spots),0)::int AS booked,
         COALESCE(sum(ts.held_spots),0)::int AS held
       FROM tee_slots ts LEFT JOIN bookings b ON b.slot_id=ts.id
       WHERE ts.course_id=$1 AND ts.tee_date=$2::date`,
      [Number(courseId), date],
    );
    const summary = report.rows[0];
    return {
      date,
      courseId: Number(courseId),
      summary: {
        confirmed: summary.confirmed,
        checkedIn: summary.checked_in,
        completed: summary.completed,
        cancelled: summary.cancelled,
        capacity: summary.capacity,
        booked: summary.booked,
        held: summary.held,
        available: summary.capacity - summary.booked - summary.held,
      },
      slots: result.rows.map((slot) => ({
        id: String(slot.id),
        time: slot.tee_time,
        capacity: slot.capacity,
        booked: slot.booked_spots,
        held: slot.held_spots,
        available: slot.capacity - slot.booked_spots - slot.held_spots,
        status: slot.status,
        reason: slot.block_reason,
        waitlistCount: slot.waitlist_count,
        bookings: slot.bookings,
      })),
    };
  });
}

export async function getStaffWaitlist({ date }) {
  assert(validDate(date), 400, 'validation_error', 'date must use a valid YYYY-MM-DD date.');
  const result = await getPool().query(
    `SELECT w.id,w.slot_id,w.guest_name,w.guest_phone,w.guest_email,w.players,
       w.status,w.created_at,w.claim_token_expires_at,
       to_char(ts.tee_time,'HH24:MI') AS tee_time
     FROM tee_time_waitlist w
     JOIN tee_slots ts ON ts.id=w.slot_id
     WHERE ts.tee_date=$1::date AND w.status IN ('waiting','held')
     ORDER BY ts.tee_time,w.created_at,w.id LIMIT 200`,
    [date],
  );
  return {
    date,
    entries: result.rows.map((row) => ({
      id: row.id,
      slotId: String(row.slot_id),
      time: row.tee_time,
      name: row.guest_name,
      phone: row.guest_phone,
      email: row.guest_email,
      players: row.players,
      status: row.status,
      createdAt: row.created_at,
      claimExpiresAt: row.claim_token_expires_at,
    })),
  };
}

export async function recordBookingCheckpoint({ staffId, bookingId, holeNumber, note }) {
  assert(/^[0-9a-f-]{36}$/i.test(bookingId || ''), 400, 'validation_error', 'A valid booking ID is required.');
  assert([9, 18].includes(holeNumber), 400, 'validation_error', 'Checkpoint must be hole 9 or 18.');
  const value = String(note || '').trim();
  assert(value.length <= 500, 400, 'validation_error', 'Checkpoint note must be 500 characters or fewer.');
  return inTransaction(async (client) => {
    const booking = await client.query('SELECT id,reference,status FROM bookings WHERE id=$1 FOR UPDATE', [bookingId]);
    assert(booking.rowCount, 404, 'not_found', 'Booking was not found.');
    assert(['checked_in', 'completed'].includes(booking.rows[0].status), 422, 'booking_not_checked_in', 'A checkpoint can only be recorded for a checked-in booking.');
    const result = await client.query(
      `INSERT INTO booking_marshal_checkpoints(booking_id,hole_number,note,recorded_by)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(booking_id,hole_number) DO NOTHING
       RETURNING id,hole_number,observed_at,note`,
      [bookingId, holeNumber, value || null, staffId],
    );
    assert(result.rowCount, 409, 'checkpoint_already_recorded', `A checkpoint for hole ${holeNumber} is already recorded.`);
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
       VALUES($1,'booking.marshal_checkpoint','booking',$2,$3)`,
      [staffId, bookingId, { reference: booking.rows[0].reference, ...result.rows[0] }],
    );
    return { ...result.rows[0], recordedBy: staffId };
  });
}

export async function addBookingOperationalNote({ staffId, bookingId, note }) {
  assert(/^[0-9a-f-]{36}$/i.test(bookingId || ''), 400, 'validation_error', 'A valid booking ID is required.');
  const value = String(note || '').trim();
  assert(value.length >= 1 && value.length <= 1000, 400, 'validation_error', 'Note must be between 1 and 1000 characters.');
  return inTransaction(async (client) => {
    const booking = await client.query('SELECT id,reference FROM bookings WHERE id=$1 FOR UPDATE', [bookingId]);
    assert(booking.rowCount, 404, 'not_found', 'Booking was not found.');
    const result = await client.query(
      `INSERT INTO booking_operational_notes(booking_id,author_user_id,note)
       VALUES($1,$2,$3) RETURNING id,note,created_at`,
      [bookingId, staffId, value],
    );
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
       VALUES($1,'booking.operational_note','booking',$2,$3)`,
      [staffId, bookingId, { reference: booking.rows[0].reference, noteId: result.rows[0].id }],
    );
    return { ...result.rows[0], authorId: staffId };
  });
}

export async function updateBookingServiceReadiness({ staffId, bookingId, serviceType, status, assignedTo, note }) {
  assert(/^[0-9a-f-]{36}$/i.test(bookingId || ''), 400, 'validation_error', 'A valid booking ID is required.');
  assert(['caddy', 'buggy'].includes(serviceType), 400, 'validation_error', 'serviceType must be caddy or buggy.');
  assert(['pending', 'ready'].includes(status), 400, 'validation_error', 'status must be pending or ready.');
  const assignee = String(assignedTo || '').trim();
  const serviceNote = String(note || '').trim();
  assert(assignee.length <= 120 && serviceNote.length <= 500, 400, 'validation_error', 'Assignment or note is too long.');
  return inTransaction(async (client) => {
    const booking = await client.query(
      'SELECT id,reference,status,caddy_code,buggy FROM bookings WHERE id=$1 FOR UPDATE',
      [bookingId],
    );
    assert(booking.rowCount, 404, 'not_found', 'Booking was not found.');
    assert(['confirmed', 'checked_in'].includes(booking.rows[0].status), 422, 'booking_not_editable', 'Only active bookings can have services prepared.');
    assert(
      serviceType === 'caddy' ? Boolean(booking.rows[0].caddy_code) : booking.rows[0].buggy,
      422,
      'service_not_booked',
      `This booking has no ${serviceType} service to prepare.`,
    );
    const before = await client.query(
      'SELECT status,assigned_to,note FROM booking_service_readiness WHERE booking_id=$1 AND service_type=$2 FOR UPDATE',
      [bookingId, serviceType],
    );
    const result = await client.query(
      `INSERT INTO booking_service_readiness(booking_id,service_type,status,assigned_to,note,updated_by,updated_at)
       VALUES($1,$2,$3,$4,$5,$6,now())
       ON CONFLICT(booking_id,service_type) DO UPDATE SET
         status=EXCLUDED.status,assigned_to=EXCLUDED.assigned_to,note=EXCLUDED.note,
         updated_by=EXCLUDED.updated_by,updated_at=now()
       RETURNING booking_id,service_type,status,assigned_to,note,updated_at`,
      [bookingId, serviceType, status, assignee || null, serviceNote || null, staffId],
    );
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,before_state,after_state)
       VALUES($1,'booking.service_readiness','booking',$2,$3,$4)`,
      [staffId, bookingId, before.rows[0] || null, result.rows[0]],
    );
    return result.rows[0];
  });
}

export async function updateStaffPaymentStatus({ staffId, bookingId, paymentStatus }) {
  assert(/^[0-9a-f-]{36}$/i.test(bookingId || ''), 400, 'validation_error', 'A valid booking ID is required.');
  assert(['unpaid', 'down_payment', 'paid'].includes(paymentStatus), 400, 'validation_error', 'Payment status must be unpaid, down_payment, or paid.');
  return inTransaction(async (client) => {
    const result = await client.query(
      'SELECT id,status,payment_status FROM bookings WHERE id=$1 FOR UPDATE',
      [bookingId],
    );
    assert(result.rowCount, 404, 'not_found', 'Booking was not found.');
    const before = result.rows[0];
    assert(['confirmed', 'checked_in'].includes(before.status), 422, 'booking_not_editable', 'Only active bookings can be updated.');
    const updated = await client.query(
      'UPDATE bookings SET payment_status=$2,updated_at=now() WHERE id=$1 RETURNING id,payment_status',
      [bookingId, paymentStatus],
    );
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,before_state,after_state)
       VALUES($1,'booking.payment_recorded','booking',$2,$3,$4)`,
      [staffId, bookingId, before, updated.rows[0]],
    );
    return updated.rows[0];
  });
}

export async function getAdminBookingReport({ date, attendance = 'all', payment = 'all', search = '' }) {
  assert(validDate(date), 400, 'validation_error', 'date must use a valid YYYY-MM-DD date.');
  assert(['all', 'not_arrived', 'arrived'].includes(attendance), 400, 'validation_error', 'Invalid attendance filter.');
  assert(['all', 'unpaid', 'down_payment', 'paid'].includes(payment), 400, 'validation_error', 'Invalid payment filter.');
  assert(typeof search === 'string' && search.length <= 120, 400, 'validation_error', 'Search text must be 120 characters or fewer.');
  const result = await getPool().query(
    `SELECT b.id,b.reference,b.guest_name,b.guest_phone,b.players,b.status,
       b.payment_status,b.payment_mode,b.tee_box,b.package_type,b.total_idr,b.checked_in_at,
       to_char(ts.tee_time,'HH24:MI') AS tee_time
     FROM bookings b JOIN tee_slots ts ON ts.id=b.slot_id
     WHERE ts.tee_date=$1::date
       AND ($2::text='all' OR ($2::text='not_arrived' AND b.status='confirmed')
         OR ($2::text='arrived' AND b.status IN ('checked_in','completed')))
       AND ($3::text='all' OR b.payment_status=$3::text)
       AND ($4::text='' OR b.reference ILIKE '%'||$4||'%'
         OR b.guest_name ILIKE '%'||$4||'%' OR b.guest_phone ILIKE '%'||$4||'%')
     ORDER BY ts.tee_time,b.created_at`,
    [date, attendance, payment, search.trim()],
  );
  return {
    date,
    bookings: result.rows.map((booking) => ({
      id: booking.id,
      reference: booking.reference,
      guestName: booking.guest_name,
      guestPhone: booking.guest_phone,
      players: booking.players,
      teeTime: booking.tee_time,
      attendanceStatus: booking.status,
      paymentStatus: booking.payment_status,
      paymentMode: booking.payment_mode,
      teeBox: booking.tee_box,
      packageType: booking.package_type,
      total: Number(booking.total_idr),
      checkedInAt: booking.checked_in_at,
    })),
  };
}

export async function getAdminAuditLog({ date, action = '', entityType = '' }) {
  assert(!date || validDate(date), 400, 'validation_error', 'date must use a valid YYYY-MM-DD date.');
  assert(typeof action === 'string' && action.length <= 100, 400, 'validation_error', 'action filter is too long.');
  assert(typeof entityType === 'string' && entityType.length <= 60, 400, 'validation_error', 'entityType filter is too long.');
  const result = await getPool().query(
    `SELECT a.id,a.action,a.entity_type,a.entity_id,a.before_state,a.after_state,a.created_at,
       u.full_name AS actor_name,u.email AS actor_email
     FROM audit_log a LEFT JOIN users u ON u.id=a.actor_user_id
     WHERE ($1::date IS NULL OR
       (a.created_at >= ($1::date::timestamp AT TIME ZONE 'Asia/Jakarta')
        AND a.created_at < (($1::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')))
       AND ($2::text='' OR a.action ILIKE '%'||$2||'%')
       AND ($3::text='' OR a.entity_type=$3)
     ORDER BY a.created_at DESC,a.id DESC LIMIT 200`,
    [date || null, action.trim(), entityType.trim()],
  );
  return {
    entries: result.rows.map((row) => ({
      id: row.id,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      actorName: row.actor_name,
      actorEmail: row.actor_email,
      before: row.before_state,
      after: row.after_state,
      createdAt: row.created_at,
    })),
  };
}

export async function searchStaffAccounts({ email }) {
  const search = String(email || '').trim().toLowerCase();
  assert(search.length >= 2 && search.length <= 254, 400, 'validation_error', 'Enter at least 2 characters of an email address.');
  const result = await getPool().query(
    `SELECT id,email,full_name,role,is_active
     FROM users WHERE is_active AND email::text ILIKE '%'||$1||'%'
     ORDER BY email LIMIT 30`,
    [search],
  );
  return { users: result.rows };
}

export async function updateStaffRole({ adminId, userId, role }) {
  assert(/^[0-9a-f-]{36}$/i.test(userId || ''), 400, 'validation_error', 'A valid user ID is required.');
  assert(['member', 'starter', 'front_desk', 'admin'].includes(role), 400, 'validation_error', 'Role is invalid.');
  assert(userId !== adminId, 422, 'self_role_change', 'You cannot change your own role.');
  return inTransaction(async (client) => {
    const result = await client.query('SELECT id,email,full_name,role FROM users WHERE id=$1 AND is_active FOR UPDATE', [userId]);
    assert(result.rowCount, 404, 'not_found', 'Active staff account was not found.');
    const before = result.rows[0];
    const updated = await client.query('UPDATE users SET role=$2,updated_at=now() WHERE id=$1 RETURNING id,email,full_name,role', [userId, role]);
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,before_state,after_state)
       VALUES($1,'staff.role_changed','user',$2,$3,$4)`,
      [adminId, userId, before, updated.rows[0]],
    );
    return updated.rows[0];
  });
}

export async function updateAdminBooking({ adminId, bookingId, attendanceStatus, paymentStatus }) {
  assert(/^[0-9a-f-]{36}$/i.test(bookingId || ''), 400, 'validation_error', 'A valid booking ID is required.');
  assert(attendanceStatus === undefined || ['confirmed', 'checked_in'].includes(attendanceStatus), 400, 'validation_error', 'Attendance status must be confirmed or checked_in.');
  assert(paymentStatus === undefined || ['unpaid', 'down_payment', 'paid'].includes(paymentStatus), 400, 'validation_error', 'Payment status must be unpaid, down_payment, or paid.');
  assert(attendanceStatus !== undefined || paymentStatus !== undefined, 400, 'validation_error', 'At least one booking field must be updated.');

  return inTransaction(async (client) => {
    const result = await client.query(
      'SELECT id,status,payment_status,checked_in_at FROM bookings WHERE id=$1 FOR UPDATE',
      [bookingId],
    );
    assert(result.rowCount, 404, 'not_found', 'Booking was not found.');
    const before = result.rows[0];
    assert(['confirmed', 'checked_in'].includes(before.status), 422, 'booking_not_editable', 'Only active bookings can be changed.');
    const nextAttendance = attendanceStatus ?? before.status;
    const nextPayment = paymentStatus ?? before.payment_status;
    const updated = await client.query(
      `UPDATE bookings SET status=$2,payment_status=$3,
         checked_in_at=CASE
           WHEN $4 THEN COALESCE(checked_in_at,now())
           ELSE NULL
         END,
         updated_at=now()
       WHERE id=$1
       RETURNING id,status,payment_status,checked_in_at`,
      [bookingId, nextAttendance, nextPayment, nextAttendance === 'checked_in'],
    );
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,before_state,after_state)
       VALUES($1,'booking.admin_override','booking',$2,$3,$4)`,
      [adminId, bookingId, before, updated.rows[0]],
    );
    return {
      id: updated.rows[0].id,
      attendanceStatus: updated.rows[0].status,
      paymentStatus: updated.rows[0].payment_status,
      checkedInAt: updated.rows[0].checked_in_at,
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
    const reopenedSlotIds = [];
    for (const slot of slots.rows) {
      const before = { status: slot.status, reason: slot.block_reason };
      const after = await client.query(
        `UPDATE tee_slots SET status=$2,block_reason=$3
         WHERE id=$1 RETURNING id,status,block_reason`,
        [slot.id, blocked ? 'blocked' : 'open', blocked ? String(reason || '').slice(0, 250) || null : null],
      );
      updated.push(after.rows[0]);
      if (!blocked && slot.status === 'blocked') reopenedSlotIds.push(String(slot.id));
      await client.query(
        `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,before_state,after_state)
         VALUES($1,'tee_slot.block','tee_slot',$2,$3,$4)`,
        [adminId, String(slot.id), before, after.rows[0]],
      );
    }
    return { slots: updated, reopenedSlotIds };
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
