# WiamEpisio — Creator Experience Strategy
### From your conversation → to a strict, buildable flow → compared against our existing screens

**Source:** `Plan_Idea.txt` (your voice conversation about creator quality control)
**Purpose:** Turn your philosophy into an exact, stage-by-stage flow, then audit our 23 WiamStudio + 8 Apply screens against it — what already matches, what needs to be tightened, what's missing.

---

## 1. Your core philosophy, extracted and stated plainly

Reading through the conversation, here's the actual position you landed on (not just what was said, but what you kept circling back to and confirming):

1. **You don't want a YouTube.** Anyone-can-post kills the "high quality" promise. But too strict too fast kills growth. The answer isn't picking one — it's **staged strictness**.
2. **Stage 1 — Founder-curated only.** No public "Become a Creator" button yet. You personally find creators, personally review episode 1–6 (or the whole season), and hand-pick who gets in. This sets the bar before any system exists to enforce it.
3. **Stage 2 — Codify what you did manually into a checklist/rubric.** Once you've reviewed enough seasons yourself, the patterns become rules.
4. **Stage 3 — Rule-based system checks.** Resolution, duration, missing-episode detection, file validation — buildable now, no AI needed.
5. **Stage 4 — AI-assisted scoring, later.** Sharpness, lighting, stability, audio clarity — scored from the **output**, never the device. "Phone shot but great? Pass it. Expensive camera but poor result? Don't pass it." High-confidence passes auto-publish; low-confidence or borderline cases go to a human.
6. **The hardest problem you identified yourself: half-finished stories.** A creator could nail the trailer, get approved, start earning — and abandon the story at episode 6 of 20. Your fix: **no monetization until the full season is uploaded and explicitly locked.**
7. **The lock mechanic:** creator uploads every episode, then taps an explicit confirmation ("Are you sure this is the complete season?") — after that, **no more edits.** Fixes only happen through a **revision request**, and the system re-reviews only the changed part, not the whole season again.
8. **The platform publishes, not the creator.** You said this directly: *"I like that you want the platform to do the publishing. That feels curated."* Submit ≠ Live. Only WiamEpisio's review (system or human) flips the switch.
9. **Rejections must explain, not just refuse.** "Episode 3 video quality too low" beats "Rejected." Status should read **"Changes Required,"** not "Rejected" — same content, very different tone, and it's the tone that keeps creators trying instead of leaving.
10. **Trust tiers.** Creators who consistently deliver complete, high-quality seasons earn a faster review lane. New or inconsistent creators always get full review. This is what lets you scale without drowning.
11. **Two separate roles, not one.** **Reviewers** check quality *before* anything goes live. **Moderators** handle the community *after* it's live — comments, reports, abuse. You don't need moderators yet (nothing's live at scale), but the roles should never merge later.

---

## 2. The strict flow, stage by stage

```
CURATED INTAKE (Stage 1 — manual, founder-run)
  → Founder identifies creator personally (no public apply button live yet)
  → Creator applies with sample work
  → Founder reviews sample personally

TRAILER GATE
  → Creator uploads trailer
  → Rule-based check: aspect ratio, resolution, duration, codec
  → (Later) AI score: sharpness, lighting, stability, audio clarity
  → Pass → creator proceeds to full season build
  → Fail → "Changes Required" with specific reason, resubmit

FULL SEASON BUILD (no monetization possible yet)
  → Creator uploads every planned episode
  → Each episode individually passes rule-based checks on upload
  → Progress tracked: "12 of 20 episodes uploaded" — cannot submit until 20/20

SEASON LOCK (the critical strict gate you specifically asked for)
  → Explicit confirmation: "Confirm this is the complete season — you will not
    be able to edit episodes after this point"
  → Creator checks a box / taps a hard confirm — not a soft toggle
  → Once locked: episodes are frozen. Fixes only via Revision Request.

COMPLETENESS + SOFT-INTEREST GATE
  → All episodes ready + trailer passed + cover set + rights confirmed
  → Followers/remind-me threshold met (proves real audience interest
    before a human/system spends review time on it)

REVIEW (system-first, human on exceptions)
  → High-confidence pass → auto-publish
  → Low-confidence / borderline → routed to human Reviewer
  → Reviewer or system decision: "Live" or "Changes Required" (never a bare "Rejected")

PUBLISH (platform-controlled, not creator-controlled)
  → WiamEpisio flips it live — the creator's dashboard reflects it, but the
    creator never has a "Publish" button of their own during this phase

LIVE + TRUST BUILDING
  → Earnings begin only now
  → Consistent quality over multiple seasons → creator trust tier rises
  → Higher trust → faster review lane on future seasons
  → Lower trust / first-timer → always full review

POST-LIVE (Moderators, not Reviewers)
  → Comments, reports, abuse — handled by a separate role, only active
    once content is live at real volume
```

---

## 3. Screen-by-screen audit — what we have vs. what this flow demands

### ✅ Already strict — matches your philosophy closely, keep as-is
| Screen | Why it already fits |
|---|---|
| **WiamStudio-Completeness-Gate** | This *is* your "complete season" check — all planned episodes, trailer QA, cover, rights, all gated before Submit unlocks. Exactly your rubric. |
| **WiamStudio-Needs-Changes** | Already uses per-item, specific reasons ("Episodes 14–16 low dialogue volume") with a "Fix in X →" link — not a blanket rejection. This is precisely the tone you described. |
| **WiamStudio-Specs-Guide** | Rule-based, output-focused specs (9:16, 1080×1920, 4–5 min) — no mention of device/camera requirements. Matches "score the output, not the equipment." |
| **WiamStudio-Series-Trailer** | Trailer QA is a distinct gate before episodes matter, with pass/fail checklist — matches Stage 2 (Trailer Gate) exactly. |
| **WiamStudio-Episode-Reject-Wrong-Size** | Specific technical reason + fix steps, not a vague rejection. |
| **WiamStudio-Soft-Interest** | The followers/remind-me threshold before Submit — matches your "prove real interest before review time is spent" instinct. |

### 🟡 Close, but copy/logic needs tightening to be *strict enough*
| Screen | Gap | Fix needed |
|---|---|---|
| **WiamStudio-Series-Create** | Episode-count stepper is set once but nothing in the UI says this number is a *locked promise*, not a placeholder. | Add explicit copy: "This is your complete story length — you're committing to finish all N episodes before this series can go live." |
| **WiamStudio-Episode-Upload / Episode-List** | Creators can currently upload episodes in any order, no episode is "locked" individually, and there's no confirmation step distinguishing "draft upload" from "final." | Add a per-episode "mark as final" state, separate from just having a file present. |
| **WiamStudio-Submit-For-Live** | Says "Submit for Live" and lists a quality summary — good — but doesn't explicitly say **"After this, episodes are locked. Further changes require a Revision Request."** | Add that exact sentence before the Submit button. This is the single most important missing line in the whole pack, because it's the one thing you kept coming back to in the conversation. |
| **WiamStudio-Live-Success** | Says "You're live!" — celebratory, good — but the framing is creator-centric ("You're live") rather than platform-centric. | Minor copy shift: "WiamEpisio has published your series" reinforces *the platform publishes, not you* — the exact distinction you were proud of in the conversation. |
| **Creator-Apply-Intro** | Currently reads as a self-serve, always-open application ("Start Application" / "Not now"). | For Stage 1 (curated launch), this screen needs an **invite-gated variant**: either hidden entirely from the main nav, or shown with a waitlist/"currently by invitation" message instead of an open Apply button. |

### 🔴 Missing entirely — should be built to make this flow real
| New screen needed | Why |
|---|---|
| **Season-Lock-Confirm** | The hard confirmation moment: "Are you sure you've uploaded the complete story? This cannot be undone — only Revision Requests will be reviewed after this." Big, deliberate, un-skippable. This is the literal mechanic you invented in the conversation and it doesn't exist as its own screen yet — Completeness-Gate checks *readiness*, but nothing currently makes the creator explicitly commit. |
| **Revision-Request** | A distinct flow from "Needs-Changes → re-upload everything." Should let a creator flag *one specific episode or the trailer* for a fix, submit just that piece, and show that only the diff is under re-review — not the whole locked season. |
| **Creator-Trust-Tier badge/screen** | Somewhere in Studio-Home or the creator's profile, show their tier (e.g., "New Creator — Full Review" vs. "Trusted Creator — Fast Lane") so the incentive is visible, not invisible. |
| **Reviewer decision screen** (internal/Founder-side) | Would live in the excluded Section I, but worth knowing it's the other half of Needs-Changes/Live — a Reviewer needs their own screen to write the specific reason and pick a verdict. Only build this if you un-exclude Founder ops later. |

---

## 4. What I'd recommend building next, in order of importance

1. **Season-Lock-Confirm** — the single biggest gap. This is the exact mechanic that solves the "half-finished story earning money" problem you spent the most time worrying about.
2. **Revision-Request** — completes the "locked but not punishing honest mistakes" promise from the conversation.
3. **Creator-Apply-Intro (invite-gated variant)** — makes Stage 1 (founder-curated launch) actually visible in the product, instead of the current always-open apply form.
4. **Creator-Trust-Tier indicator** — small, but it's the thing that lets trusted creators feel the reward and new creators understand why they're reviewed more closely.
5. Copy edits to **Submit-For-Live** and **Live-Success** (no new screens, just tightening two lines) — cheap, high-impact, directly reflects your two strongest points from the conversation ("locked after submit" and "platform publishes, not you").

**Total done: 115 screens + all 4 flagged gaps now built = 119 screens.** Nothing from the strategy audit remains open.

### Gap-closing screens built:
- ✅ **Season-Lock-Confirm** — the explicit, hard commitment moment: checkbox, warning list, "Lock Season & Continue" vs. "Not yet"
- ✅ **Revision-Request** — pick exactly one episode or the trailer, explain the fix, upload the correction, with an explicit "only this piece gets re-reviewed" note
- ✅ **Creator-Apply-Intro-InviteOnly** — the Stage 1 curated variant: no open Apply button, waitlist form instead, explains *why* it's closed
- ✅ **Creator-Trust-Tier** — visible tier ladder (New → Rising → Trusted → Elite) with progress bar and exactly what Trusted unlocks (72h → under 24h review)

### Copy edits applied to existing screens:
- **Submit-For-Live** — added an explicit red-flagged "This locks your season" card right before the Submit button, spelling out no-edits + Revision-Request-only
- **Live-Success** — reworded from "You're live!" (creator-centric) to "WiamEpisio has published..." (platform-centric), matching your stated preference that the platform does the publishing, not the creator
