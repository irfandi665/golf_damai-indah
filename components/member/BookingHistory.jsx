'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { CADDY_OPTIONS, formatCurrency, pluralize } from '@/lib/booking/utils';
import Panel from './Panel';
import BookingQr from './BookingQr';
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
const STATUS_LABELS = { confirmed: 'Confirmed', completed: 'Completed', cancelled: 'Cancelled' };

const TABS = [
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'past', label: 'History' },
];

function BookingCard({ booking, now, confirming, onAskCancel, onKeep, onConfirmCancel }) {
  const caddy = CADDY_OPTIONS.find((option) => option.id === booking.caddy);
  const { day, month, weekday } = getDateParts(booking.dateKey);
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
              {STATUS_LABELS[booking.status]}
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

export default function BookingHistory({ bookings, now, dispatch, todayKey, voucherValidUntil }) {
  const [tab, setTab] = useState('upcoming');
  const [confirmingId, setConfirmingId] = useState(null);

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
              />
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}