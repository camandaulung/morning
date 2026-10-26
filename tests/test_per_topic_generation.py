"""Per-topic generation: one LLM call per topic, failures stay isolated."""
from datetime import datetime
from unittest.mock import patch

import card_pipeline
from dedup_utils import get_recent_titles_by_field, get_all_urls
from time_utils import VN_TZ

TOPICS = {
    "tech_gadget": {"output_field": "tech"},
    "finance_market": {"output_field": "finance"},
    "gamedev_repos": {"output_field": "gamedev"},
}


def _fake_llm(responses):
    def call(prompt, **kwargs):
        for key, text in responses.items():
            if f"PROMPT:{key}" in prompt:
                return text, set()
        return None, set()
    return call


def test_each_topic_gets_its_own_call_and_bad_json_only_empties_its_topic():
    responses = {
        "tech_gadget": '{"tech":[{"title":"T","url":"https://t"}]}',
        "finance_market": '{"finance":[{"title":"F","url":"https://f"', # truncated JSON
        "gamedev_repos": '{"gamedev":[{"title":"G","url":"https://github.com/a/b"}]}',
    }
    with patch("card_pipeline.call_llm", side_effect=_fake_llm(responses)) as llm:
        card = card_pipeline.generate_card_per_topic(
            TOPICS, {k: "ctx" for k in TOPICS}, lambda key, topic: f"PROMPT:{key}",
            "2026-10-26", "Chủ Nhật", "26/10/2026")
    assert [x["title"] for x in card["tech"]] == ["T"]
    assert card["finance"] == []
    assert [x["title"] for x in card["gamedev"]] == ["G"]
    assert card["date"] == "2026-10-26"
    prompts = {c.args[0] for c in llm.call_args_list}
    assert {"PROMPT:tech_gadget", "PROMPT:finance_market", "PROMPT:gamedev_repos"} <= prompts


def test_crashing_topic_does_not_kill_card():
    def prompt_for(key, topic):
        if key == "finance_market":
            raise RuntimeError("boom")
        return f"PROMPT:{key}"
    responses = {"tech_gadget": '{"tech":[{"title":"T","url":"https://t"}]}'}
    with patch("card_pipeline.call_llm", side_effect=_fake_llm(responses)):
        card = card_pipeline.generate_card_per_topic(TOPICS, {}, prompt_for, "2026-10-26", "", "")
    assert len(card["tech"]) == 1 and card["finance"] == [] and card["gamedev"] == []


def test_recent_titles_by_field_and_all_urls():
    now = datetime(2026, 10, 26, 9, tzinfo=VN_TZ)
    cards = [
        {"date": "2026-10-26", "tech": [{"title": "today", "url": "https://0"}]},
        {"date": "2026-10-25", "tech": [{"title": "t1", "url": "https://1"}],
         "gamedev": [{"title": "g1", "url": "https://github.com/a/b"}]},
        {"date": "2026-10-01", "tech": [{"title": "old", "url": "https://old"}]},
    ]
    assert get_recent_titles_by_field(cards, "2026-10-26", now, days=7) == {"tech": ["t1"], "gamedev": ["g1"]}
    assert get_recent_titles_by_field(cards, "2026-10-26", now, days=7, include_today=True)["tech"] == ["today", "t1"]
    assert get_all_urls(cards) == {"https://0", "https://1", "https://github.com/a/b", "https://old"}
