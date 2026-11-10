"""latest.json — the newest few daily cards, minified. The web paints from this
small file (~36 KB gzip) instead of waiting on the full 30-day cards.json
(~290 KB gzip), which it only needs for the older archive weeks.

Must be rewritten every time cards.json is, so the two never disagree: call
write_latest_file() from every writer of cards.json (card_pipeline,
notify-telegram, scrub_cards). Dependency-free on purpose so notify-telegram can
import it without pulling in the LLM client."""
import json
import os

LATEST_DAYS = 7
LATEST_NAME = "latest.json"


def latest_path(cards_path: str = "cards.json") -> str:
    """latest.json lives next to cards.json (same dir → tests can use tmp_path)."""
    return os.path.join(os.path.dirname(cards_path), LATEST_NAME)


def write_latest_file(cards: list, cards_path: str = "cards.json", days: int = LATEST_DAYS) -> str:
    """cards is newest-first (cards.json order). Returns the path written."""
    path = latest_path(cards_path)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cards[:days], f, ensure_ascii=False, separators=(",", ":"))
    return path
