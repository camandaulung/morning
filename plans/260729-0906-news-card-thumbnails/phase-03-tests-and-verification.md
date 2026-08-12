# Phase 03 — Test + Verification

**Priority:** P1 · **Status:** ☐ Chưa · Không merge khi còn test đỏ.

## Related code files
- `tests/test_rss_fetch_image.py` (mới) — unit cho `extract_image`.
- `tests/test_card_pipeline_enrich.py` (mới) — unit cho `enrich_images`.
- `tests/` frontend — thêm case vào Playwright UI test (nếu có harness DOM sẵn) hoặc
  render assert trong test renderers hiện có.

## Implementation steps
1. **Unit `extract_image`** — feed XML mẫu (fixture string, không network) cho từng nhánh:
   media:content, media:thumbnail, enclosure, `<img>` trong description, và case rỗng
   (Google News) → "". Assert đúng URL / rỗng.
2. **Unit `enrich_images`** — card_json giả + image_map:
   - item có url khớp map → gắn `image`.
   - item không khớp → không có key `image`.
   - item đã có `image` sẵn → giữ nguyên (không overwrite).
3. **Full pipeline smoke** — `python generate_card.py` local (cần GEMINI/JINA key):
   grep `cards.json` thấy ≥1 item có `image` https; xác nhận JSON hợp lệ, không URL ảnh
   trong prompt log.
4. **Frontend UI** — `npm run test:ui` (Playwright, Vite dev). Thêm/không assert:
   - card hero với item.image → có `<img.visual-img>` với `loading="lazy"`.
   - item không image → `.story-visual:not(.has-image)`, không có `<img>`.
   - (nếu khó mock) tối thiểu: `npm run build` pass, mở dev mắt kiểm.
5. **Regression** — `python -m pytest tests/ -q` (toàn bộ) + `npm run test:dist`.

## Todo
- [ ] test_rss_fetch_image.py (5 nhánh)
- [ ] test_card_pipeline_enrich.py (3 case)
- [ ] `pytest tests/ -q` all green
- [ ] `npm run test:ui` + `npm run test:dist` green
- [ ] Smoke `generate_card.py` → cards.json có image (nếu có API key)

## Success criteria
- Toàn bộ pytest xanh (bao gồm test cũ, không regression).
- UI test xanh; build production OK.
- Mắt kiểm: hero/primary/secondary hiện ảnh, ảnh lỗi fallback monogram mượt.

## Unresolved questions
1. Jina Search API có trả field ảnh/thumbnail không? Nếu có → bổ sung vào image_map để
   phủ nốt item nguồn Jina (hiện chỉ RSS). Cần xem response thật 1 lần lúc implement.
2. Có muốn thumbnail cho reader-pane / weekly / monthly luôn không, hay chỉ daily card
   tiêu điểm đợt này? (Plan hiện giới hạn daily card — chờ Anh chốt.)
3. Google News items (topic trending) đa số không ảnh → chấp nhận monogram, hay muốn
   resolve redirect để lấy og:image (tốn thêm request/độ phức tạp)?
