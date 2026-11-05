import Navbar from '@/components/Navbar';

export default function PublicPageShell({ eyebrow, title, description, children }) {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0F2A20] text-[#F6F2EA]">
        <header className="border-b border-[#C9A96E]/15 bg-[radial-gradient(ellipse_at_top_right,rgba(201,169,110,0.12),transparent_55%)] px-6 pb-14 pt-36 lg:px-10 lg:pb-20 lg:pt-44">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-medium uppercase tracking-[0.35em] text-[#C9A96E]">{eyebrow}</p>
            <h1 className="mt-4 max-w-4xl font-[family-name:var(--font-heading)] text-5xl font-medium leading-tight sm:text-6xl lg:text-7xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#F6F2EA]/65 sm:text-lg">{description}</p>
          </div>
        </header>
        <div className="mx-auto max-w-7xl px-6 py-12 lg:px-10 lg:py-16">{children}</div>
      </main>
    </>
  );
}
