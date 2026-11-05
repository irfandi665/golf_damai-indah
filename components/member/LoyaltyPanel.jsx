'use client';

import { useState } from 'react';
import { formatCurrency } from '@/lib/booking/utils';
import Panel from './Panel';
import {
  REWARDS,
  formatNumber,
  formatShortDate,
} from '@/lib/member/utils';

export default function LoyaltyPanel({
  points,
  tier,
  cashback,
  wallet,
  ledger,
  vouchers,
  dispatch,
  todayKey,
  voucherValidUntil,
}) {
  const [pendingId, setPendingId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const sortedLedger = [...ledger].sort(
    (a, b) => b.dateKey.localeCompare(a.dateKey) || b.id.localeCompare(a.id),
  );
  const visibleLedger = showAll ? sortedLedger : sortedLedger.slice(0, 5);

  const redeem = (rewardId) => {
    dispatch({
      type: 'REDEEM',
      rewardId,
      id: String(Date.now()),
      todayKey,
      validUntil: voucherValidUntil,
    });
    setPendingId(null);
  };

  return (
    <Panel id="loyalty" eyebrow="Rewards" title="Points & Cashback">
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#C9A96E]/30 bg-[#C9A96E]/10 p-5">
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">Points</p>
          <p className="mt-3 font-[family-name:var(--font-heading)] text-4xl font-semibold tabular-nums leading-none text-[#F6F2EA]">
            {formatNumber(points)}
          </p>
        </div>
        <div className="rounded-xl border border-[#C9A96E]/20 bg-white/[0.03] p-5">
          <p className="text-[0.62rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">Cashback 12M</p>
          <p className="mt-3 font-[family-name:var(--font-heading)] text-3xl font-semibold tabular-nums leading-none text-[#F6F2EA]">
            {formatCurrency(cashback)}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-[#F6F2EA]/50">
        {tier.label} members earn {Math.round(tier.cashbackRate * 100)}% cashback as Fairway Wallet credit. Current wallet balance: {formatCurrency(wallet)}, applied automatically at check-in.
      </p>

      {/* Rewards */}
      <h3 className="mt-9 text-[0.65rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">Redeem</h3>
      <ul className="mt-4 space-y-3">
        {REWARDS.map((reward) => {
          const affordable = points >= reward.cost;
          const pending = pendingId === reward.id;
          const percent = Math.min(100, (points / reward.cost) * 100);

          return (
            <li key={reward.id} className="rounded-xl border border-[#C9A96E]/15 bg-[#0F2A20]/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#F6F2EA]">{reward.label}</p>
                  <p className="mt-1 text-xs text-[#F6F2EA]/55">{reward.description}</p>
                </div>
                <p className="flex-none text-sm font-semibold tabular-nums text-[#C9A96E]">
                  {formatNumber(reward.cost)}
                  <span className="ml-1 text-xs font-normal text-[#F6F2EA]/50">pts</span>
                </p>
              </div>

              {!affordable && (
                <div className="mt-3">
                  <div
                    role="progressbar"
                    aria-label={`Progres poin untuk ${reward.label}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(percent)}
                    className="h-1 overflow-hidden rounded-full bg-[#F6F2EA]/10"
                  >
                    <div className="h-full rounded-full bg-[#C9A96E]/70" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="mt-2 text-xs tabular-nums text-[#F6F2EA]/45">
                    {formatNumber(reward.cost - points)} more points needed
                  </p>
                </div>
              )}

              {affordable && (
                <div className="mt-3 flex items-center gap-3">
                  {pending ? (
                    <>
                      <button
                        type="button"
                        onClick={() => redeem(reward.id)}
                        className="rounded-full bg-[#C9A96E] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20] transition-colors hover:bg-[#d8bb84] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6F2EA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F2A20]"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingId(null)}
                        className="text-xs uppercase tracking-[0.2em] text-[#F6F2EA]/60 underline decoration-[#C9A96E]/40 underline-offset-4 hover:text-[#F6F2EA] focus-visible:outline-none focus-visible:text-[#C9A96E]"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setPendingId(reward.id)}
                      aria-label={`Tukar ${formatNumber(reward.cost)} poin untuk ${reward.label}`}
                      className="rounded-full border border-[#C9A96E] px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#C9A96E] transition-colors hover:bg-[#C9A96E] hover:text-[#0F2A20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E]"
                    >
                      Redeem
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Vouchers */}
      <h3 className="mt-9 text-[0.65rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">
        My Vouchers ({vouchers.length})
      </h3>
      {vouchers.length === 0 ? (
        <p className="mt-3 text-sm text-[#F6F2EA]/50">Redeemed rewards and rain-check credits appear here.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {vouchers.map((voucher) => (
            <li
              key={voucher.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-dashed border-[#C9A96E]/40 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-[#F6F2EA]">{voucher.label}</p>
                <p className="mt-0.5 text-xs text-[#F6F2EA]/50">{voucher.source}</p>
              </div>
              <p className="flex-none text-right text-xs tabular-nums text-[#F6F2EA]/60">
                Valid until
                <span className="block text-[#C9A96E]">{formatShortDate(voucher.validUntil)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-[#F6F2EA]/45">Show your member ID at the starter counter and the voucher is applied to your round.</p>

      {/* Ledger */}
      <h3 className="mt-9 text-[0.65rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">Points Activity</h3>
      <ul className="mt-3 divide-y divide-[#C9A96E]/10">
        {visibleLedger.map((entry) => (
          <li key={entry.id} className="flex items-center justify-between gap-4 py-3 text-sm">
            <div className="min-w-0">
              <p className="truncate text-[#F6F2EA]/85">{entry.label}</p>
              <p className="text-xs text-[#F6F2EA]/45">{formatShortDate(entry.dateKey)}</p>
            </div>
            <p
              className={`flex-none font-semibold tabular-nums ${
                entry.points < 0 ? 'text-[#F6F2EA]/60' : 'text-emerald-300'
              }`}
            >
              {entry.points > 0 ? '+' : '−'}
              {formatNumber(Math.abs(entry.points))}
            </p>
          </li>
        ))}
      </ul>
      {sortedLedger.length > 5 && (
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          aria-expanded={showAll}
          className="mt-3 text-xs uppercase tracking-[0.2em] text-[#F6F2EA]/60 underline decoration-[#C9A96E]/40 underline-offset-4 transition-colors hover:text-[#C9A96E] focus-visible:outline-none focus-visible:text-[#C9A96E]"
        >
          {showAll ? 'Show Less' : `Show All (${sortedLedger.length})`}
        </button>
      )}
    </Panel>
  );
}