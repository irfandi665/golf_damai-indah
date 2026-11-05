import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { createRequire } from 'node:module';
import pg from 'pg';
import { createClient } from 'redis';

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const { Pool } = pg;
const apiOrigin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
const apiUrl = new URL(apiOrigin);
const databaseUrl = process.env.DATABASE_URL;
const redisUrl = process.env.REDIS_URL;
const database = databaseUrl ? new URL(databaseUrl) : null;
const redisAddress = redisUrl ? new URL(redisUrl) : null;
const pool = databaseUrl
  ? new Pool({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
  })
  : null;
const redis = redisUrl ? createClient({ url: redisUrl }) : null;

const cookieJar = new Map();
const sessionTokens = new Set();
const createdSlotIds = new Set();
const createdInquiryIds = new Set();
const testDates = new Set();
const testAddress = `192.0.2.${Math.floor(Math.random() * 254) + 1}`;
const holdAddresses = [
  `192.0.2.${Math.floor(Math.random() * 254) + 1}`,
  `192.0.2.${Math.floor(Math.random() * 254) + 1}`,
];
const rateLimitKeys = [
  `rate:login:${testAddress}`,
  `rate:register:${testAddress}`,
  ...holdAddresses.map((address) => `rate:holds:${address}`),
];
let userId;
let bookingId;
let testEmail;

function assertSafeTestTargets() {
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  assert.notEqual(process.env.NODE_ENV, 'production', 'Integration tests cannot run in production.');
  assert(localHosts.has(apiUrl.hostname), 'APP_ORIGIN must point to a local API server.');
  assert(database, 'DATABASE_URL is required.');
  assert(localHosts.has(database.hostname), 'DATABASE_URL must point to a local PostgreSQL instance.');
  assert.match(database.pathname.slice(1), /^(golf|.+_test)$/i, 'Use the local golf or a *_test database.');
  assert(redisAddress, 'REDIS_URL is required.');
  assert(localHosts.has(redisAddress.hostname), 'REDIS_URL must point to a local Redis instance.');
}

function rememberCookies(response) {
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(';', 1);
    const separator = pair.indexOf('=');
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value) {
      cookieJar.set(name, value);
      if (name === 'golf_session') sessionTokens.add(decodeURIComponent(value));
    } else {
      cookieJar.delete(name);
    }
  }
}

function getCookies(response) {
  const cookies = new Map();
  for (const header of response.headers.getSetCookie()) {
    const [pair] = header.split(';', 1);
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
  }
  const token = cookies.get('golf_session');
  if (token) sessionTokens.add(decodeURIComponent(token));
  return cookies;
}

function requestHeaders(extra = {}) {
  const headers = { ...extra };
  if (cookieJar.size) {
    headers.cookie = [...cookieJar.entries()]
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }
  return headers;
}

async function apiRequest(path, options = {}) {
  const headers = requestHeaders(options.headers);
  const method = options.method?.toUpperCase() || 'GET';
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && !headers['x-csrf-token'] && cookieJar.has('golf_csrf')) {
    headers['x-csrf-token'] = decodeURIComponent(cookieJar.get('golf_csrf'));
  }
  let body = options.body;
  if (body && typeof body === 'object' && (Array.isArray(body) || Object.getPrototypeOf(body) === Object.prototype)) {
    headers['content-type'] ??= 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(new URL(path, apiOrigin), {
    ...options,
    body,
    headers,
  });
  rememberCookies(response);
  return response;
}

async function responseJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    assert.fail(`Expected JSON response, received HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
}

async function expectStatus(response, expected) {
  if (response.status !== expected) {
    assert.fail(`Expected HTTP ${expected}, received ${response.status}: ${(await response.text()).slice(0, 500)}`);
  }
}

async function cleanup() {
  if (!pool) return;
  const tokenHashes = [...sessionTokens].map((token) => createHash('sha256').update(token).digest('hex'));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (!userId && testEmail) {
      const createdUser = await client.query('SELECT id FROM users WHERE email = $1', [testEmail]);
      userId = createdUser.rows[0]?.id;
    }
    const sessions = tokenHashes.length
      ? await client.query('SELECT id FROM sessions WHERE token_hash = ANY($1::text[])', [tokenHashes])
      : { rows: [] };
    const sessionIds = sessions.rows.map((row) => row.id);
    const waitlistRows = userId || sessionIds.length
      ? await client.query(
        `SELECT id FROM tee_time_waitlist
         WHERE ($1::uuid IS NOT NULL AND user_id=$1)
            OR (cardinality($2::uuid[])>0 AND session_id=ANY($2::uuid[]))`,
        [userId || null, sessionIds],
      )
      : { rows: [] };
    const waitlistIds = waitlistRows.rows.map((row) => row.id);
    if (waitlistIds.length) {
      await client.query(
        `DELETE FROM email_outbox WHERE dedupe_key LIKE ANY($1::text[])`,
        [waitlistIds.flatMap((id) => [`waitlist-verify:${id}`, `waitlist-offer:${id}:%`])],
      );
      await client.query('DELETE FROM tee_time_waitlist WHERE id=ANY($1::uuid[])', [waitlistIds]);
    }
    const bookingIds = userId || sessionIds.length
      ? await client.query(
        `SELECT id FROM bookings
         WHERE ($1::uuid IS NOT NULL AND user_id = $1)
            OR (cardinality($2::uuid[]) > 0 AND session_id = ANY($2::uuid[]))`,
        [userId || null, sessionIds],
      )
      : { rows: [] };
    const ids = bookingIds.rows.map((row) => row.id);

    if (ids.length) {
      await client.query(
        `DELETE FROM email_outbox
         WHERE dedupe_key=ANY($1::text[]) OR dedupe_key LIKE ANY($2::text[])`,
        [
          ids.map((id) => `booking-confirmed:${id}`),
          ids.flatMap((id) => [`booking-cancelled:${id}:%`, `booking-rescheduled:${id}:%`]),
        ],
      );
      await client.query('DELETE FROM booking_access_tokens WHERE booking_id = ANY($1::uuid[])', [ids]);
      await client.query('DELETE FROM booking_items WHERE booking_id = ANY($1::uuid[])', [ids]);
      await client.query('DELETE FROM bookings WHERE id = ANY($1::uuid[])', [ids]);
    }
    if (sessionIds.length) {
      await client.query('DELETE FROM slot_holds WHERE session_id = ANY($1::uuid[])', [sessionIds]);
      await client.query('DELETE FROM sessions WHERE id = ANY($1::uuid[])', [sessionIds]);
    }
    if (testDates.size) {
      await client.query(
        `UPDATE tee_slots ts
         SET held_spots=COALESCE((
               SELECT sum(h.players)::int FROM slot_holds h
               WHERE h.slot_id=ts.id AND h.status='active' AND h.expires_at>now()
             ),0),
             booked_spots=COALESCE((
               SELECT sum(b.players)::int FROM bookings b
               WHERE b.slot_id=ts.id AND b.status IN ('confirmed','checked_in')
             ),0)
         WHERE ts.tee_date=ANY($1::date[])`,
        [[...testDates]],
      );
    }
    if (userId) {
      await client.query(
        'DELETE FROM email_outbox WHERE dedupe_key LIKE ANY($1::text[])',
        [[`verify-email:${userId}:%`, `reset-password:${userId}:%`]],
      );
      await client.query('DELETE FROM idempotency_keys WHERE scope LIKE $1', [`${userId}:%`]);
      await client.query('DELETE FROM member_balances WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM members WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM audit_log WHERE actor_user_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
    }
    if (createdInquiryIds.size) {
      const inquiryIds = [...createdInquiryIds];
      await client.query('DELETE FROM email_outbox WHERE dedupe_key=ANY($1::text[])', [inquiryIds.map((id) => `public-inquiry:${id}`)]);
      await client.query('DELETE FROM public_inquiries WHERE id=ANY($1::uuid[])', [inquiryIds]);
    }
    const slotIds = [...createdSlotIds];
    if (slotIds.length) {
      await client.query(
        `DELETE FROM tee_slots ts
         WHERE ts.id = ANY($1::bigint[])
           AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.slot_id = ts.id)
           AND NOT EXISTS (SELECT 1 FROM slot_holds h WHERE h.slot_id = ts.id)`,
        [slotIds],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  if (redis?.isOpen) await redis.del(rateLimitKeys);
}

after(async () => {
  try {
    await cleanup();
  } finally {
    if (redis?.isOpen) await redis.quit();
    await pool?.end();
  }
});

test('booking API and Redis rate limiting work end-to-end', async (t) => {
  assertSafeTestTargets();
  assert(pool && redis);
  await pool.query('SELECT 1');
  await redis.connect();
  assert.equal(await redis.ping(), 'PONG');

  const health = await apiRequest('/api/v1/auth/session');
  assert.equal(health.status, 200, 'Start the local API server before running integration tests.');
  const healthBody = await responseJson(health);
  assert.equal(healthBody.authenticated, false);

  try {
    await t.test('serves current public pricing, operations status and announcements', async () => {
      const [pricingResponse, operationsResponse, announcementsResponse] = await Promise.all([
        fetch(new URL('/api/v1/pricing', apiOrigin)),
        fetch(new URL('/api/v1/course-updates', apiOrigin)),
        fetch(new URL('/api/v1/announcements', apiOrigin)),
      ]);
      await expectStatus(pricingResponse, 200);
      await expectStatus(operationsResponse, 200);
      await expectStatus(announcementsResponse, 200);
      const pricing = await responseJson(pricingResponse);
      assert.match(pricing.paymentDisclaimer, /settled at the club/i);
      assert.ok(pricing.rates.length > 0);
      assert.ok(pricing.services.length > 0);
      assert.ok(Array.isArray(await responseJson(operationsResponse)));
      assert.ok(Array.isArray(await responseJson(announcementsResponse)));
    });

    await t.test('accepts a public event inquiry for staff follow-up', async () => {
      const response = await fetch(new URL('/api/v1/inquiries', apiOrigin), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': testAddress },
        body: JSON.stringify({
          type: 'event',
          name: 'Integration Event Guest',
          email: `event-${randomUUID()}@example.test`,
          subject: 'Tournament interest',
          message: 'Please share upcoming tournament information.',
        }),
      });
      await expectStatus(response, 201);
      const inquiry = await responseJson(response);
      assert.ok(inquiry.id);
      createdInquiryIds.add(inquiry.id);
      assert.ok(['not_configured', 'queued', 'sent'].includes(inquiry.emailNotification));
    });

    await t.test('registers a disposable member through the API', async () => {
      testEmail = `integration-${randomUUID()}@example.test`;
      const response = await apiRequest('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': healthBody.csrfToken,
          'x-forwarded-for': testAddress,
        },
        body: JSON.stringify({
          name: 'Integration Test Member',
          email: testEmail,
          phone: '081234567890',
          password: `Test-${randomUUID()}-Long`,
        }),
      });
      await expectStatus(response, 201);
      const body = await responseJson(response);
      assert.ok(body.user.id);
      assert.equal(body.user.email, testEmail);
      assert.ok(body.csrfToken);
      userId = body.user.id;
      t.diagnostic(`Created disposable member ${userId}`);
    });

    await t.test('loads member profile and exposes verification states', async () => {
      const response = await apiRequest('/api/v1/me');
      await expectStatus(response, 200);
      const profile = await responseJson(response);
      assert.equal(profile.email, testEmail);
      assert.equal(profile.emailVerified, false);
      assert.equal(profile.phoneVerified, false);
    });

    await t.test('saves consent-based notification preferences', async () => {
      await pool.query('UPDATE users SET email_verified_at=now() WHERE id=$1', [userId]);
      const initialResponse = await apiRequest('/api/v1/me/notifications');
      await expectStatus(initialResponse, 200);
      assert.equal((await responseJson(initialResponse)).emailConsent, false);
      const refused = await apiRequest('/api/v1/me/notifications', {
        method: 'PATCH',
        body: { emailConsent: false, teeTimeReminders: true, courseUpdates: false, digestFrequency: 'daily', reminderHours: 24 },
      });
      assert.equal(refused.status, 400);
      const saved = await apiRequest('/api/v1/me/notifications', {
        method: 'PATCH',
        body: { emailConsent: true, teeTimeReminders: true, courseUpdates: true, digestFrequency: 'daily', reminderHours: 3 },
      });
      await expectStatus(saved, 200);
      assert.deepEqual(await responseJson(saved), {
        emailConsent: true,
        teeTimeReminders: true,
        courseUpdates: true,
        digestFrequency: 'daily',
        reminderHours: 3,
      });
    });

    let testDate;
    let selectedSlot;
    let concurrencySlot;
    let rescheduleSlot;
    await t.test('lists tee times for a future test date', async () => {
      const dateResult = await pool.query(
        `SELECT to_char(timezone('Asia/Jakarta', now())::date + 59, 'YYYY-MM-DD') AS date`,
      );
      testDate = dateResult.rows[0].date;
      testDates.add(testDate);
      await pool.query(
        `UPDATE tee_slots ts
         SET held_spots=COALESCE((
               SELECT sum(h.players)::int FROM slot_holds h
               WHERE h.slot_id=ts.id AND h.status='active' AND h.expires_at>now()
             ),0),
             booked_spots=COALESCE((
               SELECT sum(b.players)::int FROM bookings b
               WHERE b.slot_id=ts.id AND b.status IN ('confirmed','checked_in')
             ),0)
         WHERE ts.tee_date=$1::date`,
        [testDate],
      );
      const existing = await pool.query('SELECT id FROM tee_slots WHERE course_id=1 AND tee_date=$1::date', [testDate]);
      const existingIds = new Set(existing.rows.map((row) => String(row.id)));
      const response = await apiRequest(`/api/v1/tee-times?date=${testDate}&players=1`);
      await expectStatus(response, 200);
      const body = await responseJson(response);
      const generated = await pool.query('SELECT id FROM tee_slots WHERE course_id=1 AND tee_date=$1::date', [testDate]);
      for (const row of generated.rows) {
        if (!existingIds.has(String(row.id))) createdSlotIds.add(String(row.id));
      }
      const available = body.slots.find((slot) => ['available', 'limited'].includes(slot.status) && slot.spotsLeft > 0);
      assert.ok(available, 'Expected an available tee time.');
      const additionalSlots = body.slots.filter(
        (slot) => slot.slotId !== available.slotId && ['available', 'limited'].includes(slot.status),
      );
      concurrencySlot = additionalSlots.find((slot) => slot.spotsLeft >= 3);
      assert.ok(concurrencySlot, 'Expected a separate tee time with at least three places available.');
      rescheduleSlot = additionalSlots.find(
        (slot) => slot.slotId !== concurrencySlot.slotId && slot.spotsLeft >= 1,
      );
      assert.ok(rescheduleSlot, 'Expected another available tee time for rescheduling.');
      t.diagnostic(`Selected tee time ${testDate} ${available.time}`);
      selectedSlot = available;
    });

    const sessionIdResult = await pool.query(
      `SELECT id FROM sessions WHERE token_hash = $1`,
      [createHash('sha256').update(decodeURIComponent(cookieJar.get('golf_session'))).digest('hex')],
    );
    assert.equal(sessionIdResult.rowCount, 1, 'Expected the registered API session to exist.');
    const sessionId = sessionIdResult.rows[0].id;
    let hold;
    await t.test('places a capacity hold through the API', async () => {
      const response = await apiRequest('/api/v1/tee-times/holds', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': decodeURIComponent(cookieJar.get('golf_csrf')) },
        body: JSON.stringify({ slotId: selectedSlot.slotId, players: 1 }),
      });
      await expectStatus(response, 201);
      hold = await responseJson(response);
      assert.equal(hold.slotId, selectedSlot.slotId);
      assert.equal(hold.players, 1);
    });

    let quote;
    await t.test('quotes the held tee time through the API', async () => {
      const response = await apiRequest('/api/v1/quotes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ holdId: hold.holdId, buggy: false, extras: {} }),
      });
      await expectStatus(response, 200);
      quote = await responseJson(response);
      assert.ok(Number.isSafeInteger(quote.total) && quote.total > 0);
    });

    let booking;
    const idempotencyKey = randomUUID();
    const bookingRequest = {
      holdId: hold.holdId,
      termsAccepted: true,
      guest: { name: 'Integration Test', phone: '081234567890', email: `integration-booking-${randomUUID()}@example.test` },
      buggy: false,
      extras: {},
      clientTotal: quote.total,
    };
    await t.test('creates an onsite-pay booking and replays idempotently', async () => {
      const options = {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': decodeURIComponent(cookieJar.get('golf_csrf')),
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(bookingRequest),
      };
      const firstResponse = await apiRequest('/api/v1/bookings', options);
      await expectStatus(firstResponse, 201);
      booking = await responseJson(firstResponse);
      assert.equal(booking.status, 'confirmed');
      assert.equal(booking.paymentMode, 'pay_at_club');
      assert.ok(['queued', 'sent'].includes(booking.emailNotification));
      bookingId = booking.id;

      const replayResponse = await apiRequest('/api/v1/bookings', options);
      assert.equal(replayResponse.status, 201);
      assert.deepEqual(await responseJson(replayResponse), booking);
    });

    await t.test('reschedules the member booking atomically and idempotently', async () => {
      const key = randomUUID();
      const request = () => apiRequest(`/api/v1/bookings/${bookingId}/reschedule`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': key,
        },
        body: JSON.stringify({ newSlotId: Number(rescheduleSlot.slotId) }),
      });
      const response = await request();
      await expectStatus(response, 200);
      const result = await responseJson(response);
      assert.equal(result.booking.id, bookingId);
      assert.equal(result.current.date, testDate);
      assert.notEqual(result.current.time, result.previous.time);
      assert.equal(result.paymentMode, 'pay_at_club');
      const replay = await request();
      await expectStatus(replay, 200);
      assert.deepEqual(await responseJson(replay), result);
    });

    let waitlistEntry;
    await t.test('waitlists a verified member and transfers an auto-hold through a one-time email link', async () => {
      const fullHoldResponse = await apiRequest('/api/v1/tee-times/holds', {
        method: 'POST',
        body: { slotId: concurrencySlot.slotId, players: Math.min(4, concurrencySlot.spotsLeft) },
      });
      await expectStatus(fullHoldResponse, 201);
      const fullHold = await responseJson(fullHoldResponse);

      const joined = await apiRequest('/api/v1/waitlist', {
        method: 'POST',
        body: { slotId: Number(concurrencySlot.slotId), players: 1 },
      });
      await expectStatus(joined, 201);
      waitlistEntry = await responseJson(joined);
      assert.equal(waitlistEntry.status, 'waiting');

      const release = await apiRequest(`/api/v1/tee-times/holds/${fullHold.holdId}`, { method: 'DELETE' });
      await expectStatus(release, 200);
      assert.equal((await responseJson(release)).waitlistNotification, 'queued');

      const email = await pool.query(
        `SELECT body_text FROM email_outbox
         WHERE dedupe_key LIKE $1 ORDER BY created_at DESC LIMIT 1`,
        [`waitlist-offer:${waitlistEntry.id}:%`],
      );
      assert.equal(email.rowCount, 1, 'Expected a queued waitlist offer email.');
      const link = email.rows[0].body_text.match(/https?:\/\/\S+/)?.[0];
      assert.ok(link, 'The waitlist email should contain a claim link.');
      const token = new URL(link).searchParams.get('waitlistToken');
      assert.ok(token);
      const claimed = await apiRequest('/api/v1/waitlist/claim', { method: 'POST', body: { token } });
      await expectStatus(claimed, 200);
      const claim = await responseJson(claimed);
      assert.notEqual(claim.holdId, fullHold.holdId);
      assert.equal(claim.players, 1);
      assert.equal(claim.guest.email, testEmail);

      const listed = await apiRequest('/api/v1/me/waitlist');
      await expectStatus(listed, 200);
      assert.ok((await responseJson(listed)).some((entry) => entry.id === waitlistEntry.id && entry.status === 'held'));
      const left = await apiRequest(`/api/v1/me/waitlist/${waitlistEntry.id}`, { method: 'DELETE', body: {} });
      await expectStatus(left, 200);
      assert.equal((await responseJson(left)).cancelled, true);

      const guestHoldResponse = await apiRequest('/api/v1/tee-times/holds', {
        method: 'POST',
        body: { slotId: concurrencySlot.slotId, players: Math.min(4, concurrencySlot.spotsLeft) },
      });
      await expectStatus(guestHoldResponse, 201);
      const guestHold = await responseJson(guestHoldResponse);
      const guestAddress = `198.51.100.${Math.floor(Math.random() * 254) + 1}`;
      const guestSessionResponse = await fetch(new URL('/api/v1/auth/session', apiOrigin), {
        headers: { 'x-forwarded-for': guestAddress },
      });
      await expectStatus(guestSessionResponse, 200);
      const guestSessionBody = await responseJson(guestSessionResponse);
      const guestCookies = getCookies(guestSessionResponse);
      const guestRequest = (path, options = {}) => fetch(new URL(path, apiOrigin), {
        ...options,
        headers: {
          cookie: [...guestCookies.entries()].map(([name, value]) => `${name}=${value}`).join('; '),
          'x-forwarded-for': guestAddress,
          ...(options.headers || {}),
        },
      });
      const guestEmail = `waitlist-${randomUUID()}@example.test`;
      const guestJoin = await guestRequest('/api/v1/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': guestSessionBody.csrfToken },
        body: JSON.stringify({
          slotId: Number(concurrencySlot.slotId),
          players: 1,
          name: 'Waitlist Guest',
          phone: '081234567890',
          email: guestEmail,
        }),
      });
      await expectStatus(guestJoin, 201);
      const guestEntry = await responseJson(guestJoin);
      assert.equal(guestEntry.status, 'pending_verification');
      const verificationEmail = await pool.query(
        'SELECT body_text FROM email_outbox WHERE dedupe_key=$1',
        [`waitlist-verify:${guestEntry.id}`],
      );
      const verificationLink = verificationEmail.rows[0].body_text.match(/https?:\/\/\S+/)?.[0];
      assert.ok(verificationLink);
      const verificationToken = new URL(verificationLink).searchParams.get('token');
      const verified = await guestRequest('/api/v1/waitlist/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': guestSessionBody.csrfToken },
        body: JSON.stringify({ token: verificationToken }),
      });
      await expectStatus(verified, 200);
      assert.equal((await responseJson(verified)).status, 'waiting');

      const guestRelease = await apiRequest(`/api/v1/tee-times/holds/${guestHold.holdId}`, { method: 'DELETE' });
      await expectStatus(guestRelease, 200);
      const offerEmail = await pool.query(
        'SELECT body_text FROM email_outbox WHERE dedupe_key LIKE $1 ORDER BY created_at DESC LIMIT 1',
        [`waitlist-offer:${guestEntry.id}:%`],
      );
      assert.equal(offerEmail.rowCount, 1);
      const offerLink = offerEmail.rows[0].body_text.match(/https?:\/\/\S+/)?.[0];
      const offerToken = new URL(offerLink).searchParams.get('waitlistToken');
      const guestClaim = await guestRequest('/api/v1/waitlist/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': guestSessionBody.csrfToken },
        body: JSON.stringify({ token: offerToken }),
      });
      await expectStatus(guestClaim, 200);
      const guestClaimBody = await responseJson(guestClaim);
      assert.equal(guestClaimBody.guest.email, guestEmail);
      const guestClaimRelease = await guestRequest(`/api/v1/tee-times/holds/${guestClaimBody.holdId}`, {
        method: 'DELETE',
        headers: { 'x-csrf-token': guestSessionBody.csrfToken },
      });
      await expectStatus(guestClaimRelease, 200);
    });

    await t.test('staff tee sheet supports search and daily operational summary', async () => {
      await pool.query("UPDATE users SET role='staff' WHERE id=$1", [userId]);
      const query = new URLSearchParams({ date: testDate, q: booking.reference });
      const response = await apiRequest(`/api/v1/staff/tee-sheet?${query}`);
      await expectStatus(response, 200);
      const sheet = await responseJson(response);
      assert.ok(sheet.summary.confirmed >= 1);
      assert.ok(sheet.summary.capacity > 0);
      const matched = sheet.slots.flatMap((slot) => slot.bookings).find((item) => item.reference === booking.reference);
      assert.ok(matched, 'Expected the tee sheet search to return the matching booking.');
      await pool.query("UPDATE users SET role='member' WHERE id=$1", [userId]);
    });

    await t.test('retrieves the created booking with its session', async () => {
      const response = await apiRequest(`/api/v1/bookings/${bookingId}`);
      await expectStatus(response, 200);
      const body = await responseJson(response);
      assert.equal(body.id, bookingId);
      assert.equal(body.paymentMode, 'pay_at_club');
      assert.equal(body.status, 'confirmed');
    });

    await t.test('issues a short-lived member check-in QR token', async () => {
      const response = await apiRequest(`/api/v1/bookings/${bookingId}/qr`);
      await expectStatus(response, 200);
      const body = await responseJson(response);
      assert.equal(body.qrToken.split('.').length, 4);
      assert.ok(Date.parse(body.expiresAt) > Date.now());
    });

    await t.test('allows only one concurrent hold for the remaining capacity', async () => {
      const sessions = await Promise.all(holdAddresses.map(async (address) => {
        const response = await fetch(new URL('/api/v1/auth/session', apiOrigin), {
          headers: { 'x-forwarded-for': address },
        });
        await expectStatus(response, 200);
        const body = await responseJson(response);
        return { cookies: getCookies(response), csrfToken: body.csrfToken, address };
      }));

      const responses = await Promise.all(sessions.map(({ cookies, csrfToken, address }) => fetch(
        new URL('/api/v1/tee-times/holds', apiOrigin),
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; '),
            'x-csrf-token': csrfToken,
            'x-forwarded-for': address,
          },
          body: JSON.stringify({ slotId: concurrencySlot.slotId, players: 3 }),
        },
      )));
      const results = await Promise.all(responses.map(async (response) => ({
        status: response.status,
        body: await responseJson(response),
      })));
      assert.equal(results.filter((result) => result.status === 201).length, 1);
      assert.equal(results.filter((result) => result.status === 409).length, 1);

      const winnerIndex = results.findIndex((result) => result.status === 201);
      const winner = results[winnerIndex];
      const winnerSession = sessions[winnerIndex];
      const release = await fetch(new URL(`/api/v1/tee-times/holds/${winner.body.holdId}`, apiOrigin), {
        method: 'DELETE',
        headers: {
          cookie: [...winnerSession.cookies.entries()].map(([name, value]) => `${name}=${value}`).join('; '),
          'x-csrf-token': winnerSession.csrfToken,
          'x-forwarded-for': winnerSession.address,
        },
      });
      await expectStatus(release, 200);
    });

    await t.test('cancels the booking through the API', async () => {
      const response = await apiRequest(`/api/v1/bookings/${bookingId}/cancel`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': decodeURIComponent(cookieJar.get('golf_csrf')),
          'idempotency-key': randomUUID(),
        },
        body: '{}',
      });
      await expectStatus(response, 200);
      const body = await responseJson(response);
      assert.equal(body.booking.id, bookingId);
      assert.equal(body.booking.status, 'cancelled');
    });

    await t.test('enforces login rate limits through Redis', async () => {
      for (let attempt = 1; attempt <= 10; attempt += 1) {
        const response = await fetch(new URL('/api/v1/auth/login', apiOrigin), {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': testAddress },
          body: '{}',
        });
        assert.equal(response.status, 401, `Login attempt ${attempt} should reach session auth.`);
      }
      const limited = await fetch(new URL('/api/v1/auth/login', apiOrigin), {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': testAddress },
        body: '{}',
      });
      assert.equal(limited.status, 429);
      assert.ok(Number(limited.headers.get('retry-after')) > 0);
      assert.equal(await redis.get(rateLimitKeys[0]), '11');
    });

    t.diagnostic(`API booking ${booking.reference} confirmed with onsite payment.`);
    t.diagnostic(`Registered API session ${sessionId}`);
  } finally {
    await cleanup();
  }
});
