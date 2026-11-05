'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';

const fieldClass = 'mt-2 w-full rounded-xl border border-[#C9A96E]/25 bg-white/[0.04] px-4 py-3 text-sm text-[#F6F2EA] focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40';

function AccountActionShell({ title, children, message, error }) {
  return (
    <section className="mx-auto mt-40 max-w-lg rounded-2xl border border-[#C9A96E]/25 bg-white/[0.03] p-6 sm:p-9">
      <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]">Member security</p>
      <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl">{title}</h1>
      {message && <p role="status" className="mt-5 text-sm text-emerald-100">{message}</p>}
      {error && <p role="alert" className="mt-5 text-sm text-red-200">{error}</p>}
      {children}
    </section>
  );
}

export function ForgotPasswordForm() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      await apiRequest('/api/v1/auth/password/forgot', {
        method: 'POST',
        body: { email: new FormData(event.currentTarget).get('email') },
      });
      setMessage('If an active account uses that email, a reset link will be sent when email delivery is configured.');
    } catch (reason) { setError(reason.message); }
  }
  return (
    <AccountActionShell title="Reset password" message={message} error={error}>
      {!message && <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="block text-xs text-[#F6F2EA]/65">Account email<input name="email" type="email" required autoComplete="email" className={fieldClass} /></label>
        <button className="w-full rounded-full bg-[#C9A96E] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0F2A20]">Send reset link</button>
      </form>}
      <Link href="/member/login" className="mt-6 inline-block text-xs text-[#C9A96E] underline underline-offset-4">Back to sign in</Link>
    </AccountActionShell>
  );
}

export function ResetPasswordForm() {
  const [token, setToken] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => setToken(new URLSearchParams(window.location.search).get('token') || ''), []);

  async function submit(event) {
    event.preventDefault();
    setError('');
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await apiRequest('/api/v1/auth/password/reset', { method: 'POST', body: { token, password: values.password } });
      setMessage('Password updated. Sign in with your new password.');
      form.reset();
    } catch (reason) { setError(reason.message); }
  }
  return (
    <AccountActionShell title="Choose a new password" message={message} error={error}>
      {!message && <form onSubmit={submit} className="mt-7 space-y-5">
        <label className="block text-xs text-[#F6F2EA]/65">New password<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className={fieldClass} /></label>
        <label className="block text-xs text-[#F6F2EA]/65">Confirm password<input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className={fieldClass} /></label>
        <button disabled={!token} className="w-full rounded-full bg-[#C9A96E] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0F2A20] disabled:opacity-50">Update password</button>
      </form>}
      {message && <Link href="/member/login" className="mt-6 inline-block text-xs text-[#C9A96E] underline underline-offset-4">Go to sign in</Link>}
    </AccountActionShell>
  );
}

export function VerifyEmailAction() {
  const [message, setMessage] = useState('Verifying your email link…');
  const [error, setError] = useState('');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      setMessage('');
      setError('The verification link is missing or invalid.');
      return;
    }
    apiRequest('/api/v1/auth/email/verify', { method: 'POST', body: { token } })
      .then(() => setMessage('Email verified. Thank you.'))
      .catch((reason) => { setMessage(''); setError(reason.message); });
  }, []);
  return (
    <AccountActionShell title="Email verification" message={message} error={error}>
      <Link href="/member" className="mt-6 inline-block text-xs text-[#C9A96E] underline underline-offset-4">Continue to dashboard</Link>
    </AccountActionShell>
  );
}
