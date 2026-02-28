# Focus blocking: overlay removed too early — blocked apps become usable before timer ends

## Summary

During a focus session, when the user opens a blocked app they see the correct overlay (“Focus session waa socda”, “Ka noqo app-ka”). After roughly 5 seconds the overlay disappears and the user can use the blocked app even though the focus timer has not ended. **Requirement:** blocked apps must only become accessible when the focus timer has actually ended.

---

## Current behavior

1. User starts a focus session in the app and selects apps to block.
2. Native `FocusBlockingService` starts and monitors the foreground app every 1 second.
3. User opens a blocked app → overlay is shown on top (correct).
4. After about 10 seconds the overlay is removed by the service.
5. User is left inside the blocked app and can use it for the rest of the session.
6. Blocking only fully stops when the user ends the session in the app (or timer ends and app calls `stopBlocking()`).

So: **blocking is not enforced for the full session;** the overlay goes away too early due to service logic, not because the session ended.

---

## Expected behavior

- **While the focus timer is running:** If the user opens any blocked app, they must see the overlay and must **not** be able to use that app. The overlay may be removed only when we are sure the user has left the blocked app (e.g. they are back in our app or the launcher), so we don’t show the overlay on the wrong screen.
- **When the focus timer has ended:** The app calls stop blocking (e.g. `stopBlocking()`), the service stops, overlay is removed, and blocked apps become accessible. **Blocked apps may only become accessible when the timer/session has ended.**

---

## Root cause (technical)

All logic below is in:

**File:** `modules/focus-blocking/android/src/main/java/expo/modules/focusblocking/FocusBlockingService.kt`

### Monitoring loop (runs every `CHECK_INTERVAL` = 1000 ms)

- `startMonitoring()` posts a `Runnable` that runs every second.
- Each run:
  - Calls `currentForegroundPackage()` to get the “current” foreground app.
  - If `fg != null && blockedPackages.contains(fg) && fg != packageName` → `showOverlay()`.
  - **Else** → `removeOverlay()`.

So the overlay is **removed whenever the reported foreground app is not in the blocked list** (including when it is `null`, our app, or the launcher).

### How `currentForegroundPackage()` works

- Uses `UsageStatsManager.queryEvents(now - 5000, now)` (events from the last 5 seconds).
- Iterates over events and keeps the **last** `ACTIVITY_RESUMED` event’s package name.
- Returns that package (or null if none).

### Why the overlay disappears after ~10 seconds

- When the user opens a blocked app, we get that package and show the overlay (correct).
- On subsequent runs (every 1 s), we call `currentForegroundPackage()` again.
- `UsageStatsManager` can **delay or batch** usage events. The “last ACTIVITY_RESUMED in the last 5 seconds” can therefore sometimes **not** be the blocked app (e.g. launcher or another app, or no event → null).
- When that happens, the condition fails and we hit **else** → **removeOverlay()**.
- So we remove the overlay even though the user is still on the blocked app (they were only looking at our overlay). After removal, they can use the blocked app. The “~10 seconds” is roughly how long it takes for one of these unreliable “foreground” readings to trigger removal.

**In short:** We remove the overlay whenever “current foreground” is not in the blocked list. That check is unreliable when the overlay is already showing (delays in usage events / 5-second window), so we wrongly remove the overlay and the user can use the app before the timer ends.

---

## What must change (requirements for the fix)

1. **Overlay removal must not depend on a single “foreground not in blocked list” reading.**  
   Do **not** call `removeOverlay()` in the else branch of the current “if blocked then show else remove” logic, because that causes the bug.

2. **Remove the overlay only when we are confident the user has left the blocked app.**  
   For example: remove only when `currentForegroundPackage()` is:
   - Our app’s package (`packageName`), or  
   - A known launcher package (e.g. common launcher package names), or  
   - Some other clear “user left the blocked app” signal.  
   If the result is `null` or an unknown package, **keep the overlay** (do not remove). Prefer false positives (overlay stays a bit longer) over false negatives (user can use blocked app early).

3. **Optional hardening:**  
   - Only remove overlay after the “user left” state is stable (e.g. same “safe” foreground package for 2–3 consecutive checks), to avoid flicker or early removal due to a single bad reading.  
   - Or: once the overlay is shown, keep it until we see a clear transition to our app or launcher (e.g. ACTIVITY_RESUMED for our package or launcher), instead of removing on any “not blocked” result.

4. **Session lifecycle unchanged:**  
   Blocking still starts when the app starts the focus session and stops only when the app calls stop blocking (e.g. when the timer ends or user ends session). The service does not need to know timer duration; it only needs to stop when told. No change required to “when” the service is started or stopped—only to **when we remove the overlay** while the service is running.

5. **“Ka noqo app-ka” button:**  
   Already launches our app and we can remove the overlay in that case (user is leaving the blocked app). That behavior can stay; the fix is about not removing the overlay when we are not sure the user left.

---

## Files to modify

- **Primary:** `modules/focus-blocking/android/src/main/java/expo/modules/focusblocking/FocusBlockingService.kt`
  - Change the monitoring loop so that we do not call `removeOverlay()` in the current else branch.
  - Implement “remove overlay only when foreground is our app or launcher (or other safe package); otherwise keep overlay.”
  - Optionally add a small stability check (e.g. require 2–3 consecutive “safe” foreground readings before removing).

No changes to the React Native / Expo side are required for this fix; the app already starts and stops blocking at the right times. The bug is entirely in the Android overlay removal logic.

---

## Success criteria

- User starts focus session and opens a blocked app → overlay appears.
- Overlay stays visible for the full time the user remains on that blocked app, regardless of how long they stay (e.g. 30+ seconds), until they leave (e.g. tap “Ka noqo app-ka” or go back to launcher).
- Blocked apps only become usable again after the focus timer has ended and the app has stopped the blocking service.
