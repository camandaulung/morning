# Phase 01 — Ảnh + họ card

**Priority:** P0 · **Status:** ☑ Xong (2026-10-28) · **Category:** 3 Họ card (1 → 2), 5 Bố cục (1 → 2), 6 Surface/ảnh (1 → 2.5), 2 Hero (một phần)
**Cần chốt trước:** D1, D3.

## Key insight
Đây là đòn bẩy lớn nhất và rẻ nhất. 21/34 tin hôm nay có `image`, nhưng chỉ 6 card hiện ảnh.
`renderers.js:130` chặn visual cho `compact` và `headline`. Plan `260729-0906-news-card-thumbnails` phase-02 đã chọn như vậy.
Plan này đảo quyết định đó. Ảnh sẽ phá "tường text" dưới màn, nên kéo lên 3 category cùng lúc.

## Related code files (sửa)
- `renderers.js` — `storyCardHtml`, `storyVisualHtml`.
- `styles.css` — khối `.story-visual*`, `.story-secondary*`, `.story-compact*`, `.story-headline*`.
- `index.html` — bump `?v=` cho `renderers.js` và `styles.css`.
- `docs/design-guidelines.md` — mục "Story visuals" và "Editorial ranking and card hierarchy" (chỉ khi anh chốt D1/D3).

## Implementation steps
1. **Compact có ảnh.** Trong `storyCardHtml`, gọi `storyVisualHtml` cho `compact` khi `item.image` có giá trị.
   Compact không ảnh giữ dạng text, không thêm fallback (theo D1: 2 cỡ card tạo nhịp).
2. **Headline row có thumbnail nhỏ.** Khi có ảnh, thêm thumbnail vuông 64–72px ở đầu hàng. Không ảnh thì giữ hàng như cũ.
3. **Tỉ lệ ảnh cố định.** `aspect-ratio: 16 / 9` cho secondary và compact; `object-position: center 30%` để ưu tiên phần trên.
   Đặt `width`/`height` trên `<img>` để giữ CLS ≤ 0.05.
4. **Scrim trên đầu cho label.** Thêm lớp tối ở 30% phía trên của `.has-image::after`, đủ cho chữ 11px đạt WCAG AA.
   Hoặc bỏ `.visual-label` trên ảnh (vì kicker trong body đã có topic). Em đề xuất bỏ trên secondary/compact, giữ trên hero.
5. **Sửa fallback secondary (D3).** Fallback không ảnh dùng cùng `aspect-ratio` với card có ảnh. Màu topic hiện có (`.topic-*`), monogram nguồn bằng serif. Xoá dải trống trên band.
6. **Hero bỏ label lặp.** Hero hiện vừa có "VIỆT NAM" trên ảnh vừa có "Việt Nam" trong meta. Giữ một chỗ.
7. Bump `?v=` trong `index.html`.

## Todo
- [ ] Compact có ảnh khi `item.image` có giá trị
- [ ] Headline row có thumbnail nhỏ
- [ ] `aspect-ratio` + `object-position` + `width`/`height` cho `<img>`
- [ ] Scrim trên hoặc bỏ label trên ảnh (secondary/compact)
- [ ] Fallback secondary cùng tỉ lệ, không còn dải trống
- [ ] Hero chỉ hiện topic một lần
- [ ] Căn baseline meta trong compact grid (art director đo lệch y604 vs y615)
- [ ] Bump `?v=`
- [ ] Cập nhật `docs/design-guidelines.md` theo D1/D3

## Success criteria
- View hôm nay hiện ≥ 21 ảnh (trừ ảnh lỗi CDN).
- desktop-scroll1/2 đạt entropy > 3.0, dominant < 0.6, contrast > 60.
- Không còn dải trống trong view tuần và tháng.
- Thứ tự tin không đổi so với trước khi sửa.
- CLS ≤ 0.05.

## Rủi ro / mitigation
- Nhiều ảnh hơn → nặng hơn. `loading="lazy"` đã có; kiểm byte ảnh màn đầu theo budget phase-00.
- Crop chart/banner quảng cáo xấu → chấp nhận; `object-position` giảm bớt.
- Ảnh lỗi 403 → `onerror` đã gỡ `has-image`; compact quay về dạng text, không vỡ hàng.
