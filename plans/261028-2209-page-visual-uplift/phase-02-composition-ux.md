# Phase 02 — Bố cục + UX

**Priority:** P1 · **Status:** ☑ Xong (2026-10-28) · **Category:** 9 Chrome/UX (1.5 → 2.5), 5 Bố cục (hoàn tất lên 2)

## Key insight
Header feed + topic strip đứng yên, còn `#feed-list` cuộn bên dưới. Mép trên `#feed-list` cắt ngang chữ, không có divider.
Phần còn lại là lỗi copy và empty state. Các lỗi này nhỏ, nhưng người đọc thấy ngay.

## Related code files (sửa)
- `styles.css` — `.feed-header`, `.topic-strip`, `.feed-list`, `.section-heading`, `.reader-*`, `.global-search`.
- `view-builder.js` — dòng 74 (summary), dòng 100 (nhóm "Chủ đề"), dòng 187–191 (số đếm).
- `renderers.js` — dòng 176 (copy empty state), reader markup.
- `router-init.js` — thêm class khi `#feed-list` đã cuộn (nếu dùng cách JS).
- `index.html` — bump `?v=`.

## Implementation steps
1. **Mép cuộn.** Khi `#feed-list.scrollTop > 0`, thêm hairline + bóng 8px ở mép trên. Có thể thu header (ẩn dòng summary) để dải đứng yên còn ~150px.
2. **Section heading có trọng lượng.** "ĐIỂM NHANH" và "CÒN TRONG BẢN TIN": tăng cỡ, thêm rule ngang, dùng màu ink thay `--faint`.
3. **Copy theo viewport.** Summary "mở nhanh ở khung đọc bên phải" chỉ hiện khi viewport > 1180px. Mobile dùng câu khác hoặc ẩn.
4. **Empty state ngày quá khứ.** Nếu ngày < hôm nay: "Ngày này không có bản tin." + link sang ngày gần nhất có tin. Giữ copy cũ cho hôm nay.
5. **Nhóm rỗng.** Không render heading "Chủ đề" khi không có topic link.
6. **Gom số đếm.** Bỏ `count-badge` khi chip "Tất cả · N" đã hiện cùng số.
7. **Mobile.** Thêm fade ở mép phải `.topic-strip` để báo còn chip. Rút placeholder search ở ≤ 600px ("Tìm tin…").
8. **Reader.** Hiện ảnh lead (nếu có) dưới title, tỉ lệ 16:9. Link "Tin cùng chủ đề" chỉ làm khi anh chốt D6 theo phương án khác.
9. Bump `?v=`.

## Todo
- [ ] Hairline + bóng mép cuộn; thu header khi cuộn
- [ ] Section heading mới
- [ ] Copy summary theo viewport
- [ ] Empty state ngày quá khứ + link ngày gần nhất
- [ ] Ẩn heading "Chủ đề" rỗng
- [ ] Bỏ `count-badge` trùng số
- [ ] Fade chip strip + placeholder ngắn trên mobile
- [ ] Reader: ảnh lead (tin cùng chủ đề chỉ khi D6 đổi)
- [ ] Bump `?v=`

## Success criteria
- Không còn chữ bị cắt ngang ở mép cuộn (desktop-scroll2, mobile-scroll).
- desktop-empty-day: copy đúng, có link sang ngày khác, entropy tăng khỏi 0.75.
- mobile-top: không còn câu "khung đọc bên phải"; search không bị cắt chữ giữa từ.
- desktop-dark-reader: entropy > 3.0.
- Reader vẫn: đóng khi load, focus trap, Escape đóng, footer prev/next đứng yên (guideline "Reader contract").
