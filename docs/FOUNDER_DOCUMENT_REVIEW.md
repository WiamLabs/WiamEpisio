# WiamApp Founder document review

**Owner:** WiamApp agent  
**Studio surface:** `studio.wiamlabs.com/founder/wiamapp/verification`  
**Also linked from:** Master God Mode → Support tab → “WiamApp · Document review”

## What Founder can do

1. Open worker or customer pending queue
2. Show ID front / back / selfie (15‑min signed URL from private R2)
3. Approve or Reject (reject requires reason → email + in-app notification)

## APIs (WiamApp backend)

| Action | Route |
|--------|--------|
| Queue | `GET /api/admin/verification-queue?type=worker\|customer` |
| Doc URL | `GET /api/admin/document-url/:s3Key` |
| Approve | `POST /api/admin/verification/approve/:reviewId` `{ userId, type }` |
| Reject | `POST /api/admin/verification/reject/:reviewId` `{ userId, type, reason }` |

Auth for Studio: header `x-studio-service-key` = `STUDIO_SERVICE_KEY` (must match Studio Vercel + WiamApp Render).

User submit paths (mobile uses `/api/verification/...`):

- `POST /api/verification/upload-document`
- `POST /api/verification/submit-worker`
- `POST /api/verification/submit-customer-simple`

## Ops checklist (Martin)

1. Run migration `database/migrations/045_worker_verifications.sql` on Supabase
2. Confirm Render env: `R2_PRIVATE_*`, `STUDIO_SERVICE_KEY`, and that Studio `WIAMAPP_API_URL` + `STUDIO_SERVICE_KEY` match
3. Open Studio via Founder login → **WiamApp Docs** (or Support tab)

## Do not

- Rebuild a separate WiamApp-only Founder site — Studio is the control surface
- Change WiamPass organizer verify or other products’ Studio queues
