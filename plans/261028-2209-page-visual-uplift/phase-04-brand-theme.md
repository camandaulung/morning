# Phase 04 — Brand + theme

**Priority:** P1 · **Status:** ☑ Xong (2026-10-28) · **Category:** 1 Art direction (1.5 → 2.5), 2 Hero + brand (1.5 → 2.5), 7 Màu/theme (1.5 → 2.5)
**Cần chốt trước:** D2, D4.

## Key insight
Tên "Cá Mặn Đau Lưng" có cá tính, nhưng không bề mặt nào thể hiện nó. Brand mark là ô chữ "C" trên nền đen.
Light mode: `--bg #f4f7f5` và `--surface #ffffff` quá gần nhau. Dưới màn, contrast chỉ 53.

## Concept (art director, đã lọc theo guideline)
Một tờ báo buổi sáng điềm tĩnh: serif mực, một màu nhấn muối biển (teal hiện có).
Thứ hạng thể hiện bằng cỡ chữ, đường kẻ và khoảng trắng, không bằng thêm hộp.

## Related code files (sửa)
- `index.html` — markup brand mark (`.brand-mark`), `theme-color`.
- `styles.css` — token `:root` và `body[data-theme='dark']`, `.brand-mark`, `.story-hero .story-card-body`, `.state-panel`.
- `renderers.js` — empty state dùng glyph brand.
- `docs/design-guidelines.md` — mục "Product posture" và "Theme ownership" (chỉ khi anh chốt D2/D4).

## Implementation steps
1. **Brand mark (D4).** Wordmark "Cá Mặn" bằng Newsreader + glyph cá SVG inline, 1 màu, nét 1.8 như icon hiện có. Không emoji, không gradient.
   Mobile: chỉ glyph. Empty state: glyph lớn, mờ.
2. **Canvas light (D2).** Phương án đề xuất: giữ hue trung tính, hạ `--bg` một bậc (ví dụ `#eaefec`) để card trắng tách nền. Kiểm contrast chữ `--muted`/`--faint` trên nền mới.
3. **Viền và bóng card.** Một hệ elevation 2 bậc: card thường và card nổi (hero/primary). Dùng chung token, không hard-code `rgba`.
4. **Hero overlay.** Gradient đáy hiện tối đến 0.88. Giảm vùng tối, tăng độ rõ ảnh ở 60% phía trên. Giữ chữ hero đạt AA.
5. **Dark theme.** Kiểm lại card vs canvas sau khi đổi token. Giữ thứ bậc tương phản như light.
6. Bump `?v=`.

## Todo
- [ ] Glyph cá SVG + wordmark (desktop, mobile, empty state)
- [ ] Token `--bg` light mới + kiểm contrast AA
- [ ] Hệ elevation 2 bậc bằng token
- [ ] Hero overlay nhẹ hơn, chữ vẫn AA
- [ ] Rà dark theme
- [ ] Bump `?v=`
- [ ] Cập nhật guideline theo D2/D4

## Success criteria
- desktop-scroll1/2 light: contrast > 60 (cổng thoát).
- Chữ phụ đạt WCAG AA trên nền mới ở cả 2 theme.
- Brand nhận ra được ở topbar desktop, topbar mobile, empty state.
