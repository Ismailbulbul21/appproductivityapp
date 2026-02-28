# Prompt: Add Native App Blocking for Android and iOS (Focus Feature)

**Purpose:** This document is a prompt for an AI (e.g. Opus 4.6) or developer to implement **real app blocking** in the Xasuus productivity app. The Focus UI, timer, and Supabase integration are **already built**. Your job is to add **native modules** so that when a user starts a focus session, blocked apps are actually blocked (Android: overlay; iOS: system shield). Use a **development build** or **production build** (EAS); blocking will not work in Expo Go.

---

## 1. What Already Exists (Do Not Rebuild)

- **Focus tab:** `app/(tabs)/focus.tsx` – home screen, “Bilow focus session” card, blocked-apps list, strict mode toggle.
- **New session sheet:** Duration presets (1, 15, 25, 45, 60, 90, 120 min), “Bilow focus” button. On tap it calls `startSession()` which starts the JS timer and navigates to the timer screen. **You must add a call to native “start blocking” here.**
- **Timer screen:** Countdown (HH:MM:SS / MM:SS), “Dhamaystir session” button (hidden when strict mode). When timer hits 0 or user ends, it calls `endSession(completed)`. **You must add a call to native “stop blocking” here.**
- **App picker:** Currently uses a **demo list** (`DEMO_BLOCKED_APPS` with ids like `"instagram"`, `"tiktok"`). On Android you must replace this with a **native module that returns the real list of installed apps** (package name + label). Selected package names are saved via `setBlockedApps(selectedApps)` to Supabase (`profiles.focus_blocked_apps`). On iOS you must use the **system FamilyActivityPicker** (native); selection is **device-only** (AsyncStorage or in-memory), not sent to Supabase.
- **Supabase:** `profiles` has `focus_blocked_apps` (jsonb array), `focus_default_duration_minutes`, `focus_strict_mode`. `focus_sessions` table exists for logging. No schema changes needed.
- **Hook:** `hooks/useFocusSettings.ts` – `settings.blockedApps` (string[]), `setBlockedApps(apps)`, `setStrictMode(bool)`, `logSession(...)`.

---

## 2. Goal (What You Must Implement)

1. **Android:** A native module (or Expo config plugin + module) that:
   - **Permissions:** Requests **Usage Access** (`PACKAGE_USAGE_STATS`) and **Display over other apps** (`SYSTEM_ALERT_WINDOW`) at runtime. Explain clearly in UI why they are needed.
   - **List installed apps:** Exposes a method to JS that returns a list of installed apps: `{ packageName: string, label: string }[]` (e.g. from `PackageManager.getInstalledApplications`). Used by the app picker to replace the demo list.
   - **Start blocking:** When the user taps “Bilow focus”, JS calls native with the list of **package names** to block (e.g. `["com.instagram.android", "com.zhiliaoapp.musically"]`). Native starts a **foreground service** that:
     - Uses **UsageStatsManager** / **UsageEvents** (or equivalent) to detect the **current foreground app** (package name).
     - If the foreground app is in the blocked list, show a **full-screen overlay** (`WindowManager`, `TYPE_APPLICATION_OVERLAY`) on top of it. Overlay content: lock icon, title **“Focus session waa socda”**, message **“App-kan waa la xirey. Ka noqo Xasuus ama sug inta timer uu dhammaado.”**, button **“Ka noqo app-ka”** (Back to Xasuus). On button tap: dismiss overlay and bring user back to the Xasuus app (e.g. launch our app’s launcher activity).
     - Keep the overlay visible until the user goes back or the session ends.
   - **Stop blocking:** When the timer ends or the user taps “Dhamaystir session”, JS calls native to **stop the foreground service** and **remove the overlay**. Blocked apps are usable again.

2. **iOS:** A native module (or library such as `react-native-device-activity`) that:
   - **Entitlement:** The app must have the **Family Controls** capability. Request the **Family Controls distribution entitlement** from Apple (developer.apple.com/contact/request/family-controls-distribution) for TestFlight/App Store. For local development, use the dev entitlement.
   - **Authorization:** Expose a method to request **Family Controls authorization** (one-time). Show the system prompt; store the authorized state.
   - **App picker:** Expose a method to present the **FamilyActivityPicker** (Family Controls). User selects apps/categories. Return the selection (tokens) to JS. **Do not send tokens to Supabase** – they are device-specific. Store in AsyncStorage or in-memory for the session.
   - **Start blocking:** When the user taps “Bilow focus”, JS calls native with the **current device selection** (from picker). Native calls **ManagedSettingsStore** (Family Controls) to **apply the shield** for that selection. When the user opens a blocked app, **iOS shows the system shield screen** (you can customize title/body via **Shield Configuration** in a ShieldConfigurationExtension: e.g. “Focus session waa socda”, “App-kan waa la xirey…”).
   - **Stop blocking:** When the timer ends or the user ends the session, JS calls native to **clear the ManagedSettingsStore shield**. Blocked apps are usable again.

3. **JS integration:** In `app/(tabs)/focus.tsx`:
   - **Start session:** Inside `startSession()`, after starting the timer and navigating to the timer screen, call the native “start blocking” API:
     - **Android:** Pass `settings.blockedApps` (array of package names from Supabase). If the app picker was switched to native, use the same array.
     - **iOS:** Pass the in-memory/AsyncStorage selection from the FamilyActivityPicker (not from Supabase). If the user never picked, pass empty and optionally show a hint to pick apps first.
   - **End session:** Inside `endSession()`, before or after clearing the timer state, call the native “stop blocking” API on both platforms.
   - Use a **bridge/interface** that is safe when the native module is not present (e.g. development build not yet done): e.g. `NativeModules.FocusBlocking?.startBlocking(blockedApps)` – if undefined, no-op so the app still runs in Expo Go as timer-only.

---

## 3. Android Implementation Details

- **Permissions in AndroidManifest:** Declare `PACKAGE_USAGE_STATS` (use with `Settings.ACTION_USAGE_ACCESS_SETTINGS`) and `SYSTEM_ALERT_WINDOW` (use with `Settings.canDrawOverlays()` and request overlay). **Foreground service:** Declare a foreground service type (e.g. `specialUse` or the appropriate type for “user-initiated” blocking) and add `FOREGROUND_SERVICE_SPECIAL_USE` if targeting newer SDK; show a persistent notification while blocking is active.
- **Foreground service:** Start when “start blocking” is called; stop when “stop blocking” is called. In the service, use a short-interval check (e.g. every 1–2 seconds) to get the current foreground app via `UsageStatsManager.getUsageStats()` or `UsageEvents` (query recent events, get the last launched package). If it’s in the blocked list, add/update the overlay window; if not, remove overlay. Use `WindowManager.addView()` with `LayoutParams.TYPE_APPLICATION_OVERLAY` and `FLAG_NOT_FOCUSABLE` or similar so the overlay doesn’t steal focus from the underlying app but still blocks touch (or use a full-screen transparent overlay with your block UI on top).
- **Overlay UI:** Simple layout: icon, title, message, button. Title: “Focus session waa socda”. Button: “Ka noqo app-ka”. On click: remove overlay and start the Xasuus app’s launcher activity (e.g. via `Intent` with our package’s launcher activity).
- **Listing apps:** In the native module, use `PackageManager.getInstalledApplications(0)` and filter to non-system (or include all and let user choose). For each, get `applicationInfo.packageName` and `loadLabel(packageManager)`. Return to JS as an array of `{ packageName, label }`. In `focus.tsx`, replace `DEMO_BLOCKED_APPS` on Android with this list; store selected **package names** in state and in `setBlockedApps(selectedPackageNames)`.

---

## 4. iOS Implementation Details

- **Frameworks:** Use **FamilyControls**, **ManagedSettings**, and optionally **DeviceActivity** and **ManagedSettingsUI** (Shield Configuration). All require the **Family Controls** capability and entitlement.
- **Authorization:** Call `AuthorizationCenter.requestAuthorization(for: .individual)` (or equivalent). Show the system UI; once authorized, you can use FamilyActivityPicker and ManagedSettingsStore.
- **FamilyActivityPicker:** Present the system picker (SwiftUI view or UIKit wrapper). On completion, you receive a `FamilyActivitySelection` (or equivalent). Store it in memory or serialize to AsyncStorage (if the framework allows encoding). Do **not** send to Supabase.
- **ManagedSettingsStore:** When starting blocking: call `ManagedSettingsStore().shield.applications = selection.applicationTokens` (and optionally `.categoryTokens`, `.webDomainTokens`). When stopping: set `.shield.applications = nil` (and clear categories/domains) so the shield is removed.
- **Shield Configuration:** To customize the block screen text, add a **Shield Configuration App Extension** (ManagedSettingsUI). Set the title to “Focus session waa socda” and the message to “App-kan waa la xirey. Ka noqo Xasuus ama sug inta timer uu dhammaado.” (or similar). This is the screen users see when they try to open a blocked app.
- **JS:** When opening the app picker on iOS, call the native method that presents FamilyActivityPicker. When the user confirms, native returns success (and optionally a flag “hasSelection”). Store the selection in native/AsyncStorage. When starting a session, call native “start blocking” with that stored selection (native reads it); when ending, call “stop blocking”.

---

## 5. Suggested Native API (JS Side)

Create a small bridge so the rest of the app stays unchanged. Example (implement the native side to match):

```ts
// services/focusBlocking.ts (or similar)
import { NativeModules, Platform } from 'react-native';

const { FocusBlocking } = NativeModules;

export async function startBlocking(blockedPackageNames: string[]): Promise<void> {
  if (!FocusBlocking?.startBlocking) return;
  if (Platform.OS === 'android') {
    await FocusBlocking.startBlocking(blockedPackageNames);
  }
  if (Platform.OS === 'ios') {
    await FocusBlocking.startBlocking(); // uses device-stored selection
  }
}

export async function stopBlocking(): Promise<void> {
  if (!FocusBlocking?.stopBlocking) return;
  await FocusBlocking.stopBlocking();
}

// Android only: get installed apps for picker
export async function getInstalledApps(): Promise<{ packageName: string; label: string }[]> {
  if (Platform.OS !== 'android' || !FocusBlocking?.getInstalledApps) return [];
  return FocusBlocking.getInstalledApps();
}

// iOS only: request authorization and show app picker
export async function requestFocusAuthorization(): Promise<boolean> {
  if (Platform.OS !== 'ios' || !FocusBlocking?.requestAuthorization) return false;
  return FocusBlocking.requestAuthorization();
}
export async function openAppPicker(): Promise<void> {
  if (Platform.OS !== 'ios' || !FocusBlocking?.openAppPicker) return;
  await FocusBlocking.openAppPicker();
}
```

In `focus.tsx`:
- In `startSession()`, after setting timer state and navigating, call `startBlocking(settings.blockedApps)` on Android, or `startBlocking()` on iOS (no args; native uses stored selection).
- In `endSession()`, call `stopBlocking()` at the start.
- For the app picker: on Android, if `getInstalledApps()` is available, use it to build the list and use package names as ids; on iOS, call `requestFocusAuthorization()` then `openAppPicker()` when user taps “Beddel apps-ka la xiro” or “Dooro apps”.

---

## 6. Checklist (Order of Work)

1. **Android native module:** Create the module (or Expo config plugin) that requests Usage Access and Overlay, lists installed apps, and implements start/stop blocking with foreground service + overlay. Expose `startBlocking(packageNames)`, `stopBlocking()`, `getInstalledApps()` to JS.
2. **JS bridge:** Add `services/focusBlocking.ts` (or equivalent) and call `startBlocking` / `stopBlocking` from `focus.tsx` in `startSession` and `endSession`. On Android, optionally switch app picker to use `getInstalledApps()` and store package names in `blockedApps`.
3. **iOS native module:** Add Family Controls capability and entitlement; implement authorization, FamilyActivityPicker, ManagedSettingsStore shield on/off, and Shield Configuration for block screen text. Expose `requestAuthorization`, `openAppPicker`, `startBlocking()`, `stopBlocking()` to JS.
4. **JS:** On iOS, call `openAppPicker` when user opens app picker; call `startBlocking()` when starting session (native uses stored selection). Call `stopBlocking()` when ending session.
5. **Testing:** Use a development build or production build on a real device. Verify: Android overlay appears when opening a blocked app; iOS shield appears when opening a blocked app; stopping the session removes overlay/shield.

---

## 7. References in This Repo

- `components/timerprompt.md` – How blocking works on Android (Usage Access, Overlay, Accessibility) and iOS (Screen Time API).
- `docs/focus-feature-technical.md` – Supabase schema, data flow, app structure.
- `docs/FOCUS-FEATURE-FULL-PROMPT.md` – Full feature spec (UI flows, Somali copy, strict mode).
- `app/(tabs)/focus.tsx` – Where to plug in `startBlocking` and `stopBlocking` (in `startSession` and `endSession`).
- `hooks/useFocusSettings.ts` – `settings.blockedApps` (package names on Android), `setBlockedApps`.

---

## 8. Summary

- **Already done:** Focus tab, timer, session flow, Supabase (blocked apps, strict mode, focus_sessions), app picker UI (currently demo list on Android, no native picker on iOS).
- **You implement:** (1) **Android:** Native module with Usage Access + Overlay, foreground service, overlay when blocked app is in foreground, list installed apps; (2) **iOS:** Native module with Family Controls entitlement, authorization, FamilyActivityPicker, ManagedSettingsStore shield on/off, Shield Configuration; (3) **JS bridge** and calls from `focus.tsx` to start/stop blocking and to use native app picker. After this, real app blocking works in a development or production build; it does not work in Expo Go.
