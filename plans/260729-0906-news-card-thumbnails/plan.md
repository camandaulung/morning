# Plan: Thumbnail ảnh động cho card news tiêu điểm

**Ngày:** 2026-07-29 · **Branch:** main · **Loại:** feature (UI web + pipeline)

## Mục tiêu
Hiển thị ảnh thumbnail thật (lazy-load) trên các card news tiêu điểm của web
(`hero`/`primary`/`secondary`), thay hình monogram fallback hiện tại.

## Bối cảnh (đã khảo sát)
- **Frontend đã có sẵn khung ảnh:** `renderers.js` → `flattenCard` đọc `entry.image`;
  `storyVisualHtml` render class `has-image` + `background-image` khi có ảnh, không thì
  monogram (chữ "V" mờ). CSS `.story-visual.has-image` đã xử lý overlay.
- **Thiếu 2 mắt xích:** (1) `cards.json` chưa có field `image`; (2) "load động" —
  hiện dùng CSS `background-image`, chưa lazy-load / skeleton / onerror fallback.
- **Nguồn ảnh sạch nhất = RSS media tags:** probe 8 feed → publisher trực tiếp
  (kenh14, vnexpress, cafef, genk, tuoitre, 24h, thanhnien) **5/5 item có ảnh** qua
  `enclosure` / `<img>` trong description; Google News RSS **0/5** (topic `trending`
  nguồn GNews sẽ fallback monogram — chấp nhận được).
- **Nguyên tắc chống bịa:** build map `url → image` ngay lúc fetch, gắn vào item
  theo URL SAU dedup — LLM không bao giờ tự sinh URL ảnh (mirror pattern `trusted_urls`).

## Kiến trúc thay đổi
```
fetch (RSS media tags) ──► url→image map ──► [aggregate] ──► enrich_images(card, map)
   rss_fetch.py            jina_fetch.py      card_pipeline    (sau validate+dedup)
                                                     │
                                              cards.json (+field "image")
                                                     │
                       flattenCard ──► storyVisualHtml (<img lazy+skeleton+onerror>)
                          renderers.js                styles.css
```

## Quyết định đã chốt (2026-07-29)
- **Phạm vi:** chỉ card daily tiêu điểm (hero/primary/secondary). KHÔNG làm reader/weekly/monthly đợt này.
- **GNews không ảnh:** để fallback monogram (không resolve redirect lấy og:image).

## Phases
| # | Phase | Trạng thái | File |
|---|-------|-----------|------|
| 1 | Pipeline: trích ảnh RSS → `image` trong cards.json | ✅ Xong | [phase-01](phase-01-pipeline-image-extraction.md) |
| 2 | Frontend: `<img>` lazy-load + skeleton + onerror | ✅ Xong | [phase-02](phase-02-frontend-lazy-thumbnails.md) |
| 3 | Test + verify (unit + UI + full digest run) | ✅ Xong | [phase-03](phase-03-tests-and-verification.md) |

## Kết quả verify
- Python: 166 pass (thêm 18 test: extract_image ×11, enrich_images ×7).
- Playwright UI: 24/24 pass (thêm test thumbnail lazy-load + fallback).
- Feed thật: entertainment 32/32, vietnam 32/32 có ảnh; 0 URL ảnh lọt vào context Gemini.
- Browser: 6 card render `<img.visual-img loading=lazy>`, ảnh CDN load 1200×720, object-fit cover,
  monogram ẩn khi ảnh sẵn sàng, 0 ảnh error. (Screenshot bị chặn do browser pane không hiển thị
  trong session — đã verify qua DOM/CSS thay thế.)
- Smoke `generate_card.py`: chưa chạy được (local thiếu GEMINI/JINA key) — sẽ xác nhận ở CI run 9h.

## Dependencies
- Phase 2 độc lập với Phase 1 (frontend đọc `image` nếu có, không có thì fallback —
  có thể làm song song). Phase 3 sau cả 2.
- Không đổi schema breaking: `image` là field optional, card cũ không có vẫn render.

## Rủi ro chính
- Hotlink/403 từ CDN publisher → onerror fallback monogram (đã cover ở Phase 2).
- `cards.json` phình size (thêm URL ảnh/item, rolling 30 ngày) → chấp nhận, ~+80 byte/item.
- Google News items không ảnh → monogram (bằng hiện trạng, không xấu đi).

## Không làm (YAGNI)
- Không tự host/proxy/resize ảnh (dùng thẳng CDN publisher, CSS `object-fit: cover`).
- Không fetch og:image từng URL (thêm N request + vướng Google redirect) — chỉ dùng RSS map.
- Không thêm ảnh cho reader-pane/weekly/monthly ở lần này (chỉ card tiêu điểm daily).
