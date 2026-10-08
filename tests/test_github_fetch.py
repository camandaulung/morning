"""Test GitHub topic fetch — Claude-related repos are flagged and listed first."""
from unittest.mock import patch

from jina_fetch import fetch_github_topic, is_claude_related


def _repo(name, desc="", topics=None):
    return {"name": name, "url": f"https://github.com/{name}", "desc": desc,
            "stars": "1K+", "lang": "C#", "topics": topics or [],
            "created": "2026-10-01", "pushed": "2026-10-06"}


def test_is_claude_related_matches_name_desc_topics():
    assert is_claude_related(_repo("a/claude-game"))
    assert is_claude_related(_repo("a/b", desc="Unity MCP server"))
    assert is_claude_related(_repo("a/b", topics=["anthropic"]))
    assert not is_claude_related(_repo("godotengine/godot", desc="Game engine"))


def test_claude_repos_listed_first_and_flagged():
    results = [_repo("godotengine/godot"), _repo("x/claude-studio"), _repo("x/godot-mcp")]
    topic = {"github_queries": ["q1 pushed:>{cutoff_date} created:>{created_cutoff}"]}
    with patch("jina_fetch.github_search", return_value=results) as search:
        text, urls = fetch_github_topic(topic, "2026-09-23", "2026-08-08")
    search.assert_called_once_with("q1 pushed:>2026-09-23 created:>2026-08-08", 8)
    assert urls == {r["url"] for r in results}
    lines = [l for l in text.splitlines() if l.startswith("[")]
    assert lines[0].startswith("[1] [CLAUDE] x/claude-studio")
    assert lines[1].startswith("[2] [CLAUDE] x/godot-mcp")
    assert lines[2].startswith("[3] godotengine/godot")


def test_duplicate_repos_across_queries_deduped():
    topic = {"github_queries": ["q1", "q2"]}
    with patch("jina_fetch.github_search", return_value=[_repo("a/b")]):
        text, urls = fetch_github_topic(topic, "2026-09-23")
    assert urls == {"https://github.com/a/b"}
    assert text.count("a/b") == 2  # name line + URL line, listed once
