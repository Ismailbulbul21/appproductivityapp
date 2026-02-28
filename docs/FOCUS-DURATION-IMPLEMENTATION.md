# Focus duration implementation guide

**Goal:** Add new wakhtiga (duration) design: minutes + hours + custom (1–120 min) + days (max 3 days). Display in human-friendly form (e.g. "25 daqiiqo", "1:30 hour", "1 maal", "3 maalmood"). Persist long sessions so blocking survives app restart.

**Reference prototype:** `components/focus-timer-prototype.html`

---

## What changes

### 1. App – duration presets and labels

**File:** `app/(tabs)/focus.tsx`

- **Replace** `DURATION_PRESETS` with:
  - **Minutes:** 1, 15, 25, 45 (stored as minutes; display e.g. "1 daqiiqo", "25 daqiiqo").
  - **Hours:** 60, 90, 120 (stored as minutes; display "1:00 hour", "1:30 hour", "2:00 hour").
  - **Days (max 3):** 1440 (1 day), 2880 (2 days), 4320 (3 days) — stored as total minutes; display "1 maal", "2 maalmood", "3 maalmood".
- **Add** a "Custom" option: user can type minutes (1–120). See **§ Custom duration (no issues)** below for validation and safeguards.
- **Add** a helper `formatDurationLabel(minutes)` that returns:
  - &lt; 60 → `"X daqiiqo"`
  - 60–&lt;1440 → `"H:MM hour"` (e.g. 90 → "1:30 hour")
  - ≥ 1440 → `"1 maal"` (1440), `"2 maalmood"` (2880), `"3 maalmood"` (4320)
- Use this helper for:
  - Chip/button labels in the duration picker.
  - The summary line under the chips (e.g. "25 daqiiqo" or "1:30 hour").
- **Timer display:** When remaining time ≥ 24 hours, show "Xd Yh" (e.g. "2d 14h") instead of a huge MM:SS. When &lt; 24 h, keep current MM:SS (or MM:SS).

### 2. App – persist active session (for 1–3 day blocks)

**Purpose:** So that when the user closes the app or restarts the phone during a 1–3 day block, we remember "blocking is on until [end time]" and re-apply blocking when they open the app again.

- **Save** when a focus session starts:
  - `focusSessionEndTime` (Unix timestamp in ms or seconds) = start time + (selectedMinutes * 60 * 1000) or equivalent.
  - `focusSessionBlockedApps` (array of package names or IDs).
  - e.g. in AsyncStorage: keys like `focus_session_end_time`, `focus_session_blocked_apps`, and maybe `focus_session_active` (boolean).
- **On app launch (or when Focus tab mounts):**
  - Read saved `focusSessionEndTime` and `focusSessionBlockedApps`.
  - If `focusSessionEndTime` exists and `Date.now() < focusSessionEndTime`:
    - Consider session still active. Call native `startBlocking(focusSessionBlockedApps)` so blocking is on again.
    - Show timer screen (or a "session still active" view) with remaining time in "Xd Yh" or "X days left" format.
  - If `Date.now() >= focusSessionEndTime` (or no saved session):
    - Clear saved session (remove from AsyncStorage). Do not start blocking. Show normal Focus home.
- **When session ends** (timer reaches 0 or user ends early):
  - Call native `stopBlocking()`.
  - Clear saved `focus_session_end_time`, `focus_session_blocked_apps`, `focus_session_active` from AsyncStorage.

**Where to implement:** Same file `app/(tabs)/focus.tsx` (or a small hook/context if you prefer). Use `AsyncStorage` (from React Native or Expo) for persistence.

### 3. Custom duration – make sure it works and doesn’t cause issues

**Goal:** Custom minutes (1–120) must always produce a valid duration and never break the timer or blocking.

- **Single source of truth:** Store one number `selectedDurationMinutes`. When Custom is selected, this comes from the custom input; otherwise from the preset. Never start a session with an invalid or out-of-range value.
- **Input validation:**
  - Only allow **whole numbers** (no decimals). Use a numeric keypad and strip non-digits or use `keyboardType="number-pad"` (React Native) so the user can’t type "12.5" or "abc".
  - **Clamp on change:** When the user types, clamp immediately: `value = Math.max(1, Math.min(120, parseInt(value, 10) || 1))`. So empty, NaN, or negative become 1; values &gt; 120 become 120.
  - **Clamp on blur / when starting session:** Right before starting a session, if Custom is selected, read the input again and clamp one more time: `minutes = Math.max(1, Math.min(120, parseInt(inputValue, 10) || 25))`. Use 25 (or your default) as fallback if the field is empty or invalid.
- **Before "Bilow focus":** When the user taps start, compute `durationMinutes` like this:
  - If a preset is selected: `durationMinutes = presetMinutes`.
  - If Custom is selected: `durationMinutes = clamp(parseInt(customInput, 10) || 25, 1, 120)`.
  - Then `durationSeconds = durationMinutes * 60` and pass that to the timer and native. Never pass 0, negative, or &gt; 120 for custom.
- **Display:** When Custom is selected, keep the summary line in sync with the clamped value (e.g. "37 daqiiqo" or "1:00 hour" for 60) so the user always sees what will actually be used.
- **Edge cases to avoid:**
  - User leaves Custom empty and taps Start → use fallback 25 (or 1), don’t crash or start with 0.
  - User types 999 → clamp to 120 and show "2:00 hour".
  - User types 0 or negative → clamp to 1 and show "1 daqiiqo".
  - User pastes "1h" or "30 min" → strip to digits or ignore; after parse failure use fallback 25.

**Checklist for Custom:**  
- [ ] Input is numeric only (number-pad), clamp 1–120 on change and on blur.  
- [ ] On Start: if Custom, `durationMinutes = clamp(parseInt(input, 10) || 25, 1, 120)`; never use raw input.  
- [ ] Summary label always reflects the value that will be used (after clamp).  
- [ ] Fallback 25 (or 1) when input is empty/invalid so session always starts with a valid duration.

### 4. App – default duration setting (if used)

- If you have a "default duration" in settings (e.g. in `useFocusSettings` or Supabase `profiles`), it can stay as a number (minutes). Allow values 1–4320 (3 days in minutes) if you want users to set a default up to 3 days. No schema change; only validation/UI if you expose days in settings.

---

## What does NOT change

- **Supabase:** No new tables, no new columns. Existing `focus_sessions.duration_seconds` (and any `default_duration_minutes`) stay as-is. You may send larger `duration_seconds` (e.g. 4320 * 60 for 3 days).
- **Native (Android / iOS):** No changes to `FocusBlockingService`, `FocusBlockingModule`, or iOS module. Blocking still starts with `startBlocking(appIds)` and stops with `stopBlocking()`. They don’t care about minutes vs days.
- **Session flow:** Start session → start blocking → run timer → when time’s up or user ends → stop blocking → clear state. Same flow; only duration range and display change.
- **Focus settings (blocked apps, strict mode):** No change. Same list of blocked apps passed to native.

---

## Implementation checklist

1. **Duration presets and UI**
   - [ ] Update `DURATION_PRESETS` (or equivalent) to include 1, 15, 25, 45, 60, 90, 120, 1440, 2880, 4320 minutes with labels (daqiiqo / hour / maal / maalmood).
   - [ ] Add "Custom" path: input 1–120 minutes, clamped.
   - [ ] Add `formatDurationLabel(minutes)` and use it for chip labels and summary line.
   - [ ] Timer display: when remaining ≥ 24 h, show "Xd Yh"; otherwise keep MM:SS.

2. **Persistence for long sessions**
   - [ ] When starting a session: save `focusSessionEndTime` and `focusSessionBlockedApps` (e.g. AsyncStorage).
   - [ ] On app open / Focus mount: if saved end time exists and `now < endTime`, call `startBlocking(blockedApps)` and show timer / "session active" with "Xd Yh".
   - [ ] When session ends (timer 0 or user end): call `stopBlocking()`, clear saved session from AsyncStorage.

3. **Custom duration (no issues)**
   - [ ] Custom input: numeric only, clamp 1–120 on change and on blur; fallback 25 when empty/invalid.
   - [ ] On "Bilow focus": if Custom selected, use `clamp(parseInt(input, 10) || 25, 1, 120)`; never pass raw or invalid value to timer/native.
   - [ ] Summary line always shows the clamped value (e.g. "37 daqiiqo" or "2:00 hour" for 120).

4. **Other edge cases**
   - [ ] If user selects 1–3 days and starts session, ensure `duration_seconds` (or equivalent) passed to any logging/Supabase is `selectedMinutes * 60`.
   - [ ] Presets can go up to 4320 (3 days); Custom stays 1–120 only.

---

## Summary

| Area | Change | Notes |
|------|--------|--------|
| Focus tab UI | Yes | New presets, labels, Custom 1–120, formatDurationLabel, "Xd Yh" for long timer. |
| Persistence | Yes | Save end time + blocked apps; restore and re-call startBlocking on app open. |
| Supabase | No | Same schema; may send larger duration_seconds. |
| Native | No | Same start/stop blocking API. |

After these changes, users can pick minutes (1–120), hours (1:00, 1:30, 2:00), or days (1 maal, 2 maalmood, 3 maalmood), see human-friendly labels, and 1–3 day blocks will survive app restart by re-applying blocking when the app is opened again.
