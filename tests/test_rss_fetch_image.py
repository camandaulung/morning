"""Test rss_fetch.extract_image — thumbnail extraction from RSS/Atom item XML,
covering each source branch (media:content/thumbnail, enclosure, <img> in
description/content:encoded) and the no-image case (e.g. Google News)."""
import xml.etree.ElementTree as ET
from rss_fetch import extract_image


def _item(inner_xml: str):
    """Wrap item children in the namespaces VN feeds use, return the <item> element."""
    xml = (
        '<item xmlns:media="http://search.yahoo.com/mrss/" '
        'xmlns:content="http://purl.org/rss/1.0/modules/content/">'
        f'{inner_xml}</item>'
    )
    return ET.fromstring(xml)


class TestExtractImage:
    def test_media_content(self):
        el = _item('<media:content url="https://cdn.x/a.jpg" medium="image"/>')
        assert extract_image(el) == "https://cdn.x/a.jpg"

    def test_media_thumbnail(self):
        el = _item('<media:thumbnail url="https://cdn.x/thumb.jpg"/>')
        assert extract_image(el) == "https://cdn.x/thumb.jpg"

    def test_media_content_preferred_over_thumbnail(self):
        el = _item('<media:thumbnail url="https://cdn.x/t.jpg"/>'
                   '<media:content url="https://cdn.x/full.jpg"/>')
        assert extract_image(el) == "https://cdn.x/full.jpg"

    def test_enclosure_image(self):
        el = _item('<enclosure url="https://cdn.x/enc.jpg" type="image/jpeg"/>')
        assert extract_image(el) == "https://cdn.x/enc.jpg"

    def test_enclosure_non_image_type_ignored(self):
        el = _item('<enclosure url="https://cdn.x/audio.mp3" type="audio/mpeg"/>')
        assert extract_image(el) == ""

    def test_img_in_description(self):
        desc = '<![CDATA[<a href="x"><img src="https://cdn.x/desc.jpg"/></a> text]]>'
        el = _item(f'<description>{desc}</description>')
        # description is passed as the raw string by the caller
        raw = '<a href="x"><img src="https://cdn.x/desc.jpg"/></a> text'
        assert extract_image(el, raw) == "https://cdn.x/desc.jpg"

    def test_img_in_content_encoded(self):
        el = _item('<content:encoded>'
                   '&lt;img src="https://cdn.x/enc-content.jpg"&gt; body'
                   '</content:encoded>')
        # ElementTree unescapes entities, so findtext returns real <img> markup
        assert extract_image(el) == "https://cdn.x/enc-content.jpg"

    def test_no_image_returns_empty(self):
        el = _item('<title>Google News item</title><link>https://news.google.com/x</link>')
        assert extract_image(el) == ""

    def test_data_uri_rejected(self):
        el = _item('<media:content url="data:image/png;base64,AAAA"/>')
        assert extract_image(el) == ""

    def test_relative_url_rejected(self):
        el = _item('<media:content url="/img/a.jpg"/>')
        assert extract_image(el) == ""

    def test_priority_media_over_enclosure_over_img(self):
        el = _item('<media:content url="https://cdn.x/media.jpg"/>'
                   '<enclosure url="https://cdn.x/enc.jpg" type="image/jpeg"/>')
        raw = '<img src="https://cdn.x/desc.jpg"/>'
        assert extract_image(el, raw) == "https://cdn.x/media.jpg"
