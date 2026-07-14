# WiamSafety Section 9 — WiamApp product contract

WiamApp implements **only** its side of the recovery contract.  
Canonical blueprint: `wiamlabs-studio/docs/WIAMSAFETYBOT_MASTER_BLUEPRINT.md` (Sections **9** + **13**).  
Integration shape: `wiamlabs-studio/wiamsafety/docs/PRODUCT_INTEGRATION.md`.

WiamSafety Core / bot live in the **Studio** repo (`wiamsafety/**`). This repo must not edit them or WiamPass.

## Endpoint

```
POST /api/wiamsafety/recovery
Content-Type: application/json
X-WiamSafety-Signature: <hex HMAC-SHA256 of raw body using WIAMSAFETY_HMAC_SECRET>
```

Body (from Core after phone OTP verified):

```json
{
  "referenceId": "WL-SAFE-RESET-…",
  "action": "password_reset",
  "productUserId": "<WiamApp users.id UUID>",
  "handoffToken": "<single-use token>"
}
```

WiamApp:

1. Verifies HMAC (timing-safe) over the **raw** body  
2. Consumes `handoffToken` once (`wiamsafety_handoffs`)  
3. Looks up the user email by `productUserId`  
4. Triggers the **existing** forgot-password / Brevo reset email flow  
5. Responds `{ "success": true }`  
6. Never accepts a plaintext password from WiamSafety  

When the user later sets a new password via `POST /api/auth/reset-password`, WiamApp optionally calls:

```
POST {WIAMSAFETY_CORE_URL}/v1/reset/complete
X-Product-Signature: <HMAC of body>
{ "referenceId", "productCode": "WA" }
```

## Env (Render — WiamApp backend)

| Variable | Purpose |
|----------|---------|
| `WIAMSAFETY_HMAC_SECRET` | Shared secret with Core (min 16 chars) — same value as WA `hmacSecret` |
| `WIAMSAFETY_CORE_URL` | Core base URL (default `https://safety.wiamlabs.com`) |

## Ops — register WA on Core

After this webhook is live:

```
PUT /v1/ops/products/WA
Authorization: Bearer $OPS_API_SECRET
{
  "productName": "WiamApp",
  "recoveryWebhookUrl": "https://<wiamapp-api-host>/api/wiamsafety/recovery",
  "hmacSecret": "<same as WIAMSAFETY_HMAC_SECRET>"
}
```

Or on Core boot: `SEED_WA_RECOVERY_WEBHOOK_URL` + `SEED_WA_HMAC_SECRET`.

## DB

Run once in WiamApp Supabase: `database/migrations/043_wiamsafety_handoffs.sql`.

## Product links (later)

`productUserId` must match `product_links.product_user_id` in Safety Core (= WiamApp `users.id`).  
Phone verify / registration callouts that create those links come later via Core’s published APIs — do not invent a second identity DB inside WiamApp.

© 2026 WiamLabs. All rights reserved.
