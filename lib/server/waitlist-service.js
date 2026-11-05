import { createHash, randomBytes } from 'node:crypto';
import { getPool, inTransaction } from './db';
import { assert } from './errors';
import { processEmailOutbox, queueEmail } from './email-service';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(\+62|62|0)8\d{8,12}$/;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');
const claimTtlMinutes = 10;

function formatDate(value) {
  if (!(value instanceof Date)) return String(value).slice(0, 10);
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${value.getFullYear()}-${month}-${day}`;
}

function publicUrl(path, token) {
  const url = new URL(path, process.env.APP_ORIGIN || 'http://localhost:3000');
  url.searchParams.set(path === '/booking' ? 'waitlistToken' : 'token', token);
  return url.toString();
}

async function createOffer(client, slotId) {
  const slotResult = await client.query(
    'SELECT * FROM tee_slots WHERE id=$1 FOR UPDATE',
    [slotId],
  );
  if (!slotResult.rowCount || slotResult.rows[0].status !== 'open') return null;
  const slot = slotResult.rows[0];
  const expired = await client.query(
    `UPDATE slot_holds SET status='expired'
     WHERE slot_id=$1 AND status='active' AND expires_at<=now()
     RETURNING id,players`,
    [slotId],
  );
  const expiredPlayers = expired.rows.reduce((sum, hold) => sum + hold.players, 0);
  if (expiredPlayers) {
    await client.query(
      'UPDATE tee_slots SET held_spots=GREATEST(0,held_spots-$2) WHERE id=$1',
      [slotId, expiredPlayers],
    );
    await client.query(
      `UPDATE tee_time_waitlist SET status='waiting',hold_id=NULL,claim_token_hash=NULL,
         claim_token_expires_at=NULL,claim_token_used_at=NULL,updated_at=now()
       WHERE hold_id=ANY($1::uuid[]) AND status='held'`,
      [expired.rows.map((hold) => hold.id)],
    );
  }

  const available = slot.capacity - slot.booked_spots - slot.held_spots + expiredPlayers;
  if (available < 1) return null;
  const teeDate = formatDate(slot.tee_date);
  const valid = await client.query(
    `SELECT (($1::date + $2::time) AT TIME ZONE 'Asia/Jakarta') >= now() + interval '60 minutes'
       AND $1::date <= timezone('Asia/Jakarta',now())::date + 60 AS bookable`,
    [teeDate, slot.tee_time],
  );
  if (!valid.rows[0].bookable) return null;

  const candidates = await client.query(
    `SELECT * FROM tee_time_waitlist
     WHERE slot_id=$1 AND status='waiting' AND players<=$2
     ORDER BY created_at,id
     LIMIT 20 FOR UPDATE SKIP LOCKED`,
    [slotId, available],
  );
  const entry = candidates.rows[0];
  if (!entry) return null;

  const claimToken = randomBytes(32).toString('base64url');
  const ipHash = hashToken(`waitlist:${entry.id}`);
  const hold = await client.query(
    `INSERT INTO slot_holds(slot_id,user_id,session_id,client_ip_hash,players,expires_at)
     VALUES($1,$2,$3,$4,$5,now()+interval '${claimTtlMinutes} minutes')
     RETURNING id,expires_at`,
    [slotId, entry.user_id, entry.session_id, ipHash, entry.players],
  );
  await client.query('UPDATE tee_slots SET held_spots=held_spots+$2 WHERE id=$1', [slotId, entry.players]);
  await client.query(
    `UPDATE tee_time_waitlist SET status='held',hold_id=$2,claim_token_hash=$3,
       claim_token_expires_at=now()+interval '${claimTtlMinutes} minutes',
       claim_token_used_at=NULL,updated_at=now()
     WHERE id=$1`,
    [entry.id, hold.rows[0].id, hashToken(claimToken)],
  );
  return {
    entryId: entry.id,
    email: entry.guest_email,
    reference: entry.id.slice(0, 8).toUpperCase(),
    date: teeDate,
    time: slot.tee_time.toString().slice(0, 5),
    players: entry.players,
    token: claimToken,
    expiresAt: hold.rows[0].expires_at,
  };
}

async function sendOffer(offer) {
  if (!offer) return null;
  const key = `waitlist-offer:${offer.entryId}:${hashToken(offer.token)}`;
  await queueEmail({
    dedupeKey: key,
    to: offer.email,
    subject: 'A tee time is available — complete your reservation',
    text: `A tee time is being held for you until ${new Date(offer.expiresAt).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta' })} Jakarta time.\n\nDate: ${offer.date}\nTime: ${offer.time}\nPlayers: ${offer.players}\n\nContinue your reservation here:\n${publicUrl('/booking', offer.token)}\n\nThe reservation is not confirmed until you complete the booking. Payment is made at the club.`,
  });
  const delivery = await processEmailOutbox({ limit: 1, dedupeKey: key });
  return { sent: delivery.sent === 1, queued: delivery.sent !== 1 };
}

export async function registerWaitlist({ session, body }) {
  assert(Number.isSafeInteger(Number(body?.slotId)) && Number(body.slotId) > 0, 400, 'validation_error', 'A valid slotId is required.');
  assert(Number.isInteger(body.players) && body.players >= 1 && body.players <= 4, 400, 'validation_error', 'Players must be an integer from 1 to 4.');
  const member = session.userId
    ? await getPool().query(
      `SELECT full_name,email,phone,email_verified_at FROM users
       WHERE id=$1 AND is_active`,
      [session.userId],
    )
    : null;
  if (session.userId) {
    assert(member.rowCount && member.rows[0].email_verified_at, 403, 'email_verification_required', 'Verify your member email before joining the waitlist.');
  }
  const guestName = String(member?.rows[0]?.full_name || body.name || '').trim();
  const guestEmail = String(member?.rows[0]?.email || body.email || '').trim().toLowerCase();
  const guestPhone = String(member?.rows[0]?.phone || body.phone || '').replace(/[\s-]/g, '');
  assert(guestName.length >= 2 && guestName.length <= 120, 400, 'validation_error', 'Enter a valid full name.');
  assert(EMAIL_PATTERN.test(guestEmail) && guestEmail.length <= 254, 400, 'validation_error', 'Enter a valid email address.');
  assert(PHONE_PATTERN.test(guestPhone), 400, 'validation_error', 'Enter a valid Indonesian mobile number.');

  const verificationToken = session.userId ? null : randomBytes(32).toString('base64url');
  const entry = await inTransaction(async (client) => {
    const slot = await client.query(
      `SELECT ts.*, ((ts.tee_date + ts.tee_time) AT TIME ZONE 'Asia/Jakarta') >= now() + interval '60 minutes'
         AND ts.tee_date <= timezone('Asia/Jakarta',now())::date + 60 AS bookable
       FROM tee_slots ts WHERE ts.id=$1 FOR UPDATE`,
      [Number(body.slotId)],
    );
    assert(slot.rowCount && slot.rows[0].status === 'open', 404, 'not_found', 'The selected tee time is unavailable.');
    assert(slot.rows[0].bookable, 422, 'booking_window_closed', 'The selected tee time is outside the booking window.');
    const existing = await client.query(
      `SELECT id,status FROM tee_time_waitlist WHERE slot_id=$1
       AND ((user_id=$2 AND $2::uuid IS NOT NULL) OR (user_id IS NULL AND guest_email=$3))
       AND status IN ('pending_verification','waiting','held')`,
      [Number(body.slotId), session.userId, guestEmail],
    );
    assert(!existing.rowCount, 409, 'waitlist_exists', 'You already have an active waitlist entry for this tee time.');
    const activeHolds = await client.query(
      `SELECT COALESCE(sum(players),0)::int AS players FROM slot_holds
       WHERE slot_id=$1 AND status='active' AND expires_at>now()`,
      [Number(body.slotId)],
    );
    const available = slot.rows[0].capacity - slot.rows[0].booked_spots - activeHolds.rows[0].players;
    assert(available < body.players, 409, 'slot_available', 'This tee time currently has enough availability; book it directly.');
    const inserted = await client.query(
      `INSERT INTO tee_time_waitlist(
         slot_id,user_id,session_id,guest_name,guest_phone,guest_email,players,status,
         email_token_hash,email_token_expires_at
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,
         CASE WHEN $9::text IS NULL THEN NULL ELSE now()+interval '24 hours' END)
       RETURNING id,status`,
      [
        Number(body.slotId), session.userId, session.id, guestName, guestPhone, guestEmail,
        body.players, verificationToken ? 'pending_verification' : 'waiting',
        verificationToken ? hashToken(verificationToken) : null,
      ],
    );
    return inserted.rows[0];
  });

  if (verificationToken) {
    const key = `waitlist-verify:${entry.id}`;
    await queueEmail({
      dedupeKey: key,
      to: guestEmail,
      subject: 'Verify your email to join the tee-time waitlist',
      text: `Verify your email within 24 hours to join the tee-time waitlist:\n${publicUrl('/waitlist/verify', verificationToken)}`,
    });
    const delivery = await processEmailOutbox({ limit: 1, dedupeKey: key });
    return { id: entry.id, status: entry.status, emailNotification: delivery.sent ? 'sent' : 'queued' };
  }

  const offer = await inTransaction((client) => createOffer(client, Number(body.slotId)));
  const notification = await sendOffer(offer);
  return {
    id: entry.id,
    status: offer ? 'held' : entry.status,
    emailNotification: notification?.sent ? 'sent' : notification ? 'queued' : null,
  };
}

export async function verifyWaitlistEmail({ token, session }) {
  assert(typeof token === 'string' && token.length >= 32 && token.length <= 128, 400, 'invalid_token', 'The verification link is invalid or expired.');
  const entry = await inTransaction(async (client) => {
    const result = await client.query(
      `SELECT id,slot_id,user_id,status FROM tee_time_waitlist
       WHERE email_token_hash=$1 AND email_token_expires_at>now()
       AND status='pending_verification' FOR UPDATE`,
      [hashToken(token)],
    );
    assert(result.rowCount, 400, 'invalid_token', 'The verification link is invalid or expired.');
    const waitlist = result.rows[0];
    if (waitlist.user_id) assert(waitlist.user_id === session.userId, 403, 'forbidden', 'Sign in to the member account that joined the waitlist.');
    await client.query(
      `UPDATE tee_time_waitlist SET status='waiting',session_id=$2,email_token_hash=NULL,
       email_token_expires_at=NULL,updated_at=now() WHERE id=$1`,
      [waitlist.id, session.id],
    );
    return waitlist;
  });
  const offer = await inTransaction((client) => createOffer(client, entry.slot_id));
  const notification = await sendOffer(offer);
  return { verified: true, status: offer ? 'held' : 'waiting', emailNotification: notification?.sent ? 'sent' : notification ? 'queued' : null };
}

export async function offerWaitlistForSlot(slotId) {
  const notifications = [];
  for (let count = 0; count < 20; count += 1) {
    const offer = await inTransaction((client) => createOffer(client, slotId));
    if (!offer) break;
    notifications.push(await sendOffer(offer));
  }
  if (!notifications.length) return null;
  return {
    sent: notifications.every((notification) => notification.sent),
    queued: notifications.some((notification) => notification.queued),
  };
}

export async function claimWaitlistOffer({ token, session }) {
  assert(typeof token === 'string' && token.length >= 32 && token.length <= 128, 400, 'invalid_token', 'The waitlist link is invalid or expired.');
  return inTransaction(async (client) => {
    const result = await client.query(
      `SELECT w.*,h.expires_at,h.status AS hold_status,ts.tee_date,
         to_char(ts.tee_time,'HH24:MI') AS tee_time
       FROM tee_time_waitlist w JOIN slot_holds h ON h.id=w.hold_id
       JOIN tee_slots ts ON ts.id=w.slot_id
       WHERE w.claim_token_hash=$1 AND w.status='held'
         AND w.claim_token_expires_at>now() AND h.status='active' AND h.expires_at>now()
       FOR UPDATE OF w,h`,
      [hashToken(token)],
    );
    assert(result.rowCount, 410, 'waitlist_offer_expired', 'This waitlist offer has expired. Join the waitlist again for another opportunity.');
    const entry = result.rows[0];
    if (entry.claim_token_used_at) {
      assert(entry.session_id === session.id, 410, 'waitlist_offer_claimed', 'This waitlist offer has already been claimed in another session.');
    } else {
      if (entry.user_id) assert(entry.user_id === session.userId, 403, 'forbidden', 'Sign in to the member account that joined the waitlist.');
      assert(!session.userId || session.userId === entry.user_id, 403, 'forbidden', 'This offer belongs to a different account.');
      await client.query(
        `UPDATE slot_holds SET session_id=$2,user_id=$3 WHERE id=$1`,
        [entry.hold_id, session.id, entry.user_id],
      );
      await client.query(
        `UPDATE tee_time_waitlist SET session_id=$2,claim_token_used_at=now(),updated_at=now()
         WHERE id=$1`,
        [entry.id, session.id],
      );
    }
    return {
      holdId: entry.hold_id,
      slot: { slotId: String(entry.slot_id), time: entry.tee_time, spotsLeft: entry.players },
      dateKey: entry.tee_date instanceof Date ? entry.tee_date.toISOString().slice(0, 10) : String(entry.tee_date).slice(0, 10),
      players: entry.players,
      expiresAt: entry.expires_at,
      guest: { name: entry.guest_name, phone: entry.guest_phone, email: entry.guest_email, notes: '' },
      waitlistId: entry.id,
    };
  });
}

export async function listMemberWaitlist(userId) {
  const result = await getPool().query(
    `SELECT w.id,w.status,w.players,w.created_at,w.updated_at,
       ts.tee_date,to_char(ts.tee_time,'HH24:MI') AS tee_time
     FROM tee_time_waitlist w JOIN tee_slots ts ON ts.id=w.slot_id
     WHERE w.user_id=$1 AND w.status IN ('waiting','held')
     ORDER BY ts.tee_date,ts.tee_time`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    status: row.status,
    players: row.players,
    date: row.tee_date instanceof Date ? row.tee_date.toISOString().slice(0, 10) : String(row.tee_date).slice(0, 10),
    time: row.tee_time,
  }));
}

export async function cancelMemberWaitlist({ userId, waitlistId }) {
  return inTransaction(async (client) => {
    const reference = await client.query(
      `SELECT slot_id FROM tee_time_waitlist
       WHERE id=$1 AND user_id=$2 AND status IN ('waiting','held')`,
      [waitlistId, userId],
    );
    assert(reference.rowCount, 404, 'not_found', 'Waitlist entry was not found.');
    const slotId = reference.rows[0].slot_id;
    await client.query('SELECT id FROM tee_slots WHERE id=$1 FOR UPDATE', [slotId]);
    const result = await client.query(
      `SELECT id,status,hold_id FROM tee_time_waitlist
       WHERE id=$1 AND user_id=$2 AND status IN ('waiting','held')
       FOR UPDATE`,
      [waitlistId, userId],
    );
    assert(result.rowCount, 404, 'not_found', 'Waitlist entry was not found.');
    const entry = result.rows[0];
    if (entry.status === 'held' && entry.hold_id) {
      const released = await client.query(
        `UPDATE slot_holds SET status='released' WHERE id=$1 AND status='active' AND expires_at>now() RETURNING players`,
        [entry.hold_id],
      );
      if (released.rowCount) {
        await client.query('UPDATE tee_slots SET held_spots=held_spots-$2 WHERE id=$1', [slotId, released.rows[0].players]);
      }
    }
    await client.query(
      `UPDATE tee_time_waitlist SET status='cancelled',claim_token_hash=NULL,
       claim_token_expires_at=NULL,updated_at=now() WHERE id=$1`,
      [waitlistId],
    );
    return { cancelled: true, slotId };
  });
}
