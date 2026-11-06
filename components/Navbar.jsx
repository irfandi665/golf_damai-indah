'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
} from 'framer-motion';
import { LanguageSwitcher, useLocale } from '@/components/i18n/LocaleProvider';

const EASE = [0.22, 1, 0.36, 1];

const NAV_LINKS = [
  { en: 'Course & Club', id: 'Course & Klub', href: '/course' },
  { en: 'Prices', id: 'Harga', href: '/pricing' },
  { en: 'Events', id: 'Acara', href: '/events' },
  { en: 'Academy', id: 'Akademi', href: '/academy' },
  { en: 'Visit', id: 'Kunjungi', href: '/contact' },
];

function Logo({ onClick }) {
  return (
    <Link
      href="/"
      onClick={onClick}
      aria-label="Damai Indah Golf, kembali ke beranda"
      className="group flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20]"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#C9A96E]/70 font-[family-name:var(--font-heading)] text-lg font-semibold text-[#C9A96E] transition-colors duration-500 group-hover:bg-[#C9A96E] group-hover:text-[#0F2A20]">
        DI
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-[family-name:var(--font-heading)] text-xl font-semibold tracking-[0.18em] text-[#F6F2EA]">
          DAMAI INDAH
        </span>
        <span className="mt-1 text-[0.6rem] font-medium uppercase tracking-[0.5em] text-[#C9A96E]">
          Golf
        </span>
      </span>
    </Link>
  );
}

export default function Navbar() {
  const { locale, text } = useLocale();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollY } = useScroll();

  // Glassmorphism saat scroll + sembunyikan saat scroll turun, tampil saat scroll naik
  useMotionValueEvent(scrollY, 'change', (latest) => {
    const previous = scrollY.getPrevious() ?? 0;
    setScrolled(latest > 40);
    setHidden(latest > previous && latest > 240);
  });

  // Kunci scroll body + tutup dengan Escape saat menu mobile terbuka
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Tutup menu mobile otomatis saat viewport membesar ke desktop
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const onChange = (event) => {
      if (event.matches) setOpen(false);
    };
    mediaQuery.addEventListener('change', onChange);
    return () => mediaQuery.removeEventListener('change', onChange);
  }, []);

  const closeMenu = () => setOpen(false);
  const solid = scrolled || open;

  return (
    <>
      <motion.header
        initial={{ y: '-100%' }}
        animate={{ y: hidden && !open ? '-100%' : '0%' }}
        transition={{ duration: 0.6, ease: EASE }}
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500 ${
          solid
            ? 'border-[#C9A96E]/20 bg-[#0F2A20]/60 shadow-[0_8px_32px_rgba(0,0,0,0.25)] backdrop-blur-xl backdrop-saturate-150'
            : 'border-transparent bg-transparent'
        }`}
      >
        <div
          className={`mx-auto flex max-w-7xl items-center justify-between px-6 transition-[padding] duration-500 lg:px-10 ${
            solid ? 'py-3' : 'py-5'
          }`}
        >
          <Logo onClick={closeMenu} />

          {/* Navigasi desktop */}
          <nav aria-label={text('Main navigation', 'Navigasi utama')} className="hidden items-center gap-5 xl:gap-7 xl:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative text-[0.65rem] font-medium uppercase tracking-[0.16em] text-[#F6F2EA]/80 transition-colors duration-300 after:absolute after:-bottom-2 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-[#C9A96E] after:transition-transform after:duration-500 hover:text-[#C9A96E] hover:after:scale-x-100 focus-visible:text-[#C9A96E] focus-visible:outline-none"
              >
                {locale === 'id' ? link.id : link.en}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link
              href="/member"
              className="hidden text-xs font-medium uppercase tracking-[0.25em] text-[#F6F2EA]/80 transition-colors duration-300 hover:text-[#C9A96E] focus-visible:outline-none focus-visible:text-[#C9A96E] xl:inline-block"
            >
              {text('Member Login', 'Login Member')}
            </Link>

            <Link
              href="/booking"
              className="hidden rounded-full border border-[#C9A96E] bg-[#C9A96E] px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20] transition-all duration-500 hover:bg-transparent hover:text-[#C9A96E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20] lg:inline-block"
            >
              {text('Book Tee Time', 'Pesan Tee Time')}
            </Link>

            {/* Tombol hamburger */}
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? text('Close menu', 'Tutup menu') : text('Open menu', 'Buka menu')}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-[#C9A96E]/40 text-[#F6F2EA] transition-colors duration-300 hover:border-[#C9A96E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] xl:hidden"
            >
              <span className="relative block h-3.5 w-5">
                <span
                  className={`absolute left-0 h-px w-5 bg-current transition-all duration-300 ${
                    open ? 'top-1/2 rotate-45' : 'top-0'
                  }`}
                />
                <span
                  className={`absolute left-0 top-1/2 h-px w-5 bg-current transition-all duration-300 ${
                    open ? 'opacity-0' : 'opacity-100'
                  }`}
                />
                <span
                  className={`absolute left-0 h-px w-5 bg-current transition-all duration-300 ${
                    open ? 'top-1/2 -rotate-45' : 'bottom-0'
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </motion.header>

      {/* Overlay menu mobile (sibling header agar posisi fixed tidak terganggu backdrop-filter) */}
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={text('Navigation menu', 'Menu navigasi')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="fixed inset-0 z-40 flex flex-col justify-between bg-[#0F2A20]/95 px-6 pb-10 pt-28 backdrop-blur-2xl xl:hidden"
          >
            <nav aria-label={text('Mobile navigation', 'Navigasi mobile')} className="flex flex-col">
              {NAV_LINKS.map((link, index) => (
                <motion.div
                  key={link.href}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: EASE, delay: 0.1 + index * 0.08 }}
                  className="border-b border-[#C9A96E]/15"
                >
                  <Link
                    href={link.href}
                    onClick={closeMenu}
                    className="flex items-center justify-between py-5 font-[family-name:var(--font-heading)] text-4xl font-medium text-[#F6F2EA] transition-colors duration-300 hover:text-[#C9A96E] focus-visible:text-[#C9A96E] focus-visible:outline-none"
                  >
                    {locale === 'id' ? link.id : link.en}
                    <span aria-hidden="true" className="text-lg text-[#C9A96E]">
                      →
                    </span>
                  </Link>
                </motion.div>
              ))}
            </nav>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE, delay: 0.4 }}
              className="flex flex-col gap-4"
            >
              <LanguageSwitcher className="self-end" />
              <Link
                href="/booking"
                onClick={closeMenu}
                className="rounded-full bg-[#C9A96E] px-8 py-4 text-center text-sm font-semibold uppercase tracking-[0.2em] text-[#0F2A20] transition-colors duration-300 hover:bg-[#d8bb84] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2EA]"
              >
                {text('Book Your Tee Time', 'Pesan Tee Time')}
              </Link>
              <Link
                href="/member"
                onClick={closeMenu}
                className="rounded-full border border-[#C9A96E]/40 px-8 py-4 text-center text-sm font-medium uppercase tracking-[0.2em] text-[#F6F2EA] transition-colors duration-300 hover:border-[#C9A96E] hover:text-[#C9A96E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E]"
              >
                {text('Member Login', 'Login Member')}
              </Link>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}