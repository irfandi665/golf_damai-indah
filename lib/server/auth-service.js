import { randomBytes, scrypt as callbackScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getPool, inTransaction } from './db';
import { ApiError, assert } from './errors';
import { createSession } from './session';

const scrypt = promisify(callbackScrypt);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^(\+62|62|0)8\d{8,12}$/;

async function hashPassword(password) {
  const salt = randomBytes(16);
  const digest = await scrypt(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${Buffer.from(digest).toString('hex')}`;
}

async function verifyPassword(password, encoded) {
  const [algorithm, saltHex, digestHex] = encoded.split('$');
  if (algorithm !== 'scrypt' || !saltHex || !digestHex) return false;
  const expected = Buffer.from(digestHex, 'hex');
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function registerMember(body) {
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const phone = String(body?.phone || '').replace(/[\s-]/g, '');
  const password = String(body?.password || '');
  assert(name.length >= 2 && name.length <= 120, 400, 'validation_error', 'Name must be between 2 and 120 characters.');
  assert(emailPattern.test(email) && email.length <= 254, 400, 'validation_error', 'Enter a valid email address.');
  assert(phonePattern.test(phone), 400, 'validation_error', 'Enter a valid Indonesian mobile number.');
  assert(password.length >= 12 && password.length <= 128, 400, 'validation_error', 'Password must be between 12 and 128 characters.');
  const passwordHash = await hashPassword(password);

  const user = await inTransaction(async (client) => {
    const inserted = await client.query(
      `INSERT INTO users (email, phone, full_name, password_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, email, full_name`,
      [email, phone, name, passwordHash],
    );
    const id = inserted.rows[0].id;
    const memberNo = `DIG-${randomBytes(4).toString('hex').toUpperCase()}`;
    await client.query('INSERT INTO members (user_id, member_no) VALUES ($1,$2)', [id, memberNo]);
    await client.query('INSERT INTO member_balances (user_id) VALUES ($1)', [id]);
    return { ...inserted.rows[0], memberNo };
  });

  const session = await createSession(user.id);
  return { user: { id: user.id, email: user.email, name: user.full_name, memberNo: user.memberNo }, ...session };
}

export async function loginMember(body) {
  const email = String(body?.email || '').trim().toLowerCase();
  const password = String(body?.password || '');
  assert(emailPattern.test(email) && password.length > 0, 400, 'validation_error', 'Enter your email and password.');
  const result = await getPool().query(
    `SELECT id, email, full_name, is_active, password_hash
     FROM users WHERE email = $1`,
    [email],
  );
  const user = result.rows[0];
  const passwordValid = user && await verifyPassword(password, user.password_hash);
  assert(passwordValid && user.is_active, 401, 'invalid_credentials', 'Email or password is incorrect.');
  const member = await getPool().query('SELECT member_no FROM members WHERE user_id = $1', [user.id]);
  assert(member.rowCount, 403, 'forbidden', 'This account does not have a member profile.');
  const session = await createSession(user.id);
  return { user: { id: user.id, email: user.email, name: user.full_name, memberNo: member.rows[0].member_no }, ...session };
}

export async function logoutSession(session) {
  if (session?.id) await getPool().query('DELETE FROM sessions WHERE id = $1', [session.id]);
}

export async function updateMemberProfile(userId, body) {
  const name = String(body?.name || '').trim();
  const phone = String(body?.phone || '').replace(/[\s-]/g, '');
  assert(name.length >= 2 && name.length <= 120, 400, 'validation_error', 'Name must be between 2 and 120 characters.');
  assert(phonePattern.test(phone), 400, 'validation_error', 'Enter a valid Indonesian mobile number.');
  const result = await getPool().query(
    `UPDATE users SET full_name=$2, phone=$3, updated_at=now()
     WHERE id=$1 AND is_active
     RETURNING id, email, full_name, phone`,
    [userId, name, phone],
  );
  if (!result.rowCount) throw new ApiError(404, 'not_found', 'Member was not found.');
  return { id: result.rows[0].id, email: result.rows[0].email, name: result.rows[0].full_name, phone: result.rows[0].phone };
}
