export default function Panel({ id, eyebrow, title, action, children, className = '' }) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className={`rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6 sm:p-8 ${className}`}
    >
      <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow && (
            <p className="text-[0.65rem] font-medium uppercase tracking-[0.35em] text-[#C9A96E]">
              {eyebrow}
            </p>
          )}
          <h2
            id={`${id}-heading`}
            className="mt-2 font-[family-name:var(--font-heading)] text-3xl font-medium text-[#F6F2EA]"
          >
            {title}
          </h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}