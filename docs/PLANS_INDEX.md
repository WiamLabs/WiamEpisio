# WiamLight — plans index

Single place to remember **what we planned** and **where it lives**. Update this file when you add or finish a major plan.

## Why `docs/WiamApp_reader_creator_plan_v1.md` can show “modified” but not on GitHub

That file often has **local edits** (Cursor sessions, planning tweaks). When we push a **narrow fix** (e.g. QA bot only), we sometimes **commit only the files for that fix** so the history stays reviewable. Your reader/creator plan changes stay **working-tree only** until you run:

`git add docs/WiamApp_reader_creator_plan_v1.md && git commit -m "docs: update reader/creator plan"`

Nothing is wrong with the doc—it's just **not staged** yet.

---

## Critical plan snapshots (git — copy of Cursor plans)

Canonical backups of the four highest-priority Cursor plans live under **`plans/critical/`** (same content as `~/.cursor/plans/` at time of copy). **These are planning artifacts only**—execution tracking stays in **AGENT_MEMORY** and shipping code.

| File | Topic |
|------|--------|
| [plans/critical/enterprise_monetization_e2e_5ade2d9a.plan.md](plans/critical/enterprise_monetization_e2e_5ade2d9a.plan.md) | Monetization + security (SEC-01/02, webhooks, creator subs) |
| [plans/critical/reader-first_growth_master_b28c1641.plan.md](plans/critical/reader-first_growth_master_b28c1641.plan.md) | Reader-first growth master (P0–P4) |
| [plans/critical/social_identity_community_721e0e01.plan.md](plans/critical/social_identity_community_721e0e01.plan.md) | Usernames, mentions, community, phone |
| [plans/critical/wiamvox_roadmap_+_launch_docs_acc9b8d2.plan.md](plans/critical/wiamvox_roadmap_+_launch_docs_acc9b8d2.plan.md) | WiamVox roadmap + launch doc hooks |

---

## Plans tracked in this repo (source of truth for the team)

| Document | Topic |
|----------|--------|
| [WiamApp_reader_creator_plan_v1.md](WiamApp_reader_creator_plan_v1.md) | Profile / settings / drawer inventory and backlog |
| [AGENT_MEMORY.md](AGENT_MEMORY.md) | Running session state—what was done last, deploy notes |
| [../IAP_COMPLETION_PLAN.md](../IAP_COMPLETION_PLAN.md) | RevenueCat / store IAP completion steps |
| [../SubscriptionPlan.md](../SubscriptionPlan.md) | Subscription product notes (root) |
| [../WiamPlatformPlan.md](../WiamPlatformPlan.md) | Broad platform plan (root) |
| [../WiamLabs/CDN_MIGRATION_PLAN.md](../WiamLabs/CDN_MIGRATION_PLAN.md) | CDN migration |

**Intended but not always committed yet (names from product sessions):**

| Document | Topic |
|----------|--------|
| `docs/ENTERPRISE_MONETIZATION_SECURITY_PLAN.md` | Canonical merge of monetization + security audit (create when executing that roadmap) |
| `docs/WiamApp_reader_first_growth_plan.md` | Reader-first growth priorities |
| `docs/WiamApp_social_identity_and_community_plan.md` | Mentions, community, phone posture |
| `docs/WiamVox_product_roadmap_v1_v5.md` | WiamVox phased roadmap |

---

## Cursor IDE plan files (this machine)

Cursor stores plan artifacts under the **user** profile, e.g. `C:\Users\<You>\.cursor\plans\`, not always inside the git repo. Treat **`docs/`** as what you **commit**; copy or summarize important Cursor plans here so the team and GitHub see them. The **four priority plans** are now also mirrored under **`docs/plans/critical/`** (see table above).

**Plans seen in `.cursor/plans` (titles only—reconcile on your PC):**

1. `reader-first_growth_master_b28c1641.plan.md` — reader-first growth master
2. `social_identity_community_721e0e01.plan.md` — usernames, mentions, community, phone
3. `enterprise_monetization_e2e_5ade2d9a.plan.md` — monetization + security (SEC-01/02, etc.)
4. `wiamvox_roadmap_+_launch_docs_acc9b8d2.plan.md` — WiamVox roadmap + launch doc hooks
5. `social_economy_ia_plan_a2d1afe0.plan.md` — social economy / IA
6. `daily_rotating_home_v2_*.plan.md` — home feed V2
7. `reader_creator_dashboard_v1_*.plan.md` — reader/creator dashboard
8. `brand_polish_+_post-onboarding_screens_336d847d.plan.md`
9. `beautiful_onboarding_v2_4e846955.plan.md`
10. `registration_wizard_wiamapp*.plan.md`
11. `deep_tracking_and_home_fix_e21a8a4d.plan.md`
12. `creator_publishing_playready_df62d053.plan.md`
13. `wiamvox_premium_studio_plan_c3d95ae0.plan.md`
14. `wiamvox_monetization_+_testing_445190ff.plan.md`
15. `wiamvox_full_v1_plan_002d300f.plan.md`

**Rough count:** about **15–20** Cursor plan files over time (some duplicates/iterations). The **canonical count** for the product is whatever you keep in **`docs/`** and merge into **AGENT_MEMORY** when you execute work.

---

## How to not forget

1. When a Cursor plan is **approved**, copy the title + link into this file and add a short **one-line outcome**.
2. When code ships, point **AGENT_MEMORY** at the same doc (or paste the commit SHA).
3. Prefer **`docs/*.md`** in git over a long-lived plan only inside `.cursor/plans/`.

---

*Last updated: 2026-05-06 — added `plans/critical/` snapshots of the four priority Cursor plans (committed to git).*
