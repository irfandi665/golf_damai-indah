import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
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
const databaseAddress = databaseUrl ? new URL(databaseUrl) : null;
const redisAddress = redisUrl ? new URL(redisUrl) : null;
const pool = databaseUrl ? new Pool({
  connectionString: databaseUrl,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
}) : null;
const redis = redisUrl ? createClient({ url: redisUrl }) : null;

const hash = (value) => createHash('sha256').update(value).digest('hex');
const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
const testId = randomUUID();
const users = [
  { id: randomUUID(), email: `hold-race-a-${testId}@example.test`, name: 'Hold Race Member A' },
  { id: randomUUID(), email: `hold-race-b-${testId}@example.test`, name: 'Hold Race Member B' },
];
const sessions = users.map(() => ({
  token: randomBytes(32).toString('base64url'),
  csrf: randomBytes(32).toString('base64url'),
}));
const clientIps = Array.from({ length: 2 }, () => {
  const hex = randomUUID().replaceAll('-', '').slice(0, 4);
  return `198.18.${Number.parseInt(hex.slice(0, 2), 16)}.${(Number.parseInt(hex.slice(2), 16) % 254) + 1}`;
});
const holdRateKeys = clientIps.map((ip) => `rate:holds:${ip}`);
let slotId;
let fixtureCreated = false;

function assertSafeTestTargets() {
  assert.notEqual(process.env.NODE_ENV, 'production', 'Race tests cannot run in production.');
  assert(localHosts.has(apiUrl.hostname), 'APP_ORIGIN must point to a local API server.');
  assert(databaseAddress, 'DATABASE_URL is required.');
  assert(localHosts.has(databaseAddress.hostname), 'DATABASE_URL must point to local PostgreSQL.');
  assert.match(databaseAddress.pathname.slice(1), /^(golf|.+_test)$/i, 'Use the local golf or a *_test database.');
  assert(redisAddress, 'REDIS_URL is required.');
  assert(localHosts.has(redisAddress.hostname), 'REDIS_URL must point to local Redis.');
}

async function seedFixture() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const dateResult = await client.query(
      `SELECT (timezone('Asia/Jakarta', now())::date + 58)::text AS tee_date`,
    );
    const date = dateResult.rows[0].tee_date;

    for (let index = 0; index < users.length; index += 1) {
      const user = users[index];
      await client.query(
        `INSERT INTO users(id,email,phone,full_name,password_hash,role)
         VALUES($1,$2,$3,$4,'test-password-not-used','member')`,
        [user.id, user.email, `0812345678${String(index).padStart(3, '0')}`, user.name],
      );
      await client.query(
        `INSERT INTO members(user_id,member_no)
         VALUES($1,$2)`,
        [user.id, `RACE-${testId.slice(0, 8)}-${index}`],
      );
      await client.query(
        `INSERT INTO sessions(token_hash,csrf_hash,user_id,expires_at)
         VALUES($1,$2,$3,now()+interval '1 hour')`,
        [hash(sessions[index].token), hash(sessions[index].csrf), user.id],
      );
    }

    const insertedSlot = await client.query(
      `INSERT INTO tee_slots(course_id,tee_date,tee_time,capacity,status)
       SELECT 1,$1::date,(time '05:00' + step * interval '1 minute')::time,1,'open'
       FROM generate_series(0,59) AS step
       WHERE NOT EXISTS (
         SELECT 1 FROM tee_slots existing
         WHERE existing.course_id=1 AND existing.tee_date=$1::date
           AND existing.tee_time=(time '05:00' + step * interval '1 minute')::time
       )
       ORDER BY step
       LIMIT 1
       RETURNING id`,
      [date],
    );
    assert.equal(insertedSlot.rowCount, 1, 'Expected a free test tee-time slot between 05:00 and 05:59.');
    slotId = insertedSlot.rows[0].id;
    await client.query('COMMIT');
    fixtureCreated = true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function removeFixture() {
  if (!fixtureCreated) return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM slot_holds WHERE slot_id=$1', [slotId]);
    await client.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])', [users.map((user) => user.id)]);
    await client.query('DELETE FROM member_balances WHERE user_id=ANY($1::uuid[])', [users.map((user) => user.id)]);
    await client.query('DELETE FROM members WHERE user_id=ANY($1::uuid[])', [users.map((user) => user.id)]);
    await client.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users.map((user) => user.id)]);
    await client.query('DELETE FROM tee_slots WHERE id=$1', [slotId]);
    await client.query('COMMIT');
    fixtureCreated = false;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

before(async () => {
  assertSafeTestTargets();
  assert(pool && redis);
  await pool.query('SELECT 1');
  await redis.connect();
  assert.equal(await redis.ping(), 'PONG');
  await redis.del(holdRateKeys);
  await seedFixture();
});

after(async () => {
  try {
    if (pool) await removeFixture();
  } finally {
    if (redis?.isOpen) {
      await redis.del(holdRateKeys);
      await redis.quit();
    }
    await pool?.end();
  }
});

test('only one member can hold the final place during concurrent requests', async () => {
  const apiHealth = await fetch(new URL('/api/v1/auth/session', apiOrigin));
  assert.equal(apiHealth.status, 200, 'Start the local API server before running integration tests.');

  const barrier = (() => {
    let release;
    const promise = new Promise((resolve) => { release = resolve; });
    return { promise, release };
  })();
  let readyRequests = 0;
  const responsesPromise = Promise.all(users.map(async (user, index) => {
    readyRequests += 1;
    if (readyRequests === users.length) barrier.release();
    await barrier.promise;

    const response = await fetch(new URL('/api/v1/tee-times/holds', apiOrigin), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `golf_session=${sessions[index].token}; golf_csrf=${sessions[index].csrf}`,
        'x-csrf-token': sessions[index].csrf,
        'x-forwarded-for': clientIps[index],
      },
      body: JSON.stringify({ slotId: String(slotId), players: 1 }),
    });
    const text = await response.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      assert.fail(`Expected JSON response, received HTTP ${response.status}: ${text.slice(0, 300)}`);
    }
    return { user, status: response.status, body };
  }));
  const results = await responsesPromise;
  const { status: statusA, body: bodyA } = results[0];
  const { status: statusB, body: bodyB } = results[1];
  const successful = results.filter((result) => result.status === 201);
  const conflicted = results.filter((result) => result.status === 409);

  assert.equal(successful.length, 1, `Expected one successful hold; got ${statusA} and ${statusB}.`);
  assert.equal(conflicted.length, 1, `Expected one capacity conflict; got ${statusA} and ${statusB}.`);
  assert.ok(successful[0].body.holdId, 'The successful request must return a hold ID.');
  assert.equal(conflicted[0].body.code, 'slot_unavailable');

  const committedState = await pool.query(
    `SELECT ts.capacity,ts.held_spots,ts.booked_spots,
       (SELECT count(*)::int FROM slot_holds h
        WHERE h.slot_id=ts.id AND h.status='active' AND h.expires_at>now()) AS active_holds,
       (SELECT count(*)::int FROM bookings b
        WHERE b.slot_id=ts.id AND b.status IN ('confirmed','checked_in')) AS active_bookings
     FROM tee_slots ts WHERE ts.id=$1`,
    [slotId],
  );
  assert.equal(committedState.rowCount, 1);
  const slot = committedState.rows[0];
  assert.equal(slot.capacity, 1);
  assert.equal(slot.active_holds + slot.active_bookings, 1, 'The committed database must contain exactly one reservation/hold.');
  assert.equal(slot.held_spots + slot.booked_spots, 1, 'Committed counters must match capacity usage.');
  assert.ok(slot.held_spots + slot.booked_spots <= slot.capacity, 'Database counters must never oversell the slot.');

  const isolation = await pool.query('SHOW transaction_isolation');
  assert.equal(isolation.rows[0].transaction_isolation, 'read committed');

  for (const key of holdRateKeys) {
    const [value, ttl] = await Promise.all([redis.get(key), redis.ttl(key)]);
    assert.equal(value, '1', 'Each independent client request should consume one hold rate-limit unit.');
    assert.ok(ttl > 0 && ttl <= 60, `Rate-limit key ${key} should expire, got TTL ${ttl}.`);
  }
});
