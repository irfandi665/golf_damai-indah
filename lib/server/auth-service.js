import { createHash, randomBytes, scrypt as callbackScrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getPool, inTransaction } from './db';
import { ApiError, assert } from './errors';
import { createSession } from './session';
import { processEmailOutbox, queueEmail } from './email-service';

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

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

async function createEmailAction(userId, purpose) {
  const token = randomBytes(32).toString('base64url');
  await inTransaction(async (client) => {
    await client.query(
      'UPDATE email_action_tokens SET used_at=now() WHERE user_id=$1 AND purpose=$2 AND used_at IS NULL',
      [userId, purpose],
    );
    await client.query(
      `INSERT INTO email_action_tokens(token_hash,user_id,purpose,expires_at)
       VALUES($1,$2,$3,now()+$4::interval)`,
      [hashToken(token), userId, purpose, purpose === 'verify_email' ? '24 hours' : '1 hour'],
    );
  });
  return token;
}

export async function sendEmailVerification(userId) {
  const result = await getPool().query(
    'SELECT email,email_verified_at FROM users WHERE id=$1 AND is_active',
    [userId],
  );
  assert(result.rowCount, 404, 'not_found', 'Member was not found.');
  if (result.rows[0].email_verified_at) return { sent: false, alreadyVerified: true };
  const token = await createEmailAction(userId, 'verify_email');
  const url = new URL('/member/verify-email', process.env.APP_ORIGIN || 'http://localhost:3000');
  url.searchParams.set('token', token);
  await queueEmail({
    dedupeKey: `verify-email:${userId}:${hashToken(token)}`,
    to: result.rows[0].email,
    subject: 'Verify your Damai Indah Golf email',
    text: `Use this link within 24 hours to verify your email address:\n${url}`,
  });
  const delivery = await processEmailOutbox({ limit: 1, dedupeKey: `verify-email:${userId}:${hashToken(token)}` });
  return { sent: delivery.sent === 1, queued: delivery.failed === 1 || delivery.attempted === 0 };
}

export async function verifyEmail(token) {
  assert(typeof token === 'string' && token.length >= 32 && token.length <= 128, 400, 'invalid_token', 'The verification link is invalid or expired.');
  return inTransaction(async (client) => {
    const result = await client.query(
      `SELECT user_id FROM email_action_tokens
       WHERE token_hash=$1 AND purpose='verify_email' AND used_at IS NULL AND expires_at>now()
       FOR UPDATE`,
      [hashToken(token)],
    );
    assert(result.rowCount, 400, 'invalid_token', 'The verification link is invalid or expired.');
    await client.query('UPDATE users SET email_verified_at=now(),updated_at=now() WHERE id=$1', [result.rows[0].user_id]);
    await client.query('UPDATE email_action_tokens SET used_at=now() WHERE token_hash=$1', [hashToken(token)]);
    return { verified: true };
  });
}

export async function requestPasswordReset(email) {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  assert(emailPattern.test(normalizedEmail) && normalizedEmail.length <= 254, 400, 'validation_error', 'Enter a valid email address.');
  const result = await getPool().query(
    'SELECT id,email FROM users WHERE email=$1 AND is_active',
    [normalizedEmail],
  );
  if (!result.rowCount) return { accepted: true };

  const token = await createEmailAction(result.rows[0].id, 'reset_password');
  const url = new URL('/member/reset-password', process.env.APP_ORIGIN || 'http://localhost:3000');
  url.searchParams.set('token', token);
  await queueEmail({
    dedupeKey: `reset-password:${result.rows[0].id}:${hashToken(token)}`,
    to: result.rows[0].email,
    subject: 'Reset your Damai Indah Golf password',
    text: `Use this link within one hour to reset your password:\n${url}`,
  });
  await processEmailOutbox({ limit: 1, dedupeKey: `reset-password:${result.rows[0].id}:${hashToken(token)}` });
  return { accepted: true };
}

export async function resetPassword(token, password) {
  assert(typeof token === 'string' && token.length >= 32 && token.length <= 128, 400, 'invalid_token', 'The reset link is invalid or expired.');
  assert(typeof password === 'string' && password.length >= 12 && password.length <= 128, 400, 'validation_error', 'Password must be between 12 and 128 characters.');
  const passwordHash = await hashPassword(password);
  return inTransaction(async (client) => {
    const result = await client.query(
      `SELECT user_id FROM email_action_tokens
       WHERE token_hash=$1 AND purpose='reset_password' AND used_at IS NULL AND expires_at>now()
       FOR UPDATE`,
      [hashToken(token)],
    );
    assert(result.rowCount, 400, 'invalid_token', 'The reset link is invalid or expired.');
    await client.query('UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1', [result.rows[0].user_id, passwordHash]);
    await client.query('UPDATE sessions SET expires_at=now() WHERE user_id=$1', [result.rows[0].user_id]);
    await client.query('UPDATE email_action_tokens SET used_at=now() WHERE token_hash=$1', [hashToken(token)]);
    return { reset: true };
  });
}

export async function changePassword(userId, currentPassword, newPassword) {
  assert(typeof currentPassword === 'string' && currentPassword.length > 0, 400, 'validation_error', 'Current password is required.');
  assert(typeof newPassword === 'string' && newPassword.length >= 12 && newPassword.length <= 128, 400, 'validation_error', 'New password must be between 12 and 128 characters.');
  const result = await getPool().query('SELECT password_hash FROM users WHERE id=$1 AND is_active', [userId]);
  assert(result.rowCount, 404, 'not_found', 'Member was not found.');
  assert(await verifyPassword(currentPassword, result.rows[0].password_hash), 401, 'invalid_credentials', 'Current password is incorrect.');
  const passwordHash = await hashPassword(newPassword);
  await inTransaction(async (client) => {
    await client.query('UPDATE users SET password_hash=$2,updated_at=now() WHERE id=$1', [userId, passwordHash]);
    await client.query('UPDATE sessions SET expires_at=now() WHERE user_id=$1', [userId]);
  });
  return { changed: true };
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
