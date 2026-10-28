# Phase 05 — Verify cuối + fresh-eyes lần 2

**Priority:** P0 · **Status:** ☑ Xong (2026-10-29) · **Category:** 10 Perf evidence (→ 3), cổng thoát cho mọi category

## Implementation steps
1. Chụp lại 13 state (danh sách ở phase-00) bằng `agent-browser`. Chụp thêm read state light + dark.
2. Chạy `metrics.py` trên tất cả ảnh. So với before.
3. Đo lại LCP, CLS, byte ảnh. So với budget ở phase-00.
4. Kiểm guideline: viewport 390, 600, 601, 900, 901, 1180, 1181, 1366, 1800, 1920, 2048, 2560px. Không overflow ngang. Thứ tự editorial giữ nguyên.
5. Quay video motion: hover, mở/đóng reader, đổi view.
6. Spawn subagent fresh-eyes. Chỉ đưa: toàn bộ ảnh, metrics JSON, scorecard, bảng mapping. Không đưa điểm cũ.
7. Chốt điểm thấp hơn mỗi category. Báo cả 2 bộ điểm.
8. Đóng browser.
9. Theo D5: chạy hoặc không chạy `npm run test:ui` / `npm run test:dist`. Báo kết quả thật, kể cả spec vỡ.

## Báo cáo
```text
Visual scorecard:
- <category>: before X / after Y - evidence:
Measured evidence: entropy / edge / contrast / dominant mỗi view; LCP, CLS, byte ảnh
Fresh-eyes review: điểm subagent
Average:
Automatic failures remaining:
```

## Cổng thoát
- View cuộn desktop + mobile: entropy > 3.0, dominant < 0.6, contrast > 60.
- Không category < 2. Trung bình ≥ 2.3.
- Không còn automatic failure.
- LCP, CLS trong budget.

Nếu chưa đạt: ghi category nào thiếu và pass tiếp theo. Không báo "xong".

## Kết quả (2026-10-29)
- Fresh-eyes lần 2 (vòng 2): 2.00, chưa đạt (Surface/ảnh 1.5). Em sửa thêm một vòng: chỉ dải chip dính, heading theo dải topic, tóm tắt cho compact không ảnh, ảnh dịu trong dark mode, read state cho hero.
- Fresh-eyes lần 3 (`iter6`): **2.35, Premium: YES**. Builder: 2.30. Điểm chốt (thấp hơn mỗi category): **2.30**. Bảng đầy đủ ở [plan.md](plan.md) mục "Điểm sau khi làm".
- `iter6/perf.json` là số đo của `iter5`. Giữa hai lần chỉ đổi một dòng CSS (`max-width: 72ch` cho tóm tắt).
- Layout: không overflow ngang, reader đóng khi load, dải chip dính dưới topbar ở cả 12 viewport.
- Kiểm chức năng bằng `agent-browser`: lọc chip reset cuộn, search, mở/đóng reader + trả focus, đánh dấu đã đọc tất cả, đổi theme. Không có lỗi console.
- Theo D5: không chạy `npm run test:ui` / `npm run test:dist` (cả hai dùng Playwright, rule của anh cấm). Spec dự kiến vỡ: kiểm chiều cao fallback secondary (< 52px, monogram ẩn) và tỉ lệ `headlineFill` (headline 2 cột).
