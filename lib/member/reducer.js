import { REWARDS, getPointsBalance } from './utils';

export function memberReducer(state, action) {
  switch (action.type) {
    case 'LOG_ROUND': {
      const round = {
        id: action.id,
        dateKey: action.dateKey,
        gross: action.gross,
        verified: false,
        source: 'self',
      };
      return {
        ...state,
        rounds: [...state.rounds, round],
        notice:
          'Round logged. It is included in your handicap now and counts toward your tier once a marshal verifies it.',
      };
    }

    case 'CANCEL_BOOKING': {
      const booking = state.bookings.find((item) => item.id === action.bookingId);
      if (!booking || booking.status !== 'confirmed') return state;

      const bookings = state.bookings.map((item) =>
        item.id === booking.id ? { ...item, status: 'cancelled' } : item,
      );

      if (!action.late) {
        return {
          ...state,
          bookings,
          notice: `Reservation ${booking.reference} cancelled free of charge.`,
        };
      }

      return {
        ...state,
        bookings,
        vouchers: [
          ...state.vouchers,
          {
            id: `rain-check-${booking.id}`,
            label: 'Rain-check Voucher (Green Fee)',
            source: `Late cancellation ${booking.reference}`,
            dateKey: action.todayKey,
            validUntil: action.validUntil,
          },
        ],
        notice: `Reservation ${booking.reference} cancelled. A rain-check voucher was added to your account.`,
      };
    }

    case 'REDEEM': {
      const reward = REWARDS.find((item) => item.id === action.rewardId);
      if (!reward) return state;

      if (getPointsBalance(state.ledger) < reward.cost) {
        return { ...state, notice: 'You do not have enough points for this reward yet.' };
      }

      return {
        ...state,
        ledger: [
          ...state.ledger,
          {
            id: `redeem-${action.id}`,
            dateKey: action.todayKey,
            label: `Redeemed: ${reward.label}`,
            points: -reward.cost,
            type: 'redeem',
          },
        ],
        vouchers: [
          ...state.vouchers,
          {
            id: `voucher-${action.id}`,
            label: reward.label,
            source: 'Points redemption',
            dateKey: action.todayKey,
            validUntil: action.validUntil,
          },
        ],
        notice: `${reward.label} added to your vouchers.`,
      };
    }

    case 'DISMISS_NOTICE':
      return { ...state, notice: null };

    default:
      return state;
  }
}