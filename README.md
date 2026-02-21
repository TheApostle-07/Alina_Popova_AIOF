# Alina Popova Membership Paywall

Production-ready Next.js membership paywall optimized for social traffic conversion to a Razorpay ₹499/month subscription, with robust server-verified access control.

## Stack
- Next.js 15+ (App Router) + TypeScript
- TailwindCSS + shadcn/ui-style components + lucide-react
- MongoDB + Mongoose
- Razorpay Subscriptions + Checkout + Webhooks (signature verified)
- Cloudinary signed delivery for protected media
- Vercel-ready architecture

## Features Implemented
- Conversion-first landing and join pages with progressive microcopy
- 18+ gate with cookie + localStorage and middleware enforcement
- Server-issued membership sessions (no external auth provider)
- Checkout creation with idempotency key + duplicate-safe behavior
- Success page with 90s polling and pending handling
- Restore access with OTP verification (email delivery) + reconciliation logic
- Membership state machine: `PENDING | ACTIVE | PAST_DUE | CANCELLED | EXPIRED | DISPUTED`
- Idempotent webhook ingestion with event dedupe and out-of-order-safe reconciliation
- Protected member feed + signed media delivery URLs
- Admin login with lockout + rate limiting
- Admin dashboard: upload/schedule/publish content, member search, metrics
- Support form saved to DB (+ optional SMTP email), OTP delivery via SMTP
- Reconciliation cron endpoint with CRON secret

## Security Hardening Implemented
- Global security headers via middleware:
  - strict CSP with Razorpay + Cloudinary allowlist
  - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`
  - strict referrer + permissions policy
  - HSTS enabled in production
- Same-origin enforcement for cookie-sensitive POST routes
- Strict Zod validation on API payloads and query params (`.strict()` for body schemas)
- Centralized safe API error handling (no stack traces in API responses)
- Idempotent payment/webhook handling:
  - checkout idempotency key enforcement (`Idempotency-Key` header)
  - webhook dedupe by event id unique key
  - out-of-order-safe reconciliation against Razorpay truth
- OTP hardening:
  - hashed OTP, TTL expiry, single-use, max attempts
  - resend cooldown + per-IP and per-identifier rate limits
  - enumeration-safe response messaging
- Session hardening:
  - httpOnly secure cookies (`SameSite` protected)
  - JWT `jti` + revocation store with TTL
  - session rotation before expiry
- Admin hardening:
  - rate-limited login
  - lockout after repeated failures
  - optional admin IP allowlist (`ADMIN_IP_ALLOWLIST`)
- Structured request logging with request ids
- MongoDB indexes for high-traffic lookups and cursor pagination

## Folder Tree
```txt
.
├── app
│   ├── access
│   ├── account
│   ├── admin
│   │   ├── login
│   │   └── page.tsx
│   ├── age
│   ├── api
│   │   ├── admin
│   │   ├── checkout
│   │   ├── content
│   │   ├── cron
│   │   ├── media
│   │   ├── membership
│   │   ├── support
│   │   ├── track
│   │   └── webhooks
│   ├── join
│   ├── membership
│   ├── privacy
│   ├── refund
│   ├── success
│   ├── support
│   ├── terms
│   ├── error.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components
│   ├── admin
│   ├── marketing
│   ├── member
│   ├── providers
│   └── ui
├── lib
│   ├── auth
│   ├── models
│   ├── cloudinary.ts
│   ├── razorpay.ts
│   ├── subscription-service.ts
│   └── ...
├── scripts
│   └── seed.ts
├── middleware.ts
├── .env.example
└── README.md
```

## Setup
1. Install dependencies:
```bash
npm install
```
2. Copy env file:
```bash
cp .env.example .env
```
3. Fill all required env vars.
4. Start dev server:
```bash
npm run dev
```
5. Seed sample content:
```bash
npm run seed
```

If you ever see chunk/runtime errors in dev (for example `options.factory` or missing module chunks), clear build artifacts and restart:
```bash
npm run clean
npm run dev
```

## Environment Variables
Required:
- `NEXT_PUBLIC_SITE_URL`
- `MONGODB_URI`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `RAZORPAY_PLAN_ID`
- `ADMIN_PASSWORD`
- `SESSION_SECRET`
- `CRON_SECRET`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Optional:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SUPPORT_TO_EMAIL`
- `UPSTASH_REDIS_REST_URL` (for distributed rate limiting)
- `UPSTASH_REDIS_REST_TOKEN` (for distributed rate limiting)
- `ADMIN_IP_ALLOWLIST` (comma separated CIDRs/IPs for admin login)

Note:
- In production, restore-access OTP requires SMTP to be configured.

## Razorpay Configuration
1. Create a monthly Razorpay **plan** for INR `499`.
2. Set resulting plan id in `RAZORPAY_PLAN_ID`.
3. Configure webhook endpoint:
- URL: `https://your-domain.com/api/webhooks/razorpay`
- Secret: same as `RAZORPAY_WEBHOOK_SECRET`
4. Subscribe to events:
- `subscription.*`
- `payment.*`
- `payment.dispute.*`

## Test Mode Flow (Razorpay)
- Use Razorpay test API keys in `.env`.
- Start checkout from `/join`.
- Complete payment with test credentials.
- Validate `/success` transitions to `/access`.

## Static Route Setup (App Router)
- Home (`/`) uses ISR for fast cached output with periodic refresh:
  - `app/page.tsx` exports `revalidate = 120`
- Dedicated static marketing route (`/membership`) is fully static:
  - `app/membership/page.tsx`
  - `export const dynamic = "force-static"`
  - `export const revalidate = false`

Notes:
- Pages become dynamic if they use `cookies()`, `headers()`, or no-store fetch patterns.
- For static pages with occasional content refresh, use ISR with a numeric `revalidate`.

## Cron Reconciliation
Endpoint:
- `GET/POST /api/cron/reconcile`
Authorization:
- `Authorization: Bearer <CRON_SECRET>` or `x-cron-secret: <CRON_SECRET>`

Recommended schedule: every 10-15 minutes.

## Deployment (Vercel)
1. Push repository.
2. Import into Vercel.
3. Add all environment variables.
4. Set webhook URL to deployed domain.
5. Configure external cron (Vercel Cron or third-party) to hit `/api/cron/reconcile`.

## Security Notes
- Member/admin cookies are `httpOnly`, `secure` (prod), `sameSite` protected.
- Sensitive POST routes enforce origin checks.
- Webhook signatures are validated using raw request body.
- Restore/admin login endpoints are rate-limited.
- Membership access is server-verified against DB + Razorpay reconciliation.

## MongoDB Indexes
- `subscriptions`
  - `razorpaySubscriptionId` (unique)
  - `razorpayCustomerId`
  - `status + updatedAt`
  - `lastPaymentId` (sparse)
- `webhookEvents`
  - `_id` = event id (unique)
  - `type`
  - `processedAt`
- `restoreOtpChallenges`
  - TTL on `expiresAt`
  - `email + createdAt`
  - `phone + createdAt`
- `contents`
  - `status + publishAt`
  - `status + type + publishAt + _id`
  - `tags + status + publishAt`
- `donations`
  - `razorpayPaymentId` (unique sparse)
  - `userId + razorpayOrderId` (unique partial)
  - `userId + idempotencyKey` (unique partial)
- `revokedSessions`
  - TTL on `expiresAt`

## Testing and Scale Validation

### E2E (Playwright)
```bash
npm run test:e2e
```

### Load/Spike/Stress/Soak
```bash
npm run load:artillery:smoke
npm run load:artillery:baseline
npm run load:artillery:spike
npm run load:artillery:stress
npm run load:artillery:soak
npm run load:artillery:hot
npm run load:k6
```

See `tests/load/README.md` for target override and k6 profiles.

### CI Gates
- `.github/workflows/ci.yml` runs:
  - typecheck
  - lint
  - production build
  - dependency audit
  - Playwright E2E
- `.github/workflows/dependency-review.yml` blocks high-severity dependency risk in PRs.

## Ops Runbook
- Incident + monitoring + DR runbook: `docs/runbook.md`
- Includes alert thresholds, payment/webhook incident playbooks, OTP abuse response, and restore drills.

## Manual QA Checklist
### Flow A: Cold visitor -> subscription
- [ ] New user without age cookie is redirected to `/age`
- [ ] Accepting age gate unlocks landing/join pages
- [ ] Checkout starts and creates subscription
- [ ] Success page verifies and redirects to `/access`

### Flow B: Payment success but redirect failed
- [ ] Open `/account` and use restore with checkout phone/email
- [ ] If active, access is restored and `/access` opens

### Flow C: Payment pending
- [ ] `/success` shows pending and polls for up to 90s
- [ ] On timeout, shows retry + restore options

### Flow D: Cancelled/expired
- [ ] Cancelled/expired subscription shows inactive screen on `/access`
- [ ] CTA points to re-subscribe flow

### Flow E: Admin operations
- [ ] Admin login works, lockout on repeated wrong password
- [ ] Upload image/video content and save draft/scheduled/published
- [ ] Scheduled content auto-publishes via feed query or cron
- [ ] Member search returns status from server truth
- [ ] Metrics show visits, checkout starts, successful subs, active, churn proxy

### Edge Cases
- [ ] Missing Razorpay redirect params still resolves via status cookie/attempt polling
- [ ] Duplicate webhook deliveries are ignored (idempotent by event id)
- [ ] Out-of-order webhook events reconcile to latest Razorpay state
- [ ] Active state can be restored by phone OR email
- [ ] Session is denied after cancellation/expiry on next protected request
- [ ] Dispute webhook marks subscription as `DISPUTED`

## Notes
- Seed content uses demo assets for quick UI validation. Replace with your Cloudinary assets for production.
- Protected feed media URLs are signed and short-lived.
