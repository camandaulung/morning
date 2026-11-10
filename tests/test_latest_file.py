"""latest.json — the small file the web paints from — must be rewritten by every
writer of cards.json and always hold the newest cards."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from latest_utils import LATEST_DAYS, latest_path, write_latest_file  # noqa: E402
from card_pipeline import write_cards_file  # noqa: E402


def _cards(n: int) -> list:
    return [{"date": f"2026-10-{30 - i:02d}", "tech": [{"title": f"Tin số {i}", "url": f"https://a.com/{i}"}]}
            for i in range(n)]


def test_keeps_only_the_newest_days(tmp_path):
    cards_path = str(tmp_path / "cards.json")
    cards = _cards(12)
    path = write_latest_file(cards, cards_path)
    assert path == latest_path(cards_path) == str(tmp_path / "latest.json")
    latest = json.loads(Path(path).read_text(encoding="utf-8"))
    assert latest == cards[:LATEST_DAYS]
    assert latest[0]["date"] == "2026-10-30"          # newest first, same order as cards.json


def test_short_history_is_written_whole(tmp_path):
    cards = _cards(3)
    path = write_latest_file(cards, str(tmp_path / "cards.json"))
    assert json.loads(Path(path).read_text(encoding="utf-8")) == cards


def test_minified_and_keeps_vietnamese_verbatim(tmp_path):
    path = write_latest_file(_cards(1), str(tmp_path / "cards.json"))
    text = Path(path).read_text(encoding="utf-8")
    assert "Tin số 0" in text
    assert "\n" not in text and ", " not in text and '": ' not in text


def test_write_cards_file_also_writes_latest(tmp_path):
    cards_path = tmp_path / "cards.json"
    cards = _cards(10)
    write_cards_file(cards, str(cards_path))
    assert json.loads(cards_path.read_text(encoding="utf-8")) == cards
    latest = json.loads((tmp_path / "latest.json").read_text(encoding="utf-8"))
    assert latest == cards[:LATEST_DAYS]
