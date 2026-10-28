# Plan: Nâng visual, layout, UI/UX của page lên mức Premium (≥ 2.3)

**Ngày:** 2026-10-28 · **Branch:** main · **Loại:** UI/UX + visual (frontend web)
**Trạng thái:** ☑ Phase 0–4 xong. Anh chốt D1–D6 theo đề xuất (2026-10-28). Kết quả chấm ở mục "Điểm sau khi làm".

## Mục tiêu
Đưa page https://camandaulung.github.io/morning/ từ điểm **1.25** lên **≥ 2.3** (mục tiêu 2.4).
Không category nào dưới 2. Thang điểm là AAA visual scorecard của skill `threejs-game-skills`.

## Cách chấm (giả định cần anh biết)
Scorecard gốc viết cho game 3D. Page là news board DOM, nên em map 10 category sang bề mặt web.
Thang 0–3 và ngưỡng 2.3 giữ nguyên.

| # | Category gốc | Bề mặt trên page |
|---|---|---|
| 1 | Art direction | Art direction + nhận diện thương hiệu |
| 2 | Hero/player | Card hero + brand mark |
| 3 | Obstacles/enemies | Họ card phụ: primary, secondary, headline, compact |
| 4 | Rewards/interactables | State tương tác: hover, focus, selected, read, chip, reader |
| 5 | World/environment | Bố cục trang, nhịp và mật độ dưới màn đầu |
| 6 | Materials/textures | Surface, viền, đổ bóng, xử lý ảnh, độ phủ ảnh, fallback |
| 7 | Lighting/render | Màu, tương phản, theme sáng/tối, render chữ |
| 8 | VFX/motion | Transition và micro-interaction |
| 9 | UI/HUD | Chrome + UX: topbar, search, rail, chip, reader, mobile, copy, empty state |
| 10 | Performance evidence | Số đo: metrics ảnh, LCP, CLS, dung lượng ảnh |

**Ledger N/A** (bước của skill không áp dụng cho page này):
- `threejs-3d-generator`, `threejs-image-generator`, credential probe: N/A. Page không có asset 3D hay asset ảnh sinh ra. Ảnh là ảnh thật của báo nguồn.
- Canvas inspector (`inspect-threejs-canvas.mjs`): N/A, không có WebGL canvas. Thay bằng script PIL [`metrics.py`](metrics.py) trong folder này (cùng 4 chỉ số, ngưỡng xấp xỉ inspector).
  Chạy: `python -I plans/261028-2209-page-visual-uplift/metrics.py <ảnh1.png> <ảnh2.png> ...`
- Scorecard anchors (`scene-1..3.jpg`): không so được (là cảnh game). Chấm theo mô tả chữ của thang 0–3.

## Điểm hiện tại (before)
Builder = em chấm. Fresh-eyes = subagent art director chấm độc lập, chỉ thấy 13 ảnh chụp + metrics + scorecard.
Điểm chốt = điểm thấp hơn của mỗi category.

| Category | Builder | Fresh-eyes | **Chốt** | Bằng chứng chính |
|---|---|---|---|---|
| 1 Art direction | 1.5 | 1.5 | **1.5** | Serif + teal nhất quán, nhưng tên "Cá Mặn Đau Lưng" không có hình ảnh nào |
| 2 Hero + brand | 1.5 | 1.5 | **1.5** | Headline hero mạnh; brand mark là ô chữ "C"; label "VIỆT NAM" lặp kicker |
| 3 Họ card | 1 | 1.5 | **1** | 24/34 tin dùng một ô text giống hệt nhau |
| 4 State tương tác | 1.5 | 1.5 | **1.5** | Hover gần như vô hình (delta max 20/255); ring selected rõ |
| 5 Bố cục | 1 | 1.5 | **1** | Bento trên đầu tốt; dưới màn là tường ô trắng |
| 6 Surface/ảnh | 1 | 1 | **1** | Chỉ 6/34 card hiện ảnh; fallback có dải trống; label đè lên ảnh |
| 7 Màu/theme | 1.5 | 2 | **1.5** | Light mode: canvas và card gần cùng màu, contrast dưới màn = 53 |
| 8 Motion | 1 | 1 | **1** | Chỉ có shimmer + fade ảnh; hover/reader không thấy chuyển động rõ |
| 9 Chrome/UX | 1.5 | 1.5 | **1.5** | Copy sai trên mobile và ngày trống; search + chip bị cắt trên mobile |
| 10 Perf evidence | 1 | 1 | **1** | Chưa có LCP/CLS/byte ảnh, chưa có budget |
| **Trung bình** | 1.25 | 1.40 | **1.25** | |

**Automatic failures đang dính:** grid text dưới màn là "primitive-dominant"; 24 ô compact là "one repeated silhouette";
UI cắt chữ (dải sticky 240px cắt tiêu đề, mobile cắt search + chip); chưa có budget/diagnostics.

**Metrics ảnh** (`metrics.py`, ngưỡng: entropy > 3.0, dominant < 0.6, contrast > 60):

| View | Entropy | Dominant | Edge | Contrast | Fail |
|---|---|---|---|---|---|
| desktop light, top | 4.54 | 0.47 | 0.129 | 237 | — |
| desktop light, scroll 700 | **1.67** | **0.81** | 0.082 | **54** | 3/3 |
| desktop light, scroll 1500 | **1.81** | **0.77** | 0.083 | **53** | 3/3 |
| desktop dark, top | 4.28 | 0.52 | 0.130 | 156 | — |
| desktop dark, week | 3.98 | 0.56 | 0.108 | 170 | — |
| desktop dark, month | 4.13 | 0.51 | 0.137 | 129 | — |
| desktop dark, reader | **2.91** | 0.53 | 0.046 | 90 | 1/3 |
| desktop light, ngày trống | **0.75** | **0.92** | **0.028** | **10** | 3/3 |
| mobile dark, top | 4.75 | 0.39 | 0.162 | 133 | — |
| mobile dark, scroll | **2.62** | **0.68** | 0.146 | 111 | 2/3 |
| mobile dark, reader | **1.76** | **0.79** | 0.154 | 115 | 2/3 |

## Bối cảnh (đã khảo sát)
- **Ảnh có sẵn nhưng bị giấu.** Hôm nay 21/34 tin có field `image` trong `cards.json`. Chỉ 6 card hiện ảnh.
  Lý do: `renderers.js:130` chỉ gọi `storyVisualHtml` cho `hero`/`primary`/`secondary`.
  Plan `260729-0906-news-card-thumbnails` (phase-02) đã chủ động loại `compact`/`headline`. Plan này **đảo lại quyết định đó**.
- **Label topic đè lên ảnh thô.** `.story-visual.has-image::after` chỉ tối phần dưới (0.04 → 0.58). `.visual-label` nằm góc trên trái, không có scrim.
  Kết quả: "TECH & GADGET" đè lên chữ quảng cáo, "VIỆT NAM" đè lên chữ "SACOMBANK".
- **Fallback secondary bị vỡ.** `.story-secondary .story-visual:not(.has-image)` có `min-height: 46px`, nhưng card bên cạnh có ảnh 132px. Hàng card lệch, có dải trống (view tuần).
- **Dải sticky 240px không có divider.** Feed header + topic strip đứng yên; card cuộn bên dưới bị cắt ngang chữ.
- **Copy sai:** "mở nhanh ở khung đọc bên phải" hiện cả trên mobile. Ngày trong quá khứ hiện "Bản tin sẽ xuất hiện sau lần cập nhật tiếp theo". Nhóm "CHỦ ĐỀ" rỗng vẫn hiện heading.
- **Số "34" hiện 3 lần** trên màn đầu: badge, chip "Tất cả · 34", nút "Đánh dấu đã đọc · 34".
- **Reader:** không có ảnh lead; nửa dưới sheet trống.
- **Guideline:** `docs/design-guidelines.md` chặn gradient trang trí, neon, emoji icon; yêu cầu canvas trung tính; fallback là "functional identity, not decorative artwork". Plan giữ trong guideline, trừ các mục ở "Quyết định cần chốt".

## Quyết định cần chốt
Các mục này đụng `docs/design-guidelines.md` hoặc quy trình test. Em không tự quyết.

| # | Câu hỏi | Em đề xuất | Phương án khác |
|---|---|---|---|
| D1 | Vùng "Còn trong bản tin" (24 tin) | **Giữ thứ tự editorial.** Tạo nhịp bằng 2 cỡ card: có ảnh (thumbnail 16:9) và không ảnh (text, thấp hơn). | Art director đề xuất nhóm theo topic, dạng hàng kẻ. Cách này phá luật "Story order… remains stable" của guideline. |
| | **Đã làm (vòng 3):** thứ tự giữ nguyên. Thứ tự rank vốn xếp tin theo dải topic, nên em chỉ thêm heading cho mỗi dải tin liên tiếp cùng topic (chấm màu, tên, số tin). Không sắp xếp lại tin nào. | | |
| D2 | Màu canvas light mode | **Giữ trung tính,** tối canvas thêm một bậc để card trắng tách nền. | Đổi sang nền "giấy ấm". Phải sửa guideline ("neutral light canvas"). |
| D3 | Fallback khi không có ảnh (secondary) | **Panel topic phủ đủ slot,** cùng tỉ lệ với card có ảnh, monogram nguồn bằng serif. Primary giữ marker hẹp. | Giữ dải 46px như guideline, chỉ sửa lỗi dải trống. Hàng card vẫn lệch cao. |
| D4 | Brand mark | **Wordmark serif + glyph cá bằng SVG** (không emoji). Dùng ở topbar, mobile, empty state. | Giữ ô chữ "C". Category 1–2 khó lên 2.5. |
| D5 | Test UI Playwright có sẵn (`tests/ui/*.spec.js`) | **Không sửa spec.** Em verify bằng `agent-browser`. Anh hoặc người khác cập nhật spec nếu spec vỡ. | Cho phép cập nhật spec. Rule của anh hiện cấm viết Playwright spec. |
| D6 | Nửa dưới reader đang trống | **Chỉ thêm ảnh lead.** Reader vẫn chứa đúng một tin. | Thêm 2–3 link "Tin cùng chủ đề". Phải sửa guideline ("contains one selected story"). |

## Điểm mục tiêu (after)
Mọi category ở 2.0 chỉ cho trung bình 2.0. Để vượt 2.3, 5 category phải lên 2.5–3.

| Category | Before | Target | Phase | Vì sao đạt được |
|---|---|---|---|---|
| 1 Art direction | 1.5 | 2.5 | 4 | Wordmark + glyph, theme thể hiện ở brand, empty state, reader |
| 2 Hero + brand | 1.5 | 2.5 | 1, 4 | Bỏ label lặp, scrim đúng, brand mark mới |
| 3 Họ card | 1 | 2 | 1 | 2 cỡ compact (ảnh / không ảnh), headline row có thumbnail nhỏ |
| 4 State tương tác | 1.5 | 2.5 | 3 | Hover lift + underline, read có dấu check, reader có ảnh |
| 5 Bố cục | 1 | 2 | 1, 2 | Ảnh phá tường text; sticky band gọn; section heading có trọng lượng |
| 6 Surface/ảnh | 1 | 2.5 | 1 | Tỉ lệ ảnh cố định, scrim nhất quán, fallback đồng bộ |
| 7 Màu/theme | 1.5 | 2.5 | 4 | Card tách nền, contrast dưới màn > 60 ở cả 2 theme |
| 8 Motion | 1 | 2 | 3 | Hover, reader slide, stagger reveal; có video làm bằng chứng |
| 9 Chrome/UX | 1.5 | 2.5 | 2 | Sửa copy, mobile chip/search, empty state, gom số đếm |
| 10 Perf evidence | 1 | 3 | 5 | Baseline + after: metrics 13 view, LCP, CLS, byte ảnh, budget |
| **Trung bình** | **1.25** | **2.40** | | Biên an toàn 0.1 trên ngưỡng 2.3 |

## Điểm sau khi làm (2026-10-29)
Builder chấm trước khi đọc review. Fresh-eyes = subagent art director mới, chỉ thấy 14 ảnh `iter6`, metrics, perf, frame motion và scorecard.
Điểm chốt = điểm thấp hơn của mỗi category.

| Category | Before | Builder | Fresh-eyes | **Chốt** | Bằng chứng chính |
|---|---|---|---|---|---|
| 1 Art direction | 1.5 | 2 | 2.5 | **2** | Newsreader + DM Sans + teal nhất quán; glyph cá ở topbar và empty state. Chưa có masthead riêng. |
| 2 Hero + brand | 1.5 | 2.5 | 2.5 | **2.5** | Hero 60/40, scrim chỉ ở vùng chữ, có dấu "Đã đọc". Brand mark nhỏ. |
| 3 Họ card | 1 | 2.5 | 2.5 | **2.5** | 5 tầng rõ: primary 39/61, secondary 16:9, headline 2 cột, compact có thumbnail hoặc marker. |
| 4 State tương tác | 1.5 | 2.5 | 2.5 | **2.5** | Hover nhấc card + viền teal + gạch chân; read có dấu check ở mọi loại card; reader có ring focus. |
| 5 Bố cục | 1 | 2 | 2 | **2** | Heading theo dải topic tạo nhịp. Một số nhóm vẫn hở 1 ô ở hàng cuối. |
| 6 Surface/ảnh | 1 | 2 | 2 | **2** | Tỉ lệ ảnh cố định, ảnh dịu trong dark mode, fallback phẳng. Ảnh báo nguồn không lọc được (banner, stamp). |
| 7 Màu/theme | 1.5 | 2.5 | 2.5 | **2.5** | Text light mode đạt AA (5.8:1, 6.9:1); dark nhiều lớp; contrast view tin 106–235. |
| 8 Motion | 1 | 2 | 2 | **2** | Stagger reveal, reader trượt 240 ms, zoom ảnh khi hover. Bằng chứng là frame, không có video. |
| 9 Chrome/UX | 1.5 | 2.5 | 2.5 | **2.5** | Chỉ dải chip dính (113 px thay vì 225 px); empty day có link ngày gần nhất; month label ở rail. |
| 10 Perf evidence | 1 | 2.5 | 2.5 | **2.5** | LCP/CLS/byte ảnh before + after, 3 lần đo, có budget và cảnh báo nhiễu. |
| **Trung bình** | **1.25** | **2.30** | **2.35** | **2.30** | Đạt ngưỡng 2.3, biên 0. Không category < 2. |

**Automatic failures:** không còn (fresh-eyes kiểm từng mục).

**Metrics ảnh sau** (`iter8`, code cuối):

| View | Entropy | Dominant | Edge | Contrast |
|---|---|---|---|---|
| desktop light, top | 5.02 | 0.33 | 0.132 | 235 |
| desktop light, scroll 700 | 3.18 | 0.40 | 0.121 | 154 |
| desktop light, scroll 1500 | 3.25 | 0.39 | 0.117 | 151 |
| desktop dark, top | 4.96 | 0.29 | 0.121 | 185 |
| desktop dark, week | 4.80 | 0.28 | 0.103 | 160 |
| desktop dark, month | 4.86 | 0.29 | 0.130 | 133 |
| desktop dark, reader | 4.03 | 0.29 | 0.054 | 111 |
| desktop light, ngày trống | 1.55 | 0.58 | 0.027 | 22 |
| mobile dark, top | 5.18 | 0.20 | 0.164 | 140 |
| mobile dark, scroll | 3.95 | 0.24 | 0.163 | 124 |
| mobile dark, reader | 3.36 | 0.56 | 0.162 | 101 |

Ngày trống vẫn dưới ngưỡng. Đây là state yên tĩnh có chủ đích, chỉ có một panel.

**Perf** (median 3 lần, local): LCP desktop 3144 → 2864 ms, mobile 2600 → 2444 ms. CLS ≤ 0.0097. Màn đầu 6 ảnh, 1755 KB (không đổi).
Biên độ LCP giữa các lần đo lớn (ảnh hero 837 KB từ CDN). Một vòng trước đo được 3172 ms. Kết luận đúng là "LCP không xấu đi", không phải "LCP nhanh hơn".

**Sửa sau review (fresh-eyes chưa chấm lại, `iter8` là code cuối):**
- Mobile: mask của dải chip làm card lộ qua mép phải khi dải đã dính. Thay mask bằng lớp phủ fade.
- Monogram 2 chữ cho tên 1 từ viết hoa giữa ("GameK" → "GK").
- Fallback tile phẳng (bỏ gradient, đúng guideline). Ảnh có hairline mỏng.
- Ngày trống ẩn nút "Đánh dấu đã đọc". Subtitle tuần lưu trữ không lặp lại tiêu đề.

**Còn lại (chưa làm):** 2 fallback tile giống nhau khi cùng nguồn + cùng topic nằm cạnh nhau ("Tinhte"); hàng cuối 2 card ở grid 3 cột vẫn hở 1 ô; reveal bắt đầu từ board trống (không crossfade).

## Phases
| # | Phase | Trạng thái | File |
|---|-------|-----------|------|
| 0 | Baseline số đo (LCP, CLS, byte ảnh, metrics 13 view) | ☑ | [phase-00](phase-00-baseline-evidence.md) |
| 1 | Ảnh + họ card: hiện ảnh có sẵn, scrim, tỉ lệ, fallback | ☑ | [phase-01](phase-01-imagery-card-family.md) |
| 2 | Bố cục + UX: sticky band, section, mobile, copy, empty state, reader | ☑ | [phase-02](phase-02-composition-ux.md) |
| 3 | State tương tác + motion | ☑ | [phase-03](phase-03-interaction-motion.md) |
| 4 | Brand + theme | ☑ | [phase-04](phase-04-brand-theme.md) |
| 5 | Verify cuối + fresh-eyes review lần 2 | ☑ | [phase-05](phase-05-verify-rescore.md) |

## Dependencies
- Phase 0 trước tất cả (cần số before).
- Phase 1 trước Phase 2 và 3 (bố cục và hover phụ thuộc hình dạng card mới).
- Phase 4 độc lập với 2–3 về file logic, nhưng cùng sửa `styles.css` → làm tuần tự, không song song.
- Phase 5 sau cùng.

## Hợp đồng verify (mọi phase)
1. Chụp lại đúng 13 state bằng `agent-browser` (danh sách ở phase-00). Đóng browser sau khi chụp.
2. Chạy `metrics.py` trên cả 13 ảnh.
3. Chấm lại category mà phase nhắm tới.
4. Ghi LCP, CLS, byte ảnh cho view hôm nay (desktop + mobile).
5. Kiểm tra không vỡ guideline: không overflow ngang ở 390–2560px, thứ tự editorial giữ nguyên, reader đóng khi load.

**Cổng thoát cuối:** view cuộn desktop + mobile có entropy > 3.0, dominant < 0.6, contrast > 60.
Không category < 2. Trung bình ≥ 2.3. Không còn automatic failure.

## Rủi ro chính
- **Nhiều ảnh hơn → tải nặng hơn.** 21 ảnh thay vì 6. Giảm bằng `loading="lazy"` (đã có), `width`/`height` cố định để CLS = 0, budget byte ảnh ở Phase 0.
- **Ảnh CDN báo lỗi 403/hotlink.** `onerror` fallback đã có; fallback mới phải cùng tỉ lệ để không lệch hàng.
- **Crop ảnh xấu** (chart, banner quảng cáo). `object-position` ưu tiên phía trên; chấp nhận một số crop kém.
- **Spec Playwright vỡ** khi đổi layout. Xem D5.
- **Cache GH Pages.** Bump `?v=` cho `styles.css`, `renderers.js`, `view-builder.js` mỗi lần sửa.

## Không làm (YAGNI)
- Không WebGL, 3D, particle, glow/neon (guideline + Core Rule của skill).
- Không tự host/resize/proxy ảnh.
- Không đổi schema `cards.json`, không đổi pipeline Python.
- Không sửa lỗ dữ liệu 23–25/10 (3 ngày 0 tin) trong plan này. Đây là việc điều tra pipeline riêng.
