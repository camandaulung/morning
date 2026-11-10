"""Fetching runs on threads — results must still come back in config order so
prompts stay deterministic, and one failing topic must not take the others down."""
import sys
import threading
import time
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

from jina_fetch import parallel_map, fetch_jina_topic  # noqa: E402
from card_pipeline import fetch_contexts  # noqa: E402


def test_parallel_map_keeps_input_order_and_overlaps():
    active = peak = 0
    lock = threading.Lock()

    def work(n):
        nonlocal active, peak
        with lock:
            active += 1
            peak = max(peak, active)
        time.sleep(0.05 * (4 - n))      # later items finish first
        with lock:
            active -= 1
        return n * 10

    assert parallel_map(work, [1, 2, 3]) == [10, 20, 30]
    assert peak > 1                      # really ran concurrently


def test_parallel_map_handles_empty_and_single():
    assert parallel_map(lambda x: x, []) == []
    assert parallel_map(lambda x: x + 1, [1]) == [2]


def test_jina_topic_results_follow_query_order():
    def fake_search(query, max_results=5):
        time.sleep(0.05 if query == "q1" else 0)
        return [{"title": query, "url": f"https://x.com/{query}", "description": "", "content": ""}]

    with patch("jina_fetch.jina_search", side_effect=fake_search):
        text, urls = fetch_jina_topic({"search_queries": ["q1", "q2", "q3"]}, "October 2026")
    assert text.index("[1] q1") < text.index("[2] q2") < text.index("[3] q3")
    assert urls == {"https://x.com/q1", "https://x.com/q2", "https://x.com/q3"}


def test_fetch_contexts_merges_in_topic_order_and_survives_a_crash():
    topics = {"a": {"n": 1}, "b": {"n": 2}, "c": {"n": 3}}

    def fake_fetch(topic, month_year, exclude_urls=None):
        n = topic["n"]
        if n == 2:
            raise RuntimeError("boom")
        time.sleep(0.05 if n == 1 else 0)   # first topic finishes last
        return f"ctx{n}", {f"https://x.com/{n}"}, {"https://shared.com/post": f"img{n}"}

    with patch("card_pipeline.fetch_topic_context", side_effect=fake_fetch):
        contexts, trusted, images = fetch_contexts(topics, "October 2026")

    assert list(contexts) == ["a", "b", "c"]
    assert contexts == {"a": "ctx1", "b": "", "c": "ctx3"}
    assert trusted == {"https://x.com/1", "https://x.com/3"}
    assert images == {"https://shared.com/post": "img1"}   # first topic in config order wins
