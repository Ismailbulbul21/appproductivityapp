# Maanta (Today) Screen – Full Redesign Spec
## Target: Women 16–30 • Modern, Premium, Eye‑catching

---

## 1. Design Concept

### Chosen concept: **“Timeline of Your Day” + Soft Gradient Layers**

- **What it is:** A vertical timeline runs down the screen. Each task is a **compact card** beside a **glowing node** on the line. The screen has a soft gradient background and a gradient header. No big stacked rectangles — small, intentional cards that feel like “steps of your day.”
- **Why this concept:**
  - **Unique:** Most todo apps use plain lists or grids. A timeline feels like a story (your day) and is easy to scan.
  - **Clean:** Compact cards + one clear line = minimal but creative.
  - **Premium:** Glowing nodes + soft shadows + gradient header feel polished, not default.
- **Why it fits women (16–30):**
  - **Narrative:** Feels personal and intentional, like a curated feed.
  - **Aesthetic:** Soft gradients and gentle glow match Instagram/Pinterest-style taste.
  - **Feminine but strong:** Soft colors + clear hierarchy = elegant, not childish.
  - **Delight:** Small motions (staggered appear, completion) make the app feel alive and rewarding.

---

## 2. Layout Structure (High Level)

```
┌─────────────────────────────────────┐
│  [gradient header strip]            │
│  Your Beautiful Progress 🌷         │
│  Subtitle (motivational)             │
│                        [avatar] [🔔]│
├─────────────────────────────────────┤
│  [Filter: single pill "Maanta" ▼]   │  ← opens sheet, not a row of chips
├─────────────────────────────────────┤
│  ●── compact card 1 (icon, title,   │
│  │   time, priority, ○ complete)     │
│  ●── compact card 2                 │
│  │   ...                            │
│  ●── compact card N                 │
│  │                                  │
├─────────────────────────────────────┤
│     [  ＋ Hawl  ]  ← pill FAB        │
└─────────────────────────────────────┘
```

- **Header:** Full-width gradient, big title, subtitle, profile + bell top-right.
- **Filter:** One pill; tap opens bottom sheet (Today / Overdue / By priority). No crowded filter row.
- **List:** Vertical timeline: line + glowing dot per task; each task = one compact card (not a huge rectangle).
- **FAB:** Pill “＋ Hawl” with gradient + glow, bottom center or bottom-right.

---

## 3. What Makes It Modern and Different

- **No “todo list” cliché:** Timeline + nodes + compact cards instead of big stacked cards.
- **2026-style UI:** Soft gradients, rounded typography, soft shadows, subtle motion.
- **Instagram/Pinterest feel:** Curated, aesthetic, photo-app quality.
- **Intentional hierarchy:** One hero (title), one primary action (complete), rest supporting.
- **Premium details:** Glow on nodes, gradient FAB, glass-like cards, consistent radius and spacing.

---

## 4. Design Structure (Exact Specs)

### 4.1 Screen background
- **Type:** Linear gradient, top to bottom.
- **Colors:** `#fdf2f8` (top, soft pink) → `#faf5ff` (bottom, soft lavender). Optional third: `#fefce8` (cream) at bottom.
- **Fallback:** Single tint `#faf5ff` if gradient not available.

### 4.2 Header area
- **Height:** ~120–140 pt (including safe area).
- **Background:** Same gradient as screen, slightly stronger; optional blur (glass) for status area.
- **Padding:** 20 pt horizontal, 12 pt below status, 16 pt between elements.
- **Title:** “Your Beautiful Progress 🌷” — 24–26 pt, semibold, dark gray `#1f2937`.
- **Subtitle:** e.g. “What will you do today?” — 14 pt, regular, `#6b7280`.
- **Top-right:** Profile = circle 36 pt, border 2 pt; Bell = 24 pt icon, `#6b7280`. Tap area 44 pt each.
- **Spacing:** 8 pt between title and subtitle; 16 pt between subtitle and “filter” area.

### 4.3 Filter section
- **Layout:** One pill, not a row. Centered or left-aligned under header.
- **Pill:** Height 40 pt, padding H 20 pt, radius 20 pt. Background `rgba(255,255,255,0.85)` or soft white; border 1 pt `rgba(0,0,0,0.06)`.
- **Content:** “Maanta” (or “Today”) + chevron down. Tapping opens **bottom sheet** with options: Maanta / La dhaafay (Overdue) / Sare first / Dhexe / Hoose. No inline row of 4+ chips.
- **Spacing:** 16 pt below header block; 20 pt below pill to first timeline item.

### 4.4 Timeline
- **Line:** Vertical line 2 pt width, from first dot to last. Color: `#e9d5ff` (light purple) or `#f3e8ff`. Left offset from screen: 28 pt (so dot center at 24 pt).
- **Dot (node):** Circle 14 pt. Fill = priority color (Sare/Dhexe/Hoose) or red if overdue. Optional: 4–6 pt outer glow (same color, 30% opacity). Gap between dots: defined by card height (no extra gap).

### 4.5 Task card (compact)
- **Size:** Full width minus margins; height ~72–80 pt (compact, not big).
- **Margins:** H 20 pt, left margin 44 pt (so card starts right of timeline). 10 pt vertical gap between cards.
- **Border radius:** 20 pt.
- **Background:** `rgba(255,255,255,0.92)` or `#ffffff` with very soft shadow. Overdue can have subtle red tint `#fef2f2`.
- **Shadow:** `y: 6`, blur 16, opacity 0.06–0.08; color slight gray or priority tint.
- **Layout inside card (L→R):**
  - **Left:** Small icon 32×32 pt, radius 10 pt, background priority tint (e.g. 15% opacity). Icon: check-square or clipboard or sparkle (✨).
  - **Center (flex):** Title (one line, 16 pt semibold, `#111827`), below it one row: clock + time (12 pt, `#6b7280`) + priority pill (8–10 pt, rounded, priority color).
  - **Right:** Complete button = circle 40 pt, green fill or gradient, check icon 20 pt white. Trash: secondary, icon only 20 pt, or in overflow menu.
- **Padding inside card:** 14 pt H, 12 pt V. 6 pt between title and meta row.
- **Tap:** Whole card opens task detail (existing navigation). Complete button only completes (no navigate).

### 4.6 Typography
- **Title (screen):** 24–26 pt, semibold, rounded font if available (e.g. Nunito, Poppins).
- **Card title:** 16 pt, semibold.
- **Meta (time, priority):** 12 pt, regular/medium.
- **Spacing:** Line height 1.25 for title, 1.2 for body.

### 4.7 Icons
- **Style:** Rounded outline (Feather or similar). Not heavy filled black.
- **Sizes:** Header 24 pt; card icon 20 pt; complete 20 pt; FAB plus 24 pt.
- **Colors:** Gray `#6b7280` for neutral; priority color for node and card accent; green for complete; red only for overdue/delete.

### 4.8 Floating Add Button (FAB)
- **Shape:** Pill (capsule), not circle. Height 52 pt, min width 140 pt, radius 26 pt.
- **Position:** Bottom center, 24 pt above safe area (or bottom right 20 pt if preferred).
- **Background:** Linear gradient: e.g. `#a78bfa` → `#ec4899` (purple to pink). Fallback solid `#8b5cf6`.
- **Content:** “＋ Hawl” or “Add task” — 16 pt semibold, white. Icon + text.
- **Shadow:** Same color as gradient, y 4, blur 12, opacity 0.35. Optional soft glow.
- **Animation:** Scale down to 0.96 on press (spring); optional subtle idle float (optional).

### 4.9 Animations
- **List:** Staggered fade-in + slight slide up (e.g. 40 ms delay per item, 280 ms duration, spring damping 18).
- **Complete:** On tap complete: scale card to 0.98 then remove (or fade out 200 ms). Optional: small checkmark burst or sparkle (✨) at button.
- **Filter:** Bottom sheet slide up 300 ms (ease out).
- **FAB:** Press scale 0.96, release spring back 1. No boring static circle.

### 4.10 Empty state
- **Icon:** Large soft icon (e.g. sun or sparkles) in circle with gradient or tint (e.g. `#f5f3ff`).
- **Text:** “Hawl maanta ah ma jirto” — 20 pt semibold; subtitle 14 pt gray. “＋ Taabo si aad ugu dartid” as hint.
- **Spacing:** 48 pt above icon, 24 pt between icon and title, 12 pt between title and subtitle.

---

## 5. Color Palette (Women‑focused, Modern)

| Role        | Hex       | Usage                    |
|------------|-----------|---------------------------|
| Gradient 1 | `#fdf2f8` | Header/screen top (pink)  |
| Gradient 2 | `#faf5ff` | Screen bottom (lavender)  |
| Accent     | `#8b5cf6` | Primary actions, FAB      |
| Accent 2   | `#ec4899` | FAB gradient end, highlights |
| Card bg    | `#ffffff` | Card background           |
| Text       | `#1f2937` | Title                     |
| Text soft  | `#6b7280` | Meta, secondary           |
| Sare       | `#ef4444` | High priority / overdue   |
| Dhexe      | `#f59e0b` | Medium priority           |
| Hoose      | `#6b7280` or `#10b981` | Low priority   |
| Success    | `#10b981` | Complete button           |

---

## 6. Summary

- **Concept:** Timeline of Your Day + soft gradient layers; compact cards with glowing nodes.
- **Why women love it:** Narrative, aesthetic, soft but clear, premium feel.
- **Layout:** Gradient header (title + subtitle + profile + bell) → single filter pill → timeline list → pill FAB.
- **Modern:** No big rectangles, no crowded filter row; timeline, glow, gradient, pill FAB, staggered animation.
- **Exact:** Spacing, radii (20 pt cards, 26 pt FAB), shadow (y 6, blur 16), gradient colors and animation timings as above.

This spec is the single source of truth for the Maanta redesign implementation.
