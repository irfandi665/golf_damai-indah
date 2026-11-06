'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api-client';
import NotificationPreferences from './NotificationPreferences';
import { useLocale } from '@/components/i18n/LocaleProvider';

const fieldClass = 'mt-2 w-full rounded-xl border border-[#C9A96E]/25 bg-white/[0.04] px-4 py-3 text-sm text-[#F6F2EA] focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40';

export default function MemberProfileSecurity() {
  const { text } = useLocale();
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
      setNotice(text('Profile saved.', 'Profil tersimpan.'));
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
      setError(text('New password and confirmation do not match.', 'Kata sandi baru dan konfirmasi tidak cocok.'));
      return;
    }
    try {
      await apiRequest('/api/v1/me/password', { method: 'PATCH', body: values });
      formElement.reset();
      setNotice(text('Password changed. Please sign in again; other active sessions have been signed out.', 'Kata sandi berhasil diubah. Silakan masuk kembali; sesi aktif lainnya telah dikeluarkan.'));
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
      setNotice(result.alreadyVerified ? text('Your email is already verified.', 'Email Anda sudah terverifikasi.') : result.sent ? text('Verification email sent.', 'Email verifikasi telah dikirim.') : text('Verification email is queued for delivery.', 'Email verifikasi masuk antrean pengiriman.'));
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
      <Link href="/member" className="text-xs uppercase tracking-[0.2em] text-[#C9A96E] underline underline-offset-4">← {text('Member dashboard', 'Dashboard member')}</Link>
      <div className="mt-6 max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-[#C9A96E]">{text('Account', 'Akun')}</p>
        <h1 className="mt-3 font-[family-name:var(--font-heading)] text-4xl sm:text-5xl">{text('Profile & security', 'Profil & keamanan')}</h1>
      </div>
      {notice && <p role="status" className="mt-6 rounded-xl border border-emerald-300/30 bg-emerald-950/20 p-4 text-sm text-emerald-100">{notice}</p>}
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-300/30 bg-red-950/20 p-4 text-sm text-red-100">{error}</p>}
      {!profile ? <p role="status" className="mt-8 text-sm text-[#F6F2EA]/55">{text('Loading account…', 'Memuat akun…')}</p> : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <form onSubmit={updateProfile} className="space-y-5 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
            <h2 className="font-[family-name:var(--font-heading)] text-2xl">{text('Personal details', 'Data pribadi')}</h2>
            <label className="block text-xs text-[#F6F2EA]/65">{text('Full name', 'Nama lengkap')}<input name="name" required minLength={2} maxLength={120} defaultValue={profile.name} className={fieldClass} /></label>
            <label className="block text-xs text-[#F6F2EA]/65">{text('Phone', 'Telepon')}<input name="phone" type="tel" required defaultValue={profile.phone} className={fieldClass} /></label>
            <label className="block text-xs text-[#F6F2EA]/65">{text('Email (managed by verification flow)', 'Email (dikelola melalui verifikasi)')}<input value={profile.email} readOnly className={`${fieldClass} opacity-60`} /></label>
            <button type="submit" className="rounded-full bg-[#C9A96E] px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#0F2A20]">{text('Save details', 'Simpan data')}</button>
          </form>

          <div className="space-y-6">
            <section className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl">{text('Verification', 'Verifikasi')}</h2>
              <div className="mt-5 flex items-center justify-between gap-4">
                <div><p className="text-sm">Email</p><p className="mt-1 text-xs text-[#F6F2EA]/50">{profile.emailVerified ? text('Verified', 'Terverifikasi') : text('Not verified', 'Belum terverifikasi')}</p></div>
                {!profile.emailVerified && <button type="button" onClick={sendVerification} className="rounded-full border border-[#C9A96E]/50 px-4 py-2 text-xs text-[#C9A96E]">{text('Send verification', 'Kirim verifikasi')}</button>}
              </div>
              <div className="mt-5 border-t border-[#C9A96E]/10 pt-5">
                <p className="text-sm">Phone</p>
                <p className="mt-1 text-xs leading-relaxed text-[#F6F2EA]/50">{profile.phoneVerified ? text('Verified', 'Terverifikasi') : text('Not verified. SMS/OTP delivery is not configured yet.', 'Belum terverifikasi. Pengiriman SMS/OTP belum dikonfigurasi.')}</p>
              </div>
            </section>
            <form onSubmit={updatePassword} className="space-y-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
              <h2 className="font-[family-name:var(--font-heading)] text-2xl">{text('Change password', 'Ubah kata sandi')}</h2>
              <label className="block text-xs text-[#F6F2EA]/65">{text('Current password', 'Kata sandi saat ini')}<input name="currentPassword" type="password" autoComplete="current-password" required className={fieldClass} /></label>
              <label className="block text-xs text-[#F6F2EA]/65">{text('New password', 'Kata sandi baru')}<input name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className={fieldClass} /></label>
              <label className="block text-xs text-[#F6F2EA]/65">{text('Confirm new password', 'Konfirmasi kata sandi baru')}<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required className={fieldClass} /></label>
              <button type="submit" className="rounded-full border border-[#C9A96E]/50 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#C9A96E]">{text('Update password', 'Perbarui kata sandi')}</button>
              <p className="text-xs"><Link href="/member/forgot-password" className="text-[#C9A96E] underline underline-offset-4">{text('Forgot your password?', 'Lupa kata sandi?')}</Link></p>
            </form>
            <NotificationPreferences />
          </div>
        </div>
      )}
      {profile && <button type="button" onClick={signOut} className="mt-8 rounded-full border border-red-300/30 px-6 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-red-200 hover:bg-red-950/30">{text('Sign out', 'Keluar')}</button>}
    </section>
  );
}
