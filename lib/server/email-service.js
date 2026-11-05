import { ApiError, assert } from './errors';
import { getPool, inTransaction } from './db';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

export async function sendEmail({ to, subject, text, html = null, attachments = [] }) {
  if (process.env.EMAIL_DELIVERY_DISABLED === 'true') {
    throw new ApiError(503, 'email_delivery_disabled', 'Email delivery is disabled for this environment.');
  }
  const apiKey = process.env.RESEND_API_KEY;
  assert(apiKey, 503, 'email_not_configured', 'Email delivery is not configured.');

  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html: html || `<div style="font-family:Arial,sans-serif;line-height:1.6;white-space:pre-line">${escapeHtml(text)}</div>`,
      ...(attachments.length ? { attachments } : {}),
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    const error = new ApiError(502, 'email_delivery_failed', 'The email provider could not deliver this message.');
    error.providerStatus = response.status;
    throw error;
  }

  return response.json();
}

export async function queueEmail({ dedupeKey, to, subject, text, html = null, attachments = [], category = 'transactional' }) {
  const result = await getPool().query(
    `INSERT INTO email_outbox(dedupe_key,recipient,subject,body_text,html_body,attachments,category)
     VALUES($1,$2,$3,$4,$5,$6::jsonb,$7) ON CONFLICT(dedupe_key) DO NOTHING
     RETURNING id`,
    [dedupeKey, to, subject, text, html, JSON.stringify(attachments), category],
  );
  return { queued: true, duplicate: result.rowCount === 0 };
}

export async function processEmailOutbox({ limit = 10, dedupeKey = null } = {}) {
  const parsedLimit = Math.min(50, Math.max(1, Number(limit) || 10));
  const messages = await inTransaction(async (client) => {
    const selected = await client.query(
      `SELECT id,recipient,subject,body_text,html_body,attachments
       FROM email_outbox
       WHERE sent_at IS NULL AND ($2::text IS NULL OR dedupe_key=$2)
         AND (locked_at IS NULL OR locked_at < now()-interval '5 minutes')
       ORDER BY created_at
       LIMIT $1 FOR UPDATE SKIP LOCKED`,
      [parsedLimit, dedupeKey],
    );
    if (!selected.rowCount) return [];
    await client.query(
      'UPDATE email_outbox SET locked_at=now(),attempts=attempts+1 WHERE id=ANY($1::uuid[])',
      [selected.rows.map((message) => message.id)],
    );
    return selected.rows;
  });

  let sent = 0;
  let failed = 0;
  for (const message of messages) {
    try {
      await sendEmail({
        to: message.recipient,
        subject: message.subject,
        text: message.body_text,
        html: message.html_body,
        attachments: message.attachments || [],
      });
      await getPool().query(
        'UPDATE email_outbox SET sent_at=now(),locked_at=NULL,last_error=NULL WHERE id=$1',
        [message.id],
      );
      sent += 1;
    } catch (error) {
      await getPool().query(
        'UPDATE email_outbox SET locked_at=NULL,last_error=$2 WHERE id=$1',
        [message.id, String(error.message || 'Email delivery failed').slice(0, 500)],
      );
      console.error(`Email delivery pending for outbox message ${message.id}: ${error.code || error.message}`);
      failed += 1;
    }
  }
  return { attempted: messages.length, sent, failed };
}

export async function getEmailOutboxStatus() {
  const result = await getPool().query(`
    SELECT count(*) FILTER (WHERE sent_at IS NULL)::int AS pending,
      count(*) FILTER (WHERE sent_at IS NULL AND last_error IS NOT NULL)::int AS failed_pending,
      count(*) FILTER (WHERE sent_at IS NOT NULL)::int AS sent,
      min(created_at) FILTER (WHERE sent_at IS NULL) AS oldest_pending,
      max(sent_at) AS latest_sent
    FROM email_outbox
  `);
  const failures = await getPool().query(
    `SELECT id,attempts,last_error,created_at
     FROM email_outbox
     WHERE sent_at IS NULL AND last_error IS NOT NULL
     ORDER BY created_at DESC LIMIT 5`,
  );
  const summary = result.rows[0];
  return {
    pending: summary.pending,
    failedPending: summary.failed_pending,
    sent: summary.sent,
    oldestPending: summary.oldest_pending,
    latestSent: summary.latest_sent,
    recentFailures: failures.rows.map((row) => ({
      id: row.id,
      attempts: row.attempts,
      lastError: row.last_error,
      createdAt: row.created_at,
    })),
  };
}
