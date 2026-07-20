"""Mobile-app endpoint readiness probe.

Hits every backend endpoint the WiamApp mobile client calls and classifies
the response. 401 on auth-protected routes counts as PASS (endpoint exists +
auth gate works). 404 / 5xx counts as FAIL.

Usage:
    python scripts/qa/readiness_probe.py
"""

from __future__ import annotations

import json
import sys
import time
from urllib import request, error
from urllib.parse import urljoin


BASE_API = "https://api.wiamapp.com/api/v1"
BASE_SITE = "https://wiamapp.com"
TIMEOUT = 12

# (method, path, auth_required, body)
PROBES: list[tuple[str, str, bool, dict | None]] = [
    # --- Auth ---
    ("POST", "/auth/login", False, {"email": "probe@example.com", "password": "x"}),
    ("POST", "/auth/register", False, {"email": "probe@example.com", "password": "xxxxxx", "first_name": "P", "last_name": "P"}),
    ("GET", "/auth/me", True, None),
    ("POST", "/auth/forgot-password", False, {"email": "probe@example.com"}),
    ("POST", "/auth/delete-account", True, {"password": "x"}),
    # --- Read flow ---
    ("GET", "/home", False, None),
    ("GET", "/books", False, None),
    ("GET", "/library", True, None),
    ("GET", "/genres", False, None),
    ("GET", "/search?q=x", False, None),
    ("GET", "/trending", False, None),
    ("GET", "/featured", False, None),
    ("GET", "/classics", False, None),
    ("GET", "/elite/leaderboard", False, None),
    # --- Money flow ---
    ("GET", "/coins/balance", True, None),
    ("GET", "/coins/packages", False, None),
    ("POST", "/coins/initialize", True, {"package_id": 1}),
    ("POST", "/coins/verify", True, {"reference": "x"}),
    ("POST", "/coins/unlock", True, {"content_id": 1, "chapter_number": 1}),
    ("GET", "/premium/status", True, None),
    ("GET", "/iap/packages", False, None),
    ("POST", "/iap/confirm", True, {"platform": "android", "purchase_token": "x", "product_id": "x"}),
    ("POST", "/iap/confirm-subscription", True, {"platform": "android", "purchase_token": "x", "product_id": "x"}),
    ("POST", "/security/integrity/nonce", False, {"platform": "android"}),
    ("POST", "/security/play-integrity/verify", True, {"token": "x"}),
    ("POST", "/ads/reward-unlock", True, {"content_id": 1, "chapter_number": 1}),
    ("POST", "/premium/start-trial", True, {}),
    ("POST", "/premium/credits/claim", True, None),
    ("GET", "/premium/credits/history", True, None),
    # --- Misc ---
    ("GET", "/settings", True, None),
    ("POST", "/bot/chat", True, {"message": "hi"}),
    ("GET", "/bot/status", True, None),
    ("GET", "/reader/stats", True, None),
    ("GET", "/wallet/status", True, None),
    ("GET", "/creator/dashboard", True, None),
    ("GET", "/referral/code", True, None),
]

PUBLIC_PROBES: list[tuple[str, str]] = [
    ("GET", "/health"),
    ("GET", "/api/v1/health/db"),
    ("GET", "/privacy"),
    ("GET", "/terms"),
    ("GET", "/api/push/vapid-key"),
    ("GET", "/.well-known/assetlinks.json"),
    ("GET", "/.well-known/apple-app-site-association"),
]


def probe(method: str, url: str, body: dict | None) -> tuple[int, float, str]:
    data = None
    headers = {"Accept": "application/json", "User-Agent": "WiamApp-readiness-probe/1.0"}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = request.Request(url, method=method, data=data, headers=headers)
    t0 = time.perf_counter()
    try:
        with request.urlopen(req, timeout=TIMEOUT) as resp:
            return resp.status, (time.perf_counter() - t0) * 1000, ""
    except error.HTTPError as e:
        snippet = ""
        try:
            snippet = e.read(200).decode("utf-8", "replace").replace("\n", " ")
        except Exception:
            pass
        return e.code, (time.perf_counter() - t0) * 1000, snippet
    except Exception as e:  # noqa: BLE001
        return 0, (time.perf_counter() - t0) * 1000, f"{type(e).__name__}: {e}"


def classify(status: int, auth_required: bool) -> str:
    if status == 0:
        return "FAIL"
    if auth_required:
        if status == 401:
            return "PASS"
        if status in (200, 400, 422):
            return "PASS"
        if status == 403:
            return "PASS"
        return "FAIL"
    if 200 <= status < 400:
        return "PASS"
    if status in (400, 401, 422):
        return "PASS"
    return "FAIL"


def run() -> int:
    rows: list[tuple[str, str, str, int, float, str]] = []
    print(f"\nProbing API at {BASE_API}\n" + "-" * 78)
    for method, path, auth_required, body in PROBES:
        url = BASE_API + path
        status, ms, snippet = probe(method, url, body)
        verdict = classify(status, auth_required)
        rows.append((verdict, method, path, status, ms, snippet))
        flag = "AUTH" if auth_required else "PUB "
        print(f"{verdict:4s} {flag} {method:5s} {path:40s} {status:3d}  {ms:6.0f}ms  {snippet[:60]}")

    print(f"\nProbing public/site at {BASE_SITE}\n" + "-" * 78)
    for method, path in PUBLIC_PROBES:
        url = BASE_SITE + path
        status, ms, snippet = probe(method, url, None)
        verdict = classify(status, False)
        rows.append((verdict, method, path, status, ms, snippet))
        print(f"{verdict:4s} PUB  {method:5s} {path:40s} {status:3d}  {ms:6.0f}ms  {snippet[:60]}")

    fails = [r for r in rows if r[0] == "FAIL"]
    print("\n" + "=" * 78)
    print(f"Summary: {len(rows) - len(fails)}/{len(rows)} OK, {len(fails)} FAIL")
    if fails:
        print("\nFailing endpoints:")
        for r in fails:
            print(f"  {r[1]:5s} {r[2]:40s} -> HTTP {r[3]}  {r[5][:80]}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(run())
