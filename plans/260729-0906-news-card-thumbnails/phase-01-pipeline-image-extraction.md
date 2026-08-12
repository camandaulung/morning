# Phase 01 — Pipeline: trích ảnh RSS → field `image` trong cards.json

**Priority:** P0 · **Status:** ☐ Chưa · Gắn thumbnail URL vào mỗi item theo URL, không cho LLM bịa.

## Key insight
- Item dict trong `cards.json` hiện có: title, desc, detail, tag, tagLabel, source, url.
  Cần thêm `image` (optional). `flattenCard` (renderers.js:75) đã đọc sẵn field này.
- Map `url → image` build lúc fetch, apply SAU `validate_card` + `dedup_card` (2 bước này
  chỉ dùng/giữ URL, không đụng `image`), TRƯỚC `write_cards_file`.

## Related code files (sửa)
- `rss_fetch.py` — extract ảnh mỗi RSS item + trả map.
- `jina_fetch.py` — `fetch_topic_context` thread thêm image map (RSS bắt buộc, Jina optional).
- `card_pipeline.py` — `fetch_contexts` aggregate map; thêm `enrich_images()`.
- `generate_card.py` (`main_morning`) + `evening_update.py` (`run_evening`) — nhận map, gọi enrich.

## Implementation steps
1. **`rss_fetch.py`** — thêm `extract_image(item) -> str`:
   - Thứ tự: `media:content[url]` → `media:thumbnail[url]` (ns `http://search.yahoo.com/mrss/`)
     → `<enclosure url type=image*>` → regex `<img src>` đầu tiên trong `description`/`content:encoded`.
   - Trả "" nếu không có; bỏ qua data-URI. Trong `fetch_rss`, gắn `item["image"]` cho cả
     nhánh RSS 2.0 lẫn Atom.
2. **`rss_fetch.py` `fetch_rss_topic`** — build `image_map = {r["url"]: r["image"] for r if image}`;
   đổi return thành `(text, valid_urls, image_map)`. **Không** đưa URL ảnh vào text context
   (LLM không cần thấy → không bịa).
3. **`jina_fetch.py` `fetch_topic_context`** — hiện return `(text, urls)`. Đổi thành
   `(text, urls, image_map)`; RSS map merge vào. (Jina result chưa chắc có ảnh → để {} lần này,
   ghi TODO; giữ signature sẵn cho tương lai.)
4. **`card_pipeline.py` `fetch_contexts`** — aggregate `image_map` across topics,
   return `(topic_contexts, trusted_urls, image_map)`.
5. **`card_pipeline.py`** — thêm:
   ```python
   def enrich_images(card_json, output_fields, image_map):
       for f in output_fields:
           for x in card_json.get(f, []):
               if isinstance(x, dict) and not x.get("image"):
                   img = image_map.get(x.get("url", ""))
                   if img:
                       x["image"] = img
       return card_json
   ```
6. **`generate_card.py`** — cập nhật unpack `fetch_contexts` (3 giá trị); gọi `enrich_images`
   sau `dedup_card`, trước `update_cards_file`.
7. **`evening_update.py`** — tương tự (evening items cũng có ảnh).

## Todo
- [ ] `extract_image` + gắn vào `fetch_rss` (RSS 2.0 + Atom)
- [ ] `fetch_rss_topic` trả image_map
- [ ] `fetch_topic_context` + `fetch_contexts` thread map
- [ ] `enrich_images` trong card_pipeline
- [ ] Wire generate_card.py + evening_update.py
- [ ] Chạy `python generate_card.py` local → verify cards.json có `image` ở item publisher

## Success criteria
- Item nguồn publisher (vnexpress/kenh14/cafef/...) có `image` là URL https hợp lệ.
- Item Google News không có `image` (không lỗi, không key rỗng thừa).
- `validate_card`/`dedup_card` không strip `image`; `cards.json` vẫn hợp lệ JSON.
- Không có URL ảnh nào lọt vào text context gửi Gemini (grep prompt).

## Rủi ro / mitigation
- Một số feed đặt ảnh trong `content:encoded` thay `description` → extract cover cả 2.
- URL ảnh tương đối (hiếm) → chỉ nhận `http(s)://`.
- Trùng URL bài giữa Jina & RSS → RSS map ưu tiên (có ảnh); dùng `setdefault`.
