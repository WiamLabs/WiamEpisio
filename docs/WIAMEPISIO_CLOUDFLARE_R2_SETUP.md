# WiamEpisio — Domain + Cloudflare R2 (step by step)

**Brand host (now):** `episio.wiamlabs.com` (subdomain of wiamlabs.com)  
**Later:** buy `wiamepisio.com` and point it at the same place  
**API today:** can stay `https://wiamapp.com/api/v1` until you flip DNS + Render custom domain  
**Video storage:** Cloudflare **R2** (this guide)

Two different jobs:


| Piece                 | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `episio.wiamlabs.com` | Website / brand / later API + deep links |
| R2 bucket             | Store episode/trailer video files        |


---

# PART A — Subdomain `episio.wiamlabs.com` (do this anytime)

You already own **wiamlabs.com**. Add a subdomain; no new purchase needed.

### A1. Get your Render service hostname

1. Open [https://dashboard.render.com](https://dashboard.render.com)
2. Open the **same** web service that runs WiamApp (Flask)
3. Copy the Render URL, like `https://something.onrender.com`



### A2. Add DNS in Cloudflare (where wiamlabs.com is managed)

1. Cloudflare → select zone **wiamlabs.com**
2. **DNS** → **Records** → **Add record**
3. Set:
  - **Type:** `CNAME`
  - **Name:** `episio`  
  (this makes `episio.wiamlabs.com`)
  - **Target:** your Render hostname **without** `https://`  
  e.g. `something.onrender.com`
  - **Proxy status:** start with **DNS only** (grey cloud) so SSL is simpler; you can orange-cloud later
4. Save



### A3. Add custom domain on Render

1. Render → your web service → **Settings** → **Custom Domains**
2. **Add** `episio.wiamlabs.com`
3. Wait until Render shows certificate **Verified** / active



### A4. Check

Browser: `https://episio.wiamlabs.com`  
Should load the same app as wiamapp.com (same service).

**Mobile API for now:** keep `EXPO_PUBLIC_API_URL=https://wiamapp.com/api/v1` until Episio subdomain is stable. Later you can switch to `https://episio.wiamlabs.com/api/v1`.

---



# PART B — Cloudflare R2 — **two buckets** (public media + private KYC)

Payout KYC uploads **Ghana Card / Passport / License** photos. Those must **never** share a public video bucket.


| Bucket                  | Name (suggested)      | Public?                       | What goes in                                  |
| ----------------------- | --------------------- | ----------------------------- | --------------------------------------------- |
| **Media (playable)**    | `wiam-episio-media`   | Yes (r2.dev or custom domain) | Trailers, episode MP4s, series covers/posters |
| **Private (sensitive)** | `wiam-episio-private` | **No — never**                | KYC ID front/back, payout docs                |


- Media: players need a URL → public base or short-lived signed GET  
- Private: only **presigned URLs** for founder/reviewer (minutes TTL); no r2.dev, no custom public domain

Code today wires `VIDEO_PROVIDER=r2` to the **media** bucket. Private KYC bucket is for payout KYC (wire next once media works).

---



## Step 1 — Open R2

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Left menu → **R2 Object Storage** (or search “R2”)
3. If Cloudflare asks you to enable R2, click **Purchase / Enable** (R2 has a free tier; you still “enable” the product)



## Step 2 — Create **two** buckets



### 2A — Media (public-capable)

1. **Create bucket**
2. **Bucket name:** `wiam-episio-media`
3. Location: Automatic → Create



### 2B — Private KYC (locked)

1. **Create bucket** again
2. **Bucket name:** `wiam-episio-private`
3. Location: Automatic → Create
4. Do **not** enable r2.dev / public access on this bucket — ever



## Step 3 — Find your Account ID

1. Still in Cloudflare, any page right sidebar or **R2 overview**
2. Copy **Account ID** (long hex string)
  You will paste this as `CLOUDFLARE_ACCOUNT_ID`



## Step 4 — Create R2 API token (Access Key + Secret)

1. R2 overview → **Manage R2 API Tokens** (or Account → R2 → Manage API tokens)
2. **Create API token**
3. Settings:
  - **Token name:** `wiam-episio-render`
  - **Permissions:** **Object Read & Write**
  - **Apply to buckets:** `wiam-episio-media` **and** `wiam-episio-private`
4. Create
5. **Copy immediately** (shown once):
  - **Access Key ID** → `CLOUDFLARE_R2_ACCESS_KEY_ID`
  - **Secret Access Key** → `CLOUDFLARE_R2_SECRET_ACCESS_KEY`

Store them in a password manager. If you lose the secret, create a new token.

## Step 5 — Public URL **only on the media bucket**

Players need a URL to read video. KYC must never be public.

### Option 5A — Quick test: R2.dev (**media** bucket only)

1. Open bucket `wiam-episio-media` (not private)
2. **Settings** → **Public access** / **R2.dev subdomain**
3. Allow / connect r2.dev
4. Copy `https://pub-xxxxxxxx.r2.dev` (no trailing slash)
  → `CLOUDFLARE_R2_PUBLIC_BASE_URL`



### Option 5B — Brand later

1. On `wiam-episio-media` only → Custom domain e.g. video.episio.wiamlabs.com
2. `CLOUDFLARE_R2_PUBLIC_BASE_URL=https://video.episio.wiamlabs.com`

**Never** enable r2.dev or a custom domain on `wiam-episio-private`.

## Step 6 — Put secrets on Render

1. Render → your Flask web service → **Environment**
2. Add (exact names):

```
VIDEO_PROVIDER=r2
CLOUDFLARE_ACCOUNT_ID=paste_account_id
CLOUDFLARE_R2_ACCESS_KEY_ID=paste_access_key
CLOUDFLARE_R2_SECRET_ACCESS_KEY=paste_secret_key
CLOUDFLARE_R2_BUCKET=wiam-episio-media
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
CLOUDFLARE_R2_PRIVATE_BUCKET=wiam-episio-private
EPISIO_SOFT_INTEREST=0
```

`CLOUDFLARE_R2_PRIVATE_BUCKET` = KYC / payout ID scans (signed URLs only; no public base).

1. Save → wait for **redeploy** to finish
  (`boto3` is already in `requirements.txt`)



## Step 7 — Verify R2 is live

After deploy, open (browser or curl):

```
https://wiamapp.com/api/v1/episio/media-specs
```

(or `https://episio.wiamlabs.com/api/v1/episio/media-specs` once subdomain works)

You want JSON like:

```json
{ "ok": true, "provider": "r2", "specs": { ... } }
```

- If `"provider": "stub"` → env missing/wrong or deploy not finished  
- If `"provider": "r2"` → bucket wiring works



## Step 8 — App test

```powershell
cd "C:\WiamLabs Projects\WiamAppMobile"
npm run start:offline
```

1. Sign in (creator-accepted account or founder)
2. Profile → Upload / Studio
3. Create series → add episode / trailer path
4. Confirm upload uses R2 (no stub host in upload URL)

When testing is good, set:

```
EPISIO_SOFT_INTEREST=1
```

(or delete that env var) before real public launch.

---



# Checklist (tick as you go)

- [ ] DNS: `episio` CNAME → Render  
- [ ] Render custom domain: `episio.wiamlabs.com` verified  
- [ ] R2 bucket `wiam-episio-media` created + public (r2.dev or custom)  
- [ ] R2 bucket `wiam-episio-private` created + **not** public  
- [ ] Account ID copied  
- [ ] R2 API token created; Access Key + Secret saved  
- [ ] Public base URL only for **media**  
- [ ] All Render env vars set + redeployed  
- [ ] `/api/v1/episio/media-specs` returns `"provider": "r2"`  
- [ ] Message agent: **“R2 is on Render”**



### Domain 502 note

If Render says domain verified but browser shows **HTTP 502** while certificate is “issuing”, wait 5–15 minutes and reload. Check Render **Logs** if it persists. `wiamapp.com` should still work while SSL finishes for `episio.wiamlabs.com`.

---



# Common mistakes


| Mistake                                                      | Fix                                              |
| ------------------------------------------------------------ | ------------------------------------------------ |
| Used Cloudflare **Stream** token instead of **R2** API token | Create token under **R2 → Manage R2 API Tokens** |
| Proxy orange cloud on brand new CNAME + broken SSL           | Use DNS only (grey) first                        |
| Typo in env var names                                        | Must match exactly (`CLOUDFLARE_R2_...`)         |
| Public URL with trailing `/`                                 | Use no trailing slash                            |
| Expecting video without redeploy                             | Env changes need a finished Render deploy        |


---



# Later (when you buy wiamepisio.com)

1. Buy domain
2. Add to Cloudflare
3. CNAME `www` / `@` → same Render service (or CNAME to `episio.wiamlabs.com` per Cloudflare docs)
4. Add custom domain on Render
5. Optionally move `CLOUDFLARE_R2_PUBLIC_BASE_URL` to `https://video.wiamepisio.com`

No second backend. Same Flask app, new hostname only.