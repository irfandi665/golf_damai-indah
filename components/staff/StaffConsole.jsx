'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';

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
    if (role === 'admin') apiRequest('/api/v1/admin/inquiries?status=new')
      .then(setInquiries)
      .catch((reason) => setError(reason.message));
    if (role === 'admin') fetch('/api/v1/pricing')
      .then((response) => response.json())
      .then((pricing) => setServiceItems(pricing.services || []))
      .catch((reason) => setError(reason.message));
  }, [role, date, search, reload]);

  const selectedSlots = useMemo(() => new Set(selected), [selected]);
  const todayJakarta = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());

  async function run(action, successMessage) {
    setError('');
    setNotice('');
    try {
      await action();
      if (successMessage) setNotice(successMessage);
      setReload((value) => value + 1);
    } catch (reason) { setError(reason.message); }
  }

  async function toggleBlocks(blocked) {
    await run(() => apiRequest('/api/v1/admin/tee-sheet/blocks', {
      method: 'PUT',
      body: { courseId: 1, date, slotIds: selected, blocked, reason: 'Blocked by staff' },
    }), blocked ? 'Selected slots blocked.' : 'Selected slots reopened.');
    setSelected([]);
  }

  async function submitCheckIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const qrToken = new FormData(form).get('qrToken');
    await run(() => apiRequest('/api/v1/staff/check-in', { method: 'POST', body: { qrToken } }), 'Booking checked in.');
    form.reset();
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

      <section className="mt-8 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="font-[family-name:var(--font-heading)] text-3xl">Daily tee sheet</h2><p className="mt-1 text-xs text-[#F6F2EA]/50">Search by booking reference, guest name or phone. No-show penalties are not configured.</p></div>
          {role === 'admin' && <div className="flex gap-2"><button type="button" disabled={!selected.length} onClick={() => toggleBlocks(true)} className={buttonClass}>Block selected</button><button type="button" disabled={!selected.length} onClick={() => toggleBlocks(false)} className={buttonClass}>Reopen</button></div>}
        </div>
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
                  <div><p className="font-[family-name:var(--font-heading)] text-2xl">{slot.time}</p><p className="mt-1 text-xs text-[#F6F2EA]/55">{slot.booked} booked · {slot.held} held · {slot.available} open</p></div>
                  {role === 'admin' && slot.booked === 0 && slot.held === 0 && <input type="checkbox" aria-label={`Select ${slot.time}`} checked={selectedSlots.has(slot.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, slot.id] : current.filter((id) => id !== slot.id))} />}
                  <span className="text-[0.6rem] uppercase tracking-[0.15em] text-[#C9A96E]">{slot.status}</span>
                </div>
                {slot.reason && <p className="mt-2 text-xs text-red-100">{slot.reason}</p>}
                {slot.bookings.length > 0 && <ul className="mt-4 space-y-3 border-t border-[#C9A96E]/10 pt-3">{slot.bookings.map((booking) => <li key={booking.id} className="text-xs text-[#F6F2EA]/75"><span className="font-medium">{booking.reference}</span> · {booking.guestName} · {booking.players} player(s) · {booking.status}<span className="block text-[#F6F2EA]/45">{booking.guestPhone}</span><span className="block break-all text-[0.6rem] text-[#F6F2EA]/30">{booking.id}</span>{booking.status === 'confirmed' && date === todayJakarta && <button type="button" onClick={() => run(() => apiRequest(`/api/v1/staff/bookings/${encodeURIComponent(booking.id)}/check-in`, { method: 'POST', body: {} }), `${booking.reference} checked in.`)} className="mt-2 text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#C9A96E] underline underline-offset-4">Check in booking</button>}</li>)}</ul>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <form onSubmit={submitCheckIn} className="space-y-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl">QR check-in</h2>
          <FormField label="Scan or paste booking QR token"><textarea name="qrToken" required rows={3} className={fieldClass} /></FormField>
          <button className={buttonClass}>Check in booking</button>
        </form>
        <form onSubmit={submitComplete} className="space-y-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl">Complete a round</h2>
          <FormField label="Booking ID"><input name="bookingId" required className={fieldClass} /></FormField>
          <p className="text-xs leading-relaxed text-[#F6F2EA]/45">Completion applies configured member points and cashback. Do not mark complete until the club's onsite cashier workflow is finished.</p>
          <button className={buttonClass}>Complete round</button>
        </form>
      </div>

      {role === 'admin' && (
        <>
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

          <button type="button" onClick={() => run(async () => {
            const result = await apiRequest('/api/v1/admin/email-outbox/process', { method: 'POST', body: {} });
            setNotice(`Email outbox: ${result.sent} sent, ${result.failed} still pending.`);
          }, '')} className={`${buttonClass} mt-8`}>Retry queued email notifications</button>
        </>
      )}
    </section>
  );
}
