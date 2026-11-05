import { randomBytes } from 'node:crypto';
import { getPool, inTransaction } from './db';
import { ApiError, assert } from './errors';

const COURSE_ID = 1;
const MAX_INDEX = 54;
const POINT_VALUE_IDR = 10000;

function formatKey(value) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function differential(gross, rating, slope) {
  return round1((113 / slope) * (gross - Number(rating)));
}

function handicapRule(count) {
  if (count < 3) return null;
  if (count === 3) return { used: 1, adjustment: -2 };
  if (count === 4) return { used: 1, adjustment: -1 };
  if (count === 5) return { used: 1, adjustment: 0 };
  if (count === 6) return { used: 2, adjustment: -1 };
  if (count <= 8) return { used: 2, adjustment: 0 };
  if (count <= 11) return { used: 3, adjustment: 0 };
  if (count <= 14) return { used: 4, adjustment: 0 };
  if (count <= 16) return { used: 5, adjustment: 0 };
  if (count <= 18) return { used: 6, adjustment: 0 };
  if (count === 19) return { used: 7, adjustment: 0 };
  return { used: 8, adjustment: 0 };
}

function calculateIndex(rounds) {
  const recent = [...rounds]
    .sort((a, b) => b.playedOn.localeCompare(a.playedOn) || b.id.localeCompare(a.id))
    .slice(0, 20);
  const rule = handicapRule(recent.length);
  if (!rule) return { index: null, used: 0, sample: recent.length };
  const best = recent
    .map((round) => differential(round.grossScore, round.courseRating, round.slope))
    .sort((a, b) => a - b)
    .slice(0, rule.used);
  return {
    index: Math.min(MAX_INDEX, Math.max(0, round1(best.reduce((sum, item) => sum + item, 0) / rule.used + rule.adjustment))),
    used: rule.used,
    sample: recent.length,
  };
}

async function loadRounds(client, userId) {
  const result = await client.query(
    `SELECT id, played_on, gross_score, course_rating, slope, source,
       verified_at, differential
     FROM rounds WHERE user_id=$1 ORDER BY played_on DESC, created_at DESC LIMIT 100`,
    [userId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    playedOn: formatKey(row.played_on),
    grossScore: row.gross_score,
    courseRating: Number(row.course_rating),
    slope: row.slope,
    differential: Number(row.differential),
    verified: Boolean(row.verified_at),
    source: row.source,
  }));
}

export async function getMemberDashboard(userId) {
  const pool = getPool();
  const [memberResult, rounds, bookingResult, pointsResult, vouchersResult, walletResult] = await Promise.all([
    pool.query(
      `SELECT u.full_name, u.email, u.phone, m.member_no, m.joined_at, m.tier,
         mb.points, mb.wallet_idr
       FROM users u JOIN members m ON m.user_id=u.id
       JOIN member_balances mb ON mb.user_id=u.id WHERE u.id=$1 AND u.is_active`,
      [userId],
    ),
    loadRounds(pool, userId),
    pool.query(
      `SELECT b.id, b.reference, b.status, b.players, b.caddy_code, b.buggy,
         b.total_idr, ts.tee_date, to_char(ts.tee_time,'HH24:MI') AS tee_time,
         COALESCE(json_agg(json_build_object('code',bi.item_code,'quantity',bi.quantity))
           FILTER (WHERE bi.id IS NOT NULL), '[]'::json) AS items,
         COALESCE(sum(bi.amount_idr) FILTER (WHERE bi.item_code='green_fee'),0) AS green_fee
       FROM bookings b JOIN tee_slots ts ON ts.id=b.slot_id
       LEFT JOIN booking_items bi ON bi.booking_id=b.id
       WHERE b.user_id=$1 GROUP BY b.id,ts.tee_date,ts.tee_time
       ORDER BY ts.tee_date DESC,ts.tee_time DESC LIMIT 100`,
      [userId],
    ),
    pool.query('SELECT id,entry_type,points,balance_after,description,created_at FROM points_ledger WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100', [userId]),
    pool.query("SELECT id,code,label,source,valid_until,status,value_idr,created_at FROM vouchers WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100", [userId]),
    pool.query('SELECT id,entry_type,amount_idr,balance_after,description,created_at FROM wallet_ledger WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100', [userId]),
  ]);
  assert(memberResult.rowCount, 404, 'not_found', 'Member profile was not found.');
  const member = memberResult.rows[0];
  return {
    member: {
      name: member.full_name,
      email: member.email,
      phone: member.phone,
      memberId: member.member_no,
      sinceKey: formatKey(member.joined_at),
      tier: member.tier,
    },
    rounds: rounds.map((round) => ({
      id: round.id,
      dateKey: round.playedOn,
      gross: round.grossScore,
      verified: round.verified,
      source: round.source,
    })),
    bookings: bookingResult.rows.map((booking) => ({
      id: booking.id,
      reference: booking.reference,
      dateKey: formatKey(booking.tee_date),
      time: booking.tee_time,
      players: booking.players,
      caddy: booking.caddy_code,
      buggy: booking.buggy,
      extras: Object.fromEntries(booking.items.filter((item) => item.code !== 'buggy').map((item) => [item.code, item.quantity])),
      status: booking.status,
      total: Number(booking.total_idr),
      greenFee: Number(booking.green_fee),
    })),
    ledger: pointsResult.rows.map((entry) => ({
      id: String(entry.id),
      dateKey: formatKey(entry.created_at),
      label: entry.description,
      points: entry.points,
      type: entry.entry_type,
    })),
    vouchers: vouchersResult.rows.map((voucher) => ({
      id: voucher.id,
      code: voucher.code,
      label: voucher.label,
      source: voucher.source,
      dateKey: formatKey(voucher.created_at),
      validUntil: formatKey(voucher.valid_until),
      status: voucher.status,
      value: Number(voucher.value_idr),
    })),
    wallet: Number(member.wallet_idr),
    walletLedger: walletResult.rows.map((entry) => ({
      id: String(entry.id),
      type: entry.entry_type,
      amount: Number(entry.amount_idr),
      balanceAfter: Number(entry.balance_after),
      description: entry.description,
      date: entry.created_at,
    })),
  };
}

export async function getMemberProfile(userId) {
  const result = await getPool().query(
    `SELECT u.full_name,u.email,u.phone,m.member_no,m.joined_at,m.tier
     FROM users u JOIN members m ON m.user_id=u.id
     WHERE u.id=$1 AND u.is_active`,
    [userId],
  );
  assert(result.rowCount, 404, 'not_found', 'Member profile was not found.');
  const member = result.rows[0];
  return {
    name: member.full_name,
    email: member.email,
    phone: member.phone,
    memberId: member.member_no,
    sinceKey: formatKey(member.joined_at),
    tier: member.tier,
  };
}

function decodeBookingCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const date = new Date(`${value.date}T00:00:00.000Z`);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(value.date)
      && Number.isFinite(date.getTime())
      && date.toISOString().slice(0, 10) === value.date;
    const validTime = /^\d{2}:\d{2}$/.test(value.time)
      && Number(value.time.slice(0, 2)) < 24
      && Number(value.time.slice(3, 5)) < 60;
    const validId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id);
    assert(validDate && validTime && validId, 400, 'validation_error', 'cursor is invalid.');
    return value;
  } catch (error) {
    if (error?.code === 'validation_error') throw error;
    assert(false, 400, 'validation_error', 'cursor is invalid.');
  }
}

export async function listMemberBookings(userId, { status, limit = 20, cursor } = {}) {
  assert(['upcoming', 'past'].includes(status), 400, 'validation_error', 'status must be upcoming or past.');
  const parsedLimit = Number(limit);
  assert(Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100, 400, 'validation_error', 'limit must be an integer from 1 to 100.');
  const cursorValue = decodeBookingCursor(cursor);
  const ascending = status === 'upcoming';
  const direction = ascending ? '>' : '<';
  const ordering = ascending ? 'ASC' : 'DESC';
  const cursorClause = cursorValue
    ? `AND (ts.tee_date,ts.tee_time,b.id) ${direction} ($3::date,$4::time,$5::uuid)`
    : '';
  const values = [userId, status];
  if (cursorValue) values.push(cursorValue.date, cursorValue.time, cursorValue.id);
  values.push(parsedLimit + 1);
  const limitParameter = values.length;
  const result = await getPool().query(
    `SELECT b.id,b.reference,b.status,b.players,b.caddy_code,b.buggy,b.total_idr,
       ts.tee_date,to_char(ts.tee_time,'HH24:MI') AS tee_time,
       COALESCE(json_agg(json_build_object('code',bi.item_code,'quantity',bi.quantity))
         FILTER (WHERE bi.id IS NOT NULL),'[]'::json) AS items
     FROM bookings b JOIN tee_slots ts ON ts.id=b.slot_id
     LEFT JOIN booking_items bi ON bi.booking_id=b.id
     WHERE b.user_id=$1
       AND (($2='upcoming' AND b.status='confirmed'
             AND (ts.tee_date > timezone('Asia/Jakarta',now())::date
               OR (ts.tee_date=timezone('Asia/Jakarta',now())::date
                   AND ts.tee_time >= timezone('Asia/Jakarta',now())::time)))
         OR ($2='past' AND b.status IN ('completed','cancelled','expired','no_show')))
       ${cursorClause}
     GROUP BY b.id,ts.tee_date,ts.tee_time
     ORDER BY ts.tee_date ${ordering},ts.tee_time ${ordering},b.id ${ordering}
     LIMIT $${limitParameter}`,
    values,
  );
  const hasMore = result.rows.length > parsedLimit;
  const rows = result.rows.slice(0, parsedLimit);
  const items = rows.map((row) => ({
    id: row.id,
    reference: row.reference,
    date: formatKey(row.tee_date),
    time: row.tee_time,
    players: row.players,
    caddy: row.caddy_code,
    buggy: row.buggy,
    extras: Object.fromEntries(row.items.filter((item) => item.code !== 'buggy').map((item) => [item.code, item.quantity])),
    status: row.status,
    total: Number(row.total_idr),
  }));
  const last = rows.at(-1);
  const nextCursor = hasMore && last
    ? Buffer.from(JSON.stringify({ date: formatKey(last.tee_date), time: last.tee_time, id: last.id })).toString('base64url')
    : null;
  return { items, nextCursor };
}

export async function getHandicap(userId) {
  const rounds = await loadRounds(getPool(), userId);
  const calculated = calculateIndex(rounds.map((round) => ({
    id: round.id,
    playedOn: round.playedOn,
    grossScore: round.grossScore,
    courseRating: round.courseRating,
    slope: round.slope,
  })));
  return {
    ...calculated,
    indicative: true,
    trend: rounds.slice().reverse().map((round) => ({
      dateKey: round.playedOn,
      index: calculateIndex(rounds.filter((item) => item.playedOn <= round.playedOn)).index,
    })).filter((point) => point.index !== null),
  };
}

export async function listRounds(userId, { limit = 20, cursor } = {}) {
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const result = await getPool().query(
    `SELECT id, played_on, gross_score, differential, source, verified_at
     FROM rounds WHERE user_id=$1 AND ($2::date IS NULL OR played_on < $2::date)
     ORDER BY played_on DESC,id DESC LIMIT $3`,
    [userId, cursor || null, safeLimit + 1],
  );
  const hasMore = result.rows.length > safeLimit;
  const rows = result.rows.slice(0, safeLimit);
  return {
    items: rows.map((row) => ({
      id: row.id,
      playedOn: formatKey(row.played_on),
      grossScore: row.gross_score,
      differential: Number(row.differential),
      source: row.source,
      verified: Boolean(row.verified_at),
    })),
    nextCursor: hasMore ? formatKey(rows.at(-1).played_on) : null,
  };
}

export async function addRound(userId, body) {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(body?.playedOn || ''), 400, 'validation_error', 'playedOn must use YYYY-MM-DD.');
  const day = new Date(`${body.playedOn}T00:00:00Z`);
  assert(!Number.isNaN(day.getTime()) && day.toISOString().slice(0, 10) === body.playedOn, 400, 'validation_error', 'playedOn is not a valid date.');
  assert(Number.isInteger(body.grossScore) && body.grossScore >= 50 && body.grossScore <= 150, 400, 'validation_error', 'grossScore must be an integer from 50 to 150.');

  return inTransaction(async (client) => {
    await client.query('SELECT user_id FROM members WHERE user_id=$1 FOR UPDATE', [userId]);
    const dateCheck = await client.query(
      `SELECT $1::date <= timezone('Asia/Jakarta',now())::date AS not_future,
              $1::date >= timezone('Asia/Jakarta',now())::date - 60 AS in_window`,
      [body.playedOn],
    );
    assert(dateCheck.rows[0].not_future && dateCheck.rows[0].in_window, 400, 'validation_error', 'playedOn must be within the last 60 days.');
    const recent = await client.query(
      `SELECT count(*)::int AS count FROM rounds
       WHERE user_id=$1 AND source='self'
         AND created_at >= now() - interval '7 days'`,
      [userId],
    );
    assert(recent.rows[0].count < 3, 422, 'round_limit_reached', 'At most three self-reported rounds are allowed per seven days.');
    const course = await client.query('SELECT rating,slope FROM courses WHERE id=$1', [COURSE_ID]);
    assert(course.rowCount, 503, 'course_unavailable', 'Course handicap ratings are not configured.');
    const rating = Number(course.rows[0].rating);
    const slope = course.rows[0].slope;
    const diff = differential(body.grossScore, rating, slope);
    const inserted = await client.query(
      `INSERT INTO rounds (user_id,course_id,played_on,gross_score,course_rating,slope,differential,source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'self')
       ON CONFLICT (user_id,played_on) DO NOTHING
       RETURNING id,played_on,gross_score,differential,source,verified_at`,
      [userId, COURSE_ID, body.playedOn, body.grossScore, rating, slope, diff],
    );
    assert(inserted.rowCount, 409, 'duplicate_round', 'A round has already been logged for this date.');
    const rounds = await loadRounds(client, userId);
    const handicap = calculateIndex(rounds.map((round) => ({
      id: round.id,
      playedOn: round.playedOn,
      grossScore: round.grossScore,
      courseRating: round.courseRating,
      slope: round.slope,
    })));
    await client.query(
      `INSERT INTO handicap_snapshots (user_id,index_value,rounds_considered,rounds_used,trigger_round_id)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, handicap.index, handicap.sample, handicap.used, inserted.rows[0].id],
    );
    return {
      round: {
        id: inserted.rows[0].id,
        playedOn: formatKey(inserted.rows[0].played_on),
        grossScore: inserted.rows[0].gross_score,
        differential: Number(inserted.rows[0].differential),
        verified: false,
      },
      handicap: { ...handicap, indicative: true },
    };
  });
}

export async function getTierProgress(userId) {
  const result = await getPool().query(
    `SELECT t.code,t.min_rounds,t.cashback_bps,t.advance_days,
       count(r.id)::int AS rounds
     FROM tiers t
     LEFT JOIN rounds r ON r.user_id=$1 AND r.verified_at IS NOT NULL
       AND r.played_on >= current_date - 365
     GROUP BY t.code,t.min_rounds,t.cashback_bps,t.advance_days
     ORDER BY t.min_rounds`,
    [userId],
  );
  const count = Number(result.rows[0]?.rounds || 0);
  let current = result.rows[0];
  for (const tier of result.rows) if (count >= tier.min_rounds) current = tier;
  const next = result.rows.find((tier) => tier.min_rounds > count) || null;
  const previous = result.rows.filter((tier) => tier.min_rounds <= count).at(-1) || current;
  const percent = next
    ? Math.min(100, ((count - previous.min_rounds) / (next.min_rounds - previous.min_rounds)) * 100)
    : 100;
  return {
    qualifyingRounds: count,
    current: { id: current.code, label: current.code[0].toUpperCase() + current.code.slice(1), cashbackRate: current.cashback_bps / 10000, advanceDays: current.advance_days },
    next: next ? { id: next.code, label: next.code[0].toUpperCase() + next.code.slice(1), minRounds: next.min_rounds } : null,
    percent,
    remaining: next ? next.min_rounds - count : 0,
  };
}

export async function getPoints(userId, { limit = 20 } = {}) {
  const pool = getPool();
  const [balance, entries] = await Promise.all([
    pool.query('SELECT points FROM member_balances WHERE user_id=$1', [userId]),
    pool.query('SELECT id,entry_type,points,balance_after,ref_type,ref_id,description,created_at FROM points_ledger WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2', [userId, Math.min(100, Number(limit) || 20)]),
  ]);
  assert(balance.rowCount, 404, 'not_found', 'Member balance was not found.');
  return { balance: Number(balance.rows[0].points), entries: entries.rows };
}

export async function getWallet(userId, { limit = 20 } = {}) {
  const pool = getPool();
  const [balance, entries] = await Promise.all([
    pool.query('SELECT wallet_idr FROM member_balances WHERE user_id=$1', [userId]),
    pool.query('SELECT id,entry_type,amount_idr,balance_after,ref_type,ref_id,description,created_at FROM wallet_ledger WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2', [userId, Math.min(100, Number(limit) || 20)]),
  ]);
  assert(balance.rowCount, 404, 'not_found', 'Member balance was not found.');
  return { balance: Number(balance.rows[0].wallet_idr), entries: entries.rows };
}

export async function listRewards() {
  const result = await getPool().query('SELECT code,label,description,cost_points FROM rewards WHERE active ORDER BY cost_points');
  return { items: result.rows };
}

export async function listVouchers(userId, status) {
  const result = await getPool().query(
    `SELECT id,code,label,source,value_idr,valid_until,status,created_at
     FROM vouchers WHERE user_id=$1 AND ($2::text IS NULL OR status=$2)
     ORDER BY created_at DESC`,
    [userId, status || null],
  );
  return { items: result.rows };
}

export async function redeemReward(userId, code, idempotencyKey) {
  assert(idempotencyKey && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey), 400, 'validation_error', 'A UUID Idempotency-Key header is required.');
  return inTransaction(async (client) => {
    const scope = `${userId}:POST:/api/v1/me/rewards/${code}/redeem`;
    const prior = await client.query('SELECT * FROM idempotency_keys WHERE scope=$1 AND key=$2 FOR UPDATE', [scope, idempotencyKey]);
    if (prior.rowCount) {
      assert(prior.rows[0].response_body, 409, 'request_in_progress', 'The redemption request is in progress.');
      return { status: prior.rows[0].response_status, body: prior.rows[0].response_body };
    }

    await client.query(
      `INSERT INTO idempotency_keys(scope,key,request_hash)
       VALUES($1,$2,encode(digest($3,'sha256'),'hex'))`,
      [scope, idempotencyKey, code],
    );
    const reward = await client.query('SELECT * FROM rewards WHERE code=$1 AND active', [code]);
    assert(reward.rowCount, 404, 'not_found', 'Reward was not found.');
    const debit = await client.query(
      `UPDATE member_balances SET points=points-$2,updated_at=now()
       WHERE user_id=$1 AND points >= $2 RETURNING points`,
      [userId, reward.rows[0].cost_points],
    );
    assert(debit.rowCount, 422, 'insufficient_points', 'There are not enough loyalty points for this reward.');
    const voucherCode = `RW-${randomBytes(8).toString('hex').toUpperCase()}`;
    const voucher = await client.query(
      `INSERT INTO vouchers(user_id,code,kind,label,source,valid_until)
       VALUES($1,$2,'reward',$3,$4,current_date+90)
       RETURNING id,code,label,source,valid_until,status`,
      [userId, voucherCode, reward.rows[0].label, `reward:${code}`],
    );
    await client.query(
      `INSERT INTO points_ledger(user_id,entry_type,points,balance_after,ref_type,ref_id,description,idempotency_key)
       VALUES($1,'redeem',$2,$3,'reward',$4,$5,$6)`,
      [userId, -reward.rows[0].cost_points, debit.rows[0].points, code, `Redeemed: ${reward.rows[0].label}`, `redeem:${idempotencyKey}`],
    );
    const body = {
      voucher: { ...voucher.rows[0], validUntil: formatKey(voucher.rows[0].valid_until) },
      pointsBalance: Number(debit.rows[0].points),
    };
    await client.query(
      'UPDATE idempotency_keys SET response_status=201,response_body=$3 WHERE scope=$1 AND key=$2',
      [scope, idempotencyKey, body],
    );
    return { status: 201, body };
  });
}

export async function makeRoundId() {
  const result = await getPool().query('SELECT gen_random_uuid() AS id');
  return result.rows[0].id;
}

export const pointsForSpend = (amount) => Math.floor(amount / POINT_VALUE_IDR);
