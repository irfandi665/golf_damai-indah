import Navbar from '@/components/Navbar';
import MemberAuthForm from '@/components/member/MemberAuthForm';

export const metadata = {
  title: 'Member Sign In | Damai Indah Golf',
  robots: { index: false, follow: false },
};

export default function MemberLoginPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0F2A20] bg-[radial-gradient(ellipse_at_top_right,rgba(201,169,110,0.08),transparent_55%)] px-6 pb-24 pt-32 lg:pt-40">
        <MemberAuthForm />
      </main>
    </>
  );
}
