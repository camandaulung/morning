"""Shared LLM client for the digest pipeline: Gemini first, OpenAI fallback.

Gemini 2.5 flash is primary (cheap, supports Google Search grounding). When it
fails — notably 402/429 RESOURCE_EXHAUSTED (prepaid credits depleted, which
silently produced empty cards on 2026-10-23..25) — the same prompt goes to
OpenAI chat completions. Once Gemini reports quota exhaustion, later calls in
the same process skip it instead of burning retries.

Keys come from env only (GEMINI_API_KEY, OPENAI_API_KEY), never logged."""
import json
import os
import re
import threading
import time
import urllib.error
import urllib.request

from google import genai
from google.genai import types

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MAX_OUTPUT = 16000  # gpt-4o-mini output cap is 16384
QUOTA_MARKERS = ("RESOURCE_EXHAUSTED", "402", "429", "quota", "credits are depleted")
# Free-tier keys hit per-minute limits routinely; those must back off and retry,
# not abandon Gemini for the whole run. Only these mean "no more Gemini today".
HARD_QUOTA_MARKERS = ("402", "credits are depleted", "prepayment", "PerDay", "per day", "billing")
# Requests/minute we allow ourselves (free tier Flash is ~10 RPM). 0 = no spacing.
GEMINI_RPM = float(os.environ.get("GEMINI_RPM", "8"))
MAX_BACKOFF_S = 65

_client = None          # lazy singleton — avoids requiring GEMINI_API_KEY at import time
_gemini_exhausted = False
_sleep = time.sleep     # patched in tests
_rate_lock = threading.Lock()
_next_slot = 0.0


def _gemini_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def _is_quota_error(e: Exception) -> bool:
    msg = str(e)
    return any(m in msg for m in QUOTA_MARKERS)


def _is_hard_quota(e: Exception) -> bool:
    msg = str(e)
    return any(m.lower() in msg.lower() for m in HARD_QUOTA_MARKERS)


def _retry_delay(e: Exception, attempt: int) -> float:
    """Gemini 429s carry RetryInfo ('retryDelay': '23s'); fall back to 15s, 30s, …"""
    m = re.search(r"retryDelay['\"]?\s*[:=]\s*['\"]?(\d+(?:\.\d+)?)s", str(e))
    delay = float(m.group(1)) + 1 if m else 15.0 * (attempt + 1)
    return min(delay, MAX_BACKOFF_S)


def _wait_for_slot() -> None:
    """Space Gemini calls to GEMINI_RPM across the per-topic worker threads."""
    global _next_slot
    if GEMINI_RPM <= 0:
        return
    with _rate_lock:
        now = time.monotonic()
        wait = max(0.0, _next_slot - now)
        _next_slot = max(now, _next_slot) + 60.0 / GEMINI_RPM
    if wait:
        _sleep(wait)


def _call_gemini(prompt: str, use_search: bool, thinking_budget: int, max_output_tokens: int,
                 temperature: float, retries: int, model: str) -> tuple[str | None, set[str]]:
    global _gemini_exhausted
    client = _gemini_client()
    tools = [types.Tool(google_search=types.GoogleSearch())] if use_search else []
    for attempt in range(retries + 1):
        try:
            _wait_for_slot()
            response = client.models.generate_content(
                model=model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=tools,
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                    thinking_config=types.ThinkingConfig(thinking_budget=thinking_budget),
                ),
            )
            text_parts, grounding_urls = [], set()
            if response.candidates:
                cand = response.candidates[0]
                for part in (cand.content.parts or []):
                    if getattr(part, "thought", False):
                        continue
                    if getattr(part, "text", None):
                        text_parts.append(part.text)
                gm = getattr(cand, "grounding_metadata", None)
                for chunk in (getattr(gm, "grounding_chunks", None) or []) if gm else []:
                    web = getattr(chunk, "web", None)
                    if web and getattr(web, "uri", None):
                        grounding_urls.add(web.uri)

            text = "\n".join(text_parts).strip()
            if text:
                print(f"  [gemini] attempt {attempt+1}: got {len(text)} chars, {len(grounding_urls)} citations")
                return text, grounding_urls
            finish = str(response.candidates[0].finish_reason) if response.candidates else "unknown"
            print(f"  [gemini] attempt {attempt+1}: empty. Finish: {finish}")
        except Exception as e:
            print(f"  [gemini] attempt {attempt+1} error: {e}")
            if _is_quota_error(e) and _is_hard_quota(e):
                _gemini_exhausted = True
                print("::warning::Gemini daily quota/credits exhausted — switching to OpenAI fallback")
                break
            if _is_quota_error(e) and attempt < retries:
                delay = _retry_delay(e, attempt)
                print(f"  [gemini] rate-limited — retrying in {delay:.0f}s")
                _sleep(delay)
            elif _is_quota_error(e):
                print("::warning::Gemini still rate-limited after retries — OpenAI fallback for this call")
    return None, set()


def _call_openai(prompt: str, max_output_tokens: int, temperature: float) -> str | None:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        print("::warning::OPENAI_API_KEY not set — no LLM fallback available")
        return None
    body = {
        "model": os.environ.get("OPENAI_FALLBACK_MODEL", "gpt-4o-mini"),
        "messages": [
            {"role": "system", "content": "Trả về đúng một object JSON hợp lệ theo yêu cầu, không markdown."},
            {"role": "user", "content": prompt},
        ],
        "temperature": temperature,
        "max_tokens": min(max_output_tokens, OPENAI_MAX_OUTPUT),
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        OPENAI_URL,
        data=json.dumps(body).encode(),
        headers={"content-type": "application/json", "authorization": f"Bearer {key}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=180) as resp:
            data = json.loads(resp.read())
        choice = data["choices"][0]
        text = (choice["message"]["content"] or "").strip()
        print(f"  [openai] fallback got {len(text)} chars (finish: {choice.get('finish_reason')})")
        if choice.get("finish_reason") == "length":
            print(f"::warning::OpenAI fallback output truncated at {body['max_tokens']} tokens")
        return text or None
    except urllib.error.HTTPError as e:
        print(f"::warning::OpenAI fallback HTTP {e.code}: {e.read()[:300]!r}")
    except Exception as e:
        print(f"::warning::OpenAI fallback error: {e}")
    return None


def call_llm(
    prompt: str,
    use_search: bool = False,
    thinking_budget: int = 2048,
    max_output_tokens: int = 32768,   # 8192 truncated the 7-topic JSON mid-way → parse fail → empty card
    temperature: float = 0.3,
    retries: int = 2,
    model: str = "gemini-2.5-flash",
) -> tuple[str | None, set[str]]:
    """Returns (text, grounding_urls). grounding_urls is only populated by Gemini
    with use_search=True; the OpenAI fallback never grounds (empty set)."""
    if not _gemini_exhausted and os.environ.get("GEMINI_API_KEY"):
        text, urls = _call_gemini(prompt, use_search, thinking_budget, max_output_tokens,
                                  temperature, retries, model)
        if text:
            return text, urls
    return _call_openai(prompt, max_output_tokens, temperature), set()
