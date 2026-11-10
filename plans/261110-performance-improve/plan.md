# Performance review + plan cải thiện

Ngày: 2026-11-10 · Nhánh đo: `feat/home-graphic-pass` (`cards.json` mới nhất trong nhánh: 2026-10-26, 30 card, 910 tin)

## Kết luận nhanh

Hệ thống nhỏ và phần lớn đã ổn. Chỉ có **2 chỗ đáng làm**: payload dữ liệu của web (tải gấp ~17 lần mức cần) và pha fetch tuần tự của pipeline. Phần render phía client và CSS/JS **không phải** điểm nghẽn.

## Số đo

| Hạng mục | Kết quả | Cách đo |
|---|---|---|
| `cards.json` | 985 KB raw / 292 KB gzip | đo file |
| Card hôm nay (thứ trang chủ cần) | 35 KB / 17 KB gzip | đo file |
| 7 ngày gần nhất | 86 KB / 36 KB gzip | đo file |
| Trường `detail` | 336 KB (34% file) | đo file |
| JS + CSS + HTML | ~27 KB gzip tổng | đo file |
| `JSON.parse` cards.json | 1.8 ms | node, máy desktop |
| Render lại feed (`applyFeedFilter`) | 2.8 ms (ngày) / 3.9 ms (tuần) | đo trong browser, dev server |
| localStorage đang dùng | 805 KB / ~5 MB quota | đo trong browser |
| Fetch 29 RSS feed | 6.9 s tuần tự → 1.2 s song song (12 thread) | chạy thật từ máy local |
| Bot: tokenise 910 tin cho RAG | 54 ms / lượt | node, máy desktop |
| Lịch sử git của `cards.json` | 10.8 MB / 339 commit (gần hết pack 10.1 MB) | `git cat-file` |

Chưa đo được: thời gian chạy thật của job CI (máy không có `gh`), thời gian 26 query Jina (không có key local), dung lượng thumbnail (ảnh lazy không tải khi pane ẩn).

## Findings

### Web
- **W1 (cao)** — Lần vào đầu và mỗi lần dữ liệu đổi (2 lần/ngày), trang tải cả 30 ngày (292 KB gzip) để hiện 1 ngày (17 KB gzip). `router-init.js:368`.
- **W2 (trung bình)** — Google Fonts chặn render: 2 family, 7 weight, thêm 2 kết nối. `index.html:11`.
- **W3 (thấp)** — `_headers` không có tác dụng: site chạy trên GitHub Pages (`bot/wrangler.toml` trỏ `camandaulung.github.io/morning`), mọi file cache 10 phút, JS/CSS dựa vào `?v=` sửa tay. Bản build Vite (CSS có hash) không được deploy.
- **W4 (thấp)** — `weekly.json`/`monthly.json` chỉ bắt đầu tải sau khi `cards.json` xong. `router-init.js:375`.
- **Không cần sửa** — Search không debounce và render lại toàn bộ feed mỗi phím: chỉ 3–4 ms.

### Pipeline
- **P1 (cao)** — Fetch hoàn toàn tuần tự: 9 topic × (26 query Jina timeout 15 s + 29 RSS + 5 query GitHub). `card_pipeline.py:66`, `jina_fetch.py:57`, `rss_fetch.py:169`. Xấu nhất 26 × 15 s = 6.5 phút chỉ riêng Jina.
- **P2 (ghi nhận)** — LLM bị giới hạn 8 RPM nên 9 topic mất tối thiểu ~60 s; nhánh lỗi ngủ 15–65 s mỗi lần retry. Đây là đánh đổi có chủ đích cho free tier — không đổi, trừ khi lên paid thì tăng `GEMINI_RPM`.
- **P3 (thấp)** — CI `pip install google-genai` không cache ở cả 3 job. `morning.yml:48`.
- **P4 (thấp, tăng dần)** — Mỗi commit ghi lại nguyên file ~1 MB → repo phình ~32 KB/commit.
- **P5** — Pipeline không log thời gian từng bước, nên không biết bước nào chậm trên CI.

### Bot
- **B1 (trung bình)** — Mỗi tin nhắn chat: tải + parse 4 file JSON (1.1 MB), rồi tokenise cả kho; lặp lại cho mỗi lần agent gọi `search_news`. `chat-handler.ts:19`, `rag.ts:88`. 54 ms/lượt trên desktop; Workers free giới hạn CPU 10 ms/request — chưa xác minh bot đang ở plan nào.
- Độ trễ còn lại là do Gemini (tối đa 5 lượt gọi nối tiếp) — không tối ưu được nhiều.

## Plan

### Phase 1 — Tách dữ liệu "mới nhất" khỏi kho 30 ngày (W1, W4, một phần P4)
1. `card_pipeline.write_cards_file` ghi thêm `latest.json` = 7 card mới nhất, minified. Giữ nguyên `cards.json` (bot và rollup tuần/tháng vẫn dùng).
2. `morning.yml`: `git add cards.json latest.json` ở job morning + evening.
3. `router-init.js`: paint từ `latest.json`; tải `cards.json` nền (idle) rồi mới dựng kho tuần cũ; `weekly`/`monthly` tải song song ngay từ đầu.
4. Chỉ cache `latest.json` vào localStorage (bỏ bản 800 KB).
5. Test: thêm pytest cho `latest.json`; Playwright kiểm tra trang chủ không chờ `cards.json`.

Kỳ vọng: dữ liệu cho first paint 292 KB → ~36 KB gzip (−88%).

### Phase 2 — Pipeline: fetch song song + đo thời gian (P1, P3, P5)
1. `fetch_contexts`: ThreadPool theo topic; trong topic, gộp query Jina + RSS + GitHub vào pool (giới hạn 4 luồng cho Jina, 3 cho GitHub để không dính rate limit). Giữ thứ tự kết quả để prompt ổn định.
2. Log thời gian từng bước (fetch / LLM / validate / tổng) ra job log.
3. `morning.yml`: thêm `requirements.txt` + `cache: pip`.

Kỳ vọng: pha fetch còn bằng request chậm nhất của mỗi nguồn; RSS đã đo 6.9 s → 1.2 s.

### Phase 3 — Bot: không parse/tokenise lại mỗi tin nhắn (B1)
1. `digest.ts`: memo kết quả `loadDigest` ở biến module theo TTL 5 phút (isolate tái dùng giữa các request).
2. `rag.ts`: cache bộ token của từng item cùng vòng đời với memo trên.
3. Kiểm tra CPU time thật trên dashboard Workers trước/sau.

### Phase 4 — Tuỳ chọn, lợi ích nhỏ (W2, W3)
- Self-host 2 font đã subset tiếng Việt + `preload`, bỏ Google Fonts.
- Deploy `dist/` (tên file có hash) thay cho file gốc, bỏ `?v=` sửa tay; xoá `_headers` hoặc ghi rõ là không dùng.

## Thứ tự đề xuất
Phase 1 → Phase 2 → Phase 3. Phase 4 chỉ làm nếu còn thời gian.

## Trạng thái (2026-11-10)

| Phase | Trạng thái | Kết quả đo |
|---|---|---|
| 1 — `latest.json` | Xong | Dữ liệu chặn first paint: 985 KB → 101 KB raw (~292 → ~36 KB gzip). `cards.json` bắt đầu tải ở ~1 s, lúc trang đã hiện. localStorage 805 KB → 156 KB |
| 2 — Fetch song song, timing, cache pip | Xong | `fetch_contexts` thật với 29 RSS + 5 query GitHub: 2.0 s (trước đó riêng RSS tuần tự đã 6.9 s). Jina chưa đo (không có key local) |
| 3 — Bot memo | Xong | Có test; CPU time thật trên Workers chưa đo |
| 4 — Font | Làm một phần | Stylesheet Google Fonts không còn chặn render |

Khác với plan ban đầu:
- **Không self-host font.** Trên GitHub Pages mọi file chỉ cache 10 phút, trong khi font từ `fonts.gstatic.com` cache 1 năm — tự host sẽ làm lượt truy cập lại chậm hơn. Thay vào đó stylesheet font được tải không chặn render.
- **Chưa deploy `dist/`.** Cần đổi nguồn GitHub Pages sang "GitHub Actions" trong Settings của repo và thêm workflow build chạy sau mỗi commit dữ liệu — thay đổi cách deploy site đang chạy, để chủ repo quyết định.

Kiểm thử: pytest 198 pass · vitest 100 pass · Playwright UI 29 pass + smoke bản build 1 pass (chạy bằng Chrome cài sẵn vì thiếu bản Chromium đúng phiên bản của Playwright trong repo).

Chưa kiểm chứng: workflow CI sau khi sửa (cache pip, `git add latest.json`) chưa chạy thật trên GitHub Actions.
