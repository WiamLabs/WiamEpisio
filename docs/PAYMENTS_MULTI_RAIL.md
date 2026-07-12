# WiamApp Payments — Multi-rail (Paystack + Stripe ready)
### © 2026 WiamApp. Powered by WiamLabs

WiamApp is **worldwide**. Payment rails:

| Region / currency | Provider today | Status |
|-------------------|----------------|--------|
| Ghana / Nigeria (GHS, NGN) + other Paystack markets | **Paystack** | Live |
| USD / EUR / GBP / rest of world | **Stripe** | **Code ready** — flip env flags when you open Stripe account |

---

## Architecture

```
Mobile / Web
   → POST /api/payments/initiate
   → resolvePaymentProvider(country, currency)
   → Paystack initialize  OR  Stripe Checkout Session
   → WebView opens checkoutUrl
   → Webhook fulfills escrow (same fulfillBookingPayment helper)
```

Legacy URLs still work for old APKs:
- `POST /api/payments/paystack/initiate`
- `GET /api/payments/paystack/verify/:reference`

New unified:
- `POST /api/payments/initiate`
- `GET /api/payments/verify/:reference?provider=paystack|stripe`
- `GET /api/payments/providers`
- `POST /api/webhooks/stripe`
- `POST /api/payments/stripe/subscribe` (website billing scaffold)

---

## Enable Stripe later (ops checklist)

1. Create Stripe account → get **Secret**, **Publishable**, **Webhook** keys  
2. Render env:
   ```
   PAYMENTS_STRIPE_ENABLED=true
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_PUBLISHABLE_KEY=pk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
3. Stripe Dashboard → Webhooks →  
   `https://wiamapp-backend.onrender.com/api/webhooks/stripe`  
   Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
4. Run SQL migration `041_payments_stripe_ready.sql` in Supabase  
5. Optional force: `PAYMENTS_FORCE_PROVIDER=stripe` (testing only)

Until `PAYMENTS_STRIPE_ENABLED=true`, initiate always uses Paystack for Africa currencies and will error clearly if Stripe is selected without keys.

---

## Files

- `backend/lib/payments/resolveProvider.js`
- `backend/lib/payments/paystackProvider.js`
- `backend/lib/payments/stripeProvider.js`
- `backend/lib/payments/fulfillBookingPayment.js`
- `backend/routes/payments.js`
- `backend/routes/webhooks.js` (`/stripe`)

Paystack stays the Africa rail (MoMo + cards). Stripe is the international card rail. Same escrow + notifications path for both.
