# WiamEpisio — Pre-Publish Quality Pipeline
### Plan only — no code yet. Database schema, backend architecture, and API routes for a strict, free, automated review system.

---

## 1. The problem you just caught

My Revision-Request mockup used "audio issue reported by viewers" as an example of something fixed *after* an episode went live. You're right to reject that — if quality problems are still reaching viewers, the pre-publish gate failed, and "let the creator patch it later" quietly normalizes that failure instead of fixing it.

**The fix:** Revision Requests should only exist for things a quality pipeline *can't* catch — legal/rights corrections, factual mistakes, takedown requests. Never for sharpness, audio, lighting, or stability. Those must be caught **before** anything is live, every time, no exceptions. That's the system below.

---

## 2. The real toolkit — free, but genuinely high-level

Basic FFprobe checks (resolution, codec, duration) only catch broken files — they say nothing about whether a video actually *looks* or *sounds* good. To get real quality signal without paying for AI, we need to add the tools that professional streaming platforms actually use for this. All of these are free and open source; nothing here calls a paid API.

### The headline tool: VMAF
**Netflix built VMAF (Video Multimethod Assessment Fusion) themselves and open-sourced it** under the BSD+Patent license — genuinely free, no usage fees, no royalties, runs on your own server at any volume. It's the real tool, not a knockoff.

**Important nuance:** VMAF is a *full-reference* metric — it scores quality by comparing two videos against each other (original vs. a processed copy), not by judging a single raw video in isolation. So its exact job in our pipeline is: **after WiamEpisio transcodes a creator's upload for streaming delivery, VMAF verifies our own transcoding didn't degrade their footage** (source file vs. our compressed output). That's a real, direct, free use of it.

What VMAF *doesn't* do is judge a creator's raw uploaded footage on its own — there's no "original" to compare it to, since their file *is* the original. That job still belongs to the OpenCV layer below (blur, brightness, stability) — VMAF and OpenCV work side by side, not as substitutes for each other.

### Full layered toolkit

| Layer | What it catches | Tool | Cost |
|---|---|---|---|
| **Technical compliance** | Wrong resolution, aspect ratio, codec, duration, corrupted file | FFprobe | Free |
| **Transcode integrity** | Our own compression/delivery pipeline degrading a creator's footage | **VMAF** (Netflix, open source, BSD+Patent license) — compares creator's original vs. our transcoded output | Free (compute only) |
| **Raw footage sharpness** | Blurry, low-detail, out-of-focus footage in the creator's original upload | OpenCV — Laplacian variance (blur score) on sampled frames | Free |
| **Exposure & composition** | Too dark, too bright, blown-out highlights, flat/lifeless footage | OpenCV — brightness/contrast histogram analysis | Free |
| **Camera stability** | Excessive shake, unusable handheld footage | OpenCV — optical flow variance across sampled frames | Free |
| **Black/frozen frames** | Broken exports, dropped clips, accidental static screens | FFmpeg (`blackdetect`, `freezedetect`) | Free |
| **Audio loudness & delivery spec** | Too quiet, clipping, inconsistent volume between episodes | FFmpeg `ebur128` filter — same **EBU R128** loudness standard broadcasters and Netflix use for delivery specs | Free |
| **Audio clarity / dialogue presence** | Dead air, missing dialogue, music completely burying speech | WebRTC VAD (voice activity detection) — flags stretches with no detected speech where there should be | Free |
| **Scene-aware sampling** | Naive "check every 5th frame" misses most of the video; smart sampling checks quality *at every real cut*, not just arbitrary intervals | **PySceneDetect** — finds actual scene/shot boundaries, then VMAF/OpenCV checks run on frames from each scene | Free |
| **Duplicate / stolen content detection** | Re-uploads of already-rejected files, or content copied from another creator | Perceptual hashing (pHash) — fingerprints video, compares against your own catalog | Free |
| **Watermark detection** | TikTok/CapCut export watermarks used as "final" footage (a rule you already wrote into Specs-Guide) | OpenCV template/corner-region matching for known watermark shapes | Free |

This is a genuinely high-end pipeline — VMAF alone puts you on the same measurement standard Netflix, Amazon, and YouTube quality teams actually use. The rest fills in what VMAF doesn't cover (audio, stability, duplicates, watermarks).

---

## 3. The pipeline, stage by stage

**Important shift from v1:** every stage below uses **bands, not binary pass/fail**. A hard cutoff either lets bad content through right at the line, or rejects good content that's just slightly under an arbitrary number — that's the "too strict, blocks creators" failure mode you're worried about. Bands fix this: only the *bottom* band auto-rejects, only the *top* band auto-clears, and everything in between goes to a human. This is also exactly how Netflix's own QC teams use VMAF — as a routing signal, not a hard gate.

```
Episode (or Trailer — same pipeline, no shortcuts) uploaded
        ↓
STAGE 1 — Technical validation (seconds, blocks immediately on fail)
  → Correct container/codec (MP4, H.264/AAC)
  → Aspect ratio exactly 9:16
  → Resolution ≥ 720×1280 (1080×1920 preferred)
  → Duration within spec (episodes: 3:00–6:00 · trailers: 15–60s)
  → File not corrupted / fully readable
  → No known watermark detected in corner regions
  → FAIL → instantly rejected, specific reason shown, no queue time wasted
        ↓ (pass)
STAGE 2 — Scene-aware sampling
  → PySceneDetect finds actual cut points in the video
  → Frames pulled from every real scene, not arbitrary time intervals
  → This feeds accurate samples into Stages 3–4 instead of guessing
        ↓
STAGE 3 — Perceptual video quality (runs in background, ~2–5 min)
  → VMAF score computed across sampled frames → banded:
       80–100 = Excellent → auto-clear
       60–79  = Good → auto-clear
       40–59  = Borderline → human review
       0–39   = Poor → auto-reject, reason: "video quality below threshold"
  → SSIM as a cross-check to catch cases VMAF alone might miss
  → OpenCV: exposure/brightness histogram (catches too-dark/blown-out)
  → OpenCV: stability score via optical flow (catches unwatchable shake)
  → FFmpeg: black-frame / frozen-frame detection
        ↓
STAGE 4 — Audio analysis (runs in background, ~1–3 min)
  → EBU R128 integrated loudness — banded (too quiet / in-range / clipping)
  → WebRTC VAD — flags stretches with no detected dialogue where expected
  → Silence-gap detection (dead air = likely editing mistake)
        ↓
STAGE 5 — Content integrity
  → Perceptual hash (pHash) checked against your own catalog — catches
    re-uploads of already-rejected files or content copied between creators
        ↓
STAGE 6 — Aggregate verdict
  → All bands "Excellent/Good" or better, nothing borderline → auto-clear
  → Any band "Poor" → auto-reject, specific check + reason named
  → Any band "Borderline," nothing "Poor" → human review queue
    (this is the relief valve — humans only see genuine edge cases,
    not the bulk of uploads)
        ↓
STAGE 7 — Season-level check (only after every episode individually clears)
  → All planned episodes present and cleared
  → Trailer cleared its own pass through this exact same pipeline
  → Season-Lock-Confirm has been submitted by the creator
        ↓
STAGE 8 — Publish (system-triggered, never creator-triggered)
  → If everything auto-cleared → system publishes automatically
  → If anything was borderline → holds for human sign-off, then system publishes
```

### Why banding solves "high quality but not too strict"
- A creator whose footage scores 65 VMAF (Good band) publishes without ever waiting on a human — that's still meaningfully better than "any video passes," but it doesn't block a decent, honest upload over an arbitrary line.
- Only genuinely poor output (sub-40 VMAF, real clipping, real dead air) gets auto-rejected — and always with the specific reason, matching your "Changes Required, not just Rejected" rule.
- The borderline band is where your judgment still matters — this is the "I still need to see some of them" case, just narrowed from *everything* down to *only the genuinely unclear ones*.

### Why 24 hours specifically
The automated checks themselves only take minutes per episode. The 24-hour window exists as:
1. **Queue buffer** — many episodes across many creators processing on shared server capacity, not instant for everyone
2. **Human review SLA** — borderline cases need a real person to look, and 24h is a realistic promise you can keep without staffing up
3. **A consistent, honest promise to creators** — "up to 24 hours" is a commitment you control, rather than "whenever we get to it"

Trusted creators (per the Trust Tier system) can have shorter SLAs later because their auto-clear rate is higher, not because their episodes get less scrutiny.

---

## 4. Database schema (plan — table shapes, not final SQL)

```
creators
  id, user_id, display_name, trust_tier, created_at

series
  id, creator_id, title, planned_episode_count, status
     status: draft | building | locked | in_review | live | needs_changes
  locked_at, locked_by, submitted_at, published_at

episodes
  id, series_id, episode_number, title, file_url, duration_seconds,
  status: uploaded | processing | ready | rejected | live
  uploaded_at

review_jobs
  id, episode_id, stage: technical | scene_sampling | visual | audio | integrity
  status: queued | running | passed | failed | borderline
  started_at, completed_at

review_checks
  id, review_job_id, check_type
    (resolution, aspect_ratio, duration, codec, watermark,
     vmaf_score, ssim_score, brightness, stability, black_frames,
     loudness, dialogue_presence, silence_gaps, duplicate_match)
  band: excellent | good | borderline | poor
  raw_value, threshold_excellent, threshold_borderline, notes

content_fingerprints
  id, episode_id, phash_value, created_at
     (used to compare new uploads against the whole catalog for
      duplicate/stolen content matches)

human_review_queue
  id, episode_id, reason, assigned_reviewer_id, status: pending | resolved
  decision: approved | changes_required, decision_reason, resolved_at

season_locks
  id, series_id, locked_by_creator_id, locked_at, episode_count_at_lock

revision_requests
  id, episode_id, requested_by, category: legal | rights | factual
     (deliberately NOT "quality" — quality issues can't reach this table)
  reason, replacement_file_url, status: pending | approved | rejected
  scoped_review_job_id (only the new file gets checked, not the whole season)

creator_trust_history
  id, creator_id, series_id, completed_at, had_revision_requests: bool,
  tier_after: new | rising | trusted | elite
```

---

## 5. Backend routes (plan — grouped by who can call them)

### Creator-facing (requires creator auth)
```
POST   /api/series                          create draft series
PATCH  /api/series/:id                       edit while status = draft/building
POST   /api/series/:id/episodes              upload an episode → enqueues review_job
GET    /api/series/:id/completeness          check gate status (all episodes ready?)
POST   /api/series/:id/lock                  season lock — irreversible, requires
                                              explicit confirm: true in body
POST   /api/series/:id/submit-for-review     only allowed if status = locked
GET    /api/episodes/:id/status              poll review progress
POST   /api/episodes/:id/revision-requests   only for LIVE episodes, category
                                              restricted to legal/rights/factual
```

### System/internal only (never exposed to creator or public API)
```
POST   /internal/review-jobs/:id/run         worker picks up and processes a job
POST   /internal/review-jobs/:id/results     worker writes check results back
POST   /internal/publish/:seriesId           the ONLY thing that flips a series
                                              live — no creator-facing equivalent
                                              exists, by design
```

### Human reviewer-facing (requires reviewer role)
```
GET    /reviewer/queue                       borderline cases awaiting a human
GET    /reviewer/episodes/:id                 full check breakdown for one episode
POST   /reviewer/episodes/:id/decision        approve | changes_required + reason
```

---

## 6. Open questions before I build the actual database + backend code

1. **Storage:** where are video files actually stored — S3-compatible (Cloudflare R2, Backblaze B2 — both cheap), or do you have a specific host in mind?
2. **Worker runtime:** should the analysis workers run on the same server as your API, or a separate worker process/server? (Video processing is CPU-heavy — usually best kept separate so it doesn't slow down the app for viewers.)
3. **Thresholds:** do you want to set the actual pass/fail numbers now (e.g. "reject if sharpness score below X"), or should I propose sensible defaults you can tune later once you see real creator uploads?
4. **What happens on FAIL:** does a failed episode block the whole season from being submitted, or can the creator just re-upload that one episode and keep building?
5. **Framework/language:** do you have a preference (Node.js/Express, Python/FastAPI, etc.) or should I recommend one based on what pairs best with FFmpeg/OpenCV?

Once you answer these (or tell me to just pick sensible defaults), I'll build the actual database schema (real SQL) and backend routes.
