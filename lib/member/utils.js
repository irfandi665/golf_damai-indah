import {
  CLUB_NAME,
  ROUND_DURATION_MINUTES,
  addDays,
  fromDateKey,
  minutesToTime,
  startOfDay,
  timeToMinutes,
  toDateKey,
} from '@/lib/booking/utils';

/* ---------- Konfigurasi (angka ilustrasi, sesuaikan dengan klub) ---------- */

export const COURSE = { name: 'Championship Course', rating: 73.1, slope: 134, par: 72 };
export const HANDICAP_WINDOW = 20;
export const MAX_INDEX = 54;
export const POINT_VALUE_IDR = 10000; // 1 poin per Rp10.000 belanja
export const FREE_CANCELLATION_HOURS = 24;
export const VOUCHER_VALIDITY_DAYS = 90;

export const TIERS = [
  {
    id: 'silver',
    label: 'Silver',
    minRounds: 0,
    cashbackRate: 0.01,
    advanceDays: 0,
    benefits: [
      'Standard 60-day booking window',
      '1% cashback to Fairway Wallet',
      'Points on every green fee, caddy and extra',
    ],
  },
  {
    id: 'gold',
    label: 'Gold',
    minRounds: 12,
    cashbackRate: 0.02,
    advanceDays: 7,
    benefits: [
      'Booking opens 7 days before the public',
      '2% cashback to Fairway Wallet',
      'Priority caddy requests',
      '2 guest passes per year',
    ],
  },
  {
    id: 'black',
    label: 'Black',
    minRounds: 30,
    cashbackRate: 0.03,
    advanceDays: 14,
    benefits: [
      'Booking opens 14 days before the public',
      '3% cashback to Fairway Wallet',
      'Priority access to prime-time tee times',
      'Dedicated concierge and 4 guest passes per year',
    ],
  },
];

export const REWARDS = [
  {
    id: 'range',
    label: 'Driving Range Bucket',
    description: 'One premium bucket to warm up before your round.',
    cost: 500,
  },
  {
    id: 'buggy',
    label: 'Complimentary Buggy',
    description: 'One cart on your next round, on us.',
    cost: 1200,
  },
  {
    id: 'clinic',
    label: '30-Minute Pro Clinic',
    description: 'One-to-one session with a resident professional.',
    cost: 3000,
  },
  {
    id: 'round',
    label: 'Complimentary Green Fee',
    description: 'One weekday green fee for one player.',
    cost: 5000,
  },
];

/* ---------- Formatter ---------- */

const intlLocale = (locale) => locale === 'id' ? 'id-ID' : 'en-GB';

export const formatShortDate = (dateKey, locale = 'en') =>
  new Intl.DateTimeFormat(intlLocale(locale), { day: 'numeric', month: 'short', year: 'numeric' }).format(fromDateKey(dateKey));
export const formatNumber = (value, locale = 'id') =>
  new Intl.NumberFormat(intlLocale(locale)).format(value);
export const formatDateTime = (date, locale = 'en') =>
  new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

export const getDateParts = (dateKey, locale = 'en') => {
  const date = fromDateKey(dateKey);
  const activeLocale = intlLocale(locale);
  return {
    day: date.getDate(),
    month: new Intl.DateTimeFormat(activeLocale, { month: 'short' }).format(date).toUpperCase(),
    weekday: new Intl.DateTimeFormat(activeLocale, { weekday: 'short' }).format(date),
  };
};

export const getGreeting = (now) => {
  const hour = now.getHours();
  if (hour < 11) return 'Good morning';
  if (hour < 15) return 'Good afternoon';
  return 'Good evening';
};

/* ---------- Handicap (indikatif, mengikuti pola World Handicap System) ---------- */
// Differential = (113 / Slope) × (Gross − Course Rating). Penyesuaian skor (mis. net double bogey) tidak dihitung.

const round1 = (value) => Math.round(value * 10) / 10;

export const calculateDifferential = (gross) =>
  round1((113 / COURSE.slope) * (gross - COURSE.rating));

function getSelectionRule(count) {
  if (count < 3) return null;
  if (count === 3) return { use: 1, adjustment: -2 };
  if (count === 4) return { use: 1, adjustment: -1 };
  if (count === 5) return { use: 1, adjustment: 0 };
  if (count === 6) return { use: 2, adjustment: -1 };
  if (count <= 8) return { use: 2, adjustment: 0 };
  if (count <= 11) return { use: 3, adjustment: 0 };
  if (count <= 14) return { use: 4, adjustment: 0 };
  if (count <= 16) return { use: 5, adjustment: 0 };
  if (count <= 18) return { use: 6, adjustment: 0 };
  if (count === 19) return { use: 7, adjustment: 0 };
  return { use: 8, adjustment: 0 };
}

const byDateAsc = (a, b) => a.dateKey.localeCompare(b.dateKey) || a.id.localeCompare(b.id);
const byDateDesc = (a, b) => byDateAsc(b, a);

export function calculateHandicap(rounds) {
  const recent = [...rounds].sort(byDateDesc).slice(0, HANDICAP_WINDOW);
  const rule = getSelectionRule(recent.length);

  if (!rule) return { index: null, counted: new Set(), used: 0, sample: recent.length };

  const best = recent
    .map((round) => ({ id: round.id, differential: calculateDifferential(round.gross) }))
    .sort((a, b) => a.differential - b.differential)
    .slice(0, rule.use);

  const average = best.reduce((sum, item) => sum + item.differential, 0) / rule.use;
  const index = Math.min(MAX_INDEX, Math.max(0, round1(average + rule.adjustment)));

  return {
    index,
    counted: new Set(best.map((item) => item.id)),
    used: rule.use,
    sample: recent.length,
  };
}

export function buildHandicapTrend(rounds) {
  const ordered = [...rounds].sort(byDateAsc);
  const points = [];
  for (let count = 3; count <= ordered.length; count += 1) {
    const { index } = calculateHandicap(ordered.slice(0, count));
    points.push({ dateKey: ordered[count - 1].dateKey, index });
  }
  return points;
}

/* ---------- Tier, poin, cashback ---------- */

// Hanya ronde terverifikasi (caddy/marshal) dalam 12 bulan terakhir yang dihitung untuk tier
export function countQualifyingRounds(rounds, now) {
  const cutoff = toDateKey(addDays(startOfDay(now), -365));
  return rounds.filter((round) => round.verified && round.dateKey >= cutoff).length;
}

export function getTierProgress(qualifyingRounds) {
  let currentIndex = 0;
  TIERS.forEach((tier, index) => {
    if (qualifyingRounds >= tier.minRounds) currentIndex = index;
  });

  const current = TIERS[currentIndex];
  const next = TIERS[currentIndex + 1] ?? null;
  const percent = next
    ? Math.min(
        100,
        ((qualifyingRounds - current.minRounds) / (next.minRounds - current.minRounds)) * 100,
      )
    : 100;

  return {
    current,
    next,
    percent,
    qualifyingRounds,
    remaining: next ? next.minRounds - qualifyingRounds : 0,
  };
}

export const pointsForAmount = (amount) => Math.floor(amount / POINT_VALUE_IDR);

export const getPointsBalance = (ledger) => ledger.reduce((sum, entry) => sum + entry.points, 0);

export function calculateCashback(bookings, now, rate) {
  const cutoff = toDateKey(addDays(startOfDay(now), -365));
  const spend = bookings
    .filter((booking) => booking.status === 'completed' && booking.dateKey >= cutoff)
    .reduce((sum, booking) => sum + booking.total, 0);
  return Math.round(spend * rate);
}

/* ---------- Booking helpers ---------- */

export function getTeeDate(dateKey, time) {
  const date = fromDateKey(dateKey);
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export const getCancellationDeadline = (booking) =>
  new Date(getTeeDate(booking.dateKey, booking.time).getTime() - FREE_CANCELLATION_HOURS * 3600 * 1000);

export const isFreeCancellation = (booking, now) =>
  now.getTime() < getCancellationDeadline(booking).getTime();

export function buildCalendarUrl(booking) {
  const [year, month, day] = booking.dateKey.split('-');
  const compact = (value) => `${value.replace(':', '')}00`;
  const end = minutesToTime(timeToMinutes(booking.time) + ROUND_DURATION_MINUTES);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `Golf at ${CLUB_NAME}`,
    dates: `${year}${month}${day}T${compact(booking.time)}/${year}${month}${day}T${compact(end)}`,
    ctz: 'Asia/Jakarta',
    details: `Booking reference ${booking.reference}`,
    location: CLUB_NAME,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}