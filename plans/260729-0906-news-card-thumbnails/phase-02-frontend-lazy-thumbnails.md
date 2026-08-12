# Phase 02 — Frontend: `<img>` lazy-load + skeleton + onerror fallback

**Priority:** P0 · **Status:** ☐ Chưa · "Load động" = native lazy + skeleton + fallback monogram.

## Key insight
- Hiện `storyVisualHtml` (renderers.js:106) dùng CSS `background-image` → không lazy-load
  được, không bắt được lỗi ảnh. Đổi sang `<img>` thật để có `loading="lazy"`,
  `decoding="async"`, và `onerror` fallback.
- Giữ monogram + `visual-label` làm **nền skeleton**: `<img>` phủ lên trên; ảnh lỗi/khi
  chưa tải → thấy monogram bên dưới (fallback tự nhiên, 0 layout shift).
- Chỉ áp cho card tiêu điểm: `hero`, `primary`, `secondary` (đúng yêu cầu "card tiêu điểm").
  `compact`/`headline` giữ nguyên (không có visual).

## Related code files (sửa)
- `renderers.js` — `storyVisualHtml`: render `<img>` khi `item.image`.
- `styles.css` — `.story-visual img` (object-fit cover, fade-in), skeleton shimmer, onerror.
- `index.html` — bump `?v=` cho renderers.js + styles.css (cache-bust CF Pages/GH Pages).

## Implementation steps
1. **`renderers.js` `storyVisualHtml`** — khi có `item.image`, thêm trong `.story-visual.has-image`:
   ```js
   const img = item.image
     ? `<img class="visual-img" src="${escapeHtml(item.image)}" alt="" loading="lazy"
          decoding="async" onerror="this.closest('.story-visual').classList.remove('has-image');this.remove()">`
     : '';
   ```
   Bỏ `imageStyle` (background-image). Đặt `<img>` là con đầu của `.story-visual`, monogram/label sau.
   → onerror: gỡ `has-image` để CSS quay về style monogram + xoá `<img>` hỏng.
2. **`styles.css`**:
   - `.story-visual .visual-img { position:absolute; inset:0; width:100%; height:100%;
     object-fit:cover; z-index:0; opacity:0; transition:opacity .35s ease; }`
   - `.story-visual .visual-img[data-loaded], .story-visual .visual-img:not([style])` → fade-in.
     (Đơn giản hơn: `img { opacity:1 }` mặc định + skeleton bằng `.story-visual` nền
     gradient/shimmer lộ ra khi ảnh chưa vẽ — KISS: bỏ opacity animation nếu phức tạp.)
   - Skeleton shimmer: `.story-visual.has-image::before { content:''; position:absolute;
     inset:0; background:linear-gradient(100deg,#2c6358, #35756699,#2c6358); background-size:200% 100%;
     animation:shimmer 1.2s infinite; z-index:0; }` — ảnh (`z-index:0`? cần trên shimmer → img `z-index:1`).
     Chốt z-index: shimmer 0 < img 1 < label/monogram 2 (đã có z-index:1 → nâng lên 2).
   - `@keyframes shimmer { to { background-position:-200% 0 } }`.
   - `@media (prefers-reduced-motion: reduce)` → tắt shimmer + fade.
3. **`index.html`** — `styles.css?v=260729`, `renderers.js?v=260729`.

## Todo
- [ ] `storyVisualHtml` render `<img>` lazy + onerror (chỉ hero/primary/secondary)
- [ ] CSS `.visual-img` cover + z-index layering + skeleton shimmer
- [ ] `prefers-reduced-motion` guard
- [ ] Bump asset `?v=` trong index.html
- [ ] `npm run dev` → mắt kiểm hero có ảnh, ảnh lỗi → monogram, không layout shift

## Success criteria
- Card hero/primary/secondary có `image` → hiện ảnh cover, bo góc đúng khung.
- Ảnh 404/403 → tự fallback monogram, không vỡ layout, không icon vỡ.
- `loading="lazy"` → ảnh dưới màn chỉ tải khi scroll tới (kiểm Network tab).
- Dark/light mode: overlay gradient chữ tiêu đề vẫn đọc rõ trên ảnh (đã có `.has-image::after`).
- Không regression `.story-visual:not(.has-image)` (item không ảnh giữ style cũ).

## Rủi ro / mitigation
- Ảnh ngang/dọc lệch tỉ lệ → `object-fit:cover` crop giữa, chấp nhận.
- CLS khi ảnh tải: `.story-visual` đã có `min-height` cố định → khung reserve sẵn, không shift.
- XSS qua URL ảnh: `escapeHtml` + `src` là URL đã `safeUrl()` ở flattenCard (chỉ http/https).
