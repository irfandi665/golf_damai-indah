'use client';

import {
  BUGGY,
  CADDY_OPTIONS,
  CANCELLATION_POLICY,
  CONFIRM_FORM_ID,
  EXTRAS,
  formatLongDate,
  pluralize,
} from '@/lib/booking/utils';
import Link from 'next/link';

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  type = 'text',
  autoComplete,
  inputMode,
  placeholder,
  optional = false,
  multiline = false,
  helperText,
}) {
  const shared = {
    id,
    name: id,
    value,
    placeholder,
    autoComplete,
    inputMode,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': [
      error && `${id}-error`,
      helperText && `${id}-help`,
    ].filter(Boolean).join(' ') || undefined,
    onChange: (event) => onChange(event.target.value),
    className: `w-full rounded-xl border bg-white/[0.04] px-4 py-3.5 text-base text-[#F6F2EA] placeholder:text-[#F6F2EA]/30 transition-colors focus:outline-none focus:ring-2 focus:ring-[#C9A96E] ${
      error ? 'border-red-300/60' : 'border-[#C9A96E]/25 focus:border-[#C9A96E]'
    }`,
  };

  return (
    <div>
      <label htmlFor={id} className="mb-2 flex items-baseline justify-between text-xs font-medium uppercase tracking-[0.2em] text-[#F6F2EA]/70">
        {label}
        {optional && <span className="normal-case tracking-normal text-[#F6F2EA]/40">Optional</span>}
      </label>
      {multiline ? <textarea rows={3} {...shared} /> : <input type={type} {...shared} />}
      {error && (
        <p id={`${id}-error`} className="mt-2 text-sm text-red-300">
          {error}
        </p>
      )}
      {helperText && (
        <p id={`${id}-help`} className="mt-2 text-xs text-[#F6F2EA]/45">
          {helperText}
        </p>
      )}
    </div>
  );
}

function ReviewRow({ label, value, onChange, changeLabel }) {
  return (
    <div className="flex items-start justify-between gap-6 py-4">
      <div>
        <dt className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">{label}</dt>
        <dd className="mt-1.5 text-base text-[#F6F2EA]">{value}</dd>
      </div>
      <button
        type="button"
        onClick={onChange}
        aria-label={changeLabel}
        className="flex-none text-xs uppercase tracking-[0.2em] text-[#F6F2EA]/60 underline decoration-[#C9A96E]/50 underline-offset-4 transition-colors hover:text-[#C9A96E] focus-visible:outline-none focus-visible:text-[#C9A96E]"
      >
        Change
      </button>
    </div>
  );
}

export default function StepConfirm({ state, dispatch, errors, onSubmit }) {
  const { guest, showErrors, submit } = state;
  const caddy = CADDY_OPTIONS.find((option) => option.id === state.caddy);
  const carts = Math.ceil(state.players / BUGGY.seatsPerCart);
  const packageType = [0, 6].includes(new Date(`${state.dateKey}T12:00:00Z`).getUTCDay()) ? 'Weekend' : 'Weekday';
  const extrasSummary = EXTRAS.filter((extra) => state.extras[extra.id] > 0)
    .map((extra) => `${extra.label} × ${state.extras[extra.id]}`)
    .join(', ');

  const fieldError = (field) => (showErrors ? errors[field] : undefined);
  const setField = (field) => (value) => dispatch({ type: 'SET_GUEST_FIELD', field, value });

  return (
    <div className="space-y-14">
      <section aria-labelledby="review-heading">
        <h2
          id="review-heading"
          className="mb-5 font-[family-name:var(--font-heading)] text-3xl font-medium text-[#F6F2EA]"
        >
          Review Your Round
        </h2>
        <dl className="divide-y divide-[#C9A96E]/15 rounded-2xl border border-[#C9A96E]/20 bg-white/[0.03] px-6">
          <ReviewRow
            label="Date & Tee Time"
            value={`${formatLongDate(state.dateKey)} · ${state.slot.time}`}
            onChange={() => dispatch({ type: 'GO_TO_STEP', index: 0 })}
            changeLabel="Ubah tanggal dan jam"
          />
          <div className="flex items-start justify-between gap-6 py-4">
            <div className="w-full max-w-xs">
              <label htmlFor="tee-box" className="text-[0.65rem] font-medium uppercase tracking-[0.3em] text-[#C9A96E]">Tee Box</label>
              <select
                id="tee-box"
                value={state.teeBox}
                onChange={(event) => dispatch({ type: 'SET_TEE_BOX', value: event.target.value })}
                className="mt-1.5 w-full rounded-lg border border-[#C9A96E]/25 bg-[#0F2A20] px-3 py-2 text-sm text-[#F6F2EA] focus:border-[#C9A96E] focus:outline-none"
              >
                <option value="Tee 1">Tee 1</option>
                <option value="Tee 10">Tee 10</option>
              </select>
            </div>
            <ReviewRow
              label="Package"
              value={packageType}
              onChange={() => dispatch({ type: 'GO_TO_STEP', index: 0 })}
              changeLabel="Ubah tanggal untuk mengganti paket weekday/weekend"
            />
          </div>
          <ReviewRow
            label="Players"
            value={pluralize(state.players, 'player')}
            onChange={() => dispatch({ type: 'GO_TO_STEP', index: 0 })}
            changeLabel="Ubah jumlah pemain"
          />
          <ReviewRow
            label="Caddy"
            value={`${caddy.label} × ${state.players}`}
            onChange={() => dispatch({ type: 'GO_TO_STEP', index: 1 })}
            changeLabel="Ubah caddy"
          />
          <ReviewRow
            label="Buggy"
            value={state.buggy ? pluralize(carts, 'cart') : 'Walking'}
            onChange={() => dispatch({ type: 'GO_TO_STEP', index: 1 })}
            changeLabel="Ubah buggy"
          />
          {extrasSummary && (
            <ReviewRow
              label="Add-ons"
              value={extrasSummary}
              onChange={() => dispatch({ type: 'GO_TO_STEP', index: 1 })}
              changeLabel="Ubah add-on"
            />
          )}
        </dl>
      </section>

      <section aria-labelledby="details-heading">
        <h2
          id="details-heading"
          className="mb-2 font-[family-name:var(--font-heading)] text-3xl font-medium text-[#F6F2EA]"
        >
          Lead Player Details
        </h2>
        <p className="mb-6 text-sm text-[#F6F2EA]/55">
          Your confirmation and check-in details are sent here.
        </p>

        <form
          id={CONFIRM_FORM_ID}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
          className="space-y-5"
        >
          <TextField
            id="name"
            label="Full Name"
            autoComplete="name"
            value={guest.name}
            error={fieldError('name')}
            onChange={setField('name')}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="phone"
              label="Mobile / WhatsApp"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="0812 3456 7890"
              value={guest.phone}
              error={fieldError('phone')}
              onChange={setField('phone')}
            />
            <TextField
              id="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={guest.email}
              error={fieldError('email')}
              onChange={setField('email')}
            />
          </div>
          <TextField
            id="notes"
            label="Special Requests"
            multiline
            optional
            placeholder="Celebration, seating preference…"
            helperText="Do not include medical, allergy, or other sensitive information."
            value={guest.notes}
            onChange={setField('notes')}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <TextField
              id="preferredCaddy"
              label="Preferred Caddy"
              optional
              placeholder="Name, if requested"
              value={state.serviceRequests.preferredCaddy}
              onChange={(value) => dispatch({ type: 'SET_SERVICE_REQUEST_FIELD', field: 'preferredCaddy', value })}
            />
            <TextField
              id="rentalNeeds"
              label="Equipment Request"
              optional
              placeholder="For example, left-handed clubs"
              value={state.serviceRequests.rentalNeeds}
              onChange={(value) => dispatch({ type: 'SET_SERVICE_REQUEST_FIELD', field: 'rentalNeeds', value })}
            />
          </div>
          <p className="-mt-2 text-xs text-[#F6F2EA]/45">
            Requests are not guaranteed and do not confirm service assignment. Do not enter medical or other sensitive information here.
          </p>

          <div>
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-[#F6F2EA]/75">
              <input
                type="checkbox"
                name="agreed"
                checked={state.agreed}
                aria-invalid={showErrors && errors.agreed ? 'true' : undefined}
                aria-describedby={showErrors && errors.agreed ? 'agreed-error' : undefined}
                onChange={(event) => dispatch({ type: 'SET_AGREED', value: event.target.checked })}
                className="mt-1 h-4 w-4 flex-none accent-[#C9A96E]"
              />
              <span>
                I understand the booking terms. {CANCELLATION_POLICY}{' '}
                <Link href="/policies" className="text-[#C9A96E] underline underline-offset-4">Read all booking policies</Link>.
              </span>
            </label>
            {showErrors && errors.agreed && (
              <p id="agreed-error" className="mt-2 text-sm text-red-300">
                {errors.agreed}
              </p>
            )}
          </div>

          <p className="rounded-xl border border-[#C9A96E]/20 bg-[#C9A96E]/5 px-5 py-4 text-sm text-[#F6F2EA]/70">
            This booking is a reservation only. Payment is made at the club on
            arrival; this app does not process or confirm payments.
          </p>

          {submit.error && (
            <p role="alert" className="rounded-xl border border-red-300/30 bg-red-950/20 px-5 py-4 text-sm text-red-200">
              {submit.error}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}