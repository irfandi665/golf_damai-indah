import Navbar from '@/components/Navbar';
import BookingEngine from '@/components/booking/BookingEngine';

export const metadata = {
  title: 'Book Your Tee Time | Damai Indah Golf',
  description:
    'Choose your date, tee time, caddy and buggy, and see your complete price before you confirm.',
};

export default function BookingPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0F2A20] bg-[radial-gradient(ellipse_at_top_right,rgba(201,169,110,0.08),transparent_55%)]">
        <BookingEngine />
      </main>
    </>
  );
}