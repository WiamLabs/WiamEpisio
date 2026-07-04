# WiamApp

**Trusted, verified home services and skilled labor marketplace for Ghana and West Africa.**

WiamApp connects customers with identity-verified electricians, cleaners, plumbers, drivers, and other skilled workers. Every booking is protected by escrow payments, in-app chat with automated moderation, and a dispute resolution system. Businesses — hotels, hospitals, offices — book and manage workers at scale through a dedicated web portal.

Built and maintained by **WiamLabs**.

---

## Product

| | |
|---|---|
| **Consumer app** | iOS & Android, built with Expo / React Native |
| **Marketing site** | [wiamapp.com](https://wiamapp.com) — Next.js |
| **Business portal** | [wiamapp.com/business](https://wiamapp.com/business) — Next.js, served from a separate internal service |
| **API** | `api.wiamapp.com` — Node.js / Express |
| **Database** | Supabase (PostgreSQL, Auth, Realtime) |
| **File storage** | Cloudflare R2 (public + private buckets) |
| **Payments** | Paystack (escrow) + RevenueCat (subscriptions) |

Full product specification, system design, and architecture rules live in [`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md).

---

## Repository structure

This is a monorepo. One repository, one push, three deployed services.

```
WiamApp/
├── backend/         Express API — deploys as the wiamapp-backend service
├── database/        SQL migrations, run manually against Supabase
├── mobile/          Expo application — built and distributed via EAS
├── marketing/       Next.js — deploys as the wiamapp-marketing service
├── business-web/    Next.js — deploys as the wiamapp-business-web service
├── docs/            Product specification and architecture documentation
└── render.yaml       Render Blueprint defining all deployed services
```

`marketing` and `business-web` are two independently deployed services. `marketing/next.config.js` proxies `wiamapp.com/business/*` to the business-web service, so the two are indistinguishable to an end user — there is exactly one public domain.

---

## Local development

### Backend

```bash
cd backend
npm install
cp .env.example .env      # fill in Supabase, R2, Paystack, and AI moderation keys
npm run dev
```

### Mobile

```bash
cd mobile
npm install
cp .env.example .env      # Supabase URL/key, backend URL, R2 public URL
npx expo start
```

### Marketing site

```bash
cd marketing
npm install
cp .env.example .env.local
npm run dev
```

### Business portal

```bash
cd business-web
npm install
cp .env.example .env.local
npm run dev
```

---

## Deployment

Backend, marketing, and business portal deploy to [Render](https://render.com) via the `render.yaml` Blueprint at the repository root.

1. Push to `main` on `github.com/WiamLabs/WiamApp`
2. Render dashboard → **New** → **Blueprint** → connect the repository
3. Render provisions all three services from `render.yaml`
4. Set each service's environment variables in the Render dashboard — secrets are never committed to the repository
5. Map `wiamapp.com` to the `wiamapp-marketing` service only. `wiamapp-business-web` receives no public domain; it is reached exclusively through the marketing service's rewrite proxy

Database migrations are run manually against Supabase (SQL Editor), in numeric order, from `database/migrations/`. See `docs/MASTER_PLAN.md`, Section 27, for the full run order.

The mobile app is built and distributed through [EAS](https://expo.dev/eas), independent of the Render deployment cycle.

---

## Environment variables

Each service's `.env.example` is the authoritative, current list for that service. `docs/MASTER_PLAN.md` documents the purpose of each variable in detail, including which are required versus optional for a given environment.

---

## License

Proprietary. All rights reserved.

© 2026 WiamApp. Powered by WiamLabs.
