import PublicPageShell from '@/components/public/PublicPageShell';
import InquiryForm from '@/components/public/InquiryForm';
import LanguageText from '@/components/i18n/LanguageText';

export const metadata = {
  title: 'Tournaments & Events | Damai Indah Golf',
  description: 'Club tournament announcements, event registration enquiries and results.',
};

export default function EventsPage() {
  return (
    <PublicPageShell
      eyebrow={{ en: 'Club calendar', id: 'Kalender klub' }}
      title={{ en: 'Tournaments & events', id: 'Turnamen & acara' }}
      description={{ en: 'Find upcoming club events and ask our team about participation.', id: 'Lihat acara klub mendatang dan hubungi tim kami untuk informasi keikutsertaan.' }}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-7">
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]"><LanguageText en="Calendar" id="Kalender" /></p>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl"><LanguageText en="No events published yet" id="Belum ada acara yang dipublikasikan" /></h2>
          <p className="mt-4 text-sm leading-relaxed text-[#F6F2EA]/60">
            <LanguageText
              en="Event dates, registration rules, entry fees and results will appear here after the club publishes them. Submit an inquiry to register your interest; this form is not an event entry or confirmed reservation."
              id="Tanggal acara, aturan pendaftaran, biaya masuk, dan hasil akan ditampilkan setelah dipublikasikan klub. Kirim pertanyaan untuk menyampaikan minat; formulir ini bukan pendaftaran acara atau reservasi yang dikonfirmasi."
            />
          </p>
        </section>
        <InquiryForm type="event" title="Event interest / Minat acara" />
      </div>
    </PublicPageShell>
  );
}
