# WiamApp Maestro E2E Suite (Top 15 Flows)

This suite is the "CEO rest mode" E2E pack for core user journeys.

## Structure

- `config.yaml` - default app id + metadata
- `flows/` - 15 independent critical flows
- `suite_top15.yaml` - master suite that runs all flows

## Prerequisites

1. Install Maestro CLI:
   - macOS: `brew install maestro`
   - Windows (PowerShell): `iwr -useb https://get.maestro.mobile.dev | iex`
2. Ensure a test device/emulator is connected and WiamApp is installed.
3. Use test/staging account credentials when running auth flows.

## Run all top 15 flows

```bash
cd WiamAppMobile
maestro test maestro/suite_top15.yaml
```

## Run one flow

```bash
cd WiamAppMobile
maestro test maestro/flows/01_auth_login_happy.yaml
```

## Notes

- Keep tests non-destructive on production.
- Prefer staging API for daily automation.
- These flows are designed to be expanded with stronger assertions over time.
