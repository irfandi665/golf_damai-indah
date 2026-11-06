import { getPool, inTransaction } from './db';
import { assert } from './errors';

export async function getPublicPricing() {
  const [rates, services] = await Promise.all([
    getPool().query(
      `SELECT day_type,tier,to_char(start_time,'HH24:MI') AS start_time,
         to_char(end_time,'HH24:MI') AS end_time,price_per_player_idr,
         to_char(valid_from,'YYYY-MM-DD') AS valid_from,
         CASE WHEN valid_to IS NULL THEN NULL ELSE to_char(valid_to,'YYYY-MM-DD') END AS valid_to
       FROM rate_cards
       WHERE course_id=1 AND current_date >= valid_from
         AND (valid_to IS NULL OR current_date <= valid_to)
       ORDER BY day_type,start_time`,
    ),
    getPool().query(
      `SELECT code,kind,label,unit,unit_price_idr
       FROM service_items WHERE active ORDER BY kind,label`,
    ),
  ]);
  return {
    currency: 'IDR',
    paymentDisclaimer: 'All payments are settled at the club. This website does not process payments.',
    rates: rates.rows.map((rate) => ({
      dayType: rate.day_type,
      tier: rate.tier,
      startTime: rate.start_time,
      endTime: rate.end_time,
      pricePerPlayer: Number(rate.price_per_player_idr),
      validFrom: String(rate.valid_from).slice(0, 10),
      validTo: rate.valid_to ? String(rate.valid_to).slice(0, 10) : null,
    })),
    services: services.rows.map((service) => ({
      code: service.code,
      kind: service.kind,
      label: service.label,
      unit: service.unit,
      price: Number(service.unit_price_idr),
    })),
  };
}

export async function listCourseUpdates() {
  const result = await getPool().query(
    `SELECT id,title,message,severity,starts_at,ends_at
     FROM course_updates
     WHERE active AND approval_status='approved'
       AND starts_at<=now() AND (ends_at IS NULL OR ends_at>now())
     ORDER BY CASE severity WHEN 'closed' THEN 0 WHEN 'caution' THEN 1 ELSE 2 END, starts_at DESC`,
  );
  return result.rows;
}

export async function listAnnouncements() {
  const result = await getPool().query(
    `SELECT id,title,message,href,published_at,expires_at
     FROM announcements
     WHERE active AND published_at<=now() AND (expires_at IS NULL OR expires_at>now())
     ORDER BY published_at DESC LIMIT 20`,
  );
  return result.rows;
}

export async function createPublicInquiry(body) {
  const type = body?.type;
  const name = String(body?.name || '').trim();
  const email = String(body?.email || '').trim().toLowerCase();
  const phone = String(body?.phone || '').trim();
  const subject = String(body?.subject || '').trim();
  const message = String(body?.message || '').trim();
  assert(['event', 'academy', 'contact'].includes(type), 400, 'validation_error', 'Inquiry type is invalid.');
  assert(name.length >= 2 && name.length <= 120, 400, 'validation_error', 'Enter a name between 2 and 120 characters.');
  assert(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254, 400, 'validation_error', 'Enter a valid email address.');
  assert(!phone || /^[+0-9()\s-]{7,24}$/.test(phone), 400, 'validation_error', 'Enter a valid phone number.');
  assert(subject.length >= 2 && subject.length <= 160, 400, 'validation_error', 'Subject must be between 2 and 160 characters.');
  assert(message.length >= 10 && message.length <= 2000, 400, 'validation_error', 'Message must be between 10 and 2000 characters.');

  const result = await getPool().query(
    `INSERT INTO public_inquiries(inquiry_type,name,email,phone,subject,message)
     VALUES($1,$2,$3,$4,$5,$6) RETURNING id,created_at`,
    [type, name, email, phone || null, subject, message],
  );
  return { id: result.rows[0].id, receivedAt: result.rows[0].created_at };
}

export async function listInquiries({ status = 'new', limit = 50 } = {}) {
  assert(['new', 'in_progress', 'resolved', 'all'].includes(status), 400, 'validation_error', 'Inquiry status is invalid.');
  const parsedLimit = Number(limit);
  assert(Number.isInteger(parsedLimit) && parsedLimit >= 1 && parsedLimit <= 100, 400, 'validation_error', 'Limit must be from 1 to 100.');
  const result = await getPool().query(
    `SELECT id,inquiry_type,name,email,phone,subject,message,status,created_at
     FROM public_inquiries
     WHERE $1='all' OR status=$1
     ORDER BY created_at ASC LIMIT $2`,
    [status, parsedLimit],
  );
  return result.rows;
}

export async function updateInquiryStatus({ adminId, inquiryId, status }) {
  assert(['new', 'in_progress', 'resolved'].includes(status), 400, 'validation_error', 'Inquiry status is invalid.');
  return inTransaction(async (client) => {
    const result = await client.query(
      `UPDATE public_inquiries SET status=$2,updated_at=now()
       WHERE id=$1 RETURNING id,status`,
      [inquiryId, status],
    );
    assert(result.rowCount, 404, 'not_found', 'Inquiry was not found.');
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
       VALUES($1,'inquiry.status','public_inquiry',$2,$3)`,
      [adminId, inquiryId, result.rows[0]],
    );
    return result.rows[0];
  });
}

export async function createCourseUpdate({ adminId, body }) {
  const title = String(body?.title || '').trim();
  const message = String(body?.message || '').trim();
  const severity = body?.severity;
  assert(title.length >= 2 && title.length <= 120, 400, 'validation_error', 'Title must be between 2 and 120 characters.');
  assert(message.length >= 2 && message.length <= 1000, 400, 'validation_error', 'Message must be between 2 and 1000 characters.');
  assert(['info', 'caution', 'closed'].includes(severity), 400, 'validation_error', 'Severity is invalid.');
  const endsAt = body.endsAt || null;
  assert(!endsAt || (Number.isFinite(Date.parse(endsAt)) && Date.parse(endsAt) > Date.now()), 400, 'validation_error', 'End time must be in the future.');
  const result = await getPool().query(
    `INSERT INTO course_updates(title,message,severity,ends_at,created_by,approval_status,approved_by,approved_at)
     VALUES($1,$2,$3,$4,$5,'approved',$5,now())
     RETURNING id,title,message,severity,starts_at,ends_at,approval_status`,
    [title, message, severity, endsAt, adminId],
  );
  await getPool().query(
    `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
     VALUES($1,'course_update.publish','course_update',$2,$3)`,
    [adminId, result.rows[0].id, result.rows[0]],
  );
  return result.rows[0];
}

export async function submitCourseUpdateProposal({ staffId, body }) {
  const title = String(body?.title || '').trim();
  const message = String(body?.message || '').trim();
  const severity = body?.severity;
  assert(title.length >= 2 && title.length <= 120, 400, 'validation_error', 'Title must be between 2 and 120 characters.');
  assert(message.length >= 2 && message.length <= 1000, 400, 'validation_error', 'Message must be between 2 and 1000 characters.');
  assert(['info', 'caution', 'closed'].includes(severity), 400, 'validation_error', 'Severity is invalid.');
  const endsAt = body.endsAt || null;
  assert(!endsAt || (Number.isFinite(Date.parse(endsAt)) && Date.parse(endsAt) > Date.now()), 400, 'validation_error', 'End time must be in the future.');
  return inTransaction(async (client) => {
    const result = await client.query(
      `INSERT INTO course_updates(title,message,severity,ends_at,created_by,active,approval_status)
       VALUES($1,$2,$3,$4,$5,false,'pending')
       RETURNING id,title,message,severity,starts_at,ends_at,approval_status`,
      [title, message, severity, endsAt, staffId],
    );
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
       VALUES($1,'course_update.propose','course_update',$2,$3)`,
      [staffId, result.rows[0].id, result.rows[0]],
    );
    return result.rows[0];
  });
}

export async function listPendingCourseUpdates() {
  const result = await getPool().query(
    `SELECT cu.id,cu.title,cu.message,cu.severity,cu.starts_at,cu.ends_at,cu.created_at,u.full_name AS submitted_by
     FROM course_updates cu JOIN users u ON u.id=cu.created_by
     WHERE cu.approval_status='pending'
     ORDER BY cu.created_at ASC LIMIT 100`,
  );
  return { proposals: result.rows };
}

export async function approveCourseUpdate({ adminId, updateId }) {
  assert(/^[0-9a-f-]{36}$/i.test(updateId || ''), 400, 'validation_error', 'A valid course update ID is required.');
  return inTransaction(async (client) => {
    const before = await client.query(
      `SELECT id,title,message,severity,active,approval_status
       FROM course_updates WHERE id=$1 FOR UPDATE`,
      [updateId],
    );
    assert(before.rowCount, 404, 'not_found', 'Course update proposal was not found.');
    assert(before.rows[0].approval_status === 'pending', 409, 'proposal_already_reviewed', 'This proposal has already been reviewed.');
    const result = await client.query(
      `UPDATE course_updates SET active=true,approval_status='approved',approved_by=$2,approved_at=now(),starts_at=now()
       WHERE id=$1
       RETURNING id,title,message,severity,starts_at,ends_at,approval_status`,
      [updateId, adminId],
    );
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,before_state,after_state)
       VALUES($1,'course_update.approve','course_update',$2,$3,$4)`,
      [adminId, updateId, before.rows[0], result.rows[0]],
    );
    return result.rows[0];
  });
}

export async function deactivateCourseUpdate({ adminId, updateId }) {
  return inTransaction(async (client) => {
    const result = await client.query(
      'UPDATE course_updates SET active=false WHERE id=$1 RETURNING id',
      [updateId],
    );
    assert(result.rowCount, 404, 'not_found', 'Course update was not found.');
    await client.query(
      `INSERT INTO audit_log(actor_user_id,action,entity_type,entity_id,after_state)
       VALUES($1,'course_update.deactivate','course_update',$2,'{"active":false}'::jsonb)`,
      [adminId, updateId],
    );
    return { id: updateId, active: false };
  });
}

export async function createAnnouncement({ adminId, body }) {
  const title = String(body?.title || '').trim();
  const message = String(body?.message || '').trim();
  const href = body?.href ? String(body.href).trim() : null;
  assert(title.length >= 2 && title.length <= 120, 400, 'validation_error', 'Title must be between 2 and 120 characters.');
  assert(message.length >= 2 && message.length <= 1000, 400, 'validation_error', 'Message must be between 2 and 1000 characters.');
  assert(!href || (href.startsWith('/') && !href.startsWith('//')), 400, 'validation_error', 'Announcement link must be a local path.');
  const result = await getPool().query(
    `INSERT INTO announcements(title,message,href,created_by)
     VALUES($1,$2,$3,$4) RETURNING id,title,message,href,published_at`,
    [title, message, href, adminId],
  );
  return result.rows[0];
}

export async function createEventInterestEmail({ inquiryId }) {
  const result = await getPool().query(
    'SELECT name,email,subject,message FROM public_inquiries WHERE id=$1',
    [inquiryId],
  );
  assert(result.rowCount, 404, 'not_found', 'Inquiry was not found.');
  return result.rows[0];
}
