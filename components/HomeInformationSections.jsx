import Link from 'next/link';
import CourseStatus from '@/components/public/CourseStatus';

const linkClass = 'inline-flex min-h-11 items-center rounded-full border border-[#C9A96E]/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#C9A96E] transition-colors hover:bg-[#C9A96E] hover:text-[#0F2A20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20]';

const bookingSteps = [
  {
    number: '01',
    title: 'Choose a tee time',
    translation: 'Pilih tee time',
    detail: 'Select a date and see the tee-time options available for your party.',
    detailId: 'Pilih tanggal dan lihat pilihan tee time yang tersedia untuk grup Anda.',
  },
  {
    number: '02',
    title: 'Review your reservation',
    translation: 'Tinjau reservasi',
    detail: 'Review the server-calculated quote and the services selected before confirming.',
    detailId: 'Tinjau rincian harga dari server dan layanan yang dipilih sebelum konfirmasi.',
  },
  {
    number: '03',
    title: 'Pay at the club',
    translation: 'Bayar di klub',
    detail: 'Your online booking is a reservation. Payment is completed at the club.',
    detailId: 'Booking online merupakan reservasi. Pembayaran diselesaikan di klub.',
  },
];

const inquiries = [
  {
    eyebrow: 'Academy / Akademi',
    title: 'Ask about lessons',
    titleId: 'Tanyakan program latihan',
    detail: 'Send an inquiry to ask about current lesson information and availability.',
    detailId: 'Kirim inquiry untuk menanyakan informasi dan ketersediaan latihan.',
    notice: 'An inquiry does not reserve a lesson.',
    noticeId: 'Inquiry tidak memesan sesi latihan.',
    href: '/academy',
    link: 'Academy inquiry / Inquiry Akademi',
  },
  {
    eyebrow: 'Events / Acara',
    title: 'Ask about club events',
    titleId: 'Tanyakan acara klub',
    detail: 'Contact the club team for event information. Published dates will appear on the events page.',
    detailId: 'Hubungi tim klub untuk informasi acara. Jadwal yang telah dipublikasikan akan tampil di halaman acara.',
    notice: 'An inquiry is not an event registration.',
    noticeId: 'Inquiry bukan pendaftaran acara.',
    href: '/events',
    link: 'Events inquiry / Inquiry Acara',
  },
];

export default function HomeInformationSections() {
  return (
    <>
      <section aria-labelledby="booking-steps-title" className="bg-[#F6F2EA] py-20 text-[#1B1B1B] sm:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#8a6d35]">
              <span lang="en">A clear reservation flow</span>
              <span aria-hidden="true"> / </span>
              <span lang="id">Alur reservasi yang jelas</span>
            </p>
            <h2 id="booking-steps-title" className="mt-5 font-[family-name:var(--font-heading)] text-4xl font-medium leading-tight text-[#0F2A20] sm:text-5xl">
              <span lang="en">Plan before you play</span>
              <span lang="id" className="mt-2 block text-[0.72em] italic">Rencanakan sebelum bermain</span>
            </h2>
          </div>
          <ol className="mt-12 grid gap-5 md:grid-cols-3">
            {bookingSteps.map((step) => (
              <li key={step.number} className="rounded-2xl border border-[#0F2A20]/10 bg-white p-6 sm:p-8">
                <p className="font-[family-name:var(--font-heading)] text-4xl text-[#8a6d35]">{step.number}</p>
                <h3 className="mt-5 text-lg font-semibold text-[#0F2A20]">
                  <span lang="en">{step.title}</span>
                  <span aria-hidden="true"> / </span>
                  <span lang="id">{step.translation}</span>
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#1B1B1B]/70" lang="en">{step.detail}</p>
                <p className="mt-2 text-sm leading-relaxed text-[#1B1B1B]/70" lang="id">{step.detailId}</p>
              </li>
            ))}
          </ol>
          <Link href="/booking" className="mt-9 inline-flex min-h-11 items-center rounded-full bg-[#0F2A20] px-6 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#F6F2EA] transition-colors hover:bg-[#1d4a37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] focus-visible:ring-offset-2">
            <span lang="en">Start a reservation</span>
            <span aria-hidden="true"> / </span>
            <span lang="id">Mulai reservasi</span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="course-updates-title" className="bg-[#0F2A20] py-16 sm:py-20">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-10">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#C9A96E]">
              <span lang="en">Before your visit</span>
              <span aria-hidden="true"> / </span>
              <span lang="id">Sebelum berkunjung</span>
            </p>
            <h2 id="course-updates-title" className="mt-5 font-[family-name:var(--font-heading)] text-4xl font-medium leading-tight text-[#F6F2EA] sm:text-5xl">
              <span lang="en">Check club updates</span>
              <span lang="id" className="mt-2 block text-[0.72em] italic text-[#C9A96E]">Lihat update klub</span>
            </h2>
            <p lang="en" className="mt-5 max-w-xl text-sm leading-relaxed text-[#F6F2EA]/65">
              Published club updates appear here when available. For same-day weather or visit details, confirm with the club.
            </p>
            <p lang="id" className="mt-2 max-w-xl text-sm leading-relaxed text-[#F6F2EA]/65">
              Update klub yang telah dipublikasikan ditampilkan di sini bila tersedia. Untuk cuaca hari ini atau detail kunjungan, konfirmasikan langsung kepada klub.
            </p>
          </div>
          <CourseStatus bilingual />
        </div>
      </section>

      <section aria-labelledby="inquiry-title" className="bg-[#F6F2EA] py-20 text-[#1B1B1B] sm:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#8a6d35]">
              <span lang="en">More from the club</span>
              <span aria-hidden="true"> / </span>
              <span lang="id">Informasi dari klub</span>
            </p>
            <h2 id="inquiry-title" className="mt-5 font-[family-name:var(--font-heading)] text-4xl font-medium leading-tight text-[#0F2A20] sm:text-5xl">
              <span lang="en">Ask us what is available</span>
              <span lang="id" className="mt-2 block text-[0.72em] italic">Tanyakan layanan yang tersedia</span>
            </h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {inquiries.map((item) => (
              <article key={item.href} className="rounded-2xl border border-[#0F2A20]/10 bg-white p-6 sm:p-8">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#8a6d35]">{item.eyebrow}</p>
                <h3 className="mt-4 font-[family-name:var(--font-heading)] text-3xl font-semibold text-[#0F2A20]">
                  <span lang="en">{item.title}</span>
                  <span aria-hidden="true"> / </span>
                  <span lang="id">{item.titleId}</span>
                </h3>
                <p lang="en" className="mt-3 text-sm leading-relaxed text-[#1B1B1B]/70">{item.detail}</p>
                <p lang="id" className="mt-2 text-sm leading-relaxed text-[#1B1B1B]/70">{item.detailId}</p>
                <p className="mt-4 text-xs text-[#8a6d35]">
                  <span lang="en">{item.notice}</span>
                  <span aria-hidden="true"> / </span>
                  <span lang="id">{item.noticeId}</span>
                </p>
                <Link href={item.href} className={`${linkClass} mt-6`}>
                  {item.link}
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="closing-cta-title" className="bg-[#0F2A20] py-20 text-center sm:py-28">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#C9A96E]">
            <span lang="en">Your next round starts here</span>
            <span aria-hidden="true"> / </span>
            <span lang="id">Ronde berikutnya dimulai di sini</span>
          </p>
          <h2 id="closing-cta-title" className="mt-5 font-[family-name:var(--font-heading)] text-4xl font-medium leading-tight text-[#F6F2EA] sm:text-6xl">
            <span lang="en">Make your reservation</span>
            <span lang="id" className="mt-2 block text-[0.72em] italic text-[#C9A96E]">Buat reservasi Anda</span>
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-[#F6F2EA]/70">
            <span lang="en">Choose a tee time online. Payment is made at the club.</span>
            <span lang="id" className="mt-2 block">Pilih tee time secara online. Pembayaran dilakukan di klub.</span>
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/booking" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#C9A96E] px-7 py-3 text-xs font-semibold uppercase tracking-[0.15em] text-[#0F2A20] transition-colors hover:bg-[#d8bb84] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2EA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20]">
              Book a Tee Time / Pesan Tee Time
            </Link>
            <Link href="/member" className={linkClass}>
              Member Portal / Portal Member
            </Link>
            <Link href="/contact" className={linkClass}>
              Contact the Club / Hubungi Klub
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
