'use client';

import { useState } from 'react';
import { apiRequest } from '@/lib/api-client';

const fieldClass = 'mt-2 w-full rounded-lg border border-[#C9A96E]/20 bg-[#0F2A20] px-3 py-2 text-xs text-[#F6F2EA] focus:border-[#C9A96E] focus:outline-none';
const buttonClass = 'mt-2 rounded-full border border-[#C9A96E]/40 px-3 py-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[#C9A96E] hover:bg-[#C9A96E] hover:text-[#0F2A20]';

function ServiceControl({ booking, serviceType, readiness, onUpdate }) {
  const service = readiness.find((item) => item.serviceType === serviceType);
  const [assignedTo, setAssignedTo] = useState(service?.assignedTo || '');
  const [note, setNote] = useState(service?.note || '');
  const [error, setError] = useState('');

  async function save(status) {
    setError('');
    try {
      await apiRequest(`/api/v1/staff/bookings/${encodeURIComponent(booking.id)}/services`, {
        method: 'PUT',
        body: { serviceType, status, assignedTo, note },
      });
      onUpdate();
    } catch (reason) {
      setError(reason.message);
    }
  }

  return (
    <div className="rounded-lg border border-[#C9A96E]/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium capitalize">{serviceType} · {service?.status === 'ready' ? 'Ready' : 'Pending'}</p>
        <button type="button" className={buttonClass} onClick={() => save(service?.status === 'ready' ? 'pending' : 'ready')}>
          Mark {service?.status === 'ready' ? 'pending' : 'ready'}
        </button>
      </div>
      <label className="mt-2 block text-[0.65rem] text-[#F6F2EA]/55">
        Assigned person / unit
        <input value={assignedTo} maxLength={120} onChange={(event) => setAssignedTo(event.target.value)} className={fieldClass} />
      </label>
      <label className="mt-2 block text-[0.65rem] text-[#F6F2EA]/55">
        Preparation note
        <input value={note} maxLength={500} onChange={(event) => setNote(event.target.value)} className={fieldClass} />
      </label>
      <button type="button" className={buttonClass} onClick={() => save(service?.status || 'pending')}>Save assignment</button>
      {error && <p role="alert" className="mt-2 text-xs text-red-200">{error}</p>}
      {service?.updatedBy && <p className="mt-2 text-[0.6rem] text-[#F6F2EA]/40">Updated by {service.updatedBy} · {new Date(service.updatedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>}
    </div>
  );
}

export default function BookingOperationsPanel({ booking, onUpdate }) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const readiness = booking.services || [];

  async function addNote(event) {
    event.preventDefault();
    setError('');
    try {
      await apiRequest(`/api/v1/staff/bookings/${encodeURIComponent(booking.id)}/notes`, {
        method: 'POST',
        body: { note },
      });
      setNote('');
      onUpdate();
    } catch (reason) {
      setError(reason.message);
    }
  }

  return (
    <details className="mt-3 border-t border-[#C9A96E]/10 pt-3">
      <summary className="cursor-pointer text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-[#C9A96E]">Operations & notes</summary>
      <div className="mt-3 space-y-3">
        <form onSubmit={addNote}>
          <label className="block text-[0.65rem] text-[#F6F2EA]/55">
            Add staff-only note
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} rows={2} required className={fieldClass} />
          </label>
          <button type="submit" className={buttonClass}>Add note</button>
          {error && <p role="alert" className="mt-2 text-xs text-red-200">{error}</p>}
        </form>
        {(booking.notes || []).length > 0 && (
          <ul className="space-y-2">
            {booking.notes.map((entry) => (
              <li key={entry.id} className="rounded-lg bg-white/[0.03] p-2 text-xs">
                <p className="whitespace-pre-wrap">{entry.note}</p>
                <p className="mt-1 text-[0.6rem] text-[#F6F2EA]/40">{entry.author} · {new Date(entry.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
              </li>
            ))}
          </ul>
        )}
        {booking.caddyCode && <ServiceControl booking={booking} serviceType="caddy" readiness={readiness} onUpdate={onUpdate} />}
        {booking.buggy && <ServiceControl booking={booking} serviceType="buggy" readiness={readiness} onUpdate={onUpdate} />}
      </div>
    </details>
  );
}
