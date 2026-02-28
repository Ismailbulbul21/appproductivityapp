# Focus session shows for wrong account after logout

## Issue summary

When User A starts a focus session (chooses apps to block, sets timer, taps "Bilow focus"), then logs out ("Ka bax"), and User B logs in with a new account and opens the Focus tab, User B sees the **timer and blocking from User A's session**. The focus session is not cleared on logout and is not tied to the logged-in user.

---

## Root cause

### 1. Active focus session is stored only on the device (AsyncStorage)

**File:** `app/(tabs)/focus.tsx`

When a focus session starts, we save to **AsyncStorage** (device-local, not Supabase):

- `focus_session_end_time_ms`
- `focus_session_start_time_ms`
- `focus_session_blocked_apps`

We **do not store the user id** with this data. So the app cannot tell "this session belongs to User A." It is just "there is a session on this device."

### 2. Restore runs for whoever opens Focus

In the same file, a **useEffect on mount** (when the Focus tab loads):

- Reads the three keys from AsyncStorage.
- If `end_time` exists and is still in the future, it **restores** the session: shows the timer screen, calls `startBlocking(blockedApps)`, and starts the countdown.

There is **no check** that the session belongs to the **current** user. So any user who opens Focus on that device can see and run the previous user's session.

### 3. Logout does not clear the session

- **"Ka bax" button:** `app/(tabs)/dejinta.tsx` — calls `signOut()` and navigates to auth. It does **not** clear AsyncStorage or stop native blocking.
- **signOut:** `hooks/useAuth.tsx` — only calls `supabase.auth.signOut()` and sets `session` / `profile` to `null`. It does **not**:
  - Remove `focus_session_end_time_ms`, `focus_session_start_time_ms`, `focus_session_blocked_apps` from AsyncStorage, or
  - Call `stopBlocking()`.

So when User A logs out, the previous user's focus session remains in AsyncStorage and (if still within the end time) is restored for User B.

### 4. Supabase is not the cause

- `profiles` (e.g. `focus_blocked_apps`, `focus_default_duration_minutes`) and `focus_sessions` are **per user** (user_id + RLS). The new account correctly loads their own profile and history.
- The **active** (currently running) focus session lives only in AsyncStorage and in the native blocking state — not in Supabase. So the bug is entirely in **local state and logout flow**.

---

## Solution

### 1. Clear focus session and stop blocking on logout

When the user signs out, we must:

1. **Clear the focus session from AsyncStorage**  
   Remove:
   - `focus_session_end_time_ms`
   - `focus_session_start_time_ms`
   - `focus_session_blocked_apps`

2. **Stop native blocking**  
   Call `stopBlocking()` so the device is no longer blocking apps for the previous account.

**Where to implement:**

- **Option A (recommended):** In `hooks/useAuth.tsx`, inside `signOut()`, before or after `supabase.auth.signOut()`:
  - Call `AsyncStorage.multiRemove([FOCUS_SESSION_END_TIME_KEY, FOCUS_SESSION_START_TIME_KEY, FOCUS_SESSION_BLOCKED_APPS_KEY])`.
  - Call `stopBlocking()` (import from `services/focusBlocking`).
  - The three key names are defined in `app/(tabs)/focus.tsx`; either duplicate them in `useAuth.tsx` or move to a small shared constants file (e.g. `constants/focus.ts`).
- **Option B:** In `app/(tabs)/dejinta.tsx`, inside the "Haa, Ka Bax" handler, before calling `signOut()`: same two steps (clear AsyncStorage, call `stopBlocking()`), then call `signOut()`.

Prefer **Option A** so that any other logout path (if added later) also clears the focus session.

### 2. (Optional) Tie stored session to current user

To make restore safe even if we ever forget to clear on logout:

- When **saving** the session (in `focus.tsx`, when starting a session), also store the current user id, e.g. `focus_session_user_id` (from `session?.user.id`).
- When **restoring** (in the same file, in the mount effect), after reading the three keys, check that `focus_session_user_id === session?.user.id`. If the user id is missing or does not match the current user, clear the three keys (and the user id key) and do **not** restore.

This way, if a different user opens Focus, we do not restore the previous user's session even if the keys were not cleared on logout.

---

## Implementation checklist

- [ ] On logout (`signOut` in `useAuth.tsx` or in Dejinta handler):
  - [ ] `AsyncStorage.multiRemove([FOCUS_SESSION_END_TIME_KEY, FOCUS_SESSION_START_TIME_KEY, FOCUS_SESSION_BLOCKED_APPS_KEY])`
  - [ ] `stopBlocking()` (from `services/focusBlocking`)
- [ ] (Optional) When saving a focus session, store `focus_session_user_id` (current user id).
- [ ] (Optional) When restoring, only restore if stored user id matches `session?.user.id`; otherwise clear keys and do not restore.

---

## Files to touch

| File | Change |
|------|--------|
| `hooks/useAuth.tsx` | In `signOut`: import AsyncStorage and focus session keys; call `AsyncStorage.multiRemove(...)` and `stopBlocking()`. |
| `app/(tabs)/focus.tsx` | (Optional) Save and check `focus_session_user_id` when persisting/restoring. |

---

## Success criteria

- User A starts a focus session, then logs out ("Ka bax"). User B logs in and opens Focus → User B sees the **Focus home** (no timer from User A) and no blocking from User A's session.
