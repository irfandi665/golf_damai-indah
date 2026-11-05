import {
  BUGGY,
  CADDY_OPTIONS,
  EXTRAS,
  GREEN_FEE,
  SLOT_CAPACITY,
  TAX_RATE,
  formatCurrency,
  generateTeeTimes,
  isPremiumDay,
  pluralize,
  timeToMinutes,
} from './utils';

/* ---------- Pricing ---------- */

export function getSlotPricing(dateKey, time) {
  const premium = isPremiumDay(dateKey);
  const base = premium ? GREEN_FEE.premium : GREEN_FEE.standard;
  const minutes = timeToMinutes(time);

  let tier = 'standard';
  let multiplier = 1;

  if (minutes >= 12 * 60) {
    tier = 'twilight';
    multiplier = 0.75;
  } else if (premium && minutes < 9 * 60 + 30) {
    tier = 'peak';
    multiplier = 1.15;
  }

  return {
    tier,
    pricePerPlayer: Math.round((base * multiplier) / 10000) * 10000,
  };
}

export function calculateQuote({ slot, players, caddy, buggy, extras }) {
  if (!slot) return null;

  const lines = [
    {
      id: 'greenFee',
      label: 'Green Fee',
      detail: `${players} × ${formatCurrency(slot.pricePerPlayer)}`,
      amount: slot.pricePerPlayer * players,
    },
  ];

  const caddyOption = CADDY_OPTIONS.find((option) => option.id === caddy);
  if (caddyOption) {
    lines.push({
      id: 'caddy',
      label: caddyOption.label,
      detail: `${players} × ${formatCurrency(caddyOption.pricePerPlayer)}`,
      amount: caddyOption.pricePerPlayer * players,
    });
  }

  if (buggy) {
    const carts = Math.ceil(players / BUGGY.seatsPerCart);
    lines.push({
      id: 'buggy',
      label: BUGGY.label,
      detail: `${pluralize(carts, 'cart')} × ${formatCurrency(BUGGY.pricePerCart)}`,
      amount: BUGGY.pricePerCart * carts,
    });
  }

  EXTRAS.forEach((extra) => {
    const quantity = extras[extra.id] ?? 0;
    if (quantity > 0) {
      lines.push({
        id: extra.id,
        label: extra.label,
        detail: `${quantity} × ${formatCurrency(extra.unitPrice)}`,
        amount: extra.unitPrice * quantity,
      });
    }
  });

  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  return { lines, subtotal, tax, total, perPlayer: Math.round(total / players) };
}

/* ---------- Mock API: availability ---------- */
// Ganti isi fetchTeeTimes dengan fetch(`/api/tee-times?date=${dateKey}`, { signal }).
// Bentuk data yang dikembalikan: [{ time, spotsLeft, tier, pricePerPlayer }]

function hash(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function buildAvailability(dateKey) {
  const premium = isPremiumDay(dateKey);

  return generateTeeTimes().map((time) => {
    const minutes = timeToMinutes(time);
    const seed = hash(`${dateKey}|${time}`) % 100;
    const demand = premium ? (minutes < 600 ? 80 : 55) : minutes < 540 ? 45 : 25;

    let booked = 0;
    if (seed < demand * 0.5) booked = SLOT_CAPACITY;
    else if (seed < demand) booked = 1 + (seed % 3);

    return {
      time,
      spotsLeft: SLOT_CAPACITY - booked,
      ...getSlotPricing(dateKey, time),
    };
  });
}

export function fetchTeeTimes(dateKey, { signal } = {}) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => resolve(buildAvailability(dateKey)), 450);
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

/* ---------- Mock API: create booking ---------- */
// Ganti dengan POST /api/bookings. Hubungkan payment gateway di sini.

export function createBooking(payload) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const code = hash(`${JSON.stringify(payload)}${Date.now()}`)
        .toString(36)
        .toUpperCase()
        .padStart(6, '0')
        .slice(0, 6);
      resolve({ reference: `DIG-${code}` });
    }, 900);
  });
}

/* ---------- Validasi ---------- */

export function validateGuest(guest) {
  const errors = {};
  const phone = guest.phone.replace(/[\s-]/g, '');

  if (guest.name.trim().length < 2) {
    errors.name = 'Please enter the lead player’s full name.';
  }
  if (!/^(\+62|62|0)8\d{8,12}$/.test(phone)) {
    errors.phone = 'Enter a valid Indonesian mobile number, e.g. 0812 3456 7890.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest.email.trim())) {
    errors.email = 'Enter a valid email address.';
  }
  return errors;
}