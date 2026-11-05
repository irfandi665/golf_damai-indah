import Navbar from '@/components/Navbar';
import MemberProfileSecurity from '@/components/member/MemberProfileSecurity';

export const metadata = { title: 'Profile & Security | Damai Indah Golf', robots: { index: false, follow: false } };

export default function MemberProfilePage() {
  return <><Navbar /><main className="min-h-screen bg-[#0F2A20]"><MemberProfileSecurity /></main></>;
}
