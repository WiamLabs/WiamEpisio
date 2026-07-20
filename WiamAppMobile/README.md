# WiamApp Mobile (Expo)

Native app for WiamApp. The **API and database** live on your server (**Render** + **Supabase Postgres**); this client only calls `EXPO_PUBLIC_API_URL`.

## Quick start

**macOS / Linux**

```bash
cd WiamAppMobile
cp .env.example .env
```

**Windows (PowerShell)**

```powershell
cd WiamAppMobile
Copy-Item .env.example .env
```

Then edit `.env`: set `EXPO_PUBLIC_API_URL=http://YOUR_PC_IP:8080/api/v1` (phone and PC on same Wi‑Fi).

```bash
npm install
npm run start:clear
```

Open **Expo Go** and scan the QR code.

## Health check

```bash
npx expo-doctor
```

## Production builds (EAS)

See **[docs/EXPO_BUILD.md](./docs/EXPO_BUILD.md)** — `eas init`, then `npm run build:android` / `build:ios`.

## Enterprise QA (Top 15 E2E)

See **[docs/QA_E2E_ENTERPRISE.md](./docs/QA_E2E_ENTERPRISE.md)** for the always-on Maestro QA suite and dashboard reporting.

## Errors on device

The app includes an **Error Boundary** with suggested fixes. Metro also logs lines starting with `[WiamApp Error]` when possible.
