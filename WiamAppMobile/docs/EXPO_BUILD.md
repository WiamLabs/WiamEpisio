# WiamApp — Expo (native) vs Render (API)

Static app settings live in **`app.json`**. **`app.config.js`** only extends that (scheme, `extra.apiUrl`) so `expo-doctor` stays green — do not duplicate the whole config in JS.

| What | Where |
|------|--------|
| **Mobile app** (Expo / EAS) | Built with `eas build`; runs on phones via App Store / Play / internal APK/IPA |
| **API + database** | Your Flask app on **Render** (or local `server.py`) + **Supabase Postgres** via `DATABASE_URL` on the server |

The Expo app does **not** connect to the database directly. It calls `EXPO_PUBLIC_API_URL` (your backend). The backend uses Supabase Postgres.

## Local development

1. Start API: `python server.py` from repo root (port 8080).
2. Copy `.env.example` → `.env` in `WiamAppMobile/`.
3. Set `EXPO_PUBLIC_API_URL=http://YOUR_PC_LAN_IP:8080/api/v1` (same Wi‑Fi as the phone).
4. Run: `npx expo start --clear --port 8082 --host lan`

## Production builds (EAS)

1. Install CLI: `npm i -g eas-cli` (or use `npx eas-cli`).
2. Log in: `eas login`
3. Link project: `cd WiamAppMobile && eas init`
4. Set production API (if not using default in `eas.json`):

   ```bash
   eas secret:create --name EXPO_PUBLIC_API_URL --value https://api.wiamapp.com/api/v1 --type string
   ```

   Then reference it in `eas.json` under `build.production.env` or use EAS Environment variables in the Expo dashboard.

5. Build:

   ```bash
   eas build --profile production --platform android
   eas build --profile production --platform ios
   ```

6. Submit (optional): `eas submit --platform android` / `ios`

## Error UI in the app

`ErrorBoundary` + `errorHints` show **what broke** and **suggested fixes** on device. Check the Metro terminal for `[WiamApp Error]` lines too.
