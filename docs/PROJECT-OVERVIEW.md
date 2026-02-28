# Productivity App (Qorsheyn) – Full Project Overview

This document explains the **Supabase database**, **RLS (Row Level Security)**, and the **entire codebase** for the productivity app.

---

## 1. What the app is

**Qorsheyn** (productivityapp) is a **Somali-language productivity app** built with **Expo (React Native)**. It provides:

- **Tasks** – Create, complete, and manage tasks with due dates, priorities, and reminders
- **Goals (Yoolalka)** – Long-term goals with deadlines and task progress
- **Focus / “Iska xir”** – Timed focus sessions with optional **app blocking** (Android) and **scheduled focus blocks**
- **Today view (Maanta)** – Tasks due today (and overdue)
- **Settings (Dejinta)** – Account, notifications, goal reminders

The app uses **Supabase** for auth and data, with **RLS** so each user only sees their own rows.

---

## 2. Supabase project and database

- **Project**: `productivityapp`  
- **Project ID**: `hnflspjejmdwfmztvnpq`  
- **Region**: `us-east-1`  
- **URL**: `https://hnflspjejmdwfmztvnpq.supabase.co`

The app connects via `services/supabase.ts` using the anon key; all table access is controlled by **Row Level Security (RLS)**.

---

## 3. Database schema (public)

### 3.1 `profiles`

Extends Supabase Auth: one row per user (`id` = `auth.users.id`).

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid (PK) | = auth user id |
| `email` | text | nullable |
| `focus_type` | text | Student, Shaqo, Ganacsi, Horumar Shakhsi |
| `created_at` | timestamptz | default now() |
| `notifications_enabled` | boolean | default true |
| `goal_reminder_day` | integer | 0–6 (day of week) |
| `goal_reminder_time` | text | e.g. "19:00" |
| `goal_reminder_interval_days` | integer | 1, 3, or 7 |
| `focus_blocked_apps` | jsonb | default `[]` – Android package names |
| `focus_default_duration_minutes` | integer | default 25 |
| `focus_strict_mode` | boolean | default false – cannot end focus early |

**RLS**: Users can SELECT/INSERT/UPDATE only their own row (`auth.uid() = id`).

**Trigger**: `on_auth_user_created` runs `handle_new_user()` on `auth.users` INSERT to create the corresponding `profiles` row.

---

### 3.2 `tasks`

User tasks with optional goal link and notifications.

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid (PK) | gen_random_uuid() |
| `user_id` | uuid (FK → auth.users) | owner |
| `title` | text | required |
| `due_date` | date | nullable |
| `due_time` | time | nullable |
| `priority` | text | Hoose, Dhexe, Sare (default Dhexe) |
| `status` | text | todo, done (default todo) |
| `goal_id` | uuid (FK → goals) | nullable |
| `notification_id` | text | expo notification id at due time |
| `notification_id_early` | text | reminder before due |
| `created_at` | timestamptz | default now() |
| `completed_at` | timestamptz | set when status = done |
| `reminder_minutes_before` | integer | default 0 |

**RLS**: Users can SELECT/INSERT/UPDATE/DELETE only rows where `auth.uid() = user_id`.

---

### 3.3 `goals`

Long-term goals with deadline; tasks can be linked via `goal_id`.

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid (PK) | gen_random_uuid() |
| `user_id` | uuid (FK → auth.users) | owner |
| `title` | text | required |
| `type` | text | e.g. Toddobaad, 1 bil … 11 bil, Sanad |
| `deadline` | date | required |
| `created_at` | timestamptz | default now() |

**RLS**: Users can SELECT/INSERT/UPDATE/DELETE only rows where `auth.uid() = user_id`.

---

### 3.4 `focus_sessions`

Log of completed (or aborted) focus sessions for stats.

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid (PK) | gen_random_uuid() |
| `user_id` | uuid (FK → auth.users) | owner |
| `started_at` | timestamptz | required |
| `ended_at` | timestamptz | required |
| `duration_seconds` | integer | required |
| `completed` | boolean | finished without early exit |
| `created_at` | timestamptz | default now() |

**RLS**: Users can SELECT and INSERT only their own rows (`auth.uid() = user_id`). No UPDATE/DELETE policies (append-only log).

---

### 3.5 `focus_schedules`

Scheduled focus blocks (start time + duration + apps to block). Used for “scheduled blocking” feature.

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid (PK) | gen_random_uuid() |
| `user_id` | uuid (FK → auth.users) | owner |
| `blocked_apps` | jsonb | default `[]` – package names |
| `start_time` | timestamptz | when block starts |
| `duration_minutes` | integer | length of block |
| `status` | text | pending, active, completed, cancelled (default pending) |
| `created_at` | timestamptz | default now() |

**RLS**: Users can SELECT/INSERT/UPDATE/DELETE only rows where `auth.uid() = user_id`.

---

## 4. RLS summary

- **profiles**: SELECT, INSERT, UPDATE by `auth.uid() = id`
- **tasks**: SELECT, INSERT, UPDATE, DELETE by `auth.uid() = user_id`
- **goals**: SELECT, INSERT, UPDATE, DELETE by `auth.uid() = user_id`
- **focus_sessions**: SELECT, INSERT by `auth.uid() = user_id`
- **focus_schedules**: SELECT, INSERT, UPDATE, DELETE by `auth.uid() = user_id`

So the “Supabase RLC project” (RLS) is: **each table is scoped to the signed-in user via `auth.uid()`**.

---

## 5. App architecture (codebase)

### 5.1 Stack

- **Expo SDK ~54** (React Native)
- **expo-router** – file-based routing
- **Supabase JS** – auth + Postgres (Realtime for tasks/goals)
- **NativeWind (Tailwind)** – styling
- **React Native Reanimated**, **Gesture Handler**, **Bottom Sheet** – UI/UX

### 5.2 Entry and layout

- **`index.js`** – Expo entry; loads `app/_layout.tsx`.
- **`app/_layout.tsx`** – Root: `AuthProvider` → `RootLayoutContent` → `TasksProvider`, Stack with `index`, `onboarding`, `(tabs)`, `task/[id]`.
- **`app/index.tsx`** – If not logged in → `/onboarding/`; if no `focus_type` → `/onboarding/focus-type`; else → `/(tabs)/maanta`.

### 5.3 Onboarding

- **`app/onboarding/auth.tsx`** – Sign in / Sign up (email + password) via `useAuth().signIn` / `signUp`. On success, redirects to focus-type or main app.
- **`app/onboarding/focus-type.tsx`** – User picks focus type (Student, Shaqo, Ganacsi, Horumar Shakhsi); saved to `profiles.focus_type`.
- **`app/onboarding/notifications.tsx`** – Notification permission and preference; then into main app.

### 5.4 Tabs (main app)

- **`app/(tabs)/_layout.tsx`** – Bottom tabs: **Maanta**, **Hawlaha**, **Yoolalka**, **Iska xir** (Focus), **Settings**.
- **`app/(tabs)/maanta.tsx`** – “Today”: tasks due today + overdue, from `useTasks()`; add via `AddTaskSheet`; complete/delete; navigate to `task/[id]`.
- **`app/(tabs)/hawlaha.tsx`** – “Tasks”: section list (overdue, due today, upcoming, optional completed); same task CRUD + goal link.
- **`app/(tabs)/yoolalka.tsx`** – “Goals”: `useGoals()`; goal cards with progress; goal reminder settings (day, time, interval); add goals via `AddGoalSheet`.
- **`app/(tabs)/focus.tsx`** – “Iska xir”: focus timer, duration presets, app blocking (Android native module), strict mode, scheduled focus blocks from `focus_schedules`; logs to `focus_sessions` via `useFocusSettings().logSession`.
- **`app/(tabs)/dejinta.tsx`** – “Settings”: account email/focus type, notifications toggle, logout.

### 5.5 Task detail

- **`app/task/[id].tsx`** – Modal to view/edit a single task (title, date, time, priority, goal, reminder); uses `useTasks().updateTask` and notifications.

### 5.6 Key hooks and services

- **`hooks/useAuth.tsx`** – Session + profile from Supabase Auth and `profiles`; signUp, signIn, signOut; updateFocusType, updateNotificationsEnabled, updateGoalReminder. Cleans focus session storage on signOut.
- **`hooks/useTasks.ts`** – Tasks from `tasks` table, filtered by `user_id`; realtime subscription; addTask, completeTask, deleteTask, updateTask; schedules/cancels Expo notifications for due/reminder.
- **`hooks/useGoals.ts`** – Goals from `goals` + task counts from `tasks`; realtime for goals and task updates; addGoal, deleteGoal; returns goals with progress and days remaining.
- **`hooks/useFocusSettings.ts`** – Reads/writes `profiles.focus_*` (blocked apps, default duration, strict mode); `logSession()` inserts into `focus_sessions`.
- **`hooks/useScheduledBlocking.ts`** – CRUD for `focus_schedules` (pending/active); addSchedule, cancelSchedule, updateScheduleStatus.
- **`services/supabase.ts`** – Supabase client (AsyncStorage for auth persistence).
- **`services/types.ts`** – Shared TS types: Profile, Task, Goal, FocusSession, FocusSchedule.
- **`services/notifications.ts`** – Expo notifications: task due/reminder, goal reminder (using profile reminder day/time/interval).
- **`services/focusBlocking.ts`** – Wrapper around native `focus-blocking` module: permissions, getInstalledApps, startBlocking/stopBlocking. On Android uses Usage Access + Overlay; plugin `withFocusBlocking.js` is a no-op (iOS family controls removed).

### 5.7 Native focus blocking

- **`modules/focus-blocking/`** – Expo module for Android app blocking (and placeholder for iOS). Used when not in Expo Go; `isNativeBlockingAvailable` is false in Go.

### 5.8 Config

- **`app.json`** – App name “Qorsheyn”, slug `productivityapp`, iOS bundle `com.app.qorsheyn`, Android package `com.productivityapp.abaabulka`; Expo Router, notifications, datetimepicker, `withFocusBlocking` plugin.
- **`eas.json`** – EAS Build config (if present).

---

## 6. Data flow summary

1. **Auth**: Sign up/in → Supabase Auth → trigger creates `profiles` row → app stores session and fetches profile.
2. **Tasks**: All mutations go to `tasks` with `user_id`; RLS enforces ownership; realtime pushes updates to `useTasks`.
3. **Goals**: Same for `goals`; progress is computed in `useGoals` from `tasks` with `goal_id`.
4. **Focus**: Timer and scheduled blocks use `profiles` (focus settings) and `focus_schedules`; completed sessions are written to `focus_sessions`; Android blocking is via native module + `focus_blocked_apps` / `blocked_apps`.
5. **Notifications**: Task reminders and goal reminders are driven by `tasks` (due_date, due_time, reminder_minutes_before) and `profiles` (goal_reminder_*).

---

## 7. Summary

- **Supabase**: One project (`productivityapp`, id `hnflspjejmdwfmztvnpq`), five tables (`profiles`, `tasks`, `goals`, `focus_sessions`, `focus_schedules`) with RLS so every row is tied to `auth.uid()`.
- **App**: Somali-language productivity app (tasks, goals, focus timer, app blocking, scheduled blocks) built on Expo + Supabase, with realtime and notifications, and optional native Android focus blocking.

This document reflects the database (including RLS) and the codebase as of the current state.
