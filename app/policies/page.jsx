import Link from 'next/link';
import PublicPageShell from '@/components/public/PublicPageShell';
import { BOOKING_LEAD_MINUTES, BOOKING_WINDOW_DAYS } from '@/lib/booking/utils';

export const metadata = {
  title: 'Booking Policies | Damai Indah Golf',
  description: 'Booking, cancellation, no-show and payment policies for tee-time reservations.',
};

const policies = [
  {
    title: 'Reservations',
    body: `Tee times can be reserved up to ${BOOKING_WINDOW_DAYS} days ahead and at least ${BOOKING_LEAD_MINUTES} minutes before play, subject to availability. A confirmation reference means the reservation is confirmed; it does not mean payment has been made.`,
  },
  {
    title: 'Cancellation',
    body: 'Cancel at least 24 hours before the tee time for a free cancellation. Later cancellations are marked as late. A rain-check voucher for the green fee is issued automatically only when the booking belongs to a member account; guest reservations do not receive an automatic voucher. Contact the club for help or questions about a specific booking.',
  },
  {
    title: 'No-show',
    body: 'No-show handling and any related fee or penalty are not currently configured on this website. Please contact the club before booking if you need to confirm the applicable no-show policy.',
  },
  {
    title: 'Payment',
    body: 'Payment for the reservation and selected services is made at the club. This website does not collect, authorize, or confirm payments. The displayed total is an estimate based on the rates currently configured for the website.',
  },
];

export default function BookingPoliciesPage() {
  return (
    <PublicPageShell
      eyebrow="Before you book"
      title="Booking policies"
      description="Please review these reservation terms. The club should confirm any policy not yet configured on this website."
    >
      <div className="max-w-3xl space-y-5">
        {policies.map(({ title, body }) => (
          <section key={title} className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6 sm:p-8">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#F6F2EA]">{title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#F6F2EA]/65">{body}</p>
          </section>
        ))}
        <p className="text-sm text-[#F6F2EA]/55">
          Need assistance? Visit the <Link href="/contact" className="text-[#C9A96E] underline underline-offset-4">contact page</Link>.
        </p>
      </div>
    </PublicPageShell>
  );
}
