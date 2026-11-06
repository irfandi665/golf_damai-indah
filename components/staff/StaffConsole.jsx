'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
import BookingOperationsPanel from './BookingOperationsPanel';
import QrCheckInScanner from './QrCheckInScanner';

const fieldClass = 'mt-2 w-full rounded-xl border border-[#C9A96E]/25 bg-[#0F2A20] px-3 py-2.5 text-sm text-[#F6F2EA] focus:border-[#C9A96E] focus:outline-none';
const buttonClass = 'rounded-full border border-[#C9A96E]/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#C9A96E] hover:bg-[#C9A96E] hover:text-[#0F2A20] disabled:opacity-50';

function FormField({ label, children }) {
  return <label className="block text-xs text-[#F6F2EA]/60">{label}{children}</label>;
}

export default function StaffConsole() {
  const [role, setRole] = useState(null);
  const [date, setDate] = useState(() => {
    const now = new Date();
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  });
  const [search, setSearch] = useState('');
  const [searchText, setSearchText] = useState('');
  const [sheet, setSheet] = useState(null);
  const [serviceItems, setServiceItems] = useState([]);
  const [selected, setSelected] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [adminReport, setAdminReport] = useState(null);
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [courseUpdates, setCourseUpdates] = useState([]);
  const [pendingCourseUpdates, setPendingCourseUpdates] = useState([]);
  const [auditEntries, setAuditEntries] = useState([]);
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [blockReason, setBlockReason] = useState('');
  const [staffEmailSearch, setStaffEmailSearch] = useState('');
  const [emailOutbox, setEmailOutbox] = useState(null);
  const [attendanceFilter, setAttendanceFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [auditAction, setAuditAction] = useState('');
  const [auditEntity, setAuditEntity] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    apiRequest('/api/v1/staff/session').then((result) => setRole(result.role)).catch((reason) => setError(reason.message));
  }, []);

  useEffect(() => {
    if (!role) return;
    const query = new URLSearchParams({ date, q: search });
    apiRequest(`/api/v1/staff/tee-sheet?${query}`)
      .then(setSheet)
      .catch((reason) => setError(reason.message));
    apiRequest('/api/v1/course-updates')
      .then(setCourseUpdates)
      .catch((reason) => setError(reason.message));
    if (role === 'admin' || role === 'front_desk') {
      const waitlistQuery = new URLSearchParams({ date });
      apiRequest(`/api/v1/staff/waitlist?${waitlistQuery}`)
        .then((result) => setWaitlistEntries(result.entries))
        .catch((reason) => setError(reason.message));
    }
    if (role === 'admin') apiRequest('/api/v1/admin/inquiries?status=new')
      .then(setInquiries)
      .catch((reason) => setError(reason.message));
    if (role === 'admin') apiRequest('/api/v1/admin/email-outbox')
      .then(setEmailOutbox)
      .catch((reason) => setError(reason.message));
    if (role === 'admin' || role === 'front_desk') {
      const reportQuery = new URLSearchParams({ date, attendance: attendanceFilter, payment: paymentFilter, q: search });
      apiRequest(`/api/v1/admin/bookings?${reportQuery}`)
        .then(setAdminReport)
        .catch((reason) => setError(reason.message));
    }
    if (role === 'admin') {
      apiRequest('/api/v1/admin/course-updates/pending')
        .then((result) => setPendingCourseUpdates(result.proposals))
        .catch((reason) => setError(reason.message));
      const auditQuery = new URLSearchParams({ date, action: auditAction, entityType: auditEntity });
      apiRequest(`/api/v1/admin/audit?${auditQuery}`)
        .then((result) => setAuditEntries(result.entries))
        .catch((reason) => setError(reason.message));
    }
    if (role === 'admin') fetch('/api/v1/pricing')
      .then((response) => response.json())
      .then((pricing) => setServiceItems(pricing.services || []))
      .catch((reason) => setError(reason.message));
  }, [role, date, search, reload, attendanceFilter, paymentFilter, auditAction, auditEntity]);

  const selectedSlots = useMemo(() => new Set(selected), [selected]);
  const todayJakarta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  async function run(action, successMessage) {
    setError('');
    setNotice('');
    try {
      const result = await action();
      if (successMessage) setNotice(typeof successMessage === 'function' ? successMessage(result) : successMessage);
      setReload((value) => value + 1);
    } catch (reason) { setError(reason.message); }
  }

  async function toggleBlocks(blocked) {
    await run(() => apiRequest('/api/v1/admin/tee-sheet/blocks', {
      method: 'PUT',
      body: { courseId: 1, date, slotIds: selected, blocked, reason: blockReason },
    }), blocked
      ? 'Selected slots blocked.'
      : (result) => `Selected slots reopened. Waitlist offer processing ran for ${result.waitlistOffers.length} eligible slot(s).`);
    setSelected([]);
  }

  async function submitComplete(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const bookingId = new FormData(form).get('bookingId');
    await run(() => apiRequest(`/api/v1/staff/bookings/${encodeURIComponent(bookingId)}/complete`, { method: 'POST', body: {} }), 'Round marked complete; member loyalty was updated.');
    form.reset();
  }

  async function submitRate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const item = {
      courseId: 1,
      dayType: data.dayType,
      tier: data.tier,
      startTime: data.startTime,
      endTime: data.endTime,
      pricePerPlayer: Number(data.pricePerPlayer),
      validFrom: data.validFrom,
      validTo: data.validTo || null,
    };
    await run(() => apiRequest('/api/v1/admin/rate-cards', { method: 'PUT', body: item }), 'Rate card saved.');
    form.reset();
  }

  async function submitService(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    const current = serviceItems.find((item) => item.code === data.code);
    if (!current) {
      setError('Choose an active service item.');
      return;
    }
    const item = {
      code: current.code,
      kind: current.kind,
      unit: current.unit,
      label: current.label,
      unitPrice: Number(data.unitPrice),
      active: true,
    };
    await run(() => apiRequest('/api/v1/admin/service-items', { method: 'PUT', body: item }), 'Service price updated.');
    setReload((value) => value + 1);
  }

  async function submitCourseUpdate(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    await run(() => apiRequest('/api/v1/admin/course-updates', {
      method: 'POST',
      body: { ...data, endsAt: data.endsAt || null },
    }), 'Operational notice published.');
    form.reset();
  }

  async function submitCourseUpdateProposal(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    await run(() => apiRequest('/api/v1/staff/course-updates', {
      method: 'POST',
      body: { ...data, endsAt: data.endsAt || null },
    }), 'Operational notice submitted for admin approval.');
    form.reset();
  }

  async function searchStaff(event) {
    event.preventDefault();
    await run(async () => {
      const query = new URLSearchParams({ email: staffEmailSearch.trim() });
      const result = await apiRequest(`/api/v1/admin/staff?${query}`);
      setStaffAccounts(result.users);
    });
  }

  async function changeStaffRole(userId, roleValue) {
    await run(() => apiRequest(`/api/v1/admin/staff/${encodeURIComponent(userId)}`, {
      method: 'PATCH',
      body: { role: roleValue },
    }), 'Staff role updated and recorded in the audit log.');
    setStaffAccounts((current) => current.map((account) => account.id === userId ? { ...account, role: roleValue } : account));
  }

  async function exportDailyReport() {
    const query = new URLSearchParams({
      date,
      attendance: attendanceFilter,
      payment: paymentFilter,
      q: search,
      format: 'csv',
    });
    const response = await fetch(`/api/v1/admin/bookings?${query}`, { credentials: 'same-origin' });
    if (!response.ok) {
      const problem = await response.json().catch(() => null);
      setError(problem?.detail || 'Could not export the daily report.');
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `tee-sheet-${date}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function submitAnnouncement(event) {
    event.preventDefault();
    const form = event.currentTarget;
    await run(() => apiRequest('/api/v1/admin/announcements', {
      method: 'POST',
      body: Object.fromEntries(new FormData(form)),
    }), 'Member announcement published.');
    form.reset();
  }

  if (!role) {
    return (
      <section className="mx-auto max-w-xl px-6 pb-24 pt-40 text-center">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl">Staff & club operations</h1>
        <p role={error ? 'alert' : 'status'} className="mt-4 text-sm text-[#F6F2EA]/65">{error || 'Checking staff access…'}</p>
        {error && <Link href="/member/login" className="mt-6 inline-block rounded-full bg-[#C9A96E] px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#0F2A20]">Staff sign in</Link>}
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pb-24 pt-32 lg:px-10 lg:pt-40">
      <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]">{role} workspace</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
        <div><h1 className="font-[family-name:var(--font-heading)] text-4xl sm:text-5xl">Tee sheet & operations</h1><p className="mt-2 text-sm text-[#F6F2EA]/55">Use staff accounts only. Member transactions are settled at the club.</p></div>
        <FormField label="Tee sheet date"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} /></FormField>
      </div>
      {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-950/20 p-4 text-sm text-emerald-100">{notice}</p>}
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-300/30 bg-red-950/20 p-4 text-sm text-red-100">{error}</p>}

      <section aria-label="Daily operations dashboard" className="mt-8 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-[family-name:var(--font-heading)] text-3xl">Operations dashboard</h2>
            <p className="mt-1 text-xs text-[#F6F2EA]/50">Daily booking and capacity snapshot for {date}. No-show penalties are not enabled.</p>
          </div>
          <span className="text-xs text-[#F6F2EA]/45">Role: {role === 'front_desk' ? 'Front desk' : role === 'starter' ? 'Starter' : 'Admin'}</span>
        </div>
        {sheet?.summary && (
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Bookings not arrived', sheet.summary.confirmed],
              ['Checked in', sheet.summary.checkedIn],
              ['Slots open', sheet.summary.available],
              ['Slots on hold', sheet.summary.held],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-[#C9A96E]/15 bg-[#0F2A20]/40 p-4">
                <dt className="text-[0.6rem] uppercase tracking-[0.12em] text-[#F6F2EA]/45">{label}</dt>
                <dd className="mt-1 text-2xl tabular-nums text-[#C9A96E]">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="mt-5 border-t border-[#C9A96E]/10 pt-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C9A96E]">Course operations status</h3>
          {courseUpdates.length === 0 ? <p className="mt-2 text-sm text-[#F6F2EA]/45">No active course notices.</p> : (
            <ul className="mt-2 space-y-2">
              {courseUpdates.map((item) => <li key={item.id} className="rounded-lg border border-[#C9A96E]/10 p-3 text-sm">
                <strong>{item.title}</strong><span className="ml-2 text-xs uppercase text-[#C9A96E]">{item.severity}</span>
                <p className="mt-1 text-xs text-[#F6F2EA]/60">{item.message}</p>
              </li>)}
            </ul>
          )}
        </div>
        {['front_desk', 'admin'].includes(role) && (
          <div className="mt-5 border-t border-[#C9A96E]/10 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-[#C9A96E]">Exact-slot waitlist · {date}</h3>
            <p className="mt-1 text-[0.65rem] text-[#F6F2EA]/45">Offers create a 10-minute hold. The player must claim the emailed link and complete booking; staff do not confirm it on their behalf.</p>
            {waitlistEntries.length === 0 ? <p className="mt-2 text-sm text-[#F6F2EA]/45">No active waitlist entries for this date.</p> : (
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {waitlistEntries.map((entry) => (
                  <li key={entry.id} className="rounded-lg border border-[#C9A96E]/10 p-3 text-xs">
                    <div className="flex items-center justify-between gap-2"><strong>{entry.time} · {entry.name}</strong><span className="uppercase text-[#C9A96E]">{entry.status}</span></div>
                    <p className="mt-1 text-[#F6F2EA]/60">{entry.players} player(s) · {entry.phone} · {entry.email}</p>
                    {entry.claimExpiresAt && <p className="mt-1 text-[#F6F2EA]/45">Claim hold expires {new Date(entry.claimExpiresAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}.</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="font-[family-name:var(--font-heading)] text-3xl">Daily tee sheet</h2><p className="mt-1 text-xs text-[#F6F2EA]/50">Capacity, booking lookup and manual check-in by reference, guest name or phone.</p></div>
          {role === 'admin' && <div className="flex flex-wrap items-end gap-2"><FormField label="Reason for slot block"><input value={blockReason} onChange={(event) => setBlockReason(event.target.value)} maxLength={250} placeholder="Course maintenance, event…" className={`${fieldClass} min-w-48`} /></FormField><button type="button" disabled={!selected.length} onClick={() => toggleBlocks(true)} className={buttonClass}>Block selected</button><button type="button" disabled={!selected.length} onClick={() => toggleBlocks(false)} className={buttonClass}>Reopen</button></div>}
        </div>
        {date !== todayJakarta && <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-950/20 p-3 text-xs text-amber-100">Manual check-in is only available for today’s tee time ({todayJakarta}). You are viewing {date}.</p>}
        <form onSubmit={(event) => { event.preventDefault(); setSearch(searchText.trim()); }} className="mt-5 flex flex-wrap gap-3">
          <input value={searchText} onChange={(event) => setSearchText(event.target.value)} maxLength={120} placeholder="Reference, guest name or phone" aria-label="Search tee sheet bookings" className={`${fieldClass} mt-0 min-w-64 flex-1`} />
          <button type="submit" className={buttonClass}>Search</button>
          {search && <button type="button" onClick={() => { setSearch(''); setSearchText(''); }} className={buttonClass}>Clear search</button>}
        </form>
        {sheet?.summary && (
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
            {[
              ['Confirmed', sheet.summary.confirmed],
              ['Checked in', sheet.summary.checkedIn],
              ['Completed', sheet.summary.completed],
              ['Cancelled', sheet.summary.cancelled],
              ['Capacity', sheet.summary.capacity],
              ['Booked', sheet.summary.booked],
              ['Open / held', `${sheet.summary.available} / ${sheet.summary.held}`],
            ].map(([label, value]) => <div key={label} className="rounded-xl border border-[#C9A96E]/15 bg-[#0F2A20]/40 p-3"><dt className="text-[0.6rem] uppercase tracking-[0.12em] text-[#F6F2EA]/45">{label}</dt><dd className="mt-1 text-lg tabular-nums text-[#C9A96E]">{value}</dd></div>)}
          </dl>
        )}
        {!sheet ? <p role="status" className="mt-6 text-sm text-[#F6F2EA]/50">Loading tee sheet…</p> : (
          <ul className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sheet.slots.map((slot) => (
              <li key={slot.id} className={`rounded-xl border p-4 ${slot.status === 'blocked' ? 'border-red-300/30 bg-red-950/20' : 'border-[#C9A96E]/15 bg-[#0F2A20]/40'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div><p className="font-[family-name:var(--font-heading)] text-2xl">{slot.time}</p><p className="mt-1 text-xs text-[#F6F2EA]/55">{slot.booked} booked · {slot.held} held · {slot.available} open</p>{slot.waitlistCount > 0 && <p className="mt-1 text-xs text-[#C9A96E]">{slot.waitlistCount} active waitlist entr{slot.waitlistCount === 1 ? 'y' : 'ies'}</p>}</div>
                  {role === 'admin' && slot.booked === 0 && slot.held === 0 && <input type="checkbox" aria-label={`Select ${slot.time}`} checked={selectedSlots.has(slot.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, slot.id] : current.filter((id) => id !== slot.id))} />}
                  <span className="text-[0.6rem] uppercase tracking-[0.15em] text-[#C9A96E]">{slot.status}</span>
                </div>
                {slot.reason && <p className="mt-2 text-xs text-red-100">{slot.reason}</p>}
                {slot.bookings.length > 0 && <ul className="mt-4 space-y-3 border-t border-[#C9A96E]/10 pt-3">{slot.bookings.map((booking) => (
                  <li key={booking.id} className="text-xs text-[#F6F2EA]/75">
                    <span className="font-medium">{booking.reference}</span> · {booking.guestName} · {booking.players} player(s) · {booking.status}
                    <span className="block text-[#F6F2EA]/45">{booking.guestPhone}</span>
                    {booking.status === 'checked_in' && <span className="mt-1 block text-emerald-200">Already checked in{booking.checkedInAt ? ` · ${new Date(booking.checkedInAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}` : ''}.</span>}
                    {booking.status === 'completed' && <span className="mt-1 block text-emerald-200">Round completed.</span>}
                    {booking.status === 'confirmed' && date === todayJakarta && <button type="button" onClick={() => run(() => apiRequest(`/api/v1/staff/bookings/${encodeURIComponent(booking.id)}/check-in`, { method: 'POST', body: {} }), `${booking.reference} checked in.`)} className="mt-2 mr-3 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#C9A96E] underline underline-offset-4">Manual check-in</button>}
                    {booking.status === 'checked_in' && <button type="button" onClick={() => run(() => apiRequest(`/api/v1/staff/bookings/${encodeURIComponent(booking.id)}/complete`, { method: 'POST', body: {} }), `${booking.reference} round completed.`)} className="mt-2 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#C9A96E] underline underline-offset-4">Mark round complete</button>}
                    {['front_desk', 'admin'].includes(role) && ['confirmed', 'checked_in'].includes(booking.status) && <label className="mt-2 block text-[0.65rem] text-[#F6F2EA]/55">Payment status at club
                      <select value={booking.paymentStatus || 'unpaid'} onChange={(event) => run(() => apiRequest(`/api/v1/staff/bookings/${encodeURIComponent(booking.id)}/payment`, { method: 'PATCH', body: { paymentStatus: event.target.value } }), 'Manual payment status recorded.')} className={fieldClass}>
                        <option value="unpaid">Unpaid</option><option value="down_payment">Down payment</option><option value="paid">Paid at club</option>
                      </select>
                    </label>}
                    <BookingOperationsPanel booking={booking} onUpdate={() => setReload((value) => value + 1)} />
                  </li>
                ))}</ul>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <QrCheckInScanner onCheckedIn={() => setReload((value) => value + 1)} />
        <form onSubmit={submitComplete} className="space-y-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl">Complete a round</h2>
          <FormField label="Booking ID"><input name="bookingId" required className={fieldClass} /></FormField>
          <p className="text-xs leading-relaxed text-[#F6F2EA]/45">Completion applies configured member points and cashback. Do not mark complete until the club's onsite cashier workflow is finished.</p>
          <button className={buttonClass}>Complete round</button>
        </form>
      </div>

      {['admin', 'front_desk'].includes(role) && (
        <>
          <section className="mt-8 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-5 sm:p-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><h2 className="font-[family-name:var(--font-heading)] text-3xl">Daily reservation report</h2><p className="mt-1 text-xs text-[#F6F2EA]/55">Payment status is a manual operational record, not proof of payment. All payments are handled at the club.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField label="Attendance">
                  <select value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value)} className={fieldClass}>
                    <option value="all">All attendance</option><option value="not_arrived">Belum datang</option><option value="arrived">Sudah datang</option>
                  </select>
                </FormField>
                <FormField label="Payment status">
                  <select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)} className={fieldClass}>
                    <option value="all">All payments</option><option value="unpaid">Belum dibayar</option><option value="down_payment">Down payment</option><option value="paid">Lunas</option>
                  </select>
                </FormField>
                <button type="button" onClick={exportDailyReport} className={`${buttonClass} self-end`}>Export CSV</button>
              </div>
            </div>
            {!adminReport ? <p role="status" className="mt-5 text-sm text-[#F6F2EA]/50">Loading admin report…</p> : adminReport.bookings.length === 0 ? <p className="mt-5 text-sm text-[#F6F2EA]/50">No reservations match these filters.</p> : (
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                  <thead><tr className="border-b border-[#C9A96E]/20 text-[0.6rem] uppercase tracking-[0.12em] text-[#F6F2EA]/45">
                    <th className="p-3">Tee time / Booking</th><th className="p-3">Player</th><th className="p-3">Tee box / package</th><th className="p-3">Attendance</th><th className="p-3">Payment at club</th><th className="p-3">Check-in time</th>
                  </tr></thead>
                  <tbody>{adminReport.bookings.map((booking) => (
                    <tr key={booking.id} className="border-b border-[#C9A96E]/10 align-top">
                      <td className="p-3"><strong>{booking.teeTime}</strong><span className="mt-1 block text-[#F6F2EA]/50">{booking.reference} · {booking.players} player(s)</span></td>
                      <td className="p-3">{booking.guestName}<span className="mt-1 block text-[#F6F2EA]/50">{booking.guestPhone}</span></td>
                      <td className="p-3">{booking.teeBox}<span className="mt-1 block text-[#F6F2EA]/50">{booking.packageType}</span></td>
                      <td className="p-3">
                        {role === 'admin' ? <select aria-label={`Attendance status for ${booking.reference}`} value={booking.attendanceStatus === 'confirmed' ? 'confirmed' : 'checked_in'} disabled={!['confirmed', 'checked_in'].includes(booking.attendanceStatus)} onChange={(event) => run(() => apiRequest(`/api/v1/admin/bookings/${encodeURIComponent(booking.id)}`, { method: 'PATCH', body: { attendanceStatus: event.target.value } }), 'Attendance status updated.')} className="rounded-lg border border-[#C9A96E]/25 bg-[#0F2A20] px-2 py-2">
                          <option value="confirmed">Belum datang</option><option value="checked_in">Sudah datang</option>
                        </select> : booking.attendanceStatus}
                      </td>
                      <td className="p-3">
                        <select aria-label={`Payment status for ${booking.reference}`} value={booking.paymentStatus} disabled={!['confirmed', 'checked_in'].includes(booking.attendanceStatus)} onChange={(event) => run(() => apiRequest(`/api/v1/staff/bookings/${encodeURIComponent(booking.id)}/payment`, { method: 'PATCH', body: { paymentStatus: event.target.value } }), 'Manual onsite payment status recorded.')} className="rounded-lg border border-[#C9A96E]/25 bg-[#0F2A20] px-2 py-2">
                          <option value="unpaid">Belum dibayar</option><option value="down_payment">Down payment</option><option value="paid">Lunas</option>
                        </select>
                      </td>
                      <td className="p-3 text-[#F6F2EA]/65">{booking.checkedInAt ? new Date(booking.checkedInAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {role !== 'admin' && (
        <form onSubmit={submitCourseUpdateProposal} className="mt-8 space-y-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl">Submit course operations update</h2>
          <p className="text-xs text-[#F6F2EA]/50">Your update is not public until an admin reviews and approves it.</p>
          <FormField label="Title"><input name="title" required maxLength={120} className={fieldClass} /></FormField>
          <FormField label="Details"><textarea name="message" required maxLength={1000} rows={3} className={fieldClass} /></FormField>
          <FormField label="Severity"><select name="severity" className={fieldClass}><option value="info">Information</option><option value="caution">Caution</option><option value="closed">Course closed</option></select></FormField>
          <FormField label="End time (optional)"><input name="endsAt" type="datetime-local" className={fieldClass} /></FormField>
          <button className={buttonClass}>Submit for approval</button>
        </form>
      )}

      {role === 'admin' && (
        <>
          <section className="mt-8 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
            <div className="flex items-center justify-between gap-4"><h2 className="font-[family-name:var(--font-heading)] text-2xl">Course updates awaiting approval</h2><button type="button" onClick={() => setReload((value) => value + 1)} className={buttonClass}>Refresh</button></div>
            {pendingCourseUpdates.length === 0 ? <p className="mt-4 text-sm text-[#F6F2EA]/50">No pending course updates.</p> : (
              <ul className="mt-4 space-y-3">{pendingCourseUpdates.map((item) => <li key={item.id} className="rounded-xl border border-[#C9A96E]/10 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3"><div><strong>{item.title}</strong><span className="ml-2 text-xs uppercase text-[#C9A96E]">{item.severity}</span><p className="mt-2 text-sm text-[#F6F2EA]/65">{item.message}</p><p className="mt-2 text-xs text-[#F6F2EA]/40">Submitted by {item.submitted_by}</p></div>
                  <button type="button" onClick={() => run(() => apiRequest(`/api/v1/admin/course-updates/${encodeURIComponent(item.id)}/approve`, { method: 'POST', body: {} }), 'Course update approved and published.')} className={buttonClass}>Approve & publish</button>
                </div>
              </li>)}</ul>
            )}
          </section>

          <section className="mt-8 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl">Staff role management</h2>
            <p className="mt-1 text-xs text-[#F6F2EA]/50">Assign least-privilege roles. Every change is audited; you cannot change your own role here.</p>
            <form onSubmit={searchStaff} className="mt-4 flex flex-wrap gap-3">
              <input aria-label="Search staff email" type="search" value={staffEmailSearch} onChange={(event) => setStaffEmailSearch(event.target.value)} minLength={2} placeholder="Search staff email" className={`${fieldClass} mt-0 min-w-64 flex-1`} />
              <button className={buttonClass}>Search staff</button>
            </form>
            {staffAccounts.length > 0 && <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[560px] text-left text-xs">
              <thead><tr className="border-b border-[#C9A96E]/20 text-[#F6F2EA]/50"><th className="p-3">Staff member</th><th className="p-3">Email</th><th className="p-3">Role</th></tr></thead>
              <tbody>{staffAccounts.map((account) => <tr key={account.id} className="border-b border-[#C9A96E]/10">
                <td className="p-3">{account.full_name}</td><td className="p-3">{account.email}</td>
                <td className="p-3"><select aria-label={`Role for ${account.email}`} value={account.role} disabled={account.id === undefined} onChange={(event) => changeStaffRole(account.id, event.target.value)} className="rounded-lg border border-[#C9A96E]/25 bg-[#0F2A20] px-2 py-2">
                  <option value="starter">Starter</option><option value="front_desk">Front desk</option><option value="admin">Admin</option>
                </select></td>
              </tr>)}</tbody>
            </table></div>}
          </section>

          <section className="mt-8 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-end justify-between gap-4"><div><h2 className="font-[family-name:var(--font-heading)] text-2xl">Activity audit</h2><p className="mt-1 text-xs text-[#F6F2EA]/50">Latest staff/admin changes for the selected date.</p></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <FormField label="Audit date"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} /></FormField>
                <FormField label="Action filter"><input value={auditAction} onChange={(event) => setAuditAction(event.target.value)} maxLength={100} placeholder="e.g. booking.check_in" className={fieldClass} /></FormField>
                <FormField label="Entity type"><select value={auditEntity} onChange={(event) => setAuditEntity(event.target.value)} className={fieldClass}><option value="">All entities</option><option value="booking">Booking</option><option value="tee_slot">Tee slot</option><option value="course_update">Course update</option><option value="user">User / role</option><option value="round">Round</option></select></FormField>
              </div>
            </div>
            {auditEntries.length === 0 ? <p className="mt-4 text-sm text-[#F6F2EA]/50">No audit entries for this date.</p> : <ul className="mt-4 max-h-[28rem] space-y-2 overflow-auto">
              {auditEntries.map((entry) => <li key={entry.id} className="rounded-lg border border-[#C9A96E]/10 p-3 text-xs">
                <div className="flex flex-wrap justify-between gap-2"><strong>{entry.action}</strong><time className="text-[#F6F2EA]/45">{new Date(entry.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</time></div>
                <p className="mt-1 text-[#F6F2EA]/65">{entry.actorName || entry.actorEmail || 'System'} · {entry.entityType} {entry.entityId}</p>
                <details className="mt-2"><summary className="cursor-pointer text-[#C9A96E]">Before / after</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap text-[0.65rem] text-[#F6F2EA]/55">{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre></details>
              </li>)}
            </ul>}
          </section>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <form onSubmit={submitCourseUpdate} className="space-y-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl">Course operations notice</h2>
              <FormField label="Title"><input name="title" required maxLength={120} className={fieldClass} /></FormField>
              <FormField label="Details"><textarea name="message" required maxLength={1000} rows={3} className={fieldClass} /></FormField>
              <FormField label="Severity"><select name="severity" className={fieldClass}><option value="info">Information</option><option value="caution">Caution</option><option value="closed">Course closed</option></select></FormField>
              <FormField label="End time (optional)"><input name="endsAt" type="datetime-local" className={fieldClass} /></FormField>
              <button className={buttonClass}>Publish status</button>
            </form>

            <form onSubmit={submitAnnouncement} className="space-y-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl">Member announcement</h2>
              <FormField label="Title"><input name="title" required maxLength={120} className={fieldClass} /></FormField>
              <FormField label="Message"><textarea name="message" required maxLength={1000} rows={3} className={fieldClass} /></FormField>
              <FormField label="Local link (optional)"><input name="href" placeholder="/booking" className={fieldClass} /></FormField>
              <button className={buttonClass}>Publish announcement</button>
            </form>
          </div>

          <form onSubmit={submitRate} className="mt-8 grid gap-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6 sm:grid-cols-2 lg:grid-cols-4">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl sm:col-span-2 lg:col-span-4">Add a rate card</h2>
            <FormField label="Day type"><select name="dayType" className={fieldClass}><option value="weekday">Weekday</option><option value="premium">Premium</option></select></FormField>
            <FormField label="Rate band"><select name="tier" className={fieldClass}><option value="standard">Standard</option><option value="peak">Peak</option><option value="twilight">Twilight</option></select></FormField>
            <FormField label="Start time"><input name="startTime" type="time" required className={fieldClass} /></FormField>
            <FormField label="End time"><input name="endTime" type="time" required className={fieldClass} /></FormField>
            <FormField label="Price per player (IDR)"><input name="pricePerPlayer" type="number" min="0" step="1" required className={fieldClass} /></FormField>
            <FormField label="Valid from"><input name="validFrom" type="date" required className={fieldClass} /></FormField>
            <FormField label="Valid until (optional)"><input name="validTo" type="date" className={fieldClass} /></FormField>
            <button className={`${buttonClass} self-end`}>Save rate card</button>
          </form>

          <form onSubmit={submitService} className="mt-6 grid gap-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6 sm:grid-cols-3">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl sm:col-span-3">Update caddy or service price</h2>
            <FormField label="Service"><select name="code" required className={fieldClass}>{serviceItems.map((item) => <option key={item.code} value={item.code}>{item.label} · {item.unit}</option>)}</select></FormField>
            <FormField label="New price (IDR)"><input name="unitPrice" type="number" min="0" step="1" required className={fieldClass} /></FormField>
            <button className={`${buttonClass} self-end`}>Update service</button>
          </form>

          <section className="mt-8 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4"><h2 className="font-[family-name:var(--font-heading)] text-2xl">New inquiries ({inquiries.length})</h2><button type="button" onClick={() => setReload((value) => value + 1)} className={buttonClass}>Refresh</button></div>
            {inquiries.length === 0 ? <p className="mt-4 text-sm text-[#F6F2EA]/50">No new inquiries.</p> : (
              <ul className="mt-5 space-y-3">{inquiries.map((item) => <li key={item.id} className="rounded-xl border border-[#C9A96E]/10 p-4"><div className="flex flex-wrap justify-between gap-3"><p className="font-medium">{item.subject} <span className="text-xs uppercase text-[#C9A96E]">· {item.inquiry_type}</span></p><button type="button" onClick={() => run(() => apiRequest(`/api/v1/admin/inquiries/${item.id}`, { method: 'PATCH', body: { status: 'in_progress' } }), 'Inquiry moved to in progress.')} className={buttonClass}>Mark in progress</button></div><p className="mt-1 text-xs text-[#F6F2EA]/55">{item.name} · <a className="text-[#C9A96E] underline" href={`mailto:${item.email}`}>{item.email}</a>{item.phone ? ` · ${item.phone}` : ''}</p><p className="mt-3 whitespace-pre-wrap text-sm text-[#F6F2EA]/70">{item.message}</p></li>)}</ul>
            )}
          </section>

          <section className="mt-8 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div><h2 className="font-[family-name:var(--font-heading)] text-2xl">Email delivery monitor</h2><p className="mt-1 text-xs text-[#F6F2EA]/50">“Sent” means accepted by the provider; confirm final delivery in the Resend dashboard.</p></div>
              <button type="button" onClick={() => run(async () => {
                const result = await apiRequest('/api/v1/admin/email-outbox/process', { method: 'POST', body: {} });
                setNotice(`Email outbox: ${result.sent} sent, ${result.failed} still pending.`);
                setEmailOutbox(await apiRequest('/api/v1/admin/email-outbox'));
              }, '')} className={buttonClass}>Retry queued emails</button>
            </div>
            {!emailOutbox ? <p role="status" className="mt-4 text-sm text-[#F6F2EA]/50">Loading email status…</p> : (
              <>
                <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[['Pending', emailOutbox.pending], ['Failed / pending', emailOutbox.failedPending], ['Accepted by provider', emailOutbox.sent], ['Oldest pending', emailOutbox.oldestPending ? new Date(emailOutbox.oldestPending).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) : '—']].map(([label, value]) => <div key={label} className="rounded-xl border border-[#C9A96E]/15 bg-[#0F2A20]/40 p-3"><dt className="text-[0.6rem] uppercase tracking-[0.12em] text-[#F6F2EA]/45">{label}</dt><dd className="mt-1 text-sm tabular-nums text-[#C9A96E]">{value}</dd></div>)}
                </dl>
                {emailOutbox.recentFailures.length > 0 && <ul className="mt-4 space-y-2 text-xs text-red-100">{emailOutbox.recentFailures.map((failure) => <li key={failure.id}>{failure.lastError} · attempts {failure.attempts} · {new Date(failure.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</li>)}</ul>}
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
}
