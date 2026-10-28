# Phase 03 — State tương tác + motion

**Priority:** P1 · **Status:** ☑ Xong (2026-10-28) · **Category:** 4 State tương tác (1.5 → 2.5), 8 Motion (1 → 2)

## Key insight
Hover hiện tại chỉ đổi màu viền và bóng (`styles.css` `.story-card:hover`). Pixel diff cho delta max 20/255: người dùng gần như không thấy.
Read state chỉ dựa vào nền nhạt hơn. Guideline yêu cầu read state "does not rely on color alone".

## Related code files (sửa)
- `styles.css` — `.story-card:hover`, `.story-card.read*`, `.reader-pane` transition, keyframes mới.
- `renderers.js` — thêm dấu check cho card đã đọc.
- `index.html` — bump `?v=`.

## Implementation steps
1. **Hover.** `translateY(-2px)`, bóng sâu hơn, underline headline. 150ms ease-out. Ảnh trong card scale 1.03.
2. **Focus-visible.** Ring giống selected, offset 2px. Kiểm cả 2 theme.
3. **Read state.** Thêm icon check nhỏ + chữ "Đã đọc" cạnh meta. Headline dùng `--muted`. Giữ contrast AA.
4. **Reader slide.** Thời lượng 220ms, ease-out khi mở, ease-in khi đóng. Backdrop fade cùng nhịp.
5. **Stagger reveal.** Card fade + dịch 6px khi render view mới, trễ 30ms mỗi card, tối đa 8 card. Không chạy lại khi chỉ đổi read state.
6. **Reduced motion.** Tắt mục 1 (phần dịch chuyển), 4 (chỉ giữ fade), 5 trong `@media (prefers-reduced-motion: reduce)`.
7. Bump `?v=`.

## Todo
- [ ] Hover lift + underline + scale ảnh
- [ ] Focus-visible ring
- [ ] Read state có icon + chữ
- [ ] Reader slide 220ms
- [ ] Stagger reveal (≤ 8 card)
- [ ] Reduced-motion guard
- [ ] Bump `?v=`

## Success criteria
- desktop-hover-light: pixel diff hover vs không hover lớn rõ (delta > 60/255 trên viền + headline).
- Có ảnh chụp read state ở cả 2 theme.
- Motion: ảnh tĩnh không chấm được. Quay video bằng `agent-browser` (hoặc chuỗi frame) cho hover, mở/đóng reader, đổi view.
- Không có layout shift khi hover (CLS không tăng).
