import Navbar from '@/components/Navbar';
import { VerifyEmailAction } from '@/components/member/EmailAccountActions';

export const metadata = { title: 'Verify Email | Damai Indah Golf', robots: { index: false, follow: false } };

export default function VerifyEmailPage() {
  return <><Navbar /><main className="min-h-screen bg-[#0F2A20] px-6 pb-24"><VerifyEmailAction /></main></>;
}
