# Project Context for AI Assistants

## Project at a glance

**Damai Indah Golf** is a golf club website and tee-time reservation/member operations application. It is built with Next.js and serves public club information, member self-service, booking, loyalty/handicap features, and staff operations.

The application creates reservations; it does **not** process online payments. Any payment status recorded by staff is an operational note, not proof of a financial transaction.

## Technology and architecture

- Next.js 15 App Router, React 19, JavaScript/JSX, Tailwind CSS.
- PostgreSQL 15+ is the persistent database. Schema changes are ordered SQL migrations in `db/migrations/`.
- Redis is used for shared rate limiting and is required for integration tests.
- API endpoints are implemented through the catch-all route at `app/api/v1/[...path]/route.js`; business logic is generally in `lib/server/`.
- Authentication uses cookie-based sessions. Mutating requests require CSRF protection. Server-side role checks are authoritative; hiding a UI control is not authorization.
- Email is sent through Resend via an outbox. Notification processing is invoked by a scheduled job.
- Tee-time dates and times use the club's `Asia/Jakarta` local time. Audit and event timestamps use timezone-aware timestamps. Monetary values are stored as integer Rupiah, not floating point.

## Main capabilities currently represented in the project

### Public and member features

- Public course/facility, pricing, events, Academy, contact/inquiry, course updates, and announcements pages.
- Member registration/login, profile and account security, booking history, tee-time reservation, and booking cancellation/rescheduling.
- Tee-time holds, server-generated quotes and prices, booking idempotency, and capacity protection against double-booking.
- Member handicap and round history, loyalty points/tier/cashback, wallet/rewards, and vouchers.
- Email consent/preferences, tee-time reminders, and course-update notifications.
- Exact-slot waitlist for members and guests. Guest email verification is required; eligible entries receive a temporary hold and email link. An offer is not a confirmed booking.

### Staff and admin

Roles are `starter`, `front_desk`, and `admin`; legacy `staff` accounts are migrated to `front_desk`.

- `/staff` provides a daily tee sheet, booking search, QR/manual ticket validation and check-in, operational notes, and caddy/buggy readiness for services already on a booking.
- Staff can record manual hole 9/18 checkpoints after check-in. These are observations only: there is no automatic pace classification or penalty.
- Front desk/admin can inspect the exact-slot waitlist and record operational payment statuses (`unpaid`, `down_payment`, `paid`).
- Admin can override attendance, block/unblock unoccupied slots, manage staff roles, approve course-update proposals, configure rates/services, and inspect audit records.
- Opening a previously blocked slot may trigger waitlist offers. Slot capacity, holds, and booking state remain enforced by the server/database.
- Booking requests can include optional preferred-caddy and equipment soft-requests. These are not guarantees or inventory assignments. Do not collect medical, allergy, or other sensitive information in these fields.

### Email and ticketing

Booking confirmations can include an opaque QR ticket and PDF e-ticket. Ticket data is resolved server-side; QR contents should not expose personal information. A successful scan/validation does not itself constitute check-in: staff must perform the check-in action.

## Important business and product boundaries

Do not describe or implement the following as existing capabilities without a separately approved scope and implementation:

- Online checkout, payment gateway, refunds, or verified financial settlement.
- POS, membership-fee billing/automatic dues, or transaction/revenue analytics.
- No-show penalties or automatic no-show processing. Club policy has not been approved.
- Caddy/buggy inventory tracking, RFID, GPS, hardware telemetry, or payroll.
- Automatic pace-of-play classification, warnings, or changes to later flights.
- Tournament registration/scoring, official WHS handicap integration, or push notifications.
- Event/Academy forms are inquiries, not confirmed registrations. Unverified club facts must not be presented as confirmed operational information.

For staff scope, see [`docs/staff.md`](./docs/staff.md). For API/database behavior, use [`docs/backend-api-spec.md`](./docs/backend-api-spec.md) and [`docs/backend-api-setup.md`](./docs/backend-api-setup.md). The user-facing setup guide is [`README.md`](./README.md).

## Database and migrations

The repository currently has migrations `001_initial.sql` through `007_staff_waitlist_marshal_requests.sql`. Migration 007 adds manual marshal checkpoints and booking service-request fields. Run migrations with:

```powershell
npm run db:migrate
```

The migration script requires `DATABASE_URL` (and, where applicable, `DATABASE_SSL`) in the process environment. Verify the target carefully before running it: **never apply migrations or tests to production unless the task explicitly requires a production operation and the user has authorized it.**

When changing the schema:

1. Add a forward-only migration; do not silently edit a migration that may already have been applied.
2. Update the API/service/UI as needed and keep validation in the server.
3. Update the relevant API/setup/staff documentation.
4. Add or adjust tests for data validation, role access, concurrency, and audit behavior as appropriate.

## Local development and verification

Prerequisites: Node.js 20+, PostgreSQL 15+, and Redis 7+.

```powershell
npm install
npm run dev
npm run build
```

Integration tests mutate temporary local data and require a running local app, PostgreSQL, and Redis:

```powershell
$env:EMAIL_DELIVERY_DISABLED = "true"
npm run dev
```

In another terminal:

```powershell
npm run test:integration
```

The integration suite is intended only for a local `golf` database or a local database ending in `_test`. Never point it at production or important user data. `EMAIL_DELIVERY_DISABLED=true` prevents outbound mail during local tests; queued messages remain in the outbox.

## Environment and deployment safety

- Use `.env.local` for local configuration and Vercel/project secret settings for deployment.
- Never print, copy into documentation, commit, or send `.env` values, API keys, passwords, signing secrets, or session data.
- Email requires Resend configuration (`RESEND_API_KEY`, `EMAIL_FROM`, `CLUB_CONTACT_EMAIL`). Scheduled notifications/outbox/waitlist processing requires `NOTIFICATION_JOB_TOKEN` and a configured scheduler.
- Production also needs managed PostgreSQL/Redis, secure secrets, backups, email domain verification, and monitoring. See [`docs/vercel-deployment.md`](./docs/vercel-deployment.md).

## Guidance for an AI working on this repository

1. Read the relevant existing implementation and documentation before editing; reuse established services, route patterns, validation, session/CSRF helpers, and UI conventions.
2. Treat PostgreSQL and server-side validation as authoritative for booking capacity, prices, payment records, roles, and timestamps.
3. Keep changes scoped. The working tree may contain unrelated or in-progress edits: inspect `git status` and do not revert or overwrite changes outside the requested task.
4. Do not add a new table/API/role for a capability that already exists; verify the migration and implementation first.
5. Preserve privacy: collect only necessary data, restrict staff access by role, and avoid putting sensitive data into free-text notes or logs.
6. Make expected failures explicit; do not silently swallow database, email, or validation errors.
7. Validate the specific change with the smallest relevant test/build, and report clearly what was and was not tested.
