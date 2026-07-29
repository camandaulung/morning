#!/usr/bin/env python3
"""Push morning/evening digest to Telegram channel. Topic-agnostic — reads config.json for section labels."""
import json, os, sys, urllib.request, urllib.parse
from digest_utils import list_item_fields

BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
PAGE_URL  = "https://minhducdl87-code.github.io/morning"
MODE      = os.environ.get("RUN_MODE", "morning")   # "morning" or "evening"

if not BOT_TOKEN:
    print("TELEGRAM_BOT_TOKEN not set — skipping notification")
    sys.exit(0)

with open("cards.json", "r", encoding="utf-8") as f:
    cards = json.load(f)
if not cards:
    print("No cards found — skipping notification")
    sys.exit(0)

try:
    with open("config.json", "r", encoding="utf-8") as f:
        config = json.load(f)
except FileNotFoundError:
    config = {"topics": {}, "site": {}, "telegram": {}}

card       = cards[0]
site       = config.get("site", {})
site_title = site.get("title", "Morning Digest")
topics     = config.get("topics", {})

# Chat ID resolution: env var (comma-sep) > config.telegram.chat_ids > fallback
env_ids = [x.strip() for x in os.environ.get("TELEGRAM_CHAT_IDS", "").split(",") if x.strip()]
config_ids = config.get("telegram", {}).get("chat_ids", []) or []
CHAT_IDS = env_ids or config_ids or ["655323886"]


def section_meta(field: str) -> tuple[str, str]:
    """Return (emoji, section_label) for a field. Fallback: guess from field name."""
    for t in topics.values():
        if t.get("output_field") == field:
            return t.get("emoji", "•"), t.get("section_label", field.capitalize())
    return "•", field.capitalize()


def collect_items(card: dict) -> list[tuple[str, dict]]:
    """Return [(field, item), ...] for all non-repo items with URL, in topic/config order."""
    out = []
    for field in list_item_fields(card):
        for x in card.get(field, []):
            if isinstance(x, dict) and x.get("title") and x.get("url"):
                out.append((field, x))
    return out


def html_escape(s: str) -> str:
    return (s or "").replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")


def mark_evening_notified(cards: list, path: str = "cards.json") -> None:
    """Persist the evening send-once marker on cards[0], writing cards.json in the
    canonical format (matches card_pipeline.write_cards_file → no git-diff churn).
    The evening job's 'Commit and push' step then carries the flag to main so a
    duplicate evening run checks it out and short-circuits before re-sending."""
    cards[0]["eveningNotified"] = True
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)


def build_morning_message(card: dict) -> str:
    """Full morning digest — sections by topic."""
    lines = [f"{site_title} — <b>{card.get('dateLabel','')}</b> ({card.get('dayLabel','')})", ""]

    # Sections per topic (skip if empty)
    for field in list_item_fields(card):
        arr = card.get(field, [])
        if not arr:
            continue
        emoji, label = section_meta(field)
        lines.append(f"{emoji} <b>{html_escape(label)}:</b>")
        for x in arr:
            title = html_escape(x.get("title") or x.get("name",""))
            url = x.get("url","")
            if url:
                lines.append(f"• <a href=\"{url}\">{title}</a>")
            else:
                lines.append(f"• {title}")
        lines.append("")

    lines.append(f"🔗 {PAGE_URL}")
    return "\n".join(lines)


def collect_evening_items(card: dict) -> list[tuple[str, dict]]:
    """Return [(field, item), ...] for items added by the evening update only
    (addedEvening=true), in topic/config order."""
    out = []
    for field in list_item_fields(card):
        for x in card.get(field, []):
            if isinstance(x, dict) and x.get("addedEvening") and x.get("title") and x.get("url"):
                out.append((field, x))
    return out


def build_evening_message(card: dict) -> str | None:
    """22h evening update — only items added since this morning, grouped by topic.
    Returns None when there's nothing new (caller skips sending to avoid spam)."""
    evening_items = collect_evening_items(card)
    if not evening_items:
        return None

    by_field: dict[str, list] = {}
    for field, x in evening_items:
        by_field.setdefault(field, []).append(x)

    lines = [f"🌙 <b>Cập nhật tối</b> — tin mới từ sáng — <b>{card.get('dateLabel','')}</b>", ""]
    for field in list_item_fields(card):
        arr = by_field.get(field)
        if not arr:
            continue
        emoji, label = section_meta(field)
        lines.append(f"{emoji} <b>{html_escape(label)}:</b>")
        for x in arr:
            title = html_escape(x.get("title") or x.get("name",""))
            lines.append(f"• <a href=\"{x['url']}\">{title}</a>")
        lines.append("")
    lines.append(f"🔗 {PAGE_URL}")
    return "\n".join(lines)


if MODE == "evening":
    # Idempotency guard: the evening workflow can fire more than once per day
    # (GitHub Actions schedule cron + Cloudflare Worker backup cron, both at
    # 0 15 * * *; GitHub's cron lag makes them run ~1h apart). generate_card.py
    # already no-ops the 2nd run via eveningDone, but notify runs unconditionally
    # and would re-send the same addedEvening items. eveningNotified — set only
    # after a successful send below — makes the notification itself send-once.
    if card.get("eveningNotified"):
        print("Evening digest already sent for today — skipping (avoid duplicate)")
        sys.exit(0)
    message = build_evening_message(card)
    if message is None:
        print("No new evening items — skipping notification (avoid spam)")
        sys.exit(0)
else:
    if not collect_items(card):
        print("Morning card has no items — skipping notification (avoid empty digest)")
        sys.exit(0)
    message = build_morning_message(card)

url      = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
TG_LIMIT = 4000   # safety margin under Telegram's 4096-char hard cap per message


def split_message(text: str, limit: int = TG_LIMIT) -> list[str]:
    """Split into <=limit chunks at line boundaries so the full digest never
    exceeds Telegram's 4096 limit (a single oversized sendMessage would fail)."""
    if len(text) <= limit:
        return [text]
    chunks, cur = [], ""
    for line in text.split("\n"):
        while len(line) > limit:            # single over-long line → hard split
            if cur:
                chunks.append(cur); cur = ""
            chunks.append(line[:limit]); line = line[limit:]
        if cur and len(cur) + len(line) + 1 > limit:
            chunks.append(cur); cur = line
        else:
            cur = f"{cur}\n{line}" if cur else line
    if cur:
        chunks.append(cur)
    return chunks


def send_chunk(chat_id: str, text: str) -> bool:
    payload = urllib.parse.urlencode({
        "chat_id":    chat_id,
        "text":       text,
        "parse_mode": "HTML",
        "disable_web_page_preview": "true",
    }).encode()
    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req, timeout=10) as resp:
        return bool(json.loads(resp.read()).get("ok"))


# Send to every chat_id — split long digests into multiple messages, partial failure OK
chunks = split_message(message)
ok_count = fail_count = 0
for chat_id in CHAT_IDS:
    try:
        if all(send_chunk(chat_id, c) for c in chunks):
            print(f"✓ Sent {MODE} to chat {chat_id} ({len(chunks)} msg)")
            ok_count += 1
        else:
            print(f"✗ chat {chat_id}: Telegram returned not-ok")
            fail_count += 1
    except Exception as e:
        print(f"✗ chat {chat_id}: {e}")
        fail_count += 1

print(f"Total: {ok_count} ok / {fail_count} fail / {len(CHAT_IDS)} recipients")

# Persist the send-once marker so a duplicate evening run skips notifying. Only
# after ≥1 successful send: if EVERY recipient failed we leave the flag unset so a
# later retry/backup run can still deliver. A persistently-failing recipient (e.g.
# blocked the bot) is intentionally accepted as "misses this digest" rather than
# re-sending to the healthy recipients every hour. NOTE: serialization holds only
# when run 1 pushes before run 2 checks out (the observed ~1h GitHub-cron lag);
# truly simultaneous triggers could still double-send — acceptable for this cadence.
if MODE == "evening" and ok_count > 0 and not card.get("eveningNotified"):
    mark_evening_notified(cards)
    print("Marked eveningNotified=true in cards.json")

if ok_count == 0 and fail_count:
    sys.exit(1)
