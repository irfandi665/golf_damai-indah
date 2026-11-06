import Link from 'next/link';
import PublicPageShell from '@/components/public/PublicPageShell';
import CourseStatus from '@/components/public/CourseStatus';
import CoursePageContent from '@/components/public/CoursePageContent';

export const metadata = {
  title: 'Course & Facilities | Damai Indah Golf',
  description: 'Explore the course, clubhouse, driving range and dining facilities.',
};

export default function CoursePage() {
  return (
    <PublicPageShell
      eyebrow={{ en: 'The club', id: 'Klub' }}
      title={{ en: 'A day at the course, thoughtfully arranged.', id: 'Hari bermain golf yang tertata dengan nyaman.' }}
      description={{ en: 'Explore course operations and club facilities. Operational hours, photography and detailed hole-by-hole information are being prepared for publication.', id: 'Jelajahi operasional lapangan dan fasilitas klub. Jam operasional, foto, dan informasi setiap hole sedang disiapkan untuk dipublikasikan.' }}
    >
      <CoursePageContent />
    </PublicPageShell>
  );
}
