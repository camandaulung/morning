# Home page graphic pass (AAA-adapted scorecard ≥ 2.2)

Status: implemented — blind-review target not met (see Results) · Mode: fast · Owner: Claude · Date: 2026-11-09

## Why

`threejs-aaa-graphics-builder` scorecard, adapted to a 2D news home page, rated the
current home **1.3 / 3**. Above the fold is fine (real hero photo, serif headline);
everything below the fold collapses into a flat, repeated text-card wall:

- 36 stories, 25 have images, but only 6 visuals render (hero/primary/secondary).
- `desktop-scrolled` metrics: entropy 1.42 bits, dominant colour 84 %, contrast 30 →
  sparse/flat by the skill's own thresholds (<3.0 / >0.6).
- One material (white card + shadow), no motion beyond hover shadow, chips are bare text,
  brand mark is a letter "C", read state is a colour shift only.

## Category mapping (3D scorecard → news home)

| Scorecard category | Home-page surface |
|---|---|
| Art direction | Editorial identity: masthead, brand mark, typography, palette |
| Hero/player | Hero story card |
| Obstacles/enemies | Card family (primary / secondary / headline / compact) variety |
| Rewards/interactables | Chips, story actions, read/selected/hot states |
| World/environment | Page depth & below-the-fold density/rhythm |
| Materials/textures | Surface system: elevation, hairlines, paper grain, image grading |
| Lighting/render | Contrast, scrims, light/dark parity |
| VFX/motion | Entrance, hover, state-change feedback (reduced-motion safe) |
| UI/HUD | Topbar, archive rail, filter strip, section headers |
| Performance evidence | Pixel metrics, DOM/img counts, overflow, console errors, tests |

## Constraints (from `docs/design-guidelines.md`)

No emoji icons, neon, decorative gradients, invented metrics. Ranking order unchanged.
Teal = action, warm = hot only. Reader stays a right sheet. No horizontal overflow.
`npm run test:ui` + `npm run test:dist` must pass. Respect `prefers-reduced-motion`.

## Phases

1. **Identity + materials** (`styles.css`, `index.html`)
   - Elevation tokens `--elev-1/2/3`, inset hairline highlight, paper grain on canvas.
   - SVG fish brand mark (Cá Mặn) replaces the "C" letter.
   - Image grading + hero vignette; refined dark tokens.
2. **Card family** (`renderers.js`, `styles.css`)
   - Headline rows: rank numerals `01–04` + 72 px thumbnail when image exists.
   - Compact cards: 16:9 lazy thumbnail when image exists, topic colour rule otherwise.
   - "Hot" stories get a warm tag; read state adds a check pill (not colour only).
3. **Interactables + UI chrome** (`view-builder.js`, `styles.css`)
   - Topic chips with topic-colour dot; active chip = filled ink.
   - Masthead stats derived from data (stories · topics · sources) — no invented numbers.
   - Section headings with numbered eyebrow + hairline rule; rail active indicator bar.
4. **Motion** (`styles.css`)
   - Staggered fade-up entrance on dashboard render, hover lift + image zoom,
     arrow nudge, read-pill pop. All disabled under reduced motion.
5. **Verify**
   - Re-capture 8 states (desktop/mobile, light/dark, scrolled, reader) with pixel metrics.
   - Fresh-eyes subagent scoring; take the lower score per category.
   - `npm run test:ui`, `npm run test:dist`.

## Success criteria

- Average ≥ 2.2 after reconciliation; no category below 2 except where justified.
- `desktop-scrolled` entropy > 3.0, dominant share < 0.6.
- No overflow, no new console errors, tests green.

## Results (2026-11-09)

Builder self-score: 1.3 → ~2.4. Blind fresh-eyes reviews (subagent sees only screenshots,
scorecard, metrics; lower score wins per the skill):

| Pass | Change | Blind avg |
|---|---|---|
| 1 | Identity, materials, card family, chips, masthead ledger, motion | 1.95 |
| 2 | Mobile masthead, photo-label pills, read/hover captures | 2.10 |
| 3 | Hero badge + scrim, read photo dim, row hover bar, dark surfaces | 1.95 |
| 4 | Condensed masthead on scroll, inset "Điểm nhanh" band, row read label | 2.10 |
| 5 | Unread-count bug fix, label nowrap, motion filmstrip | 1.90 |

Plateau ≈ 2.0 (reviewer spread ±0.1). Every reviewer holds the same three below-2 points:
below-the-fold depth (one card tier on grey), surfaces (single elevation, grain invisible),
motion (hover delta too subtle in stills). Lifting those past 2 needs changes this plan
scoped out under `docs/design-guidelines.md` (no decorative gradients, calm utility):
section-level background bands / full-bleed features, a second card tier with real
material contrast, and stronger hover motion.

Measured: desktop-scrolled entropy 1.42→3.33, dominant colour 0.84→0.46, contrast 30→219.
DOM 607→795 nodes, 25 photos rendered (was 6), 0 console errors, no overflow.
Tests: 27/27 UI + production smoke pass.
