# QuestLog — Locked Decisions

These are final. Never reverse, work around, or reinterpret any of these.

---

## Data

- `localStorage` key is `questlog_v1` — changing this silently loses all user data
- `today()` uses local time via `fmt(new Date())` — never switch to `.toISOString()`
- `BLANK()` state shape must be preserved — only addition allowed is `reflections: []`
- `db.js` is the only file that touches `localStorage` — no exceptions

## Logic — Never Change

- `reqForLevel(n)` XP curve formula
- `MULT` streak multiplier array: `[[30,2.0],[14,1.5],[7,1.25],[3,1.1]]`
- `SKILL_REQ = 150`, `SKILL_CAP = 10`
- `DIFF` XP values: Common=10, Rare=25, Epic=50, Legendary=100
- Crit probability: exactly 10% (`Math.random() < 0.10`)
- Daily quest XP: any=20, focus=40, hard=30
- Recommender gate: 3+ day skill streak required

## Colour Palette — Locked

```
--bg: #080B10
--xp1: #06B6D4
--xp2: #A855F7
--success: #00FF88
--streak: #F97316
--c-projects: #00FF88
--c-jobhunt: #FBBF24
--c-gradschool: #A855F7
--c-fitness: #EF4444
--c-nutrition: #06B6D4
--c-sleep: #38BDF8
--d-common: #4ADE80
--d-rare: #38BDF8
--d-epic: #A855F7
--d-legendary: #F59E0B
```

## Performance — Never Violate

- Animate only `transform` and `opacity`
- Never animate `height`, `width`, `top`, `left`, `margin`, `padding`, `box-shadow`
- No `backdrop-filter` on scrolling elements
- No `backdrop-filter` on nav pill — solid background only
- `transform: scaleX()` instead of animating `width`
- `transform: scaleY()` instead of animating `height`
- `transform: translateY()` for all slides

## Architecture

- Fully offline — localStorage only, no cloud, no external data
- Split files: index.html + styles.css + app.js + ai.js + db.js
- No build step — plain files, open directly in browser or WebView
- No external libraries — no Chart.js, no CDN imports, no npm
- All charts are hand-drawn SVG

## UI

- Four views only: Today, Skills, Map, Reflect
- FAB visible on Today only — hidden with `opacity:0; pointer-events:none` (never `display:none`)
- Nav is a floating pill, not a full-width bar
- No hero card — replaced by slim masthead
- Skills tab is a 2×3 tile grid, not a stacked list
- No swipe-to-delete on Done/Failed tasks — only active tasks
- Delete on active tasks requires confirmation

## Gamification

- No new mechanics beyond what is specified
- No shops, currencies, mystery boxes, achievements, leaderboards
- No wellness nudges or burnout alerts
- Mood check-in XP (+15) goes to totalXP only, not to any skill
- xpAwarded flag prevents double XP on reflection edit

## What the Agent Must Never Do

- Change DB_KEY
- Change XP formulas or level curves
- Change SKILLS array IDs or colours
- Change DIFF XP values
- Use display:none on FAB
- Animate layout properties
- Add backdrop-filter to scrolling elements
- Add external libraries or CDN imports
- Add new views or tabs beyond the four
- Add cloud sync
- Change the colour palette
- Collapse split files back to single file
- Remove Export / Import / Reset
