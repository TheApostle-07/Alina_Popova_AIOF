# Membership Platform Runbook

## 1. SLOs and Golden Signals

- Availability SLO: `99.9%` for public pages and checkout APIs.
- Access SLO: `99.95%` for `ACTIVE` member verification paths.
- P95 latency:
  - Public routes: `< 400ms`
  - Payment/restore APIs: `< 1000ms`
- Error budget burn alert when 5xx > `1%` for 5 min.

Track:
- Request volume, 4xx/5xx rate, p95/p99 latency
- Webhook lag (`now - webhook.created_at`)
- OTP request rate, verify failures, lockouts
- Checkout creates vs successful subscriptions
- Mongo connection pool utilization and slow query counts

## 2. Alerts

Page immediately:
- Webhook endpoint 5xx > 2% for 3 min
- Membership status endpoint 5xx > 1% for 3 min
- `subscription_drift` reconcile failures > 20 in 10 min
- OTP provider failures > 20% for 10 min

Warn:
- OTP abuse spikes (> 50 request/min from one IP block)
- Admin login lockouts > threshold
- Donation verify mismatch spikes

## 3. Daily Checks

- Confirm cron reconciliation ran in last 15 minutes.
- Review webhook duplicate count and processing lag.
- Review rate-limit reject counts by endpoint.
- Verify active-member metric trend and sudden drops.

## 4. Incident Playbooks

### A) Payment success reported but membership inactive

1. Find user by phone/email in admin member search.
2. Verify local subscription status + last event time.
3. Trigger reconcile:
   - `POST /api/cron/reconcile` with `x-cron-secret`.
4. If still inactive, fetch Razorpay subscription manually and inspect latest payment + disputes.
5. If Razorpay active and DB stale, replay webhook payload or run targeted reconcile by subscription id.

### B) Webhook outage or signature failures

1. Check `RAZORPAY_WEBHOOK_SECRET` mismatch first.
2. Validate raw-body handling still enabled in webhook route.
3. Confirm Razorpay retries are active in dashboard.
4. Run reconcile endpoint repeatedly until backlog clears.
5. Keep site in safe mode: never grant access from redirect params.

### C) OTP abuse campaign

1. Inspect rate-limit logs for offending IP and identifier buckets.
2. Tighten OTP limits temporarily:
   - Lower request limit
   - Increase lockout window
3. Enable bot challenge (Turnstile) gate on restore form if abuse persists.
4. Monitor SMTP provider reputation and bounce rates.

### D) Mongo degradation

1. Check connection pool saturation and slow queries.
2. Reduce API pressure:
   - Increase CDN cache for public pages
   - Tighten expensive endpoint rate limits
3. Scale Mongo cluster tier / IOPS.
4. Run index health checks and inspect unbounded scans.

## 5. Disaster Recovery

- Backups: daily snapshot + point-in-time recovery enabled.
- Restore drill: monthly into staging and run:
  - member access check
  - restore OTP flow
  - webhook replay and reconcile
- RPO target: 15 minutes
- RTO target: 60 minutes

## 6. Security Response

If any secret leak suspected:
1. Rotate immediately: Razorpay keys, webhook secret, session secret, Cloudinary, SMTP.
2. Invalidate active sessions by rotating `SESSION_SECRET` and/or revocation sweep.
3. Audit recent admin logins and unusual restore attempts.
4. Publish incident summary internally with timeline and affected scopes.

## 7. On-call Quick Commands

```bash
# run reconcile
curl -X POST "$SITE_URL/api/cron/reconcile" -H "x-cron-secret: $CRON_SECRET"

# run baseline load
npm run load:artillery:baseline

# run spike profile with k6
PROFILE=spike BASE_URL="$SITE_URL" k6 run tests/load/k6/membership-load.js
```
