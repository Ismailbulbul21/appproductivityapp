# Group Focus Session — Detailed Technical Explanation

This document explains the **Group Focus** feature in detail: what it is, why it works the way it does, and how it fits your existing app and platforms.

---

## The Big Idea (Plain Language)

**Goal:** Several people start a focus session **together** — same apps blocked, same timer, same strict rules, and everyone unlocks at the **same time**.

**Two rules that everything else follows:**

1. **Blocking is always local** — Each phone blocks its own apps. No phone can block another phone’s apps.
2. **The server only coordinates** — It stores and shares: *when* to start, *when* to end, *which* apps to block, and *whether* strict mode is on. It does **not** push a “block” command to devices.

So: **blocking = on the device; coordination = on the server.**

---

## 1. Is It Technically Possible?

### Android — Yes (Fully Possible)

Your app already:

- Uses **UsageStats** to know which app is in the foreground.
- Shows an **overlay** when a blocked app is opened.
- Runs blocking in a **foreground service**.

For **group focus** you only add:

- **Shared session data** from the server: same `start_time`, `end_time`, `blocked_apps`, `strict_mode`.
- Each phone still runs `startBlocking(blocked_apps)` and `stopBlocking()` **locally** at the right times.

No new Android permissions are required for “group”; you keep using Usage Access, Overlay, and Foreground Service.

### iOS — Yes, But With Conditions

On iOS, the **only** supported way to block apps is:

- **Family Controls** (Screen Time API)
- **ManagedSettings**
- **AuthorizationCenter** (user approves once)
- **FamilyActivityPicker** (user picks apps on their device)
- **ManagedSettingsStore** (applies the block)

So group focus on iOS works like this:

- Each user **authorizes** Family Controls on **their own** device.
- Each user **selects** (or the app maps) which apps to block — you **cannot** send “app tokens” from one device to another; Apple does not allow that.
- The server only shares **timing and configuration** (start/end, strict mode, and a *logical* list like “Instagram, TikTok” that each device maps to its local selection).
- Each device blocks **locally** at `start_time` and unblocks at `end_time`.

You must keep the **Family Controls entitlement**; without it, app blocking is not allowed on iOS.

---

## 2. Can One Phone Control Another?

**No.**

There is **no** API on Android or iOS that lets:

- Device A remotely block or unblock apps on Device B.

So:

- You **cannot** have “one phone as controller” that turns blocking on/off on friends’ phones.
- You **can** have a **server** that stores the session (start, end, apps, strict mode), and **each** phone reads that and runs blocking **on itself**.

Analogy:

- **Server** = referee (defines the rules and the clock).
- **Phones** = players (each follows the same rules on their own device).

---

## 3. What “Group” Means Technically

“Group” does **not** mean “remote control.” It means **shared session configuration**:

| Concept        | Meaning |
|----------------|--------|
| Same session   | One `focus_group_session` row (same id, invite_code). |
| Same start     | Same `start_time` (e.g. 14:00 UTC). |
| Same end       | Same `end_time` = start_time + duration. |
| Same rules     | Same `blocked_apps` (Android: package names; iOS: each device maps to local selection). |
| Same strictness| Same `strict_mode` (e.g. no “End early” button). |

**At `start_time`:**  
Every device that joined the session calls:

```ts
startBlocking(blocked_apps)
```

**At `end_time`:**  
Every device calls:

```ts
stopBlocking()
```

So “group” = **same config + same clock**, each device executing blocking locally.

---

## 4. Permissions (What You Already Have vs New)

### Android

Already in use:

- **Usage Access** — to detect which app is in foreground.
- **Draw over other apps** — for the blocking overlay.
- **Foreground Service** — to keep blocking active.

For **group focus** you do **not** need any new permission. You only add server-side session data and sync logic.

### iOS

Required:

- **Family Controls** capability in the app.
- **User authorization** on each device (AuthorizationCenter).
- User selects apps **on that device** (FamilyActivityPicker); you cannot transfer “block tokens” between devices.

No extra system permission for “group”; the only extra is your backend (sessions + members).

---

## 5. Platform Limitations (What You Cannot Guarantee)

### Android

Users can always:

- **Force stop** your app.
- **Revoke** “Draw over other apps” or Usage Access.

You can:

- In **strict mode**: hide “End early” and make the overlay non-dismissible *within the app*.
- You **cannot** prevent a determined user from going to system settings and revoking permissions or force‑stopping the app.

So: strict mode is “as strict as the app can be,” not “unbreakable by the OS.”

### iOS

- Each user **must** select (or confirm) apps **locally**; you cannot send a list of “tokens” from another device.
- **App Review** may ask why you use Family Controls; you need a clear, honest explanation (e.g. “optional focus/study mode where the user chooses which apps to block for a set time”).
- There is no “remote lock” of another device.

---

## 6. Recommended Architecture (Scalable and Clear)

### Principle

- **Blocking** = local (each device runs `startBlocking` / `stopBlocking`).
- **Coordination** = server (Supabase): who is in the session, when it starts/ends, which apps, strict mode.

### Backend Tables (Supabase)

**1. `focus_group_sessions`**

Stores the **shared** focus session (one row per group session).

| Column              | Type      | Purpose |
|---------------------|-----------|--------|
| `id`                | uuid (PK) | Session id. |
| `creator_id`        | uuid (FK) | User who created the session. |
| `invite_code`       | text      | Short code to join (e.g. `ABC123`). Unique, shareable. |
| `start_time`        | timestamptz | When everyone should start blocking. |
| `end_time`          | timestamptz | When everyone should stop (start_time + duration). |
| `duration_minutes`  | integer   | Length of the session. |
| `blocked_apps`      | jsonb     | List of app ids (Android: package names; iOS: logical names each device maps locally). |
| `strict_mode`       | boolean   | If true: hide “End early”, non-dismissible overlay where possible. |
| `status`            | text      | e.g. `scheduled` / `active` / `ended` / `cancelled`. |
| `created_at`        | timestamptz | When the session was created. |

**2. `focus_group_members`**

Stores who is in which group session and their join state.

| Column       | Type      | Purpose |
|-------------|-----------|--------|
| `id`        | uuid (PK) | Member row id. |
| `session_id`| uuid (FK) | References `focus_group_sessions.id`. |
| `user_id`   | uuid (FK) | References auth user. |
| `status`    | text      | e.g. `invited` / `accepted`. |
| `joined_at` | timestamptz | When they joined (or accepted). |

RLS: users can read sessions they’re members of; only creator can update session (e.g. cancel); users can insert/update their own row in `focus_group_members`.

---

## 7. End-to-End Flow

### Step 1 — Create session (creator)

- User chooses: **start time**, **duration** (e.g. 1h, 2h), **apps to block**, **strict mode**.
- App computes: `end_time = start_time + duration`.
- App calls Supabase: insert into `focus_group_sessions` (creator_id, invite_code, start_time, end_time, duration_minutes, blocked_apps, strict_mode, status = `scheduled`).
- Generate short **invite_code** (e.g. 6 alphanumeric), store in same row.
- Creator is also added to `focus_group_members` (status = `accepted`).

### Step 2 — Invite others

- Share **invite_code** (e.g. `ABC123`) or link: `app://group/ABC123` (or your app’s deep link).
- Others open the app and go to “Join group focus” → enter code.

### Step 3 — Join

- App looks up `focus_group_sessions` by `invite_code`.
- If found and status is `scheduled` and `start_time` is in the future (optional rule), insert into `focus_group_members` (session_id, user_id, status = `accepted`).
- Show session details: start time, end time, duration, blocked apps, strict mode.

### Step 4 — Start (when current time ≥ start_time)

- **Each** device (creator and members) does:
  - If not already blocking: fetch session (start_time, end_time, blocked_apps, strict_mode).
  - Call `startBlocking(blocked_apps)` **locally**.
  - Show countdown to `end_time` (same end time for everyone).
  - If strict_mode: hide “End early” and make overlay non-dismissible (where the OS allows).

So the server does **not** send “start now”; each app decides “now >= start_time” and starts locally. Optional: update `focus_group_sessions.status` to `active` when first device starts (for UI only).

### Step 5 — End (when current time ≥ end_time)

- **Each** device:
  - Calls `stopBlocking()` **locally**.
  - Optionally: update session status to `ended` (e.g. once per session).

Again: the server only stores the end time; each device unblocks itself at that time.

### Strict mode (reminder)

- For **group** sessions you typically **force** strict mode:
  - Hide “End early” in the UI.
  - Android: overlay not dismissible (your overlay implementation).
  - Unlock **only** at `end_time` (or when the app sees current time >= end_time).

---

## 8. Offline / Late Join

If a user is **offline** at `start_time`:

- When the app comes back online (or when they open the app):
  - Fetch the session (or use cached session) and check: `now < end_time`?
  - If **yes**: start blocking **immediately** with **remaining** time (end_time - now) and the same `blocked_apps` and strict_mode.
- So “airplane mode to avoid blocking” does **not** work: as soon as the app runs and sees that we’re still before `end_time`, it starts blocking for the remaining duration.

You can store last-known session (e.g. in AsyncStorage) so that even without network, if `now < end_time` the device can start blocking with remaining time.

---

## 9. Summary Table (Technical Truths)

| Question | Answer |
|----------|--------|
| Is group blocking possible? | **Yes.** |
| Can one device control another’s blocking? | **No.** |
| Must each device block locally? | **Yes.** |
| Is strict mode 100% unbreakable? | **No** (user can force stop / revoke permissions). |
| Is Android easier than iOS for this? | **Yes** (same apps list; no per-device app picker). |
| Does iOS require Family Controls entitlement? | **Yes.** |
| Do we need new Android permissions for group? | **No.** |
| What does the server do? | Stores and serves session config (times, apps, strict_mode); does **not** trigger block/unblock on devices. |

---

## 10. What This Means For Your App

- The feature is **technically valid**, **scalable**, and **platform-compliant** if:
  - Blocking stays local.
  - Server only coordinates (sessions + members + config).
  - iOS keeps Family Controls and each device does its own app selection where required.
- Main implementation work:
  - **Backend:** `focus_group_sessions` + `focus_group_members` + RLS + APIs (create session, join by code, get session).
  - **App (focus.tsx):** New “Group focus” entry point: create session UI, join-by-code UI, and a “group session” mode that uses `start_time` / `end_time` / `blocked_apps` / `strict_mode` from the server and calls your existing `startBlocking` / `stopBlocking` at the right times, with strict UX when `strict_mode` is true.
  - **Offline:** When app opens, if there’s an active group session and `now < end_time`, start blocking for remaining time.

This document is the detailed explanation of the Group Focus feature as specified; next step is to implement the DB migrations and then the UI/flows in `app/(tabs)/focus.tsx`.
