'use client';

import { useEffect, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

const fieldClass = 'mt-2 w-full rounded-xl border border-[#C9A96E]/25 bg-[#0F2A20] px-4 py-3 text-sm text-[#F6F2EA] focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40';

export default function WaitlistJoinForm({ slot, dateKey, players, onClose }) {
  const [member, setMember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiRequest('/api/v1/me').then(() => setMember(true)).catch(() => setMember(false));
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    setNotice('');
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await apiRequest('/api/v1/waitlist', {
        method: 'POST',
        body: { ...form, slotId: Number(slot.slotId), players },
      });
      setNotice(result.status === 'pending_verification'
        ? `Check ${form.email} and verify the address to activate your waitlist entry.`
        : result.status === 'held'
          ? 'You are on the waitlist. A tee time offer is being sent to your email.'
          : 'You are on the waitlist. We will email you if a suitable tee time opens.');
      if (result.emailNotification === 'queued') {
        setNotice((current) => `${current} Email delivery is pending club configuration.`);
      }
    } catch (reason) {
      setError(reason.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-xl border border-[#C9A96E]/25 bg-[#0F2A20]/70 p-5">
      <div>
        <h4 className="font-[family-name:var(--font-heading)] text-xl">Join the waitlist · {slot.time}</h4>
        <p className="mt-1 text-xs leading-relaxed text-[#F6F2EA]/55">
          {member
            ? `For ${players} player(s) on ${dateKey}. We will use your verified member contact details.`
            : `For ${players} player(s) on ${dateKey}. Verify your email before your entry becomes active.`}
          {' '}If a place opens, it is held for 10 minutes while you complete the reservation.
        </p>
      </div>
      {!member && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-[#F6F2EA]/65">Full name<input name="name" required minLength={2} maxLength={120} className={fieldClass} /></label>
          <label className="text-xs text-[#F6F2EA]/65">Mobile phone<input name="phone" type="tel" required className={fieldClass} /></label>
          <label className="text-xs text-[#F6F2EA]/65">Email<input name="email" type="email" required maxLength={254} className={fieldClass} /></label>
        </div>
      )}
      {notice && <p role="status" className="text-sm text-emerald-100">{notice}</p>}
      {error && <p role="alert" className="text-sm text-red-200">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={submitting || Boolean(notice)} className="rounded-full bg-[#C9A96E] px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-[#0F2A20] disabled:opacity-50">
          {submitting ? 'Joining…' : 'Join waitlist'}
        </button>
        <button type="button" onClick={onClose} className="rounded-full border border-[#F6F2EA]/25 px-5 py-2.5 text-xs text-[#F6F2EA]/70">
          Close
        </button>
      </div>
    </form>
  );
}
