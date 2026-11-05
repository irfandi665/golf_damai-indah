import PublicPageShell from '@/components/public/PublicPageShell';
import InquiryForm from '@/components/public/InquiryForm';
import Link from 'next/link';

export const metadata = {
  title: 'Location & Contact | Damai Indah Golf',
  description: 'Contact the club for directions, hours, accessibility and frequently asked questions.',
};

const questions = [
  ['How do I book a tee time?', 'Use the online booking page to choose a date, tee time and services. The booking is a reservation; payment is made at the club.'],
  ['When are you open?', 'Operating hours have not yet been confirmed for this website. Please ask the club before travelling.'],
  ['Where is the club and how do I get there?', 'The verified street address and map link have not yet been configured. Contact the club team for directions.'],
  ['Can I change my booking?', 'Upcoming reservations can be viewed and cancellation eligibility is shown in the member dashboard. See the booking policies for cancellation and no-show information.'],
];

export default function ContactPage() {
  return (
    <PublicPageShell
      eyebrow="Plan your visit"
      title="Location, contact & FAQs"
      description="For same-day conditions, accessibility and directions, confirm details with the club before travelling."
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="space-y-8">
          <section className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-7">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]">Visit us</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl">Contact details pending verification</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#F6F2EA]/60">A verified postal address, telephone number, email address, operating hours and map destination have not yet been configured for this website.</p>
            <p className="mt-4 rounded-xl border border-amber-200/20 bg-amber-950/20 p-4 text-sm text-amber-100">Please do not rely on this page for directions until the club publishes its verified location details.</p>
          </section>
          <section>
            <h2 className="mb-4 font-[family-name:var(--font-heading)] text-3xl">Frequently asked questions</h2>
            <div className="space-y-3">
              {questions.map(([question, answer]) => (
                <details key={question} className="rounded-xl border border-[#C9A96E]/15 bg-white/[0.025] p-5">
                  <summary className="cursor-pointer text-sm font-medium text-[#F6F2EA]">{question}</summary>
                  <p className="mt-3 text-sm leading-relaxed text-[#F6F2EA]/55">{answer}</p>
                </details>
              ))}
            </div>
          </section>
          <Link href="/policies" className="text-sm text-[#C9A96E] underline underline-offset-4">
            Read booking policies
          </Link>
        </div>
        <InquiryForm type="contact" title="Send a message" />
      </div>
    </PublicPageShell>
  );
}
