# Scheduled App Blocking — Feature Concept for Iska Xir

## 1. Current Focus Behavior (How It Works Today)

In the current Iska Xir (Focus) flow:

- User opens the app and goes to the Focus tab.
- User selects:
  - Duration (e.g. 25 minutes, 1 hour, 1–3 days).
  - Apps to block.
- User taps **"Bilow"**.
- Blocking starts immediately.
- Blocking ends when:
  - The timer finishes, or
  - The user manually ends the session.

So currently:

- Start = manual
- End = timer or manual
- Everything is initiated inside the app.

Blocking never starts by itself based on clock time.

---

## 2. New Feature: Scheduled Blocking

We want to introduce a new option: **Scheduled Blocking**.

Instead of starting immediately, the user defines a future blocking session.

### User Flow

User should be able to:

- Select apps to block.
- Choose a **start time** (date + time).
- Choose **wakhtiga (duration)** using the **same** duration options already used in Focus (25 daqiiqo, 2 hours, 1 day, 3 maalmood, etc.).

The system calculates the end time automatically:

> End time = Start time + Duration

User does NOT need to manually choose an end time.

---

## 3. How Scheduled Blocking Should Behave

Once saved:

- The schedule is stored.
- The app shows a list of:
  - Upcoming schedules
  - Active schedules
  - Completed schedules

When the scheduled start time arrives:

- Blocking activates for the selected apps.

When the scheduled end time arrives:

- Blocking automatically stops.

User can:

- Edit a schedule before it starts.
- Cancel a schedule.
- Have multiple schedules at the same time (each with its own apps and times).

Each schedule works independently.

---

## 4. Difference From Current Flow

| Current Focus                      | Scheduled Blocking                  |
| ---------------------------------- | ----------------------------------- |
| User taps "Bilow" to start         | Blocking starts based on clock time |
| Duration defines end               | Duration still defines end          |
| Entirely manual                    | Start and end are time-driven       |
| Only active after user interaction | Can activate at a future time       |

The main change:

> Control moves from user-tap-driven to clock-driven.

---

## 5. Platform Reality

### Android

- Blocking should start automatically at the scheduled start time.
- Blocking should stop automatically at the scheduled end time.
- This should work even if the app is closed.
- After device reboot, future schedules should still activate.

This allows a true automatic scheduled experience.

### iOS

iOS does not allow automatic overlay-based blocking to start in the background at a specific time.

So the expected behavior on iOS:

- At the scheduled start time:
  - Send a local notification: "Open Iska Xir to start your scheduled focus session."
- User opens the app.
- Blocking starts normally and respects the scheduled duration.
- Scheduled end time defines when the session should finish.

So:

- Android = fully automatic start and stop.
- iOS = reminder at start time, then user opens app to begin session.

---

## 6. Overall Goal

The goal of Scheduled Blocking is to:

- Help users build routine.
- Make focus automatic and predictable.
- Reduce reliance on manual activation.
- Extend the existing Focus system without replacing it.

The current "Start Now" session should remain unchanged.
Scheduled Blocking should be an additional option inside the Focus tab.
