import Link from 'next/link';
import PublicPageShell from '@/components/public/PublicPageShell';
import CourseStatus from '@/components/public/CourseStatus';

export const metadata = {
  title: 'Course & Facilities | Damai Indah Golf',
  description: 'Explore the course, clubhouse, driving range and dining facilities.',
};

const facilities = [
  ['clubhouse', 'Clubhouse', 'Clubhouse services and opening hours should be confirmed with the club before your visit.'],
  ['driving-range', 'Driving range', 'Range availability, ball prices and operating hours have not yet been published online.'],
  ['restaurant', 'Restaurant', 'Dining menus, reservations and service hours are managed by the club. Contact the team for current details.'],
  ['pro-shop', 'Pro shop', 'Ask the club about equipment, apparel, rental availability and club fitting.'],
];

export default function CoursePage() {
  return (
    <PublicPageShell
      eyebrow="The club"
      title="A day at the course, thoughtfully arranged."
      description="Explore course operations and club facilities. Operational hours, photography and detailed hole-by-hole information are being prepared for publication."
    >
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-8">
          <section className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]">Course profile</p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl">Championship Course</h2>
            <p className="mt-4 leading-relaxed text-[#F6F2EA]/65">
              The current tee sheet is configured for an 18-hole, par-72 course. Please contact the club for course maps, yardages, daily conditions and accessibility information.
            </p>
            <Link href="/booking" className="mt-6 inline-flex rounded-full bg-[#C9A96E] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0F2A20]">Check tee times</Link>
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            {facilities.map(([id, name, description]) => (
              <article key={id} id={id} className="scroll-mt-28 rounded-2xl border border-[#C9A96E]/15 bg-white/[0.025] p-6">
                <h3 className="font-[family-name:var(--font-heading)] text-2xl">{name}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#F6F2EA]/55">{description}</p>
              </article>
            ))}
          </div>
        </div>
        <CourseStatus />
      </div>
    </PublicPageShell>
  );
}
