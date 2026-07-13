# Letter to all WiamLabs repository agents

**From:** Martin (Founder)  
**To:** Every agent working in WiamApp, WiamPass, WiamTrade, WiamAI, Studio, or any other WiamLabs product repo  
**Subject:** Shared Founder / Team dashboard — work rules  
**Date:** 14 July 2026  

---

## Read this before you change any Founder or Team UI

WiamLabs will have **one Founder / Team control surface** (company internal dashboard) where Martin and the WiamLabs team manage **all products**.

Multiple agents may work on that **same dashboard** at the same time:

- The **WiamApp agent** upgrades WiamApp controls (e.g. worker/customer document review).
- The **WiamPass agent** upgrades WiamPass controls (e.g. organizer verification, events, founder tabs).
- Future agents will do the same for Trade, AI, etc.

You are **not** alone on that surface. Treat it like a shared kitchen: cook your dish, do not throw away someone else’s food.

---

## Hard rules (non-negotiable)

### 1. Focus on your product
- Work primarily in **your product’s repo** (APIs, mobile app, product web, database).
- You may touch the **shared Founder / Team dashboard** only for **your product’s module / section / tab**.

### 2. Shared dashboard is multi-product
- Pages that Founder or team open must support **product switching** (e.g. WiamApp ↔ WiamPass).
- When you add a feature, add it under **your product’s switch/state**, not as a global overwrite that removes other products.

### 3. Do not break other agents’ work
- **Do not** delete, rename, rewrite, or “simplify away” another product’s routes, components, tabs, APIs, env vars, or copy on the shared dashboard.
- **Do not** replace a whole shared page with a single-product version.
- **Do not** merge unrelated products into one form that only your product understands.
- If you need a shared layout change (nav, shell, auth, product picker), make it **additive and backwards-compatible**, and leave other products’ modules working.

### 4. Where to put Founder / Team UI
- Put Founder / Team pages in the **shared company studio / founder dashboard codebase** (the internal control site — not the public marketing homepage, and not buried only inside one product forever).
- Product-specific **business logic and APIs stay in the product repo** (WiamApp backend, WiamPass API, etc.). The shared dashboard **calls** those APIs; it does not own another product’s database.

### 5. Coordination before destructive edits
Before you:
- rename shared routes,
- change Founder auth,
- change the product switcher,
- or refactor the shell layout,

**stop and ask Martin**, or leave a short note of what you need so other agents are not surprised.

### 6. Push your own product work; don’t block others
- Commit and push **your product’s** changes when asked / when complete.
- Do not leave the shared dashboard half-broken for another product while you experiment.

---

## How to work on the same dashboard safely

| Do | Don’t |
|----|--------|
| Add `/founder/...` or module files scoped to your product (`wiamapp/`, `wiampass/`) | Rewrite `/founder/page.tsx` into WiamApp-only or WiamPass-only |
| Extend the product switcher with your product’s panels | Remove another product from the switcher |
| Call your product’s admin/verify APIs | Hardcode another product’s secrets into your module |
| Keep shared shell (nav, login, layout) stable | “Clean up” by deleting tabs you don’t understand |
| Document what you added under your product name | Assume you are the only agent on the file |

---

## Example (document review)

- **WiamApp agent:** builds **WiamApp** document upload review (workers/customers) in the shared dashboard under product = WiamApp.
- **WiamPass agent:** builds / upgrades **WiamPass** organizer verification in the **same** dashboard under product = WiamPass.
- Founder switches product → sees the right queue.
- Neither agent deletes the other’s queue or forces one product’s UI onto the other.

---

## One-line summary

**Every agent owns its product. The Founder dashboard is shared. Extend your slice. Never break another product’s slice.**

— Martin / WiamLabs  
© 2026 WiamLabs. All rights reserved.
