# Focus Feature – Technical Implementation (Supabase + Codebase)

This doc describes **what changes in Supabase**, **what changes in the codebase**, **what APIs are needed**, and **how it works technically** to implement the “block selected apps during focus timer” feature.

---

## 1. Supabase changes

### 1.1 What we need to store

| Data | Purpose |
|------|--------|
| **Blocked apps list** | Which apps the user chose to block during focus. Persisted so we can re-apply when they start a session and sync across devices. |
| **Default duration (optional)** | e.g. 25 min, so “New session” can pre-fill. |
| **Focus sessions history (optional)** | For stats/streaks: started_at, ended_at, duration, completed (ran to end vs ended early). |

**Blocked apps format:**

- **Android:** Array of **package names** (e.g. `["com.instagram.android", "com.zhiliaoapp.musically"]`). Stored as JSON in DB.
- **iOS:** Screen Time uses **opaque tokens** from FamilyActivityPicker. Tokens are often **device-specific** and not meant to be stored long-term in a backend. Options: (a) store nothing in Supabase for iOS and keep selection only on device (AsyncStorage / in-memory), or (b) store a serialized form if the API allows. For cross-device sync on iOS we may only sync “that the user has chosen something” and re-pick on each device. **Recommendation:** Store **Android** blocked apps in Supabase; for **iOS** either store nothing or a placeholder; app selection can be re-done per device.

So in Supabase we mainly need:

- **Per user:** `blocked_apps` (JSON array of strings – Android package names), and optionally `default_duration_seconds` or `default_duration_minutes`.

### 1.2 Option A – Add columns to `profiles` (minimal change)

Reuse existing table and RLS (users already have UPDATE on own profile).

**New columns on `profiles`:**

| Column | Type | Default | Description |
|--------|------|---------|--------------|
| `focus_blocked_apps` | `jsonb` | `'[]'` | Array of app identifiers. Android: package names. iOS: empty or not used. |
| `focus_default_duration_minutes` | `integer` | `25` | Default session length in minutes (optional). |

**Migration SQL (Option A):**

```sql
-- Add focus feature columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS focus_blocked_apps jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS focus_default_duration_minutes integer NOT NULL DEFAULT 25;

COMMENT ON COLUMN public.profiles.focus_blocked_apps IS 'Android: package names. iOS: unused or empty.';
COMMENT ON COLUMN public.profiles.focus_default_duration_minutes IS 'Default focus session length in minutes.';
```

No new RLS policies: existing “Users can view/update own profile” already covers these columns.

### 1.3 Option B – New table `user_focus_settings` (clean separation)

One row per user; clearer schema if you want to add more focus-related fields later.

**Table:**

| Column | Type | Constraint | Description |
|--------|------|------------|-------------|
| `id` | `uuid` | PRIMARY KEY, default `gen_random_uuid()` | |
| `user_id` | `uuid` | NOT NULL, REFERENCES auth.users(id) ON DELETE CASCADE, UNIQUE | |
| `blocked_apps` | `jsonb` | NOT NULL DEFAULT '[]' | Android package names (or empty for iOS). |
| `default_duration_minutes` | `integer` | NOT NULL DEFAULT 25 | |
| `updated_at` | `timestamptz` | DEFAULT now() | |

**Migration SQL (Option B):**

```sql
CREATE TABLE IF NOT EXISTS public.user_focus_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_apps jsonb NOT NULL DEFAULT '[]',
  default_duration_minutes integer NOT NULL DEFAULT 25,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_focus_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own focus settings"
  ON public.user_focus_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own focus settings"
  ON public.user_focus_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own focus settings"
  ON public.user_focus_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own focus settings"
  ON public.user_focus_settings FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_focus_settings IS 'Per-user focus feature: blocked apps and default duration.';
```

### 1.4 Optional – `focus_sessions` table (history / analytics)

For “focus time today”, streaks, or stats.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `uuid` | PK |
| `user_id` | `uuid` | FK auth.users |
| `started_at` | `timestamptz` | When session started |
| `ended_at` | `timestamptz` | When session ended |
| `duration_seconds` | `integer` | Planned duration |
| `completed` | `boolean` | true = ran to end, false = ended early |

**Migration SQL (optional):**

```sql
CREATE TABLE IF NOT EXISTS public.focus_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  duration_seconds integer NOT NULL,
  completed boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own focus sessions"
  ON public.focus_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own focus sessions"
  ON public.focus_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
-- No UPDATE/DELETE needed if we only append.
```

### 1.5 Summary – Supabase

- **Required:** Either **Option A** (columns on `profiles`) or **Option B** (table `user_focus_settings`). Same RLS idea: only the owning user can read/write.
- **Optional:** `focus_sessions` for history.
- **No new Supabase products:** Only Postgres (Database) and Auth. No Edge Functions, no new APIs – just schema + existing Supabase client (`supabase.from(...).select/insert/update`).

---

## 2. APIs we need (outside Supabase)

Blocking and timer behaviour are **on-device**; Supabase is only for **storing settings and optional session history**.

| Need | Where | Notes |
|------|--------|--------|
| **Store/load blocked apps & default duration** | Supabase Database | Existing client; no new API. |
| **Auth (who is the user)** | Supabase Auth | Already in use. |
| **Block apps on iOS** | Apple Screen Time API (Family Controls, ManagedSettings) | Native iOS; requires Family Controls entitlement from Apple. |
| **Block apps on Android** | Usage Access + Overlay (+ optional Accessibility) | Native Android; permissions in app. |
| **Timer (countdown)** | In-app only | JavaScript state (e.g. useState + setInterval or a timer lib). No API. |

So: **no new “API” in the sense of a new Supabase or third-party service.** We only add **DB columns/table** and use **native platform APIs** (iOS Screen Time, Android Usage + Overlay) from the app.

---

## 3. Codebase changes

### 3.1 Supabase / data layer

- **Types** (`services/types.ts` or similar):  
  - Add `FocusSettings` (e.g. `blocked_apps: string[]`, `default_duration_minutes: number`).  
  - If using `profiles`: extend `Profile` with `focus_blocked_apps?: string[]` and `focus_default_duration_minutes?: number`.
- **Focus settings hook** (e.g. `hooks/useFocusSettings.ts`):
  - `const { settings, loading, setBlockedApps, setDefaultDuration } = useFocusSettings(userId);`
  - **Fetch:** `supabase.from('profiles').select('focus_blocked_apps, focus_default_duration_minutes').eq('id', userId).single()` (Option A) or `supabase.from('user_focus_settings').select('*').eq('user_id', userId).single()` (Option B).
  - **Update:** `supabase.from('profiles').update({ focus_blocked_apps: apps, focus_default_duration_minutes: mins }).eq('id', userId)` (Option A) or upsert into `user_focus_settings` (Option B).
- **Optional – log session:** When a focus session ends, `supabase.from('focus_sessions').insert({ user_id, started_at, ended_at, duration_seconds, completed })`.

### 3.2 App structure

- **New tab:** `app/(tabs)/focus.tsx` – Focus tab screen (home + “Start session” entry).
- **Tab layout:** In `app/(tabs)/_layout.tsx` add a fifth tab: “Focus” with an icon (e.g. Feather `clock` or `target`).
- **Screens / components (inside or next to Focus):**
  - Focus home (list of “blocked apps”, “Start focus session” card).
  - App picker: Android = custom list (from device); iOS = native FamilyActivityPicker via native module.
  - New session sheet/modal: duration (presets + optional custom), confirm blocked apps, “Start” → start timer + call native to apply blocking.
  - Timer running screen: countdown (hours:minutes:seconds or minutes:seconds), “End session” button, optional “See block screen” demo.
  - Block overlay: **Android** = full-screen overlay (native); **iOS** = system shield (Shield Configuration). Not a React screen on Android – a native overlay window.

### 3.3 Native / platform

- **iOS:** Use **Family Controls** + **ManagedSettings** (and optionally DeviceActivity). Either:
  - Library: e.g. `react-native-device-activity` (or similar), or
  - Custom native module (Swift) that requests authorization, shows FamilyActivityPicker, and calls ManagedSettingsStore to set/clear shield.  
  Requires **development build** (no Expo Go). **Family Controls distribution entitlement** from Apple.
- **Android:** Custom native module (or library if you find one) that:
  - Requests **Usage Access** and **Display over other apps** (and optionally **Accessibility**).
  - When focus session starts: start a **foreground service** that uses `UsageStatsManager` (or equivalent) to get current foreground app; if it’s in the blocked list, show an overlay (`WindowManager` + `TYPE_APPLICATION_OVERLAY`).
  - When timer ends (or user ends session): stop service, remove overlay.  
  Requires **development build**; no Expo Go.

Expo: add the new tab and JS/TS logic; use **config plugins** and **dev build** for native Focus code. No new Supabase API calls beyond what’s above.

---

## 4. How it works technically (end-to-end)

### 4.1 Loading focus settings

1. User opens app and is logged in (`auth.uid()`).
2. App calls `useFocusSettings(auth.uid())` (or equivalent).
3. Hook runs `supabase.from('profiles').select('focus_blocked_apps, focus_default_duration_minutes').eq('id', userId).single()` (Option A) or same for `user_focus_settings` (Option B).
4. Result is stored in React state; Focus home shows “blocked apps” and default duration for “New session”.

### 4.2 Choosing apps to block

- **Android:** User taps “Change apps to block” → app shows list of installed apps (from system/launcher); user selects multiple → we save `blocked_apps` as JSON array of package names → `supabase.from('profiles').update({ focus_blocked_apps: blocked_apps }).eq('id', userId)` (Option A) or upsert `user_focus_settings` (Option B).
- **iOS:** User taps “Choose apps” → native FamilyActivityPicker is shown → user selects apps/categories → we get back tokens; we **do not** store tokens in Supabase (device-specific). We either store nothing or a flag; on “Start session” we use the in-memory/device-stored selection to call ManagedSettings.

### 4.3 Starting a focus session

1. User sets duration (e.g. 25 min or 1:00:00) and taps “Start focus”.
2. **App (JS):** Start local timer (e.g. `useState` + `setInterval` or timer lib), navigate to “Timer running” screen, persist “session started at” and “duration” in state/context.
3. **App (native):**  
   - **iOS:** Call ManagedSettingsStore to apply shield for the current FamilyActivitySelection (the one from picker).  
   - **Android:** Start foreground service; register listener for “foreground app”; if foreground app is in `blocked_apps`, show overlay.
4. **Optional:** Insert a row into `focus_sessions` with `started_at = now()`, `duration_seconds`, `completed = false` (we’ll update or insert “ended” row when session ends).

### 4.4 While the timer is running

- **Timer:** JS updates countdown every second; display HH:MM:SS or MM:SS. When remaining time hits 0, go to “session ended” logic.
- **User opens blocked app:**  
  - **iOS:** System shows shield; no app code needed in that moment.  
  - **Android:** Foreground service sees new foreground app in blocked list → show overlay; optionally Accessibility brings user back to our app.
- **User taps “End session”:** Go to “session ended” logic.

### 4.5 Ending a focus session

1. **App (JS):** Stop timer, clear “session” state, navigate back to Focus home.
2. **App (native):**  
   - **iOS:** Clear ManagedSettingsStore shield.  
   - **Android:** Stop foreground service, remove overlay.
3. **Optional:** Update or insert `focus_sessions` row with `ended_at = now()`, `completed = true/false`.

### 4.6 Data flow diagram (simplified)

```
[Focus Home] --> load settings from Supabase (blocked_apps, default_duration)
       |
       v
[Change apps] --> save blocked_apps to Supabase (Android); iOS keep selection on device
       |
       v
[Start session] --> start JS timer + call native (iOS: shield ON / Android: service + overlay ON)
       |           optional: insert focus_sessions row
       v
[Timer running] --> every 1s update UI; if user opens blocked app -> iOS shield / Android overlay
       |           "End session" or timer=0 -> go to end
       v
[End session]   --> native (iOS: shield OFF / Android: service OFF, overlay OFF)
                   optional: update focus_sessions row
                   -> back to Focus Home
```

---

## 5. Summary table

| Area | Change |
|------|--------|
| **Supabase** | Add columns to `profiles` (Option A) OR new table `user_focus_settings` (Option B). Optional: `focus_sessions`. RLS: user can only access own row(s). |
| **Supabase APIs** | None new. Use existing Database (select/insert/update) and Auth. |
| **Codebase – data** | New types, `useFocusSettings` hook, read/write focus settings via Supabase client. |
| **Codebase – UI** | New tab Focus, Focus home, app picker, new-session sheet, timer screen; block overlay is native (Android) or system (iOS). |
| **Codebase – native** | iOS: Family Controls + ManagedSettings (library or custom module). Android: Usage Access + Overlay (+ optional Accessibility) in a foreground service. |
| **External APIs** | None. Blocking is 100% device + Supabase for storage. |

If you tell me which option you prefer (Option A vs B, and whether you want `focus_sessions`), I can give you the exact migration file and the minimal hook/type changes next.
