import Navbar from '@/components/Navbar';
import { ForgotPasswordForm } from '@/components/member/EmailAccountActions';

export const metadata = { title: 'Reset Password | Damai Indah Golf', robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return <><Navbar /><main className="min-h-screen bg-[#0F2A20] px-6 pb-24"><ForgotPasswordForm /></main></>;
}
