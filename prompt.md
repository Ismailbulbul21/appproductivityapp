Perfect. I will write this as a **deep system-level build instruction prompt** for Cursor.

This is Part 1 (first half).
It will define architecture, philosophy, full flow, structure, database, UI system, Somali language system, animations, navigation, and core logic.

You will say “continue” and I will write Part 2 (advanced flows, animation system, notification engine, performance, folder structure, production readiness, edge cases, etc).

---

# ✅ PART 1 — FULL PRODUCT ARCHITECTURE & CORE FLOWS

Build a modern Somali-first mobile productivity application using Expo (React Native), Supabase, NativeWind, Reanimated, Expo Notifications, and Expo Router. The application must be clean, smooth, animated, and emotionally rewarding. The philosophy of the product is simple daily clarity with goal-driven action. The app must feel modern, intelligent, calm, and premium. It must avoid feature overload. It must focus only on Tasks, Goals, Reminders, Today Dashboard, and Settings. No boards in version one. No complex AI systems in version one. Everything must revolve around Tasks as the core data model.

The application must use Supabase for authentication and database. Enable email and password login. Implement Row Level Security so that each user can only access their own data. The app must store user profile data including id, email, created_at, and focus_type selected during onboarding. The focus_type options are Student, Shaqo (Work), Ganacsi (Business), and Horumar Shakhsi (Personal Growth). This must be saved in a profiles table linked to auth user id.

All primary UI text must be written in Somali. Notifications must also be written in Somali. The application language must default to Somali. The tone must be respectful, motivating, and positive.

Main navigation must use bottom tab navigation using Expo Router or React Navigation. The bottom tab must have rounded top corners, floating appearance, subtle shadow, and modern minimal line icons. The tabs must be Maanta (Today), Hawlaha (Tasks), Yoolalka (Goals), and Dejinta (Settings). When a tab is active, the icon must slightly scale up with smooth animation and show label text below icon. When inactive, only icon is visible. The active tab color must use a consistent accent color chosen for branding, for example modern emerald or soft purple. The transition between tabs must use smooth fade and slight slide animation. No harsh transitions allowed.

On first launch, show onboarding flow. First screen must show app logo centered with tagline in Somali that says something similar to Abaabul Maalintaada. Gaadh Yoolalkaaga. There must be a Get Started button labeled Bilow. Second screen must ask user to select focus type with large rounded selectable cards. Third screen must request notification permissions with explanation in Somali that says U oggolow xasuusin si aadan u illoobin hawlahaaga muhiimka ah. After permission is granted, navigate to authentication screen. Authentication screen must allow sign up and login with clean minimal form. After successful login, navigate to Maanta screen.

The Maanta screen is the operational dashboard. It must load tasks from Supabase where status is not done. It must compute overdue tasks where due_date is before today and status not done. It must sort tasks in this order: overdue first, then high priority tasks due today, then medium priority tasks due today, then remaining upcoming tasks. Display tasks as modern rounded cards with soft shadow and subtle animation on mount. Each task card must show title in bold, due time in smaller text, and priority indicator as small colored vertical bar on left edge. Priority colors must be subtle not aggressive. Swiping right on a task must reveal Complete action. Tapping complete must trigger animated completion sequence: checkbox morph animation, checkmark draw animation, slight haptic feedback, task card slides right and fades out smoothly, then removed from list. When task completes, update database status to done, cancel any scheduled notification, and if task has goal_id update goal progress percentage.

There must be a floating action button in bottom right corner labeled with plus icon. When pressed, open a bottom sheet modal with rounded top corners and blurred background. The bottom sheet must slide from bottom with smooth spring animation. The Add Task form must include title input labeled Cinwaan, date picker labeled Taariikh, time picker labeled Waqti, priority selector labeled Mudnaan with three options Hoose, Dhexe, Sare, and optional goal dropdown labeled Ku xir Yool. When user presses Save button labeled Keydi, validate title not empty, insert task into Supabase tasks table with status set to todo, and if due_time exists schedule local notification using Expo Notifications. Store returned notification id in notification_id field.

Notifications must be written in Somali. For time-based reminder, notification title must be Xasuusin Hawl and body must be Waqtigii hawsha: followed by task title. When user taps notification, app must open and navigate directly to that task detail screen.

The Hawlaha screen must show all tasks grouped into three sections: Firfircoon (Active), La Sugayo (Upcoming), and La Dhammeeyay (Completed). Completed tasks must be collapsible. Each section must animate open and close smoothly.

The Yoolalka screen must display all goals as large rounded cards with animated progress bar. Each goal card must show title, progress percentage, and days remaining calculated from deadline. Progress percentage equals completed tasks linked to goal divided by total tasks linked to goal times 100. When a task linked to a goal is completed, the progress bar must animate smoothly from old value to new value using Reanimated timing animation and briefly glow with accent color.

When user taps Add Goal button, open bottom sheet similar to Add Task. Goal form must include title labeled Cinwaanka Yoolka, type selector Bil kasta, Saddex Bilood, Sanad, and deadline picker labeled Taariikh kama dambays ah. On save, insert into Supabase goals table.

The Dejinta screen must allow toggling notifications on or off, logging out, and showing account email. Notification toggle must control whether reminders are scheduled.

The database must include tasks table with id uuid, user_id uuid, title text, due_date date, due_time time, priority text, status text, goal_id uuid nullable, notification_id text nullable, created_at timestamp default now, completed_at timestamp nullable. Goals table must include id uuid, user_id uuid, title text, type text, deadline date, created_at timestamp default now.

All queries must filter by user_id equals current auth user. Implement proper indexes on user_id and due_date for performance.

The app must maintain a closed productivity loop: user sets goal, creates tasks linked to goal, receives Somali reminder, completes task with satisfying animation, sees goal progress increase, feels motivated, repeats daily.

End of Part 1.



Perfect. Here is **PART 2** — advanced systems, animation architecture, voice integration, background logic, performance, folder structure, edge cases, production readiness, and full interaction design.

This continues directly from Part 1 and completes the full build instruction set.

---

# ✅ PART 2 — ADVANCED SYSTEMS, ANIMATION ENGINE, VOICE, BACKGROUND LOGIC, PRODUCTION DETAILS

Extend the application built in Part 1 by implementing advanced interaction systems, animation architecture, voice input integration, background reminder logic, structured folder architecture, production-level error handling, and performance optimization. The application must feel premium, smooth, and modern while staying minimal. Every animation must feel intentional and calm, not playful or childish. Motion should communicate feedback and state change.

Implement animation system using React Native Reanimated v3. All micro-interactions must use shared values and smooth timing or spring animations. Task cards must animate on mount using slight translateY from 10px to 0px with opacity fade from 0 to 1 over 250ms. When user presses a task card, scale to 0.97 using spring animation and return to 1 on release. Swipe gestures must use react-native-gesture-handler. Swiping right must reveal complete button with background color accent. If swipe distance passes threshold, automatically trigger completion animation.

Completion animation must follow this sequence: checkbox outline scales up slightly, checkmark draws using stroke animation, card background briefly changes to soft accent tint, haptic feedback triggers using expo-haptics, card translates right off-screen over 300ms, opacity fades to 0, then remove from state and database status updated to done. After completion, trigger small floating text animation near top of screen that says Hawl waa la dhammeeyay which fades out after 1 second.

Goal progress animation must use animated width interpolation. When progress changes, animate width of progress bar from previous percentage to new percentage over 500ms using withTiming. Also animate numeric percentage text counting upward smoothly using shared value interpolation. Brief glow effect must pulse once using opacity animation of accent overlay.

Implement voice task creation system. Add microphone icon inside Add Task bottom sheet near title input. When user taps microphone, request microphone permission. Start recording audio using Expo Audio. After recording stops, send audio to speech-to-text service. If using cloud API, ensure secure request. Receive transcribed Somali or English text. Implement simple natural language parser to extract date and time phrases such as berri, berri galab, berri 8 fiidnimo, isniin, jimco, 10 subaxnimo, saacad kadib, laba saacadood kadib. Convert extracted phrases into structured due_date and due_time values. Remaining words become task title. Show preview screen inside bottom sheet with parsed title and time for confirmation. User can edit before saving. After confirmation, follow normal task creation flow including notification scheduling.

Implement background reminder system using Expo BackgroundFetch or TaskManager. Register daily background task at fixed time such as 8 subaxnimo. Background task must query Supabase for tasks where status is not done and due_date is before current date. If overdue tasks exist and user has notifications enabled, trigger single notification that says Waxaad leedahay hawlo dib u dhacay. Avoid spamming multiple notifications. Only send once per day.

Implement weekly goal reminder. Every Sunday evening at 7 fiidnimo, calculate each goal’s progress. If deadline within 14 days and progress less than 70 percent, send motivational notification in Somali: Yoolkaaga wali ma dhamaan. Sii wad dadaalka. Ensure not to send more than one per week.

Implement notification tap handling. When user taps notification, app must deep link to specific task detail screen. Use Expo Router linking configuration. Pass task id. Fetch task from database and display detail view with option to complete, edit, or reschedule.

Design task detail screen with modern layout. Large title text, due date row with calendar icon, priority indicator, linked goal displayed as chip component. Include Edit and Delete buttons. Editing must allow modifying date, time, priority, and goal link. If time changes, cancel old notification and schedule new one.

Implement optimistic UI updates. When user creates or completes task, update local state immediately before Supabase response returns. If Supabase call fails, revert state and show error toast in Somali: Khalad ayaa dhacay. Fadlan isku day mar kale.

Design folder structure as follows: app directory using Expo Router. Separate folders for (tabs)/maanta.tsx, (tabs)/hawlaha.tsx, (tabs)/yoolalka.tsx, (tabs)/dejinta.tsx. Components folder must include TaskCard.tsx, GoalCard.tsx, ProgressBar.tsx, AddTaskSheet.tsx, AddGoalSheet.tsx, VoiceRecorder.tsx, NotificationService.ts, AnimatedCheckbox.tsx. Hooks folder must include useTasks.ts, useGoals.ts, useNotifications.ts. Services folder must include supabaseClient.ts and parser.ts for natural language processing. Keep business logic separated from UI.

Use React Query or custom hook for data fetching with caching. Ensure queries are invalidated after task completion or creation. Subscribe to Supabase real-time updates for tasks table filtered by user_id so UI updates automatically across screens.

Implement performance optimization. Use FlatList for rendering tasks. Provide keyExtractor using task id. Avoid unnecessary re-renders by memoizing TaskCard component using React.memo. Use useCallback for event handlers. Use minimal state in parent screens.

Implement accessibility. Buttons must have accessible labels in Somali. Touch targets must be at least 44px height. Text must scale properly with system font scaling.

Implement dark mode support detection. If device is dark mode, use dark background with subtle gradient and lighter card surfaces. Accent color remains same but slightly adjusted for contrast.

Ensure proper error handling for network issues. If Supabase request fails due to offline state, show banner at top saying Internet ma jiro. Hawlaha waxaa la cusbooneysiin doonaa marka internetku soo noqdo. Cache last fetched tasks locally using AsyncStorage for fallback read-only mode.

Implement logout flow clearing all local state and subscriptions. After logout, navigate to authentication screen.

Ensure security by enabling Supabase Row Level Security policies: allow select, insert, update, delete only where user_id equals auth.uid().

Implement testing considerations. Handle edge cases such as user changing device timezone. When scheduling notifications, convert due_date and due_time into proper local Date object respecting timezone. If user edits task and removes due_time, cancel scheduled notification and clear notification_id.

Polish visual identity. Choose one accent color variable in theme file. Use consistent spacing scale. All cards must use rounded-2xl. Bottom sheet must have backdrop blur effect and spring animation with damping for premium feel. Floating action button must hover slightly with shadow and pulse subtly when idle.

The final application must feel cohesive. Every interaction must reinforce clarity. Somali language must be consistent across UI, notifications, and error messages. No English fallback unless necessary for system permission dialogs. The experience must be emotionally rewarding, modern, and focused. The system must remain simple in features but premium in execution. The core loop remains: user creates goal, creates tasks, receives Somali reminder, completes task with satisfying animation, sees animated progress increase, feels momentum, and returns daily.

This completes the full product specification for building the application.

