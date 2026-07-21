# WiamEpisio — Full Review Toolkit

**What the machines check · how the backend runs them · how long a season takes**

This is the implementation of `WIAMEPISIO_QUALITY_PIPELINE_PLAN.md`. Every layer below is wired in `webapp/services/season_quality_pipeline.py`. Founder toggles each layer ON/OFF at `/founder/episio-quality`.

---

## 1. What we tell them to review (by tool)

| Tool | Origin | What it reviews | Fail example shown to creator |
|---|---|---|---|
| **FFprobe** | FFmpeg | Container, codec, 9:16 aspect, ≥720×1280, duration (trailer 15–60s · episode 3–6 min) | “must be 9:16 vertical” |
| **Watermark detector** | OpenCV corners | Corner logos / export watermarks used as “final” | “possible platform watermark — re-export clean” |
| **PySceneDetect** | Open source | Finds real cuts so later checks sample *scenes*, not random frames | (sampling only — no direct reject) |
| **OpenCV visual** | Open source | Sharpness (Laplacian), exposure/brightness, contrast, camera shake (optical flow) | “footage too soft/blurry” / “shake too high” |
| **blackdetect / freezedetect** | FFmpeg | Black screens, frozen frames, broken exports | “black/frozen frames detected” |
| **VMAF (Netflix)** | Netflix open source (BSD+Patent) | **Transcode integrity**: creator original vs our delivery re-encode — did *we* crush their footage? Bands: 80+ excellent · 60–79 good · 40–59 borderline · &lt;40 poor | “VMAF 32 — video quality below threshold” |
| **SSIM** | OpenCV / correlation | Structural similarity cross-check beside VMAF | “SSIM weak after delivery encode” |
| **EBU R128 (ebur128)** | FFmpeg — same loudness family Netflix/broadcasters use | Integrated loudness + true peak (too quiet / clipping) | “audio loudness out of range (−30 LUFS)” |
| **WebRTC VAD** | Google WebRTC | Dialogue presence + long silence gaps | “little/no dialogue detected” |
| **pHash** | ImageHash | Fingerprint vs catalog — re-uploads / stolen content | “possible duplicate/stolen match” |

**Bands (Netflix-style routing):** with **founder-first** ON (default), Poor/Borderline / AI-safety attention go to `pending_founder` — creators still see “In review”. You get a founder notify. Creators only see Needs Changes after you press **Changes Required**, or after trust-tier SLA expires with no founder action.

**What the system MUST check (creator-facing):** aspect (9:16 **or** 16:9), duration, blur/exposure/shake, **watermark**, **VMAF**, **SSIM**, black/freeze, audio, **pHash stolen**, and **AI visual safety** (Gemini free — explicit genitals hard-fail; kissing/romance allowed). Founder checklist is the last eye — not a replacement for machine checks.

Cover + banner are presence-checked; trailer + **every** episode run the full video/audio stack.

---

## 2. How it works on the backend

```
Creator Submit for Live
        ↓
POST /creator/studio/series/:id/submit-review
        ↓
enqueue SeasonQualityJob (status=queued)
        ↓
run_season_qc_job()  [same process or founder "Run queue"]
        ↓
For cover, banner, trailer, EACH episode:
  Stage 1 technical (9:16 or 16:9) → watermark (fail if suspect)
  Stage 2 scene sample
  Stage 3 OpenCV + black/freeze + VMAF + SSIM + Gemini AI safety
  Stage 4 ebur128 + VAD
  Stage 5 pHash vs w_content_fingerprints
        ↓
Aggregate worst band across assets
        ↓
Poor/Borderline/AI attention + founder-first → pending_founder (notify founder)
Good/Excellent clean → under_review for light human publish
        ↓
Founder checklist (Romance OK · No explicit · Technical) then Publish OR Needs Changes
        ↓
SLA expiry (if founder absent): Good→auto-publish · else Needs Changes
        ↓
ONLY founder/system publish flips series live (creator cannot)
```

**Content policy:** Romance, kissing, hugging = allowed. Explicit genitals / open sex with private parts = machine + founder reject. Requires `GEMINI_API_KEY` for vision safety (same free AI stack as WiamApp).

**Tables:** `w_season_quality_jobs`, `w_season_asset_quality_reports` (per-asset checks JSON), `w_content_fingerprints`.

**If a tool binary/lib is missing** on the host, that layer is skipped gracefully and recorded as not installed on the founder toolkit table — other layers still run. Install packages from `requirements.txt` (opencv, scenedetect, webrtcvad, ImageHash) plus **ffmpeg/ffprobe with libvmaf** on the worker for full Netflix VMAF. Set **GEMINI_API_KEY** on Render for AI safety.

---

## 3. How many days / hours does a full season take?

| Phase | Time | Notes |
|---|---|---|
| **Machine QC** (trailer + all episodes) | **Minutes to a few hours**, not days | ~0.5–3 min/asset with full toolkit; 20 episodes + trailer ≈ **~1–3 hours** sequential on one worker |
| **Human / queue SLA** (creator-facing promise) | **Up to 24 hours** default | Plan: buffer for shared capacity + borderline human look |
| **Trust tier SLAs** | New **72h** · Rising **48h** · Trusted **24h** · Elite **12h** | Shorter because auto-clear rate is higher — **not** because scrutiny is lower |
| **SLA expiry auto-decide** | When the tier window ends and founder has not acted | **Good/Excellent → auto-publish** · **not good → Needs Changes (auto-reject for fix)** — toggle `ff_season_qc_sla_auto_decide` |

### Duration law (Specs Guide — enforced)
| Asset | Allowed length |
|---|---|
| **Episode** | **4–5 minutes only** (240–300 seconds) |
| **Trailer** | **15–60 seconds** (not 1–2 minutes) |

### Season length
Minimum **20** planned episodes; creators may plan **more than 20** (up to **200** per season). All planned episodes must be final before lock/live.

---

## 4. Founder controls

`/founder/episio-quality`

- Master pipeline ON/OFF  
- Each tool layer ON/OFF  
- Auto-reject Poor / Auto-clear Good  
- Live host install status for every tool  
- Job queue → open asset results → **Publish** or **Changes Required**

---

## 5. What humans still review

Humans only see **borderline** (and light final publish). They do **not** re-score sharpness by eye for every episode — the toolkit already did. Their job: edge cases, rights notes, and the final **platform publish** click.
