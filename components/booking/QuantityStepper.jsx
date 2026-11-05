'use client';

export default function QuantityStepper({
  value,
  min = 0,
  max = 4,
  onChange,
  label,
  size = 'md',
}) {
  const large = size === 'lg';
  const buttonClass = `flex flex-none items-center justify-center rounded-full border border-[#C9A96E]/40 text-[#C9A96E] transition-colors duration-300 hover:bg-[#C9A96E] hover:text-[#0F2A20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-[#C9A96E] ${
    large ? 'h-12 w-12' : 'h-9 w-9'
  }`;

  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-4">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={value <= min}
        aria-label={`Kurangi: ${label}`}
        className={buttonClass}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M5 12h14" />
        </svg>
      </button>

      <output
        aria-live="polite"
        className={`min-w-[2ch] text-center font-[family-name:var(--font-heading)] font-semibold tabular-nums text-[#F6F2EA] ${
          large ? 'text-5xl' : 'text-xl'
        }`}
      >
        {value}
      </output>

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={value >= max}
        aria-label={`Tambah: ${label}`}
        className={buttonClass}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}