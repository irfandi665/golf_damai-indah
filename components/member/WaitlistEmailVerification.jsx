'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';

export default function WaitlistEmailVerification() {
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
        ? 'Email verified. A tee-time offer is available; check your inbox for the booking link.'
        : 'Email verified. Your waitlist entry is active; we will email you if a place opens.');
    } catch (error) {
      setStatus('error');
      setMessage(error.message);
    }
  }

  return (
    <section className="mx-auto max-w-xl px-6 pb-24 pt-40 text-center text-[#F6F2EA]">
      <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]">Tee-time waitlist</p>
      <h1 className="mt-4 font-[family-name:var(--font-heading)] text-4xl">Verify your email</h1>
      <p className="mt-4 text-sm leading-relaxed text-[#F6F2EA]/60">Confirm this email address to activate the waitlist request. If a tee time is available, the club will hold it for 10 minutes while you complete the reservation.</p>
      {message && <p role={status === 'error' ? 'alert' : 'status'} className={`mt-6 rounded-xl border p-4 text-sm ${status === 'error' ? 'border-red-300/30 bg-red-950/20 text-red-100' : 'border-emerald-300/30 bg-emerald-950/20 text-emerald-100'}`}>{message}</p>}
      {status === 'idle' || status === 'working' ? (
        <button type="button" disabled={!token || status === 'working'} onClick={verify} className="mt-7 rounded-full bg-[#C9A96E] px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20] disabled:opacity-50">
          {status === 'working' ? 'Verifying…' : 'Verify email'}
        </button>
      ) : (
        <Link href="/booking" className="mt-7 inline-block rounded-full border border-[#C9A96E]/50 px-7 py-3.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#C9A96E]">View tee times</Link>
      )}
    </section>
  );
}
