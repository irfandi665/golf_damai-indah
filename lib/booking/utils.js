export const CLUB_NAME = 'Damai Indah Golf';
export const CONFIRM_FORM_ID = 'booking-confirm-form';

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 4;
export const SLOT_CAPACITY = 4;
export const BOOKING_WINDOW_DAYS = 60;
export const BOOKING_LEAD_MINUTES = 60;
export const TEE_INTERVAL_MINUTES = 10;
export const FIRST_TEE = '06:00';
export const LAST_TEE = '14:00';
export const ROUND_DURATION_MINUTES = 270;
export const TAX_RATE = 0.11;

// Tanggal tarif premium selain Sabtu/Minggu. Sesuaikan dengan kalender operasional klub.
export const PREMIUM_HOLIDAYS = ['2026-12-25', '2027-01-01'];

export const GREEN_FEE = { standard: 1250000, premium: 1850000 };

export const CANCELLATION_POLICY =
  'Free cancellation up to 24 hours before your tee time. Late-cancellation rain-check vouchers are issued only to eligible member accounts.';

export const CADDY_OPTIONS = [
  {
    id: 'standard',
    label: 'Standard Caddy',
    description: 'Trained caddy for club selection, yardages and green reading.',
    pricePerPlayer: 350000,
  },
  {
    id: 'senior',
    label: 'Senior Caddy',
    description: 'Our most experienced caddies, with deep knowledge of every green.',
    pricePerPlayer: 500000,
  },
];

export const BUGGY = {
  label: 'Golf Buggy',
  description: 'Shared cart for up to two players, ready at the starter.',
  pricePerCart: 450000,
  seatsPerCart: 2,
};

export const EXTRAS = [
  {
    id: 'rentalClubs',
    label: 'Rental Club Set',
    description: 'Premium full set, waiting at the starter counter.',
    unitPrice: 600000,
    unitLabel: 'per set',
  },
  {
    id: 'rangeWarmup',
    label: 'Driving Range Warm-up',
    description: 'A bucket of balls before your tee time.',
    unitPrice: 150000,
    unitLabel: 'per player',
  },
  {
    id: 'halfwayOrder',
    label: 'Halfway House Pre-order',
    description: 'Meal and drink prepared and ready when you reach the turn.',
    unitPrice: 250000,
    unitLabel: 'per player',
  },
];

export const TIER_LABELS = { peak: 'Peak', standard: '', twilight: 'Twilight' };

export const DAY_PARTS = [
  { id: 'morning', label: 'Morning', from: 0, to: 600 },
  { id: 'midday', label: 'Midday', from: 600, to: 720 },
  { id: 'afternoon', label: 'Afternoon & Twilight', from: 720, to: 1440 },
];

/* ---------- Tanggal & waktu ---------- */

const pad = (n) => String(n).padStart(2, '0');

export const toDateKey = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const fromDateKey = (key) => {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const startOfDay = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const addDays = (date, amount) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);

export const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

export const addMonths = (date, amount) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1);

export const timeToMinutes = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

export const minutesToTime = (total) => `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;

export function generateTeeTimes() {
  const times = [];
  const end = timeToMinutes(LAST_TEE);
  for (let m = timeToMinutes(FIRST_TEE); m <= end; m += TEE_INTERVAL_MINUTES) {
    times.push(minutesToTime(m));
  }
  return times;
}

export const getDayPart = (time) => {
  const minutes = timeToMinutes(time);
  return DAY_PARTS.find((part) => minutes >= part.from && minutes < part.to).id;
};

export const isPremiumDay = (dateKey) => {
  const day = fromDateKey(dateKey).getDay();
  return day === 0 || day === 6 || PREMIUM_HOLIDAYS.includes(dateKey);
};

// Booking online ditutup BOOKING_LEAD_MINUTES sebelum tee time (hanya berlaku untuk hari ini)
export const isSlotClosed = (dateKey, time, now) => {
  if (dateKey !== toDateKey(now)) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return timeToMinutes(time) < nowMinutes + BOOKING_LEAD_MINUTES;
};

/* ---------- Formatter ---------- */

const currency = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  maximumFractionDigits: 0,
});

export const formatCurrency = (value) => currency.format(value);

export const formatCompactCurrency = (value) =>
  `Rp ${(value / 1000000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;

export const formatLongDate = (dateKey, locale = 'en') =>
  new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fromDateKey(dateKey));

export const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;