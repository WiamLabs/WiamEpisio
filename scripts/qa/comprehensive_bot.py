"""WiamApp Comprehensive QA Bot.

Logs in as the QA bot account (env: QA_TEST_LOGIN_EMAIL / QA_TEST_LOGIN_PASSWORD)
and exercises every user-facing feature surface we can safely test in production.

What "safely" means here:
  - Read-only probes never mutate state.
  - Mutation probes operate ONLY on the bot's own account and ALWAYS revert
    their change immediately, with the revert step itself being part of the
    pass/fail signal.
  - The bot never sends real money, never publishes real content, never posts
    real comments, and never interacts with other users' accounts.

All results are POSTed to the WiamApp QA watchdog endpoint, where each
target gets:
  - immediate alert email on first failure,
  - hourly reminder while still failing,
  - resolution email on recovery.

Required environment variables (skips silently if missing):
  QA_TEST_LOGIN_EMAIL      The bot account email.
  QA_TEST_LOGIN_PASSWORD   The bot account password.
  QA_REPORT_ENDPOINT       e.g. https://wiamapp.com/team/qa/automation/report
  QA_WEBHOOK_SECRET        The shared secret for the watchdog endpoint.
  BASE_URL                 e.g. https://wiamapp.com (default).
  RUN_URL                  CI run URL for traceability (optional).
  QA_CREATOR_CANARY_ID     Optional integer User.id of a creator the bot may follow
                           (must not be the QA account). If unset, the bot scans small
                           ids until GET /api/v1/creators/:id returns 200.
"""
from __future__ import annotations

import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package not installed. Install with: pip install requests")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

BASE_URL = (os.environ.get("BASE_URL") or "https://wiamapp.com").rstrip("/")
EMAIL = os.environ.get("QA_TEST_LOGIN_EMAIL", "")
PASSWORD = os.environ.get("QA_TEST_LOGIN_PASSWORD", "")
QA_REPORT_ENDPOINT = os.environ.get("QA_REPORT_ENDPOINT", "")
QA_WEBHOOK_SECRET = os.environ.get("QA_WEBHOOK_SECRET", "")
RUN_URL = os.environ.get("RUN_URL", "")
QA_CREATOR_CANARY_ID_RAW = os.environ.get("QA_CREATOR_CANARY_ID", "").strip()

# Derive the watchdog endpoint from the report endpoint with a safe rewrite.
WATCHDOG_ENDPOINT = (
    QA_REPORT_ENDPOINT.replace("/automation/report", "/watchdog/probe")
    if QA_REPORT_ENDPOINT
    else f"{BASE_URL}/team/qa/watchdog/probe"
)


# ---------------------------------------------------------------------------
# HTTP helper
# ---------------------------------------------------------------------------

def http(
    method: str,
    path: str,
    headers: Optional[Dict[str, str]] = None,
    body: Optional[Dict[str, Any]] = None,
    timeout: float = 20.0,
) -> Tuple[int, int, Optional[Any], Optional[str]]:
    """Returns (status_code, latency_ms, parsed_body_or_None, error_str_or_None).

    Never raises; failures become (0, latency, None, error_str).
    """
    url = path if path.startswith("http") else f"{BASE_URL}{path}"
    started = time.time()
    try:
        resp = requests.request(method, url, headers=headers, json=body, timeout=timeout)
        latency_ms = int((time.time() - started) * 1000)
        try:
            parsed = resp.json()
        except Exception:
            parsed = None
        return resp.status_code, latency_ms, parsed, None
    except requests.exceptions.Timeout:
        return 0, int((time.time() - started) * 1000), None, "timeout"
    except Exception as e:  # network / DNS / SSL
        return 0, int((time.time() - started) * 1000), None, f"{type(e).__name__}:{e}"


# ---------------------------------------------------------------------------
# Probe model
# ---------------------------------------------------------------------------

def make_probe(
    label: str,
    ok: bool,
    status_code: int,
    latency_ms: int,
    detail: str = "",
    max_latency_ms: int = 8000,
    url: str = "",
) -> Dict[str, Any]:
    return {
        "target": label,
        "url": url,
        "ok": bool(ok),
        "status_code": int(status_code or 0),
        "latency_ms": int(latency_ms or 0),
        "max_latency_ms": int(max_latency_ms),
        "detail": detail or "",
    }


def status_in_range(status: int, lo: int = 200, hi: int = 299) -> bool:
    return lo <= status <= hi


def resolve_canary_creator_id(headers: Dict[str, str]) -> Tuple[Optional[int], str, str]:
    """Pick a creator User.id the QA bot can follow.

    Returns (creator_id, outcome, message) where outcome is:
      - "ok": creator_id is set; follow POST may proceed
      - "skip": no creator found in sweep — probe marked pass with skip detail
      - "fail": auth/me failed — probe should fail
    """
    code, _, body, err = http("GET", "/api/v1/auth/me", headers=headers)
    if err or not status_in_range(code):
        return None, "fail", f"auth/me failed: {err or code}"
    my_id = (body or {}).get("id")
    if my_id is None:
        return None, "fail", "auth/me missing id"

    candidates: List[int] = []
    if QA_CREATOR_CANARY_ID_RAW.isdigit():
        cid_env = int(QA_CREATOR_CANARY_ID_RAW)
        if cid_env != my_id:
            candidates.append(cid_env)
    for i in range(1, 31):
        if i != my_id and i not in candidates:
            candidates.append(i)

    for cid in candidates:
        ccode, _, cbody, cerr = http("GET", f"/api/v1/creators/{cid}", headers=headers)
        if cerr or ccode != 200 or not isinstance(cbody, dict):
            continue
        if cbody.get("error"):
            continue
        if "books" in cbody or "book_count" in cbody:
            return cid, "ok", ""

    return None, "skip", (
        f"no suitable creator (QA user id={my_id}); "
        f"set QA_CREATOR_CANARY_ID to a real creator's users.id"
    )


# ---------------------------------------------------------------------------
# Test scenarios
# ---------------------------------------------------------------------------

# Read-only probes:
#   (label, method, path, max_latency_ms, expected_status_lo, expected_status_hi,
#    required_fields_or_None)
#
# `required_fields` is an optional list of top-level JSON keys the response
# must contain on a 2xx pass. This catches "endpoint returns 200 but body
# is empty / malformed / a field was renamed" -- a common silent regression
# that pure status-code checks miss. Pass `None` to skip shape validation.
#
# Some endpoints legitimately return 403/404 for a non-creator/non-premium
# bot user; those use a wider expected range and skip shape validation.
READ_ONLY_PROBES: List[Tuple[str, str, str, int, int, int, Optional[List[str]]]] = [
    # --- Identity & home (with shape validation) ---
    ("bot::auth/me",                   "GET", "/api/v1/auth/me",                    3000, 200, 299, ["id", "email"]),
    # Push 5: home now returns spotlight/pulse/stream pools — shape-validate
    # the new keys so a regression that drops them gets caught immediately.
    ("bot::home",                      "GET", "/api/v1/home",                       15000, 200, 299,
        ["spotlight", "pulse", "stream", "latest", "top_rated"]),

    # --- Library / reading ---
    ("bot::library",                   "GET", "/api/v1/library",                    5000, 200, 299, None),
    ("bot::reading-lists",             "GET", "/api/v1/reading-lists",              4000, 200, 299, None),
    ("bot::reader/stats",              "GET", "/api/v1/reader/stats",               4000, 200, 299, None),
    ("bot::reader/badges",             "GET", "/api/v1/reader/badges",              4000, 200, 299, None),

    # --- ReaderScreen surface: book detail + chapter content + reviews ---
    # If book_id=1 doesn't exist (4xx), that's still a clear signal -- the
    # endpoint shape is up. We treat 4xx as recoverable (lo=200, hi=499) so
    # we only alert on real 5xx / timeouts / >budget latency.
    ("bot::books/1",                   "GET", "/api/v1/books/1",                    5000, 200, 499, None),
    ("bot::books/1/chapters/1",        "GET", "/api/v1/books/1/chapters/1",         6000, 200, 499, None),
    ("bot::books/1/reviews",           "GET", "/api/v1/books/1/reviews",            5000, 200, 499, None),

    # --- Reactions / comments (covers paragraph-comment + emoji reactions) ---
    ("bot::reader/reactions",          "GET", "/api/v1/reader/reactions?book_id=1&chapter_num=1", 5000, 200, 499, None),
    ("bot::reader/comments",           "GET", "/api/v1/reader/comments?book_id=1&chapter_num=1",  5000, 200, 499, None),
    ("bot::reader/comment-counts",     "GET", "/api/v1/reader/comment-counts?book_id=1",          4000, 200, 499, None),

    # --- Creator profile / tiers (covers follow + creator pages) ---
    ("bot::creators/1",                "GET", "/api/v1/creators/1",                 4000, 200, 499, None),
    ("bot::creator/1/tiers",           "GET", "/api/v1/creator/1/tiers",            4000, 200, 499, None),

    # --- Creator dashboard surface (likely 403 for non-creator bot;
    #     wide range = we just want to know the endpoint is reachable
    #     and didn't 5xx). ---
    ("bot::creator/dashboard",         "GET", "/api/v1/creator/dashboard",          5000, 200, 499, None),
    ("bot::creator/stories",           "GET", "/api/v1/creator/stories",            5000, 200, 499, None),
    ("bot::creator/followers",         "GET", "/api/v1/creator/followers",          5000, 200, 499, None),
    ("bot::creator/earnings",          "GET", "/api/v1/creator/earnings",           5000, 200, 499, None),
    ("bot::creator/ad-earnings",       "GET", "/api/v1/creator/ad-earnings",        5000, 200, 499, None),

    # --- Recommendations variants ---
    ("bot::recommendations/similar/1", "GET", "/api/v1/recommendations/similar/1",  6000, 200, 499, None),
    ("bot::recommendations/genre",     "GET", "/api/v1/recommendations/genre/Romance", 6000, 200, 499, None),

    # --- Premium surface (likely 403 for non-premium bot but still reachable) ---
    ("bot::premium/credits/history",   "GET", "/api/v1/premium/credits/history",    4000, 200, 499, None),

    # --- Browse / search / discovery ---
    ("bot::genres",                    "GET", "/api/v1/genres",                     4000, 200, 299, None),
    ("bot::genres/preferences",        "GET", "/api/v1/genres/preferences",         4000, 200, 299, None),
    ("bot::featured",                  "GET", "/api/v1/featured",                   5000, 200, 299, None),
    ("bot::trending",                  "GET", "/api/v1/trending",                   5000, 200, 299, None),
    ("bot::recommendations",           "GET", "/api/v1/recommendations",            6000, 200, 299, None),
    ("bot::search?q=story",            "GET", "/api/v1/search?q=story",             5000, 200, 299, None),
    ("bot::books?limit=5",             "GET", "/api/v1/books?limit=5",              5000, 200, 299, None),
    ("bot::book-sections",             "GET", "/api/v1/book-sections",              4000, 200, 299, None),
    ("bot::classics",                  "GET", "/api/v1/classics",                   5000, 200, 299, None),

    # --- Wallet / coins / IAP (with shape validation on critical ones) ---
    ("bot::wallet/status",             "GET", "/api/v1/wallet/status",              4000, 200, 299, None),
    ("bot::coins/balance",             "GET", "/api/v1/coins/balance",              4000, 200, 299, ["balance"]),
    ("bot::coins/history",             "GET", "/api/v1/coins/history",              4000, 200, 299, None),
    ("bot::coins/packages",            "GET", "/api/v1/coins/packages",             4000, 200, 299, None),
    ("bot::iap/packages",              "GET", "/api/v1/iap/packages",               4000, 200, 299, None),

    # --- Notifications / programs / rewards ---
    ("bot::notifications",             "GET", "/api/v1/notifications",              4000, 200, 299, None),
    ("bot::programs",                  "GET", "/api/v1/programs",                   4000, 200, 299, None),
    ("bot::rewards/status",            "GET", "/api/v1/rewards/status",             4000, 200, 299, None),

    # --- Gifts ---
    ("bot::gifts/received",            "GET", "/api/v1/gifts/received",             4000, 200, 299, None),

    # --- Bulletin / community ---
    ("bot::bulletin/feed",             "GET", "/api/v1/bulletin/feed",              5000, 200, 299, None),

    # --- Premium ---
    ("bot::premium/status",            "GET", "/api/v1/premium/status",             4000, 200, 299, None),

    # --- Push 5: per-book creator analytics surface (likely 404 for the
    #     bot's library since book_id=1 may not be theirs; treat 4xx as
    #     reachable). Push 5 ships the endpoint, this probe just guards
    #     against the route disappearing. ---
    ("bot::creator/stories/1/analytics", "GET", "/api/v1/creator/stories/1/analytics",
                                                                                4000, 200, 499, None),

    # --- Push 10: Reader V2 — public reader surfaces. Most will return
    #     200 with empty payloads or 404; we just guard the routes ---
    ("bot::books/1/series-context",      "GET", "/api/v1/books/1/series-context",
                                                                                4000, 200, 499, None),
    ("bot::books/1/next-in-series",      "GET", "/api/v1/books/1/next-in-series",
                                                                                4000, 200, 499, None),
    ("bot::books/1/chapter/1/access",    "GET", "/api/v1/books/1/chapter/1/access",
                                                                                4000, 200, 499, None),
    ("bot::universe/1/public",           "GET", "/api/v1/universes/1/public",
                                                                                4000, 200, 499, None),
    ("bot::series/1/public",             "GET", "/api/v1/series/1/public",
                                                                                4000, 200, 499, None),
]


def login() -> Tuple[Optional[str], Dict[str, Any]]:
    """Login the bot. Returns (token_or_None, login_probe_dict)."""
    code, latency, body, err = http(
        "POST",
        "/api/v1/auth/login",
        headers={"Content-Type": "application/json"},
        body={"email": EMAIL, "password": PASSWORD},
    )
    token = (body or {}).get("token")
    ok = bool(token) and status_in_range(code, 200, 299)
    detail = err or (f"status={code} latency={latency}ms token_present={bool(token)}")
    return token, make_probe("bot::login", ok, code, latency, detail=detail, max_latency_ms=5000,
                              url=f"{BASE_URL}/api/v1/auth/login")


def run_read_only(headers: Dict[str, str]) -> List[Dict[str, Any]]:
    """Execute every entry in READ_ONLY_PROBES; return a list of probe dicts.

    For probes with `required_fields` set, the response body is also checked
    for those top-level keys on a 2xx response. Missing keys = fail, even
    if the status code looked fine. This catches silent regressions like an
    endpoint returning {} instead of the expected payload.
    """
    probes: List[Dict[str, Any]] = []
    for label, method, path, max_ms, lo, hi, required_fields in READ_ONLY_PROBES:
        code, latency, body, err = http(method, path, headers=headers)
        within_status = status_in_range(code, lo, hi)
        within_latency = latency <= max_ms

        # Shape validation only applies on 2xx responses (where we expect
        # a real payload). 4xx in a wide-range probe is fine and skips this.
        shape_ok = True
        missing: List[str] = []
        if required_fields and 200 <= code <= 299:
            if not isinstance(body, dict):
                shape_ok = False
                missing = ["<response not a JSON object>"]
            else:
                missing = [f for f in required_fields if f not in body]
                shape_ok = len(missing) == 0

        ok = (err is None) and within_status and within_latency and shape_ok

        if err:
            detail = f"error:{err}"
        elif not within_status:
            detail = f"status={code} (expected {lo}-{hi})"
        elif not within_latency:
            detail = f"slow: {latency}ms > budget {max_ms}ms (status={code})"
        elif not shape_ok:
            detail = f"shape: missing fields {missing} (status={code})"
        else:
            detail = f"ok in {latency}ms (status={code})"
        probes.append(make_probe(label, ok, code, latency, detail=detail,
                                 max_latency_ms=max_ms, url=f"{BASE_URL}{path}"))
    return probes


def run_mutation_display_name(headers: Dict[str, str]) -> Dict[str, Any]:
    """Set display name to a canary value, verify, and revert.

    Operates only on the bot's own account.
    Pass = set(2xx) AND verify(name matches) AND revert(2xx).
    """
    label = "bot::mutation::display_name(set+verify+revert)"
    started = time.time()

    code_me, _, body_me, err_me = http("GET", "/api/v1/auth/me", headers=headers)
    if err_me or not status_in_range(code_me):
        return make_probe(label, False, code_me, int((time.time() - started) * 1000),
                          detail=f"pre-read failed: {err_me or code_me}", max_latency_ms=10000)
    original = (body_me or {}).get("first_name") or "QA"
    canary = f"QA-{int(time.time()) % 1000000}"

    code_set, _, _, err_set = http("PUT", "/api/v1/auth/profile", headers=headers,
                                   body={"first_name": canary})
    code_verify, _, body_verify, err_verify = http("GET", "/api/v1/auth/me", headers=headers)
    verified = (body_verify or {}).get("first_name") == canary
    code_revert, _, _, err_revert = http("PUT", "/api/v1/auth/profile", headers=headers,
                                         body={"first_name": original})

    total_ms = int((time.time() - started) * 1000)
    ok = (
        status_in_range(code_set) and (err_set is None)
        and verified
        and status_in_range(code_revert) and (err_revert is None)
    )
    detail = (
        f"set={code_set}/{err_set or 'ok'} "
        f"verify={code_verify}/match={verified} "
        f"revert={code_revert}/{err_revert or 'ok'}"
    )
    return make_probe(label, ok, code_set or 0, total_ms, detail=detail,
                      max_latency_ms=10000, url=f"{BASE_URL}/api/v1/auth/profile")


def run_mutation_bio(headers: Dict[str, str]) -> Dict[str, Any]:
    """Update bio to a canary value, verify, revert. Bot-account-only.

    Companion to display_name -- exercises the same PUT /auth/profile
    endpoint with a different field, catching field-specific regressions.
    """
    label = "bot::mutation::bio(set+verify+revert)"
    started = time.time()

    code_me, _, body_me, err_me = http("GET", "/api/v1/auth/me", headers=headers)
    if err_me or not status_in_range(code_me):
        return make_probe(label, False, code_me, int((time.time() - started) * 1000),
                          detail=f"pre-read failed: {err_me or code_me}", max_latency_ms=10000)
    original = (body_me or {}).get("bio") or ""
    canary = f"QA bot canary {int(time.time())}"

    code_set, _, _, err_set = http("PUT", "/api/v1/auth/profile", headers=headers,
                                   body={"bio": canary})
    code_verify, _, body_verify, err_verify = http("GET", "/api/v1/auth/me", headers=headers)
    verified = (body_verify or {}).get("bio") == canary
    code_revert, _, _, err_revert = http("PUT", "/api/v1/auth/profile", headers=headers,
                                         body={"bio": original})

    total_ms = int((time.time() - started) * 1000)
    ok = (
        status_in_range(code_set) and (err_set is None)
        and verified
        and status_in_range(code_revert) and (err_revert is None)
    )
    detail = (
        f"set={code_set}/{err_set or 'ok'} "
        f"verify={code_verify}/match={verified} "
        f"revert={code_revert}/{err_revert or 'ok'}"
    )
    return make_probe(label, ok, code_set or 0, total_ms, detail=detail,
                      max_latency_ms=10000, url=f"{BASE_URL}/api/v1/auth/profile")


def run_mutation_creator_follow(headers: Dict[str, str]) -> Dict[str, Any]:
    """Toggle follow on a known canary creator twice -- net zero state change.

    Same pattern as favorite_toggle. Exercises the social-graph write path
    without permanently changing the bot's follow list.

    Picks a creator id != the logged-in QA user (avoids 400 Cannot follow yourself)
    and verifies the target is a real creator via GET /creators/:id (avoids 400
    You can only follow creators on users.id=1 when that row is not a creator).
    """
    label = "bot::mutation::creator_follow(toggle+toggle_back)"
    started = time.time()

    creator_id, outcome, resolve_msg = resolve_canary_creator_id(headers)
    if outcome == "fail":
        return make_probe(
            label,
            False,
            0,
            int((time.time() - started) * 1000),
            detail=resolve_msg,
            max_latency_ms=8000,
            url=f"{BASE_URL}/api/v1/auth/me",
        )
    if outcome == "skip":
        return make_probe(
            label,
            True,
            200,
            int((time.time() - started) * 1000),
            detail=f"skipped: {resolve_msg}",
            max_latency_ms=8000,
            url=f"{BASE_URL}/api/v1/creators/_/follow",
        )

    code1, _, body1, err1 = http(
        "POST", f"/api/v1/creators/{creator_id}/follow", headers=headers
    )
    if code1 == 404:
        return make_probe(label, True, code1, int((time.time() - started) * 1000),
                          detail=f"skipped: canary creator_id={creator_id} not found (404)",
                          max_latency_ms=8000,
                          url=f"{BASE_URL}/api/v1/creators/{creator_id}/follow")
    if err1 or not status_in_range(code1):
        return make_probe(label, False, code1, int((time.time() - started) * 1000),
                          detail=f"first toggle failed: {err1 or code1}",
                          max_latency_ms=8000,
                          url=f"{BASE_URL}/api/v1/creators/{creator_id}/follow")
    # Endpoint may return either `following` or `followed` flag depending on
    # implementation; accept either.
    state1 = bool(
        (body1 or {}).get("following")
        or (body1 or {}).get("followed")
        or (body1 or {}).get("is_following")
    )

    code2, _, body2, err2 = http(
        "POST", f"/api/v1/creators/{creator_id}/follow", headers=headers
    )
    state2 = bool(
        (body2 or {}).get("following")
        or (body2 or {}).get("followed")
        or (body2 or {}).get("is_following")
    )
    total_ms = int((time.time() - started) * 1000)

    flipped = state1 != state2
    ok = (
        status_in_range(code1) and (err1 is None)
        and status_in_range(code2) and (err2 is None)
        and flipped
    )
    detail = (
        f"creator_id={creator_id} "
        f"toggle1={code1}/state={state1} "
        f"toggle2={code2}/state={state2} "
        f"flipped={flipped}"
    )
    return make_probe(label, ok, code2 or code1, total_ms, detail=detail,
                      max_latency_ms=8000,
                      url=f"{BASE_URL}/api/v1/creators/{creator_id}/follow")


def run_mutation_favorite_toggle(headers: Dict[str, str]) -> Dict[str, Any]:
    """Toggle favorite on a known canary book twice -- net zero state change.

    Endpoint flips the row, so two calls leave the book in its original
    favorited/unfavorited state and exercise both the add and remove paths.
    Pass = both calls return 2xx and the `favorited` flag flips between them.
    Skipped (marked pass with note) if book_id=1 does not exist (404).
    """
    label = "bot::mutation::book_favorite(toggle+toggle_back)"
    book_id = 1
    started = time.time()

    code1, _, body1, err1 = http(
        "POST", f"/api/v1/books/{book_id}/favorite", headers=headers
    )
    if code1 == 404:
        return make_probe(label, True, code1, int((time.time() - started) * 1000),
                          detail=f"skipped: canary book_id={book_id} not found (404)",
                          max_latency_ms=8000, url=f"{BASE_URL}/api/v1/books/{book_id}/favorite")
    if err1 or not status_in_range(code1):
        return make_probe(label, False, code1, int((time.time() - started) * 1000),
                          detail=f"first toggle failed: {err1 or code1}",
                          max_latency_ms=8000, url=f"{BASE_URL}/api/v1/books/{book_id}/favorite")
    state1 = bool((body1 or {}).get("favorited"))

    code2, _, body2, err2 = http(
        "POST", f"/api/v1/books/{book_id}/favorite", headers=headers
    )
    state2 = bool((body2 or {}).get("favorited"))
    total_ms = int((time.time() - started) * 1000)

    flipped = state1 != state2
    ok = (
        status_in_range(code1) and (err1 is None)
        and status_in_range(code2) and (err2 is None)
        and flipped
    )
    detail = (
        f"toggle1={code1}/state={state1} "
        f"toggle2={code2}/state={state2} "
        f"flipped={flipped}"
    )
    return make_probe(label, ok, code2 or code1, total_ms, detail=detail,
                      max_latency_ms=8000, url=f"{BASE_URL}/api/v1/books/{book_id}/favorite")


def run_mutation_reading_list(headers: Dict[str, str]) -> Dict[str, Any]:
    """Create a temporary reading list, verify it appears, delete it.

    Pass = create(2xx) AND list(2xx) AND delete(2xx).
    If create returns >=400, we mark the probe as fail with the error.
    """
    label = "bot::mutation::reading_list(create+verify+delete)"
    started = time.time()
    canary_name = f"qa-bot-{int(time.time())}"

    code_create, _, body_create, err_create = http(
        "POST", "/api/v1/reading-lists", headers=headers,
        body={"name": canary_name, "description": "QA bot canary list (auto-deleted)"},
    )
    if err_create or not status_in_range(code_create):
        return make_probe(label, False, code_create, int((time.time() - started) * 1000),
                          detail=f"create failed: {err_create or code_create}",
                          max_latency_ms=10000, url=f"{BASE_URL}/api/v1/reading-lists")

    list_id = (body_create or {}).get("id") or ((body_create or {}).get("list") or {}).get("id")

    # Verify by listing
    code_list, _, body_list, err_list = http("GET", "/api/v1/reading-lists", headers=headers)
    found = False
    if isinstance(body_list, dict):
        items = body_list.get("lists") or body_list.get("items") or []
    elif isinstance(body_list, list):
        items = body_list
    else:
        items = []
    for it in items if isinstance(items, list) else []:
        if isinstance(it, dict) and (it.get("name") == canary_name or it.get("id") == list_id):
            found = True
            break

    # Delete
    code_delete = 0
    err_delete = None
    if list_id is not None:
        code_delete, _, _, err_delete = http(
            "DELETE", f"/api/v1/reading-lists/{list_id}", headers=headers
        )

    total_ms = int((time.time() - started) * 1000)
    ok = (
        status_in_range(code_create)
        and found
        and (list_id is not None)
        and status_in_range(code_delete)
        and (err_delete is None)
    )
    detail = (
        f"create={code_create} list_id={list_id} verified={found} "
        f"delete={code_delete}/{err_delete or 'ok'}"
    )
    return make_probe(label, ok, code_create or 0, total_ms, detail=detail,
                      max_latency_ms=10000, url=f"{BASE_URL}/api/v1/reading-lists")


# ---------------------------------------------------------------------------
# Extended coverage: payment, push, upload, load, resilience, screen flows
# ---------------------------------------------------------------------------

def run_payment_smoke(headers: Dict[str, str]) -> List[Dict[str, Any]]:
    """Smoke-test the payment/IAP pipeline without spending real money.

    Validates:
      - coin packages endpoint returns non-empty list with required fields
      - IAP packages endpoint returns store_product_ids
      - coin balance is a non-negative integer
      - purchase-initialize rejects a bogus package_id gracefully (no 5xx)
    """
    probes: List[Dict[str, Any]] = []

    # 1. coin packages structure
    label = "ext::payment::coin_packages_shape"
    code, latency, body, err = http("GET", "/api/v1/coins/packages", headers=headers)
    pkgs = (body or {}).get("packages") or []
    has_fields = all(
        isinstance(p, dict) and "coins" in p and "price_ghs" in p
        for p in pkgs[:5]
    ) if pkgs else False
    ok = err is None and status_in_range(code) and len(pkgs) > 0 and has_fields
    detail = f"packages={len(pkgs)} shape_ok={has_fields}" if not err else f"error:{err}"
    probes.append(make_probe(label, ok, code, latency, detail=detail, max_latency_ms=5000,
                             url=f"{BASE_URL}/api/v1/coins/packages"))

    # 2. IAP packages have store_product_id
    label = "ext::payment::iap_store_product_ids"
    code, latency, body, err = http("GET", "/api/v1/iap/packages", headers=headers)
    iap_pkgs = (body or {}).get("packages") or []
    has_store_ids = all(
        isinstance(p, dict) and p.get("store_product_id")
        for p in iap_pkgs[:5]
    ) if iap_pkgs else False
    ok = err is None and status_in_range(code)
    detail = f"iap_packages={len(iap_pkgs)} store_ids_present={has_store_ids}"
    if not has_store_ids and iap_pkgs:
        detail += " (WARNING: some packages missing store_product_id — IAP will fail)"
    probes.append(make_probe(label, ok, code, latency, detail=detail, max_latency_ms=5000,
                             url=f"{BASE_URL}/api/v1/iap/packages"))

    # 3. purchase-initialize rejects bogus package gracefully (expect 4xx, not 5xx)
    label = "ext::payment::initialize_rejects_bogus"
    code, latency, body, err = http(
        "POST", "/api/v1/coins/initialize", headers=headers,
        body={"package_id": 999999}
    )
    ok = err is None and (400 <= code <= 499)
    detail = f"status={code} (expected 4xx rejection)" if not err else f"error:{err}"
    probes.append(make_probe(label, ok, code, latency, detail=detail, max_latency_ms=5000,
                             url=f"{BASE_URL}/api/v1/coins/initialize"))

    return probes


def run_push_infra(headers: Dict[str, str]) -> List[Dict[str, Any]]:
    """Test push notification infrastructure without a real device.

    Validates:
      - notifications feed endpoint returns a list
      - push-token registration rejects an invalid token (not 5xx)
      - push-token DELETE rejects an invalid token (not 5xx)
    """
    probes: List[Dict[str, Any]] = []

    # 1. notifications feed shape
    label = "ext::push::notifications_feed_shape"
    code, latency, body, err = http("GET", "/api/v1/notifications", headers=headers)
    has_list = isinstance((body or {}).get("notifications"), list)
    ok = err is None and status_in_range(code) and has_list
    detail = f"status={code} has_list={has_list}" if not err else f"error:{err}"
    probes.append(make_probe(label, ok, code, latency, detail=detail, max_latency_ms=5000,
                             url=f"{BASE_URL}/api/v1/notifications"))

    # 2. push-token rejects invalid token format (expect 400, not 5xx)
    label = "ext::push::rejects_invalid_token"
    code, latency, body, err = http(
        "POST", "/api/v1/push-token", headers=headers,
        body={"token": "INVALID_NOT_EXPO_TOKEN"}
    )
    ok = err is None and (400 <= code <= 499)
    detail = f"status={code} (expected 400)" if not err else f"error:{err}"
    probes.append(make_probe(label, ok, code, latency, detail=detail, max_latency_ms=5000,
                             url=f"{BASE_URL}/api/v1/push-token"))

    # 3. push-token DELETE with fake token (expect 2xx or 4xx, not 5xx)
    label = "ext::push::delete_nonexistent_token"
    code, latency, body, err = http(
        "DELETE", "/api/v1/push-token", headers=headers,
        body={"token": "ExponentPushToken[fake_qa_test_token]"}
    )
    ok = err is None and (200 <= code <= 499)
    detail = f"status={code} (expected 2xx-4xx)" if not err else f"error:{err}"
    probes.append(make_probe(label, ok, code, latency, detail=detail, max_latency_ms=5000,
                             url=f"{BASE_URL}/api/v1/push-token"))

    return probes


def run_image_upload(headers: Dict[str, str]) -> List[Dict[str, Any]]:
    """Test upload pipeline WITHOUT leaving artifacts.

    Instead of actually uploading an image (which would change the bot's
    live avatar), we only verify the endpoint is reachable and rejects
    a deliberately invalid payload (empty image field) with 4xx, not 5xx.
    This confirms the upload route is wired, auth works, and validation
    runs — without mutating the bot's profile.
    """
    label = "ext::upload::avatar_rejects_empty"
    started = time.time()

    code, latency, body, err = http(
        "POST", "/api/v1/auth/avatar", headers=headers,
        body={"image": ""}
    )
    total_ms = int((time.time() - started) * 1000)

    ok = err is None and (400 <= code <= 499)
    if err:
        detail = f"error:{err}"
    elif 400 <= code <= 499:
        detail = f"correctly rejected empty image with {code}"
    elif 200 <= code <= 299:
        detail = f"WARNING: accepted empty image (status={code}) — validation gap"
        ok = False
    else:
        detail = f"CRASH: status={code} on empty image input"
    probes = [make_probe(label, ok, code, total_ms, detail=detail, max_latency_ms=5000,
                         url=f"{BASE_URL}/api/v1/auth/avatar")]

    # Also verify endpoint rejects a malformed base64 string (not 5xx)
    label2 = "ext::upload::avatar_rejects_bad_base64"
    code2, latency2, _, err2 = http(
        "POST", "/api/v1/auth/avatar", headers=headers,
        body={"image": "data:image/png;base64,NOT_VALID_BASE64!!!"}
    )
    ok2 = err2 is None and (400 <= code2 <= 499)
    if err2:
        detail2 = f"error:{err2}"
    elif 400 <= code2 <= 499:
        detail2 = f"correctly rejected bad base64 with {code2}"
    elif 200 <= code2 <= 299:
        detail2 = f"WARNING: accepted bad base64 (status={code2})"
        ok2 = False
    else:
        detail2 = f"CRASH: status={code2} on bad base64"
    probes.append(make_probe(label2, ok2, code2, latency2, detail=detail2, max_latency_ms=5000,
                             url=f"{BASE_URL}/api/v1/auth/avatar"))

    return probes


def _transient_http_error(err: Optional[str]) -> bool:
    """True if the error is likely GitHub Actions ↔ prod flake (not an app bug)."""
    if not err:
        return False
    e = err.lower()
    return (
        "timeout" in e
        or "connectionerror" in e
        or "connecttimeout" in e
        or "readtimeout" in e
        or "connection reset" in e
        or "broken pipe" in e
    )


def run_mini_load_test(headers: Dict[str, str]) -> List[Dict[str, Any]]:
    """Send 3 sequential requests to lightweight endpoints.

    Render free tier has a single worker and cannot handle concurrent requests.
    This tests rapid sequential requests instead - verifies the server stays
    stable under quick back-to-back calls.
    """
    label = "ext::load::3_sequential_light"
    endpoints = ["/api/v1/genres", "/api/v1/trending", "/api/v1/featured"]

    def run_batch() -> Tuple[bool, int, str, List[int], List[Optional[str]]]:
        started = time.time()
        results: List[Tuple[int, int, Optional[Any], Optional[str]]] = []
        for ep in endpoints:
            results.append(http("GET", ep, headers=headers, timeout=30.0))
        total_ms = int((time.time() - started) * 1000)
        codes = [r[0] for r in results]
        latencies = [r[1] for r in results]
        errors_list = [r[3] for r in results]
        errors = [e for e in errors_list if e]
        fives = [c for c in codes if 500 <= c <= 599]

        n = len(endpoints)
        ok = len(fives) == 0 and len(errors) == 0 and all(c > 0 for c in codes)
        detail = (
            f"{n} sequential reqs: codes={codes} "
            f"latencies={latencies}ms total={total_ms}ms "
            f"5xx={len(fives)} errors={errors}"
        )
        return ok, total_ms, detail, codes, errors_list

    ok, total_ms, detail, codes, errors_list = run_batch()

    # One retry dampens flaky CI egress to Render without hiding real 5xx.
    if not ok and any(_transient_http_error(e) for e in errors_list if e):
        time.sleep(2.5)
        ok2, total_ms2, detail2, codes2, _ = run_batch()
        total_ms += total_ms2
        if ok2:
            ok, detail = True, f"{detail} → retry_ok: {detail2}"
            codes = codes2
        else:
            detail = f"{detail} → retry_fail: {detail2}"

    # Watchdog treats status_code==0 as failure even when ok=true; send a real code on pass.
    if ok:
        rep_code = codes[-1] if codes else 200
    else:
        rep_code = next((c for c in codes if c > 0), 0)

    return [make_probe(label, ok, rep_code, total_ms, detail=detail, max_latency_ms=60000,
                       url=f"{BASE_URL}/api/v1/genres")]


def run_resilience(headers: Dict[str, str]) -> List[Dict[str, Any]]:
    """Send deliberately bad inputs; verify the server returns 4xx, not 5xx.

    Catches unhandled exceptions, missing input validation, and crash bugs.
    """
    probes: List[Dict[str, Any]] = []

    # SAFETY: Only test endpoints that are read-only OR guaranteed to reject.
    # Never POST to tip/unlock/purchase with values that could accidentally
    # succeed and move real coins or create real transactions.
    # NOTE: Removed home_bad_param - /home is legitimately slow on Render free tier
    BAD_INPUTS: List[Tuple[str, str, str, Optional[Dict[str, Any]]]] = [
        ("ext::resilience::login_empty_body",      "POST", "/api/v1/auth/login", {}),
        ("ext::resilience::login_wrong_types",      "POST", "/api/v1/auth/login", {"email": 12345, "password": True}),
        ("ext::resilience::profile_no_auth",        "PUT",  "/api/v1/auth/profile", None),
        ("ext::resilience::search_empty",           "GET",  "/api/v1/search?q=", None),
        ("ext::resilience::book_negative_id",       "GET",  "/api/v1/books/-1", None),
        ("ext::resilience::chapter_huge_num",       "GET",  "/api/v1/books/1/chapters/99999", None),
        ("ext::resilience::genres_bad_slug",        "GET",  "/api/v1/recommendations/genre/NONEXISTENT_XYZ", None),
        ("ext::resilience::creators_negative_id",   "GET",  "/api/v1/creators/-999", None),
    ]

    for label, method, path, body in BAD_INPUTS:
        # Skip auth header for the no-auth test
        hdrs = {} if "no_auth" in label else headers
        code, latency, resp_body, err = http(method, path, headers=hdrs, body=body)
        ok = err is None and code < 500
        detail = f"status={code}" if not err else f"error:{err}"
        if code >= 500:
            detail += f" CRASH: server returned {code} on bad input"
        probes.append(make_probe(label, ok, code, latency, detail=detail, max_latency_ms=8000,
                                 url=f"{BASE_URL}{path}"))

    return probes


def run_screen_flow(headers: Dict[str, str]) -> List[Dict[str, Any]]:
    """Simulate the exact API call sequence the mobile app makes for key screens.

    HomeScreen flow:  /home → pick first book → /books/{id} → /books/{id}/chapters/1
    This tests that the data flows end-to-end: home returns book IDs that
    actually resolve and have readable chapter content.
    """
    label_prefix = "ext::flow"
    probes: List[Dict[str, Any]] = []
    started = time.time()

    # Step 1: Fetch home feed
    code_home, lat_home, body_home, err_home = http("GET", "/api/v1/home", headers=headers, timeout=20.0)
    if err_home or not status_in_range(code_home):
        probes.append(make_probe(f"{label_prefix}::home_to_reader", False, code_home,
                                 int((time.time() - started) * 1000),
                                 detail=f"home failed: {err_home or code_home}",
                                 max_latency_ms=25000, url=f"{BASE_URL}/api/v1/home"))
        return probes

    # Step 2: Extract a book ID from the home feed
    book_id = None
    if isinstance(body_home, dict):
        for section_key in ("featured", "trending", "latest", "new_releases", "books"):
            section = body_home.get(section_key)
            if isinstance(section, list) and section:
                for item in section:
                    if isinstance(item, dict) and item.get("id"):
                        book_id = item["id"]
                        break
            if book_id:
                break

    if not book_id:
        probes.append(make_probe(f"{label_prefix}::home_to_reader", True, code_home,
                                 int((time.time() - started) * 1000),
                                 detail="skipped: no books in home feed",
                                 max_latency_ms=25000, url=f"{BASE_URL}/api/v1/home"))
        return probes

    # Step 3: Fetch book detail
    code_book, lat_book, body_book, err_book = http(
        "GET", f"/api/v1/books/{book_id}", headers=headers
    )

    # Step 4: Fetch first chapter
    code_ch, lat_ch, body_ch, err_ch = http(
        "GET", f"/api/v1/books/{book_id}/chapters/1", headers=headers
    )

    total_ms = int((time.time() - started) * 1000)
    book_ok = err_book is None and status_in_range(code_book)
    ch_ok = err_ch is None and (200 <= code_ch <= 499)  # 4xx if locked/missing is fine

    ok = book_ok and ch_ok
    detail = (
        f"home→book({book_id})={code_book}/{err_book or 'ok'} "
        f"→ch1={code_ch}/{err_ch or 'ok'} total={total_ms}ms"
    )
    probes.append(make_probe(f"{label_prefix}::home_to_reader", ok, code_book, total_ms,
                             detail=detail, max_latency_ms=25000,
                             url=f"{BASE_URL}/api/v1/books/{book_id}"))

    # Step 5: Creator profile flow — navigate to book's creator
    creator_id = None
    if isinstance(body_book, dict):
        creator_id = (body_book.get("creator") or {}).get("id") or body_book.get("creator_id")

    if creator_id:
        code_cr, lat_cr, _, err_cr = http("GET", f"/api/v1/creators/{creator_id}", headers=headers)
        cr_ok = err_cr is None and (200 <= code_cr <= 499)
        probes.append(make_probe(f"{label_prefix}::book_to_creator", cr_ok, code_cr, lat_cr,
                                 detail=f"creator({creator_id})={code_cr}/{err_cr or 'ok'}",
                                 max_latency_ms=5000,
                                 url=f"{BASE_URL}/api/v1/creators/{creator_id}"))

    return probes


# ---------------------------------------------------------------------------
# Home V2 invariants
#
# Three structural assertions on /api/v1/home that we want to keep green:
#
#   1. The endpoint returns a non-empty ``sections[]`` array (the new
#      Home V2 shape). Failure means the daily-rotation pipeline broke
#      and the home would fall back to legacy keys only.
#   2. No book ID appears in two sections within one response
#      (cross-section dedup invariant). Failure means the assembly-
#      priority dedup pass regressed - this was the original "one book in
#      five rails" bug.
#   3. For an authenticated user with reading history, the personalized
#      sections (``for_you`` and/or ``because_you_read``) survive the
#      eligibility check. Failure means the recommendation profile build
#      regressed (e.g., genre-counts or onboarding-genre seeding broke).
# ---------------------------------------------------------------------------

def run_home_v2_invariants(headers: Dict[str, str]) -> List[Dict[str, Any]]:
    label = "ext::home_v2"
    probes: List[Dict[str, Any]] = []

    code, lat, body, err = http("GET", "/api/v1/home", headers=headers, timeout=20.0)
    if err or not status_in_range(code) or not isinstance(body, dict):
        probes.append(make_probe(
            f"{label}::sections_present", False, code, lat,
            detail=f"home fetch failed: {err or code}",
            max_latency_ms=20000, url=f"{BASE_URL}/api/v1/home",
        ))
        return probes

    # 1. sections[] present and non-empty.
    sections = body.get("sections")
    sections_ok = isinstance(sections, list) and len(sections) >= 1
    probes.append(make_probe(
        f"{label}::sections_present", sections_ok, code, lat,
        detail=(f"sections={len(sections)}" if isinstance(sections, list)
                else "missing sections[] field"),
        max_latency_ms=20000, url=f"{BASE_URL}/api/v1/home",
    ))

    # 2. Cross-section dedup invariant.
    seen: Dict[int, str] = {}
    dupes: List[str] = []
    for sec in (sections or []):
        if not isinstance(sec, dict):
            continue
        skey = sec.get("key") or "?"
        # continue_reading is intentionally exempt - the user's library is
        # independent of the public feed and may share a book with other
        # rails (e.g. reading something that's also in Top Rated).
        if skey == "continue_reading":
            continue
        for b in (sec.get("books") or []):
            bid = b.get("id") if isinstance(b, dict) else None
            if not isinstance(bid, int):
                continue
            if bid in seen:
                dupes.append(f"book {bid}: {seen[bid]}+{skey}")
            else:
                seen[bid] = skey
    dedup_ok = not dupes
    probes.append(make_probe(
        f"{label}::cross_section_dedup", dedup_ok, code, lat,
        detail=("no duplicates" if dedup_ok
                else f"{len(dupes)} dupes: " + "; ".join(dupes[:3])),
        max_latency_ms=20000, url=f"{BASE_URL}/api/v1/home",
    ))

    # 3. Personalized sections survive for an authenticated user with reads.
    # The QA bot has a reading history baseline (it follows + reads books
    # as part of the always-revert mutation suite), so for_you OR
    # because_you_read should be eligible. This catches regressions in
    # _build_user_profile / UserGenrePreference seeding / for_you fallback.
    personal_keys = {
        sec.get("key") for sec in (sections or [])
        if isinstance(sec, dict)
    }
    has_personal = bool(
        {"for_you", "because_you_read",
         "popular_in_genre_1", "popular_in_genre_2", "popular_in_genre_3",
         "from_creators_you_follow"} & personal_keys
    )
    probes.append(make_probe(
        f"{label}::personalized_present", has_personal, code, lat,
        detail=(f"personal section visible (keys={sorted(personal_keys)})"
                if has_personal
                else "no personalized section in sections[] - "
                     "check _build_user_profile / for_you fallback"),
        max_latency_ms=20000, url=f"{BASE_URL}/api/v1/home",
    ))

    return probes


# ---------------------------------------------------------------------------
# Posting back to the watchdog
# ---------------------------------------------------------------------------

def post_to_watchdog(probes: List[Dict[str, Any]], suite: str = "bot-comprehensive") -> None:
    if not WATCHDOG_ENDPOINT or not QA_WEBHOOK_SECRET:
        print("Skipping watchdog post — endpoint or secret missing.")
        return
    payload = {
        "suite": suite,
        "run_url": RUN_URL,
        "environment": "github-actions",
        "platform": "wiamapp-bot",
        "probes": probes,
    }
    try:
        resp = requests.post(
            WATCHDOG_ENDPOINT,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "X-QA-Webhook-Secret": QA_WEBHOOK_SECRET,
            },
            timeout=30,
        )
        print(f"Watchdog response {resp.status_code}: {resp.text[:400]}")
    except Exception as e:
        print(f"Failed to post to watchdog: {e}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    if not EMAIL or not PASSWORD:
        print("Comprehensive bot skipped: QA_TEST_LOGIN_EMAIL / PASSWORD not set.")
        return 0
    if not QA_REPORT_ENDPOINT or not QA_WEBHOOK_SECRET:
        print("Comprehensive bot skipped: QA_REPORT_ENDPOINT / QA_WEBHOOK_SECRET not set.")
        return 0

    probes: List[Dict[str, Any]] = []

    token, login_probe = login()
    probes.append(login_probe)
    if not token:
        print("Login failed; cannot run authenticated scenarios. Posting login probe only.")
        post_to_watchdog(probes)
        return 0

    auth_headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    # Read-only feature probes.
    probes.extend(run_read_only(auth_headers))

    # Mutation+revert probes (always-revert pattern; bot's own data only).
    probes.append(run_mutation_display_name(auth_headers))
    probes.append(run_mutation_bio(auth_headers))
    probes.append(run_mutation_reading_list(auth_headers))
    probes.append(run_mutation_favorite_toggle(auth_headers))
    probes.append(run_mutation_creator_follow(auth_headers))

    # Extended coverage — payment, push, upload, load, resilience, screen flows.
    probes.extend(run_payment_smoke(auth_headers))
    probes.extend(run_push_infra(auth_headers))
    probes.extend(run_image_upload(auth_headers))
    probes.extend(run_mini_load_test(auth_headers))
    probes.extend(run_resilience(auth_headers))
    probes.extend(run_screen_flow(auth_headers))

    # Home V2 structural invariants — sections[] present, cross-section
    # dedup intact, personalized rails surface for authenticated users.
    probes.extend(run_home_v2_invariants(auth_headers))

    # Summary line
    failed = [p for p in probes if not p.get("ok")]
    print(f"Bot run complete: {len(probes) - len(failed)} pass, {len(failed)} fail "
          f"out of {len(probes)} total.")
    if failed:
        print("Failed probes:")
        for p in failed[:10]:
            print(f"  - {p['target']}: {p.get('detail', '')}")

    post_to_watchdog(probes)
    return 0


if __name__ == "__main__":
    sys.exit(main())
