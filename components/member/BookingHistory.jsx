'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CADDY_OPTIONS, formatCurrency, pluralize } from '@/lib/booking/utils';
import Panel from './Panel';
import BookingQr from './BookingQr';
import { apiRequest } from '@/lib/api-client';
import { fetchTeeTimes } from '@/lib/booking/engine';
import { newIdempotencyKey } from '@/lib/api-client';
import { useLocale } from '@/components/i18n/LocaleProvider';
import {
  buildCalendarUrl,
  formatDateTime,
  formatNumber,
  getCancellationDeadline,
  getDateParts,
  isFreeCancellation,
  pointsForAmount,
} from '@/lib/member/utils';

const STATUS_STYLES = {
  confirmed: 'border-[#C9A96E]/50 text-[#C9A96E]',
  completed: 'border-emerald-300/40 text-emerald-300',
  cancelled: 'border-[#F6F2EA]/20 text-[#F6F2EA]/50',
};
const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'History' },
];

function RescheduleControl({ booking, now, onRescheduled }) {
  const { text } = useLocale();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [slotId, setSlotId] = useState('');
  const [slots, setSlots] = useState([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const eligible = isFreeCancellation(booking, now);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      setSlotId('');
      return undefined;
    }
    const controller = new AbortController();
    fetchTeeTimes(date, { signal: controller.signal, players: booking.players })
      .then((result) => setSlots(result.filter((slot) => slot.slotId && slot.spotsLeft >= booking.players && !['blocked', 'closed', 'full'].includes(slot.status))))
      .catch((reason) => {
        if (reason.name !== 'AbortError') setError(reason.message);
      });
    return () => controller.abort();
  }, [date, booking.players]);

  async function submit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await apiRequest(`/api/v1/bookings/${encodeURIComponent(booking.id)}/reschedule`, {
        method: 'POST',
        idempotencyKey: newIdempotencyKey(),
        body: { newSlotId: Number(slotId) },
      });
      setOpen(false);
      onRescheduled();
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!eligible) return null;
  return (
    <div>
      <button type="button" onClick={() => setOpen((value) => !value)} className="rounded-full border border-[#C9A96E]/50 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-[#C9A96E] hover:bg-[#C9A96E]/10">
        {open ? text('Close reschedule', 'Tutup ubah jadwal') : text('Change tee time', 'Ubah Tee Time')}
      </button>
      {open && (
        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-[#C9A96E]/20 bg-[#0F2A20]/60 p-4 sm:grid-cols-3">
          <label className="text-xs text-[#F6F2EA]/60">{text('New date', 'Tanggal baru')}<input type="date" required value={date} onChange={(event) => { setDate(event.target.value); setSlotId(''); }} className="mt-2 w-full rounded-lg border border-[#C9A96E]/25 bg-[#0F2A20] px-3 py-2.5 text-sm text-[#F6F2EA]" /></label>
          <label className="text-xs text-[#F6F2EA]/60">{text('Available tee time', 'Tee time tersedia')}<select required value={slotId} onChange={(event) => setSlotId(event.target.value)} className="mt-2 w-full rounded-lg border border-[#C9A96E]/25 bg-[#0F2A20] px-3 py-2.5 text-sm text-[#F6F2EA]"><option value="">{text('Select a time', 'Pilih waktu')}</option>{slots.filter((slot) => !(date === booking.dateKey && slot.time === booking.time)).map((slot) => <option key={slot.slotId} value={slot.slotId}>{slot.time} · {slot.spotsLeft} {text('available', 'tersedia')}</option>)}</select></label>
          <div className="flex items-end"><button type="submit" disabled={!slotId || submitting} className="w-full rounded-full bg-[#C9A96E] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#0F2A20] disabled:opacity-50">{submitting ? text('Updating…', 'Memperbarui…') : text('Confirm change', 'Konfirmasi perubahan')}</button></div>
          <p className="text-xs leading-relaxed text-[#F6F2EA]/50 sm:col-span-3">{text('Available until 24 hours before the original tee time. Player count and selected services remain unchanged. Green fee is recalculated; any difference is settled at the club.', 'Tersedia hingga 24 jam sebelum Tee Time awal. Jumlah pemain dan layanan pilihan tidak berubah. Green fee dihitung ulang; selisih dibayar di klub.')}</p>
          {error && <p role="alert" className="text-xs text-red-200 sm:col-span-3">{error}</p>}
        </form>
      )}
    </div>
  );
}

function BookingCard({ booking, now, confirming, onAskCancel, onKeep, onConfirmCancel, onRescheduled }) {
  const { locale, text } = useLocale();
  const statusLabels = { confirmed: text('Confirmed', 'Dikonfirmasi'), completed: text('Completed', 'Selesai'), cancelled: text('Cancelled', 'Dibatalkan') };
  const caddy = CADDY_OPTIONS.find((option) => option.id === booking.caddy);
  const { day, month, weekday } = getDateParts(booking.dateKey, locale);
  const upcoming = booking.status === 'confirmed';
  const free = upcoming && isFreeCancellation(booking, now);

  return (
    <li className="rounded-xl border border-[#C9A96E]/15 bg-[#0F2A20]/40 p-5">
      <div className="flex gap-5">
        <div
          aria-hidden="true"
          className="flex h-[4.5rem] w-16 flex-none flex-col items-center justify-center rounded-xl border border-[#C9A96E]/40 text-[#C9A96E]"
        >
          <span className="text-[0.6rem] font-medium uppercase tracking-[0.2em]">{weekday}</span>
          <span className="font-[family-name:var(--font-heading)] text-3xl font-semibold leading-none">{day}</span>
          <span className="text-[0.6rem] font-medium tracking-[0.2em]">{month}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="font-[family-name:var(--font-heading)] text-2xl font-semibold tabular-nums text-[#F6F2EA]">
              {booking.time}
              <span className="ml-3 text-sm font-normal text-[#F6F2EA]/55">{booking.reference}</span>
            </p>
            <span
              className={`rounded-full border px-3 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] ${STATUS_STYLES[booking.status]}`}
            >
              {statusLabels[booking.status]}
            </span>
          </div>
          <p className="mt-1 text-sm text-[#F6F2EA]/65">
            {pluralize(booking.players, 'player')} · {caddy.label}
            {booking.buggy ? ' · Buggy' : ' · Walking'}
          </p>
          <p className="mt-2 text-sm tabular-nums text-[#F6F2EA]">
            {formatCurrency(booking.total)}
            {booking.status === 'completed' && (
              <span className="ml-3 text-[#C9A96E]">+{formatNumber(pointsForAmount(booking.total))} pts</span>
            )}
          </p>
        </div>
      </div>

      {upcoming && (
        <>
          <p className={`mt-4 text-xs ${free ? 'text-[#F6F2EA]/55' : 'text-amber-300'}`}>
            {free
              ? `Free cancellation until ${formatDateTime(getCancellationDeadline(booking))}.`
              : 'Inside the 24-hour window. Cancelling now is credited as a rain-check voucher.'}
          </p>

          <AnimatePresence mode="wait" initial={false}>
            {confirming ? (
              <motion.div
                key="confirm"
                role="alertdialog"
                aria-label={`Konfirmasi pembatalan ${booking.reference}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="mt-4 flex flex-col gap-3 rounded-xl border border-red-300/30 bg-red-950/20 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <p className="text-sm text-[#F6F2EA]/85">Cancel this reservation?</p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={onKeep}
                    className="rounded-full border border-[#F6F2EA]/30 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA] transition-colors hover:border-[#C9A96E] hover:text-[#C9A96E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E]"
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    onClick={() => onConfirmCancel(free)}
                    className="rounded-full bg-red-300 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#1B1B1B] transition-colors hover:bg-red-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20]"
                  >
                    Yes, Cancel
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="actions"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-4 flex flex-wrap gap-3"
              >
                <a
                  href={buildCalendarUrl(booking)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-[#C9A96E]/50 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-[#C9A96E] transition-colors hover:bg-[#C9A96E] hover:text-[#0F2A20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E]"
                >
                  Add to Calendar
                </a>
                <BookingQr bookingId={booking.id} />
                <RescheduleControl booking={booking} now={now} onRescheduled={onRescheduled} />
                <button
                  type="button"
                  onClick={onAskCancel}
                  className="rounded-full px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/60 underline decoration-[#C9A96E]/40 underline-offset-4 transition-colors hover:text-[#F6F2EA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E]"
                >
                  Cancel Booking
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      {booking.status === 'completed' && (
        <div className="mt-4">
          <Link
            href="/booking"
            className="inline-block rounded-full border border-[#C9A96E]/50 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-[#C9A96E] transition-colors hover:bg-[#C9A96E] hover:text-[#0F2A20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E]"
          >
            Book Again
          </Link>
        </div>
      )}
    </li>
  );
}

export default function BookingHistory({ bookings, now, dispatch, todayKey, voucherValidUntil, onRefresh }) {
  const [tab, setTab] = useState('upcoming');
  const [confirmingId, setConfirmingId] = useState(null);
  const [waitlist, setWaitlist] = useState([]);
  const [waitlistError, setWaitlistError] = useState('');
  const [waitlistNotice, setWaitlistNotice] = useState('');

  useEffect(() => {
    apiRequest('/api/v1/me/waitlist')
      .then(setWaitlist)
      .catch((reason) => setWaitlistError(reason.message));
  }, []);

  async function leaveWaitlist(id) {
    setWaitlistError('');
    setWaitlistNotice('');
    try {
      await apiRequest(`/api/v1/me/waitlist/${encodeURIComponent(id)}`, { method: 'DELETE', body: {} });
      setWaitlist((current) => current.filter((entry) => entry.id !== id));
      setWaitlistNotice('Waitlist entry cancelled.');
    } catch (reason) {
      setWaitlistError(reason.message);
    }
  }

  const { upcoming, past } = useMemo(() => {
    const byDateTime = (a, b) => `${a.dateKey}${a.time}`.localeCompare(`${b.dateKey}${b.time}`);
    return {
      upcoming: bookings.filter((item) => item.status === 'confirmed').sort(byDateTime),
      past: bookings.filter((item) => item.status !== 'confirmed').sort((a, b) => byDateTime(b, a)),
    };
  }, [bookings]);

  const visible = tab === 'upcoming' ? upcoming : past;

  const handleTabKeyDown = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tab === 'upcoming' ? 'past' : 'upcoming';
    setTab(next);
    setConfirmingId(null);
    document.getElementById(`booking-tab-${next}`)?.focus();
  };

  return (
    <>
    <Panel
      id="waitlist"
      eyebrow="Availability"
      title="Tee-time waitlist"
      description="Open places are held for 10 minutes while you complete the reservation."
    >
      {waitlistError && <p role="alert" className="mb-4 text-sm text-red-200">{waitlistError}</p>}
      {waitlistNotice && <p role="status" className="mb-4 text-sm text-emerald-100">{waitlistNotice}</p>}
      {waitlist.length === 0 ? (
        <p className="text-sm text-[#F6F2EA]/55">You have no active waitlist entries.</p>
      ) : (
        <ul className="space-y-3">
          {waitlist.map((entry) => (
            <li key={entry.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#C9A96E]/15 bg-[#0F2A20]/40 p-4">
              <div>
                <p className="text-sm text-[#F6F2EA]">{entry.date} · {entry.time} · {pluralize(entry.players, 'player')}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.15em] text-[#C9A96E]">{entry.status === 'held' ? 'Offer held — check your email' : 'Waiting for an opening'}</p>
              </div>
              <button type="button" onClick={() => leaveWaitlist(entry.id)} className="text-xs text-[#F6F2EA]/55 underline underline-offset-4 hover:text-[#F6F2EA]">Leave waitlist</button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
    <Panel
      id="bookings"
      eyebrow="Reservations"
      title="Your Rounds"
      action={
        <div
          role="tablist"
          aria-label="Filter reservasi"
          onKeyDown={handleTabKeyDown}
          className="inline-flex rounded-full border border-[#C9A96E]/30 p-1"
        >
          {TABS.map((item) => {
            const active = tab === item.id;
            const count = item.id === 'upcoming' ? upcoming.length : past.length;
            return (
              <button
                key={item.id}
                id={`booking-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={active}
                aria-controls="booking-tabpanel"
                tabIndex={active ? 0 : -1}
                onClick={() => {
                  setTab(item.id);
                  setConfirmingId(null);
                }}
                className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] ${
                  active ? 'bg-[#C9A96E] text-[#0F2A20]' : 'text-[#F6F2EA]/70 hover:text-[#C9A96E]'
                }`}
              >
                {item.label} <span className="tabular-nums opacity-70">({count})</span>
              </button>
            );
          })}
        </div>
      }
    >
      <div id="booking-tabpanel" role="tabpanel" aria-labelledby={`booking-tab-${tab}`}>
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#C9A96E]/25 px-6 py-12 text-center">
            <p className="text-sm text-[#F6F2EA]/60">
              {tab === 'upcoming' ? 'No upcoming rounds on the calendar.' : 'Your completed rounds appear here.'}
            </p>
            {tab === 'upcoming' && (
              <Link
                href="/booking"
                className="mt-5 inline-block rounded-full bg-[#C9A96E] px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20] transition-colors hover:bg-[#d8bb84] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2EA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20]"
              >
                Reserve a Tee Time
              </Link>
            )}
          </div>
        ) : (
          <ul className="space-y-4">
            {visible.map((booking) => (
              <BookingCard
                key={booking.id}
                booking={booking}
                now={now}
                confirming={confirmingId === booking.id}
                onAskCancel={() => setConfirmingId(booking.id)}
                onKeep={() => setConfirmingId(null)}
                onConfirmCancel={(free) => {
                  setConfirmingId(null);
                  dispatch({
                    type: 'CANCEL_BOOKING',
                    bookingId: booking.id,
                    late: !free,
                    todayKey,
                    validUntil: voucherValidUntil,
                  });
                }}
                onRescheduled={onRefresh}
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
    </>
  );
}