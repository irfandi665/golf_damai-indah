'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import NotificationPreferences from './NotificationPreferences';

const fieldClass = 'mt-2 w-full rounded-xl border border-[#C9A96E]/25 bg-white/[0.04] px-4 py-3 text-sm text-[#F6F2EA] focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40';

export default function MemberProfileSecurity() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/v1/me')
      .then(setProfile)
      .catch((reason) => setError(reason.message));
  }, []);

  async function updateProfile(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    try {
      const form = Object.fromEntries(new FormData(event.currentTarget));
      const updated = await apiRequest('/api/v1/me', { method: 'PATCH', body: form });
      setProfile((current) => ({ ...current, ...updated }));
      setNotice('Profile saved.');
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function updatePassword(event) {
    event.preventDefault();
    setError('');
    setNotice('');
    const formElement = event.currentTarget;
    const values = Object.fromEntries(new FormData(formElement));
    if (values.newPassword !== values.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    try {
      await apiRequest('/api/v1/me/password', { method: 'PATCH', body: values });
      formElement.reset();
      setNotice('Password changed. Please sign in again; other active sessions have been signed out.');
      setTimeout(() => router.replace('/member/login'), 1200);
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function sendVerification() {
    setError('');
    setNotice('');
    try {
      const result = await apiRequest('/api/v1/auth/email/verification', { method: 'POST', body: {} });
      setNotice(result.alreadyVerified ? 'Your email is already verified.' : result.sent ? 'Verification email sent.' : 'Verification email is queued for delivery.');
    } catch (reason) {
      setError(reason.message);
    }
  }

  async function signOut() {
    setError('');
    try {
      await apiRequest('/api/v1/auth/logout', { method: 'POST', body: {} });
      router.replace('/member/login');
      router.refresh();
    } catch (reason) { setError(reason.message); }
  }

  return (
    <section className="mx-auto max-w-7xl px-6 pb-24 pt-32 lg:px-10 lg:pt-40">
      <Link href="/member" className="text-xs uppercase tracking-[0.2em] text-[#C9A96E] underline underline-offset-4">← Member dashboard</Link>
      <div className="mt-6 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]">Account</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl sm:text-5xl">Profile & security</h1>
      </div>
      {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-950/20 p-4 text-sm text-emerald-100">{notice}</p>}
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-300/30 bg-red-950/20 p-4 text-sm text-red-100">{error}</p>}
      {!profile ? <p role="status" className="mt-8 text-sm text-[#F6F2EA]/55">Loading account…</p> : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <form onSubmit={updateProfile} className="space-y-5 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl">Personal details</h2>
            <label className="block text-xs text-[#F6F2EA]/65">Full name<input name="name" required minLength={2} maxLength={120} defaultValue={profile.name} className={fieldClass} /></label>
            <label className="block text-xs text-[#F6F2EA]/65">Phone<input name="phone" type="tel" required defaultValue={profile.phone} className={fieldClass} /></label>
            <label className="block text-xs text-[#F6F2EA]/65">Email (managed by verification flow)<input value={profile.email} readOnly className={`${fieldClass} opacity-60`} /></label>
            <button type="submit" className="rounded-full bg-[#C9A96E] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0F2A20]">Save details</button>
          </form>

          <div className="space-y-6">
            <section className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl">Verification</h2>
              <div className="mt-5 flex items-center justify-between gap-4">
                <div><p className="text-sm">Email</p><p className="mt-1 text-xs text-[#F6F2EA]/50">{profile.emailVerified ? 'Verified' : 'Not verified'}</p></div>
                {!profile.emailVerified && <button type="button" onClick={sendVerification} className="rounded-full border border-[#C9A96E]/50 px-4 py-2 text-xs text-[#C9A96E]">Send verification</button>}
              </div>
              <div className="mt-5 border-t border-[#C9A96E]/10 pt-5">
                <p className="text-sm">Phone</p>
                <p className="mt-1 text-xs leading-relaxed text-[#F6F2EA]/50">{profile.phoneVerified ? 'Verified' : 'Not verified. SMS/OTP delivery is not configured yet.'}</p>
              </div>
            </section>
            <form onSubmit={updatePassword} className="space-y-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl">Change password</h2>
              <label className="block text-xs text-[#F6F2EA]/65">Current password<input name="currentPassword" type="password" autoComplete="current-password" required className={fieldClass} /></label>
              <label className="block text-xs text-[#F6F2EA]/65">New password<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className={fieldClass} /></label>
              <label className="block text-xs text-[#F6F2EA]/65">Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className={fieldClass} /></label>
              <button type="submit" className="rounded-full border border-[#C9A96E]/50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#C9A96E]">Update password</button>
              <p className="text-xs"><Link href="/member/forgot-password" className="text-[#C9A96E] underline underline-offset-4">Forgot your password?</Link></p>
            </form>
            <NotificationPreferences />
          </div>
        </div>
      )}
      {profile && <button type="button" onClick={signOut} className="mt-8 rounded-full border border-red-300/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-red-200 hover:bg-red-950/30">Sign out</button>}
    </section>
  );
}
