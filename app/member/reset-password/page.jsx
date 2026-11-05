import Navbar from '@/components/Navbar';
import { ResetPasswordForm } from '@/components/member/EmailAccountActions';

export const metadata = { title: 'Choose a New Password | Damai Indah Golf', robots: { index: false, follow: false } };

export default function ResetPasswordPage() {
  return <><Navbar /><main className="min-h-screen bg-[#0F2A20] px-6 pb-24"><ResetPasswordForm /></main></>;
}
