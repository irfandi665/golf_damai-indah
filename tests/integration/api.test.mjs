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
  const response = await fetch(new URL(path, apiOrigin), {
    ...options,
    headers: requestHeaders(options.headers),
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
      await client.query('DELETE FROM booking_access_tokens WHERE booking_id = ANY($1::uuid[])', [ids]);
      await client.query('DELETE FROM booking_items WHERE booking_id = ANY($1::uuid[])', [ids]);
      await client.query('DELETE FROM bookings WHERE id = ANY($1::uuid[])', [ids]);
    }
    if (sessionIds.length) {
      await client.query('DELETE FROM slot_holds WHERE session_id = ANY($1::uuid[])', [sessionIds]);
      await client.query('DELETE FROM sessions WHERE id = ANY($1::uuid[])', [sessionIds]);
    }
    if (userId) {
      await client.query('DELETE FROM idempotency_keys WHERE scope LIKE $1', [`${userId}:%`]);
      await client.query('DELETE FROM member_balances WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM members WHERE user_id = $1', [userId]);
      await client.query('DELETE FROM users WHERE id = $1', [userId]);
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

    let testDate;
    let selectedSlot;
    let concurrencySlot;
    await t.test('lists tee times for a future test date', async () => {
      const dateResult = await pool.query(
        `SELECT to_char(timezone('Asia/Jakarta', now())::date + 59, 'YYYY-MM-DD') AS date`,
      );
      testDate = dateResult.rows[0].date;
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
      concurrencySlot = body.slots.find((slot) => slot.slotId !== available.slotId && slot.spotsLeft >= 3);
      assert.ok(concurrencySlot, 'Expected a separate tee time with at least three places available.');
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
      bookingId = booking.id;

      const replayResponse = await apiRequest('/api/v1/bookings', options);
      assert.equal(replayResponse.status, 201);
      assert.deepEqual(await responseJson(replayResponse), booking);
    });

    await t.test('retrieves the created booking with its session', async () => {
      const response = await apiRequest(`/api/v1/bookings/${bookingId}`);
      await expectStatus(response, 200);
      const body = await responseJson(response);
      assert.equal(body.id, bookingId);
      assert.equal(body.paymentMode, 'pay_at_club');
      assert.equal(body.status, 'confirmed');
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
