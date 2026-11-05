'use client';

import { useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];

const containerVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.25 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: 1, ease: EASE } },
};

const STATS = [
  { value: '18', label: 'Championship Holes' },
  { value: 'Par 72', label: 'Signature Layout' },
  { value: '24/7', label: 'Online Tee-Time Booking' },
];

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1.5"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function HeroSection() {
  const sectionRef = useRef(null);
  const prefersReducedMotion = useReducedMotion();

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });

  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '8%']);
  const backgroundScale = useTransform(scrollYProgress, [0, 1], [1.05, 1.18]);
  const contentY = useTransform(scrollYProgress, [0, 1], ['0%', '14%']);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.65], [1, 0]);

  return (
    <MotionConfig reducedMotion="user">
      <section
        ref={sectionRef}
        aria-label="Selamat datang di Damai Indah Golf"
        className="relative isolate flex min-h-[100svh] items-center overflow-hidden bg-[#0F2A20]"
      >
        {/* Lapisan latar: poster + video loop dengan parallax */}
        <motion.div
          aria-hidden="true"
          style={
            prefersReducedMotion
              ? undefined
              : { y: backgroundY, scale: backgroundScale }
          }
          className="absolute inset-x-0 -top-[12%] -z-30 h-[124%] will-change-transform"
        >
          <Image
            src="/media/hero-poster.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          {!prefersReducedMotion && (
            <video
              className="absolute inset-0 h-full w-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              poster="/media/hero-poster.jpg"
              aria-hidden="true"
              tabIndex={-1}
            >
              <source src="/media/hero.mp4" type="video/mp4" />
            </video>
          )}
        </motion.div>

        {/* Overlay gradien untuk keterbacaan teks */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-gradient-to-b from-[#0F2A20]/80 via-[#0F2A20]/35 to-[#0F2A20]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-20 bg-[radial-gradient(ellipse_at_30%_50%,rgba(15,42,32,0.55),transparent_70%)]"
        />

        {/* Konten */}
        <motion.div
          style={prefersReducedMotion ? undefined : { y: contentY, opacity: contentOpacity }}
          className="mx-auto w-full max-w-7xl px-6 pb-44 pt-36 lg:px-10 lg:pb-48"
        >
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="max-w-4xl"
          >
            <motion.div variants={itemVariants} className="flex items-center gap-4">
              <span aria-hidden="true" className="h-px w-12 bg-[#C9A96E]" />
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.4em] text-[#C9A96E] sm:text-xs">
                Championship Golf Experience
              </p>
            </motion.div>

            <motion.h1
              variants={itemVariants}
              className="mt-8 font-[family-name:var(--font-heading)] text-5xl font-medium leading-[1.02] tracking-tight text-[#F6F2EA] sm:text-6xl lg:text-8xl"
            >
              Your Round.
              <span className="block italic text-[#C9A96E]">Perfectly Arranged.</span>
            </motion.h1>

            <motion.p
              variants={itemVariants}
              className="mt-8 max-w-xl text-base leading-relaxed text-[#F6F2EA]/80 sm:text-lg"
            >
              Reserve your tee time in seconds, see the full price upfront, and arrive to a
              fairway, a caddy, and a cart that are already waiting for you.
            </motion.p>

            <motion.div
              variants={itemVariants}
              className="mt-12 flex flex-col gap-4 sm:flex-row sm:items-center"
            >
              <motion.div whileTap={{ scale: 0.97 }} className="sm:w-auto">
                <Link
                  href="/booking"
                  className="group relative inline-flex w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-[#C9A96E] px-9 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-[#0F2A20] shadow-[0_12px_40px_-12px_rgba(201,169,110,0.8)] transition-all duration-500 hover:bg-[#d8bb84] hover:shadow-[0_16px_50px_-10px_rgba(201,169,110,0.95)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2EA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20] sm:w-auto"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/40 transition-[left] duration-700 ease-out group-hover:left-[130%]"
                  />
                  <span className="relative">Book Your Tee Time</span>
                  <span className="relative">
                    <ArrowIcon />
                  </span>
                </Link>
              </motion.div>

              <Link
                href="/#course"
                className="inline-flex items-center justify-center rounded-full border border-[#F6F2EA]/30 px-9 py-4 text-sm font-medium uppercase tracking-[0.2em] text-[#F6F2EA] backdrop-blur-sm transition-all duration-500 hover:border-[#C9A96E] hover:text-[#C9A96E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20]"
              >
                Explore the Course
              </Link>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Indikator scroll (desktop) */}
        <div
          aria-hidden="true"
          className="absolute bottom-32 right-10 hidden flex-col items-center gap-4 text-[#F6F2EA]/60 lg:flex"
        >
          <span className="text-[0.65rem] font-medium uppercase tracking-[0.4em] [writing-mode:vertical-rl]">
            Scroll
          </span>
          <span className="relative block h-16 w-px overflow-hidden bg-[#F6F2EA]/20">
            <motion.span
              className="absolute inset-x-0 top-0 block h-full origin-top bg-[#C9A96E]"
              animate={{ scaleY: [0, 1, 0], y: ['0%', '0%', '100%'] }}
              transition={{ duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
            />
          </span>
        </div>

        {/* Strip statistik */}
        <motion.dl
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: EASE, delay: 1 }}
          className="absolute inset-x-0 bottom-0 grid grid-cols-3 border-t border-[#C9A96E]/20 bg-[#0F2A20]/40 backdrop-blur-md"
        >
          {STATS.map((stat, index) => (
            <div
              key={stat.label}
              className={`px-3 py-5 text-center sm:px-6 sm:py-7 ${
                index > 0 ? 'border-l border-[#C9A96E]/15' : ''
              }`}
            >
              <dt className="order-2 mt-1 text-[0.6rem] font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/60 sm:text-xs sm:tracking-[0.3em]">
                {stat.label}
              </dt>
              <dd className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-[#C9A96E] sm:text-4xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </motion.dl>
      </section>
    </MotionConfig>
  );
}