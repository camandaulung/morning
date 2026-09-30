# Remote Solo Studio — mổ xẻ mô hình studio game một người, vận hành từ xa

> Tài liệu phân tích nội bộ. Cập nhật: 2026-09-30.
> Mục tiêu: trả lời câu hỏi "một người, làm từ xa, có dựng nổi một studio game sống được không — và nếu có thì dựng thế nào".
> Nguyên tắc viết: số nào là **báo cáo chính thức** thì ghi rõ, số nào là **ước lượng** (SteamSpy-style, suy từ review count) thì ghi rõ là ước lượng. Không trộn hai loại.

---

## 0. TL;DR

- **Mô hình khả thi về kỹ thuật, tàn khốc về phân phối.** Năm 2025 có **20.003 game** phát hành trên Steam; **9.327 game (~47%)** không đạt nổi 10 review, **2.229 game có 0 review** ([SteamDB](https://steamdb.info/stats/releases/), [80.lv](https://80.lv/articles/steam-earned-usd16b-in-2025-but-nearly-half-of-19-000-games-got-under-10-reviews)). Rào cản không phải "làm được game" — làm được game giờ là chuyện dễ nhất trong chuỗi.
- **Kỳ vọng trung vị phải đặt rất thấp:** game indie trung vị bán **500–2.000 bản**, doanh thu gross **$5k–15k** cả đời ([steampageanalyzer](https://www.steampageanalyzer.com/blog/indie-game-sales-statistics)). VG Insights phân tầng: nhóm "Hobby" (1–2 người) ≈ **$50k lifetime**; và tầng Triple-I (50+ người) **một mình hút 53% toàn bộ doanh thu indie 2024** ([VoxBooster tổng hợp](https://voxbooster.com/blog/indie-game-statistics-2026/)).
- **Nhưng outlier là thật, và có pattern lặp lại.** Megabonk (solo) bán **1 triệu bản trong 2 tuần** và đạt **117.336 CCU**, vượt đỉnh all-time của Hades II ([GamesRadar](https://www.gamesradar.com/games/roguelike/out-of-nowhere-roguelike-hit-megabonk-has-sold-1-million-copies-in-2-weeks-solo-creator-says-ill-be-eating-spaghetti-with-extra-sauce-tonight/), [Notebookcheck](https://www.notebookcheck.net/Megabonk-beats-Hades-2-s-all-time-record-as-it-morphs-into-Steam-s-new-indie-sensation.1136297.0.html)). Pattern có thể học được — xem §2.
- **Khuyến nghị ngắn:** solo studio chỉ nên đánh vào **game hệ thống (systemic), replay cao, chi phí content thấp, art style tự-phòng-vệ, giá $5–15**. Mọi thứ khác (handcrafted narrative, AAA fidelity, live-service) là bẫy chết người cho bus factor = 1.

---

## 1. Toán học thật của mô hình (đọc phần này trước khi mơ)

| Chỉ số | Con số | Nguồn |
|---|---|---|
| Game phát hành Steam 2025 | 20.003 (2024: 18.556) — trung bình **1 game / 30 phút** | [SteamDB](https://steamdb.info/stats/releases/) |
| Trong đó < 10 review | 9.327 (~47%) | [TechSpot](https://www.techspot.com/news/110592-nearly-half-19000-games-released-steam-year-went.html) |
| Trong đó 0 review | 2.229 | [80.lv](https://80.lv/articles/steam-earned-usd16b-in-2025-but-nearly-half-of-19-000-games-got-under-10-reviews) |
| Doanh thu indie trung vị (lifetime, gross) | $5k–15k → về tay dev ~$3,5k–10,5k sau 30% Steam | [steampageanalyzer](https://www.steampageanalyzer.com/blog/indie-game-revenue-data) |
| Số bản bán trung vị | 500–2.000 | [steampageanalyzer](https://www.steampageanalyzer.com/blog/indie-game-sales-statistics) |
| ~50% game indie | kiếm **dưới $5k** cả đời | [steampageanalyzer](https://www.steampageanalyzer.com/blog/indie-game-revenue-data) |
| Chi phí dev điển hình game đầu | $30k–60k | [steampageanalyzer](https://www.steampageanalyzer.com/blog/how-much-do-indie-game-developers-make) |
| Solo dev tự bỏ tiền | **~86%** | [GDC 2026 State of the Game Industry](https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/) |

**Đọc bảng này ra thành một câu:** game đầu tiên của một solo studio, theo trung vị, **là học phí — không phải thu nhập**. Chi $30–60k, thu $5–15k. Ai nói khác là đang bán khoá học.

**Và nguồn cung đang tăng vọt.** GDC 2026 SOTI (n > 2.300): **28% người trong ngành bị layoff trong 2 năm qua** (Mỹ: **33%**), **một nửa** nói công ty hiện tại/gần nhất đã cắt người trong 12 tháng, **2/3** ở studio AAA ([GDC](https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/)). Mỗi đợt layoff đẩy thêm một lứa veteran vào ô "solo dev". Đối thủ của đại ka năm 2026 không phải sinh viên — là ex-lead 15 năm kinh nghiệm vừa mất việc.

---

## 2. Outlier: 5 case có số, và pattern rút ra được

| Game | Người | Kết quả | Loại số |
|---|---|---|---|
| **Balatro** (2024) | LocalThunk (solo code/design) + publisher **Playstack** | **5 triệu bản** trong < 1 năm; hoàn vốn **trong giờ đầu** mở bán; mobile **$9,3M net** | Công bố chính thức ([GameWorldObserver](https://gameworldobserver.com/2025/01/21/balatro-another-1-5-million-copies-total-5m-units)) |
| **Vampire Survivors** (2021→) | poncle / Luca Galante (bắt đầu lúc đang thất nghiệp) | ~**10,5 triệu bản**, ~**$32,9M net** (khoảng tin cậy $25,1M–45,5M) | **Ước lượng** từ review count ([VG Insights](https://app.sensortower.com/vgi/game/vampire-survivors)) |
| **Lethal Company** (2023) | Zeekerss, self-published | ~**10 triệu bản**, gross ~**$113,9M** | **Ước lượng** (Push to Talk, [Game Developer](https://www.gamedeveloper.com/business/lethal-company-sold-an-estimated-10-million-copies)) |
| **Animal Well** (2024) | Billy Basso — solo code + art + design, **engine tự viết**, **7 năm** | ~**1,2 triệu bản**, gross ~**$21,3M** | **Ước lượng** ([GameRevenueData](https://gamerevenuedata.com/games/animal-well/)); 7 năm & engine riêng là [công bố](https://www.gamedeveloper.com/design/why-animal-well-s-home-brewed-engine-was-key-to-its-success) |
| **Megabonk** (18/09/2025) | vedinad, solo, self-published | **1 triệu bản / 2 tuần**; **117.336 CCU** (05/10) vượt đỉnh Hades II (112.947) | 1M là dev công bố; CCU là SteamDB |

### Pattern lặp lại — đây là phần đáng tiền

1. **Loop hệ thống, không phải content thủ công.** Balatro, Vampire Survivors, Lethal Company, Megabonk đều là **systemic replay**: một bộ rule sinh ra vô hạn trận. Chi phí content/giờ chơi gần như bằng 0. Đây là đòn duy nhất mà một người đánh ngang được studio 50 người. Animal Well là ngoại lệ handcrafted — và phải trả bằng **7 năm đời người**.
2. **Art style tự phòng vệ.** PS1 low-poly (Megabonk), pixel/card (Balatro), sprite thô (Vampire Survivors). Không phải "tiết kiệm" — mà là **chọn một style mà một người có thể đạt 100% chất lượng dự kiến**. Art tệ thì chết; art tham vọng quá tay thì cũng chết, chậm hơn. Chọn cái đỉnh trần thấp nhưng chạm được trần.
3. **Hình dạng streamer.** Lethal Company (co-op hỗn loạn), Megabonk (số nhảy điên), Balatro (khoảnh khắc "vỡ game"). Cả bốn đều **tự tạo clip** mà không cần mua marketing. Với solo studio, viral shape **là** marketing budget.
4. **Giá thấp, không DLC nặng.** $5–15. Giảm ma sát mua, tăng hệ số lan truyền.
5. **Brutal nuance mà mọi bài "solo dev thành công" đều bỏ qua:** Balatro **có publisher** (Playstack) lo marketing, port, PR, giải thưởng. Megabonk và Lethal Company thì không. Đừng đọc Balatro như bằng chứng "solo tự làm tất" — nó là bằng chứng **"solo lo design + publisher lo phân phối"**, một mô hình khác hẳn, và đáng cân nhắc hơn cho người không thích làm marketing.

---

## 3. Kiến trúc một remote solo studio nên trông như thế nào

### 3.1 Vòng trong — KHÔNG outsource, không bao giờ

Đây là phần định nghĩa sản phẩm; giao ra ngoài là mất luôn sản phẩm:

- **Core loop design + tuning** (game feel, economy, curve)
- **Code gameplay lõi**
- **Build & release pipeline** (tự bấm được nút ship lúc 2h sáng)
- **Quyết định cắt tính năng** — năng lực quan trọng nhất của solo dev. Billy Basso **cắt hơn 500 encounter** để giữ lại 256 trong Animal Well ([GamesRadar](https://www.gamesradar.com/games/platformer/solo-dev-behind-breakout-metroidvania-hit-animal-well-says-his-game-has-256-encounters-but-he-had-to-cut-at-least-500-of-them-during-development/)). Tỉ lệ cắt ~2:1. Đó là mức bình thường, không phải thất bại.

### 3.2 Vòng ngoài — thuê theo milestone, async, trả theo deliverable

Art polish · nhạc/SFX · port console · localization · QA · capsule art & trailer.

**Lưu ý chi phí:** rate outsource/agency thường **2–3× chi phí tương đương lương**, vì đã gánh overhead, thuế, PM, QA và margin ([GameDevOutsourcing](https://www.gamedevoutsourcing.com/answers/outsourcing-for-indie-studios)). Đừng lấy lương nhân viên rồi nhân với số giờ để estimate — sai 2–3 lần.

**Ba tiêu chí duy nhất khi chọn đối tác** (cùng nguồn): (1) portfolio **đã ship, đúng genre**; (2) engagement model có **milestone validation** thật; (3) **IP ownership viết rõ trong hợp đồng trước ngày làm việc đầu tiên**. Điều (3) là chỗ solo dev chết nhiều nhất — không có phòng pháp chế đứng sau.

### 3.3 Ngân sách khung

| Mức | Con số | Ghi chú |
|---|---|---|
| Solo tối giản (tool + asset + thời gian) | **$5k–15k** | [vsquad.art](https://vsquad.art/blog/articles/indie-game-budgets-what-it-really-costs-to-build-a-game/) |
| Solo có outsource từng phần | **$10k–50k** | cùng nguồn |
| Indie có team 2025 | **$25k–300k** | [SDLC Corp](https://sdlccorp.com/post/indie-game-development-cost/) |

Cộng thêm phần luôn bị quên: **$100 Steam Direct/game**, thuế nhà thầu, phí thanh toán quốc tế, phí platform 30%, và **runway sinh hoạt của chính mình** — cái đắt nhất trong bảng.

---

## 4. Rào cản thật: discoverability, không phải code

- **Ngưỡng cần nhớ: ~7.000 wishlist tích trong một cửa sổ thời gian ngắn** để lọt **Popular Upcoming** của Steam ([Chris Zukowski / How To Market A Game](https://howtomarketagame.com/2025/01/27/do-wishlists-get-old/), [presskit.gg](https://presskit.gg/field-guides/how-many-wishlists-to-launch)). "Tích trong cửa sổ ngắn" quan trọng hơn con số tuyệt đối — 7.000 wishlist gom trong 3 năm không có tác dụng như 7.000 trong 3 tuần.
- **Hệ quả cho solo studio:** phải mở Steam page **sớm**, rồi coi việc nuôi wishlist là một task định kỳ ngang với code — không phải việc làm 2 tuần trước launch.
- **Và publisher cũng đòi đúng thứ đó:** publisher muốn thấy đại ka **tự marketing được** trước khi họ bỏ tiền ([presskit.gg](https://presskit.gg/field-guides/how-to-build-steam-wishlist)). Nghịch lý: muốn có publisher thì phải chứng minh mình không cần publisher.

---

## 5. Rủi ro riêng của mô hình remote solo (phần không ai muốn viết)

1. **Bus factor = 1.** Ốm một tháng = studio dừng một tháng. Không có ai cover. Không có ai review design của đại ka. Cái sai trong core loop sẽ sống tới ngày launch.
2. **Thang thời gian dễ trượt sang nhiều năm.** Animal Well: **7 năm**. Nếu kế hoạch là 12 tháng, hãy chuẩn bị tài chính cho 24–30, hoặc thu nhỏ scope tới mức 6 tháng là xong thật.
3. **Không có đồng nghiệp = không có hiệu chuẩn.** Đây là lý do **playtest bên ngoài sớm và thường xuyên** không phải "nice to have" mà là hệ thống thay thế cho cả một team QA + design review.
4. **Rủi ro cộng đồng khi dùng genAI.** **52%** người trong ngành cho rằng generative AI đang có **tác động xấu** — tăng từ 30% năm trước và 18% năm trước nữa ([GDC 2026 SOTI](https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/)). Xu hướng đang **dốc lên**, không phẳng. Nghĩa là: dùng AI cho tooling/pipeline nội bộ thì bình thường; dùng AI cho **asset ship ra ngoài** là rủi ro PR thật, và rủi ro đó **đang tăng theo thời gian**, không giảm.
5. **Thu nhập thực tế.** Phần lớn indie dev kiếm **dưới $20k/năm** từ game ([steampageanalyzer](https://www.steampageanalyzer.com/blog/how-much-do-indie-game-developers-make)). Mô hình chỉ bền nếu có **một trong ba**: tiết kiệm đủ runway, việc làm thêm, hoặc chi phí sinh hoạt thấp. Với dev ở Việt Nam, điểm thứ ba là lợi thế cấu trúc thật — cùng một mức doanh thu "thất bại" ở Bắc Mỹ có thể là đủ sống ở đây. Đây là lợi thế địa lý đáng khai thác một cách tỉnh táo.

---

## 6. Checklist go / no-go trước khi bỏ việc

Đánh 1 điểm mỗi câu trả lời "có":

- [ ] Core loop **hệ thống** (rule sinh content), không phải content thủ công?
- [ ] Art style đã chọn là style mà **một mình đạt 100% chất lượng dự kiến**?
- [ ] Game **tự sinh clip** cho streamer/short-form mà không cần mua traffic?
- [ ] Scope ship được trong **≤ 9 tháng** ở nhịp làm việc thật (không phải nhịp lạc quan)?
- [ ] Có runway sinh hoạt **≥ 18 tháng** hoặc thu nhập song song?
- [ ] Steam page mở **sớm** + có kế hoạch định kỳ nuôi wishlist tới **~7.000 trong cửa sổ ngắn**?
- [ ] Có **≥ 5 playtester ngoài** sẽ chơi bản build hàng tháng?
- [ ] Mọi outsource đều có **hợp đồng ghi rõ IP** trước ngày làm đầu tiên?
- [ ] Đã chấp nhận về mặt tài chính rằng kết quả trung vị là **$5k–15k**?

**≤ 5 điểm:** chưa phải lúc — làm prototype tiếp, giữ việc.
**6–7:** khả thi, nhưng phải thu scope lại.
**8–9:** đi được. Và vẫn nên giữ 18 tháng runway.

---

## 7. Nguồn

**Dữ liệu ngành & thị trường**
- [SteamDB — Game Release Summary by Year](https://steamdb.info/stats/releases/)
- [80.lv — Steam 2025: $16B+, gần một nửa 19.000 game dưới 10 review](https://80.lv/articles/steam-earned-usd16b-in-2025-but-nearly-half-of-19-000-games-got-under-10-reviews)
- [TechSpot — Nearly half of 19,000 Steam games went unnoticed](https://www.techspot.com/news/110592-nearly-half-19000-games-released-steam-year-went.html)
- [GDC — 2026 State of the Game Industry](https://gdconf.com/article/gdc-2026-state-of-the-game-industry-reveals-impact-of-layoffs-generative-ai-and-more/) · [bản PDF qua InvestGame](https://investgame.net/news/pdf/2026-01-29-dec052f4_d88e_48ce_9f83_a18ce2f2a6e5_541400_gdc26_pdf_soti_report/)
- [VoxBooster — Indie Game Statistics 2026 (tổng hợp, có số VG Insights)](https://voxbooster.com/blog/indie-game-statistics-2026/)
- [Steam Page Analyzer — Indie revenue / sales / income data](https://www.steampageanalyzer.com/blog/indie-game-revenue-data)

**Case study**
- [Game World Observer — Balatro vượt 5 triệu bản](https://gameworldobserver.com/2025/01/21/balatro-another-1-5-million-copies-total-5m-units)
- [Game Developer — Balatro 250k bản trong 3 ngày](https://www.gamedeveloper.com/business/localthunk-s-balatro-sells-250-000-copies-in-first-three-days)
- [VG Insights — Vampire Survivors Steam stats (ước lượng)](https://app.sensortower.com/vgi/game/vampire-survivors)
- [Game Developer — Lethal Company ~10 triệu bản (ước lượng)](https://www.gamedeveloper.com/business/lethal-company-sold-an-estimated-10-million-copies)
- [Game Developer — Animal Well & engine tự viết](https://www.gamedeveloper.com/design/why-animal-well-s-home-brewed-engine-was-key-to-its-success) · [GamesRadar — cắt 500+ encounter](https://www.gamesradar.com/games/platformer/solo-dev-behind-breakout-metroidvania-hit-animal-well-says-his-game-has-256-encounters-but-he-had-to-cut-at-least-500-of-them-during-development/)
- [GamesRadar — Megabonk 1 triệu bản / 2 tuần](https://www.gamesradar.com/games/roguelike/out-of-nowhere-roguelike-hit-megabonk-has-sold-1-million-copies-in-2-weeks-solo-creator-says-ill-be-eating-spaghetti-with-extra-sauce-tonight/) · [Notebookcheck — 117.336 CCU vượt Hades II](https://www.notebookcheck.net/Megabonk-beats-Hades-2-s-all-time-record-as-it-morphs-into-Steam-s-new-indie-sensation.1136297.0.html)

**Marketing & vận hành**
- [How To Market A Game (Chris Zukowski) — Do wishlists get old?](https://howtomarketagame.com/2025/01/27/do-wishlists-get-old/)
- [presskit.gg — How many wishlists to launch](https://presskit.gg/field-guides/how-many-wishlists-to-launch) · [How to build Steam wishlists](https://presskit.gg/field-guides/how-to-build-steam-wishlist)
- [GameDevOutsourcing — Outsourcing for indie studios (2026)](https://www.gamedevoutsourcing.com/answers/outsourcing-for-indie-studios)
- [vsquad.art — Indie game budgets 2026](https://vsquad.art/blog/articles/indie-game-budgets-what-it-really-costs-to-build-a-game/) · [SDLC Corp — Indie dev cost 2025](https://sdlccorp.com/post/indie-game-development-cost/)

---

### Ghi chú về độ tin cậy

Số bán của game Steam **hầu như không được công bố chính thức**. Trừ Balatro và Megabonk (dev/publisher tự công bố), các con số bản/doanh thu trong tài liệu này là **ước lượng suy từ review count** (phương pháp VG Insights / Push to Talk / SteamSpy), sai số có thể ±40%. Dùng để nhận diện **bậc độ lớn và pattern**, không dùng để lập kế hoạch tài chính. Các trang tổng hợp thống kê indie (steampageanalyzer, vsquad, SDLC, VoxBooster) là nguồn cấp hai — đã đối chiếu chéo khi con số trùng khớp, và đã ghi rõ khi chỉ có một nguồn.
