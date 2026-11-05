import { calculateQuote, getSlotPricing } from '@/lib/booking/engine';
import { addDays, startOfDay, toDateKey } from '@/lib/booking/utils';
import { VOUCHER_VALIDITY_DAYS, pointsForAmount } from './utils';

// Skor gross dari yang terlama ke terbaru
const GROSS_SCORES = [92, 89, 91, 87, 90, 86, 88, 93, 85, 89, 87, 84, 90, 86, 88, 85, 87, 84, 86, 83];
const PAST_TIMES = ['07:10', '07:30', '08:00', '07:20', '11:40', '07:50', '08:10', '07:40'];
const PAST_PLAYERS = [4, 2, 4, 3, 4, 2, 4, 4];

function createBooking({ id, dateKey, time, players, caddy, buggy, extras, status }) {
  const slot = getSlotPricing(dateKey, time);
  const quote = calculateQuote({ slot, players, caddy, buggy, extras });
  const code = (id * 48611 + 729000).toString(36).toUpperCase().padStart(6, '0').slice(-6);

  return {
    id: `booking-${id}`,
    reference: `DIG-${code}`,
    dateKey,
    time,
    players,
    caddy,
    buggy,
    extras,
    status,
    total: quote.total,
    greenFee: quote.lines[0].amount,
  };
}

// Ganti dengan data dari GET /api/member/me (profil, rounds, bookings, ledger, vouchers, wallet)
export function buildMemberData(now) {
  const today = startOfDay(now);
  const dayKey = (offset) => toDateKey(addDays(today, offset));

  const rounds = GROSS_SCORES.map((gross, index) => {
    const isNewest = index === GROSS_SCORES.length - 1;
    return {
      id: `round-${String(index + 1).padStart(2, '0')}`,
      dateKey: dayKey(-(7 + (GROSS_SCORES.length - 1 - index) * 9)),
      gross,
      verified: !isNewest,
      source: isNewest ? 'self' : index % 3 === 0 ? 'marshal' : 'caddy',
    };
  });

  const pastBookings = rounds.slice(-8).map((round, index) =>
    createBooking({
      id: index + 1,
      dateKey: round.dateKey,
      time: PAST_TIMES[index],
      players: PAST_PLAYERS[index],
      caddy: index % 2 === 0 ? 'standard' : 'senior',
      buggy: true,
      extras: index % 3 === 0 ? { halfwayOrder: PAST_PLAYERS[index] } : {},
      status: 'completed',
    }),
  );

  const upcomingBookings = [
    createBooking({
      id: 20,
      dateKey: dayKey(4),
      time: '07:10',
      players: 4,
      caddy: 'senior',
      buggy: true,
      extras: { rangeWarmup: 4 },
      status: 'confirmed',
    }),
    createBooking({
      id: 21,
      dateKey: dayKey(19),
      time: '07:30',
      players: 2,
      caddy: 'standard',
      buggy: true,
      extras: {},
      status: 'confirmed',
    }),
  ];

  const ledger = [
    { id: 'welcome', dateKey: dayKey(-190), label: 'Welcome bonus', points: 1000, type: 'bonus' },
    { id: 'carry', dateKey: dayKey(-150), label: 'Points from earlier rounds', points: 1800, type: 'bonus' },
    ...pastBookings.map((booking) => ({
      id: `earn-${booking.id}`,
      dateKey: booking.dateKey,
      label: `Round ${booking.reference}`,
      points: pointsForAmount(booking.total),
      type: 'earn',
    })),
    {
      id: 'redeem-seed',
      dateKey: dayKey(-30),
      label: 'Redeemed: Driving Range Bucket',
      points: -500,
      type: 'redeem',
    },
  ];

  const vouchers = [
    {
      id: 'voucher-seed',
      label: 'Driving Range Bucket',
      source: 'Points redemption',
      dateKey: dayKey(-30),
      validUntil: dayKey(VOUCHER_VALIDITY_DAYS - 30),
    },
  ];

  return {
    member: {
      name: 'Rizky Pratama',
      memberId: 'DIG-0427-18',
      sinceKey: dayKey(-420),
    },
    rounds,
    bookings: [...upcomingBookings, ...pastBookings],
    ledger,
    vouchers,
    wallet: 1250000,
  };
}

export function fetchMemberData(now, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => resolve(buildMemberData(now)), 500);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}