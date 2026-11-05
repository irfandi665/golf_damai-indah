'use client';

import QuantityStepper from './QuantityStepper';
import {
  BUGGY,
  CADDY_OPTIONS,
  EXTRAS,
  formatCurrency,
  pluralize,
} from '@/lib/booking/utils';

export default function StepServices({ state, dispatch }) {
  const carts = Math.ceil(state.players / BUGGY.seatsPerCart);

  return (
    <div className="space-y-14">
      {/* Caddy */}
      <fieldset>
        <legend className="mb-5 font-[family-name:var(--font-heading)] text-3xl font-medium text-[#F6F2EA]">
          Your Caddy
        </legend>
        <p className="mb-5 text-sm text-[#F6F2EA]/55">
          One caddy per player, assigned and waiting at the starter.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {CADDY_OPTIONS.map((option) => {
            const selected = state.caddy === option.id;
            return (
              <label
                key={option.id}
                className={`relative flex cursor-pointer flex-col rounded-2xl border p-6 transition-all duration-300 focus-within:ring-2 focus-within:ring-[#C9A96E] ${
                  selected
                    ? 'border-[#C9A96E] bg-[#C9A96E]/10'
                    : 'border-[#C9A96E]/20 bg-white/[0.03] hover:border-[#C9A96E]/60'
                }`}
              >
                <input
                  type="radio"
                  name="caddy"
                  value={option.id}
                  checked={selected}
                  onChange={() => dispatch({ type: 'SET_CADDY', caddy: option.id })}
                  className="sr-only"
                />
                <span className="flex items-start justify-between gap-4">
                  <span className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#F6F2EA]">
                    {option.label}
                  </span>
                  <span
                    aria-hidden="true"
                    className={`mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full border ${
                      selected ? 'border-[#C9A96E]' : 'border-[#F6F2EA]/30'
                    }`}
                  >
                    {selected && <span className="h-2.5 w-2.5 rounded-full bg-[#C9A96E]" />}
                  </span>
                </span>
                <span className="mt-2 text-sm leading-relaxed text-[#F6F2EA]/60">
                  {option.description}
                </span>
                <span className="mt-5 text-sm tabular-nums text-[#C9A96E]">
                  {formatCurrency(option.pricePerPlayer)}
                  <span className="text-[#F6F2EA]/50"> / player</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Buggy */}
      <section aria-labelledby="buggy-heading">
        <h2
          id="buggy-heading"
          className="mb-5 font-[family-name:var(--font-heading)] text-3xl font-medium text-[#F6F2EA]"
        >
          Golf Buggy
        </h2>
        <div
          className={`flex items-center justify-between gap-6 rounded-2xl border p-6 transition-colors duration-300 ${
            state.buggy ? 'border-[#C9A96E] bg-[#C9A96E]/10' : 'border-[#C9A96E]/20 bg-white/[0.03]'
          }`}
        >
          <div>
            <p id="buggy-label" className="text-base font-medium text-[#F6F2EA]">
              {state.buggy
                ? `${pluralize(carts, 'cart')} reserved for ${pluralize(state.players, 'player')}`
                : 'Walking the course'}
            </p>
            <p className="mt-1 text-sm text-[#F6F2EA]/60">{BUGGY.description}</p>
            <p className="mt-3 text-sm tabular-nums text-[#C9A96E]">
              {formatCurrency(BUGGY.pricePerCart)}
              <span className="text-[#F6F2EA]/50"> / cart</span>
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={state.buggy}
            aria-labelledby="buggy-label"
            onClick={() => dispatch({ type: 'SET_BUGGY', value: !state.buggy })}
            className={`relative h-8 w-14 flex-none rounded-full border transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20] ${
              state.buggy ? 'border-[#C9A96E] bg-[#C9A96E]' : 'border-[#F6F2EA]/30 bg-transparent'
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1 h-5 w-5 rounded-full transition-all duration-300 ${
                state.buggy ? 'left-8 bg-[#0F2A20]' : 'left-1 bg-[#F6F2EA]/60'
              }`}
            />
          </button>
        </div>
      </section>

      {/* Extras */}
      <section aria-labelledby="extras-heading">
        <h2
          id="extras-heading"
          className="mb-5 font-[family-name:var(--font-heading)] text-3xl font-medium text-[#F6F2EA]"
        >
          Enhance Your Round
        </h2>
        <ul className="divide-y divide-[#C9A96E]/15 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03]">
          {EXTRAS.map((extra) => (
            <li
              key={extra.id}
              className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-base font-medium text-[#F6F2EA]">{extra.label}</p>
                <p className="mt-1 text-sm text-[#F6F2EA]/60">{extra.description}</p>
                <p className="mt-2 text-sm tabular-nums text-[#C9A96E]">
                  {formatCurrency(extra.unitPrice)}
                  <span className="text-[#F6F2EA]/50"> {extra.unitLabel}</span>
                </p>
              </div>
              <QuantityStepper
                label={extra.label}
                value={state.extras[extra.id]}
                min={0}
                max={state.players}
                onChange={(quantity) => dispatch({ type: 'SET_EXTRA', id: extra.id, quantity })}
              />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}