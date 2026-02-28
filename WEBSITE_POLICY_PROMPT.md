# Prompt: Build Xasuus App Policy Website

Use this prompt to build a policy/legal website for the Xasuus app. Reference the structure and style of https://aqoonmaalwebsite.vercel.app/ but adapt all content for Xasuus.

---

## Tech Stack

- **Vite** (React) for the frontend
- **Tailwind CSS** for styling
- Deploy to Vercel (or similar)

---

## About the App (Xasuus)

Xasuus is a productivity mobile app built with Expo/React Native, aimed at Somali-speaking users. The name means "Reminder" in Somali. The app helps users plan their day, manage tasks, and track goals.

**Core features:**
- **Maanta (Today):** Daily view of tasks due today, with overdue tasks highlighted
- **Hawlaha (Tasks):** Full task list with due dates, times, priorities (Low/Medium/High), and optional links to goals
- **Yoolalka (Goals):** Long-term goals with deadlines (weekly, monthly, quarterly, yearly). Users can set recurring reminders for goal check-ins (day of week, time, frequency: daily, every 3 days, or weekly)
- **Dejinta (Settings):** User profile, notification toggle, goal reminder preferences, test notification button, debug tools, logout
- **Notifications:** Local push notifications for task reminders (at due time and X minutes before) and goal check-in reminders. Users choose reminder timing (e.g. 10 min before, 30 min before, 1 hour before) when adding tasks
- **Onboarding:** Welcome screen with app logo, auth (email/password via Supabase), focus type selection (Student, Shaqo, Ganacsi, Horumar Shakhsi), and notification permission request

**Backend & data:**
- **Supabase** for authentication (email/password) and database
- **Tables:** `profiles` (user profile, focus_type, notifications_enabled, goal_reminder_day/time/interval_days), `tasks` (title, due_date, due_time, priority, status, goal_id, notification_id, reminder_minutes_before), `goals` (title, type, deadline)
- **AsyncStorage** for local state (e.g. last scheduled goal reminder)
- No payments or subscriptions; the app is free
- No chat or social features
- Data is stored in Supabase (hosted, secure). No third-party analytics or advertising SDKs by default

**Target audience:**
- Somali-speaking users (Somalia and diaspora)
- Anyone who wants to organize tasks and goals with reminders
- Age: general audience (no specific age restriction)

**Languages:**
- UI is primarily in Somali (Somali language)

---

## Website Structure (Reference Aqoonmaal)

Build a simple, clean policy website with these pages:

1. **Home / Landing** – Brief intro to Xasuus, links to Privacy, Terms, Delete Account, Data Safety
2. **Privacy Policy** (`/privacy`) – How we collect, use, store, and protect user data
3. **Terms of Service** (`/terms`) – Rules for using the app, account responsibility, content ownership
4. **Delete Account & Data** (`/delete-account`) – How users can permanently delete their account and data
5. **Data Safety** (`/data-safety`) – Summary of data practices for app store listings (e.g. Google Play Data Safety form)

---

## Content to Include (Adapt from Aqoonmaal)

### Privacy Policy

- **Who we are:** Xasuus is a productivity app for tasks and goals with reminders. Somali-language UI.
- **Data we collect:**
  - Account: email, password (hashed), name (optional)
  - Profile: focus type (Student, Shaqo, Ganacsi, Horumar Shakhsi), notifications_enabled, goal_reminder_day, goal_reminder_time, goal_reminder_interval_days
  - Tasks: title, due_date, due_time, priority, status, goal_id, reminder_minutes_before
  - Goals: title, type, deadline
  - No payments, no chat, no third-party ads
- **How we use it:** To run the app, show tasks/goals, send reminders, manage account
- **Where it's stored:** Supabase (secure, hosted). RLS, HTTPS
- **Sharing:** We do not sell data. No sharing with third parties for marketing
- **Retention:** Until user deletes account
- **Security:** Hashed passwords, HTTPS, RLS
- **Children:** General audience; parents may supervise minors
- **Your rights:** Access, correct, delete, portability. Contact email for requests
- **Changes:** We may update this policy; continued use = acceptance
- **Contact:** [Provide email]

### Terms of Service

- Acceptance: By using the app, you agree
- Eligibility: Account required
- Account: Accurate info, secure credentials, responsible for activity
- Use of the app: Personal use only. No reverse engineering, misuse, illegal content
- Content: Tasks and goals are user-generated; we don't claim ownership
- No payments/subscriptions
- Termination: User can delete account anytime; we may suspend for breaches
- Disclaimers: App provided "as is"
- Limitation of liability
- Changes and contact

### Delete Account & Data

- What happens: Account, profile, tasks, goals, notification preferences are permanently deleted
- How: Email request with subject "Delete my account" and the email used to sign up. Process within 30 days. (Optionally: in-app delete in Settings when available)
- Payment records: N/A (no payments)
- Cannot be undone
- Contact

### Data Safety

- Data collected: Account (email, name), profile (focus type, notification prefs), tasks, goals
- Data shared: None with third parties
- Data security: Encrypted in transit, hashed passwords, RLS
- Purpose: App functionality, reminders, account management

---

## Design & Style Notes

- Clean, minimal layout like Aqoonmaal
- Clear headings (H1, H2)
- Bullet lists for data types and rights
- Contact email as a mailto link
- Mobile-friendly
- Use purple accent (#6d28d9) to match Xasuus app branding
- Simple navigation between pages

---

## Placeholder

Replace `[Provide email]` with the actual support/contact email for Xasuus (e.g. xasuusapp@gmail.com or similar).

---

---

## Full Draft Text for Each Page

Use the following as base content. Adapt wording and add your contact email.

### Home Page

**Xasuus** – Abaabul Maalintaada. Gaadh Yoolalkaaga.

Xasuus is a productivity app for Somali-speaking users. Plan your day, manage tasks, and reach your goals with smart reminders.

- [Privacy Policy](/privacy)
- [Terms of Service](/terms)
- [Delete Account & Data](/delete-account)
- [Data Safety](/data-safety)

---

### Privacy Policy – Full Draft

**Privacy Policy**  
Last updated: [Date]

**Who we are**

Xasuus is a productivity mobile app for Somali-speaking users. We help you plan your day, manage tasks (Maanta, Hawlaha), track goals (Yoolalka), and get reminders. This policy explains how we collect, use, and protect your information.

**Data we collect**

- **Account:** Email address, password (stored in hashed form), and optional name.
- **Profile:** Focus type (Student, Shaqo, Ganacsi, Horumar Shakhsi), notification preferences (on/off), and goal reminder settings (day of week, time, frequency).
- **Tasks:** Task title, due date, due time, priority, status, optional link to a goal, and reminder timing (e.g. 10 min before, 30 min before, 1 hour before).
- **Goals:** Goal title, type (weekly, monthly, quarterly, yearly), and deadline.

We do not collect payment information. We do not run ads or third-party analytics. We do not have chat or social features.

**How we use it**

We use your data to: provide the app (tasks, goals, reminders), send local push notifications, manage your account and profile, and respond to support requests.

**Where it's stored**

Your data is stored with Supabase, a secure hosted platform. We use Row Level Security (RLS), HTTPS for data in transit, and industry-standard security practices.

**Sharing**

We do not sell your personal data. We do not share your data with third parties for marketing. Data stays within our systems to run the app.

**Retention**

Account, profile, tasks, and goals are kept until you delete your account. After deletion, data is permanently removed.

**Security**

We use hashed passwords, HTTPS, and database security (RLS) to protect your information.

**Children**

The app is for general use. Parents and guardians may supervise use by minors. We do not knowingly collect data from children under 13 without appropriate consent.

**Your rights**

You have the right to: access your data, correct your data (e.g. via profile editing in the app), delete your account and associated data (see our Delete Account page), and request a copy of your data (data portability). To exercise these rights, contact us at the email below.

**Changes**

We may update this Privacy Policy from time to time. Significant changes will be communicated in the app or by email. Continued use of the app after changes constitutes acceptance of the updated policy.

**Contact**

For privacy requests, questions, or complaints: [Provide email]

---

### Terms of Service – Full Draft

**Terms of Service**  
Last updated: [Date]

**Acceptance**

By downloading, installing, or using the Xasuus app, you agree to these Terms of Service. If you do not agree, do not use the app.

**Eligibility**

You must have a valid account to use the app. By using the app, you confirm that you provide accurate information and meet any age requirements in your jurisdiction.

**Account**

You must provide accurate information when creating your account. You are responsible for keeping your login details secure and for all activity under your account. Notify us promptly if you suspect unauthorized access.

**Use of the app**

The app is for personal productivity use only. You agree not to: reverse engineer, copy, or misuse the app; share your account; post illegal or inappropriate content; or use the app for any purpose that violates applicable laws.

**Content**

Tasks and goals you create are your content. We do not claim ownership of your data. You grant us the right to store and process your data to provide the service.

**Payments**

The app is free. There are no subscriptions or in-app purchases.

**Termination**

We may suspend or terminate your account if you breach these terms. You may delete your account at any time (see our Delete Account page).

**Disclaimers**

The app is provided "as is." We do not guarantee uninterrupted service or specific outcomes.

**Limitation of liability**

To the extent permitted by law, Xasuus and its providers are not liable for indirect, incidental, or consequential damages arising from your use of the app.

**Changes**

We may update these terms. Continued use of the app after changes constitutes acceptance. We will communicate significant changes in the app or by email where appropriate.

**Contact**

For questions about these terms: [Provide email]

---

### Delete Account & Data – Full Draft

**Delete Account & Data**

You can permanently delete your Xasuus account and associated data.

**What happens when you delete your account**

Deleting your account permanently removes:

- Your account (email, password)
- Your profile (focus type, notification preferences, goal reminder settings)
- All your tasks
- All your goals

This cannot be undone. We cannot restore your account or data after deletion.

**How to delete your account**

- **By email:** Send an email to [Provide email] with the subject line "Delete my account" and the email address you used to sign up. We will process your request within 30 days.
- **In the app:** Go to Dejinta (Settings) and use the Delete Account option when available.

**Contact**

For account deletion or other requests: [Provide email]

---

### Data Safety – Full Draft

**Data Safety**

This page summarizes our data practices for transparency and app store requirements (e.g. Google Play Data Safety).

**Data we collect**

- **Account:** Email, password (hashed), optional name
- **Profile:** Focus type, notification preferences, goal reminder settings
- **Tasks:** Title, due date, due time, priority, status, reminder timing
- **Goals:** Title, type, deadline

**How we use it**

To provide the app: display tasks and goals, send reminders, manage your account.

**Data sharing**

We do not share your data with third parties. We do not sell your data.

**Data security**

Data is encrypted in transit (HTTPS). Passwords are hashed. We use Row Level Security in our database.

**Your rights**

You can access, correct, or delete your data. See our Privacy Policy and Delete Account page for details.

**Contact**

[Provide email]

---

## Summary

Build a Vite + Tailwind website with 4–5 pages (Home, Privacy, Terms, Delete Account, Data Safety) that mirror the structure and clarity of Aqoonmaal (https://aqoonmaalwebsite.vercel.app/) but are fully written for Xasuus: a free productivity app with tasks, goals, reminders, Supabase backend, no payments, no chat, Somali-language UI. Use the full draft text above as the basis for each page. Replace [Provide email] and [Date] with real values.
