'use client';

import { useState } from 'react';
import QRCode from 'qrcode';
import { apiRequest } from '@/lib/api-client';

export default function BookingQr({ bookingId }) {
  const [qr, setQr] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const { qrToken, expiresAt } = await apiRequest(`/api/v1/bookings/${encodeURIComponent(bookingId)}/qr`);
      const dataUrl = await QRCode.toDataURL(qrToken, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 240,
        color: { dark: '#0F2A20', light: '#FFFFFF' },
      });
      setQr({ dataUrl, expiresAt });
    } catch (reason) {
      setError(reason.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      {!qr ? (
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded-full border border-[#C9A96E]/50 px-5 py-2.5 text-xs font-medium uppercase tracking-[0.2em] text-[#C9A96E] hover:bg-[#C9A96E] hover:text-[#0F2A20] disabled:opacity-50"
        >
          {loading ? 'Preparing QR…' : 'Show check-in QR'}
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-[#C9A96E]/20 bg-white/[0.03] p-4">
          <img src={qr.dataUrl} alt="Booking check-in QR code" width="120" height="120" className="rounded-lg" />
          <div className="max-w-xs">
            <p className="text-sm text-[#F6F2EA]">Show this code to staff at check-in.</p>
            <p className="mt-2 text-xs text-[#F6F2EA]/50">This secure code expires at {new Date(qr.expiresAt).toLocaleTimeString()}.</p>
            <button type="button" onClick={refresh} disabled={loading} className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-[#C9A96E] underline underline-offset-4">
              {loading ? 'Refreshing…' : 'Refresh QR'}
            </button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
