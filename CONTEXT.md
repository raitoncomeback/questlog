# QuestLog — Current State

## Status
Not started. Ready to build from scratch.

## Source of truth
`index.html` in this folder is the current working app. All logic must be preserved from it exactly. Read it completely before writing anything.

## What exists in index.html (do not lose any of this)
- 6 skills: Projects, Job Hunt, Grad School, Fitness, Nutrition, Sleep
- XP system with level curve (cap 50, 1.08 exponent via reqForLevel)
- Streak tracking with multipliers (3d→1.1x, 7d→1.25x, 14d→1.5x, 30d→2.0x)
- Tasks with 4 difficulty tiers (Common 10xp / Rare 25xp / Epic 50xp / Legendary 100xp)
- Crit system (10% chance, double XP)
- 3 daily quests, auto-generated, refresh daily at local midnight
- Job Hunt funnel tracker (Applications → Replies → Interviews → Offers)
- Resume project stage tracker (Started → MVP → Deployed → On Resume)
- Calendar heatmap (monthly, local time)
- Rule-based level-up recommender (fires at 3+ day skill streak)
- OpenRouter AI stub (suggestAITask, falls back silently)
- XP orb animations, level-up modals, float text
- Export / Import / Reset
- Local IST date handling via fmt() and today() functions
- First-run name prompt

## What needs to be built
Everything in PROMPT.md — new layout, split files, new features.

## Files in this folder
- `index.html` — current working v1, single file, read this first
- `PROMPT.md` — complete build specification
- `CONTEXT.md` — this file
- `DECISIONS.md` — rules that must never be broken

## Next instruction for agent
"Read PROMPT.md, CONTEXT.md, and DECISIONS.md completely. Then read index.html end to end. Confirm you understand the existing data model before writing anything. Then start with Step 1: build db.js only."

## How to update this file after each session
1. Update Status above
2. List what was completed
3. List any bugs or issues
4. Update Next instruction to reflect where to continue
