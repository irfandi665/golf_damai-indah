'use client';

import { useState } from 'react';
import { useLocale } from '@/components/i18n/LocaleProvider';

const fields = 'w-full rounded-xl border border-[#C9A96E]/25 bg-[#0F2A20]/70 px-4 py-3 text-sm text-[#F6F2EA] placeholder:text-[#F6F2EA]/30 focus:border-[#C9A96E] focus:outline-none focus:ring-2 focus:ring-[#C9A96E]/40';

export default function InquiryForm({ type, title = 'Contact the club' }) {
  const { text } = useLocale();
  const [state, setState] = useState({ status: 'idle', message: '' });

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setState({ status: 'sending', message: '' });
    try {
      const response = await fetch('/api/v1/inquiries', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...values, type }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || text('We could not submit your inquiry.', 'Permintaan Anda belum dapat dikirim.'));
      setState({
        status: 'sent',
        message: result.emailNotification === 'sent'
          ? text('Thank you. Your inquiry was received and the club was notified by email.', 'Terima kasih. Permintaan Anda telah diterima dan klub sudah diberi tahu melalui email.')
          : text('Thank you. Your inquiry was saved for the club team. Email notification is pending configuration.', 'Terima kasih. Permintaan Anda telah tersimpan untuk tim klub. Notifikasi email menunggu konfigurasi.'),
      });
      form.reset();
    } catch (error) {
      setState({ status: 'error', message: error.message });
    }
  }

  return (
    <section className="rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6 sm:p-8">
      <p className="text-xs font-medium uppercase tracking-[0.3em] text-[#C9A96E]">
        {({
          'Contact the club': text('Contact the club', 'Hubungi klub'),
          'Event interest / Minat acara': text('Event interest', 'Minat acara'),
          'Lesson inquiry / Pertanyaan les': text('Lesson inquiry', 'Pertanyaan les'),
          'Send a message / Kirim pesan': text('Send a message', 'Kirim pesan'),
        })[title] || title}
      </p>
      {state.message && (
        <p role={state.status === 'error' ? 'alert' : 'status'} className={`mt-4 text-sm ${state.status === 'error' ? 'text-red-300' : 'text-emerald-200'}`}>
          {state.message}
        </p>
      )}
      {state.status !== 'sent' && (
        <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-xs text-[#F6F2EA]/65">
            {text('Name', 'Nama')}
            <input name="name" required minLength={2} maxLength={120} className={`${fields} mt-2`} autoComplete="name" />
          </label>
          <label className="text-xs text-[#F6F2EA]/65">
            Email
            <input name="email" type="email" required maxLength={254} className={`${fields} mt-2`} autoComplete="email" />
          </label>
          <label className="text-xs text-[#F6F2EA]/65">
            {text('Phone (optional)', 'Nomor telepon (opsional)')}
            <input name="phone" type="tel" maxLength={24} className={`${fields} mt-2`} autoComplete="tel" />
          </label>
          <label className="text-xs text-[#F6F2EA]/65">
            {text('Subject', 'Subjek')}
            <input name="subject" required minLength={2} maxLength={160} className={`${fields} mt-2`} />
          </label>
          <label className="text-xs text-[#F6F2EA]/65 sm:col-span-2">
            {text('Message', 'Pesan')}
            <textarea name="message" required minLength={10} maxLength={2000} rows={4} className={`${fields} mt-2`} />
          </label>
          <button
            type="submit"
            disabled={state.status === 'sending'}
            className="rounded-full bg-[#C9A96E] px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20] transition-colors hover:bg-[#d8bb84] disabled:cursor-wait disabled:opacity-60 sm:col-span-2 sm:justify-self-start"
          >
            {state.status === 'sending' ? text('Sending…', 'Mengirim…') : text('Send inquiry', 'Kirim permintaan')}
          </button>
        </form>
      )}
      <p className="mt-5 text-xs leading-relaxed text-[#F6F2EA]/40">
        {text('By submitting, you agree that the club may use your details to respond to this inquiry.', 'Dengan mengirim formulir, Anda setuju klub menggunakan data Anda untuk menanggapi permintaan ini.')}
      </p>
    </section>
  );
}
