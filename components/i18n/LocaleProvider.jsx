'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

const STORAGE_KEY = 'damai-indah-locale';
const LocaleContext = createContext(null);

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState('id');
  const pathname = usePathname();
  const activeLocale = pathname?.startsWith('/staff') ? 'id' : locale;

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'id') setLocaleState(saved);
  }, []);

  useEffect(() => {
    document.documentElement.lang = activeLocale;
  }, [activeLocale]);

  const setLocale = useCallback((nextLocale) => {
    if (nextLocale !== 'id' && nextLocale !== 'en') return;
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
    setLocaleState(nextLocale);
  }, []);

  const value = useMemo(() => ({
    locale: activeLocale,
    setLocale,
    text: (english, indonesian) => activeLocale === 'id' ? indonesian : english,
    formatDate: (date, options) => new Intl.DateTimeFormat(activeLocale === 'id' ? 'id-ID' : 'en-GB', options).format(date),
    formatNumber: (number, options) => new Intl.NumberFormat(activeLocale === 'id' ? 'id-ID' : 'en-GB', options).format(number),
  }), [activeLocale, setLocale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used within LocaleProvider.');
  return value;
}

export function LanguageSwitcher({ className = '' }) {
  const { locale, setLocale, text } = useLocale();

  return (
    <div
      role="group"
      aria-label={text('Choose language', 'Pilih bahasa')}
      className={`inline-flex items-center gap-1 rounded-full border border-[#C9A96E]/30 p-1 ${className}`}
    >
      {['id', 'en'].map((option) => (
        <button
          key={option}
          type="button"
          aria-label={option === 'id' ? 'Bahasa Indonesia' : 'English'}
          aria-pressed={locale === option}
          onClick={() => setLocale(option)}
          className={`min-h-9 min-w-10 rounded-full px-2 text-[0.65rem] font-semibold tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] ${
            locale === option ? 'bg-[#C9A96E] text-[#0F2A20]' : 'text-[#F6F2EA]/70 hover:text-[#C9A96E]'
          }`}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
