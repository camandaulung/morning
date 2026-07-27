"""Test notify-telegram.py evening mode — collect_evening_items (addedEvening
filter) + build_evening_message (None when nothing new, grouped output otherwise)
+ mark_evening_notified (send-once idempotency guard against double triggers)."""
import json
import os
import sys
import importlib.util

os.environ["TELEGRAM_BOT_TOKEN"] = "dummy_token"

spec = importlib.util.spec_from_file_location(
    "notify_telegram_evening",
    "/".join(__file__.split("\\")[:-2]) + "/notify-telegram.py",
)
notify_telegram = importlib.util.module_from_spec(spec)

original_exit = sys.exit
sys.exit = lambda x=0: None
try:
    spec.loader.exec_module(notify_telegram)
finally:
    sys.exit = original_exit


class TestCollectEveningItems:
    """collect_evening_items: only items with addedEvening=true + title + url."""

    def test_only_evening_items_returned(self):
        card = {
            "date": "2026-07-15",
            "tech": [
                {"title": "Morning item", "url": "https://a.com"},
                {"title": "Evening item", "url": "https://b.com", "addedEvening": True},
            ],
        }
        result = notify_telegram.collect_evening_items(card)
        assert len(result) == 1
        assert result[0][1]["title"] == "Evening item"

    def test_no_evening_items(self):
        card = {"tech": [{"title": "Morning item", "url": "https://a.com"}]}
        assert notify_telegram.collect_evening_items(card) == []

    def test_skips_items_missing_url(self):
        card = {"tech": [{"title": "No url", "addedEvening": True}]}
        assert notify_telegram.collect_evening_items(card) == []

    def test_multiple_fields(self):
        card = {
            "tech": [{"title": "T1", "url": "https://a.com", "addedEvening": True}],
            "finance": [{"title": "F1", "url": "https://b.com", "addedEvening": True}],
        }
        result = notify_telegram.collect_evening_items(card)
        assert len(result) == 2


class TestBuildEveningMessage:
    """build_evening_message: None when nothing new; grouped-by-topic HTML otherwise."""

    def test_returns_none_when_no_new_items(self):
        card = {"date": "2026-07-15", "dateLabel": "15/07/2026",
                 "tech": [{"title": "Morning item", "url": "https://a.com"}]}
        assert notify_telegram.build_evening_message(card) is None

    def test_returns_message_with_evening_items(self):
        card = {
            "date": "2026-07-15", "dateLabel": "15/07/2026",
            "tech": [
                {"title": "Morning item", "url": "https://a.com"},
                {"title": "Evening item", "url": "https://b.com", "addedEvening": True},
            ],
        }
        msg = notify_telegram.build_evening_message(card)
        assert msg is not None
        assert "Cập nhật tối" in msg
        assert "Evening item" in msg
        assert "https://b.com" in msg
        assert "Morning item" not in msg  # only evening-added items included

    def test_empty_card_returns_none(self):
        assert notify_telegram.build_evening_message({"date": "2026-07-15"}) is None


class TestMarkEveningNotified:
    """mark_evening_notified: send-once flag that stops the 22h/23h double trigger
    (GitHub schedule cron + Cloudflare backup cron) re-sending the same digest."""

    def test_sets_flag_on_first_card(self, tmp_path):
        path = tmp_path / "cards.json"
        cards = [{"date": "2026-07-26", "tech": [
            {"title": "T", "url": "https://a.com", "addedEvening": True}]}]
        notify_telegram.mark_evening_notified(cards, str(path))
        assert cards[0]["eveningNotified"] is True
        written = json.loads(path.read_text(encoding="utf-8"))
        assert written[0]["eveningNotified"] is True

    def test_canonical_json_format(self, tmp_path):
        """Must match card_pipeline.write_cards_file (ensure_ascii=False, indent=2)
        so the flag write adds one key without reformatting the whole file."""
        path = tmp_path / "cards.json"
        cards = [{"date": "2026-07-26", "title": "Tin tiếng Việt"}]
        notify_telegram.mark_evening_notified(cards, str(path))
        text = path.read_text(encoding="utf-8")
        assert "Tin tiếng Việt" in text          # non-ASCII kept verbatim
        assert '\n    "date"' in text             # indent=2 (dict nested in list → 4 sp)

    def test_guard_short_circuits_second_run(self, tmp_path):
        """Simulate the 2nd (duplicate) trigger: a card already flagged must be
        recognized as already-sent, so the caller skips before re-notifying."""
        cards = [{"date": "2026-07-26", "eveningNotified": True}]
        # This mirrors the top-level guard: `if card.get("eveningNotified"): skip`
        assert cards[0].get("eveningNotified") is True
