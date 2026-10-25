# Audit — scan/report lệch giờ + content rỗng

**Date:** 2026-10-25 · **Status:** Wave 1-4 done, chờ Anh nạp credit Gemini/Jina

## Root causes (4 lỗi độc lập, cùng biểu hiện "bot báo không đúng")

| # | Lỗi | Từ ngày | Hậu quả | Fix |
|---|---|---|---|---|
| R1 | `GH_DISPATCH_TOKEN` (PAT 90 ngày) hết hạn; dispatch 401 chỉ `console.error` | 10-13 | Chạy theo GH schedule trễ 3-5h; evening trễ qua 0h VN → no-op | Rotate PAT (Anh) + alert Telegram khi dispatch lỗi / token sắp hết |
| R2 | Gemini `402 RESOURCE_EXHAUSTED` (hết prepaid credit) | ~10-23 | Card 23-25/10 **0 tin**, workflow vẫn xanh, notify skip im lặng | Fallback OpenAI `gpt-4o-mini` + card rỗng → job fail + watchdog 22h |
| R3 | gamek.vn RSS bỏ hoang (tin mới nhất 23/08) | ≥ 09-26 | Gaming 0 tin 26/27 ngày | Google News `site:gamek.vn when:7d` + 2 query game |
| R4 | 24h.com.vn trả 403 cho IP GitHub | từ khi thêm | Sports 0 tin 27/27 ngày | RSS thể thao vnexpress/tuoitre/thanhnien + Google News `site:24h.com.vn` |

Phụ: Jina Search `402 Payment Required` (26/26 call lỗi). Mọi topic giờ có RSS nên Jina là optional.

## Đã ship

- `bot/src/dispatch.ts` — `planDispatch()` bật `run_weekly` Chủ Nhật, `run_monthly` mùng 1 (VN date); `dispatchWorkflow()` trả `issues[]`, đọc header `github-authentication-token-expiration` cảnh báo trước 14 ngày
- `bot/src/cron-runner.ts` — dispatch + watchdog 22h (card sáng có lên site & có tin không) → Telegram owner
- `llm_client.py` (thay `gemini_client.py`) — Gemini → OpenAI fallback, dừng retry khi quota
- `generate_card.py` — card sáng 0 tin → `exit 1`, không ghi card rỗng
- `morning.yml` — `OPENAI_API_KEY` cho 3 step generate; guard weekly chạy trùng Chủ Nhật
- `config.json` — thay feed gaming/sports chết
- Tests: bot 90/90, Python 174/174

## Không phải bug (đã check)

- KV id placeholder trong `wrangler.toml`: CI inject từ secret `CF_KV_NAMESPACE_ID`
- Morning chạy trùng: đã có guard skip-if-card-has-items

## Content audit 30 ngày (26/09 → 25/10)

- URL: 915/915 tin có URL, HEAD sample 40/40 live, ảnh 84%
- Tin cũ >2 ngày so với card: 9/915 (1%), toàn ở topic trending
- `gamedev` 0 tin 18/27 ngày — chưa xử lý (GitHub API topic, cần trace riêng)

## Việc Anh cần làm

1. Nạp credit Gemini: https://ai.studio/projects (billing). Trong lúc chưa nạp, pipeline chạy bằng OpenAI.
2. (Optional) Nạp Jina hoặc bỏ `search_queries` để đỡ 26 call lỗi mỗi run.

## Unresolved

1. Alert đang gửi cho id đầu tiên trong `ALLOWED_CHAT_IDS` — đúng là Anh?
2. `gamedev` topic: trace tiếp hay tắt?
