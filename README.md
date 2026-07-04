# WiamApp — Monorepo
### © 2026 WiamApp. Powered by WiamLabs

Trusted, verified home services marketplace for Ghana & West Africa.

**Full product spec, architecture rules, and build status:**
[`docs/MASTER_PLAN.md`](docs/MASTER_PLAN.md) — the strict blueprint every
AI tool and developer builds against. This README is the fast path to
running the code; the Master Plan is everything else (vision, every
system's design, API surface, screen list, AI development rules).

One repo, one push, three deployed services. This replaces pushing
`WiamAppExpo`, `WiamApp-Marketing`, and `WiamApp-Business-Web` as three
separate repos.

```
WiamApp/
├── backend/          Express API — deploys to Render as wiamapp-backend
├── database/          SQL migrations — run manually in Supabase, not deployed
├── mobile/             Expo app — NOT deployed to Render, built via EAS instead
├── marketing/         Next.js — deploys to Render as wiamapp-marketing (wiamapp.com)
│                       serves EVERYTHING a browser sees, including /business/*
├── business-web/       Next.js — deploys to Render as wiamapp-business-web
│                       NO public domain — reached only via marketing's proxy at
│                       wiamapp.com/business/{login,apply,dashboard}
└── render.yaml         tells Render about all 3 web services at once
```

**One domain, no subdomains.** `wiamapp.com/business/dashboard` looks and works
like any other page on the site, but is transparently proxied to the separate
`business-web` service behind the scenes (see the `rewrites()` block in
`marketing/next.config.js`). Nobody outside the team ever needs to know two
services are involved. The only subdomain anywhere in this setup is
`api.wiamapp.com` for the backend — and that's fine, because it's
machine-facing only (the mobile app and both web apps call it), no human ever
types or sees that URL in a browser tab.

## Why I can't push this for you

I don't have network/GitHub access from here — I can only prepare files.
You need to run the push yourself, once, from wherever you download
this zip to (your laptop, or even a Codespace/Termux on your phone if
that's easier). It's five commands.

## One-time setup (do this once)

**1. Create the repo on GitHub** (under your `WiamLabs` account)
- Go to github.com/new
- Owner: `WiamLabs`, Repository name: `WiamApp`, keep it **empty** (no README/license — you already have files)

**2. Push this folder**
```bash
cd WiamApp          # this folder, after unzipping
git init
git add .
git commit -m "Monorepo: backend, database, mobile, marketing, business-web"
git branch -M main
git remote add origin https://github.com/WiamLabs/WiamApp.git
git push -u origin main
```
If prompted for a password, GitHub no longer accepts your account password —
use a Personal Access Token instead (GitHub → Settings → Developer settings
→ Personal access tokens → generate one, paste it in place of the password).

**3. Connect Render**
- Render dashboard → **New +** → **Blueprint**
- Connect the `WiamLabs/WiamApp` repo
- Render reads `render.yaml` and proposes all 3 services at once
- Click through — it creates `wiamapp-backend`, `wiamapp-marketing`, `wiamapp-business-web`

**4. Fill in secrets**
Every env var marked `sync: false` in `render.yaml` needs its real value
typed into the Render dashboard for that service (Render never lets
secrets live in the git repo itself, which is correct — don't fight this).
Use `TESTING_PLAN_CORRECTIONS.md` (in this same zip) for the full,
accurate list of what each one is.

**5. Map your domain**
- `wiamapp-marketing` service → Settings → Custom Domain → `wiamapp.com` + `www.wiamapp.com`
- `wiamapp-business-web` → **no custom domain** — leave it on its default `.onrender.com` URL, then paste that URL into `wiamapp-marketing`'s `BUSINESS_ORIGIN` env var so the proxy can reach it
- `wiamapp-backend` → optional: `api.wiamapp.com` (the default `.onrender.com` URL also works fine for testing)

You'll update your domain's DNS (wherever wiamapp.com is registered) to
point at Render — Render shows you the exact CNAME/A records to add
once you type in the domain.

## Every day after that

```bash
git add .
git commit -m "whatever you changed"
git push
```
That's it. Render watches the repo and redeploys only the service(s)
whose folder actually changed — backend edit redeploys just the
backend, marketing edit redeploys just the marketing site, and so on.
No more juggling three separate pushes.

## The mobile app is different

`mobile/` never touches Render. To ship a new build to testers:
```bash
cd mobile
eas build --platform android --profile preview
```
See `WiamApp-Testing-Build-Plan.md` (your own doc) — Phase 2–4 — for
the full EAS flow, with the one correction noted in
`TESTING_PLAN_CORRECTIONS.md`: the env var is `EXPO_PUBLIC_BACKEND_URL`,
not `EXPO_PUBLIC_API_URL`.

## Database migrations

Still run these by hand in the Supabase SQL editor, in order, from
`database/migrations/`. They are not part of the git deploy — Supabase
doesn't watch your repo. Migration 035 is new this session; run it
after 028–034 if you haven't already.
