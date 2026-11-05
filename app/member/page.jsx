import Navbar from '@/components/Navbar';
import MemberDashboard from '@/components/member/MemberDashboard';

export const metadata = {
  title: 'Member Dashboard | Damai Indah Golf',
  description:
    'Your handicap, reservations, loyalty points and cashback in one private member dashboard.',
  robots: { index: false, follow: false },
};

// Lindungi route ini dengan autentikasi (middleware.js atau pengecekan sesi server-side)
// sebelum menghubungkan data member yang sebenarnya.
export default function MemberPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0F2A20] bg-[radial-gradient(ellipse_at_top_right,rgba(201,169,110,0.08),transparent_55%)]">
        <MemberDashboard />
      </main>
    </>
  );
}