'use client';

import { motion } from 'framer-motion';
import { TIERS } from '@/lib/member/utils';
import { useLocale } from '@/components/i18n/LocaleProvider';

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-4 w-4 flex-none text-[#C9A96E]"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export default function TierCard({ progress }) {
  const { text } = useLocale();
  const { current, next, percent, qualifyingRounds, remaining } = progress;

  return (
    <section
      aria-labelledby="tier-heading"
      className="relative overflow-hidden rounded-2xl border border-[#C9A96E]/40 bg-gradient-to-br from-[#1d4a37] via-[#0F2A20] to-[#1B1B1B] p-6 sm:p-8"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-[#C9A96E]/20"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full border border-[#C9A96E]/20"
      />

      <p className="text-[0.65rem] font-medium uppercase tracking-[0.35em] text-[#C9A96E]">
        {text('Digital Passport', 'Paspor Digital')}
      </p>
      <h2
        id="tier-heading"
        className="mt-2 font-[family-name:var(--font-heading)] text-5xl font-medium text-[#F6F2EA]"
      >
        {current.label}
      </h2>

      <div className="mt-8">
        <div className="flex items-baseline justify-between text-sm">
          <span className="tabular-nums text-[#F6F2EA]">
            {text(`${qualifyingRounds} verified ${qualifyingRounds === 1 ? 'round' : 'rounds'}`, `${qualifyingRounds} ronde terverifikasi`)}
          </span>
          <span className="text-[#F6F2EA]/55">{next ? `${next.label} ${text('at', 'di')} ${next.minRounds}` : text('Top tier', 'Tier tertinggi')}</span>
        </div>

        <div
          role="progressbar"
          aria-label={text('Progress toward next tier', 'Progres menuju tier berikutnya')}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          className="mt-3 h-2 overflow-hidden rounded-full bg-[#F6F2EA]/10"
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
            className="h-full rounded-full bg-[#C9A96E]"
          />
        </div>

        <p className="mt-3 text-sm text-[#F6F2EA]/65">
          {next
            ? text(`${remaining} more verified ${remaining === 1 ? 'round' : 'rounds'} in the next 12 months to reach ${next.label}.`, `Catat ${remaining} ronde terverifikasi lagi dalam 12 bulan ke depan untuk mencapai ${next.label}.`)
            : text('You hold our highest tier. Thank you for playing with us.', 'Anda telah mencapai tier tertinggi kami. Terima kasih telah bermain bersama kami.')}
        </p>
      </div>

      <ul className="mt-8 space-y-3 border-t border-[#C9A96E]/20 pt-6 text-sm text-[#F6F2EA]/85">
        {current.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-3">
            <CheckIcon />
            <span>{text(benefit, ({
              'Standard 60-day booking window': 'Periode booking standar 60 hari',
              '1% cashback to Fairway Wallet': 'Cashback 1% ke Fairway Wallet',
              'Points on every green fee, caddy and extra': 'Poin untuk setiap green fee, caddy, dan layanan tambahan',
              'Booking opens 7 days before the public': 'Booking dibuka 7 hari sebelum publik',
              '2% cashback to Fairway Wallet': 'Cashback 2% ke Fairway Wallet',
              'Priority caddy requests': 'Prioritas permintaan caddy',
              '2 guest passes per year': '2 guest pass per tahun',
              'Booking opens 14 days before the public': 'Booking dibuka 14 hari sebelum publik',
              '3% cashback to Fairway Wallet': 'Cashback 3% ke Fairway Wallet',
              'Priority access to prime-time tee times': 'Prioritas akses tee time populer',
              'Dedicated concierge and 4 guest passes per year': 'Concierge khusus dan 4 guest pass per tahun',
            })[benefit] || benefit)}</span>
          </li>
        ))}
      </ul>

      <ol aria-label={text('Membership tiers', 'Tingkatan membership')} className="mt-8 grid grid-cols-3 gap-2">
        {TIERS.map((tier) => {
          const reached = qualifyingRounds >= tier.minRounds;
          const active = tier.id === current.id;
          return (
            <li
              key={tier.id}
              aria-current={active ? 'true' : undefined}
              className={`rounded-xl border px-3 py-3 text-center text-[0.65rem] font-semibold uppercase tracking-[0.2em] ${
                active
                  ? 'border-[#C9A96E] bg-[#C9A96E] text-[#0F2A20]'
                  : reached
                    ? 'border-[#C9A96E]/50 text-[#C9A96E]'
                    : 'border-[#F6F2EA]/15 text-[#F6F2EA]/40'
              }`}
            >
              {tier.label}
              <span className="mt-1 block text-[0.6rem] font-medium tracking-[0.1em] opacity-80">
                {text(`${tier.minRounds}+ rounds`, `${tier.minRounds}+ ronde`)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}