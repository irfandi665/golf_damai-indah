import PublicPageShell from '@/components/public/PublicPageShell';
import InquiryForm from '@/components/public/InquiryForm';
import LanguageText from '@/components/i18n/LanguageText';

export const metadata = {
  title: 'Golf Academy | Damai Indah Golf',
  description: 'Ask about golf lessons, coaching programs and academy availability.',
};

export default function AcademyPage() {
  return (
    <PublicPageShell
      eyebrow={{ en: 'Improve your game', id: 'Tingkatkan permainan Anda' }}
      title="Golf Academy"
      description={{ en: 'Tell us what you would like to work on and the club team can share current lesson availability.', id: 'Ceritakan kemampuan yang ingin Anda kembangkan dan tim klub akan berbagi informasi ketersediaan les.' }}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-5">
          {[
            ['Private coaching', 'Ask about individual instruction and availability.', 'Pelatihan privat', 'Tanyakan ketersediaan dan informasi pelatihan individual.'],
            ['Group programs', 'Group programs and participant limits will be published when confirmed.', 'Program grup', 'Program grup dan batas jumlah peserta akan dipublikasikan setelah dikonfirmasi.'],
            ['Junior golf', 'Contact the club for age requirements, schedules and guardian information.', 'Golf junior', 'Hubungi klub untuk mengetahui batas usia, jadwal, dan informasi wali.'],
          ].map(([title, description, titleId, descriptionId]) => (
            <article key={title} className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl"><LanguageText en={title} id={titleId} /></h2>
              <p className="mt-2 text-sm leading-relaxed text-[#F6F2EA]/60"><LanguageText en={description} id={descriptionId} /></p>
            </article>
          ))}
          <p className="text-xs leading-relaxed text-[#F6F2EA]/45"><LanguageText en="Instructor names, lesson rates and class times are not yet published. Inquiry submission requests information only; it does not reserve a lesson or take payment." id="Nama instruktur, tarif les, dan jadwal kelas belum dipublikasikan. Formulir ini hanya meminta informasi; tidak memesan sesi atau menerima pembayaran." /></p>
        </section>
        <InquiryForm type="academy" title="Lesson inquiry / Pertanyaan les" />
      </div>
    </PublicPageShell>
  );
}
