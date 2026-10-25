"""Shared LLM client for the digest pipeline: Gemini first, OpenAI fallback.

Gemini 2.5 flash is primary (cheap, supports Google Search grounding). When it
fails — notably 402/429 RESOURCE_EXHAUSTED (prepaid credits depleted, which
silently produced empty cards on 2026-10-23..25) — the same prompt goes to
OpenAI chat completions. Once Gemini reports quota exhaustion, later calls in
the same process skip it instead of burning retries.

Keys come from env only (GEMINI_API_KEY, OPENAI_API_KEY), never logged."""
import json
import os
import urllib.error
import urllib.request

from google import genai
from google.genai import types

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_MAX_OUTPUT = 16000  # gpt-4o-mini output cap is 16384
QUOTA_MARKERS = ("RESOURCE_EXHAUSTED", "402", "429", "quota", "credits are depleted")

_client = None          # lazy singleton — avoids requiring GEMINI_API_KEY at import time
_gemini_exhausted = False


def _gemini_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])
    return _client


def _is_quota_error(e: Exception) -> bool:
    msg = str(e)
    return any(m in msg for m in QUOTA_MARKERS)


def _call_gemini(prompt: str, use_search: bool, thinking_budget: int, max_output_tokens: int,
                 temperature: float, retries: int, model: str) -> tuple[str | None, set[str]]:
    global _gemini_exhausted
    client = _gemini_client()
    tools = [types.Tool(google_search=types.GoogleSearch())] if use_search else []
    for attempt in range(retries + 1):
        try:
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
            if _is_quota_error(e):
                _gemini_exhausted = True
                print("::warning::Gemini quota/credits exhausted — switching to OpenAI fallback")
                break
    return None, set()


def _call_openai(prompt: str, max_output_tokens: int, temperature: float) -> str | None:
    key = os.environ.get("OPENAI_API_KEY", "")
    if not key:
        print("  [openai] OPENAI_API_KEY not set — no fallback available")
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
        text = (data["choices"][0]["message"]["content"] or "").strip()
        print(f"  [openai] fallback got {len(text)} chars")
        return text or None
    except urllib.error.HTTPError as e:
        print(f"  [openai] HTTP {e.code}: {e.read()[:300]!r}")
    except Exception as e:
        print(f"  [openai] error: {e}")
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
