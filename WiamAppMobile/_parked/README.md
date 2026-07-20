# Parked WiamApp novel / pass-1 UI (2026-07-17)

Moved **out of `src/`** so Expo/Metro stays light.

- Do not delete — Text Edition / Novel hub screens when HTML wires Novel button.
- Do not import from here into live navigators.
- Restore path when building Novel hub: copy needed screens back under `src/screens/` or import explicitly.

Backend tables were **not** dropped. Slim routes: `EPISIO_SLIM=1` (default).