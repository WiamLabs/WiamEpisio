# Enterprise QA E2E Setup (Free-First, Upgrade-Ready)

This guide enables full Top 15 E2E execution and reporting into WiamApp QA dashboard.

## 1) What is already implemented

- Top 15 Maestro flows in `WiamAppMobile/maestro/flows/`
- Master suite in `WiamAppMobile/maestro/suite_top15.yaml`
- CI workflow posts QA status to backend webhook
- QA dashboard shows automation feed and score

## 2) Make E2E truly live on devices

Use one of these options:

### Option A (free-first)
- Run Maestro on a dedicated local machine (Android emulator + iOS simulator/mac)
- Schedule daily runs (Task Scheduler/cron)
- Post results to `POST /team/qa/automation/report`
- Windows hourly runner scripts are provided:
  - `scripts/qa/run_hourly_device_runner.ps1`
  - `scripts/qa/setup_hourly_scheduler.ps1`

### Option B (upgrade later)
- Move same Maestro suite to cloud device farm (Maestro Cloud / BrowserStack)
- Keep webhook payload contract unchanged

## 3) Required secrets

Backend (Render):
- `QA_AUTOMATION_WEBHOOK_SECRET=<long-random-secret>`

CI (GitHub Secrets):
- `QA_WEBHOOK_SECRET=<same secret>`
- `QA_REPORT_ENDPOINT=https://wiamapp.com/team/qa/automation/report`

Windows runner machine env (or scheduler args):
- `QA_WEBHOOK_SECRET=<same secret>`
- `QA_REPORT_ENDPOINT=https://wiamapp.com/team/qa/automation/report`

## 4) Daily E2E report payload contract

```json
{
  "suite": "wiamapp-top15-e2e",
  "status": "pass",
  "score": 92,
  "environment": "maestro-device-runner",
  "platform": "android+ios",
  "run_url": "https://...",
  "summary": "15/15 flows passed",
  "metrics": {
    "flows_total": 15,
    "flows_passed": 15,
    "flows_failed": 0
  }
}
```

## 5) Non-destructive safety

- Use staging/test accounts for auth/payment-heavy flows
- Keep production smoke checks read-only
- Never run destructive cleanup on production users/content

## 6) Hourly email alerts until fixed

- Backend now sends QA failure emails to Founder + Engineer team at most once per hour while failures continue.
- When the suite returns to PASS, a resolved email is sent and hourly reminders stop.
