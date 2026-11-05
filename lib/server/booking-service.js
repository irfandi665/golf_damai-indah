import { randomBytes, randomUUID } from 'node:crypto';
import { getPool, inTransaction } from './db';
import { ApiError, assert } from './errors';

const MAX_PLAYERS = 4;
const TAX_RATE_BPS = 1100;
const HOLD_MINUTES = 10;
const EXTRAS = new Set(['rentalClubs', 'rangeWarmup', 'halfwayOrder']);

const currency = (amount) => `Rp${new Intl.NumberFormat('id-ID').format(amount)}`;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatDate(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function isValidDate(value) {
  if (!datePattern.test(value || '')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validatePlayers(value) {
  assert(Number.isInteger(value) && value >= 1 && value <= MAX_PLAYERS, 400, 'validation_error', 'Players must be an integer from 1 to 4.', [
    { field: 'players', message: 'Must be an integer from 1 to 4.' },
  ]);
}

function validateExtras(extras, players) {
  assert(extras && typeof extras === 'object' && !Array.isArray(extras), 400, 'validation_error', 'Extras must be an object.');
  for (const [code, quantity] of Object.entries(extras)) {
    assert(EXTRAS.has(code), 400, 'validation_error', `Unknown extra: ${code}.`);
    assert(Number.isInteger(quantity) && quantity >= 0 && quantity <= players, 400, 'validation_error', `${code} must be an integer from 0 to players.`);
  }
}

async function validateBookableDate(client, date, time) {
  assert(isValidDate(date), 400, 'validation_error', 'Date must use YYYY-MM-DD.');
  assert(timePattern.test(time || ''), 400, 'validation_error', 'Tee time must use HH:mm.');
  const result = await client.query(
    `SELECT
       ($1::date >= timezone('Asia/Jakarta', now())::date) AS not_past,
       ($1::date <= timezone('Asia/Jakarta', now())::date + 60) AS in_window,
       (($1::date + $2::time) AT TIME ZONE 'Asia/Jakarta') >= now() + interval '60 minutes' AS lead_ok`,
    [date, time],
  );
  const row = result.rows[0];
  assert(row.not_past, 422, 'booking_window_closed', 'The selected date has passed.');
  assert(row.in_window, 422, 'booking_window_closed', 'The selected date is outside the public booking window.');
  assert(row.lead_ok, 422, 'lead_time_passed', 'Bookings must be made at least 60 minutes before tee time.');
}

export async function ensureSlots(client, courseId, date) {
  await client.query(
    `INSERT INTO tee_slots (course_id, tee_date, tee_time)
     SELECT $1, $2::date, (time '06:00' + make_interval(mins => step * 10))
     FROM generate_series(0, 48) AS step
     ON CONFLICT (course_id, tee_date, tee_time) DO NOTHING`,
    [courseId, date],
  );
}

async function getSlot(client, slotId, { lock = false } = {}) {
  const result = await client.query(
    `SELECT ts.*, c.timezone
     FROM tee_slots ts JOIN courses c ON c.id = ts.course_id
     WHERE ts.id = $1 ${lock ? 'FOR UPDATE OF ts' : ''}`,
    [slotId],
  );
  assert(result.rowCount, 404, 'not_found', 'Tee time was not found.');
  return result.rows[0];
}

async function releaseExpiredHolds(client, slotId) {
  const expired = await client.query(
    `UPDATE slot_holds SET status = 'expired'
     WHERE slot_id = $1 AND status = 'active' AND expires_at <= now()
     RETURNING players`,
    [slotId],
  );
  const released = expired.rows.reduce((sum, hold) => sum + hold.players, 0);
  if (released) {
    await client.query(
      'UPDATE tee_slots SET held_spots = held_spots - $2 WHERE id = $1 AND held_spots >= $2',
      [slotId, released],
    );
  }
  return released;
}

async function getPrice(client, courseId, date, time) {
  const result = await client.query(
    `SELECT r.tier, r.price_per_player_idr
     FROM rate_cards r
     WHERE r.course_id = $1
       AND (r.day_type = CASE
         WHEN extract(isodow FROM $2::date) IN (6, 7)
           OR EXISTS (SELECT 1 FROM premium_dates p WHERE p.course_id = $1 AND p.day = $2::date)
         THEN 'premium' ELSE 'weekday' END)
       AND $3::time >= r.start_time AND $3::time < r.end_time
       AND $2::date >= r.valid_from
       AND (r.valid_to IS NULL OR $2::date <= r.valid_to)
     ORDER BY r.valid_from DESC LIMIT 1`,
    [courseId, date, time],
  );
  assert(result.rowCount, 503, 'rate_card_unavailable', 'No active rate is configured for this tee time.');
  return {
    tier: result.rows[0].tier,
    pricePerPlayer: Number(result.rows[0].price_per_player_idr),
  };
}

export async function listTeeTimes({ courseId = 1, date, players }) {
  validatePlayers(players);
  assert(Number.isInteger(Number(courseId)) && Number(courseId) > 0, 400, 'validation_error', 'courseId must be a positive integer.');
  assert(isValidDate(date), 400, 'validation_error', 'date must use YYYY-MM-DD.');
  return inTransaction(async (client) => {
    await validateBookableDate(client, date, '23:59');
    await ensureSlots(client, Number(courseId), date);
    const result = await client.query(
      `SELECT ts.id, to_char(ts.tee_time, 'HH24:MI') AS time, ts.capacity,
         ts.status,
         ts.booked_spots,
         ts.held_spots - COALESCE(expired.players, 0) AS held_spots,
         r.tier, r.price_per_player_idr,
         (($2::date + ts.tee_time) AT TIME ZONE 'Asia/Jakarta') < now() + interval '60 minutes' AS closed
       FROM tee_slots ts
       LEFT JOIN LATERAL (
         SELECT sum(h.players)::integer AS players FROM slot_holds h
         WHERE h.slot_id = ts.id AND h.status = 'active' AND h.expires_at <= now()
       ) expired ON true
       LEFT JOIN LATERAL (
         SELECT rc.tier, rc.price_per_player_idr FROM rate_cards rc
         WHERE rc.course_id = ts.course_id
           AND rc.day_type = CASE
             WHEN extract(isodow FROM ts.tee_date) IN (6, 7)
               OR EXISTS (SELECT 1 FROM premium_dates p WHERE p.course_id = ts.course_id AND p.day = ts.tee_date)
             THEN 'premium' ELSE 'weekday' END
           AND ts.tee_time >= rc.start_time AND ts.tee_time < rc.end_time
           AND ts.tee_date >= rc.valid_from
           AND (rc.valid_to IS NULL OR ts.tee_date <= rc.valid_to)
         ORDER BY rc.valid_from DESC LIMIT 1
       ) r ON true
       WHERE ts.course_id = $1 AND ts.tee_date = $2::date
       ORDER BY ts.tee_time`,
      [Number(courseId), date],
    );

    return {
      date,
      courseId: Number(courseId),
      players,
      slots: result.rows.map((row) => {
        const spotsLeft = Math.max(0, row.capacity - row.booked_spots - row.held_spots);
        const status = row.status === 'blocked'
          ? 'blocked'
          : row.closed
            ? 'closed'
            : spotsLeft === 0
              ? 'full'
              : spotsLeft <= 2
                ? 'limited'
                : 'available';
        return {
          slotId: String(row.id),
          time: row.time,
          spotsLeft,
          tier: row.tier,
          pricePerPlayer: Number(row.price_per_player_idr || 0),
          status,
        };
      }),
    };
  });
}

export async function createHold({ session, slotId, players, clientIpHash }) {
  validatePlayers(players);
  return inTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1)::bigint)', [clientIpHash]);
    await client.query('SELECT id FROM sessions WHERE id=$1 FOR UPDATE', [session.id]);
    const slot = await getSlot(client, slotId, { lock: true });
    slot.held_spots -= await releaseExpiredHolds(client, slot.id);
    await validateBookableDate(client, formatDate(slot.tee_date), slot.tee_time.toString().slice(0, 5));

    const active = await client.query(
      `SELECT id, slot_id, players FROM slot_holds
       WHERE session_id = $1 AND status = 'active' AND expires_at > now()
       ORDER BY created_at DESC FOR UPDATE`,
      [session.id],
    );
    const activeForIp = await client.query(
      `SELECT count(*)::int AS count FROM slot_holds
       WHERE client_ip_hash=$1 AND status='active' AND expires_at>now()`,
      [clientIpHash],
    );
    const replacement = active.rows.find((hold) => String(hold.slot_id) === String(slot.id));
    if (replacement) {
      await client.query("UPDATE slot_holds SET status = 'released' WHERE id = $1", [replacement.id]);
      await client.query('UPDATE tee_slots SET held_spots = held_spots - $2 WHERE id = $1', [slot.id, replacement.players]);
      slot.held_spots -= replacement.players;
    } else {
      assert(active.rowCount < 2, 429, 'rate_limited', 'At most two active tee-time holds are allowed per session.');
      assert(activeForIp.rows[0].count < 2, 429, 'rate_limited', 'At most two active tee-time holds are allowed per IP address.');
    }

    const availableSpots = slot.capacity - slot.booked_spots - slot.held_spots;
    assert(slot.status === 'open' && availableSpots >= players, 409, 'slot_unavailable', 'There are not enough places left in this tee time.', [
      { field: 'availableSpots', message: String(Math.max(0, availableSpots)) },
    ]);

    const updated = await client.query(
      `UPDATE tee_slots SET held_spots = held_spots + $2
       WHERE id = $1 AND status = 'open' AND booked_spots + held_spots + $2 <= capacity
       RETURNING id`,
      [slot.id, players],
    );
    assert(updated.rowCount, 409, 'slot_unavailable', 'The tee time was just taken.');
    const hold = await client.query(
      `INSERT INTO slot_holds (slot_id, user_id, session_id, client_ip_hash, players, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + interval '${HOLD_MINUTES} minutes')
       RETURNING id, slot_id, players, expires_at`,
      [slot.id, session.userId, session.id, clientIpHash, players],
    );
    return {
      holdId: hold.rows[0].id,
      slotId: String(hold.rows[0].slot_id),
      players: hold.rows[0].players,
      expiresAt: hold.rows[0].expires_at,
    };
  });
}

export async function releaseHold({ session, holdId }) {
  return inTransaction(async (client) => {
    const reference = await client.query(
      'SELECT slot_id FROM slot_holds WHERE id = $1 AND session_id = $2',
      [holdId, session.id],
    );
    assert(reference.rowCount, 404, 'not_found', 'Hold was not found.');
    await client.query('SELECT id FROM tee_slots WHERE id=$1 FOR UPDATE', [reference.rows[0].slot_id]);
    await releaseExpiredHolds(client, reference.rows[0].slot_id);
    const holdResult = await client.query(
      'SELECT * FROM slot_holds WHERE id = $1 AND session_id = $2 FOR UPDATE',
      [holdId, session.id],
    );
    const hold = holdResult.rows[0];
    if (hold.status === 'active') {
      await client.query("UPDATE slot_holds SET status = 'released' WHERE id = $1", [hold.id]);
      if (new Date(hold.expires_at) > new Date()) {
        await client.query('UPDATE tee_slots SET held_spots = held_spots - $2 WHERE id = $1', [hold.slot_id, hold.players]);
      }
    }
    return { released: true };
  });
}

export async function quoteForHold({ session, holdId, caddy, buggy, extras, transactionClient }) {
  assert(typeof buggy === 'boolean', 400, 'validation_error', 'buggy must be a boolean.');
  const calculate = async (client) => {
    const result = await client.query(
      `SELECT h.*, ts.course_id, ts.tee_date, to_char(ts.tee_time, 'HH24:MI') AS tee_time
       FROM slot_holds h JOIN tee_slots ts ON ts.id = h.slot_id
       WHERE h.id = $1 AND h.session_id = $2 AND h.status = 'active' AND h.expires_at > now()
       FOR UPDATE OF h`,
      [holdId, session.id],
    );
    assert(result.rowCount, 409, 'hold_expired', 'The hold has expired or is no longer available.');
    const hold = result.rows[0];
    validateExtras(extras, hold.players);
    const price = await getPrice(client, hold.course_id, formatDate(hold.tee_date), hold.tee_time);
    const lines = [{
      id: 'greenFee',
      itemCode: 'green_fee',
      label: 'Green Fee',
      quantity: hold.players,
      unitPriceIdr: price.pricePerPlayer,
      amount: price.pricePerPlayer * hold.players,
      detail: `${hold.players} × ${currency(price.pricePerPlayer)}`,
    }];

    if (caddy !== null && caddy !== undefined) {
      const option = await client.query(
        "SELECT code, label, unit_price_idr FROM service_items WHERE code = $1 AND kind = 'caddy' AND active",
        [caddy],
      );
      assert(option.rowCount, 400, 'validation_error', 'Choose an active caddy option.');
      const unitPriceIdr = Number(option.rows[0].unit_price_idr);
      lines.push({
        id: option.rows[0].code,
        itemCode: option.rows[0].code,
        label: option.rows[0].label,
        quantity: hold.players,
        unitPriceIdr,
        amount: unitPriceIdr * hold.players,
        detail: `${hold.players} × ${currency(unitPriceIdr)}`,
      });
    }

    if (buggy) {
      const item = await client.query(
        "SELECT label, unit_price_idr FROM service_items WHERE code = 'buggy' AND active",
      );
      assert(item.rowCount, 503, 'service_unavailable', 'Buggy pricing is not configured.');
      const carts = Math.ceil(hold.players / 2);
      const unitPriceIdr = Number(item.rows[0].unit_price_idr);
      lines.push({
        id: 'buggy',
        itemCode: 'buggy',
        label: item.rows[0].label,
        quantity: carts,
        unitPriceIdr,
        amount: unitPriceIdr * carts,
        detail: `${carts} × ${currency(unitPriceIdr)}`,
      });
    }

    for (const [code, quantity] of Object.entries(extras)) {
      if (!quantity) continue;
      const item = await client.query(
        "SELECT label, unit_price_idr FROM service_items WHERE code = $1 AND kind = 'extra' AND active",
        [code],
      );
      assert(item.rowCount, 400, 'validation_error', `${code} is not available.`);
      const unitPriceIdr = Number(item.rows[0].unit_price_idr);
      lines.push({
        id: code,
        itemCode: code,
        label: item.rows[0].label,
        quantity,
        unitPriceIdr,
        amount: unitPriceIdr * quantity,
        detail: `${quantity} × ${currency(unitPriceIdr)}`,
      });
    }

    const subtotal = lines.reduce((sum, item) => sum + item.amount, 0);
    const tax = Math.round(subtotal * TAX_RATE_BPS / 10000);
    return {
      slot: { id: String(hold.slot_id), date: formatDate(hold.tee_date), time: hold.tee_time, tier: price.tier },
      players: hold.players,
      caddy: caddy || null,
      buggy,
      extras,
      lines: lines.map(({ itemCode, unitPriceIdr, ...line }) => ({ ...line, amount: line.amount })),
      subtotal,
      taxRateBps: TAX_RATE_BPS,
      tax,
      total: subtotal + tax,
      perPlayer: Math.round((subtotal + tax) / hold.players),
      items: lines,
    };
  };
  return transactionClient ? calculate(transactionClient) : inTransaction(calculate);
}

export function newReference() {
  return `DIG-${randomBytes(5).toString('hex').toUpperCase()}`;
}

export async function createBooking({ session, body, idempotencyKey }) {
  assert(typeof body?.holdId === 'string', 400, 'validation_error', 'holdId is required.');
  assert(body.termsAccepted === true, 400, 'validation_error', 'Booking terms must be accepted.');
  assert(body.guest && typeof body.guest === 'object', 400, 'validation_error', 'Guest details are required.');
  const name = String(body.guest.name || '').trim();
  const phone = String(body.guest.phone || '').replace(/[\s-]/g, '');
  const email = String(body.guest.email || '').trim().toLowerCase();
  assert(name.length >= 2 && name.length <= 120, 400, 'validation_error', 'Enter a valid guest name.');
  assert(/^(\+62|62|0)8\d{8,12}$/.test(phone), 400, 'validation_error', 'Enter a valid Indonesian mobile number.');
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254, 400, 'validation_error', 'Enter a valid email address.');
  const notes = String(body.notes || '').trim();
  assert(notes.length <= 1000, 400, 'validation_error', 'Notes must be 1000 characters or fewer.');
  assert(idempotencyKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey), 400, 'validation_error', 'A UUID Idempotency-Key header is required.');

  const paymentMode = 'pay_at_club';
  return inTransaction(async (client) => {
    const scope = `${session.userId || session.id}:POST:/api/v1/bookings`;
    const hash = JSON.stringify(body);
    const inserted = await client.query(
      `INSERT INTO idempotency_keys (scope, key, request_hash)
       VALUES ($1, $2, encode(digest($3, 'sha256'), 'hex'))
       ON CONFLICT DO NOTHING RETURNING key`,
      [scope, idempotencyKey, hash],
    );
    if (!inserted.rowCount) {
      const prior = await client.query(
        'SELECT request_hash, response_status, response_body FROM idempotency_keys WHERE scope = $1 AND key = $2 FOR UPDATE',
        [scope, idempotencyKey],
      );
      const currentHash = await client.query("SELECT encode(digest($1, 'sha256'), 'hex') AS value", [hash]);
      assert(prior.rows[0].request_hash === currentHash.rows[0].value, 409, 'idempotency_conflict', 'This Idempotency-Key was already used with a different request.');
      assert(prior.rows[0].response_body, 409, 'request_in_progress', 'A request using this Idempotency-Key is still in progress.');
      return { status: prior.rows[0].response_status, body: prior.rows[0].response_body };
    }

    const holdReference = await client.query(
      `SELECT h.*, ts.course_id, ts.tee_date, ts.tee_time
       FROM slot_holds h JOIN tee_slots ts ON ts.id = h.slot_id
       WHERE h.id = $1 AND h.session_id = $2`,
      [body.holdId, session.id],
    );
    assert(holdReference.rowCount, 409, 'hold_expired', 'The hold has expired or is no longer available.');
    await client.query('SELECT id FROM tee_slots WHERE id=$1 FOR UPDATE', [holdReference.rows[0].slot_id]);
    await releaseExpiredHolds(client, holdReference.rows[0].slot_id);
    const holdResult = await client.query(
      `SELECT h.*, ts.course_id, ts.tee_date, ts.tee_time
       FROM slot_holds h JOIN tee_slots ts ON ts.id = h.slot_id
       WHERE h.id = $1 AND h.session_id = $2 AND h.status = 'active' AND h.expires_at > now()
       FOR UPDATE OF h`,
      [body.holdId, session.id],
    );
    assert(holdResult.rowCount, 409, 'hold_expired', 'The hold has expired or is no longer available.');
    const hold = holdResult.rows[0];
    await client.query('SELECT id FROM tee_slots WHERE id = $1 FOR UPDATE', [hold.slot_id]);
    await validateBookableDate(client, formatDate(hold.tee_date), hold.tee_time.toString().slice(0, 5));

    const quote = await quoteForHold({
      session,
      holdId: body.holdId,
      caddy: body.caddy,
      buggy: body.buggy,
      extras: body.extras || {},
      transactionClient: client,
    });
    assert(Number.isSafeInteger(body.clientTotal), 400, 'validation_error', 'clientTotal must be an integer in rupiah.');
    if (body.clientTotal !== quote.total) {
      throw new ApiError(409, 'price_changed', 'The server price has changed. Review the updated quote.', [
        { field: 'quote', message: JSON.stringify({ lines: quote.lines, subtotal: quote.subtotal, taxRateBps: quote.taxRateBps, tax: quote.tax, total: quote.total, perPlayer: quote.perPlayer }) },
      ]);
    }

    const bookingId = randomUUID();
    const reference = newReference();
    const status = 'confirmed';
    const booking = await client.query(
      `INSERT INTO bookings (
         id, reference, user_id, session_id, slot_id, hold_id, players, status,
         payment_mode, guest_name, guest_phone, guest_email, notes, caddy_code,
         buggy, tax_rate_bps, subtotal_idr, tax_idr, total_idr, terms_accepted_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,now())
       RETURNING id, reference, status, total_idr, slot_id`,
      [
        bookingId, reference, session.userId, session.id, hold.slot_id, hold.id, hold.players,
        status, paymentMode, name, phone, email, notes, body.caddy || null, body.buggy,
        quote.taxRateBps, quote.subtotal, quote.tax, quote.total,
      ],
    );
    for (const item of quote.items) {
      await client.query(
        `INSERT INTO booking_items (booking_id, item_code, label, quantity, unit_price_idr, amount_idr)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [bookingId, item.itemCode, item.label, item.quantity, item.unitPriceIdr, item.amount],
      );
    }
    await client.query('UPDATE tee_slots SET held_spots = held_spots - $2, booked_spots = booked_spots + $2 WHERE id = $1', [hold.slot_id, hold.players]);
    await client.query("UPDATE slot_holds SET status = 'converted', expires_at = now() WHERE id = $1", [hold.id]);

    const accessToken = session.userId ? null : randomBytes(32).toString('base64url');
    if (accessToken) {
      const { createHash } = await import('node:crypto');
      await client.query(
        'INSERT INTO booking_access_tokens (token_hash, booking_id, expires_at) VALUES ($1, $2, now() + interval \'30 days\')',
        [createHash('sha256').update(accessToken).digest('hex'), bookingId],
      );
    }

    const responseBody = {
      id: booking.rows[0].id,
      reference: booking.rows[0].reference,
      status,
      total: Number(booking.rows[0].total_idr),
      paymentMode,
      ...(accessToken ? { accessToken } : {}),
    };
    const result = { status: 201, body: responseBody };
    await client.query(
      'UPDATE idempotency_keys SET response_status = $3, response_body = $4 WHERE scope = $1 AND key = $2',
      [scope, idempotencyKey, result.status, result.body],
    );
    return result;
  });
}

export async function getBooking({ id, session, accessToken }) {
  const result = await getPool().query(
    `SELECT b.id, b.user_id, b.session_id, b.reference, b.status, b.payment_mode, b.players,
       b.guest_name, b.guest_phone, b.guest_email, b.total_idr, b.subtotal_idr,
       b.tax_idr, b.created_at, ts.tee_date, to_char(ts.tee_time, 'HH24:MI') AS tee_time
     FROM bookings b JOIN tee_slots ts ON ts.id = b.slot_id WHERE b.id = $1`,
    [id],
  );
  const booking = result.rows[0];
  if (!booking) throw new ApiError(404, 'not_found', 'Booking was not found.');
  let allowed = Boolean(session?.userId && session.userId === booking.user_id);
  if (!allowed && session?.id) {
    const owner = await getPool().query('SELECT 1 FROM bookings WHERE id = $1 AND session_id = $2', [id, session.id]);
    allowed = Boolean(owner.rowCount);
  }
  if (!allowed && accessToken) {
    const { createHash } = await import('node:crypto');
    const access = await getPool().query(
      'SELECT 1 FROM booking_access_tokens WHERE booking_id = $1 AND token_hash = $2 AND expires_at > now()',
      [id, createHash('sha256').update(accessToken).digest('hex')],
    );
    allowed = Boolean(access.rowCount);
  }
  assert(allowed, 404, 'not_found', 'Booking was not found.');
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    paymentMode: booking.payment_mode,
    date: formatDate(booking.tee_date),
    time: booking.tee_time,
    players: booking.players,
    guest: { name: booking.guest_name, phone: booking.guest_phone, email: booking.guest_email },
    total: Number(booking.total_idr),
    subtotal: Number(booking.subtotal_idr),
    tax: Number(booking.tax_idr),
  };
}

export async function cancelBooking({ bookingId, session, idempotencyKey }) {
  assert(idempotencyKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey), 400, 'validation_error', 'A UUID Idempotency-Key header is required.');
  return inTransaction(async (client) => {
    const scope = `${session.userId || session.id}:POST:/api/v1/bookings/${bookingId}/cancel`;
    const bodyHash = `${bookingId}`;
    const insert = await client.query(
      `INSERT INTO idempotency_keys (scope, key, request_hash) VALUES ($1,$2,encode(digest($3,'sha256'),'hex'))
       ON CONFLICT DO NOTHING RETURNING key`,
      [scope, idempotencyKey, bodyHash],
    );
    if (!insert.rowCount) {
      const previous = await client.query('SELECT response_status, response_body FROM idempotency_keys WHERE scope=$1 AND key=$2 FOR UPDATE', [scope, idempotencyKey]);
      assert(previous.rowCount, 409, 'idempotency_conflict', 'Idempotency key conflict.');
      assert(previous.rows[0].response_body, 409, 'request_in_progress', 'The cancellation request is in progress.');
      return { status: previous.rows[0].response_status, body: previous.rows[0].response_body };
    }

    const result = await client.query(
      `SELECT b.*, ts.tee_date, ts.tee_time, ts.id AS slot_id
       FROM bookings b JOIN tee_slots ts ON ts.id = b.slot_id
       WHERE b.id = $1 AND (b.user_id = $2 OR b.session_id = $3)
       FOR UPDATE OF b`,
      [bookingId, session.userId, session.id],
    );
    assert(result.rowCount, 404, 'not_found', 'Booking was not found.');
    const booking = result.rows[0];
    assert(booking.status === 'confirmed', 422, 'not_cancellable', 'Only a confirmed booking can be cancelled.');
    const teeDate = formatDate(booking.tee_date);
    const cancellation = await client.query(
      `SELECT (($1::date + $2::time) AT TIME ZONE 'Asia/Jakarta') AS tee_at,
              now() AS current_time`,
      [teeDate, booking.tee_time],
    );
    const teeAt = new Date(cancellation.rows[0].tee_at);
    const now = new Date(cancellation.rows[0].current_time);
    assert(now < teeAt, 422, 'not_cancellable', 'A booking cannot be cancelled after tee time.');
    await client.query('SELECT id FROM tee_slots WHERE id=$1 FOR UPDATE', [booking.slot_id]);
    const kind = now.getTime() < teeAt.getTime() - 24 * 3600000 ? 'free' : 'late';
    await client.query(
      `UPDATE bookings SET status='cancelled', cancel_kind=$2, cancelled_at=now(), updated_at=now()
       WHERE id=$1`,
      [bookingId, kind],
    );
    await client.query('UPDATE tee_slots SET booked_spots=booked_spots-$2 WHERE id=$1 AND booked_spots >= $2', [booking.slot_id, booking.players]);

    let voucher = null;
    if (kind === 'late' && booking.user_id) {
      const greenFee = await client.query(
        `SELECT amount_idr FROM booking_items WHERE booking_id=$1 AND item_code='green_fee'`,
        [bookingId],
      );
      if (greenFee.rowCount) {
        const valid = await client.query(
          `INSERT INTO vouchers (user_id, code, kind, label, source, value_idr, valid_until)
           VALUES ($1, $2, 'rain_check', 'Rain-check Voucher (Green Fee)', $3, $4, current_date + 90)
           RETURNING id, code, label, value_idr, valid_until`,
          [booking.user_id, `RC-${randomBytes(8).toString('hex').toUpperCase()}`, `rain_check:${bookingId}`, greenFee.rows[0].amount_idr],
        );
        voucher = { ...valid.rows[0], value: Number(valid.rows[0].value_idr) };
      }
    }

    const body = {
      booking: { id: bookingId, reference: booking.reference, status: 'cancelled' },
      kind,
      voucher,
    };
    await client.query(
      'UPDATE idempotency_keys SET response_status=200,response_body=$3 WHERE scope=$1 AND key=$2',
      [scope, idempotencyKey, body],
    );
    return { status: 200, body };
  });
}
