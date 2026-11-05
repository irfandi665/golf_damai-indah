import PublicPageShell from '@/components/public/PublicPageShell';
import InquiryForm from '@/components/public/InquiryForm';

export const metadata = {
  title: 'Golf Academy | Damai Indah Golf',
  description: 'Ask about golf lessons, coaching programs and academy availability.',
};

export default function AcademyPage() {
  return (
    <PublicPageShell
      eyebrow="Improve your game"
      title="Golf Academy"
      description="Tell us what you would like to work on and the club team can share current lesson availability."
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <section className="space-y-5">
          {[
            ['Private coaching', 'Ask about individual instruction and availability.'],
            ['Group programs', 'Group programs and participant limits will be published when confirmed.'],
            ['Junior golf', 'Contact the club for age requirements, schedules and guardian information.'],
          ].map(([title, description]) => (
            <article key={title} className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl">{title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-[#F6F2EA]/60">{description}</p>
            </article>
          ))}
          <p className="text-xs leading-relaxed text-[#F6F2EA]/45">Instructor names, lesson rates and class times are not yet published. Inquiry submission requests information only; it does not reserve a lesson or take payment.</p>
        </section>
        <InquiryForm type="academy" title="Lesson inquiry" />
      </div>
    </PublicPageShell>
  );
}
