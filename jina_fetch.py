"""Web fetching utilities for Morning Digest: Jina Search + GitHub Trending API."""
import json, os, urllib.request, urllib.parse
from datetime import datetime, timedelta

JINA_API_KEY = os.environ.get("JINA_API_KEY", "")
SEARCH_URL   = "https://s.jina.ai/"
GITHUB_API   = "https://api.github.com/search/repositories"

# Domains blocked from all fetchers: paywalled / login-required / unreliable.
# Match is substring on lowercased URL so subdomains like cl44.cnnd.vn are covered.
BLOCKED_DOMAINS = ("cnnd.vn",)


def is_blocked_url(url: str) -> bool:
    u = (url or "").lower()
    return any(d in u for d in BLOCKED_DOMAINS)


# ── Jina Search ──────────────────────────────────────────────────────────────

def jina_search(query: str, max_results: int = 5) -> list[dict]:
    """Search via Jina Search API. Returns list of {title, url, description, content}."""
    if not JINA_API_KEY:
        print(f"  [jina] No API key, skipping: {query}")
        return []

    url = SEARCH_URL + urllib.parse.quote(query)
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {JINA_API_KEY}")
    req.add_header("Accept", "application/json")
    req.add_header("X-With-Generated-Alt", "false")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        raw = data.get("data", [])
        results = [r for r in raw if not is_blocked_url(r.get("url", ""))][:max_results]
        blocked = len(raw) - len([r for r in raw if not is_blocked_url(r.get("url", ""))])
        print(f"  [jina] '{query}' → {len(results)} results" + (f" ({blocked} blocked)" if blocked else ""))
        return [
            {
                "title": r.get("title", ""),
                "url": r.get("url", ""),
                "description": r.get("description", ""),
                "content": (r.get("content", "") or "")[:1500],
            }
            for r in results
        ]
    except Exception as e:
        print(f"  [jina] Error for '{query}': {e}")
        return []


def fetch_jina_topic(topic: dict, month_year: str) -> tuple[str, set[str]]:
    """Fetch Jina results for a topic. Returns (text_context, valid_urls_set)."""
    all_results = []
    for q in topic.get("search_queries", []):
        query = q.replace("{month_year}", month_year)
        all_results.extend(jina_search(query))

    if not all_results:
        return "", set()

    valid_urls = {r["url"] for r in all_results if r.get("url")}
    lines = []
    for i, r in enumerate(all_results, 1):
        lines.append(f"[{i}] {r['title']}")
        lines.append(f"    URL: {r['url']}")
        if r["description"]:
            lines.append(f"    {r['description']}")
        if r["content"]:
            snippet = r["content"][:500].replace("\n", " ")
            lines.append(f"    Content: {snippet}")
        lines.append("")
    return "\n".join(lines), valid_urls


# ── GitHub Trending API ──────────────────────────────────────────────────────

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN", "")
# Repos mentioning these get flagged + listed first so the LLM prioritizes them.
CLAUDE_KEYWORDS = ("claude", "anthropic", "mcp")


def github_search(query: str, max_results: int = 8) -> list[dict]:
    """Search GitHub repos via Search API. Unauthenticated works for low volume
    (10 req/min); GITHUB_TOKEN (auto-provided in Actions) raises it to 30 req/min."""
    params = urllib.parse.urlencode({
        "q":        query,
        "sort":     "stars",
        "order":    "desc",
        "per_page": max_results,
    })
    url = f"{GITHUB_API}?{params}"
    req = urllib.request.Request(url)
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("User-Agent", "morning-digest")
    if GITHUB_TOKEN:
        req.add_header("Authorization", f"Bearer {GITHUB_TOKEN}")

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
        raw = data.get("items", [])
        items = [it for it in raw if not is_blocked_url(it.get("html_url", ""))][:max_results]
        print(f"  [github] '{query}' → {len(items)} repos")
        return [
            {
                "name":    it.get("full_name", ""),
                "url":     it.get("html_url", ""),
                "desc":    it.get("description") or "",
                "stars":   format_stars(it.get("stargazers_count", 0)),
                "lang":    it.get("language") or "",
                "topics":  it.get("topics") or [],
                "created": (it.get("created_at") or "")[:10],
                "pushed":  (it.get("pushed_at") or "")[:10],
            }
            for it in items
        ]
    except Exception as e:
        print(f"  [github] Error for '{query}': {e}")
        return []


def format_stars(n: int) -> str:
    """Format star count: 1234 → '1.2K+', 12345 → '12.3K+'."""
    if n >= 1000:
        return f"{n/1000:.1f}K".rstrip("0").rstrip(".") + "+"
    return str(n)


def is_claude_related(repo: dict) -> bool:
    text = " ".join([repo.get("name", ""), repo.get("desc", ""), " ".join(repo.get("topics", []))]).lower()
    return any(k in text for k in CLAUDE_KEYWORDS)


def fetch_github_topic(topic: dict, cutoff_date: str, created_cutoff: str = "") -> tuple[str, set[str]]:
    """Fetch GitHub repos for a github_api topic. Returns (text_context, valid_urls_set).
    Query placeholders: {cutoff_date} (pushed window), {created_cutoff} (new-repo window).
    Claude-related repos are tagged [CLAUDE] and listed first."""
    seen = {}
    for q in topic.get("github_queries", []):
        query = q.replace("{cutoff_date}", cutoff_date).replace("{created_cutoff}", created_cutoff or cutoff_date)
        for repo in github_search(query, topic.get("github_per_query", 8)):
            if repo["url"] and repo["url"] not in seen:
                seen[repo["url"]] = repo

    if not seen:
        return "", set()

    repos = sorted(seen.values(), key=lambda r: not is_claude_related(r))  # stable: keeps star order
    valid_urls = set(seen.keys())
    lines = ["Dữ liệu GitHub (chỉ chọn repo từ list này, KHÔNG bịa thêm):"]
    for i, r in enumerate(repos, 1):
        flag = " [CLAUDE]" if is_claude_related(r) else ""
        lines.append(f"[{i}]{flag} {r['name']}  ⭐ {r['stars']}  ({r['lang']})  created {r['created']} · pushed {r['pushed']}")
        lines.append(f"    URL: {r['url']}")
        if r["desc"]:
            lines.append(f"    Desc: {r['desc'][:200]}")
        if r["topics"]:
            lines.append(f"    Topics: {', '.join(r['topics'][:8])}")
        lines.append("")
    return "\n".join(lines), valid_urls


# ── Dispatcher ────────────────────────────────────────────────────────────────

def fetch_topic_context(topic: dict, month_year: str) -> tuple[str, set[str], dict]:
    """Dispatch by topic.data_source + supplement with RSS feeds if configured.
    Returns (text_context, trusted_urls, image_map).
    - trusted_urls: set of REAL URLs sourced directly from RSS/Jina/GitHub (not
      LLM-generated). Caller aggregates these into a whitelist so the downstream
      HEAD-check can trust them outright, instead of re-verifying with a HEAD request
      that some sites (e.g. vnexpress.net) block from bot/datacenter IPs — which
      previously caused real items to be dropped as false-negative "dead URLs".
    - image_map: {article_url: thumbnail_url} harvested from RSS media tags, attached
      to items later by URL match (currently RSS-only; Jina results carry no image)."""
    source = topic.get("data_source", "jina")
    if source == "github_api":
        cutoff  = (datetime.now() - timedelta(days=topic.get("pushed_days", 14))).strftime("%Y-%m-%d")
        created = (datetime.now() - timedelta(days=topic.get("created_days", 60))).strftime("%Y-%m-%d")
        text, urls = fetch_github_topic(topic, cutoff, created)
    else:
        text, urls = fetch_jina_topic(topic, month_year)

    image_map: dict = {}

    # Supplement with RSS feeds (VN-specific sources)
    if topic.get("rss_feeds"):
        from rss_fetch import fetch_rss_topic
        rss_text, rss_urls, rss_images = fetch_rss_topic(topic)
        if rss_text:
            text = (text + "\n\n" + rss_text).strip() if text else rss_text
            urls |= rss_urls
        image_map.update(rss_images)

    return text, urls, image_map
