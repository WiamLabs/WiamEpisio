"""QA Watchdog — turns synthetic-probe results from CI into a payload that the
existing QA dispatcher (``_send_bug_alerts_and_resolutions``) can act on.

By reusing the dispatcher we inherit:
- Per-target dedup with 1-hour reminder cadence while a probe is failing.
- Resolved emails when a probe recovers.
- The same daily heartbeat / system-online machinery for green periods.

Each probe target becomes its own bug_key
(``watchdog-production::GET /health`` etc.), so /health flapping does not
silence /home alerts.

Probe schema (sent by CI):

    {
        "target": "GET /health",          # human label; required
        "url":    "https://wiamapp.com/health",
        "ok":     true,                   # boolean from curl --fail or HTTP-2xx check
        "status_code":     200,
        "latency_ms":      145,
        "max_latency_ms":  5000            # optional threshold; default 5000
    }

Failure rules (v1, fixed thresholds — easy to audit and tune):
- ``ok`` is false                          → fail
- ``status_code`` >= 500                   → fail
- ``status_code`` == 0 with ``ok`` true    → pass if within latency budget (aggregate probes)
- ``status_code`` == 0 with ``ok`` false   → fail (transport / no HTTP response)
- ``latency_ms`` > ``max_latency_ms``      → fail (early warning of degradation)
- otherwise                                → pass
"""
from __future__ import annotations

from typing import Iterable, Tuple

DEFAULT_MAX_LATENCY_MS = 5000


def _classify(probe: dict) -> Tuple[str, str]:
    """Return (status, detail) where status is 'pass' or 'fail'."""
    try:
        status_code = int(probe.get('status_code') or 0)
    except (TypeError, ValueError):
        status_code = 0
    try:
        latency_ms = float(probe.get('latency_ms') or 0)
    except (TypeError, ValueError):
        latency_ms = 0.0
    try:
        max_latency_ms = float(probe.get('max_latency_ms') or DEFAULT_MAX_LATENCY_MS)
    except (TypeError, ValueError):
        max_latency_ms = float(DEFAULT_MAX_LATENCY_MS)
    ok = bool(probe.get('ok'))

    if not ok:
        return 'fail', f'request failed (ok=false, status_code={status_code})'
    if status_code >= 500:
        return 'fail', f'5xx response (status_code={status_code})'
    if status_code == 0:
        # Aggregate probes may send ok=true with no single HTTP status; latency still enforced below.
        if latency_ms > max_latency_ms:
            return 'fail', (
                f'slow response: {latency_ms:.0f}ms exceeds threshold '
                f'{max_latency_ms:.0f}ms (status_code={status_code})'
            )
        return 'pass', f'ok in {latency_ms:.0f}ms (aggregate probe; status omitted)'
    if latency_ms > max_latency_ms:
        return 'fail', (
            f'slow response: {latency_ms:.0f}ms exceeds threshold '
            f'{max_latency_ms:.0f}ms (status_code={status_code})'
        )
    return 'pass', f'ok in {latency_ms:.0f}ms (status_code={status_code})'


def build_payload(
    probes: Iterable[dict],
    suite_name: str = 'watchdog-production',
    run_url: str = '',
    environment: str = 'github-actions',
    platform: str = 'wiamapp-backend',
) -> dict:
    """Normalize probe results into the payload shape consumed by the existing
    QA dispatcher and heartbeat helper.

    Pure function — no Flask, no DB. Safe to unit-test in isolation.
    """
    suites: list[dict] = []
    fail_count = 0
    pass_count = 0

    for probe in probes or []:
        if not isinstance(probe, dict):
            continue
        target = (probe.get('target') or probe.get('url') or 'unknown')
        if isinstance(target, str):
            target = target.strip() or 'unknown'
        else:
            target = 'unknown'
        status, detail = _classify(probe)
        suites.append({'label': target, 'status': status, 'detail': detail})
        if status == 'fail':
            fail_count += 1
        else:
            pass_count += 1

    overall_status = 'fail' if fail_count > 0 else 'pass'
    total = fail_count + pass_count
    if total == 0:
        score = 0
        summary = 'Watchdog received no probes'
    elif fail_count == 0:
        score = 100
        summary = f'Watchdog: {pass_count}/{total} probes green'
    else:
        score = max(0, int(round(100 * pass_count / total)))
        summary = (
            f'Watchdog: {fail_count}/{total} probes failing — '
            f'see details per target below'
        )

    return {
        'suite': suite_name,
        'status': overall_status,
        'score': score,
        'environment': environment,
        'platform': platform,
        'run_url': run_url,
        'summary': summary,
        'metrics': {'suites': suites},
    }
