'use client';

import Link from 'next/link';
import CourseStatus from './CourseStatus';
import { useLocale } from '@/components/i18n/LocaleProvider';

const FACILITIES = [
  ['clubhouse', 'Clubhouse', 'Clubhouse services and opening hours should be confirmed with the club before your visit.', 'Layanan clubhouse dan jam buka perlu dikonfirmasi ke klub sebelum kunjungan Anda.'],
  ['driving-range', 'Driving range', 'Range availability, ball prices and operating hours have not yet been published online.', 'Ketersediaan range, harga bola, dan jam operasional belum dipublikasikan secara online.'],
  ['restaurant', 'Restaurant', 'Dining menus, reservations and service hours are managed by the club. Contact the team for current details.', 'Menu, reservasi, dan jam layanan dikelola klub. Hubungi tim klub untuk informasi terkini.'],
  ['pro-shop', 'Pro shop', 'Ask the club about equipment, apparel, rental availability and club fitting.', 'Tanyakan kepada klub mengenai peralatan, pakaian, ketersediaan rental, dan club fitting.'],
];

export default function CoursePageContent() {
  const { text } = useLocale();
  return (
    <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-8">
        <section className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]">{text('Course profile', 'Profil lapangan')}</p>
          <h2 className="mt-3 font-[family-name:var(--font-heading)] text-3xl">{text('Championship Course', 'Lapangan Championship')}</h2>
          <p className="mt-4 leading-relaxed text-[#F6F2EA]/65">
            {text('The current tee sheet is configured for an 18-hole, par-72 course. Please contact the club for course maps, yardages, daily conditions and accessibility information.', 'Tee sheet saat ini dikonfigurasi untuk lapangan 18 hole, par 72. Hubungi klub untuk peta lapangan, jarak, kondisi harian, dan informasi aksesibilitas.')}
          </p>
          <Link href="/booking" className="mt-6 inline-flex rounded-full bg-[#C9A96E] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0F2A20]">{text('Check tee times', 'Lihat tee time')}</Link>
        </section>
        <div className="grid gap-4 sm:grid-cols-2">
          {FACILITIES.map(([id, name, english, indonesian]) => (
            <article key={id} id={id} className="scroll-mt-28 rounded-2xl border border-[#C9A96E]/15 bg-white/[0.025] p-6">
              <h3 className="font-[family-name:var(--font-heading)] text-2xl">{name}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[#F6F2EA]/55">{text(english, indonesian)}</p>
            </article>
          ))}
        </div>
      </div>
      <CourseStatus />
    </div>
  );
}
