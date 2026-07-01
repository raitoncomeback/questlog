# QuestLog v2 — Setup Guide

## Prerequisites
- A GitHub account (for hosting)
- A Supabase account (free tier) at https://supabase.com

---

## Step 1: Create a Supabase Project

1. Go to https://supabase.com and sign in
2. Click **New Project**
3. Choose a name (e.g., `questlog`) and a strong database password
4. Select a region close to you
5. Click **Create new project** and wait ~2 minutes

---

## Step 2: Run the Migration

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Click **New query**
3. Open `migration.sql` from this repo and copy its entire contents
4. Paste into the SQL Editor
5. Click **Run** (or press Ctrl+Enter)
6. Verify you see "Success. No rows returned"

---

## Step 3: Get Your Supabase URL and Anon Key

1. In your Supabase dashboard, go to **Project Settings** (gear icon, bottom-left)
2. Click **API** in the left sidebar
3. Copy two values:
   - **Project URL** — looks like `https://xxxx.supabase.co`
   - **Project anon public key** — starts with `eyJ...`

---

## Step 4: Configure config.js

1. Open `config.js` in this repo
2. Paste your URL and key:

```js
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

3. Save the file. **Do NOT commit this file** — it's in `.gitignore`.

---

## Step 5: Enable Email Auth

1. In Supabase dashboard, go to **Authentication** → **Providers**
2. Make sure **Email** is enabled (it is by default)
3. For magic links, you can leave **Confirm email** on or off:
   - **On** (default): User must click email link to confirm
   - **Off**: Faster testing, but less secure
4. If you want to test locally, go to **Authentication** → **Settings** and add your dev URL to **Redirect URLs**

---

## Step 6: Deploy to GitHub Pages

1. Push this repo to GitHub
2. Go to your repo → **Settings** → **Pages**
3. Set **Source** to **Deploy from a branch**, branch `main`, folder `/ (root)`
4. Click **Save**
5. Your app is live at `https://yourusername.github.io/repo-name/`

---

## Step 7: Install on iPhone (Home Screen)

1. Open your app URL in Safari
2. Tap the **Share** button (square with arrow)
3. Tap **Add to Home Screen**
4. Name it "QuestLog" and tap **Add**

---

## How Auth Works

- On first visit, you see a sign-in screen
- Enter your email and click **Send Magic Link**
- Check your email and click the link
- Your data syncs to the cloud automatically
- **Continue offline** skips auth and uses localStorage only (no sync)

---

## Migration from localStorage

If you had data in the old single-file version:
1. Open the new version in the same browser
2. Sign in with your email
3. A prompt appears: "Import Local Progress?"
4. Click **Import** — your XP, tasks, skills, and streaks transfer to Supabase
5. Click **Skip** to start fresh

---

## Offline Behavior

- If you lose internet, the app works exactly as before (localStorage)
- Pending changes are queued and synced when you're back online
- A small dot in the header shows sync status:
  - Green = synced
  - Yellow = syncing
  - Gray = offline

---

## API Key Storage (Feature 3)

The OpenRouter API key is entered in-app via **Settings** (Map tab → Settings link). It's stored in your Supabase `user_settings` row. This is adequate for a personal app but not for shared use — see tradeoff note in db.js.

---

## File Structure

```
index.html        — HTML shell
styles.css        — All styles
app.js            — Main application logic
db.js             — Cloud persistence (Supabase)
ai.js             — AI integration (Feature 3 stub)
config.js         — Your Supabase credentials (gitignored)
migration.sql     — Database schema + RLS
manifest.json     — PWA manifest
SETTINGS.md       — This file
.gitignore        — Ignores config.js
```

---

## Troubleshooting

**Magic link not arriving?**
- Check spam folder
- In Supabase → Authentication → Logs for errors
- Make sure your email provider isn't blocking Supabase

**Data not syncing?**
- Check the sync dot in the hero (green = good)
- Open browser console for errors
- Try signing out and back in

**App not loading?**
- Make sure `config.js` has valid Supabase credentials
- Check browser console for errors
