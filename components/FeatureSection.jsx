'use client';

import Link from 'next/link';
import { MotionConfig, motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];

const gridVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.18 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 48 },
  show: { opacity: 1, y: 0, transition: { duration: 0.9, ease: EASE } },
};

const iconProps = {
  'aria-hidden': 'true',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  className: 'h-9 w-9',
};

function FlagIcon() {
  return (
    <svg {...iconProps}>
      <path d="M5 21V3" />
      <path d="M5 4h12l-2.5 4L17 12H5" />
      <path d="M3 21h10" />
    </svg>
  );
}

function ClubhouseIcon() {
  return (
    <svg {...iconProps}>
      <path d="M3 10l9-6 9 6" />
      <path d="M5 10v11M19 10v11M9 10v11M15 10v11" />
      <path d="M3 21h18" />
    </svg>
  );
}

function ProShopIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 7h12l1 14H5L6 7z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
      <path d="M9 12v1M15 12v1" />
    </svg>
  );
}

const FEATURES = [
  {
    id: 'course',
    index: '01',
    label: 'The Course',
    title: 'Championship Course',
    description:
      'An 18-hole layout shaped for serious golfers and visiting executives alike, maintained to tournament standard with greens that reward every well-struck approach.',
    highlights: [
      'Hole-by-hole yardage from every tee box',
      'Daily course conditions and per-slot weather',
      'Experienced caddies and fleet-ready carts',
    ],
    cta: { label: 'Check Availability', href: '/booking' },
    icon: FlagIcon,
    panel: 'bg-gradient-to-br from-[#0F2A20] via-[#1d4a37] to-[#0F2A20]',
  },
  {
    id: 'clubhouse',
    index: '02',
    label: 'The Clubhouse',
    title: 'Exclusive Clubhouse',
    description:
      'A refined retreat before and after your round, with fine dining, private lounges, and locker facilities designed around the way executives entertain.',
    highlights: [
      'Private lounges for client hospitality',
      'Halfway-house pre-order, ready when you reach the turn',
      'Locker rooms and post-round recovery',
    ],
    cta: { label: 'Discover the Clubhouse', href: '/course#clubhouse' },
    icon: ClubhouseIcon,
    panel: 'bg-gradient-to-br from-[#1B1B1B] via-[#2b2a25] to-[#0F2A20]',
  },
  {
    id: 'pro-shop',
    index: '03',
    label: 'The Pro Shop',
    title: 'Pro Shop',
    description:
      'Curated equipment, premium apparel, and expert club fitting from our resident professionals, so you can leave with the right gear and a better swing.',
    highlights: [
      'Custom club fitting with resident pros',
      'Premium golf apparel and accessories',
      'Equipment rental, reserved with your tee time',
    ],
    cta: { label: 'Visit the Pro Shop', href: '/course#pro-shop' },
    icon: ProShopIcon,
    panel: 'bg-gradient-to-br from-[#12342a] via-[#0F2A20] to-[#3a3322]',
  },
];

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="mt-0.5 h-4 w-4 flex-none text-[#C9A96E]"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export default function FeatureSection() {
  return (
    <MotionConfig reducedMotion="user">
      <section
        id="experience"
        aria-labelledby="feature-heading"
        className="relative bg-[#F6F2EA] py-24 text-[#1B1B1B] lg:py-36"
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-10">
          {/* Heading section */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.9, ease: EASE }}
            className="mx-auto max-w-3xl text-center"
          >
            <div className="flex items-center justify-center gap-4">
              <span aria-hidden="true" className="h-px w-10 bg-[#C9A96E]" />
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.4em] text-[#8a6d35] sm:text-xs">
                The Experience
              </p>
              <span aria-hidden="true" className="h-px w-10 bg-[#C9A96E]" />
            </div>
            <h2
              id="feature-heading"
              className="mt-6 font-[family-name:var(--font-heading)] text-4xl font-medium leading-tight tracking-tight text-[#0F2A20] sm:text-5xl lg:text-6xl"
            >
              Every detail is part of <span className="italic">the game</span>
            </h2>
            <p className="mt-6 text-base leading-relaxed text-[#1B1B1B]/70 sm:text-lg">
              From the first tee to the last handshake in the clubhouse, we design the entire
              day around your time, your guests, and your standards.
            </p>
          </motion.div>

          {/* Grid kartu fitur */}
          <motion.div
            variants={gridVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-80px' }}
            className="mt-16 grid gap-6 md:grid-cols-2 lg:mt-24 lg:grid-cols-3 lg:gap-8"
          >
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.article
                  key={feature.id}
                  id={feature.id}
                  variants={cardVariants}
                  className="group relative flex scroll-mt-28 flex-col overflow-hidden rounded-2xl border border-[#0F2A20]/10 bg-white transition-[transform,box-shadow] duration-700 hover:-translate-y-2 hover:shadow-[0_30px_60px_-20px_rgba(15,42,32,0.35)]"
                >
                  {/* Panel visual */}
                  <div
                    className={`relative flex aspect-[4/3] items-center justify-center overflow-hidden ${feature.panel}`}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C9A96E]/25 transition-transform duration-1000 group-hover:scale-125"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C9A96E]/15 transition-transform duration-1000 group-hover:scale-110"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#C9A96E]/10"
                    />
                    <span
                      aria-hidden="true"
                      className="absolute left-6 top-5 font-[family-name:var(--font-heading)] text-5xl font-medium text-[#C9A96E]/40"
                    >
                      {feature.index}
                    </span>
                    <span className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[#C9A96E]/60 bg-[#0F2A20]/40 text-[#C9A96E] backdrop-blur-sm transition-colors duration-500 group-hover:bg-[#C9A96E] group-hover:text-[#0F2A20]">
                      <Icon />
                    </span>
                  </div>

                  {/* Garis aksen emas */}
                  <span
                    aria-hidden="true"
                    className="h-0.5 w-full origin-left scale-x-0 bg-[#C9A96E] transition-transform duration-700 group-hover:scale-x-100"
                  />

                  {/* Konten */}
                  <div className="flex flex-1 flex-col p-8 lg:p-9">
                    <p className="text-[0.65rem] font-medium uppercase tracking-[0.35em] text-[#8a6d35]">
                      {feature.label}
                    </p>
                    <h3 className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold leading-tight text-[#0F2A20]">
                      {feature.title}
                    </h3>
                    <p className="mt-4 text-[0.95rem] leading-relaxed text-[#1B1B1B]/70">
                      {feature.description}
                    </p>

                    <ul className="mt-6 space-y-3 text-sm text-[#1B1B1B]/80">
                      {feature.highlights.map((highlight) => (
                        <li key={highlight} className="flex items-start gap-3">
                          <CheckIcon />
                          <span>{highlight}</span>
                        </li>
                      ))}
                    </ul>

                    <Link
                      href={feature.cta.href}
                      className="group/link mt-8 inline-flex items-center gap-3 self-start border-b border-[#0F2A20]/30 pb-1 text-xs font-semibold uppercase tracking-[0.25em] text-[#0F2A20] transition-colors duration-300 hover:border-[#C9A96E] hover:text-[#8a6d35] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] focus-visible:ring-offset-4 focus-visible:ring-offset-white lg:mt-auto"
                    >
                      {feature.cta.label}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-4 w-4 transition-transform duration-500 group-hover/link:translate-x-1.5"
                      >
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </Link>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        </div>
      </section>
    </MotionConfig>
  );
}