import { EXTRAS, MAX_PLAYERS, MIN_PLAYERS } from './utils';

export const STEPS = [
  { id: 'schedule', label: 'Date & Time' },
  { id: 'services', label: 'Caddy & Cart' },
  { id: 'confirm', label: 'Confirm' },
];

export const initialState = {
  stepIndex: 0,
  dateKey: null,
  slot: null,
  holdId: null,
  teeBox: 'Tee 1',
  players: 2,
  caddy: 'standard',
  buggy: true,
  extras: Object.fromEntries(EXTRAS.map((extra) => [extra.id, 0])),
  guest: { name: '', phone: '', email: '', notes: '' },
  agreed: false,
  showErrors: false,
  notice: null,
  submit: { status: 'idle', error: null },
  reference: null,
  emailNotification: null,
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const canProceed = (state) => {
  if (state.stepIndex === 0) return Boolean(state.dateKey && state.slot);
  return true;
};

export function bookingReducer(state, action) {
  switch (action.type) {
    case 'SELECT_DATE':
      if (state.dateKey === action.dateKey) return state;
      return { ...state, dateKey: action.dateKey, slot: null, holdId: null, notice: null };

    case 'SET_NOTICE':
      return { ...state, notice: action.notice };

    case 'WAITLIST_CLAIMED':
      return {
        ...state,
        stepIndex: 1,
        dateKey: action.dateKey,
        slot: action.slot,
        holdId: action.holdId,
        players: action.players,
        guest: action.guest,
        caddy: 'standard',
        buggy: false,
        extras: Object.fromEntries(EXTRAS.map((extra) => [extra.id, 0])),
        notice: 'Your waitlist offer is held for 10 minutes. Complete your reservation before it expires.',
      };

    case 'SELECT_SLOT':
      if (action.slot.spotsLeft < state.players) return state;
      return { ...state, slot: action.slot, holdId: action.holdId, notice: null };

    case 'SET_PLAYERS': {
      const players = clamp(action.players, MIN_PLAYERS, MAX_PLAYERS);
      if (players === state.players) return state;

      const slotStillFits = !state.slot || state.slot.spotsLeft >= players;
      const extras = Object.fromEntries(
        Object.entries(state.extras).map(([id, quantity]) => [id, Math.min(quantity, players)]),
      );

      return {
        ...state,
        players,
        extras,
        slot: slotStillFits ? state.slot : null,
        holdId: slotStillFits ? state.holdId : null,
        notice: slotStillFits
          ? state.notice
          : `Your previous tee time cannot seat ${players} players and was released. Please choose another.`,
      };
    }

    case 'SET_CADDY':
      return { ...state, caddy: action.caddy };

    case 'SET_BUGGY':
      return { ...state, buggy: action.value };

    case 'SET_TEE_BOX':
      return { ...state, teeBox: action.value };

    case 'SET_EXTRA':
      return {
        ...state,
        extras: {
          ...state.extras,
          [action.id]: clamp(action.quantity, 0, state.players),
        },
      };

    case 'SET_GUEST_FIELD':
      return { ...state, guest: { ...state.guest, [action.field]: action.value } };

    case 'SET_AGREED':
      return { ...state, agreed: action.value };

    case 'SHOW_ERRORS':
      return { ...state, showErrors: true };

    case 'NEXT':
      if (!canProceed(state) || state.stepIndex >= STEPS.length - 1) return state;
      return { ...state, stepIndex: state.stepIndex + 1 };

    case 'BACK':
      if (state.stepIndex === 0) return state;
      return { ...state, stepIndex: state.stepIndex - 1 };

    case 'GO_TO_STEP':
      // Hanya boleh kembali ke langkah yang sudah dilewati
      if (action.index >= state.stepIndex) return state;
      return { ...state, stepIndex: action.index };

    case 'SUBMIT_START':
      return { ...state, submit: { status: 'submitting', error: null } };

    case 'SUBMIT_FAILURE':
      return { ...state, submit: { status: 'error', error: action.error } };

    case 'SUBMIT_SUCCESS':
      return {
        ...state,
        submit: { status: 'success', error: null },
        reference: action.reference,
        emailNotification: action.emailNotification,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}