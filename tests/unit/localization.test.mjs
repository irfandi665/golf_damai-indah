import assert from 'node:assert/strict';
import test from 'node:test';
import { formatLongDate } from '../../lib/booking/utils.js';
import { buildBookingConfirmationEmail } from '../../lib/server/booking-ticket.js';

test('booking display dates follow the selected presentation locale', () => {
  const date = '2026-07-15';
  assert.match(formatLongDate(date, 'id'), /Rabu/);
  assert.match(formatLongDate(date, 'en'), /Wednesday/);
});

test('booking confirmation email includes bilingual booking details and payment caveat', async () => {
  process.env.QR_SIGNING_SECRET = 'local-test-signing-secret';
  process.env.APP_ORIGIN = 'http://localhost:3000';
  const email = await buildBookingConfirmationEmail({
    id: 'localization-test-booking',
    reference: 'DIG-TEST-1',
    courseName: 'Damai Indah Golf',
    displayDate: 'Wednesday, 15 July 2026',
    time: '06:00',
    players: 2,
    teeBox: 'Tee 1',
    packageType: 'Weekday',
    totalLabel: 'Rp1.000.000',
    guest: { name: 'Test Member' },
  });

  assert.match(email.html, /Waktu Main \/ Tee-off Time/);
  assert.match(email.html, /Nomor Tee Box \/ Tee Box/);
  assert.match(email.html, /Pembayaran dilakukan di klub/);
  assert.match(email.html, /Payment is made at the club/);
  assert.equal(email.attachments.some((attachment) => attachment.content_type === 'application/pdf'), true);
});
