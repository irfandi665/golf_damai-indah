'use client';

import {
  CONFIRM_FORM_ID,
  formatCurrency,
  formatLongDate,
  pluralize,
} from '@/lib/booking/utils';

function PrimaryAction({ isLastStep, label, disabled, onNext, className = '' }) {
  return (
    <button
      type={isLastStep ? 'submit' : 'button'}
      form={isLastStep ? CONFIRM_FORM_ID : undefined}
      onClick={isLastStep ? undefined : onNext}
      disabled={disabled}
      className={`rounded-full bg-[#C9A96E] px-7 py-4 text-center text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20] transition-all duration-500 hover:bg-[#d8bb84] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2EA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20] disabled:cursor-not-allowed disabled:bg-[#C9A96E]/25 disabled:text-[#F6F2EA]/40 ${className}`}
    >
      {label}
    </button>
  );
}

export function PriceSummary({ state, quote, onBack, onNext, actionLabel, actionDisabled, isLastStep }) {
  return (
    <aside
      aria-label="Ringkasan reservasi"
      className="sticky top-28 hidden self-start rounded-2xl border border-[#C9A96E]/25 bg-[#0F2A20] p-7 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] lg:block"
    >
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.35em] text-[#C9A96E]">
        Your Reservation
      </p>

      {quote ? (
        <>
          <p className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-medium leading-tight text-[#F6F2EA]">
            {state.slot.time}
          </p>
          <p className="mt-1 text-sm text-[#F6F2EA]/65">
            {formatLongDate(state.dateKey)} · {pluralize(state.players, 'player')}
          </p>

          <ul className="mt-6 space-y-3 border-t border-[#C9A96E]/15 pt-6 text-sm">
            {quote.lines.map((line) => (
              <li key={line.id} className="flex items-start justify-between gap-4">
                <span>
                  <span className="block text-[#F6F2EA]">{line.label}</span>
                  <span className="block text-xs tabular-nums text-[#F6F2EA]/45">{line.detail}</span>
                </span>
                <span className="tabular-nums text-[#F6F2EA]/90">{formatCurrency(line.amount)}</span>
              </li>
            ))}
          </ul>

          <dl className="mt-6 space-y-2 border-t border-[#C9A96E]/15 pt-6 text-sm">
            <div className="flex justify-between text-[#F6F2EA]/65">
              <dt>Subtotal</dt>
              <dd className="tabular-nums">{formatCurrency(quote.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-[#F6F2EA]/65">
              <dt>PPN 11%</dt>
              <dd className="tabular-nums">{formatCurrency(quote.tax)}</dd>
            </div>
            <div className="flex items-baseline justify-between pt-3">
              <dt className="text-[#F6F2EA]">Total</dt>
              <dd className="font-[family-name:var(--font-heading)] text-3xl font-semibold tabular-nums text-[#C9A96E]">
                {formatCurrency(quote.total)}
              </dd>
            </div>
            {state.players > 1 && (
              <p className="pt-1 text-right text-xs tabular-nums text-[#F6F2EA]/45">
                ≈ {formatCurrency(quote.perPlayer)} per player
              </p>
            )}
          </dl>
        </>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-[#F6F2EA]/55">
          Select a date and tee time to see your complete, all-in price. No hidden fees.
        </p>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <PrimaryAction
          isLastStep={isLastStep}
          label={actionLabel}
          disabled={actionDisabled}
          onNext={onNext}
        />
        {state.stepIndex > 0 && (
          <button
            type="button"
            onClick={onBack}
            disabled={state.submit.status === 'submitting'}
            className="rounded-full border border-[#C9A96E]/30 px-7 py-3.5 text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/80 transition-colors hover:border-[#C9A96E] hover:text-[#C9A96E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] disabled:opacity-40"
          >
            Back
          </button>
        )}
      </div>
    </aside>
  );
}

export function MobileActionBar({ state, quote, onBack, onNext, actionLabel, actionDisabled, isLastStep }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[#C9A96E]/25 bg-[#0F2A20]/90 px-5 pt-4 backdrop-blur-xl pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden">
      <div className="mx-auto flex max-w-xl items-center gap-3">
        {state.stepIndex > 0 && (
          <button
            type="button"
            onClick={onBack}
            disabled={state.submit.status === 'submitting'}
            aria-label="Kembali ke langkah sebelumnya"
            className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-[#C9A96E]/40 text-[#C9A96E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] disabled:opacity-40"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] uppercase tracking-[0.25em] text-[#F6F2EA]/50">Total incl. tax</p>
          <p className="truncate font-[family-name:var(--font-heading)] text-xl font-semibold tabular-nums text-[#C9A96E]">
            {quote ? formatCurrency(quote.total) : '—'}
          </p>
        </div>

        <PrimaryAction
          isLastStep={isLastStep}
          label={actionLabel}
          disabled={actionDisabled}
          onNext={onNext}
          className="flex-none px-5 py-3.5"
        />
      </div>
    </div>
  );
}