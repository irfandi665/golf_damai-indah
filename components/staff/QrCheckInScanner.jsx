'use client';

import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '@/lib/api-client';

const fieldClass = 'mt-2 w-full rounded-xl border border-[#C9A96E]/25 bg-[#0F2A20] px-3 py-2.5 text-sm text-[#F6F2EA] focus:border-[#C9A96E] focus:outline-none';
const buttonClass = 'rounded-full border border-[#C9A96E]/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#C9A96E] hover:bg-[#C9A96E] hover:text-[#0F2A20] disabled:opacity-50';

function extractTicket(value) {
  const raw = String(value || '').trim();
  try {
    const url = new URL(raw);
    return url.searchParams.get('ticket') || raw;
  } catch {
    return raw;
  }
}

export default function QrCheckInScanner({ onCheckedIn }) {
  const videoRef = useRef(null);
  const controlsRef = useRef(null);
  const handledScanRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [ticketInput, setTicketInput] = useState('');
  const [ticket, setTicket] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => controlsRef.current?.stop(), []);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('ticket');
    if (!token) return;
    setTicketInput(token);
    window.history.replaceState(null, '', '/staff');
    void validate(token);
  }, []);

  async function validate(rawTicket) {
    const token = extractTicket(rawTicket);
    if (!token) {
      setError('QR ticket is empty or invalid.');
      return;
    }
    setBusy(true);
    setError('');
    setResult(null);
    setTicket(token);
    try {
      const validation = await apiRequest('/api/v1/staff/tickets/validate', {
        method: 'POST',
        body: { qrToken: token },
      });
      setResult(validation);
    } catch (reason) {
      setError(reason.message || 'Could not validate this booking ticket.');
    } finally {
      setBusy(false);
    }
  }

  async function startCamera() {
    setError('');
    setResult(null);
    handledScanRef.current = false;
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (decoded) => {
        if (!decoded || handledScanRef.current) return;
        handledScanRef.current = true;
        controlsRef.current?.stop();
        setScanning(false);
        const value = decoded.getText();
        setTicketInput(value);
        void validate(value);
      });
      controlsRef.current = controls;
      setScanning(true);
    } catch (reason) {
      setScanning(false);
      setError(reason.message || 'Camera access is unavailable. Use the manual ticket field instead.');
    }
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setScanning(false);
  }

  async function checkIn() {
    setBusy(true);
    setError('');
    try {
      const checkedIn = await apiRequest('/api/v1/staff/check-in', {
        method: 'POST',
        body: { qrToken: ticket },
      });
      setResult({
        valid: false,
        code: 'checked_in',
        message: 'Checked in successfully.',
        booking: {
          ...result.booking,
          attendanceStatus: checkedIn.status,
          checkedInAt: checkedIn.checkedInAt,
        },
      });
      onCheckedIn?.();
    } catch (reason) {
      setError(reason.message || 'Check-in could not be completed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] p-6">
      <div>
        <h2 className="font-[family-name:var(--font-heading)] text-2xl">QR check-in</h2>
        <p className="mt-1 text-xs text-[#F6F2EA]/55">Scan a booking e-ticket, review the details, then confirm arrival.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {!scanning ? (
          <button type="button" onClick={startCamera} disabled={busy} className={buttonClass}>Start camera scanner</button>
        ) : (
          <button type="button" onClick={stopCamera} className={buttonClass}>Stop camera</button>
        )}
      </div>
      <video
        ref={videoRef}
        aria-label="Live camera preview for booking QR scanner"
        muted
        playsInline
        className={`aspect-video w-full max-w-xl rounded-xl bg-black object-cover ${scanning ? '' : 'hidden'}`}
      />
      <form onSubmit={(event) => { event.preventDefault(); void validate(ticketInput); }} className="space-y-3">
        <label className="block text-xs text-[#F6F2EA]/60" htmlFor="booking-ticket">Or paste the ticket URL / QR content
          <textarea id="booking-ticket" value={ticketInput} onChange={(event) => setTicketInput(event.target.value)} maxLength={2048} rows={2} className={fieldClass} />
        </label>
        <button type="submit" disabled={busy || !ticketInput.trim()} className={buttonClass}>Validate ticket</button>
      </form>

      {error && <p role="alert" className="rounded-xl border border-red-300/30 bg-red-950/20 p-3 text-sm text-red-100">{error}</p>}
      {result && (
        <div role="status" aria-live="polite" className={`rounded-xl border p-4 ${result.valid ? 'border-emerald-300/30 bg-emerald-950/20' : 'border-[#C9A96E]/20 bg-[#0F2A20]/40'}`}>
          <p className={`font-semibold ${result.valid ? 'text-emerald-100' : 'text-[#F6F2EA]'}`}>
            {result.valid ? 'Booking Valid' : result.code === 'already_used' || result.code === 'checked_in' ? 'Booking Sudah Digunakan' : 'Booking Tidak Valid'}
          </p>
          <p className="mt-1 text-sm text-[#F6F2EA]/65">{result.message}</p>
          {result.booking && (
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              <div><dt className="text-[#F6F2EA]/45">Pemain</dt><dd className="mt-1">{result.booking.guestName}</dd></div>
              <div><dt className="text-[#F6F2EA]/45">Tee-off</dt><dd className="mt-1">{result.booking.teeTime}</dd></div>
              <div><dt className="text-[#F6F2EA]/45">Pemain / golfer</dt><dd className="mt-1">{result.booking.players}</dd></div>
              <div><dt className="text-[#F6F2EA]/45">Pembayaran</dt><dd className="mt-1">{result.booking.paymentStatus === 'paid' ? 'Lunas' : result.booking.paymentStatus === 'down_payment' ? 'Down payment' : 'Belum dibayar'}</dd></div>
              <div><dt className="text-[#F6F2EA]/45">Status</dt><dd className="mt-1">{result.booking.attendanceStatus}</dd></div>
              {result.booking.checkedInAt && <div><dt className="text-[#F6F2EA]/45">Waktu check-in</dt><dd className="mt-1">{new Date(result.booking.checkedInAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</dd></div>}
            </dl>
          )}
          {result.valid && (
            <button type="button" onClick={checkIn} disabled={busy} className={`${buttonClass} mt-4`}>Check in / Sudah datang</button>
          )}
        </div>
      )}
    </section>
  );
}
