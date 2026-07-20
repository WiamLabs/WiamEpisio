# WiamApp Google Play Release Checklist

Use this checklist to move from dev-ready to publish-ready. Companion CI
job `playstore-readiness` (in `.github/workflows/qa-enterprise-ceo-rest-mode.yml`)
verifies the static parts of this list on every push.

## 0) Launch playbook (timing-first)

Google's policies have hardened over the last year. Plan around these
real-world gates rather than only the static checklist below.

| Step | What | Realistic time |
| --- | --- | --- |
| 0.1 | Open Play Console developer account ($25, ID + address verification) | 2-7 days for new accounts |
| 0.2 | `eas init` to lock a real EAS `projectId` (current value `wiamapp-mobile` is a placeholder) | 5 minutes |
| 0.3 | First production AAB: `eas build -p android --profile production` | 30-60 minutes |
| 0.4 | Upload AAB to Internal Testing track + invite >= 12 testers | 1 day |
| 0.5 | Mandatory Closed Testing window for new accounts | 14 days minimum |
| 0.6 | Apply for Production access after closed test passes | 1-3 days |
| 0.7 | Promote to Production | minutes |

Until step 0.5 is complete, you cannot publish to Production no matter
how green every other gate is. Start step 0.1 in parallel with the rest
of this checklist.

## 0a) One-time EAS setup

```bash
cd WiamAppMobile
npm install -g eas-cli
eas login
eas init                      # writes a real UUID into app.json
eas build:configure           # confirms eas.json profiles
eas build -p android --profile production
```

After `eas init`, commit the updated `app.json` (the new `extra.eas.projectId`).
The `playstore-readiness` CI job will start verifying the projectId once it
becomes a UUID.

## 1) Code and config

- [x] Production API base points to `https://api.wiamapp.com/api/v1`
- [x] RevenueCat purchase confirmation is strict on backend
- [x] Dev premium activation is blocked in production builds
- [x] Android AdMob App ID and ad units are configured
- [x] iOS AdMob App ID and ad units are configured
- [x] In-app comment reporting sends real moderation reports
- [x] In-app account deletion flow exists

## 2) AdMob account readiness

- [ ] Complete AdMob payment profile (`Fix it` banner in AdMob)
- [ ] Verify apps and ad units are no longer pending critical setup
- [ ] Keep test ads in dev and internal testing until ad serving is approved

## 3) Google Play Console requirements

- [ ] Privacy Policy URL set in Play Console
- [ ] Data safety form completed accurately
- [ ] Content rating questionnaire completed
- [ ] App access details provided (test credentials if needed)
- [ ] Deletion support URL provided (if requested by policy flow)
- [ ] Target audience + ads declarations completed

## 4) Pre-launch quality gates

- [ ] Internal test track build uploaded
- [ ] Play Pre-launch report reviewed (crashes/ANRs/render issues)
- [ ] Critical flows tested end-to-end:
  - [ ] Register/login/logout
  - [ ] Profile image upload
  - [ ] Premium purchase + restore
  - [ ] Coin purchase and chapter unlock
  - [ ] Rewarded ad unlock path
  - [ ] Reader comments/reporting/deletion
  - [ ] Account deletion

## 5) Release decision

Publish only when all items above are done and no blocker remains in:

- Crash/ANR metrics
- Billing and premium activation
- Account/deletion/privacy policy compliance
- AdMob production readiness

## 6) Continuous monitoring after launch

Once the Production build is live, the QA pipeline takes over:

- `qa-enterprise-ceo-rest-mode` workflow runs hourly and on every push.
- `watchdog-production-probes` job hits `/health`, `/health/db`, `/`,
  `/careers` and posts results to `/team/qa/watchdog/probe`.
- The server's bug dispatcher emails founders + engineers per target:
  immediate alert on first failure, hourly reminder until fixed, and
  a resolution email on recovery.
- `playstore-readiness` job re-validates the static surface (package id,
  icons, deep-link host, required Expo plugins, privacy policy reachable)
  on every push so listing-rejection bait never sneaks in unnoticed.

Daily heartbeat email confirms the entire pipeline is alive even when
nothing is broken. If you ever stop receiving the daily heartbeat,
something between GitHub Actions and Resend has broken --- treat the
silence as itself an alert.

