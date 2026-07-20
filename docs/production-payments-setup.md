# VIPSUI Production Payments Setup

## Recommended Database

Use managed PostgreSQL for production order and payment data.

Recommended providers:

1. Neon Postgres via Vercel Marketplace
2. Prisma Postgres
3. Supabase Postgres

For this project, Neon Postgres is the best fit because the site is deployed on Vercel and the app uses serverless Next.js routes. Customers, quick orders, order items, payment providers, payments, Zelle verification records, admin sessions, and webhook idempotency all need relational transactions and indexes.

## Required Production Environment Variables

Set these in Vercel Project Settings > Environment Variables:

```bash
NEXT_PUBLIC_SITE_URL=https://vipsui.vercel.app
DATABASE_URL=

ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=VIPSUI Admin

PAYPAL_CLIENT_ID=
PAYPAL_CLIENT_SECRET=
PAYPAL_WEBHOOK_ID=
PAYPAL_ENV=sandbox
PAYPAL_ENABLED=true
PAYPAL_ALLOWED_COUNTRIES=ALL

ZELLE_ENABLED=true
ZELLE_RECIPIENT_NAME=
ZELLE_RECIPIENT_EMAIL=
ZELLE_RECIPIENT_PHONE=
ZELLE_ALLOWED_COUNTRIES=United States,US,USA
ZELLE_PAYMENT_INSTRUCTIONS=Please send the exact order amount using Zelle. Include your Order Number in the memo.
ZELLE_CUSTOMER_MESSAGE=Please send the exact order amount using Zelle. Please include your Order Number in the memo. Your order will be processed after payment is confirmed.

STRIPE_ENABLED=false
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
CARD_ALLOWED_COUNTRIES=ALL
```

Do not commit real keys to Git.

## Migration Commands

After `DATABASE_URL` is available locally or in CI:

```bash
npm run db:generate
npm run db:migrate
ADMIN_EMAIL="admin@example.com" ADMIN_PASSWORD="strong-password" ADMIN_NAME="VIPSUI Admin" npm run db:seed-admin
```

## PayPal Sandbox Setup

1. Open PayPal Developer Dashboard.
2. Create or open a Sandbox REST app.
3. Copy Sandbox Client ID to `PAYPAL_CLIENT_ID`.
4. Copy Sandbox Secret to `PAYPAL_CLIENT_SECRET`.
5. Set `PAYPAL_ENV=sandbox`.
6. Add webhook URL:
   `https://vipsui.vercel.app/api/payments/paypal/webhook`
7. Subscribe at minimum to:
   `PAYMENT.CAPTURE.COMPLETED`
8. Copy the webhook ID to `PAYPAL_WEBHOOK_ID`.

## Zelle Setup

Set at least one public Zelle recipient field:

```bash
ZELLE_RECIPIENT_NAME=
ZELLE_RECIPIENT_EMAIL=
ZELLE_RECIPIENT_PHONE=
```

If both email and phone are set, checkout shows both. Zelle is shown only when the customer country is United States, US, or USA unless `ZELLE_ALLOWED_COUNTRIES` is changed.

## End-to-End Test Checklist

1. Create or use a quick order checkout link.
2. Open `/checkout/[token]`.
3. Confirm enabled payment providers appear.
4. Submit Zelle payment.
5. Confirm checkout shows Pending Verification.
6. Login at `/admin/login`.
7. Open `/admin/orders/[orderId]`.
8. Confirm Zelle payment received.
9. Confirm checkout/tracking show Paid.
10. Try to submit payment again and confirm it is blocked.
11. Create PayPal Sandbox order.
12. Approve in PayPal Sandbox buyer account.
13. Confirm PayPal capture marks order Paid.
14. Re-send webhook event and confirm duplicate webhook is ignored.
