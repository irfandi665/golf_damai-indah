'use client';

import { motion } from 'framer-motion';
import { TIERS } from '@/lib/member/utils';

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
        Digital Passport
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
            {qualifyingRounds} verified {qualifyingRounds === 1 ? 'round' : 'rounds'}
          </span>
          <span className="text-[#F6F2EA]/55">{next ? `${next.label} at ${next.minRounds}` : 'Top tier'}</span>
        </div>

        <div
          role="progressbar"
          aria-label="Progres menuju tier berikutnya"
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
            ? `${remaining} more verified ${remaining === 1 ? 'round' : 'rounds'} in the next 12 months to reach ${next.label}.`
            : 'You hold our highest tier. Thank you for playing with us.'}
        </p>
      </div>

      <ul className="mt-8 space-y-3 border-t border-[#C9A96E]/20 pt-6 text-sm text-[#F6F2EA]/85">
        {current.benefits.map((benefit) => (
          <li key={benefit} className="flex items-start gap-3">
            <CheckIcon />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>

      <ol aria-label="Tingkatan membership" className="mt-8 grid grid-cols-3 gap-2">
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
                {tier.minRounds}+ rounds
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}