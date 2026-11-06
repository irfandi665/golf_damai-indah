import Link from 'next/link';
import PublicPageShell from '@/components/public/PublicPageShell';
import { BOOKING_LEAD_MINUTES, BOOKING_WINDOW_DAYS } from '@/lib/booking/utils';
import LanguageText from '@/components/i18n/LanguageText';

export const metadata = {
  title: 'Booking Policies | Damai Indah Golf',
  description: 'Booking, cancellation, no-show and payment policies for tee-time reservations.',
};

const policies = [
  {
    title: 'Reservations',
    body: `Tee times can be reserved up to ${BOOKING_WINDOW_DAYS} days ahead and at least ${BOOKING_LEAD_MINUTES} minutes before play, subject to availability. A confirmation reference means the reservation is confirmed; it does not mean payment has been made.`,
    bodyId: `Tee time dapat dipesan hingga ${BOOKING_WINDOW_DAYS} hari sebelumnya dan paling lambat ${BOOKING_LEAD_MINUTES} menit sebelum bermain, bergantung pada ketersediaan. Nomor konfirmasi berarti reservasi telah dikonfirmasi, bukan bukti pembayaran.`,
  },
  {
    title: 'Cancellation',
    body: 'Cancel at least 24 hours before the tee time for a free cancellation. Later cancellations are marked as late. A rain-check voucher for the green fee is issued automatically only when the booking belongs to a member account; guest reservations do not receive an automatic voucher. Contact the club for help or questions about a specific booking.',
    bodyId: 'Batalkan minimal 24 jam sebelum Tee Time untuk pembatalan gratis. Pembatalan setelahnya ditandai terlambat. Voucher rain-check green fee hanya diterbitkan otomatis untuk booking akun member; reservasi tamu tidak menerima voucher otomatis. Hubungi klub jika memerlukan bantuan terkait booking tertentu.',
  },
  {
    title: 'No-show',
    body: 'No-show handling and any related fee or penalty are not currently configured on this website. Please contact the club before booking if you need to confirm the applicable no-show policy.',
    bodyId: 'Penanganan no-show dan biaya atau penalti terkait belum dikonfigurasi pada website ini. Hubungi klub sebelum booking untuk mengonfirmasi kebijakan no-show yang berlaku.',
  },
  {
    title: 'Payment',
    body: 'Payment for the reservation and selected services is made at the club. This website does not collect, authorize, or confirm payments. The displayed total is an estimate based on the rates currently configured for the website.',
    bodyId: 'Pembayaran reservasi dan layanan pilihan dilakukan di klub. Website ini tidak menerima, mengotorisasi, atau mengonfirmasi pembayaran. Total yang ditampilkan merupakan estimasi berdasarkan tarif yang sedang dikonfigurasi.',
  },
];

export default function BookingPoliciesPage() {
  return (
    <PublicPageShell
      eyebrow={{ en: 'Before you book', id: 'Sebelum booking' }}
      title={{ en: 'Booking policies', id: 'Kebijakan booking' }}
      description={{ en: 'Please review these reservation terms. The club should confirm any policy not yet configured on this website.', id: 'Tinjau ketentuan reservasi ini. Konfirmasikan kepada klub jika ada kebijakan yang belum dikonfigurasi di website.' }}
    >
      <div className="max-w-3xl space-y-5">
        {policies.map(({ title, body, bodyId }) => (
          <section key={title} className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6 sm:p-8">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl text-[#F6F2EA]"><LanguageText en={title} id={({ Reservations: 'Reservasi', Cancellation: 'Pembatalan', 'No-show': 'No-show', Payment: 'Pembayaran' })[title]} /></h2>
            <p className="mt-3 text-sm leading-relaxed text-[#F6F2EA]/65"><LanguageText en={body} id={bodyId} /></p>
          </section>
        ))}
        <p className="text-sm text-[#F6F2EA]/55">
          <LanguageText en="Need assistance? Visit the" id="Perlu bantuan? Kunjungi" /> <Link href="/contact" className="text-[#C9A96E] underline underline-offset-4"><LanguageText en="contact page" id="halaman kontak" /></Link>.
        </p>
      </div>
    </PublicPageShell>
  );
}
