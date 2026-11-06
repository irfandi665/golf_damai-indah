'use client';

import { useMemo, useRef, useState } from 'react';
import {
  BOOKING_WINDOW_DAYS,
  addDays,
  addMonths,
  formatLongDate,
  fromDateKey,
  isPremiumDay,
  startOfDay,
  startOfMonth,
  toDateKey,
} from '@/lib/booking/utils';
import { useLocale } from '@/components/i18n/LocaleProvider';

const WEEKDAYS = { en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], id: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'] };

function ChevronIcon({ direction }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 ${direction === 'left' ? 'rotate-180' : ''}`}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default function DatePicker({ selectedKey, onSelect, today }) {
  const { locale, text } = useLocale();
  const monthFormat = new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', { month: 'long', year: 'numeric' });
  const { minDate, maxDate } = useMemo(() => {
    const min = startOfDay(today);
    return { minDate: min, maxDate: addDays(min, BOOKING_WINDOW_DAYS) };
  }, [today]);

  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(selectedKey ? fromDateKey(selectedKey) : minDate),
  );
  const gridRef = useRef(null);

  const todayKey = toDateKey(minDate);
  const canGoPrev = viewMonth > startOfMonth(minDate);
  const canGoNext = viewMonth < startOfMonth(maxDate);

  const { lead, items } = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const count = new Date(year, month + 1, 0).getDate();
    return {
      lead: (new Date(year, month, 1).getDay() + 6) % 7,
      items: Array.from({ length: count }, (_, index) => {
        const date = new Date(year, month, index + 1);
        const key = toDateKey(date);
        return {
          key,
          day: index + 1,
          disabled: date < minDate || date > maxDate,
          premium: isPremiumDay(key),
        };
      }),
    };
  }, [viewMonth, minDate, maxDate]);

  const focusKey = items.some((item) => item.key === selectedKey)
    ? selectedKey
    : items.find((item) => !item.disabled)?.key;

  const handleKeyDown = (event) => {
    const deltas = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const delta = deltas[event.key];
    if (!delta) return;

    const buttons = Array.from(gridRef.current.querySelectorAll('button[data-day]'));
    const currentIndex = buttons.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    event.preventDefault();
    buttons[currentIndex + delta]?.focus();
  };

  return (
    <div className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-5 sm:p-7">
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth((current) => addMonths(current, -1))}
          disabled={!canGoPrev}
          aria-label={text('Previous month', 'Bulan sebelumnya')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C9A96E]/30 text-[#C9A96E] transition-colors hover:border-[#C9A96E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ChevronIcon direction="left" />
        </button>

        <p
          aria-live="polite"
          className="font-[family-name:var(--font-heading)] text-2xl font-medium text-[#F6F2EA] sm:text-3xl"
        >
          {monthFormat.format(viewMonth)}
        </p>

        <button
          type="button"
          onClick={() => setViewMonth((current) => addMonths(current, 1))}
          disabled={!canGoNext}
          aria-label={text('Next month', 'Bulan berikutnya')}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C9A96E]/30 text-[#C9A96E] transition-colors hover:border-[#C9A96E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] disabled:cursor-not-allowed disabled:opacity-25"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 pb-3" aria-hidden="true">
        {WEEKDAYS[locale].map((weekday) => (
          <span
            key={weekday}
            className="text-center text-[0.65rem] font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/45"
          >
            {weekday}
          </span>
        ))}
      </div>

      <div
        ref={gridRef}
        role="group"
        aria-label={`${text('Choose a date', 'Pilih tanggal')}, ${monthFormat.format(viewMonth)}`}
        onKeyDown={handleKeyDown}
        className="grid grid-cols-7 gap-1"
      >
        {Array.from({ length: lead }, (_, index) => (
          <span key={`lead-${index}`} aria-hidden="true" />
        ))}

        {items.map((item) => {
          const selected = item.key === selectedKey;
          const isToday = item.key === todayKey;

          let stateClass = 'text-[#F6F2EA]/85 hover:bg-[#C9A96E]/15';
          if (item.disabled) stateClass = 'cursor-not-allowed text-[#F6F2EA]/20';
          if (selected) stateClass = 'bg-[#C9A96E] font-semibold text-[#0F2A20]';

          return (
            <button
              key={item.key}
              type="button"
              data-day
              tabIndex={item.key === focusKey ? 0 : -1}
              aria-disabled={item.disabled}
              aria-pressed={selected}
              aria-label={`${formatLongDate(item.key, locale)}${item.premium ? `, ${text('weekend or holiday rate', 'tarif akhir pekan atau hari libur')}` : ''}${
                item.disabled ? `, ${text('unavailable', 'tidak tersedia')}` : ''
              }`}
              onClick={() => {
                if (!item.disabled) onSelect(item.key);
              }}
              className={`relative flex aspect-square items-center justify-center rounded-full text-sm tabular-nums transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] ${stateClass} ${
                isToday && !selected ? 'ring-1 ring-[#C9A96E]/40' : ''
              }`}
            >
              {item.day}
              {item.premium && !item.disabled && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-1.5 h-1 w-1 rounded-full ${
                    selected ? 'bg-[#0F2A20]' : 'bg-[#C9A96E]'
                  }`}
                />
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-5 flex items-center gap-2 text-xs text-[#F6F2EA]/55">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#C9A96E]" />
        {text(`Weekend and holiday rates apply. Booking opens ${BOOKING_WINDOW_DAYS} days ahead.`, `Tarif akhir pekan dan hari libur berlaku. Booking dibuka ${BOOKING_WINDOW_DAYS} hari sebelumnya.`)}
      </p>
    </div>
  );
}