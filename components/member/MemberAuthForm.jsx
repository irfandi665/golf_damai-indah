'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';

const inputClass = 'w-full rounded-xl border border-[#C9A96E]/25 bg-white/[0.04] px-4 py-3.5 text-base text-[#F6F2EA] focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]';

export default function MemberAuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(form.entries());
    try {
      await apiRequest(`/api/v1/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body,
      });
      router.replace('/member');
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-lg rounded-2xl border border-[#C9A96E]/25 bg-white/[0.03] p-6 sm:p-9">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.35em] text-[#C9A96E]">Member Access</p>
      <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl text-[#F6F2EA]">
        {mode === 'login' ? 'Welcome back' : 'Create your account'}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-[#F6F2EA]/60">
        {mode === 'login'
          ? 'Sign in to view your rounds, reservations and rewards.'
          : 'Create a member account to access your golf dashboard.'}
      </p>

      <form className="mt-8 space-y-5" onSubmit={submit}>
        {mode === 'register' && (
          <>
            <div>
              <label htmlFor="auth-name" className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/70">Full name</label>
              <input id="auth-name" name="name" autoComplete="name" required minLength={2} maxLength={120} className={inputClass} />
            </div>
            <div>
              <label htmlFor="auth-phone" className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/70">Mobile / WhatsApp</label>
              <input id="auth-phone" name="phone" type="tel" autoComplete="tel" placeholder="0812 3456 7890" required className={inputClass} />
            </div>
          </>
        )}
        <div>
          <label htmlFor="auth-email" className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/70">Email</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" required className={inputClass} />
        </div>
        <div>
          <label htmlFor="auth-password" className="mb-2 block text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/70">Password</label>
          <input id="auth-password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 12 : 1} maxLength={128} className={inputClass} />
          {mode === 'register' && <p className="mt-2 text-xs text-[#F6F2EA]/45">Use at least 12 characters.</p>}
        </div>
        {error && <p role="alert" className="rounded-xl border border-red-300/30 bg-red-950/20 px-4 py-3 text-sm text-red-200">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-full bg-[#C9A96E] px-7 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20] transition-colors hover:bg-[#d8bb84] disabled:opacity-50">
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-[#F6F2EA]/60">
        {mode === 'login' ? 'New to the club?' : 'Already have an account?'}{' '}
        <button
          type="button"
          onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
          className="font-medium text-[#C9A96E] underline underline-offset-4"
        >
          {mode === 'login' ? 'Create an account' : 'Sign in'}
        </button>
      </p>
      {mode === 'login' && (
        <p className="mt-4 text-center text-sm">
          <Link href="/member/forgot-password" className="text-[#C9A96E] underline underline-offset-4">Forgot your password?</Link>
        </p>
      )}
    </section>
  );
}
