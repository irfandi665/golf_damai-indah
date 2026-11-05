import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { getPool } from './db';
import { ApiError, assert } from './errors';

const SESSION_COOKIE = 'golf_session';
const CSRF_COOKIE = 'golf_csrf';
const SESSION_DAYS = 30;

const hash = (value) => createHash('sha256').update(value).digest('hex');
const safeEqual = (left, right) => {
  const a = Buffer.from(left || '');
  const b = Buffer.from(right || '');
  return a.length === b.length && timingSafeEqual(a, b);
};

function cookies(request) {
  return Object.fromEntries(
    (request.headers.get('cookie') || '')
      .split(';')
      .map((cookie) => cookie.trim().split(/=(.*)/s, 2))
      .filter(([name, value]) => name && value !== undefined)
      .map(([name, value]) => [name, decodeURIComponent(value)]),
  );
}

function cookieHeader(name, value, maxAge) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const httpOnly = name === SESSION_COOKIE ? '; HttpOnly' : '';
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}${httpOnly}; SameSite=Lax${secure}`;
}

export async function createSession(userId = null) {
  const sessionToken = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const result = await getPool().query(
    `INSERT INTO sessions (token_hash, csrf_hash, user_id, expires_at)
     VALUES ($1, $2, $3, $4) RETURNING id, expires_at`,
    [hash(sessionToken), hash(csrfToken), userId, expiresAt],
  );
  return {
    session: { ...result.rows[0], userId },
    cookies: [
      cookieHeader(SESSION_COOKIE, sessionToken, SESSION_DAYS * 86400),
      cookieHeader(CSRF_COOKIE, csrfToken, SESSION_DAYS * 86400),
    ],
  };
}

export async function getSession(request, { required = false, member = false, csrf = false } = {}) {
  const jar = cookies(request);
  const token = jar[SESSION_COOKIE];
  if (!token) {
    assert(!required && !member, 401, 'unauthenticated', 'A valid session is required.');
    return null;
  }

  const result = await getPool().query(
    `SELECT s.id, s.user_id, s.csrf_hash, s.expires_at, u.role, u.is_active
     FROM sessions s LEFT JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hash(token)],
  );
  const session = result.rows[0];
  if (!session) {
    assert(!required && !member, 401, 'unauthenticated', 'The session is invalid or expired.');
    return null;
  }
  assert(session.user_id === null || session.is_active, 401, 'unauthenticated', 'The account is inactive.');
  if (member) assert(session.user_id, 401, 'unauthenticated', 'Sign in to access member data.');
  if (csrf) {
    const header = request.headers.get('x-csrf-token');
    assert(header && safeEqual(hash(header), session.csrf_hash), 403, 'csrf_failed', 'The CSRF token is invalid.');
  }

  return { id: session.id, userId: session.user_id, role: session.role, token };
}

export function setSessionCookies(response, cookieValues = []) {
  for (const value of cookieValues) response.headers.append('set-cookie', value);
  return response;
}

export function readCsrfCookie(request) {
  return cookies(request)[CSRF_COOKIE] || null;
}

export async function resolveSession(request, options = {}) {
  const existing = await getSession(request, options);
  if (existing) return { session: existing, cookies: [] };
  if (options.required || options.member) return { session: null, cookies: [] };
  const created = await createSession();
  return {
    session: created.session,
    cookies: created.cookies,
    csrfToken: created.cookies[1].match(/golf_csrf=([^;]+)/)?.[1],
  };
}

export async function requireRole(session, roles) {
  if (!session?.userId) throw new ApiError(401, 'unauthenticated', 'Sign in to continue.');
  const result = await getPool().query('SELECT role FROM users WHERE id = $1 AND is_active', [session.userId]);
  assert(result.rows[0] && roles.includes(result.rows[0].role), 403, 'forbidden', 'Your account does not have permission for this action.');
  return result.rows[0].role;
}
