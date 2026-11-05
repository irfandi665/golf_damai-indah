'use client';

import DatePicker from './DatePicker';
import QuantityStepper from './QuantityStepper';
import TimeSlotGrid from './TimeSlotGrid';
import { MAX_PLAYERS, MIN_PLAYERS, formatLongDate } from '@/lib/booking/utils';

function Block({ index, title, hint, children }) {
  return (
    <section aria-labelledby={`block-${index}`}>
      <div className="mb-5 flex items-baseline gap-4">
        <span aria-hidden="true" className="font-[family-name:var(--font-heading)] text-3xl text-[#C9A96E]/50">
          {index}
        </span>
        <div>
          <h2
            id={`block-${index}`}
            className="font-[family-name:var(--font-heading)] text-3xl font-medium text-[#F6F2EA]"
          >
            {title}
          </h2>
          {hint && <p className="mt-1 text-sm text-[#F6F2EA]/55">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

export default function StepSchedule({ state, dispatch, now }) {
  return (
    <div className="space-y-14">
      <Block index="01" title="Players" hint="One flight, up to four players per tee time.">
        <div className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6 sm:p-8">
          <QuantityStepper
            size="lg"
            label="Jumlah pemain"
            value={state.players}
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            onChange={(players) => dispatch({ type: 'SET_PLAYERS', players })}
          />
        </div>
      </Block>

      <Block index="02" title="Date">
        <DatePicker
          today={now}
          selectedKey={state.dateKey}
          onSelect={(dateKey) => dispatch({ type: 'SELECT_DATE', dateKey })}
        />
      </Block>

      <Block
        index="03"
        title="Tee Time"
        hint={state.dateKey ? formatLongDate(state.dateKey) : undefined}
      >
        {state.notice && (
          <p
            role="status"
            className="mb-5 rounded-xl border border-amber-300/30 bg-amber-300/10 px-5 py-4 text-sm text-amber-100"
          >
            {state.notice}
          </p>
        )}

        {state.dateKey ? (
          <TimeSlotGrid
            dateKey={state.dateKey}
            players={state.players}
            now={now}
            selectedTime={state.slot?.time ?? null}
            onSelect={(slot) => dispatch({ type: 'SELECT_SLOT', slot })}
          />
        ) : (
          <p className="rounded-2xl border border-dashed border-[#C9A96E]/25 px-6 py-10 text-center text-sm text-[#F6F2EA]/55">
            Choose a date to see live availability and pricing for every tee time.
          </p>
        )}
      </Block>
    </div>
  );
}