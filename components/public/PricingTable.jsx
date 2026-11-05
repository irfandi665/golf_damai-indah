'use client';

import { useEffect, useState } from 'react';

const currency = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export default function PricingTable() {
  const [pricing, setPricing] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/pricing', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail || 'Pricing is unavailable.');
        return body;
      })
      .then(setPricing)
      .catch((reason) => setError(reason.message));
  }, []);

  if (error) return <p role="alert" className="rounded-xl border border-red-300/30 bg-red-950/20 p-5 text-sm text-red-100">{error}</p>;
  if (!pricing) return <p role="status" className="text-sm text-[#F6F2EA]/60">Loading current rates…</p>;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-[family-name:var(--font-heading)] text-3xl">Green fees</h2>
        <div className="mt-5 overflow-hidden rounded-2xl border border-[#C9A96E]/20">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-white/[0.05] text-xs uppercase tracking-[0.18em] text-[#C9A96E]">
                <tr><th className="px-5 py-4">Day</th><th className="px-5 py-4">Tee time</th><th className="px-5 py-4">Rate band</th><th className="px-5 py-4 text-right">Per player</th></tr>
              </thead>
              <tbody className="divide-y divide-[#C9A96E]/10">
                {pricing.rates.map((rate, index) => (
                  <tr key={`${rate.dayType}-${rate.startTime}-${index}`} className="text-[#F6F2EA]/80">
                    <td className="px-5 py-4 capitalize">{rate.dayType}</td>
                    <td className="px-5 py-4 tabular-nums">{rate.startTime}–{rate.endTime}</td>
                    <td className="px-5 py-4 capitalize">{rate.tier}</td>
                    <td className="px-5 py-4 text-right tabular-nums">{currency.format(rate.pricePerPlayer)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 text-xs text-[#F6F2EA]/45">Rates shown are the active system rate cards and may be updated by the club.</p>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-heading)] text-3xl">Caddy & services</h2>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pricing.services.map((service) => (
            <li key={service.code} className="rounded-xl border border-[#C9A96E]/15 bg-white/[0.03] p-5">
              <p className="text-sm font-medium">{service.label}</p>
              <p className="mt-2 text-lg font-semibold text-[#C9A96E]">{currency.format(service.price)}</p>
              <p className="mt-1 text-xs text-[#F6F2EA]/45">Billed {service.unit.replaceAll('_', ' ')}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="rounded-xl border border-[#C9A96E]/30 bg-[#C9A96E]/10 p-5 text-sm leading-relaxed text-[#F6F2EA]/80">
        {pricing.paymentDisclaimer}
      </p>
    </div>
  );
}
