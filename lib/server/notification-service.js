import { getPool, inTransaction } from './db';
import { assert } from './errors';
import { processEmailOutbox } from './email-service';
import { offerWaitlistForSlot } from './waitlist-service';

export async function getNotificationPreferences(userId) {
  const result = await getPool().query(
    `SELECT email_consent_at,tee_time_reminders,course_updates,digest_frequency,reminder_hours
     FROM member_notification_preferences WHERE user_id=$1`,
    [userId],
  );
  const preference = result.rows[0];
  return {
    emailConsent: Boolean(preference?.email_consent_at),
    teeTimeReminders: preference?.tee_time_reminders ?? false,
    courseUpdates: preference?.course_updates ?? false,
    digestFrequency: preference?.digest_frequency || 'immediate',
    reminderHours: preference?.reminder_hours || 24,
  };
}

export async function updateNotificationPreferences({ userId, body }) {
  assert(typeof body?.emailConsent === 'boolean', 400, 'validation_error', 'Choose whether to consent to email notifications.');
  assert(typeof body.teeTimeReminders === 'boolean' && typeof body.courseUpdates === 'boolean', 400, 'validation_error', 'Notification choices must be boolean.');
  assert(['immediate', 'daily'].includes(body.digestFrequency), 400, 'validation_error', 'digestFrequency must be immediate or daily.');
  assert([3, 24].includes(Number(body.reminderHours)), 400, 'validation_error', 'reminderHours must be 3 or 24.');
  const enabled = body.teeTimeReminders || body.courseUpdates;
  assert(!enabled || body.emailConsent, 400, 'consent_required', 'Consent to email notifications before enabling optional emails.');
  return inTransaction(async (client) => {
    const member = await client.query('SELECT email FROM users WHERE id=$1 AND is_active FOR UPDATE', [userId]);
    assert(member.rowCount, 404, 'not_found', 'Member was not found.');
    const result = await client.query(
      `INSERT INTO member_notification_preferences(
         user_id,email_consent_at,tee_time_reminders,course_updates,digest_frequency,reminder_hours,updated_at
       ) VALUES($1,CASE WHEN $2 THEN now() ELSE NULL END,$3,$4,$5,$6,now())
       ON CONFLICT(user_id) DO UPDATE SET
         email_consent_at=CASE WHEN $2 THEN COALESCE(member_notification_preferences.email_consent_at,now()) ELSE NULL END,
         tee_time_reminders=$3,course_updates=$4,digest_frequency=$5,reminder_hours=$6,updated_at=now()
       RETURNING email_consent_at,tee_time_reminders,course_updates,digest_frequency,reminder_hours`,
      [userId, body.emailConsent, body.teeTimeReminders, body.courseUpdates, body.digestFrequency, Number(body.reminderHours)],
    );
    if (!body.emailConsent) {
      await client.query(
        `DELETE FROM email_outbox WHERE recipient=$1 AND category='optional' AND sent_at IS NULL`,
        [member.rows[0].email],
      );
    }
    const preference = result.rows[0];
    return {
      emailConsent: Boolean(preference.email_consent_at),
      teeTimeReminders: preference.tee_time_reminders,
      courseUpdates: preference.course_updates,
      digestFrequency: preference.digest_frequency,
      reminderHours: preference.reminder_hours,
    };
  });
}

export async function queueCourseUpdateNotifications(update) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO email_outbox(dedupe_key,recipient,subject,body_text,category)
     SELECT 'course-update:'||$1::text||':'||u.id::text,u.email,$2,$3
       ,'optional'
     FROM users u JOIN member_notification_preferences p ON p.user_id=u.id
     WHERE u.is_active AND u.email_verified_at IS NOT NULL AND p.email_consent_at IS NOT NULL
       AND p.course_updates AND p.digest_frequency='immediate'
     ON CONFLICT(dedupe_key) DO NOTHING`,
    [
      update.id,
      `Course update: ${update.title}`,
      `${update.title}\n\n${update.message}\n\nFor current conditions, visit ${new URL('/course', process.env.APP_ORIGIN || 'http://localhost:3000')}`,
    ],
  );
  return { queued: result.rowCount };
}

export async function processScheduledNotifications() {
  const pool = getPool();
  const expiredSlots = await pool.query(
    `SELECT DISTINCT slot_id FROM slot_holds
     WHERE status='active' AND expires_at<=now() ORDER BY slot_id LIMIT 100`,
  );
  for (const row of expiredSlots.rows) {
    await offerWaitlistForSlot(Number(row.slot_id));
  }

  const due = await pool.query(
    `SELECT b.id,b.reference,b.guest_email,b.total_idr,ts.tee_date,
       to_char(ts.tee_time,'HH24:MI') AS tee_time,u.id AS user_id,
       p.reminder_hours,p.digest_frequency
     FROM bookings b JOIN tee_slots ts ON ts.id=b.slot_id
     JOIN users u ON u.id=b.user_id
     JOIN member_notification_preferences p ON p.user_id=u.id
     WHERE b.status='confirmed' AND p.email_consent_at IS NOT NULL
       AND p.tee_time_reminders AND u.email_verified_at IS NOT NULL
       AND (ts.tee_date+ts.tee_time) AT TIME ZONE 'Asia/Jakarta' > now()
       AND (ts.tee_date+ts.tee_time) AT TIME ZONE 'Asia/Jakarta'
         <= now() + make_interval(hours=>p.reminder_hours)
       AND (ts.tee_date+ts.tee_time) AT TIME ZONE 'Asia/Jakarta'
         > now() + make_interval(hours=>p.reminder_hours) - interval '15 minutes'
     ORDER BY ts.tee_date,ts.tee_time LIMIT 500`,
  );

  for (const booking of due.rows) {
    const key = `tee-reminder:${booking.id}:${booking.reminder_hours}h`;
    await pool.query(
      `INSERT INTO email_outbox(dedupe_key,recipient,subject,body_text,category)
       VALUES($1,$2,$3,$4,'optional') ON CONFLICT(dedupe_key) DO NOTHING`,
      [
        key,
        booking.guest_email,
        `Tee time reminder — ${booking.reference}`,
        `Reminder: your tee time is scheduled for ${booking.tee_date.toISOString?.().slice(0, 10) || String(booking.tee_date).slice(0, 10)} at ${booking.tee_time}.\n\nReference: ${booking.reference}\nTotal due at the club: Rp${new Intl.NumberFormat('id-ID').format(Number(booking.total_idr))}.\n\nPayment is made at the club; this website does not process payments.`,
      ],
    );
  }

  const daily = await pool.query(
    `SELECT u.id,u.email,COALESCE(
       string_agg(c.title||E'\\n'||c.message,E'\\n\\n' ORDER BY c.starts_at),''
     ) AS updates
     FROM users u JOIN member_notification_preferences p ON p.user_id=u.id
     JOIN course_updates c ON c.active AND c.starts_at>now()-interval '24 hours' AND c.starts_at<=now()
     WHERE u.is_active AND u.email_verified_at IS NOT NULL AND p.email_consent_at IS NOT NULL
       AND p.course_updates AND p.digest_frequency='daily'
     GROUP BY u.id,u.email LIMIT 1000`,
  );
  for (const member of daily.rows) {
    await pool.query(
      `INSERT INTO email_outbox(dedupe_key,recipient,subject,body_text,category)
       VALUES('course-digest:'||$1::text||':'||timezone('Asia/Jakarta',now())::date::text,$2,$3,$4,'optional')
       ON CONFLICT(dedupe_key) DO NOTHING`,
      [member.id, member.email, 'Your daily course update', `${member.updates}\n\nSee the latest course information at ${new URL('/course', process.env.APP_ORIGIN || 'http://localhost:3000')}`],
    );
  }
  return processEmailOutbox({ limit: 50 });
}
