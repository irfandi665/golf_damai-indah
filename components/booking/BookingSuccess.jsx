'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  CADDY_OPTIONS,
  CLUB_NAME,
  ROUND_DURATION_MINUTES,
  formatCurrency,
  formatLongDate,
  minutesToTime,
  pluralize,
  timeToMinutes,
} from '@/lib/booking/utils';

function buildCalendarUrl({ dateKey, time, reference, players }) {
  const [year, month, day] = dateKey.split('-');
  const compactTime = (value) => value.replace(':', '') + '00';
  const endTime = minutesToTime(timeToMinutes(time) + ROUND_DURATION_MINUTES);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Golf at ${CLUB_NAME}`,
    dates: `${year}${month}${day}T${compactTime(time)}/${year}${month}${day}T${compactTime(endTime)}`,
    ctz: 'Asia/Jakarta',
    details: `Booking reference ${reference} · ${pluralize(players, 'player')}`,
    location: CLUB_NAME,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export default function BookingSuccess({ state, quote, onReset }) {
  const caddy = CADDY_OPTIONS.find((option) => option.id === state.caddy);

  return (
    <motion.section
      aria-labelledby="success-heading"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-2xl text-center"
    >
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-[#C9A96E]">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-9 w-9 text-[#C9A96E]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <motion.path
            d="M5 12.5l4.5 4.5L19 7.5"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
      </div>

      <p className="mt-8 text-xs font-medium uppercase tracking-[0.4em] text-[#C9A96E]">Booking Confirmed</p>
      <h2
        id="success-heading"
        tabIndex={-1}
        className="mt-4 font-[family-name:var(--font-heading)] text-5xl font-medium text-[#F6F2EA] outline-none sm:text-6xl"
      >
        See you on the first tee
      </h2>
      <p className="mt-5 text-base text-[#F6F2EA]/70">
        A confirmation has been sent to <span className="text-[#F6F2EA]">{state.guest.email}</span> and{' '}
        <span className="text-[#F6F2EA]">{state.guest.phone}</span>.
      </p>

      <div className="mt-10 rounded-2xl border border-[#C9A96E]/25 bg-white/[0.03] p-8 text-left">
        <div className="flex items-baseline justify-between border-b border-[#C9A96E]/15 pb-5">
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">Reference</span>
          <span className="font-[family-name:var(--font-heading)] text-3xl font-semibold tracking-[0.12em] text-[#F6F2EA]">
            {state.reference}
          </span>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          {[
            ['Date', formatLongDate(state.dateKey)],
            ['Tee Time', state.slot.time],
            ['Players', pluralize(state.players, 'player')],
            ['Caddy', `${caddy.label} × ${state.players}`],
            ['Buggy', state.buggy ? pluralize(Math.ceil(state.players / 2), 'cart') : 'Walking'],
            ['Total (incl. tax)', formatCurrency(quote.total)],
          ].map(([term, description]) => (
            <div key={term} className="flex justify-between gap-6">
              <dt className="text-[#F6F2EA]/55">{term}</dt>
              <dd className="text-right tabular-nums text-[#F6F2EA]">{description}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-10 flex flex-col justify-center gap-4 sm:flex-row">
        <a
          href={buildCalendarUrl({
            dateKey: state.dateKey,
            time: state.slot.time,
            reference: state.reference,
            players: state.players,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-[#C9A96E] px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20] transition-colors hover:bg-[#d8bb84] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2EA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20]"
        >
          Add to Calendar
        </a>
        <button
          type="button"
          onClick={onReset}
          className="rounded-full border border-[#C9A96E]/40 px-8 py-4 text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA] transition-colors hover:border-[#C9A96E] hover:text-[#C9A96E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E]"
        >
          Book Another Round
        </button>
        <Link
          href="/"
          className="rounded-full px-8 py-4 text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/60 transition-colors hover:text-[#C9A96E] focus-visible:outline-none focus-visible:text-[#C9A96E]"
        >
          Back to Home
        </Link>
      </div>
    </motion.section>
  );
}