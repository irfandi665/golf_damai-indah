import './globals.css';
import { LocaleProvider } from '@/components/i18n/LocaleProvider';

export const metadata = {
  title: 'Damai Indah Golf | Reservasi Tee Time & Layanan Member',
  description:
    'Jelajahi Damai Indah Golf, pesan tee time secara online, dan akses layanan member. Pembayaran dilakukan di klub.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id" className="scroll-smooth">
      <body className="bg-[#0F2A20] font-[family-name:var(--font-body)] text-[#F6F2EA] antialiased">
        <LocaleProvider>{children}</LocaleProvider>
      </body>
    </html>
  );
}