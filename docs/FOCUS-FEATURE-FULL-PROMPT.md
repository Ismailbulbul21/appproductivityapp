# Full Implementation Prompt: Focus Feature (Block Apps During Timer)

**Purpose:** This document is a complete, self-contained specification so an AI (e.g. Opus 4.6) or developer can implement the **Focus** feature in the Xasuus productivity app from scratch. Follow the sections in order.

---

## 1. Context

- **App:** Xasuus – Somali-language productivity app (tasks, goals, Maanta/today view).
- **Stack:** Expo (React Native), Supabase (Auth + Postgres), TypeScript. Tabs: Maanta, Hawlaha, Yoolalka, Dejinta.
- **Theme:** Emerald accent `#059669`, light gray bg `#f8fafc`, white cards, Somali labels. See `services/theme.ts` and existing screens for style.
- **Existing references in repo:**
  - `components/timerprompt.md` – Technical overview of how blocking works on iOS vs Android.
  - `docs/focus-feature-technical.md` – Supabase schema, RLS, codebase layout, data flow.
  - `components/focus-timer-prototype.html` – UI prototype (Focus home, new session sheet, timer screen, block overlay). Use for layout and copy.

---

## 2. Feature Summary

**What we are building:**

- A new **Focus** tab where the user can:
  1. **Select apps to block** during focus (e.g. Instagram, TikTok, YouTube). No limit on how many; store Android package names in Supabase; on iOS use system Screen Time picker and keep selection on device.
  2. **Set a focus timer** (presets: 15, 25, 45, 60 min; optional custom: hours, minutes, seconds – e.g. 1:00:00).
  3. **Start a focus session** – blocking turns on: on **iOS** the system shields selected apps (Screen Time API); on **Android** our app detects when a blocked app is opened and shows a full-screen overlay.
  4. **While the timer runs:** If the user opens a blocked app, they see a **block screen** (our message + “Back to Xasuus”), not the app. Timer counts down in the app (HH:MM:SS or MM:SS).
  5. **When the timer ends:** Blocking turns off automatically; user returns to Focus home. Optionally support **strict mode**: no “End session” button, so the user cannot end the timer early (adds pressure).

**What we are NOT building in v1:**

- Custom Android launcher or hiding apps from the home screen.
- Blocking specific apps from *launching* at the OS level (we block *interaction* via overlay/shield).

---

## 3. User Flows (Every Screen and Step)

### 3.1 Focus tab (home)

- **Entry:** User taps **Focus** in the tab bar.
- **Header:** Date (Somali, e.g. “Isniin, 18 Febraayo”), title **“Focus”**, subtitle e.g. “Ku xir wagtigaaga, ka xiiro apps-ka waawayn.”
- **Main card:**
  - Icon (e.g. clock), title “Bilow focus session”, short description, button **“Bilow”**.
  - On tap: open **New focus session** sheet (duration + apps + Start).
- **Section “Apps-ka la xiro”:** List of currently selected apps (icon + name + badge “Xiro”). If none, show “Tap below to choose apps.”
- **Button “Beddel apps-ka la xiro”:** Opens app picker (iOS: FamilyActivityPicker; Android: our list of installed apps with checkboxes).

### 3.2 Choose apps to block (app picker)

- **iOS:** Present system **FamilyActivityPicker** (Family Controls). User selects apps/categories. Store selection in memory/AsyncStorage for this device; do not store tokens in Supabase (device-specific).
- **Android:** Show a scrollable list of installed apps (icon + name); multi-select checkboxes. Load package list from system (e.g. PackageManager). On Save: write selected package names to Supabase (`focus_blocked_apps` or `user_focus_settings.blocked_apps`).
- **Copy:** “Dooro apps-ka aad rabto in la xiro marka aad focus session bilowdo.”

### 3.3 New focus session (bottom sheet / modal)

- **Title:** “Focus session cusub.”
- **Duration:**
  - Label: “Wakhtiga” or “Wakhtiga (daqiiqo)”.
  - Preset chips: **15**, **25**, **45**, **60** minutes. One selected by default (e.g. 25).
  - Optional: custom duration – hours (0–2), minutes (0–59), seconds (0–59). Support e.g. 1:00:00.
- **Apps:** Show saved blocked-app list (read-only here) or inline checkboxes; optional “Change” to open app picker.
- **Footer:** Button **“Bilow focus”**. On tap: start timer, call native to apply blocking (iOS: shield ON; Android: start foreground service + overlay logic), navigate to **Timer running** screen. Optional: insert row into `focus_sessions` with `started_at`, `duration_seconds`, `completed = false`.

### 3.4 Timer running

- **Status line:** “● Focus waa firfircoon” (emerald).
- **Big countdown:** Format **HH:MM:SS** if duration ≥ 1 hour, else **MM:SS**. Update every second.
- **Short text:** “Apps-ka la xirey: [names]. Haddii aad furo, shaashad xiritaan ayaa soo bixin doonta.”
- **Strict mode OFF:** Show button **“Dhamaystir session”** (End session). On tap: optional confirmation (“Ma hubtaa inaad dhamaystirto?”) then stop timer, clear blocking, go back to Focus home; if using `focus_sessions`, set `completed = false`, `ended_at = now()`.
- **Strict mode ON:** Do **not** show “Dhamaystir session”. Session ends only when timer reaches 0.
- **When timer reaches 0:** Stop timer, clear blocking (iOS: clear shield; Android: stop service, remove overlay), show brief “Session complete” if desired, then go back to Focus home; if using `focus_sessions`, set `completed = true`, `ended_at = now()`.

### 3.5 Block overlay (when user opens a blocked app)

- **When:** User opens an app that is in the blocked list while the timer is running.
- **iOS:** System shows **shield screen** (Screen Time). Configure title and body via Shield Configuration (e.g. “Focus session waa socda”, “App-kan waa la xirey. Ka noqo Xasuus ama sug inta timer uu dhammaado.”).
- **Android:** Our app shows a **full-screen overlay** on top of the blocked app. Content: lock icon, title “Focus session waa socda”, same message, button **“Ka noqo app-ka”** (Back to Xasuus). On tap: dismiss overlay and bring user back to our app (or at least leave the blocked app).
- **User does not see the blocked app** – only our block screen until they go back or the session ends.

---

## 4. UI/UX and Design Details

- **Style:** Match existing app: `#059669` (emerald), `#f8fafc` background, white cards, rounded corners (e.g. 16–24px), Somali labels. Use Feather icons where appropriate.
- **Timer display:** Always show seconds (e.g. 24:35 or 1:00:00). Update every second. Optional: circular progress ring that depletes as time runs out.
- **Strict mode:** Add a setting (e.g. in Focus tab or Dejinta): “Strict focus – ma bixinin dhamaystir session” (Strict focus – do not allow ending session early). When ON, hide “Dhamaystir session” on the timer screen. Store in AsyncStorage or Supabase (e.g. `profiles.focus_strict_mode` boolean).
- **No limit** on number of apps to block; list can be long (scroll + optional search on Android).

---

## 5. Supabase Changes

### 5.1 Option A – Add columns to `profiles` (recommended for minimal change)

Run this SQL (e.g. via Supabase MCP `execute_sql` or Dashboard SQL editor):

```sql
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS focus_blocked_apps jsonb NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS focus_default_duration_minutes integer NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS focus_strict_mode boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.focus_blocked_apps IS 'Android: array of package names. iOS: unused.';
COMMENT ON COLUMN public.profiles.focus_default_duration_minutes IS 'Default focus session length in minutes.';
COMMENT ON COLUMN public.profiles.focus_strict_mode IS 'If true, user cannot end focus session early.';
```

No new RLS: existing profile policies apply.

### 5.2 Option B – New table `user_focus_settings`

If you prefer a separate table:

```sql
CREATE TABLE IF NOT EXISTS public.user_focus_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_apps jsonb NOT NULL DEFAULT '[]',
  default_duration_minutes integer NOT NULL DEFAULT 25,
  strict_mode boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.user_focus_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own focus settings"
  ON public.user_focus_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own focus settings"
  ON public.user_focus_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own focus settings"
  ON public.user_focus_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own focus settings"
  ON public.user_focus_settings FOR DELETE USING (auth.uid() = user_id);
```

### 5.3 Optional – `focus_sessions` (history)

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
```

---

## 6. Codebase Structure and Files to Create/Modify

### 6.1 Types (`services/types.ts` or new `services/focusTypes.ts`)

- Add or extend:
  - `FocusSettings`: `{ blockedApps: string[]; defaultDurationMinutes: number; strictMode?: boolean }`
  - If using `profiles`: extend `Profile` with `focus_blocked_apps?: string[]`, `focus_default_duration_minutes?: number`, `focus_strict_mode?: boolean`.
  - Optional: `FocusSession`: `{ id; user_id; started_at; ended_at; duration_seconds; completed }`.

### 6.2 Hook: `hooks/useFocusSettings.ts`

- **Input:** `userId: string | undefined`.
- **Output:** `{ settings, loading, setBlockedApps, setDefaultDuration, setStrictMode, refetch }`.
- **Fetch:** If Option A: `supabase.from('profiles').select('focus_blocked_apps, focus_default_duration_minutes, focus_strict_mode').eq('id', userId).single()`. If Option B: `supabase.from('user_focus_settings').select('*').eq('user_id', userId).maybeSingle()` (upsert on first save).
- **Update:** Corresponding `supabase.from('profiles').update(...)` or `user_focus_settings` upsert.

### 6.3 New tab and screens

- **Add tab:** Create `app/(tabs)/focus.tsx` – main Focus screen (home + list of blocked apps + “Bilow” card).
- **Modify:** `app/(tabs)/_layout.tsx` – add a **Focus** tab between Yoolalka and Dejinta (or at end). Use Feather icon e.g. `clock` or `target`, title “Focus”.
- **Screens/components to implement:**
  - **FocusHome** – header, “Bilow focus session” card, “Apps-ka la xiro” list, “Beddel apps-ka la xiro” button. Optional: strict mode toggle (or link to Dejinta).
  - **AppPicker** – iOS: native FamilyActivityPicker via native module; Android: custom screen with list of installed apps (from native module or expo-application), checkboxes, Save.
  - **NewFocusSessionSheet** – modal/sheet: duration chips + optional custom (hours/minutes/seconds), blocked apps summary, “Bilow focus” button. On Start: start timer in JS, call native to apply blocking, navigate to TimerRunning.
  - **TimerRunning** – countdown (HH:MM:SS or MM:SS), status text, blocked-apps reminder, “Dhamaystir session” button (hidden if strict mode). When timer ends or user ends: call native to clear blocking, optionally update `focus_sessions`, navigate back to Focus home.
  - **BlockOverlay** – Android only: native full-screen overlay (not a React screen). iOS: Shield Configuration extension for title/body.

### 6.4 Focus session state

- Use React state or a small context (e.g. `FocusContext`) to hold: `isSessionActive`, `remainingSeconds`, `startedAt`, `durationSeconds`, `strictMode`. Timer runs with `setInterval` or similar; when `remainingSeconds` hits 0, run “end session” logic (clear native blocking, navigate, optional `focus_sessions` insert).

### 6.5 Optional: log session

- When session ends (timer 0 or user end): `supabase.from('focus_sessions').insert({ user_id, started_at, ended_at, duration_seconds, completed })`. Use `focus_sessions` table from 5.3.

---

## 7. iOS Implementation (Native)

- **APIs:** Apple **Family Controls**, **ManagedSettings**, optionally **DeviceActivity** and **ManagedSettingsUI** (Shield Configuration).
- **Entitlement:** Request **Family Controls** distribution entitlement from Apple (developer.apple.com/contact/request/family-controls-distribution). Required for TestFlight/App Store. Development works with dev entitlement.
- **Flow:**
  1. Request authorization (one-time); show FamilyActivityPicker for user to select apps/categories.
  2. When user starts focus: call `ManagedSettingsStore` to apply shield for that selection.
  3. When timer ends (or user ends if not strict): clear `ManagedSettingsStore` shield.
- **Shield Configuration:** Customize the block screen title and message (e.g. “Focus session waa socda”, “App-kan waa la xirey…”).
- **Implementation:** Use a library such as **react-native-device-activity** (or equivalent) that wraps Family Controls + ManagedSettings, or implement a custom native module in Swift. Requires **development build** (not Expo Go). Add to `app.json` plugins if using a config plugin.
- **No Supabase storage of iOS selection tokens** – keep selection in memory or AsyncStorage per device.

---

## 8. Android Implementation (Native)

- **Permissions:** Usage Access (`PACKAGE_USAGE_STATS`), “Display over other apps” (`SYSTEM_ALERT_WINDOW`), optional **Accessibility** for stronger enforcement (e.g. bring user back to app). Foreground service for reliable background timer/blocking.
- **Flow:**
  1. When user starts focus: start a **foreground service** that uses **UsageStatsManager** (or `UsageEvents`) to get the current foreground app.
  2. If foreground app package is in `blocked_apps` (from Supabase), show a **full-screen overlay** (`WindowManager`, `TYPE_APPLICATION_OVERLAY`) with our block UI (“Focus session waa socda”, “Ka noqo app-ka”).
  3. When timer ends (or user ends if not strict): stop service, remove overlay.
- **Package list for picker:** Use Android API to list installed apps (e.g. `PackageManager.getInstalledApplications`); send package names and labels to JS for the app-picker UI. Save selected package names to Supabase.
- **Implementation:** Custom native module (Kotlin/Java) or a community library. Requires **development build**. Request permissions at runtime and explain clearly (Usage Access, Overlay).

---

## 9. What the User Sees When They Open a Locked App

- **iOS:** System **shield screen** with our configured title and message. They cannot use the app until they go back (e.g. Home) or the focus session ends.
- **Android:** Our **full-screen overlay** with lock icon, title, message, and “Ka noqo app-ka” button. They do not see or interact with the blocked app; tapping the button returns them to Xasuus.

---

## 10. Strict Mode (No End Button)

- **Setting:** `focus_strict_mode` (or `strict_mode` in `user_focus_settings`). When `true`:
  - On the **Timer running** screen, do **not** show the “Dhamaystir session” button.
  - Session ends only when the timer reaches 0.
- **Where to set:** In Focus tab (e.g. “Strict focus” toggle) or in Dejinta. Persist in Supabase (Option A: `profiles.focus_strict_mode`) or AsyncStorage if you prefer local-only.

---

## 11. Checklist for Implementation (Order of Work)

1. **Supabase:** Run migration (Option A or B + optional `focus_sessions`). Verify RLS.
2. **Types:** Add `FocusSettings` and extend `Profile` (or types for `user_focus_settings`). Optional `FocusSession` type.
3. **Hook:** Implement `useFocusSettings(userId)` – fetch/update focus_blocked_apps, default_duration_minutes, strict_mode.
4. **Tab:** Add Focus tab in `_layout.tsx` and create `app/(tabs)/focus.tsx` (Focus home UI only, no native yet).
5. **New session sheet:** Duration chips + custom (optional), “Bilow focus” button; on tap, start local timer state and navigate to timer screen. (Blocking can be no-op until native is ready.)
6. **Timer screen:** Countdown display (HH:MM:SS / MM:SS), “Dhamaystir session” button (hidden when strict mode), end-session logic (clear state, navigate back). Optional: write to `focus_sessions` when session ends.
7. **App picker (Android):** Native module to list installed apps; UI with checkboxes; save selected package names via `useFocusSettings.setBlockedApps`. iOS: integrate FamilyActivityPicker (native module or library).
8. **iOS native:** Request Family Controls entitlement; implement (or integrate library) authorization + FamilyActivityPicker + ManagedSettings shield on/off; Shield Configuration for block screen text.
9. **Android native:** Request Usage Access + Overlay; foreground service that checks foreground app and shows overlay when blocked app is open; remove overlay when session ends.
10. **Strict mode:** Read `focus_strict_mode` from settings; hide “Dhamaystir session” when true. Add toggle in Focus or Dejinta and persist to Supabase.
11. **Copy and polish:** Use Somali strings from prototype; match app theme; test flow on both platforms.

---

## 12. References in This Repo

- `components/timerprompt.md` – How blocking works (Android vs iOS).
- `docs/focus-feature-technical.md` – Supabase details, data flow, codebase layout.
- `components/focus-timer-prototype.html` – UI reference and Somali copy.
- `services/theme.ts` – Colors and style.
- `app/(tabs)/maanta.tsx`, `app/(tabs)/yoolalka.tsx` – Example tab structure and styling.

---

## 13. Summary

- **Feature:** Focus tab → select apps to block → set timer (presets + optional 1h, minutes, seconds) → start session → blocking on (iOS: shield, Android: overlay) → user sees block screen if they open a blocked app → session ends when timer hits 0 (or user ends if strict mode is off).
- **Supabase:** New columns on `profiles` (or new table `user_focus_settings`) for blocked apps, default duration, strict mode; optional `focus_sessions` for history. No new APIs.
- **Codebase:** New Focus tab, `useFocusSettings`, Focus home, app picker, new session sheet, timer screen; native iOS (Family Controls + ManagedSettings) and Android (Usage Access + Overlay + foreground service).
- **Strict mode:** When on, do not show “End session”; user cannot end timer early.

Implement the checklist in order; integrate native modules after the JS/UI flow works so you can test end-to-end.
