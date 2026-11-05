import { Suspense } from 'react';
import Navbar from '@/components/Navbar';
import WaitlistEmailVerification from '@/components/member/WaitlistEmailVerification';

export const metadata = {
  title: 'Verify Waitlist Email | Damai Indah Golf',
};

export default function WaitlistVerifyPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-[#0F2A20]">
        <Suspense fallback={<p className="pt-40 text-center text-[#F6F2EA]/60">Loading verification…</p>}>
          <WaitlistEmailVerification />
        </Suspense>
      </main>
    </>
  );
}
