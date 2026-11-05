'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchTeeTimes } from '@/lib/booking/engine';
import WaitlistJoinForm from './WaitlistJoinForm';
import {
  DAY_PARTS,
  TIER_LABELS,
  formatCompactCurrency,
  getDayPart,
  isSlotClosed,
  pluralize,
} from '@/lib/booking/utils';

function SlotSkeleton() {
  return (
    <div aria-hidden="true" className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 15 }, (_, index) => (
        <div key={index} className="h-[5.5rem] animate-pulse rounded-xl bg-white/[0.05]" />
      ))}
    </div>
  );
}

export default function TimeSlotGrid({ dateKey, players, selectedTime, onSelect, now }) {
  const [reloadToken, setReloadToken] = useState(0);
  const [fetchState, setFetchState] = useState({ status: 'loading', slots: [] });
  const [selecting, setSelecting] = useState(false);
  const [selectionError, setSelectionError] = useState(null);
  const [waitlistSlot, setWaitlistSlot] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setFetchState({ status: 'loading', slots: [] });

    fetchTeeTimes(dateKey, { signal: controller.signal, players })
      .then((slots) => setFetchState({ status: 'ready', slots }))
      .catch((error) => {
        if (error.name !== 'AbortError') setFetchState({ status: 'error', slots: [] });
      });

    return () => controller.abort();
  }, [dateKey, players, reloadToken]);

  const bookableCount = useMemo(
    () =>
      fetchState.slots.filter(
        (slot) => slot.spotsLeft >= players && !isSlotClosed(dateKey, slot.time, now),
      ).length,
    [fetchState.slots, players, dateKey, now],
  );

  const groups = useMemo(() => {
    const buckets = new Map(DAY_PARTS.map((part) => [part.id, []]));
    fetchState.slots.forEach((slot) => buckets.get(getDayPart(slot.time)).push(slot));
    return DAY_PARTS.map((part) => ({ ...part, slots: buckets.get(part.id) })).filter(
      (group) => group.slots.length > 0,
    );
  }, [fetchState.slots]);

  if (fetchState.status === 'loading') {
    return (
      <div aria-busy="true">
        <p className="sr-only" role="status">Memuat jadwal tee time…</p>
        <SlotSkeleton />
      </div>
    );
  }

  if (fetchState.status === 'error') {
    return (
      <div role="alert" className="rounded-2xl border border-red-300/30 bg-red-950/20 p-6">
        <p className="text-sm text-[#F6F2EA]/85">
          We could not load tee times for this date. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={() => setReloadToken((value) => value + 1)}
          className="mt-4 rounded-full border border-[#C9A96E] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#C9A96E] transition-colors hover:bg-[#C9A96E] hover:text-[#0F2A20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E]"
        >
          Try Again
        </button>
      </div>
    );
  }

  const selectSlot = async (slot) => {
    setSelecting(true);
    setSelectionError(null);
    try {
      await onSelect(slot);
    } catch (error) {
      setSelectionError(error.message);
    } finally {
      setSelecting(false);
    }
  };

  return (
    <div>
      {selectionError && (
        <p role="alert" className="mb-5 rounded-xl border border-red-300/30 bg-red-950/20 px-5 py-4 text-sm text-red-200">
          {selectionError}
        </p>
      )}
      <p role="status" className="mb-6 text-sm text-[#F6F2EA]/60">
        {bookableCount > 0
          ? `${pluralize(bookableCount, 'tee time')} available for ${pluralize(players, 'player')}.`
          : `No tee times fit a group of ${players} on this date. Try another date or a smaller group.`}
      </p>

      <div className="space-y-8">
        {groups.map((group) => (
          <div key={group.id}>
            <h3 className="mb-3 text-[0.7rem] font-medium uppercase tracking-[0.35em] text-[#C9A96E]">
              {group.label}
            </h3>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 xl:grid-cols-5">
              {group.slots.map((slot) => {
                const closed = slot.status === 'blocked' || slot.status === 'closed' || isSlotClosed(dateKey, slot.time, now);
                const fits = slot.status !== 'full' && slot.spotsLeft >= players;
                const disabled = closed || !fits;
                const selected = selectedTime === slot.time;
                const waitlistEligible = !closed && (slot.status === 'full' || slot.spotsLeft < players);

                let caption = formatCompactCurrency(slot.pricePerPlayer);
                if (closed) caption = 'Closed';
                else if (slot.spotsLeft === 0) caption = 'Full';
                else if (!fits) caption = `${slot.spotsLeft} left`;

                const hint =
                  !disabled && slot.spotsLeft <= 2
                    ? `Only ${slot.spotsLeft} left`
                    : !disabled
                      ? TIER_LABELS[slot.tier]
                      : '';

                let stateClass =
                  'border-[#C9A96E]/25 text-[#F6F2EA] hover:border-[#C9A96E] hover:bg-[#C9A96E]/10';
                if (disabled) {
                  stateClass = 'cursor-not-allowed border-white/5 bg-white/[0.02] text-[#F6F2EA]/25';
                }
                if (selected) {
                  stateClass = 'border-[#C9A96E] bg-[#C9A96E] text-[#0F2A20] shadow-[0_10px_30px_-10px_rgba(201,169,110,0.7)]';
                }

                return (
                  <div key={slot.time} className="min-w-0">
                    <button
                      type="button"
                      disabled={disabled || selecting}
                      aria-pressed={selected}
                      aria-label={`${slot.time}, ${caption}${hint ? `, ${hint}` : ''}`}
                      onClick={() => selectSlot(slot)}
                      className={`flex min-h-[5.5rem] w-full flex-col items-center justify-center rounded-xl border px-2 py-3 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20] ${stateClass}`}
                    >
                      <span className="font-[family-name:var(--font-heading)] text-2xl font-semibold tabular-nums leading-none">
                        {slot.time}
                      </span>
                      <span className="mt-1.5 text-xs tabular-nums opacity-80">{caption}</span>
                      <span
                        className={`mt-1 min-h-[0.9rem] text-[0.6rem] font-semibold uppercase tracking-[0.15em] ${
                          selected ? 'text-[#0F2A20]/70' : slot.spotsLeft <= 2 ? 'text-amber-300' : 'text-[#C9A96E]'
                        }`}
                      >
                        {hint}
                      </span>
                    </button>
                    {waitlistEligible && (
                      <button
                        type="button"
                        onClick={() => setWaitlistSlot(slot)}
                        className="mt-2 w-full text-center text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#C9A96E] underline underline-offset-4 hover:text-[#F6F2EA]"
                      >
                        Join waitlist
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {waitlistSlot && group.slots.some((slot) => slot.slotId === waitlistSlot.slotId) && (
              <WaitlistJoinForm
                slot={waitlistSlot}
                dateKey={dateKey}
                players={players}
                onClose={() => setWaitlistSlot(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}