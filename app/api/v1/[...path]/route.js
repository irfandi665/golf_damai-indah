import { createHash } from 'node:crypto';
import { ApiError, assert, problemResponse } from '@/lib/server/errors';
import { enforceRateLimit } from '@/lib/server/rate-limit';
import {
  cancelBooking,
  createBooking,
  createHold,
  getBooking,
  listTeeTimes,
  quoteForHold,
  releaseHold,
} from '@/lib/server/booking-service';
import {
  getHandicap,
  getMemberDashboard,
  getMemberProfile,
  getPoints,
  getTierProgress,
  getWallet,
  addRound,
  listRewards,
  listRounds,
  listMemberBookings,
  listVouchers,
  redeemReward,
} from '@/lib/server/member-service';
import {
  changePassword,
  loginMember,
  logoutSession,
  registerMember,
  requestPasswordReset,
  resetPassword,
  sendEmailVerification,
  updateMemberProfile,
  verifyEmail,
} from '@/lib/server/auth-service';
import {
  blockTeeSlots,
  checkInBooking,
  completeBooking,
  getTeeSheet,
  makeBookingQr,
  redeemVoucher,
  updateRateCard,
  updateServiceItem,
  verifyRound,
} from '@/lib/server/staff-service';
import {
  createAnnouncement,
  createCourseUpdate,
  createEventInterestEmail,
  createPublicInquiry,
  deactivateCourseUpdate,
  getPublicPricing,
  listAnnouncements,
  listCourseUpdates,
  listInquiries,
  updateInquiryStatus,
} from '@/lib/server/public-service';
import { processEmailOutbox, queueEmail } from '@/lib/server/email-service';
import {
  createSession,
  getSession,
  requireRole,
  readCsrfCookie,
  setSessionCookies,
} from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const json = (body, status = 200, headers = {}) => Response.json(body, {
  status,
  headers: { 'cache-control': 'no-store', ...headers },
});

async function requestBody(request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, 'validation_error', 'Request body must be valid JSON.');
  }
}

function requireIdempotencyKey(request) {
  return request.headers.get('idempotency-key');
}

async function memberSession(request, csrf = false) {
  return getSession(request, { required: true, member: true, csrf });
}

function ownerAccessToken(request) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
}

async function dispatch(request, segments) {
  const method = request.method.toUpperCase();
  const [resource, subresource, identifier, action] = segments;
  const url = new URL(request.url);

  if (resource === 'auth' && subresource === 'session' && method === 'GET') {
    let session = await getSession(request);
    let cookieValues = [];
    if (!session) {
      const created = await createSession();
      session = created.session;
      cookieValues = created.cookies;
    }
    const response = json({
      authenticated: Boolean(session.userId),
      csrfToken: readCsrfCookie(request) || decodeURIComponent(cookieValues[1]?.match(/golf_csrf=([^;]+)/)?.[1] || ''),
    });
    return setSessionCookies(response, cookieValues);
  }

  if (resource === 'auth' && subresource === 'register' && method === 'POST') {
    await enforceRateLimit(request, 'register', 5, 3600);
    await getSession(request, { required: true, csrf: true });
    const result = await registerMember(await requestBody(request));
    const response = json({ user: result.user, csrfToken: decodeURIComponent(result.cookies[1].match(/golf_csrf=([^;]+)/)?.[1] || '') }, 201);
    return setSessionCookies(response, result.cookies);
  }

  if (resource === 'auth' && subresource === 'login' && method === 'POST') {
    await enforceRateLimit(request, 'login', 10, 900);
    await getSession(request, { required: true, csrf: true });
    const result = await loginMember(await requestBody(request));
    const response = json({ user: result.user, csrfToken: decodeURIComponent(result.cookies[1].match(/golf_csrf=([^;]+)/)?.[1] || '') });
    return setSessionCookies(response, result.cookies);
  }

  if (resource === 'auth' && subresource === 'logout' && method === 'POST') {
    const session = await memberSession(request, true);
    await logoutSession(session);
    const response = json({ loggedOut: true });
    response.headers.append('set-cookie', 'golf_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax');
    response.headers.append('set-cookie', 'golf_csrf=; Path=/; Max-Age=0; SameSite=Lax');
    return response;
  }

  if (resource === 'auth' && subresource === 'email' && identifier === 'verification' && method === 'POST') {
    const session = await memberSession(request, true);
    await enforceRateLimit(request, 'email-verification', 3, 3600);
    return json(await sendEmailVerification(session.userId));
  }

  if (resource === 'auth' && subresource === 'email' && identifier === 'verify' && method === 'POST') {
    await enforceRateLimit(request, 'email-verification-token', 10, 3600);
    return json(await verifyEmail((await requestBody(request)).token));
  }

  if (resource === 'auth' && subresource === 'password' && identifier === 'forgot' && method === 'POST') {
    await enforceRateLimit(request, 'password-reset', 5, 3600);
    return json(await requestPasswordReset((await requestBody(request)).email), 202);
  }

  if (resource === 'auth' && subresource === 'password' && identifier === 'reset' && method === 'POST') {
    await enforceRateLimit(request, 'password-reset-token', 10, 3600);
    const body = await requestBody(request);
    return json(await resetPassword(body.token, body.password));
  }

  if (resource === 'tee-times' && !subresource && method === 'GET') {
    const result = await listTeeTimes({
      courseId: Number(url.searchParams.get('courseId') || 1),
      date: url.searchParams.get('date'),
      players: Number(url.searchParams.get('players') || 1),
    });
    return json(result, 200, { 'cache-control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=15' });
  }

  if (resource === 'tee-times' && subresource === 'holds' && !identifier && method === 'POST') {
    const session = await getSession(request, { required: true, csrf: true });
    await enforceRateLimit(request, 'holds', 12, 60);
    const body = await requestBody(request);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown';
    const ipSecret = process.env.HOLD_IP_HASH_SECRET;
    if (process.env.NODE_ENV === 'production' && !ipSecret) {
      throw new ApiError(503, 'service_unavailable', 'HOLD_IP_HASH_SECRET is required in production.');
    }
    const clientIpHash = createHash('sha256').update(`${ipSecret || 'development'}:${ip}`).digest('hex');
    return json(await createHold({ session, slotId: body.slotId, players: body.players, clientIpHash }), 201);
  }

  if (resource === 'tee-times' && subresource === 'holds' && identifier && method === 'DELETE') {
    const session = await getSession(request, { required: true, csrf: true });
    return json(await releaseHold({ session, holdId: identifier }));
  }

  if (resource === 'quotes' && !subresource && method === 'POST') {
    const session = await getSession(request, { required: true });
    const body = await requestBody(request);
    const quote = await quoteForHold({
      session,
      holdId: body.holdId,
      caddy: body.caddy,
      buggy: body.buggy,
      extras: body.extras || {},
    });
    const { slot, players, caddy, buggy, extras, items, ...response } = quote;
    return json(response);
  }

  if (resource === 'bookings' && !subresource && method === 'POST') {
    const session = await getSession(request, { required: true, csrf: true });
    const body = await requestBody(request);
    const result = await createBooking({ session, body, idempotencyKey: requireIdempotencyKey(request) });
    const booking = await getBooking({ id: result.body.id, session });
    const emailKey = `booking-confirmed:${result.body.id}`;
    await queueEmail({
      dedupeKey: emailKey,
      to: booking.guest.email,
      subject: `Tee time confirmed — ${booking.reference}`,
      text: `Your tee time reservation is confirmed.\n\nReference: ${booking.reference}\nDate: ${booking.date}\nTime: ${booking.time}\nPlayers: ${booking.players}\nTotal due at the club: Rp${new Intl.NumberFormat('id-ID').format(booking.total)}.\n\nPayment is settled at the club. This website does not process payments.`,
    });
    const delivery = await processEmailOutbox({ limit: 1, dedupeKey: emailKey });
    return json({
      ...result.body,
      emailNotification: delivery.sent ? 'sent' : 'queued',
    }, result.status);
  }

  if (resource === 'bookings' && subresource && !identifier && method === 'GET') {
    const session = await getSession(request);
    return json(await getBooking({
      id: subresource,
      session,
      accessToken: ownerAccessToken(request),
    }));
  }

  if (resource === 'bookings' && subresource && identifier === 'qr' && method === 'GET') {
    const session = await getSession(request, { required: true });
    return json(await makeBookingQr({ bookingId: subresource, session }));
  }

  if (resource === 'bookings' && subresource && identifier === 'cancel' && method === 'POST') {
    const session = await getSession(request, { required: true, csrf: true });
    const result = await cancelBooking({
      bookingId: subresource,
      session,
      idempotencyKey: requireIdempotencyKey(request),
    });
    const booking = await getBooking({ id: subresource, session });
    const emailKey = `booking-cancelled:${subresource}:${requireIdempotencyKey(request)}`;
    await queueEmail({
      dedupeKey: emailKey,
      to: booking.guest.email,
      subject: `Reservation cancelled — ${booking.reference}`,
      text: `Your tee time reservation has been cancelled.\n\nReference: ${booking.reference}\nDate: ${booking.date}\nTime: ${booking.time}\nCancellation category: ${result.body.kind}.\n\nAll payments are settled at the club. This website does not process payments.`,
    });
    const delivery = await processEmailOutbox({ limit: 1, dedupeKey: emailKey });
    return json({ ...result.body, emailNotification: delivery.sent ? 'sent' : 'queued' }, result.status);
  }

  if (resource === 'staff' && subresource === 'check-in' && method === 'POST') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['staff', 'admin']);
    const body = await requestBody(request);
    return json(await checkInBooking({ staffId: session.userId, qrToken: body.qrToken }));
  }

  if (resource === 'staff' && subresource === 'session' && method === 'GET') {
    const session = await getSession(request, { required: true });
    await requireRole(session, ['staff', 'admin']);
    return json({ role: session.role });
  }

  if (resource === 'staff' && subresource === 'bookings' && identifier && action === 'complete' && method === 'POST') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['staff', 'admin']);
    return json(await completeBooking({ staffId: session.userId, bookingId: identifier }));
  }

  if (resource === 'staff' && subresource === 'tee-sheet' && method === 'GET') {
    const session = await getSession(request, { required: true });
    await requireRole(session, ['staff', 'admin']);
    return json(await getTeeSheet({
      date: url.searchParams.get('date'),
      courseId: Number(url.searchParams.get('courseId') || 1),
    }));
  }

  if (resource === 'staff' && subresource === 'rounds' && identifier && action === 'verify' && method === 'POST') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['staff', 'admin']);
    return json(await verifyRound({ staffId: session.userId, roundId: identifier, source: (await requestBody(request)).source }));
  }

  if (resource === 'staff' && subresource === 'vouchers' && identifier && action === 'redeem' && method === 'POST') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['staff', 'admin']);
    return json(await redeemVoucher({ staffId: session.userId, code: identifier, bookingId: (await requestBody(request)).bookingId }));
  }

  if (resource === 'admin' && subresource === 'tee-sheet' && identifier === 'blocks' && method === 'PUT') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['admin']);
    return json(await blockTeeSlots({ adminId: session.userId, ...(await requestBody(request)) }));
  }

  if (resource === 'admin' && subresource === 'rate-cards' && method === 'PUT') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['admin']);
    return json(await updateRateCard({ adminId: session.userId, item: await requestBody(request) }));
  }

  if (resource === 'admin' && subresource === 'service-items' && method === 'PUT') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['admin']);
    return json(await updateServiceItem({ adminId: session.userId, item: await requestBody(request) }));
  }

  if (resource === 'admin' && subresource === 'inquiries' && !identifier && method === 'GET') {
    const session = await getSession(request, { required: true });
    await requireRole(session, ['admin']);
    return json(await listInquiries({
      status: url.searchParams.get('status') || 'new',
      limit: url.searchParams.get('limit') || 50,
    }));
  }

  if (resource === 'admin' && subresource === 'inquiries' && identifier && method === 'PATCH') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['admin']);
    return json(await updateInquiryStatus({ adminId: session.userId, inquiryId: identifier, status: (await requestBody(request)).status }));
  }

  if (resource === 'admin' && subresource === 'course-updates' && !identifier && method === 'POST') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['admin']);
    return json(await createCourseUpdate({ adminId: session.userId, body: await requestBody(request) }), 201);
  }

  if (resource === 'admin' && subresource === 'course-updates' && identifier && method === 'DELETE') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['admin']);
    return json(await deactivateCourseUpdate({ adminId: session.userId, updateId: identifier }));
  }

  if (resource === 'admin' && subresource === 'announcements' && !identifier && method === 'POST') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['admin']);
    return json(await createAnnouncement({ adminId: session.userId, body: await requestBody(request) }), 201);
  }

  if (resource === 'admin' && subresource === 'email-outbox' && identifier === 'process' && method === 'POST') {
    const session = await getSession(request, { required: true, csrf: true });
    await requireRole(session, ['admin']);
    return json(await processEmailOutbox({ limit: 20 }));
  }

  if (resource === 'pricing' && !subresource && method === 'GET') {
    return json(await getPublicPricing());
  }

  if (resource === 'course-updates' && !subresource && method === 'GET') {
    return json(await listCourseUpdates());
  }

  if (resource === 'announcements' && !subresource && method === 'GET') {
    return json(await listAnnouncements());
  }

  if (resource === 'inquiries' && !subresource && method === 'POST') {
    await enforceRateLimit(request, 'public-inquiry', 5, 3600);
    const inquiry = await createPublicInquiry(await requestBody(request));
    const notifyAddress = process.env.CLUB_CONTACT_EMAIL;
    let emailNotification = 'not_configured';
    if (notifyAddress) {
      const details = await createEventInterestEmail({ inquiryId: inquiry.id });
      await queueEmail({
        dedupeKey: `public-inquiry:${inquiry.id}`,
        to: notifyAddress,
        subject: `New ${details.subject} inquiry`,
        text: `Name: ${details.name}\nEmail: ${details.email}\nSubject: ${details.subject}\n\n${details.message}\n\nReference: ${inquiry.id}`,
      });
      const delivery = await processEmailOutbox({ limit: 1, dedupeKey: `public-inquiry:${inquiry.id}` });
      emailNotification = delivery.sent ? 'sent' : 'queued';
    }
    return json({ ...inquiry, emailNotification }, 201);
  }

  if (resource === 'me' && !subresource && method === 'GET') {
    const session = await memberSession(request);
    return json(await getMemberProfile(session.userId));
  }

  if (resource === 'me' && !subresource && method === 'PATCH') {
    const session = await memberSession(request, true);
    return json(await updateMemberProfile(session.userId, await requestBody(request)));
  }

  if (resource === 'me' && subresource === 'password' && method === 'PATCH') {
    const session = await memberSession(request, true);
    const body = await requestBody(request);
    return json(await changePassword(session.userId, body.currentPassword, body.newPassword));
  }

  if (resource === 'me' && subresource === 'dashboard' && method === 'GET') {
    const session = await memberSession(request);
    return json(await getMemberDashboard(session.userId));
  }

  if (resource === 'me' && subresource === 'bookings' && method === 'GET') {
    const session = await memberSession(request);
    return json(await listMemberBookings(session.userId, {
      status: url.searchParams.get('status'),
      limit: url.searchParams.get('limit') || 20,
      cursor: url.searchParams.get('cursor'),
    }));
  }

  if (resource === 'me' && subresource === 'handicap' && method === 'GET') {
    const session = await memberSession(request);
    return json(await getHandicap(session.userId));
  }

  if (resource === 'me' && subresource === 'rounds' && method === 'GET') {
    const session = await memberSession(request);
    return json(await listRounds(session.userId, {
      limit: url.searchParams.get('limit'),
      cursor: url.searchParams.get('cursor'),
    }));
  }

  if (resource === 'me' && subresource === 'rounds' && method === 'POST') {
    const session = await memberSession(request, true);
    return json(await addRound(session.userId, await requestBody(request)), 201);
  }

  if (resource === 'me' && subresource === 'tier' && method === 'GET') {
    const session = await memberSession(request);
    return json(await getTierProgress(session.userId));
  }

  if (resource === 'me' && subresource === 'points' && method === 'GET') {
    const session = await memberSession(request);
    return json(await getPoints(session.userId, { limit: url.searchParams.get('limit') }));
  }

  if (resource === 'me' && subresource === 'wallet' && method === 'GET') {
    const session = await memberSession(request);
    return json(await getWallet(session.userId, { limit: url.searchParams.get('limit') }));
  }

  if (resource === 'rewards' && !subresource && method === 'GET') {
    return json(await listRewards());
  }

  if (resource === 'me' && subresource === 'vouchers' && method === 'GET') {
    const session = await memberSession(request);
    return json(await listVouchers(session.userId, url.searchParams.get('status')));
  }

  if (resource === 'me' && subresource === 'rewards' && identifier && action === 'redeem' && method === 'POST') {
    const session = await memberSession(request, true);
    await enforceRateLimit(request, 'redeem', 10, 3600);
    const result = await redeemReward(session.userId, identifier, requireIdempotencyKey(request));
    return json(result.body, result.status);
  }

  throw new ApiError(404, 'not_found', 'API endpoint was not found.');
}

async function handle(request, context) {
  try {
    const params = await context.params;
    return await dispatch(request, params.path || []);
  } catch (error) {
    const response = problemResponse(error);
    if (error.status === 429 && error.errors?.[0]?.field === 'retryAfter') {
      response.headers.set('retry-after', error.errors[0].message);
    }
    return response;
  }
}

export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
