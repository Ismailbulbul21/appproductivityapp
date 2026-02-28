# Group Focus — Implementation Spec (Push 4.6)

This document is the **build specification** for the **Group Focus** feature so the team can implement it in the app (e.g. push 4.6).

---

## 1. Feature Summary

**Name:** Focus kooxda (Group Focus)

**What it does:**  
Multiple users join the **same** focus session: same start time, same end time, same blocked apps, same strict mode. Everyone unlocks at the **same** time. Blocking runs **locally** on each device; the **server only coordinates** (stores session config and invite code).

**Key rules:**
- Blocking = **local** (each phone calls `startBlocking` / `stopBlocking` at the shared times).
- Server = **coordination only** (session + members + start/end/apps/strict_mode).
- No remote control: one device cannot block another; each device blocks itself using the same config.

**Reference:**
- Design prototype: `components/focus-timer-prototype.html` (Group Focus section).
- Concept doc: `docs/GROUP-FOCUS-FEATURE-EXPLAINED.md`.

---

## 2. Backend (Supabase)

**Project:** `productivityapp` (id: `hnflspjejmdwfmztvnpq`).

### 2.1 New tables

#### `focus_group_sessions`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|--------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `creator_id` | uuid | NO | — | FK → auth.users(id) |
| `invite_code` | text | NO | — | Unique, 6 chars (e.g. ABC123), uppercase |
| `start_time` | timestamptz | NO | — | When all devices should start blocking |
| `end_time` | timestamptz | NO | — | start_time + duration |
| `duration_minutes` | integer | NO | — | Session length (e.g. 25, 60, 120) |
| `blocked_apps` | jsonb | NO | '[]' | Array of app ids: Android = package names; iOS = logical names for local mapping |
| `strict_mode` | boolean | NO | true | Group sessions: no “End early”; unlock only at end_time |
| `status` | text | NO | 'scheduled' | One of: scheduled, active, ended, cancelled |
| `created_at` | timestamptz | NO | now() | |

**Constraints:**
- `invite_code` UNIQUE.
- `status` CHECK IN ('scheduled', 'active', 'ended', 'cancelled').

**Indexes:**
- `focus_group_sessions_invite_code_key` UNIQUE on `invite_code`.
- Index on `(creator_id, status)` and on `start_time` if needed for queries.

#### `focus_group_members`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|--------|
| `id` | uuid | NO | gen_random_uuid() | PK |
| `session_id` | uuid | NO | — | FK → focus_group_sessions(id) ON DELETE CASCADE |
| `user_id` | uuid | NO | — | FK → auth.users(id) |
| `status` | text | NO | 'accepted' | invited | accepted |
| `joined_at` | timestamptz | NO | now() | |

**Constraints:**
- UNIQUE(session_id, user_id) — one membership per user per session.
- `status` CHECK IN ('invited', 'accepted').

**Indexes:**
- Index on `session_id` (for “list members”).
- Index on `user_id` (for “my group sessions”).

### 2.2 RLS policies

**focus_group_sessions**
- **SELECT:** User can see session if they are creator OR they have a row in `focus_group_members` for this session.
- **INSERT:** Authenticated user only; `creator_id` must equal `auth.uid()`.
- **UPDATE:** Only `creator_id` can update (e.g. cancel, or set status to active/ended).
- **DELETE:** Only `creator_id` can delete (optional; prefer soft cancel via status).

**focus_group_members**
- **SELECT:** User can see members of sessions they are in (creator or member).
- **INSERT:** Authenticated user; either creator adding someone, or user_id = auth.uid() for self-join.
- **UPDATE:** User can update own row only (e.g. status invited → accepted).
- **DELETE:** Creator can delete any member; user can delete own row (leave).

### 2.3 Invite code

- Generate **6-character alphanumeric** (e.g. A–Z, 0–9), uppercase.
- Ensure **UNIQUE** in `focus_group_sessions` (retry on conflict).
- Example: `ABC123`, `X7K9M2`.

### 2.4 Triggers / functions (optional)

- When first member (or creator) “starts” at start_time, optionally set `focus_group_sessions.status` to `active`.
- When end_time has passed, set `status` to `ended` (e.g. via cron or on next app open).

---

## 3. App Types (services/types.ts)

Add:

```ts
export interface FocusGroupSession {
  id: string;
  creator_id: string;
  invite_code: string;
  start_time: string;   // ISO
  end_time: string;     // ISO
  duration_minutes: number;
  blocked_apps: string[];
  strict_mode: boolean;
  status: 'scheduled' | 'active' | 'ended' | 'cancelled';
  created_at: string;
}

export interface FocusGroupMember {
  id: string;
  session_id: string;
  user_id: string;
  status: 'invited' | 'accepted';
  joined_at: string;
}
```

---

## 4. Hooks / Data Layer

### 4.1 useGroupFocus (or split into useGroupSession + useGroupMembers)

**Responsibilities:**
- **Create session:** Insert `focus_group_sessions` (generate invite_code), insert creator into `focus_group_members`.
- **Join by code:** Look up session by `invite_code`; if found and status = scheduled and start_time in future (optional), insert into `focus_group_members` (user_id = auth.uid(), status = accepted).
- **Get session:** Fetch session by id or invite_code; fetch members for that session.
- **List my sessions:** Sessions where user is creator or in `focus_group_members` (status scheduled/active).
- **Cancel session:** Creator only; set status = cancelled.
- **Leave session:** Delete own row from `focus_group_members` (or set status left if you add that).

**Realtime (optional):** Subscribe to `focus_group_sessions` and `focus_group_members` for the current session so members list and status updates live.

### 4.2 Group session timer logic (focus.tsx or shared util)

- **When to start blocking:** `now >= session.start_time` (and user has joined).
- **When to stop blocking:** `now >= session.end_time`.
- **Offline / late join:** If app opens and `now < session.end_time`, start blocking **immediately** for **remaining** time (`session.end_time - now`), using `session.blocked_apps` and `session.strict_mode`.
- Persist current group session id + end_time locally (e.g. AsyncStorage) so that after app kill, on next open, if `now < end_time` still, resume blocking for remaining time.

---

## 5. UI Flows (Reference: focus-timer-prototype.html)

Implement in **Focus tab** (`app/(tabs)/focus.tsx`). Add a **Group Focus** entry point (card or section) that leads to:

### 5.1 Focus home

- New card: **“Focus kooxda”** (Group Focus) → navigates to **Group choices** (Create vs Join).

### 5.2 Group choices

- **Abuur session cusub** → open **Create group** modal/sheet.
- **Ku biir code-ka** → go to **Join by code** screen.
- Back → Focus home.

### 5.3 Create group (modal/sheet)

- **Start:** date + time picker (start_time).
- **Duration:** chips (e.g. 25m, 45m, 1h, 1:30, 2h).
- **Blocked apps:** same picker as solo focus (Android: package names; iOS: local selection).
- **Strict mode:** checkbox on (default true for group); label e.g. “Ma jiraan End early, isla end_time ayaa la furin”.
- **Submit:** Create session in DB, generate invite_code, add creator to members → navigate to **Invite / share code**.

### 5.4 Invite / share code (creator)

- Display **invite_code** prominently (e.g. large copyable text).
- Copy button (clipboard).
- Optional: share link `app://group/{invite_code}` or universal link.
- Show member list (creator first); update via realtime if desired.
- Actions: “Sug bilaabashada” (go to waiting screen), “Ka bax” (leave group flow / cancel session if creator).

### 5.5 Join by code

- Single input: 6-character **invite code** (e.g. placeholder ABC123).
- Validate: lookup session by invite_code; if found and joinable, insert member → show **Waiting for start**.
- Error: invalid or expired code.
- Back → Group choices.

### 5.6 Waiting for start (creator + members)

- Show session: start_time, end_time, duration, blocked apps, strict_mode.
- Show **member list** (pills or list).
- Countdown to start_time if desired.
- **Leave:** remove self from members (or cancel if creator); return to Focus home.
- When **now >= start_time**: auto-navigate to **Group timer** and call `startBlocking(blocked_apps)` locally.

### 5.7 Group timer (active)

- Same circular timer as solo focus; countdown to **session.end_time** (same for everyone).
- Badge: “Focus kooxda” / “X xubnood • Strict mode”.
- **No “End early” button** (strict mode); optionally show disabled button with tooltip.
- When **now >= end_time**: call `stopBlocking()` locally; optionally log to `focus_sessions`; navigate back to Focus home; mark session ended in DB if needed.

### 5.8 Offline / late join

- If user opens app and has a stored group session with `end_time > now`, start blocking immediately for remaining time (same blocked_apps, strict mode).
- No “cheating” by going offline: once app runs and sees active group session, it enforces blocking until end_time.

---

## 6. Copy (Somali) — Reference

Use the same labels as in the prototype where applicable:

- Focus kooxda / Group focus
- Bilow ama ku biir
- Abuur session cusub
- Ku biir code-ka
- Geli code-ka (e.g. ABC123)
- Wadaag code-ka
- Session-ka waa diiwaan gashay / Sug bilaabashada
- Strict mode: ma jiraan “End early”
- Wakhti socda (group timer)
- X xubnood • Strict mode

---

## 7. Technical Checklist

- [ ] Supabase: Create `focus_group_sessions` table (all columns, constraints, unique invite_code).
- [ ] Supabase: Create `focus_group_members` table (session_id, user_id, status, unique (session_id, user_id)).
- [ ] Supabase: RLS for both tables (SELECT/INSERT/UPDATE/DELETE as above).
- [ ] App: Add `FocusGroupSession` and `FocusGroupMember` to `services/types.ts`.
- [ ] App: Implement invite_code generation (6-char, unique).
- [ ] App: Hook(s) for create session, join by code, get session, list members, cancel, leave.
- [ ] App: Focus tab — Group Focus card → Group choices → Create (modal) + Join (screen).
- [ ] App: Create flow → Invite screen (show code, copy, share) → Waiting.
- [ ] App: Join flow → Enter code → Waiting.
- [ ] App: Waiting screen — show session + members; when now >= start_time → Group timer + startBlocking(blocked_apps).
- [ ] App: Group timer — countdown to end_time; no End early; at end_time → stopBlocking(), navigate home.
- [ ] App: Persist active group session (session id, end_time) locally; on app open, if now < end_time, start blocking for remaining time.
- [ ] App: Optional — realtime subscription for session + members.
- [ ] iOS: Keep Family Controls entitlement; group uses same local blocking; no sending app tokens between devices.
- [ ] Android: No new permissions; reuse existing blocking + overlay.

---

## 8. Files to Touch (Summary)

| Area | Files |
|------|--------|
| Backend | Supabase migrations (new tables + RLS). |
| Types | `services/types.ts` (FocusGroupSession, FocusGroupMember). |
| Data | New hook e.g. `hooks/useGroupFocus.ts` (or useGroupSession + useGroupMembers). |
| Focus UI | `app/(tabs)/focus.tsx` (Group card, Group choices, Create modal, Join screen, Waiting, Group timer). |
| Prototype | `components/focus-timer-prototype.html` (already done; reference only). |

---

## 9. Definition of Done (Push 4.6)

- Creator can create a group session (start time, duration, apps, strict mode) and get an invite code.
- Creator can share code; others can join by entering the code.
- At start_time, all joined devices start blocking the same apps locally; timer shows countdown to end_time.
- No “End early” in group strict mode; all unlock at end_time.
- Offline/late: if app opens before end_time, blocking starts for remaining time.
- Leave / cancel: creator can cancel; any member can leave; UI returns to Focus home.

This spec is the single source of truth for building Group Focus in push 4.6.
