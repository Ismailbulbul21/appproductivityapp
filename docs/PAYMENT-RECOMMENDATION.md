# Payment Recommendation for Qorsheyn (Productivity App)

This doc summarizes the project, the database, and a clear recommendation for **where** and **how** to add payment (WaafiPay), and whether staying fully free is a good idea.

---

## 1. What I Understood

### Project (from codebase)
- **App:** Qorsheyn (productivity, Somali language).
- **Flow:** Index → onboarding (auth → focus-type → notifications) → main app **(tabs):** Maanta, Hawlaha, Yoolalka, **Focus**, Dejinta.
- **Supabase project:** `hnflspjejmdwfmztvnpq` (from `services/supabase.ts`).

### Database (from MCP Supabase – `list_tables` on productivity app project)
- **profiles** – id, email, focus_type, notifications, goal_reminder_*, focus_blocked_apps, focus_default_duration_minutes, focus_strict_mode. RLS on.
- **goals** – id, user_id, title, type, deadline. RLS on.
- **tasks** – id, user_id, title, due_date, due_time, priority, status, goal_id, notifications, reminder_minutes_before. RLS on.
- **focus_sessions** – id, user_id, started_at, ended_at, duration_seconds, completed. RLS on.

There is **no `subscriptions` table** yet; you add it when you implement payment (see [WAAFIPAY-FULL-IMPLEMENTATION-GUIDE.md](./WAAFIPAY-FULL-IMPLEMENTATION-GUIDE.md)).

### Focus feature (why it matters for payment)
- **Focus** is the main differentiator: timer + **app blocking** (native module), sessions logged to `focus_sessions`, settings in `profiles`.
- Maanta / Hawlaha / Yoolalka = tasks and goals (valuable but more “standard”).
- So Focus is the **hero feature** that justifies paying—but that doesn’t mean payment should *only* live there.

---

## 2. Is It Good Being Free?

| Approach | Pros | Cons |
|----------|------|------|
| **Free forever** | Max growth, no friction. | No revenue; sustainability depends on other goals (e.g. portfolio, impact). |
| **Optional tip / donation** | Low friction. | Usually very low conversion. |
| **Subscription (full app or freemium)** | Clear value, recurring revenue. | Some users leave at paywall; need clear messaging. |

**Recommendation:** If you want **revenue**, add a **subscription** (e.g. monthly / 6 months / yearly via WaafiPay). Keeping the app **fully free** is fine only if revenue is not a goal.

---

## 3. Where to Add Payment: Focus-Only vs Full-App

You asked: *“I was thinking in focus, because that is the most important feature – your recommendation?”*

### Option A: Payment only when using Focus
- **Idea:** User can use Maanta, Hawlaha, Yoolalka, Dejinta for free. When they tap **Focus** (or start a focus session), show paywall; after payment, Focus unlocks.
- **Pros:** Focus is clearly “premium”; rest of app is free.
- **Cons:**
  - Message is unclear: “Why is only this one tab paid?”
  - Users can use the app daily without ever hitting the paywall (tasks, goals, settings).
  - Conversion is often **lower** because the paywall is easy to avoid and feels like a single-feature unlock.

### Option B: Subscription for the **full app** (recommended)
- **Idea:** After onboarding (auth + focus-type + notifications), before the main app, show a **payment screen**: “Subscribe to use Qorsheyn.” Once they have an active subscription, they get **all** tabs (Maanta, Hawlaha, Yoolalka, Focus, Dejinta).
- **Pros:**
  - Clear story: “Pay once (per month/year), get the whole app.”
  - One place to check subscription (e.g. root layout or right after onboarding).
  - Focus remains the **hero feature** that justifies the price (“focus + tasks + goals”), but payment isn’t “only for Focus”—it’s “to use Qorsheyn.”
  - Matches how many productivity apps work (e.g. subscription for full access).
- **Cons:** Some users drop at paywall; you can soften with a short free trial if you want.

### Option C: Freemium (limits)
- **Idea:** Free = e.g. 3 focus sessions per week + limited tasks; **Pro** = unlimited focus + app blocking + full tasks/goals.
- **Pros:** Try before buy; can increase installs and then convert when they hit the limit.
- **Cons:** More logic (counts, limits, upsell screens); can feel restrictive if limits are tight.

---

## 4. Recommendation Summary

1. **Don’t put payment only on Focus.**  
   It makes Focus feel premium but the rest “free,” and the paywall is easy to avoid. Conversion is usually weaker than a clear “full app” subscription.

2. **Use a full-app subscription.**  
   - **Paywall placement:** After onboarding (e.g. after the notifications step). If the user has no active subscription → show **Payment screen** (mandatory, no skip into main app). If they have an active subscription → go to main app (tabs).
   - **Focus** stays the main reason to pay (“focus + tasks + goals”), but the paywall is **one gate for the whole app**, not a per-tab gate.

3. **Optional:** Add a **short free trial** (e.g. 3 or 7 days) before the first payment screen, then require subscription. You can implement trial by:
   - Storing `subscription_trial_ends_at` on profile or in `subscriptions`, or
   - Allowing access until `trial_ends_at` and then showing the payment screen.

4. **If you prefer freemium:** Gate **Focus** (e.g. “3 focus sessions per week free; unlimited with Pro”) or limit **tasks/goals** and upsell. Then payment is still one subscription; you just allow limited usage before paywall.

---

## 5. How to Implement (High Level)

Follow **[WAAFIPAY-FULL-IMPLEMENTATION-GUIDE.md](./WAAFIPAY-FULL-IMPLEMENTATION-GUIDE.md)** and plug it into this app as follows:

1. **Database**  
   In the **same** Supabase project (`hnflspjejmdwfmztvnpq`), create the `subscriptions` table and RLS as in the guide.

2. **Backend**  
   Add Edge Function `create_payment` (WaafiPay API_PURCHASE), secrets (WAAFI_MERCHANT_UID, WAAFI_API_USER_ID, WAAFI_API_KEY), deploy with `--no-verify-jwt`.

3. **Client**  
   - Add `useSubscription(userId)` (read subscription from DB, call `create_payment`, recovery + error parsing).
   - Add a **Payment screen** (plans, EVC/ZAAD, phone, call `createPayment`).
   - **App flow:** In `_layout.tsx` (or wherever you control post-onboarding routing):  
     - If user is logged in and has `focus_type` (onboarding done) but **no active subscription** → show **Payment** screen (mandatory).  
     - If user has **active subscription** → show main app **(tabs)**.  
   So the paywall sits **between onboarding and tabs**, not inside the Focus tab.

4. **Focus tab**  
   No paywall inside Focus. Once they’re in the app, they already have a subscription; Focus is simply the star feature.

5. **Dejinta (settings)**  
   Optional: add “Manage subscription” or “Renew” that opens the same Payment screen (for renewal or plan change).

---

## 6. Quick Comparison

| Approach | Paywall location | Message | Typical conversion |
|----------|------------------|--------|---------------------|
| **Focus only** | When user opens Focus / starts session | “Pay for Focus” | Often lower (easy to avoid) |
| **Full-app subscription** ✅ | After onboarding, before tabs | “Subscribe to use Qorsheyn” | Usually better, clearer value |
| **Freemium** | When user hits limit (e.g. 4th focus session) | “Upgrade for unlimited” | Depends on limit and messaging |

**Bottom line:** Add payment as a **full-app subscription**, with the paywall **after onboarding** and **before** the main app. Use Focus as the hero feature in your copy (“Focus, tasks, and goals in one app”), but don’t gate payment only on the Focus tab.
