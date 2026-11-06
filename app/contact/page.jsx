import PublicPageShell from '@/components/public/PublicPageShell';
import InquiryForm from '@/components/public/InquiryForm';
import Link from 'next/link';
import LanguageText from '@/components/i18n/LanguageText';

export const metadata = {
  title: 'Location & Contact | Damai Indah Golf',
  description: 'Contact the club for directions, hours, accessibility and frequently asked questions.',
};

const questions = [
  ['How do I book a tee time?', 'Use the online booking page to choose a date, tee time and services. The booking is a reservation; payment is made at the club.', 'Bagaimana cara memesan tee time?', 'Gunakan halaman booking online untuk memilih tanggal, tee time, dan layanan. Booking merupakan reservasi; pembayaran dilakukan di klub.'],
  ['When are you open?', 'Operating hours have not yet been confirmed for this website. Please ask the club before travelling.', 'Kapan klub buka?', 'Jam operasional belum dikonfirmasi untuk website ini. Tanyakan kepada klub sebelum berkunjung.'],
  ['Where is the club and how do I get there?', 'The verified street address and map link have not yet been configured. Contact the club team for directions.', 'Di mana lokasi klub dan bagaimana cara menuju ke sana?', 'Alamat jalan dan tautan peta terverifikasi belum dikonfigurasi. Hubungi tim klub untuk petunjuk arah.'],
  ['Can I change my booking?', 'Upcoming reservations can be viewed and cancellation eligibility is shown in the member dashboard. See the booking policies for cancellation and no-show information.', 'Bisakah saya mengubah booking?', 'Reservasi mendatang dapat dilihat dan kelayakan pembatalan tersedia di dashboard member. Lihat kebijakan booking untuk informasi pembatalan dan no-show.'],
];

export default function ContactPage() {
  return (
    <PublicPageShell
      eyebrow={{ en: 'Plan your visit', id: 'Rencanakan kunjungan' }}
      title={{ en: 'Location, contact & FAQs', id: 'Lokasi, kontak & FAQ' }}
      description={{ en: 'For same-day conditions, accessibility and directions, confirm details with the club before travelling.', id: 'Konfirmasikan kondisi hari ini, aksesibilitas, dan petunjuk arah kepada klub sebelum perjalanan.' }}
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-8">
          <section className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-7">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]"><LanguageText en="Visit us" id="Kunjungi kami" /></p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl"><LanguageText en="Contact details pending verification" id="Detail kontak menunggu verifikasi" /></h2>
            <p className="mt-4 text-sm leading-relaxed text-[#F6F2EA]/60"><LanguageText en="A verified postal address, telephone number, email address, operating hours and map destination have not yet been configured for this website." id="Alamat, nomor telepon, alamat email, jam operasional, dan lokasi peta terverifikasi belum dikonfigurasi untuk website ini." /></p>
            <p className="mt-4 rounded-xl border border-amber-200/20 bg-amber-950/20 p-4 text-sm text-amber-100"><LanguageText en="Please do not rely on this page for directions until the club publishes its verified location details." id="Jangan gunakan halaman ini sebagai petunjuk arah sebelum klub mempublikasikan detail lokasi terverifikasi." /></p>
          </section>
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-3xl"><LanguageText en="Frequently asked questions" id="Pertanyaan yang sering diajukan" /></h2>
            <div className="space-y-3">
              {questions.map(([question, answer, questionId, answerId]) => (
                <details key={question} className="rounded-xl border border-[#C9A96E]/15 bg-white/[0.025] p-5">
                  <summary className="cursor-pointer text-sm font-medium text-[#F6F2EA]"><LanguageText en={question} id={questionId} /></summary>
                  <p className="mt-3 text-sm leading-relaxed text-[#F6F2EA]/55"><LanguageText en={answer} id={answerId} /></p>
                </details>
              ))}
            </div>
          </section>
          <Link href="/policies" className="text-sm text-[#C9A96E] underline underline-offset-4">
            <LanguageText en="Read booking policies" id="Baca kebijakan booking" />
          </Link>
        </div>
        <InquiryForm type="contact" title="Send a message / Kirim pesan" />
      </div>
    </PublicPageShell>
  );
}
