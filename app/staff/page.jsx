import Navbar from '@/components/Navbar';
import StaffConsole from '@/components/staff/StaffConsole';

export const metadata = { title: 'Staff Operations | Damai Indah Golf', robots: { index: false, follow: false } };

export default function StaffPage() {
  return <><Navbar /><main className="min-h-screen bg-[#0F2A20]"><StaffConsole /></main></>;
}
