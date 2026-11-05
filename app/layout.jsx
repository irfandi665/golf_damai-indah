import './globals.css';

export const metadata = {
  title: 'Damai Indah Golf | Championship Golf & Exclusive Clubhouse',
  description:
    'Reserve your tee time at a championship course with an exclusive clubhouse and a curated pro shop.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-[#0F2A20] font-[family-name:var(--font-body)] text-[#F6F2EA] antialiased">
        {children}
      </body>
    </html>
  );
}