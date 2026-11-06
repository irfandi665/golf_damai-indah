'use client';

import QuantityStepper from './QuantityStepper';
import {
  BUGGY,
  CADDY_OPTIONS,
  EXTRAS,
  formatCurrency,
  pluralize,
} from '@/lib/booking/utils';
import { useLocale } from '@/components/i18n/LocaleProvider';

export default function StepServices({ state, dispatch }) {
  const { text } = useLocale();
  const carts = Math.ceil(state.players / BUGGY.seatsPerCart);

  return (
    <div className="space-y-14">
      {/* Caddy */}
      <fieldset>
        <legend className="mb-5 font-[family-name:var(--font-heading)] text-3xl font-medium text-[#F6F2EA]">
          {text('Your Caddy', 'Caddy Anda')}
        </legend>
        <p className="mb-5 text-sm text-[#F6F2EA]/55">
          {text('One caddy per player, assigned and waiting at the starter.', 'Satu caddy untuk setiap pemain, disiapkan dan menunggu di area starter.')}
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
                    {option.id === 'standard' ? text('Standard Caddy', 'Caddy Standar') : text('Senior Caddy', 'Caddy Senior')}
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
                  {option.id === 'standard'
                    ? text('Trained caddy for club selection, yardages and green reading.', 'Caddy terlatih untuk pemilihan stik, jarak, dan membaca green.')
                    : text('Our most experienced caddies, with deep knowledge of every green.', 'Caddy paling berpengalaman dengan pengetahuan mendalam tentang setiap green.')}
                </span>
                <span className="mt-5 text-sm tabular-nums text-[#C9A96E]">
                  {formatCurrency(option.pricePerPlayer)}
                  <span className="text-[#F6F2EA]/50"> / {text('player', 'pemain')}</span>
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
                ? text(`${pluralize(carts, 'cart')} reserved for ${pluralize(state.players, 'player')}`, `${carts} buggy disiapkan untuk ${state.players} pemain`)
                : text('Walking the course', 'Berjalan di lapangan')}
            </p>
            <p className="mt-1 text-sm text-[#F6F2EA]/60">{text(BUGGY.description, 'Buggy bersama untuk maksimal dua pemain, tersedia di area starter.')}</p>
            <p className="mt-3 text-sm tabular-nums text-[#C9A96E]">
              {formatCurrency(BUGGY.pricePerCart)}
              <span className="text-[#F6F2EA]/50"> / buggy</span>
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
          {text('Enhance Your Round', 'Lengkapi Ronde Anda')}
        </h2>
        <ul className="divide-y divide-[#C9A96E]/15 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03]">
          {EXTRAS.map((extra) => (
            <li
              key={extra.id}
              className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-base font-medium text-[#F6F2EA]">{({
                  rentalClubs: text('Rental Club Set', 'Sewa Set Stik Golf'),
                  rangeWarmup: text('Driving Range Warm-up', 'Pemanasan di Driving Range'),
                  halfwayOrder: text('Halfway House Pre-order', 'Pesan Makanan Halfway House'),
                })[extra.id]}</p>
                <p className="mt-1 text-sm text-[#F6F2EA]/60">{({
                  rentalClubs: text('Premium full set, waiting at the starter counter.', 'Set lengkap premium, tersedia di konter starter.'),
                  rangeWarmup: text('A bucket of balls before your tee time.', 'Satu keranjang bola sebelum tee time Anda.'),
                  halfwayOrder: text('Meal and drink prepared and ready when you reach the turn.', 'Makanan dan minuman disiapkan saat Anda mencapai halfway house.'),
                })[extra.id]}</p>
                <p className="mt-2 text-sm tabular-nums text-[#C9A96E]">
                  {formatCurrency(extra.unitPrice)}
                  <span className="text-[#F6F2EA]/50"> {extra.unitLabel === 'per set' ? text('per set', 'per set') : text('per player', 'per pemain')}</span>
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