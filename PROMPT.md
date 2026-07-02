# QuestLog — Complete Build Prompt

You are building QuestLog v2 from scratch. The existing working app is in `index.html` in this folder. Read it completely before writing anything — it contains all the logic you must preserve exactly.

Your job: keep every single piece of logic from `index.html` intact, and produce a new version with a completely rebuilt visual layer, split file structure, and new features added on top.

Do not start writing code until you have read `index.html` end to end and confirmed you understand:
- The `BLANK()` state structure
- The `SKILLS` and `DIFF` constants
- The XP and level curve formulas
- The streak logic and multipliers
- The `completeTask()` function
- The `ensureQuests()` and `checkQuests()` functions
- The `recommendation()` and `suggestAITask()` functions
- The `renderAll()` call chain
- The `save()` / `load()` localStorage pattern
- The `today()` date function using local time

---

## Output File Structure

```
assets/
├── index.html     ← HTML structure only. Zero inline styles. Zero inline scripts.
├── styles.css     ← All CSS. All variables. All animations. All media queries.
├── app.js         ← All rendering, state, events, XP, streaks, quests, modals, FX.
├── ai.js          ← Rule-based recommender + OpenRouter stub.
└── db.js          ← All localStorage operations. Nothing else touches localStorage.
```

Rules:
- `index.html` contains only the HTML skeleton, one `<link rel="stylesheet" href="styles.css">` in `<head>`, and three script tags at the bottom of `<body>`: `<script src="db.js"></script><script src="ai.js"></script><script src="app.js"></script>`.
- Zero `style=""` attributes in HTML.
- Zero `<script>` blocks in HTML.
- `db.js` is the only file that reads or writes `localStorage`.
- `ai.js` never touches the DOM or localStorage.
- `app.js` calls `dbLoad()` on boot and `dbSave(S)` after every state change.

---

## Logic That Must Be Preserved Exactly

Copy these from `index.html` without any changes:

- `BLANK()` function and state shape — add `reflections: []` to it
- `SKILLS` array (all 6 skills, same IDs, icons, colours)
- `DIFF` object (Common/Rare/Epic/Legendary XP values)
- `LADDER` object (rule-based recommender rungs)
- `reqForLevel(n)` — XP curve formula
- `overallLevel()` — level calculation
- `skillLevel(id)` — per-skill level calculation
- `SKILL_REQ`, `SKILL_CAP` constants
- `MULT` array — streak multipliers
- `currentMultiplier()` — streak multiplier lookup
- `titleFor()` — title based on streak + level
- `ensureQuests()` — daily quest generation
- `checkQuests(task)` — quest completion checking
- `completeTask(id, ev)` — full completion logic including crit, streak, quest check, XP
- `recommendation(id)` — rule-based suggestion (3-day streak gate)
- `suggestAITask(id)` — OpenRouter stub
- `prefillTask(skill, title)` — pre-fill task modal
- `fmt(d)`, `today()`, `yesterdayOf(d)`, `daysBetween(a,b)` — local time date helpers
- `uid()`, `escapeHtml(s)` — utilities
- `flyXP(ev, amount)` — XP orb animation
- `toast(msg)` — toast notification
- `openTask()`, `saveTask()`, `buildDifSeg()`, `pickDif(k)`, `onSkillChange()` — task modal logic
- `projStage(id, n)`, `addProject()`, `delProject(id)` — project logic
- `funnel(k, n)` — funnel controls
- `exportData()`, `importData(ev)`, `hardReset()` — data management
- `firstRun()` — name prompt on first launch
- All `renderX()` functions — update their HTML output to match the new layout, but never change what data they read or how they compute values

The only changes allowed to existing logic:
1. Move all localStorage calls into `db.js`
2. Add `reflections: []` to `BLANK()`
3. Add `syncNative()` call after every task completion and on boot
4. Update render functions to output the new HTML structure described below

---

## Colour Palette — Locked

```css
:root {
  --bg:        #080B10;
  --panel:     rgba(255,255,255,0.03);
  --panel2:    rgba(255,255,255,0.06);
  --line:      rgba(255,255,255,0.07);
  --line2:     rgba(255,255,255,0.12);
  --text:      #E6EDF3;
  --muted:     rgba(255,255,255,0.25);
  --faint:     rgba(255,255,255,0.10);

  --c-projects:   #00FF88;
  --c-jobhunt:    #FBBF24;
  --c-gradschool: #A855F7;
  --c-fitness:    #EF4444;
  --c-nutrition:  #06B6D4;
  --c-sleep:      #38BDF8;

  --d-common:    #4ADE80;
  --d-rare:      #38BDF8;
  --d-epic:      #A855F7;
  --d-legendary: #F59E0B;

  --streak:   #F97316;
  --xp1:      #06B6D4;
  --xp2:      #A855F7;
  --success:  #00FF88;
}
```

Do not add, remove, or change any value.

---

## Global CSS Rules

```css
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif;
  background: #080B10;
  color: #E6EDF3;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  padding-bottom: 100px;
}

/* Two fixed ambient glows — never move, never animate */
body::before {
  content: '';
  position: fixed; inset: 0; pointer-events: none; z-index: 0;
  background:
    radial-gradient(ellipse 600px 400px at 15% 0%, rgba(168,85,247,0.13), transparent 70%),
    radial-gradient(ellipse 500px 300px at 85% 5%, rgba(6,182,212,0.10), transparent 70%);
}

.wrap {
  position: relative; z-index: 1;
  max-width: 390px; margin: 0 auto; padding: 0;
}

/* No scrollbars */
* { scrollbar-width: none; }
*::-webkit-scrollbar { display: none; }
```

---

## Performance Rules — Non-Negotiable

These apply to every animation in the entire app:

- Animate only `transform` and `opacity`. Never animate `height`, `width`, `top`, `left`, `margin`, `padding`, or `box-shadow` directly.
- Width animations → `transform: scaleX()` with `transform-origin: left`.
- Height animations → `transform: scaleY()` with `transform-origin: top`.
- Slide effects → `transform: translateY()` or `transform: translateX()`.
- Glow animations → `opacity` on a `::after` pseudo-element with a static `box-shadow`. Never animate the shadow itself.
- Add `will-change: transform` only to elements with persistent animations (FAB, nav pill). Remove after animation ends via JS.
- No `backdrop-filter` on any element that scrolls. Only on fixed-position elements — and even then prefer a solid dark background.
- No `backdrop-filter` on the nav pill — use solid `rgba(8,11,16,0.92)` instead.

---

## Layout — Four Views

The app has four views: `today`, `skills`, `map`, `reflect`. Each is a `<div class="view" id="view-today">` etc. Only one is visible at a time. The rest are `display: none` (managed by `goView()`).

View switch transition: outgoing fades to `opacity: 0; transform: translateY(4px)` over `0.2s ease`, incoming fades from `opacity: 0; transform: translateY(4px)` to natural state. Use `pointer-events: none` on outgoing during transition.

---

## XP Rail

```css
#xp-rail {
  position: fixed; top: 0; left: 0; right: 0;
  height: 2px; z-index: 20;
  background: rgba(255,255,255,0.05);
}
#xp-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--xp1), var(--xp2));
  transform-origin: left;
  transform: scaleX(0);
  transition: transform 0.6s cubic-bezier(0.2,0.8,0.2,1);
}
```

Update `#xp-fill` scale in `renderHero()` using `(o.into / o.need)` ratio. Never set `width` — only `transform: scaleX(ratio)`.

---

## Masthead

Replaces the hero card. No card background, no border, no glass.

```
padding: 24px 22px 0
display: flex; justify-content: space-between; align-items: center
```

Left side:
- Line 1: `S.name` — `0.62rem font-weight:700 letter-spacing:0.18em uppercase color:var(--muted)`
- Line 2: `Lv. N · [title]` — level number uses gradient text (background-clip), `0.82rem font-weight:800`. Title in plain `var(--muted)`.

Right side: streak badge — flame emoji, count in `1.1rem font-weight:800 color:var(--streak)`, label `"day streak"` in `0.48rem var(--streak) opacity:0.5`.

XP sub-line: below masthead, right-aligned. `N XP to Lv. N+1` — N in `var(--d-legendary)`, rest in `var(--muted)`, `0.6rem font-weight:700 letter-spacing:0.08em uppercase`. At max level: `MAX LEVEL` in `var(--success)`.

Margin below masthead area: `22px`.

---

## Quest Progress Bars

Replaces the daily quest cards. Three horizontal bars in a row.

```
display: flex; gap: 6px; padding: 0 22px; margin-bottom: 22px; align-items: center
```

Each bar: `flex:1; height:3px; border-radius:3px; background:rgba(255,255,255,0.08)`.
- Done bar: `background: rgba(0,255,136,0.5)` + shimmer via `::after` pseudo, `opacity` animation only.
- Active bar: `background: rgba(168,85,247,0.4)`.
- Pending: default.

Label right: `"Daily quests"` — `0.56rem var(--muted) letter-spacing:0.12em uppercase; margin-left:8px; white-space:nowrap`.

Tapping the bar row toggles a detail panel below showing quest titles and XP values. Panel uses `transform: scaleY(0→1); transform-origin: top`. Never animate `height`.

---

## Streak Warning Strip

Show only when: hour >= 18 local time AND `S.streak.current >= 3` AND `S.days[today()] === 0`.

```css
.warn-strip {
  border-left: 2px solid rgba(249,115,22,0.6);
  background: rgba(249,115,22,0.06);
  border-radius: 0 10px 10px 0;
  padding: 10px 14px;
  margin: 0 22px 18px;
  font-size: 0.70rem;
  color: var(--muted);
}
```

Text: `Skip today and your Nd streak resets.` — N is `S.streak.current` in `color:var(--streak) font-weight:800`.

Entrance: `transform: translateX(-8px)→translateX(0)` + `opacity 0→1`, `0.3s ease`. Remove from DOM on first task completion. No close button.

---

## Today Count Hero

```
padding: 0 22px; margin-bottom: 18px
```

Large number: `font-size:3.2rem; font-weight:800; line-height:0.9; letter-spacing:-0.03em`. Gradient text using `background: linear-gradient(120deg, #E6EDF3 30%, rgba(230,237,243,0.4)); -webkit-background-clip:text; background-clip:text; color:transparent`.

Label baseline-aligned right: `"quests left"` — `0.68rem var(--muted) letter-spacing:0.12em uppercase`.

Number change: `transform: scale(1.15→1)` + `opacity 0.6→1`, `0.25s ease`.

When zero active tasks: replace with `"✓ All clear."` in `var(--success)` same font size. Sub-line: `"Rest is part of the grind."` in `var(--muted) 0.7rem`. Entrance: `opacity 0→1 0.4s ease`.

Counts only tasks where `status === 'active'` and `due === today()`.

---

## Task Cards — Full Redesign

Remove the old `.task` card layout entirely.

Container: `padding: 0 22px`.

Each card is a swipe-enabled wrapper:

```html
<div class="task-wrap" data-id="[id]">
  <div class="task-delete-bg">🗑</div>
  <div class="task-card">
    <div class="task-bar" style="background:[skillColour]"></div>
    <div class="task-body">
      <div class="task-title">[title]</div>
      <div class="task-meta">
        <span style="color:[skillColour]">[skillName]</span>
        <span class="dot"></span>
        <span style="color:[diffColour]">[difficulty]</span>
        <span class="dot"></span>
        <span>+[xp] XP</span>
      </div>
    </div>
    [complete button — active tasks only]
  </div>
</div>
```

**CSS for task layout:**
```css
.task-wrap {
  position: relative;
  overflow: hidden;
  margin-bottom: 0;
}
.task-delete-bg {
  position: absolute; right: 0; top: 0; bottom: 0;
  width: 80px;
  background: rgba(239,68,68,0.15);
  display: flex; align-items: center; justify-content: center;
  color: #ef4444; font-size: 1.1rem;
}
.task-card {
  display: flex; align-items: center; gap: 14px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(255,255,255,0.05);
  background: var(--bg);
  position: relative;
  transform: translateX(0);
  transition: transform 0.25s ease;
  will-change: transform;
}
.task-wrap:last-child .task-card { border-bottom: none; }
.task-bar { width: 2px; height: 40px; border-radius: 2px; flex: none; }
.task-body { flex: 1; min-width: 0; }
.task-title {
  font-size: 0.88rem; font-weight: 800; margin-bottom: 5px;
  line-height: 1.2; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.task-meta {
  display: flex; align-items: center; gap: 5px;
  font-size: 0.60rem; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--muted);
}
.dot { width: 3px; height: 3px; border-radius: 50%; background: var(--faint); }
.task-chk {
  width: 30px; height: 30px; border-radius: 50%;
  border: 1.5px solid var(--line2); background: transparent;
  display: grid; place-items: center; flex: none;
  cursor: pointer; font-size: 13px; color: transparent;
  transition: border-color 0.18s, background 0.18s, color 0.18s, transform 0.18s;
}
.task-chk:hover { border-color: rgba(0,255,136,0.5); background: rgba(0,255,136,0.07); color: #00FF88; }
.task-chk.done { border-color: rgba(0,255,136,0.4); background: rgba(0,255,136,0.1); color: #00FF88; }
```

Done and Failed tasks: same card layout, `opacity: 0.32`, title `text-decoration: line-through`, no complete button.

### Swipe to Delete

Attach touch and mouse handlers to every `.task-wrap` for active tasks.

Logic:
- Track drag delta X via `touchstart`/`touchmove`/`touchend` and `mousedown`/`mousemove`/`mouseup`.
- While dragging left: `card.style.transform = translateX(${Math.min(0, delta)}px)`. Max drag: `-80px`.
- On release:
  - If `|delta| >= 60`: fire delete. Card animates to `translateX(-100%)` + `opacity: 0` over `0.3s`. Then wrapper collapses via `transform: scaleY(0); transform-origin: top` over `0.2s`. Remove from DOM after. Active tasks: confirm first.
  - If `|delta| < 60`: snap back to `translateX(0)` via CSS transition.
- Desktop fallback: no swipe. Show a `✕` button `position: absolute; right: 0; top: 50%; transform: translateY(-50%); opacity: 0` on the card. Card hover → `opacity: 0.3`. Button hover → `opacity: 1; color: #ef4444`. Click confirms (active) then deletes.

### Tick Completion Animation

Four steps — all `transform` and `opacity` only:

**Step 1 (0–80ms):** `.task-chk` border becomes `rgba(0,255,136,0.8)`. Background becomes `rgba(0,255,136,0.12)`.

**Step 2 (80–200ms):** Checkmark icon animates from `transform: scale(0) rotate(-10deg)` to `scale(1) rotate(0deg)`, `120ms cubic-bezier(0.2,0.9,0.3,1.2)` — slight overshoot.

**Step 3 (200–380ms):** `.task-chk` scales to `scale(1.15)` then back to `scale(1)`, `180ms ease-out`. `.task-bar::before` pseudo fades in via `opacity 0→1` (pseudo has static `box-shadow` glow in skill colour).

**Step 4 (380ms+):** XP orbs fire. Card wrapper `opacity → 0.32`, `transition: opacity 0.3s ease`. Title gains `text-decoration: line-through`.

**Crit variant:** Steps 1–3 use amber (`#F59E0B`) instead of green. Scale peaks at `1.25`. Float text becomes `⚡ CRIT! +N XP` in amber.

---

## FAB (Floating Action Button)

```css
#fab {
  position: fixed; bottom: 96px; right: 22px; z-index: 30;
  width: 52px; height: 52px; border-radius: 50%;
  background: linear-gradient(135deg, var(--xp1), var(--xp2));
  border: none; cursor: pointer;
  display: grid; place-items: center;
  font-size: 22px; color: white;
  will-change: transform;
  transition: transform 0.18s ease, opacity 0.18s ease;
}
#fab::after {
  content: '';
  position: absolute; inset: -4px; border-radius: 50%;
  background: inherit; opacity: 0.3;
  filter: blur(8px); z-index: -1;
}
#fab:hover { transform: scale(1.06); }
#fab:active { transform: scale(0.96); }
#fab.hidden { opacity: 0; pointer-events: none; transform: scale(0.8); }
```

Visible only on Today view. Add `.hidden` class on Skills, Map, Reflect views. Remove on Today. Never use `display:none`.

Opens task modal on click.

---

## Bottom Nav Pill

```css
#nav-wrap {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; justify-content: center;
  padding: 12px 0 28px; z-index: 40;
}
#nav-pill {
  display: flex; gap: 2px;
  background: rgba(8,11,16,0.92);
  border: 1px solid rgba(255,255,255,0.09);
  border-radius: 999px;
  padding: 5px 8px;
}
.nav-btn {
  display: flex; flex-direction: column; align-items: center; gap: 2px;
  padding: 8px 16px; border-radius: 999px;
  background: transparent; border: none;
  color: rgba(255,255,255,0.22);
  font-size: 0.48rem; letter-spacing: 0.12em;
  text-transform: uppercase; font-weight: 800;
  font-family: inherit; cursor: pointer;
  transition: color 0.18s ease, background 0.18s ease;
}
.nav-btn .ni { font-size: 17px; transition: filter 0.18s; }
.nav-btn.active { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.06); }
.nav-btn.active .ni { filter: drop-shadow(0 0 6px rgba(168,85,247,0.85)); }
```

Four buttons: Today (⚔️), Skills (⭐), Map (🗺️), Reflect (🌙).

Reflect button pulses its icon after 8 PM local time if today's check-in is not done: add class `.pulse` which animates `filter: drop-shadow` opacity `0.6→1`, `2s infinite`. Remove `.pulse` once check-in is submitted.

---

## Skills Tab — 2×3 Tile Grid

Replace stacked skill list with:

```css
#skill-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 0 22px;
}
.skill-tile {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 20px 16px 16px;
  display: flex; flex-direction: column; align-items: flex-start;
  position: relative; overflow: hidden; cursor: pointer;
  transition: background 0.18s ease, transform 0.15s ease;
  will-change: transform;
}
.skill-tile::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 1px;
  background: linear-gradient(90deg, transparent, var(--sc), transparent);
  opacity: 0.5;
}
.skill-tile:hover { background: rgba(255,255,255,0.06); transform: translateY(-1px); }
.skill-tile .s-icon { font-size: 1.5rem; margin-bottom: 10px; }
.skill-tile .s-name { font-size: 0.58rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; }
.skill-tile .s-lv { font-size: 1.3rem; font-weight: 800; margin-bottom: 10px; }
.skill-tile .s-bar { width: 100%; height: 2px; border-radius: 2px; background: rgba(255,255,255,0.07); }
.skill-tile .s-fill { height: 100%; border-radius: 2px; transform-origin: left; transform: scaleX(0); transition: transform 0.4s ease; }
.skill-tile .s-streak { position: absolute; top: 14px; right: 14px; font-size: 0.58rem; font-weight: 800; color: var(--streak); }
```

Each tile: pass `--sc: [skillColour]` as inline CSS variable for the `::before` gradient.

Tap → drill-down panel slides up over the skills grid: `transform: translateY(100%→0); transition: transform 0.25s cubic-bezier(0.2,0.9,0.3,1)`. Panel shows: skill name, XP bar full-width, streak count, `N XP to next level`, last 5 completed tasks in that skill, and the recommender box. Back button slides panel down `transform: translateY(0→100%)`. All recommender logic unchanged.

---

## Job Pipeline (Skills tab, below grid)

```css
#pipeline {
  margin: 18px 22px 0;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 18px;
  padding: 18px;
}
```

Label: `"Job Pipeline"` — `0.58rem font-weight:700 letter-spacing:0.16em uppercase var(--muted) margin-bottom:14px`.

Four cells `grid-template-columns: repeat(4,1fr)` — number `1.6rem font-weight:800 color:var(--c-jobhunt)`, label `0.50rem uppercase muted margin-top:4px`.

+/− buttons: `20px × 20px` ghost below each number. Keep existing `funnel(k,n)` logic.

Progress track below cells:
```css
.pipe-track { height: 3px; border-radius: 3px; background: rgba(255,255,255,0.06); margin-top: 14px; overflow: hidden; }
.pipe-fill { height: 100%; background: linear-gradient(90deg, #FBBF24, rgba(251,191,36,0.2)); transform-origin: left; transform: scaleX(0); transition: transform 0.5s ease; }
```
Fill ratio: `interviews / Math.max(applications, 1)`.

---

## Resume Projects (Skills tab, below pipeline)

Keep all existing project logic (`addProject`, `projStage`, `delProject`). Visual: same card style as current but matching new panel aesthetic. Each project card uses `var(--panel)` background, `var(--line)` border, `18px` radius. Stage pills use `var(--c-projects)` for active stage. Delete is a ghost ✕ top-right on hover.

---

## Map Tab

Same masthead. Content below:

**Heatmap:** Keep all existing generation logic. New cell style: `border-radius: 7px`. Active (1 completion): `background: rgba(168,85,247,0.35); border: 1px solid rgba(168,85,247,0.3)`. High-activity (2+ completions): `background: rgba(6,182,212,0.3); border: 1px solid rgba(6,182,212,0.25)`. Today: `outline: 1.5px solid var(--d-legendary); outline-offset: 1.5px`. Container: `padding: 0 22px`.

**Stats grid:** 2×2, `gap:10px; margin-top:14px; padding:0 22px`. Each tile: `var(--panel) border var(--line) border-radius:14px padding:14px 16px`. Label `0.56rem muted uppercase`; number `1.5rem font-weight:800`. Total XP → cyan, Completed → purple, Days active → green, Streak → orange.

**Analytics button:** Small pill button `"📊 Analytics"` at the top of the Map view, right-aligned. Tapping slides in the Analytics panel via `transform: translateX(100%→0); transition: transform 0.25s cubic-bezier(0.2,0.9,0.3,1)`. Back `"← Map"` button returns via `transform: translateX(0→100%)`.

**Export / Import / Reset:** Tiny muted links `0.66rem` centered at the very bottom.

---

## Analytics Panel (inside Map)

Three sections, `24px` gap, `1px solid rgba(255,255,255,0.05)` divider between each. All charts are hand-drawn SVG — no external libraries.

### Section 1 — Mood and Energy Line Graph (last 7 days)

Label: `"Last 7 days"` — `0.62rem uppercase var(--muted) letter-spacing:0.16em margin-bottom:14px`.

Pure SVG, `width:100%; height:120px; padding:0 22px`. No Chart.js, no CDN.

Two lines:
- Mood: `stroke: var(--xp2)`, `stroke-width: 2`
- Energy: `stroke: var(--xp1)`, `stroke-width: 2`

Y-axis: 5 levels. Faint horizontal guides `stroke: rgba(255,255,255,0.05)`. No Y labels.

X-axis: day labels `Mon Tue Wed Thu Fri Sat Sun` — `0.52rem var(--muted)` below chart.

Data points: `4px` filled circle per day. Days with no reflection: gap in line (separate path segments, not connected).

Draw-on animation: `stroke-dashoffset` from full path length to `0`, `0.8s ease-out`. Mood first, energy `200ms` delayed.

Legend: `● Mood` purple · `● Energy` cyan — `0.58rem` inline, `gap:16px`.

Empty state (fewer than 2 reflections): `"Log a few days to see your trend."` centered in chart area in `var(--muted)`.

### Section 2 — Daily Completions Bar Chart (last 14 days)

Label: `"Daily completions"` — same label style.

Pure SVG, `width:100%; height:100px; padding:0 22px`.

14 bars from `S.days` data. Bar height proportional to count, max `80px`. Days with 0: full-height empty bar `rgba(255,255,255,0.04)` to show absence. Min height for 1+ completions: `6px`.

Colours:
- 0: `rgba(255,255,255,0.04)`
- 1–2: `rgba(168,85,247,0.4)`
- 3–4: `rgba(6,182,212,0.5)`
- 5+: `rgba(0,255,136,0.6)`

Today's bar: `stroke: var(--d-legendary); stroke-width: 1.5`.

X-axis: `M T W T F S S` repeating, `0.48rem var(--muted)`.

Animation: `transform: scaleY(0→1); transform-origin: bottom`, staggered `20ms` per bar.

### Section 3 — Four Circle Graphs

2×2 grid, `padding:0 22px; gap:12px`. Each circle is `80px × 80px` SVG.

SVG ring structure:
- Background ring: `stroke: rgba(255,255,255,0.06); stroke-width:6; fill:none`
- Progress ring: `stroke-width:6; stroke-linecap:round; fill:none; stroke-dasharray:[circ]; stroke-dashoffset:[circ*(1-ratio)]`
- Center text: `0.72rem font-weight:800` in `fill:var(--text)`
- Label below: `0.56rem var(--muted) uppercase letter-spacing:0.1em text-align:center margin-top:6px`

Ring fill animation: `stroke-dashoffset` to target, `0.8s cubic-bezier(0.2,0.8,0.2,1)`, staggered `100ms` per circle.

**Four circles:**

1. **Consistency** — `(days with ≥1 completion in last 30) / 30`. Colour: `var(--streak)`. Center: `N%`. Label: `Consistency`.

2. **Avg Mood** — average mood from `reflections[]` last 30 days, ring fills to `avg/5`. Colour: `var(--xp2)`. Center: `N.N`. Label: `Avg mood`. Fewer than 3 entries: center `—`, dashed stroke `stroke-dasharray:4 4`.

3. **Top Skill** — highest total XP skill, ring fills to current level progress. Colour: that skill's colour. Center: that skill's emoji. Label: skill name.

4. **Quest Success Rate** — `completed / (completed + failed)`. Colour: `var(--success)`. Center: `N%`. Label: `Success rate`. No history: center `—`, dashed ring.

---

## Reflect Tab — Mood Check-in

No card wrapper. Content on raw page background.

Masthead: same format, view name `"Reflect"`.

Three inputs, `28px` vertical gap between each, `padding: 0 22px`.

### Mood Selector

Five emoji in a row: 😞 😕 😐 🙂 😄

Each: `font-size:1.8rem; cursor:pointer`. Unselected: `opacity:0.3`. Selected: `opacity:1; transform:scale(1.2)` + background glow:
- 😞 → `rgba(239,68,68,0.3)`
- 😕 → `rgba(249,115,22,0.3)`
- 😐 → `rgba(255,255,255,0.15)`
- 🙂 → `rgba(6,182,212,0.3)`
- 😄 → `rgba(0,255,136,0.3)`

Tap selects, tap again deselects. One at a time. Stored as `1–5`.

### Energy Bars

Five vertical bars: `width:28px; height:44px; border-radius:6px`. Unselected: `background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.10)`.

Tap bar N fills bars 1 through N:
- 1–2: `#EF4444`
- 3: `#F59E0B`
- 4–5: `#00FF88`

Fill: `transform:scaleY(0→1); transform-origin:bottom; transition:transform 0.2s ease`, staggered `30ms`.

Stored as `1–5`.

### Note Input

`placeholder: "What mattered today?"`
`font-size:0.88rem; background:rgba(0,0,0,0.2); border:none; border-bottom:1px solid rgba(255,255,255,0.10); border-radius:0; padding:10px 0; width:100%; color:var(--text)`.
Focus: `border-bottom-color:rgba(168,85,247,0.5); outline:none`.
Max 140 chars. Counter `N/140` bottom-right `0.58rem var(--muted)`.

### Submit Button

Full-width, `margin-top:28px`. Gradient primary style, `border-radius:12px; padding:14px; font-weight:800`. Label: `"Log today"`.

On submit:
- Mood and energy required. Missing: shake element `transform:translateX(-4px→4px→-4px→0) 0.3s`.
- Success: `+15 XP` (once per day via `xpAwarded` flag). XP rail updates. Button shows `"✓ Logged"` in `var(--success)` for `1.5s`.
- After submit: inputs go read-only. Submit button hides. `"Edit"` ghost link appears bottom-right until midnight.

### Reflect Data Structure

Add to `BLANK()`:
```javascript
reflections: []
```

Each entry:
```javascript
{
  date: "YYYY-MM-DD",  // via today()
  mood: null,          // 1-5
  energy: null,        // 1-5
  note: "",
  xpAwarded: false
}
```

`+15 XP` goes to `S.totalXP` only — not to any skill. `xpAwarded: true` after first award. Editing does not re-award.

Migration: if `dbLoad()` returns state without `reflections`, set `S.reflections = []`.

---

## Modal Polish

Keep all existing modal fields and validation logic. Visual updates only:

Scrim: `background:rgba(5,8,14,0.80); position:fixed; inset:0; z-index:50; display:grid; place-items:center; padding:20px`. Enter `opacity 0→1 0.2s ease`. No blur.

Modal card: `background:var(--panel2); border:1px solid var(--line); border-radius:18px; padding:20px; width:100%; max-width:440px`. Enter `transform:translateY(20px)→translateY(0)` + `opacity 0→1`, `0.25s cubic-bezier(0.2,0.9,0.3,1)`.

Inputs: `background:rgba(0,0,0,0.3); border:1px solid var(--line); border-radius:11px; padding:11px 12px; font-size:0.92rem; width:100%; color:var(--text); font-family:inherit`. Focus: `border-color:rgba(168,85,247,0.5); outline:none`.

Difficulty buttons: active = difficulty colour background, text `#06121f font-weight:800`. Tap: `transform:scale(0.96→1) 0.12s ease`.

Primary button: `background:linear-gradient(90deg,var(--xp1),var(--xp2)); border:none; border-radius:12px; padding:12px; font-weight:800; color:white; width:100%`. Tap: `transform:scale(0.98) 0.1s ease`.

---

## db.js

```javascript
const DB_KEY = 'questlog_v1';
let _saveTimer = null;

function dbLoad() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // Migration: add reflections if missing
    if (!data.reflections) data.reflections = [];
    return data;
  } catch(e) { return null; }
}

function dbSave(state) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try { localStorage.setItem(DB_KEY, JSON.stringify(state)); } catch(e) {}
  }, 300);
}

function dbExport(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'questlog-backup-' + state.createdAt + '.json';
  a.click();
}

function dbImport(file, callback) {
  const r = new FileReader();
  r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (!data || !data.skills || !data.tasks) { callback(null, 'Invalid backup file'); return; }
      if (!data.reflections) data.reflections = [];
      callback(data, null);
    } catch(e) { callback(null, 'Could not read file'); }
  };
  r.readAsText(file);
}

function dbReset() {
  localStorage.removeItem(DB_KEY);
  localStorage.removeItem('questlog_named');
}
```

---

## ai.js

```javascript
const AI_MODEL = 'openai/gpt-4o-mini:free'; // change this to swap models

const LADDER = {
  // Copy LADDER object exactly from index.html
};

function getRuleSuggestion(skillId, skillLevel) {
  const ladder = LADDER[skillId] || [];
  const idx = Math.min(skillLevel - 1, ladder.length - 1);
  return ladder[Math.max(0, idx)];
}

async function getAISuggestion(skillId, recentTasks, skillLevel, streak, apiKey) {
  if (!apiKey || streak < 3) return { title: getRuleSuggestion(skillId, skillLevel), difficulty: 'Rare', reasoning: 'rule-based' };
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `I am leveling up my ${skillId} skill (level ${skillLevel}, ${streak}-day streak). Recent tasks: ${recentTasks.map(t=>t.title).join(', ')}. Suggest ONE concrete next task that is a genuine escalation. Reply only with JSON: {"title":"...","difficulty":"Common|Rare|Epic|Legendary","reasoning":"one sentence"}`
        }]
      })
    });
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content || '';
    const clean = text.replace(/```json|```/g,'').trim();
    return JSON.parse(clean);
  } catch(e) {
    return { title: getRuleSuggestion(skillId, skillLevel), difficulty: 'Rare', reasoning: 'rule-based fallback' };
  }
}
```

---

## app.js

All existing logic from `index.html` moves here. Key additions:

```javascript
// NativeBridge — no-op in browser, activates in Android WebView
function syncNative() {
  if (window.NativeBridge) {
    try {
      NativeBridge.setStreak(S.streak.current);
      NativeBridge.setCompletedToday(S.days[today()] > 0);
    } catch(e) {}
  }
}
```

Call `syncNative()` in `completeTask()` after all XP and streak updates, and in the boot sequence after `renderAll()`.

Boot sequence at bottom of `app.js`:
```javascript
let S = dbLoad() || BLANK();
ensureQuests();
firstRun();
renderAll();
syncNative();
```

`save()` function in `app.js` just calls `dbSave(S)`. All existing code that called `save()` continues to work.

---

## What the Agent Must Never Do

- Change `DB_KEY` from `'questlog_v1'` — losing the key loses all user data
- Change XP formulas, level curves, or streak multipliers
- Change the `SKILLS` array IDs or colours
- Change the `DIFF` XP values
- Animate `height`, `width`, `top`, `left`, `margin`, or `padding`
- Animate `box-shadow` directly
- Add `backdrop-filter` to any scrolling element
- Use `display:none` on the FAB — use `opacity:0; pointer-events:none`
- Add external libraries, CDNs, or npm packages
- Add new views or tabs beyond the four defined
- Add new gamification mechanics
- Add cloud sync of any kind
- Change the colour palette values

---

## Build Order

**Do not batch. Build in this order, test after each step.**

1. `db.js` — all localStorage logic, test load/save/export/import in browser console
2. `ai.js` — copy LADDER, test `getRuleSuggestion()` in console
3. `index.html` skeleton — HTML structure only, all four views stubbed, nav pill, FAB, modals
4. `styles.css` — all CSS, colour variables, global rules, all component styles
5. `app.js` — copy all existing logic from `index.html`, wire to `db.js` and `ai.js`, update render functions for new HTML structure
6. Test full app in browser: add task, complete task, check XP updates, check streak, check level-up modal, check quest bars, check swipe delete, check tick animation
7. Build Reflect tab: mood selector, energy bars, note, submit, XP award
8. Build Analytics panel: line graph, bar chart, four circles
9. Final test: all four tabs, all existing features, export/import/reset, first-run name prompt

After each step: confirm in 3 bullet points what was built and what to test.
