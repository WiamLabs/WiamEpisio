"""
WiamApp — Multi-AI Service
===========================
Unified AI interface with 5 free providers and automatic failover.

Providers:
  - Groq     (Llama 3.1 8B)       → WiamBot chat  — 14,400/day, blazing fast
  - Gemini   (2.0 Flash-Lite)     → Curation, Apex Board, review — 1,500/day
  - Cerebras (Llama 3.1 8B)       → Backup for all — ~1M tokens/day
  - Mistral  (mistral-small)      → Content guard, moderation — 1B tokens/month
  - Cohere   (command-r7b)        → Deep backup — 1,000 req/month

Env vars: GROQ_API_KEY, GEMINI_API_KEY, CEREBRAS_API_KEY, MISTRAL_API_KEY, COHERE_API_KEY
Get free keys:
  console.groq.com, aistudio.google.com/apikey, cloud.cerebras.ai,
  console.mistral.ai, dashboard.cohere.com
"""
import os
import json
import logging
import threading
import hashlib
from datetime import datetime, timedelta
from collections import defaultdict

log = logging.getLogger(__name__)

# ── Thread-safe lazy-init clients ────────────────────────────────────────────

_clients = {}          # provider_name → client object
_init_lock = threading.Lock()


def _get_groq():
    """Lazy-init Groq client."""
    if 'groq' in _clients:
        return _clients['groq']
    with _init_lock:
        if 'groq' in _clients:
            return _clients['groq']
        api_key = os.environ.get('GROQ_API_KEY', '')
        if not api_key:
            log.warning("GROQ_API_KEY not set — Groq unavailable")
            _clients['groq'] = None
            return None
        try:
            from groq import Groq
            client = Groq(api_key=api_key)
            _clients['groq'] = client
            log.info("Groq AI client initialised")
            return client
        except Exception as e:
            log.error("Groq init failed: %s", e)
            _clients['groq'] = None
            return None


def _get_gemini():
    """Lazy-init Google Gemini client."""
    if 'gemini' in _clients:
        return _clients['gemini']
    with _init_lock:
        if 'gemini' in _clients:
            return _clients['gemini']
        api_key = os.environ.get('GEMINI_API_KEY', '')
        if not api_key:
            log.warning("GEMINI_API_KEY not set — Gemini unavailable")
            _clients['gemini'] = None
            return None
        try:
            import google.generativeai as genai
            genai.configure(api_key=api_key)
            _clients['gemini'] = genai
            log.info("Gemini AI client initialised")
            return genai
        except Exception as e:
            log.error("Gemini init failed: %s", e)
            _clients['gemini'] = None
            return None


def _get_cerebras():
    """Lazy-init Cerebras client."""
    if 'cerebras' in _clients:
        return _clients['cerebras']
    with _init_lock:
        if 'cerebras' in _clients:
            return _clients['cerebras']
        api_key = os.environ.get('CEREBRAS_API_KEY', '')
        if not api_key:
            log.warning("CEREBRAS_API_KEY not set — Cerebras unavailable")
            _clients['cerebras'] = None
            return None
        try:
            from cerebras.cloud.sdk import Cerebras
            client = Cerebras(api_key=api_key)
            _clients['cerebras'] = client
            log.info("Cerebras AI client initialised")
            return client
        except Exception as e:
            log.error("Cerebras init failed: %s", e)
            _clients['cerebras'] = None
            return None


def _get_mistral():
    """Lazy-init Mistral client (OpenAI-compatible)."""
    if 'mistral' in _clients:
        return _clients['mistral']
    with _init_lock:
        if 'mistral' in _clients:
            return _clients['mistral']
        api_key = os.environ.get('MISTRAL_API_KEY', '')
        if not api_key:
            log.warning("MISTRAL_API_KEY not set — Mistral unavailable")
            _clients['mistral'] = None
            return None
        try:
            from mistralai import Mistral
            client = Mistral(api_key=api_key)
            _clients['mistral'] = client
            log.info("Mistral AI client initialised")
            return client
        except Exception as e:
            log.error("Mistral init failed: %s", e)
            _clients['mistral'] = None
            return None


def _get_cohere():
    """Lazy-init Cohere client."""
    if 'cohere' in _clients:
        return _clients['cohere']
    with _init_lock:
        if 'cohere' in _clients:
            return _clients['cohere']
        api_key = os.environ.get('COHERE_API_KEY', '')
        if not api_key:
            log.warning("COHERE_API_KEY not set — Cohere unavailable")
            _clients['cohere'] = None
            return None
        try:
            import cohere
            client = cohere.ClientV2(api_key=api_key)
            _clients['cohere'] = client
            log.info("Cohere AI client initialised")
            return client
        except Exception as e:
            log.error("Cohere init failed: %s", e)
            _clients['cohere'] = None
            return None


# ── Per-provider daily counters ──────────────────────────────────────────────

_daily_counts = defaultdict(int)   # "provider:YYYY-MM-DD" → count
_daily_lock = threading.Lock()

# Daily usage limits (free tier safe limits)
# Users can ask up to 100 AI questions per day across Help Center + WiamStudio
DAILY_LIMITS = {
    'groq': 14_000,      # leave 400 buffer from 14,400
    'gemini': 1500,      # Free: 15 requests/minute, 1500/day
    'cerebras': 50_000,   # token-based but we count calls
    'mistral': 50,         # Free: ~1-2 requests/second, ~100k/day (conservative)
    'cohere': 30           # Free: 1000/month, ~33/day
}


def _check_daily_limit(provider):
    """Return True if the provider still has budget today."""
    key = f"{provider}:{datetime.utcnow().strftime('%Y-%m-%d')}"
    with _daily_lock:
        return _daily_counts[key] < DAILY_LIMITS.get(provider, 999_999)


def _increment_daily(provider):
    """Increment the daily counter for a provider."""
    key = f"{provider}:{datetime.utcnow().strftime('%Y-%m-%d')}"
    with _daily_lock:
        _daily_counts[key] += 1
        # Clean old keys (keep only today)
        today = datetime.utcnow().strftime('%Y-%m-%d')
        stale = [k for k in _daily_counts if not k.endswith(today)]
        for k in stale:
            del _daily_counts[k]


def get_daily_usage():
    """Return current daily usage for all providers (for monitoring)."""
    today = datetime.utcnow().strftime('%Y-%m-%d')
    with _daily_lock:
        return {
            p: _daily_counts.get(f"{p}:{today}", 0)
            for p in ('groq', 'gemini', 'cerebras', 'mistral', 'cohere')
        }


# ── Per-user daily rate limits ───────────────────────────────────────────────

_user_counts = defaultdict(int)    # "user_id:type:YYYY-MM-DD" → count
_user_lock = threading.Lock()

USER_LIMITS = {
    'chat': 999,          # High ceiling — API layer enforces per-user premium limits
    'creator_tool': 5,    # 5 AI assists per creator per day
}


def check_user_limit(user_id, limit_type='chat'):
    """Return True if user has budget remaining. False if exceeded."""
    key = f"{user_id}:{limit_type}:{datetime.utcnow().strftime('%Y-%m-%d')}"
    limit = USER_LIMITS.get(limit_type, 10)
    with _user_lock:
        return _user_counts[key] < limit


def get_user_usage(user_id, limit_type='chat'):
    """Return (used, max) for a user's daily limit."""
    key = f"{user_id}:{limit_type}:{datetime.utcnow().strftime('%Y-%m-%d')}"
    limit = USER_LIMITS.get(limit_type, 10)
    with _user_lock:
        return _user_counts[key], limit


def increment_user_limit(user_id, limit_type='chat'):
    """Increment user's daily counter."""
    key = f"{user_id}:{limit_type}:{datetime.utcnow().strftime('%Y-%m-%d')}"
    with _user_lock:
        _user_counts[key] += 1
        # Clean old keys
        today = datetime.utcnow().strftime('%Y-%m-%d')
        stale = [k for k in _user_counts if not k.endswith(today)]
        for k in stale:
            del _user_counts[k]


# ── Response cache (1-hour TTL) ──────────────────────────────────────────────

_cache = {}            # hash → (response, timestamp)
_cache_lock = threading.Lock()
CACHE_TTL = 3600       # 1 hour


def _cache_key(system_prompt, user_message):
    """Create a hash key from the prompt pair."""
    raw = f"{system_prompt[:200]}|{user_message}".lower().strip()
    return hashlib.md5(raw.encode()).hexdigest()


def _cache_get(key):
    """Get a cached response if it exists and is fresh."""
    with _cache_lock:
        entry = _cache.get(key)
        if entry:
            resp, ts = entry
            if (datetime.utcnow() - ts).total_seconds() < CACHE_TTL:
                return resp
            del _cache[key]
    return None


def _cache_set(key, response):
    """Store a response in the cache."""
    with _cache_lock:
        _cache[key] = (response, datetime.utcnow())
        # Evict old entries if cache grows large
        if len(_cache) > 500:
            cutoff = datetime.utcnow() - timedelta(seconds=CACHE_TTL)
            stale = [k for k, (_, ts) in _cache.items() if ts < cutoff]
            for k in stale:
                del _cache[k]


# ── Low-level provider calls ─────────────────────────────────────────────────

def _call_groq(system_prompt, user_message, max_tokens=1024, temperature=0.7,
               model='llama-3.1-8b-instant'):
    """Call Groq API. Returns str or None."""
    client = _get_groq()
    if not client or not _check_daily_limit('groq'):
        return None
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        _increment_daily('groq')
        if resp.choices and resp.choices[0].message.content:
            return resp.choices[0].message.content.strip()
        return None
    except Exception as e:
        log.error("Groq call failed: %s", e)
        return None


def _call_gemini(system_prompt, user_message, max_tokens=1024, temperature=0.7,
                 json_mode=False):
    """Call Gemini API. Returns str or None."""
    genai = _get_gemini()
    if not genai or not _check_daily_limit('gemini'):
        return None
    try:
        gen_config = {
            'max_output_tokens': max_tokens,
            'temperature': temperature,
        }
        if json_mode:
            gen_config['response_mime_type'] = 'application/json'

        model = genai.GenerativeModel(
            model_name='gemini-2.0-flash-lite',
            system_instruction=system_prompt,
            generation_config=gen_config,
        )
        response = model.generate_content(user_message)
        _increment_daily('gemini')
        if response and response.text:
            return response.text.strip()
        return None
    except Exception as e:
        err_str = str(e).lower()
        if 'quota' in err_str or 'resourceexhausted' in err_str or '429' in err_str:
            log.warning("Gemini quota exhausted — disabling for today: %s", e)
            # Max out daily counter so we stop trying Gemini today
            today = datetime.utcnow().strftime('%Y-%m-%d')
            with _daily_lock:
                _daily_counts[f'gemini:{today}'] = DAILY_LIMITS.get('gemini', 1500)
        else:
            log.error("Gemini call failed: %s", e)
        return None


def _call_cerebras(system_prompt, user_message, max_tokens=1024, temperature=0.7,
                   model='llama3.1-8b'):
    """Call Cerebras API. Returns str or None."""
    client = _get_cerebras()
    if not client or not _check_daily_limit('cerebras'):
        return None
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        _increment_daily('cerebras')
        if resp.choices and resp.choices[0].message.content:
            return resp.choices[0].message.content.strip()
        return None
    except Exception as e:
        log.error("Cerebras call failed: %s", e)
        return None


def _call_mistral(system_prompt, user_message, max_tokens=1024, temperature=0.7,
                  model='mistral-small-latest'):
    """Call Mistral API. Returns str or None."""
    client = _get_mistral()
    if not client or not _check_daily_limit('mistral'):
        return None
    try:
        resp = client.chat.complete(
            model=model,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        _increment_daily('mistral')
        if resp.choices and resp.choices[0].message.content:
            return resp.choices[0].message.content.strip()
        return None
    except Exception as e:
        log.error("Mistral call failed: %s", e)
        return None


def _call_cohere(system_prompt, user_message, max_tokens=1024, temperature=0.7,
                model='command-r7b-12-2024'):
    """Call Cohere API. Returns str or None."""
    client = _get_cohere()
    if not client or not _check_daily_limit('cohere'):
        return None
    try:
        resp = client.chat(
            model=model,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_message},
            ],
            max_tokens=max_tokens,
            temperature=temperature,
        )
        _increment_daily('cohere')
        if resp.message and resp.message.content:
            text_parts = [b.text for b in resp.message.content if hasattr(b, 'text')]
            if text_parts:
                return ' '.join(text_parts).strip()
        return None
    except Exception as e:
        log.error("Cohere call failed: %s", e)
        return None


# ── High-level unified API ───────────────────────────────────────────────────

def chat_completion(system_prompt, user_message, max_tokens=1024, temperature=0.7):
    """Chat completion for WiamBot. Round-robin: Gemini ↔ OpenAI, Mistral/Cohere dedicated to content guard.

    Returns: str (response text) or None on failure.
    """
    # Check cache first
    ck = _cache_key(system_prompt, user_message)
    cached = _cache_get(ck)
    if cached:
        return cached

    # Provider order:
    # - Groq is the preferred default for chat (fast + high free-tier limit)
    # - Gemini can be quota-limited; fall back when it fails
    # - Cerebras is a strong general backup
    # - Mistral/Cohere are additional backups
    providers = ['groq', 'gemini', 'cerebras', 'mistral', 'cohere']
    for provider in providers:
        if provider == 'groq':
            result = _call_groq(system_prompt, user_message, max_tokens, temperature)
        elif provider == 'gemini':
            result = _call_gemini(system_prompt, user_message, max_tokens, temperature)
        elif provider == 'cerebras':
            result = _call_cerebras(system_prompt, user_message, max_tokens, temperature)
        elif provider == 'mistral':
            result = _call_mistral(system_prompt, user_message, max_tokens, temperature)
        elif provider == 'cohere':
            result = _call_cohere(system_prompt, user_message, max_tokens, temperature)
        else:
            result = None

        if result:
            _cache_set(ck, result)
            return result

    log.warning("All providers failed or exceeded limits for chat_completion")
    return None


def gemini_completion(system_prompt, user_message, max_tokens=2048, temperature=0.5):
    """Gemini-first completion — ONLY for scheduled tasks (curation, Apex Board).
    These run ~4 times/day so Gemini's 1,500/day limit is safe.
    Falls back to Cerebras → Groq.

    Returns: str or None.
    """
    result = _call_gemini(system_prompt, user_message, max_tokens, temperature)
    if result:
        return result

    # Fallback to Cerebras
    result = _call_cerebras(system_prompt, user_message, max_tokens, temperature)
    if result:
        return result

    # Fallback to Groq
    result = _call_groq(system_prompt, user_message, max_tokens, temperature)
    if result:
        return result

    log.warning("Gemini + Cerebras + Groq all failed for gemini_completion")
    return None


def json_completion(system_prompt, user_message, max_tokens=4096, temperature=0.3):
    """Get a JSON response. Groq first (14k/day), then Cerebras, then Gemini.
    Gemini is preserved for scheduled tasks only.

    Returns: dict/list or None on failure.
    """
    json_prompt = system_prompt + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences, no extra text."

    def _try_parse(raw):
        if not raw:
            return None
        try:
            text = raw
            if text.startswith('```'):
                text = text.split('\n', 1)[1] if '\n' in text else text[3:]
                if text.endswith('```'):
                    text = text[:-3]
                text = text.strip()
            return json.loads(text)
        except json.JSONDecodeError:
            return None

    # 1) Groq — 14,000/day, fast, handles JSON well
    parsed = _try_parse(_call_groq(json_prompt, user_message, max_tokens, temperature))
    if parsed is not None:
        return parsed

    # 2) Cerebras — 50,000/day backup
    parsed = _try_parse(_call_cerebras(json_prompt, user_message, max_tokens, temperature))
    if parsed is not None:
        return parsed

    # 3) Gemini — last resort (preserve 1,500/day for scheduled tasks)
    raw = _call_gemini(json_prompt, user_message, max_tokens, temperature, json_mode=True)
    parsed = _try_parse(raw)
    if parsed is not None:
        return parsed

    # 4) Mistral — emergency fallback
    parsed = _try_parse(_call_mistral(json_prompt, user_message, max_tokens, temperature))
    if parsed is not None:
        return parsed

    log.warning("All providers failed for json_completion")
    return None


def creator_tool(system_prompt, user_message, max_tokens=1024, temperature=0.6):
    """Creator AI tools (synopsis, feedback, titles). Groq first (14k/day).
    Gemini preserved for scheduled tasks only.

    Returns: str or None.
    """
    # Groq first — massive headroom
    result = _call_groq(system_prompt, user_message, max_tokens, temperature)
    if result:
        return result
    # Cerebras backup
    result = _call_cerebras(system_prompt, user_message, max_tokens, temperature)
    if result:
        return result
    # Gemini last resort
    result = _call_gemini(system_prompt, user_message, max_tokens, temperature)
    if result:
        return result
    log.warning("All providers failed for creator_tool")
    return None


def apex_board(system_prompt, user_message, max_tokens=4096, temperature=0.4):
    """The Apex Board AI — deep analysis for submissions, scouting, curation.
    Always uses Gemini (needs intelligence). Falls back to Cerebras.

    Returns: str or None.
    """
    return gemini_completion(system_prompt, user_message, max_tokens, temperature)


def apex_board_json(system_prompt, user_message, max_tokens=4096, temperature=0.3):
    """The Apex Board AI — structured JSON output for curation decisions.

    Returns: dict/list or None.
    """
    return json_completion(system_prompt, user_message, max_tokens, temperature)


def content_guard(system_prompt, user_message, max_tokens=512, temperature=0.2):
    """Content moderation — Groq primary (14k/day headroom), Cerebras backup.
    Mistral/Cohere as last resort.

    Returns: str or None.
    """
    # Check cache first
    ck = _cache_key(system_prompt, user_message)
    cached = _cache_get(ck)
    if cached:
        return cached

    # Primary: Groq (14,000/day — massive headroom)
    result = _call_groq(system_prompt, user_message, max_tokens, temperature)
    if result:
        _cache_set(ck, result)
        return result

    # Secondary: Cerebras
    result = _call_cerebras(system_prompt, user_message, max_tokens, temperature)
    if result:
        _cache_set(ck, result)
        return result

    # Last resort: Mistral / Cohere
    for provider in ['mistral', 'cohere']:
        if _check_daily_limit(provider):
            if provider == 'mistral':
                result = _call_mistral(system_prompt, user_message, max_tokens, temperature)
            elif provider == 'cohere':
                result = _call_cohere(system_prompt, user_message, max_tokens, temperature)
            if result:
                _cache_set(ck, result)
                return result

    log.warning("All providers failed for content_guard")
    return None


def content_guard_json(system_prompt, user_message, max_tokens=512, temperature=0.2):
    """Content moderation returning JSON verdict.
    Groq primary (14k/day headroom), Cerebras backup, Mistral/Cohere last resort.

    Returns: dict or None.
    """
    json_prompt = system_prompt + "\n\nIMPORTANT: Respond ONLY with valid JSON. No markdown, no code fences."

    # Check cache first
    ck = _cache_key(json_prompt, user_message)
    cached = _cache_get(ck)
    if cached:
        return cached

    def _try_parse(raw):
        if not raw:
            return None
        try:
            text = raw
            if text.startswith('```'):
                text = text.split('\n', 1)[1] if '\n' in text else text[3:]
                if text.endswith('```'):
                    text = text[:-3]
                text = text.strip()
            return json.loads(text)
        except json.JSONDecodeError:
            return None

    # Primary: Groq (14,000/day — massive headroom)
    parsed = _try_parse(_call_groq(json_prompt, user_message, max_tokens, temperature))
    if parsed is not None:
        _cache_set(ck, parsed)
        return parsed

    # Secondary: Cerebras
    parsed = _try_parse(_call_cerebras(json_prompt, user_message, max_tokens, temperature))
    if parsed is not None:
        _cache_set(ck, parsed)
        return parsed

    # Last resort: Mistral / Cohere
    for provider in ['mistral', 'cohere']:
        if _check_daily_limit(provider):
            if provider == 'mistral':
                raw = _call_mistral(json_prompt, user_message, max_tokens, temperature)
            elif provider == 'cohere':
                raw = _call_cohere(json_prompt, user_message, max_tokens, temperature)
            parsed = _try_parse(raw)
            if parsed is not None:
                _cache_set(ck, parsed)
                return parsed

    log.warning("All providers failed for content_guard_json")
    return None


# ── Health check ─────────────────────────────────────────────────────────────

def is_available():
    """Check if any AI provider is configured."""
    return any([_get_groq(), _get_gemini(), _get_cerebras(),
                _get_mistral(), _get_cohere()])


def provider_status():
    """Return status of each provider (for monitoring/debugging)."""
    return {
        'groq': _get_groq() is not None,
        'gemini': _get_gemini() is not None,
        'cerebras': _get_cerebras() is not None,
        'mistral': _get_mistral() is not None,
        'cohere': _get_cohere() is not None,
        'daily_usage': get_daily_usage(),
    }
