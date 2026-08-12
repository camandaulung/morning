"""Test card_pipeline.enrich_images — attach thumbnails by URL match, without
overwriting existing images or touching unmatched/imageless items."""
from card_pipeline import enrich_images

FIELDS = ["entertainment", "trending"]


def test_attaches_image_by_url_match():
    card = {"entertainment": [{"title": "A", "url": "https://x/1"}]}
    out = enrich_images(card, FIELDS, {"https://x/1": "https://cdn/1.jpg"})
    assert out["entertainment"][0]["image"] == "https://cdn/1.jpg"


def test_unmatched_item_stays_imageless():
    card = {"entertainment": [{"title": "A", "url": "https://x/2"}]}
    out = enrich_images(card, FIELDS, {"https://x/1": "https://cdn/1.jpg"})
    assert "image" not in out["entertainment"][0]


def test_does_not_overwrite_existing_image():
    card = {"entertainment": [{"title": "A", "url": "https://x/1", "image": "https://keep/me.jpg"}]}
    out = enrich_images(card, FIELDS, {"https://x/1": "https://cdn/other.jpg"})
    assert out["entertainment"][0]["image"] == "https://keep/me.jpg"


def test_empty_map_is_noop():
    card = {"entertainment": [{"title": "A", "url": "https://x/1"}]}
    out = enrich_images(card, FIELDS, {})
    assert "image" not in out["entertainment"][0]


def test_multiple_fields_and_partial_match():
    card = {
        "entertainment": [{"title": "A", "url": "https://x/1"}],
        "trending": [{"title": "B", "url": "https://x/2"}],
    }
    out = enrich_images(card, FIELDS, {"https://x/2": "https://cdn/2.jpg"})
    assert "image" not in out["entertainment"][0]
    assert out["trending"][0]["image"] == "https://cdn/2.jpg"


def test_url_whitespace_trimmed_on_lookup():
    card = {"entertainment": [{"title": "A", "url": "  https://x/1  "}]}
    out = enrich_images(card, FIELDS, {"https://x/1": "https://cdn/1.jpg"})
    assert out["entertainment"][0]["image"] == "https://cdn/1.jpg"


def test_non_dict_items_skipped():
    card = {"entertainment": ["not-a-dict", {"title": "A", "url": "https://x/1"}]}
    out = enrich_images(card, FIELDS, {"https://x/1": "https://cdn/1.jpg"})
    assert out["entertainment"][1]["image"] == "https://cdn/1.jpg"
