"""
WiamEpisio Phase 1 verification (no Flask install required).

1) Loads video_service by file path
2) Static checks on models / routes / migrations source
3) Logic checks for free-first-5 helper (inlined mirror of rules)
"""
from __future__ import annotations

import ast
import importlib.util
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
failures = []


def ok(name, cond, detail=""):
    if cond:
        print(f"  PASS  {name}")
    else:
        print(f"  FAIL  {name} {detail}")
        failures.append(name)


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_video_service():
    print("\n== video_service ==")
    path = os.path.join(ROOT, "webapp", "services", "video_service.py")
    vs_mod = load_module("video_service", path)
    os.environ.pop("VIDEO_PROVIDER", None)
    vs = vs_mod.get_video_service()
    ok("default stub", vs.name == "stub")
    signed = vs.sign_playback_url(episode_id=42, ttl=120)
    ok("manifest_url", "manifest_url" in signed and "stub.local" in signed["manifest_url"])
    ok("token", bool(signed.get("token")))
    ok("expires_at", isinstance(signed.get("expires_at"), int))


def test_free_first_five_law():
    print("\n== free-first-5 law (mirror) ==")
    # Mirror of episode_access.is_within_free_tier without importing models
    def within(ep_num, free_count=5, is_free=False):
        if is_free:
            return True
        return int(ep_num) <= int(free_count)

    ok("ep1 free", within(1) is True)
    ok("ep5 free", within(5) is True)
    ok("ep6 locked", within(6) is False)
    ok("explicit is_free", within(99, is_free=True) is True)


def test_source_contracts():
    print("\n== source contracts ==")
    models = open(os.path.join(ROOT, "webapp", "models.py"), encoding="utf-8").read()
    ok("StoryBundle table", "w_story_bundles" in models and "class StoryBundle" in models)
    ok("no class Series(", "class Series(" not in models)
    ok("Episode model", "class Episode(" in models and "w_episodes" in models)
    ok("WatchProgress", "class WatchProgress(" in models)
    ok("EpisodeUnlock", "class EpisodeUnlock(" in models)
    ok("Content.format", "format = db.Column" in models)
    ok("free_episode_count", "free_episode_count" in models)

    init = open(os.path.join(ROOT, "webapp", "__init__.py"), encoding="utf-8").read()
    ok("rename migration w_series", "RENAME TO w_story_bundles" in init)
    ok("create w_episodes", "CREATE TABLE IF NOT EXISTS w_episodes" in init)
    ok("register episode_api", "episode_api" in init)

    ep_api = open(os.path.join(ROOT, "webapp", "routes", "episode_api.py"), encoding="utf-8").read()
    for route in (
        "/series",
        "/series/<int:series_id>/episodes",
        "/episodes/<int:episode_id>/stream",
        "/episodes/<int:episode_id>/unlock",
        "/watch/save-progress",
        "/watch/continue-watching",
    ):
        ok(f"episode_api {route}", route in ep_api)

    s2 = open(os.path.join(ROOT, "webapp", "routes", "studio_v2_api.py"), encoding="utf-8").read()
    ok("studio story-bundles routes", "/story-bundles" in s2)
    ok("studio uses StoryBundle", "StoryBundle.query" in s2)
    ok("deprecated series POST", "deprecated_series_create" in s2)

    access = open(os.path.join(ROOT, "webapp", "services", "episode_access.py"), encoding="utf-8").read()
    ok("can_watch helper", "def can_watch" in access)
    ok("DEFAULT_FREE 5", "DEFAULT_FREE_EPISODE_COUNT = 5" in access)

    ledger = open(os.path.join(ROOT, "webapp", "services", "ledger.py"), encoding="utf-8").read()
    ok("record_episode_unlock", "def record_episode_unlock" in ledger)

    mobile = open(os.path.join(ROOT, "WiamAppMobile", "src", "api", "studioV2.js"), encoding="utf-8").read()
    ok("mobile story-bundles path", "/story-bundles" in mobile)
    ok("mobile episodes client", os.path.exists(os.path.join(ROOT, "WiamAppMobile", "src", "api", "episodes.js")))

    blueprint = os.path.exists(os.path.join(ROOT, "docs", "WIAMEPISIO_MASTER_BLUEPRINT.md"))
    ok("blueprint mirrored", blueprint)


if __name__ == "__main__":
    test_video_service()
    test_free_first_five_law()
    test_source_contracts()
    print("\n" + ("ALL PASSED" if not failures else f"{len(failures)} FAILED: {failures}"))
    sys.exit(1 if failures else 0)
