# Phase 00 — Baseline số đo

**Priority:** P0 · **Status:** ☑ Xong (2026-10-28) · **Category:** 10 Perf evidence (1 → nền cho 3)

## Key insight
Category 10 chỉ lên 3 khi có số before và after. Phải đo trước khi sửa CSS.

## 13 state cần chụp (dùng lại ở mọi phase)
Chụp bằng `agent-browser`. Desktop 1440×900, mobile 390×844. Feed cuộn trong `#feed-list`, không cuộn `document`. Từ vòng sửa thứ 3, `#feed-pane` là vùng cuộn (header ngày cuộn đi, chỉ dải chip dính), nên script chụp đặt `#feed-pane.scrollTop`.

| # | File | Theme | State |
|---|---|---|---|
| 1 | desktop-top | light | `#card-<hôm nay>`, đầu feed |
| 2 | desktop-scroll1 | light | `#feed-list.scrollTop = 700` |
| 3 | desktop-scroll2 | light | `#feed-list.scrollTop = 1500` |
| 4 | desktop-hover-light | light | scroll 700, hover `.story-compact` đầu tiên |
| 5 | desktop-dark | dark | đầu feed |
| 6 | desktop-dark-feed | dark | hero ở state selected |
| 7 | desktop-dark-reader | dark | reader mở |
| 8 | desktop-dark-month | dark | `#month-<tháng gần nhất>` |
| 9 | desktop-dark-week | dark | `#weekgroup-<tuần trước>` |
| 10 | desktop-empty-day | light | một ngày quá khứ có 0 tin |
| 11 | mobile-top | dark | đầu feed |
| 12 | mobile-scroll | dark | `#feed-list.scrollTop = 1400` |
| 13 | mobile-reader | dark | reader mở |

## Implementation steps
1. Chụp 13 state ở trên. Lưu ngoài repo (scratchpad). Không commit ảnh.
2. Chạy `metrics.py` trên cả 13 ảnh. Lưu JSON.
3. Đo cho view hôm nay, desktop + mobile, trong session `agent-browser` mới (profile cũ có thể giữ cache):
   - LCP (`PerformanceObserver` type `largest-contentful-paint`, bắt buộc `buffered: true` để bắt LCP đã xảy ra trước khi gắn observer).
   - CLS (`layout-shift`, cộng `value` khi `hadRecentInput = false`).
   - Tổng byte ảnh và số request ảnh (`performance.getEntriesByType('resource')`, `initiatorType = img`).
4. Ghi budget vào bảng dưới. Đóng browser.

## Budget (điền số before, sau đó giữ làm trần)
Đo ngày 2026-10-28, dữ liệu 53 tin. Server local = `python -m http.server`; live = GitHub Pages.

| Chỉ số | Before | Budget after |
|---|---|---|
| LCP desktop (local / live) | 4180 ms / 3408 ms | ≤ before (không xấu đi) |
| LCP mobile (local) | 8092 ms | ≤ before |
| CLS desktop / mobile | 0.0017 / 0.0304 | ≤ 0.05 |
| Byte ảnh màn đầu (desktop) | 6 ảnh, 1755 KB | ≤ 2280 KB (before + 30%) |
| Số ảnh load khi mở trang | 6 | chỉ ảnh gần viewport (lazy) |

**Bottleneck:** ảnh hero là ảnh LCP nhưng có `loading="lazy"`. Trình duyệt tải nó trễ.
Ảnh CDN là bản 1200px (ảnh hero PNG 837 KB). Plan không resize ảnh (xem "Không làm").

## Success criteria
- Có đủ 13 ảnh, 13 dòng metrics, bảng budget có số before.
