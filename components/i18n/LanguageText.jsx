'use client';

import { useLocale } from './LocaleProvider';

export default function LanguageText({ en, id, as: Element = 'span', ...props }) {
  const { locale } = useLocale();
  return <Element {...props}>{locale === 'id' ? id : en}</Element>;
}
