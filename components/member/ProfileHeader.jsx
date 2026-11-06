'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/booking/utils';
import { formatNumber, formatShortDate, getGreeting } from '@/lib/member/utils';
import { useLocale } from '@/components/i18n/LocaleProvider';

const EASE = [0.22, 1, 0.36, 1];

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-5 sm:p-6">
      <dt className="text-[0.62rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">{label}</dt>
      <dd className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tabular-nums leading-none text-[#F6F2EA] sm:text-4xl">
        {value}
      </dd>
      {hint && <p className="mt-2 text-xs text-[#F6F2EA]/55">{hint}</p>}
    </div>
  );
}

export default function ProfileHeader({ member, now, tier, handicapIndex, points, wallet, nextBooking }) {
  const { locale, text } = useLocale();
  const initials = member.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

  return (
    <motion.header
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: EASE }}
    >
      <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-5">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 flex-none items-center justify-center rounded-full border border-[#C9A96E] font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#C9A96E] sm:h-20 sm:w-20 sm:text-3xl"
          >
            {initials}
          </span>
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.4em] text-[#C9A96E]">
              {text(getGreeting(now), getGreeting(now) === 'Good morning' ? 'Selamat pagi' : getGreeting(now) === 'Good afternoon' ? 'Selamat siang' : 'Selamat malam')}
            </p>
            <h1
              id="member-heading"
              className="mt-2 font-[family-name:var(--font-heading)] text-4xl font-medium leading-tight text-[#F6F2EA] sm:text-6xl"
            >
              {member.name}
            </h1>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#F6F2EA]/60">
              <span className="rounded-full border border-[#C9A96E]/50 px-3 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.25em] text-[#C9A96E]">
                {tier.label}
              </span>
              <span className="tabular-nums">ID {member.memberId}</span>
              <span>{text('Member since', 'Member sejak')} {formatShortDate(member.sinceKey, locale)}</span>
            </p>
          </div>
        </div>

        <Link
          href="/booking"
          className="inline-flex items-center justify-center rounded-full bg-[#C9A96E] px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20] transition-colors duration-300 hover:bg-[#d8bb84] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2EA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20]"
        >
          {text('Book Tee Time', 'Pesan Tee Time')}
        </Link>
      </div>

      <dl className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label={text('Handicap Index', 'Indeks Handicap')}
          value={handicapIndex === null ? '—' : handicapIndex.toFixed(1)}
          hint={handicapIndex === null ? text('Log 3 rounds to unlock', 'Catat 3 ronde untuk membuka') : text('Indicative index', 'Indeks indikatif')}
        />
        <Stat label={text('Loyalty Points', 'Poin Loyalty')} value={formatNumber(points, locale)} hint={text('Redeem in Rewards', 'Tukarkan di Rewards')} />
        <Stat label="Fairway Wallet" value={formatCurrency(wallet)} hint={text('Applied at check-in', 'Diterapkan saat check-in')} />
        <Stat
          label={text('Next Tee Time', 'Tee Time Berikutnya')}
          value={nextBooking ? nextBooking.time : '—'}
          hint={nextBooking ? formatShortDate(nextBooking.dateKey, locale) : text('No upcoming round', 'Belum ada ronde mendatang')}
        />
      </dl>
    </motion.header>
  );
}