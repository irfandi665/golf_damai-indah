import PublicPageShell from '@/components/public/PublicPageShell';
import InquiryForm from '@/components/public/InquiryForm';

export const metadata = {
  title: 'Tournaments & Events | Damai Indah Golf',
  description: 'Club tournament announcements, event registration enquiries and results.',
};

export default function EventsPage() {
  return (
    <PublicPageShell
      eyebrow="Club calendar"
      title="Tournaments & events"
      description="Find upcoming club events and ask our team about participation."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-7">
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]">Calendar</p>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl">No events published yet</h2>
          <p className="mt-4 text-sm leading-relaxed text-[#F6F2EA]/60">
            Event dates, registration rules, entry fees and results will appear here after the club publishes them. Submit an inquiry to register your interest; this form is not an event entry or confirmed reservation.
          </p>
        </section>
        <InquiryForm type="event" title="Event interest" />
      </div>
    </PublicPageShell>
  );
}
