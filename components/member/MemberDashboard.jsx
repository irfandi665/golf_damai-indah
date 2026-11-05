'use client';

import { useEffect, useMemo, useReducer, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import BookingHistory from './BookingHistory';
import HandicapPanel from './HandicapPanel';
import LoyaltyPanel from './LoyaltyPanel';
import ProfileHeader from './ProfileHeader';
import TierCard from './TierCard';
import { addDays, startOfDay, toDateKey } from '@/lib/booking/utils';
import { fetchMemberData } from '@/lib/member/data';
import { apiRequest, newIdempotencyKey } from '@/lib/api-client';
import Link from 'next/link';
import { memberReducer } from '@/lib/member/reducer';
import {
  VOUCHER_VALIDITY_DAYS,
  buildHandicapTrend,
  calculateCashback,
  calculateHandicap,
  countQualifyingRounds,
  getPointsBalance,
  getTierProgress,
} from '@/lib/member/utils';

function MemberNavigation() {
  const links = [
    ['Overview', '#member-heading'],
    ['Bookings', '#bookings'],
    ['Handicap', '#handicap'],
    ['Loyalty', '#loyalty'],
  ];
  return (
    <nav aria-label="Member sections" className="mx-auto max-w-7xl px-6 pt-24 lg:px-10 lg:pt-28">
      <div className="flex flex-wrap items-center gap-2 border-b border-[#C9A96E]/15 pb-4">
        {links.map(([label, href]) => (
          <a key={href} href={href} className="rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[#F6F2EA]/60 hover:bg-white/[0.05] hover:text-[#C9A96E]">
            {label}
          </a>
        ))}
        <Link href="/member/profile" className="rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] text-[#F6F2EA]/60 hover:bg-white/[0.05] hover:text-[#C9A96E]">
          Profile & security
        </Link>
        <Link href="/booking" className="ml-auto rounded-full bg-[#C9A96E] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#0F2A20]">
          Book a round
        </Link>
      </div>
    </nav>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-7xl px-6 pb-24 pt-32 lg:px-10 lg:pt-40">
      <p className="sr-only" role="status">Memuat dashboard member…</p>
      <div className="flex items-center gap-5">
        <div className="h-20 w-20 animate-pulse rounded-full bg-white/[0.06]" />
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-10 w-72 animate-pulse rounded bg-white/[0.06]" />
        </div>
      </div>
      <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" />
        ))}
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="h-[36rem] animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="h-[36rem] animate-pulse rounded-2xl bg-white/[0.04]" />
      </div>
    </div>
  );
}

function DashboardView({ data, now, onRefresh }) {
  const [state, dispatch] = useReducer(memberReducer, data, (initial) => ({
    ...initial,
    notice: null,
  }));
  const [announcements, setAnnouncements] = useState([]);
  const [announcementError, setAnnouncementError] = useState(false);

  useEffect(() => {
    fetch('/api/v1/announcements', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Announcements unavailable.');
        return response.json();
      })
      .then(setAnnouncements)
      .catch(() => setAnnouncementError(true));
  }, []);

  const dispatchToApi = async (action) => {
    try {
      if (action.type === 'LOG_ROUND') {
        const result = await apiRequest('/api/v1/me/rounds', {
          method: 'POST',
          body: { playedOn: action.dateKey, grossScore: action.gross },
        });
        dispatch({
          ...action,
          id: result.round.id,
          dateKey: result.round.playedOn,
          gross: result.round.grossScore,
        });
        onRefresh();
        return;
      }

      if (action.type === 'CANCEL_BOOKING') {
        await apiRequest(`/api/v1/bookings/${encodeURIComponent(action.bookingId)}/cancel`, {
          method: 'POST',
          idempotencyKey: newIdempotencyKey(),
        });
        dispatch(action);
        onRefresh();
        return;
      }

      if (action.type === 'REDEEM') {
        await apiRequest(`/api/v1/me/rewards/${encodeURIComponent(action.rewardId)}/redeem`, {
          method: 'POST',
          idempotencyKey: newIdempotencyKey(),
        });
        dispatch(action);
        onRefresh();
        return;
      }

      dispatch(action);
    } catch (error) {
      dispatch({ type: 'SHOW_NOTICE', message: error.message });
    }
  };

  const todayKey = toDateKey(now);
  const voucherValidUntil = toDateKey(addDays(startOfDay(now), VOUCHER_VALIDITY_DAYS));

  const handicap = useMemo(() => calculateHandicap(state.rounds), [state.rounds]);
  const trend = useMemo(() => buildHandicapTrend(state.rounds), [state.rounds]);
  const tierProgress = useMemo(
    () => getTierProgress(countQualifyingRounds(state.rounds, now)),
    [state.rounds, now],
  );
  const points = useMemo(() => getPointsBalance(state.ledger), [state.ledger]);
  const cashback = useMemo(
    () => calculateCashback(state.bookings, now, tierProgress.current.cashbackRate),
    [state.bookings, now, tierProgress.current.cashbackRate],
  );
  const nextBooking = useMemo(
    () =>
      state.bookings
        .filter((booking) => booking.status === 'confirmed')
        .sort((a, b) => `${a.dateKey}${a.time}`.localeCompare(`${b.dateKey}${b.time}`))[0] ?? null,
    [state.bookings],
  );

  // Notifikasi menghilang otomatis setelah 6 detik
  useEffect(() => {
    if (!state.notice) return undefined;
    const timer = setTimeout(() => dispatch({ type: 'DISMISS_NOTICE' }), 6000);
    return () => clearTimeout(timer);
  }, [state.notice]);

  return (
    <MotionConfig reducedMotion="user">
      <MemberNavigation />
      <section
        aria-labelledby="member-heading"
        className="mx-auto max-w-7xl px-6 pb-24 pt-8 lg:px-10"
      >
        {(announcements.length > 0 || announcementError) && (
          <section aria-label="Club announcements" className="mb-8 space-y-3">
            {announcementError && <p role="status" className="text-sm text-amber-100">Club announcements are temporarily unavailable.</p>}
            {announcements.map((announcement) => (
              <article key={announcement.id} className="rounded-xl border border-[#C9A96E]/25 bg-[#C9A96E]/[0.07] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-[#C9A96E]">Club announcement</p>
                <h2 className="mt-2 text-base font-semibold">{announcement.title}</h2>
                <p className="mt-1 text-sm text-[#F6F2EA]/65">{announcement.message}</p>
                {announcement.href && <Link href={announcement.href} className="mt-3 inline-block text-xs text-[#C9A96E] underline underline-offset-4">Learn more</Link>}
              </article>
            ))}
          </section>
        )}
        <ProfileHeader
          member={state.member}
          now={now}
          tier={tierProgress.current}
          handicapIndex={handicap.index}
          points={points}
          wallet={state.wallet}
          nextBooking={nextBooking}
        />

        <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-8">
            <HandicapPanel
              rounds={state.rounds}
              handicap={handicap}
              trend={trend}
              now={now}
              dispatch={dispatchToApi}
            />
            <BookingHistory
              bookings={state.bookings}
              now={now}
              dispatch={dispatchToApi}
              todayKey={todayKey}
              voucherValidUntil={voucherValidUntil}
            />
          </div>

          <div className="min-w-0 space-y-8">
            <TierCard progress={tierProgress} />
            <LoyaltyPanel
              points={points}
              tier={tierProgress.current}
              cashback={cashback}
              wallet={state.wallet}
              ledger={state.ledger}
              vouchers={state.vouchers}
              dispatch={dispatchToApi}
              todayKey={todayKey}
              voucherValidUntil={voucherValidUntil}
            />
          </div>
        </div>
      </section>

      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
        <AnimatePresence>
          {state.notice && (
            <motion.div
              key={state.notice}
              role="status"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="pointer-events-auto flex max-w-xl items-start gap-4 rounded-2xl border border-[#C9A96E]/40 bg-[#0F2A20]/95 px-6 py-4 text-sm text-[#F6F2EA] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-xl"
            >
              <p className="flex-1 leading-relaxed">{state.notice}</p>
              <button
                type="button"
                onClick={() => dispatch({ type: 'DISMISS_NOTICE' })}
                aria-label="Tutup notifikasi"
                className="flex-none text-lg leading-none text-[#F6F2EA]/60 transition-colors hover:text-[#C9A96E] focus-visible:outline-none focus-visible:text-[#C9A96E]"
              >
                ×
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

// Waktu "sekarang" diambil di client setelah mount agar tidak terjadi hydration mismatch
export default function MemberDashboard() {
  const [now, setNow] = useState(null);
  const [load, setLoad] = useState({ status: 'loading', data: null });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    setNow(new Date());
  }, []);

  useEffect(() => {
    if (!now) return undefined;
    const controller = new AbortController();
    setLoad({ status: 'loading', data: null });

    fetchMemberData(now, { signal: controller.signal })
      .then((data) => setLoad({ status: 'ready', data }))
      .catch((error) => {
        if (error.name !== 'AbortError') setLoad({ status: 'error', data: null, error });
      });

    return () => controller.abort();
  }, [now, reloadToken]);

  if (!now || load.status === 'loading') return <DashboardSkeleton />;

  if (load.status === 'error') {
    return (
      <div className="mx-auto max-w-xl px-6 pb-24 pt-40 text-center">
        <div role="alert" className="rounded-2xl border border-red-300/30 bg-red-950/20 p-8">
          <p className="text-sm text-[#F6F2EA]/85">
            {load.error?.status === 401
              ? 'Sign in to view your member dashboard.'
              : load.error?.status === 503
                ? 'The member service is not configured yet. Contact the club or try again later.'
                : 'We could not load your member dashboard. Check your connection and try again.'}
          </p>
          {load.error?.status === 401 ? (
            <Link href="/member/login" className="mt-5 inline-block rounded-full bg-[#C9A96E] px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#0F2A20]">
              Sign In
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setReloadToken((value) => value + 1)}
              className="mt-5 rounded-full border border-[#C9A96E] px-7 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#C9A96E] transition-colors hover:bg-[#C9A96E] hover:text-[#0F2A20] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E]"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    );
  }

  return <DashboardView data={load.data} now={now} onRefresh={() => setReloadToken((value) => value + 1)} />;
}