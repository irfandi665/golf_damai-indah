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
import { apiRequest, newIdempotencyKey } from '@/lib/api-client';

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

export async function fetchTeeTimes(dateKey, { signal, players = 1, courseId = 1 } = {}) {
  const query = new URLSearchParams({
    courseId: String(courseId),
    date: dateKey,
    players: String(players),
  });
  const result = await apiRequest(`/api/v1/tee-times?${query}`, { signal });
  return result.slots;
}

export function createTeeTimeHold({ slotId, players }) {
  return apiRequest('/api/v1/tee-times/holds', {
    method: 'POST',
    body: { slotId, players },
  });
}

export function releaseTeeTimeHold(holdId) {
  return apiRequest(`/api/v1/tee-times/holds/${encodeURIComponent(holdId)}`, {
    method: 'DELETE',
  });
}

export function fetchServerQuote({ holdId, caddy, buggy, extras, signal }) {
  return apiRequest('/api/v1/quotes', {
    method: 'POST',
    body: { holdId, caddy, buggy, extras },
    signal,
  });
}

export async function createBooking(payload) {
  return apiRequest('/api/v1/bookings', {
    method: 'POST',
    idempotencyKey: newIdempotencyKey(),
    body: payload,
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