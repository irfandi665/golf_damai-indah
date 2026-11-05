'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import BookingSuccess from './BookingSuccess';
import StepConfirm from './StepConfirm';
import StepSchedule from './StepSchedule';
import StepServices from './StepServices';
import { MobileActionBar, PriceSummary } from './PriceSummary';
import {
  calculateQuote,
  createBooking,
  createTeeTimeHold,
  fetchServerQuote,
  releaseTeeTimeHold,
  validateGuest,
} from '@/lib/booking/engine';
import { STEPS, bookingReducer, canProceed, initialState } from '@/lib/booking/reducer';

const EASE = [0.22, 1, 0.36, 1];

function BookingSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-7xl px-6 pb-24 pt-32 lg:px-10 lg:pt-40">
      <p className="sr-only" role="status">Memuat mesin booking…</p>
      <div className="h-6 w-40 animate-pulse rounded bg-white/[0.06]" />
      <div className="mt-6 h-16 w-full max-w-xl animate-pulse rounded bg-white/[0.06]" />
      <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="h-[32rem] animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="hidden h-96 animate-pulse rounded-2xl bg-white/[0.04] lg:block" />
      </div>
    </div>
  );
}

function Stepper({ stepIndex, onGoTo }) {
  return (
    <ol aria-label="Tahapan pemesanan" className="flex items-center gap-3 sm:gap-5">
      {STEPS.map((step, index) => {
        const done = index < stepIndex;
        const current = index === stepIndex;
        return (
          <li
            key={step.id}
            aria-current={current ? 'step' : undefined}
            className="flex items-center gap-3 sm:gap-5"
          >
            <button
              type="button"
              disabled={!done}
              onClick={() => onGoTo(index)}
              className="flex items-center gap-3 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C9A96E] disabled:cursor-default"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm tabular-nums transition-colors duration-500 ${
                  current
                    ? 'border-[#C9A96E] bg-[#C9A96E] font-semibold text-[#0F2A20]'
                    : done
                      ? 'border-[#C9A96E] text-[#C9A96E]'
                      : 'border-[#F6F2EA]/20 text-[#F6F2EA]/40'
                }`}
              >
                {done ? '✓' : index + 1}
              </span>
              <span
                className={`text-xs font-medium uppercase tracking-[0.2em] ${
                  current ? 'inline text-[#F6F2EA]' : 'hidden text-[#F6F2EA]/50 sm:inline'
                }`}
              >
                {step.label}
              </span>
            </button>
            {index < STEPS.length - 1 && (
              <span aria-hidden="true" className="h-px w-6 bg-[#C9A96E]/30 sm:w-14" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function BookingFlow({ now }) {
  const [state, dispatch] = useReducer(bookingReducer, initialState);
  const panelRef = useRef(null);
  const lastFocusKey = useRef(state.stepIndex);

  const localQuote = useMemo(
    () =>
      calculateQuote({
        slot: state.slot,
        players: state.players,
        caddy: state.caddy,
        buggy: state.buggy,
        extras: state.extras,
      }),
    [state.slot, state.players, state.caddy, state.buggy, state.extras],
  );
  const [serverQuote, setServerQuote] = useState(null);
  const [quoteError, setQuoteError] = useState(null);
  const quote = serverQuote || localQuote;

  useEffect(() => {
    if (!state.holdId) {
      setServerQuote(null);
      setQuoteError(null);
      return undefined;
    }

    const controller = new AbortController();
    setServerQuote(null);
    setQuoteError(null);
    fetchServerQuote({
      holdId: state.holdId,
      caddy: state.caddy,
      buggy: state.buggy,
      extras: state.extras,
      signal: controller.signal,
    })
      .then(setServerQuote)
      .catch((error) => {
        if (error.name !== 'AbortError') setQuoteError(error.message);
      });

    return () => controller.abort();
  }, [state.holdId, state.caddy, state.buggy, state.extras]);

  useEffect(() => {
    const holdId = state.holdId;
    if (!holdId) return undefined;
    return () => {
      releaseTeeTimeHold(holdId).catch((error) => {
        console.error('Could not release tee-time hold:', error);
      });
    };
  }, [state.holdId]);

  const selectSlot = useCallback(async (slot) => {
    if (!slot.slotId) throw new Error('This tee time cannot be held. Refresh availability and try again.');
    if (state.holdId) await releaseTeeTimeHold(state.holdId);
    const hold = await createTeeTimeHold({ slotId: slot.slotId, players: state.players });
    dispatch({ type: 'SELECT_SLOT', slot, holdId: hold.holdId });
  }, [state.holdId, state.players]);

  const errors = useMemo(() => {
    const result = validateGuest(state.guest);
    if (!state.agreed) result.agreed = 'Please accept the booking terms to continue.';
    return result;
  }, [state.guest, state.agreed]);

  // Pindahkan fokus + scroll ke panel setiap langkah berganti (aksesibilitas keyboard & screen reader)
  const focusKey = state.reference ? 'done' : state.stepIndex;
  useEffect(() => {
    if (lastFocusKey.current === focusKey) return;
    lastFocusKey.current = focusKey;
    panelRef.current?.focus({ preventScroll: true });
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusKey]);

  const handleSubmit = useCallback(async () => {
    if (state.submit.status === 'submitting') return;

    if (Object.keys(errors).length > 0) {
      dispatch({ type: 'SHOW_ERRORS' });
      requestAnimationFrame(() => {
        document.querySelector('[aria-invalid="true"]')?.focus();
      });
      return;
    }

    dispatch({ type: 'SUBMIT_START' });
    try {
      const booking = await createBooking({
        holdId: state.holdId,
        caddy: state.caddy,
        buggy: state.buggy,
        extras: state.extras,
        guest: state.guest,
        notes: state.guest.notes,
        termsAccepted: state.agreed,
        clientTotal: quote.total,
      });
      dispatch({
        type: 'SUBMIT_SUCCESS',
        reference: booking.reference,
        emailNotification: booking.emailNotification,
      });
    } catch (error) {
      dispatch({
        type: 'SUBMIT_FAILURE',
        error: error.message || 'We could not complete your booking. Please try again in a moment.',
      });
    }
  }, [errors, quote, state]);

  const isLastStep = state.stepIndex === STEPS.length - 1;
  const submitting = state.submit.status === 'submitting';

  let actionLabel = 'Continue';
  if (state.stepIndex === 0) actionLabel = state.slot ? 'Continue' : 'Select a Tee Time';
  if (state.stepIndex === 1) actionLabel = 'Review Booking';
  if (isLastStep) actionLabel = submitting ? 'Confirming…' : 'Confirm Booking';

  const actionDisabled = submitting
    || (state.stepIndex === 0 && !canProceed(state))
    || (Boolean(state.holdId) && !serverQuote);
  const actionProps = {
    state,
    quote,
    onBack: () => dispatch({ type: 'BACK' }),
    onNext: () => dispatch({ type: 'NEXT' }),
    actionLabel,
    actionDisabled,
    isLastStep,
  };

  return (
    <MotionConfig reducedMotion="user">
      <section
        aria-labelledby="booking-heading"
        className="mx-auto max-w-7xl px-6 pb-40 pt-32 lg:px-10 lg:pb-28 lg:pt-40"
      >
        {!state.reference && (
          <header className="mb-12 lg:mb-16">
            <div className="flex items-center gap-4">
              <span aria-hidden="true" className="h-px w-12 bg-[#C9A96E]" />
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.4em] text-[#C9A96E] sm:text-xs">
                Online Reservation
              </p>
            </div>
            <h1
              id="booking-heading"
              className="mt-6 font-[family-name:var(--font-heading)] text-5xl font-medium leading-[1.05] tracking-tight text-[#F6F2EA] sm:text-6xl"
            >
              Reserve your <span className="italic text-[#C9A96E]">tee time</span>
            </h1>
            <p className="mt-5 max-w-2xl rounded-xl border border-[#C9A96E]/20 bg-[#C9A96E]/5 px-5 py-4 text-sm text-[#F6F2EA]/70">
              Reservation only: all payments are made at the club. This app does not process or confirm payments.
            </p>
            <div className="mt-10">
              <Stepper
                stepIndex={state.stepIndex}
                onGoTo={(index) => dispatch({ type: 'GO_TO_STEP', index })}
              />
            </div>
          </header>
        )}

        {quoteError && state.holdId && !state.reference && (
          <p role="alert" className="mb-6 rounded-xl border border-red-300/30 bg-red-950/20 px-5 py-4 text-sm text-red-200">
            {quoteError}
          </p>
        )}

        <div
          ref={panelRef}
          tabIndex={-1}
          className={`scroll-mt-28 outline-none ${
            state.reference ? '' : 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14'
          }`}
        >
          {state.reference ? (
            <BookingSuccess
              state={state}
              quote={quote}
              onReset={() => dispatch({ type: 'RESET' })}
            />
          ) : (
            <>
              <div className="min-w-0">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={state.stepIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.4, ease: EASE }}
                  >
                    {state.stepIndex === 0 && (
                      <StepSchedule state={state} dispatch={dispatch} now={now} onSelectSlot={selectSlot} />
                    )}
                    {state.stepIndex === 1 && <StepServices state={state} dispatch={dispatch} />}
                    {state.stepIndex === 2 && (
                      <StepConfirm
                        state={state}
                        dispatch={dispatch}
                        errors={errors}
                        onSubmit={handleSubmit}
                      />
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              <PriceSummary {...actionProps} />
            </>
          )}
        </div>
      </section>

      {!state.reference && <MobileActionBar {...actionProps} />}
    </MotionConfig>
  );
}

// Waktu "sekarang" diambil di client setelah mount agar tidak terjadi hydration mismatch
export default function BookingEngine() {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
  }, []);

  if (!now) return <BookingSkeleton />;
  return <BookingFlow now={now} />;
}