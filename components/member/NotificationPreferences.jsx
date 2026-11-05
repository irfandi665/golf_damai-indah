'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

const fieldClass = 'mt-2 rounded-xl border border-[#C9A96E]/25 bg-[#0F2A20] px-3 py-2.5 text-sm text-[#F6F2EA] focus:border-[#C9A96E] focus:outline-none';

export default function NotificationPreferences() {
  const [preferences, setPreferences] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest('/api/v1/me/notifications')
      .then(setPreferences)
      .catch((reason) => setError(reason.message));
  }, []);

  function update(field, value) {
    setPreferences((current) => ({ ...current, [field]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    setError('');
    try {
      setPreferences(await apiRequest('/api/v1/me/notifications', {
        method: 'PATCH',
        body: preferences,
      }));
      setNotice('Notification preferences saved.');
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl">Email notifications</h2>
        <p className="mt-2 text-xs leading-relaxed text-[#F6F2EA]/50">Booking confirmations and cancellation receipts are transactional. These preferences control optional tee-time reminders and course updates. Delivery requires the club email provider to be configured.</p>
      </div>
      {!preferences ? <p role={error ? 'alert' : 'status'} className="text-sm text-[#F6F2EA]/55">{error || 'Loading preferences…'}</p> : (
        <>
          <label className="flex items-start gap-3 text-sm text-[#F6F2EA]/75">
            <input type="checkbox" checked={preferences.emailConsent} onChange={(event) => update('emailConsent', event.target.checked)} className="mt-1 accent-[#C9A96E]" />
            <span>I consent to receive optional email notifications and understand I can withdraw consent here.</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-[#F6F2EA]/75">
            <input type="checkbox" checked={preferences.teeTimeReminders} onChange={(event) => update('teeTimeReminders', event.target.checked)} className="mt-1 accent-[#C9A96E]" />
            <span>Tee-time reminders</span>
          </label>
          <label className="flex items-start gap-3 text-sm text-[#F6F2EA]/75">
            <input type="checkbox" checked={preferences.courseUpdates} onChange={(event) => update('courseUpdates', event.target.checked)} className="mt-1 accent-[#C9A96E]" />
            <span>Course condition and operational updates</span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-[#F6F2EA]/60">Reminder timing<select value={preferences.reminderHours} onChange={(event) => update('reminderHours', Number(event.target.value))} className={`${fieldClass} block w-full`}><option value={24}>24 hours before</option><option value={3}>3 hours before</option></select></label>
            <label className="text-xs text-[#F6F2EA]/60">Course updates<select value={preferences.digestFrequency} onChange={(event) => update('digestFrequency', event.target.value)} className={`${fieldClass} block w-full`}><option value="immediate">As they are published</option><option value="daily">Daily digest</option></select></label>
          </div>
          {notice && <p role="status" className="text-sm text-emerald-100">{notice}</p>}
          {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
          <button type="submit" disabled={saving} className="rounded-full border border-[#C9A96E]/50 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#C9A96E] disabled:opacity-50">{saving ? 'Saving…' : 'Save preferences'}</button>
        </>
      )}
    </form>
  );
}
