'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
import { useLocale } from '@/components/i18n/LocaleProvider';

export default function WaitlistEmailVerification() {
  const { text } = useLocale();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function verify() {
    setStatus('working');
    setMessage('');
    try {
      const result = await apiRequest('/api/v1/waitlist/verify', {
        method: 'POST',
        body: { token },
      });
      setStatus('done');
      setMessage(result.status === 'held'
        ? text('Email verified. A tee-time offer is available; check your inbox for the booking link.', 'Email terverifikasi. Penawaran tee time tersedia; periksa email Anda untuk tautan booking.')
        : text('Email verified. Your waitlist entry is active; we will email you if a place opens.', 'Email terverifikasi. Pendaftaran waitlist aktif; kami akan mengirim email jika tersedia tempat.'));
    } catch (error) {
      setStatus('error');
      setMessage(error.message);
    }
  }

  return (
    <section className="mx-auto max-w-xl px-6 pb-24 pt-40 text-center text-[#F6F2EA]">
      <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]">{text('Tee-time waitlist', 'Waitlist tee time')}</p>
      <h1 className="mt-4 font-[family-name:var(--font-heading)] text-4xl">{text('Verify your email', 'Verifikasi email Anda')}</h1>
      <p className="mt-4 text-sm leading-relaxed text-[#F6F2EA]/60">{text('Confirm this email address to activate the waitlist request. If a tee time is available, the club will hold it for 10 minutes while you complete the reservation.', 'Konfirmasi alamat email untuk mengaktifkan permintaan waitlist. Jika tee time tersedia, klub akan menahan slot selama 10 menit untuk menyelesaikan reservasi.')}</p>
      {message && <p role={status === 'error' ? 'alert' : 'status'} className={`mt-6 rounded-xl border p-4 text-sm ${status === 'error' ? 'border-red-300/30 bg-red-950/20 text-red-100' : 'border-emerald-300/30 bg-emerald-950/20 text-emerald-100'}`}>{message}</p>}
      {status === 'idle' || status === 'working' ? (
        <button type="button" disabled={!token || status === 'working'} onClick={verify} className="mt-7 rounded-full bg-[#C9A96E] px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20] disabled:opacity-50">
          {status === 'working' ? text('Verifying…', 'Memverifikasi…') : text('Verify email', 'Verifikasi email')}
        </button>
      ) : (
        <Link href="/booking" className="mt-7 inline-block rounded-full border border-[#C9A96E]/50 px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#C9A96E]">{text('View tee times', 'Lihat tee time')}</Link>
      )}
    </section>
  );
}
