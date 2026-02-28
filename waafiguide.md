# WaafiPay Payment – Full Implementation Guide (Error-Free)

This guide documents the **complete** WaafiPay subscription payment implementation for the appforenglish (BaroHub) project: architecture, every error we faced and how to avoid them, CLI vs Dashboard usage, and step-by-step instructions so you can rebuild or replicate without mistakes.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Errors We Faced and How to Avoid Them](#2-errors-we-faced-and-how-to-avoid-them)
3. [Prerequisites](#3-prerequisites)
4. [Database: subscriptions Table](#4-database-subscriptions-table)
5. [Secrets: WaafiPay Credentials](#5-secrets-waafipay-credentials)
6. [Edge Function: create_payment](#6-edge-function-create_payment)
7. [Edge Function: check_subscription (Optional)](#7-edge-function-check_subscription-optional)
8. [Client: useSubscription Hook](#8-client-usesubscription-hook)
9. [Client: PaymentScreen and App Flow](#9-client-paymentscreen-and-app-flow)
10. [Keeping Prices in Sync](#10-keeping-prices-in-sync)
11. [Deployment (CLI)](#11-deployment-cli)
12. [Testing and Verification](#12-testing-and-verification)
13. [Checklist Before Going Live](#13-checklist-before-going-live)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Architecture Overview

```
┌─────────────────┐     POST + JWT      ┌──────────────────────────┐     HTTPS      ┌──────────────┐
│  React Native   │ ──────────────────► │  Supabase Edge Function  │ ─────────────► │  WaafiPay    │
│  (BaroHub App)  │                     │  create_payment          │                │  api.waafi   │
│                 │                     │                          │                │  pay.net/asm │
│  - PaymentScreen│                     │  - Verify user (getUser)  │                │              │
│  - useSubscription                    │  - Validate body         │                │  EVC / ZAAD  │
│  - supabase client                    │  - Call WaafiPay API     │                │  mobile money│
└────────┬────────┘                     │  - Insert subscription    │                └──────────────┘
         │                              └────────────┬─────────────┘
         │                                           │
         │ read subscription                         │ insert row
         ▼                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Supabase Project (appforenglish)                                                                │
│  - Auth (user session, JWT)                                                                      │
│  - Table: subscriptions (user_id, plan_type, start_date, end_date, status, payment_reference…) │
│  - Edge Function secrets: WAAFI_MERCHANT_UID, WAAFI_API_USER_ID, WAAFI_API_KEY                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Flow in short:**

1. User selects plan (monthly / 6months / yearly), payment method (EVC or ZAAD), and phone number.
2. App calls `supabase.functions.invoke('create_payment', { body: { plan_type, payment_channel, phone_number } })`. The Supabase client automatically sends the user’s JWT in the `Authorization` header.
3. Edge function verifies the user with `supabase.auth.getUser()`, validates input, reads WaafiPay credentials from **secrets**, calls WaafiPay with **API_PURCHASE**, and on success inserts a row into `subscriptions`.
4. App refreshes subscription state (query `subscriptions` or call `checkSubscription()`). If the user had no subscription and now has one, the app (e.g. AppNavigator) shows the main app instead of the payment screen.

**What we use:**

- **CLI:** Supabase CLI for `supabase login`, `supabase secrets set`, and `supabase functions deploy create_payment --no-verify-jwt --project-ref <ref>`.
- **Dashboard:** Optional for viewing function logs, listing secrets (names only), and checking the `subscriptions` table. We do **not** enable “Verify JWT” (or “Verify JWT with legacy secret”) for `create_payment` in the Dashboard.

---

## 2. Errors We Faced and How to Avoid Them

| # | Error / Symptom | Cause | Fix |
|---|-----------------|--------|-----|
| 1 | **Missing WaafiPay credentials: { hasMerchantUid: false, … }** | Secret names in code didn’t match secrets in Supabase. Code expected e.g. `WAAFIPAY_*`, secrets were `WAAFI_*` (or vice versa). | Use **one** naming convention and stick to it, or support **both** in code: `Deno.env.get('WAAFI_MERCHANT_UID') \|\| Deno.env.get('WAAFIPAY_MERCHANT_UID')`. Set secrets with the same names (see [Secrets](#5-secrets-waafipay-credentials)). |
| 2 | **Payment declined: Missing mandatory parameter [hppKey]** | WaafiPay service was `HPP_PURCHASE` (Hosted Payment Page), which requires `hppKey` and callback URLs. We wanted a direct in-app charge. | Use **API_PURCHASE** only for direct mobile money charge. Do not use `HPP_PURCHASE` in the Edge Function. |
| 3 | **401 Unauthorized** (before function runs) | Supabase gateway “Verify JWT” (or “Verify JWT with legacy secret”) was enabled. Gateway rejected the request before the function executed. | Deploy with **`--no-verify-jwt`**. In Dashboard → Edge Functions → create_payment → leave “Verify JWT” **off**. Verify the user **inside** the function with `supabase.auth.getUser()`. |
| 4 | **Generic “Edge Function returned a non-2xx status”** (no real message) | Client didn’t read the response body on error. `FunctionsHttpError` from `supabase.functions.invoke` carries the body in `error.context`. | In the client, when `error` is set, call `error.context?.json()` (if available) and show `errorBody?.error` or `errorBody?.message` to the user. See [useSubscription](#8-client-usesubscription-hook). |
| 5 | **Payment succeeded but app still shows “no subscription”** | Edge function returned 200 and inserted the row, but the client got a timeout or lost response; or client didn’t refresh subscription state. | After success, always call `checkSubscription()`. Implement **recovery**: on any error (or empty `data`), wait 1–2 seconds, query `subscriptions` for current user; if an active subscription exists, treat as success and refresh state (see [useSubscription](#8-client-usesubscription-hook)). |
| 6 | **Subscription check slow or wrong** | Using only the Edge Function `check_subscription` for every check, or RLS/policies blocking reads. | We **read subscription from the DB** in the app (`supabase.from('subscriptions').select(...).eq('user_id', userId)...`) so the app has one source of truth. RLS must allow `select` where `user_id = auth.uid()`. `check_subscription` Edge Function is optional. |
| 7 | **Prices on screen don’t match charged amount** | Plan prices in the Edge Function (`PLAN_PRICES`) and in the app (`SUBSCRIPTION_PLANS` in `utils/constants.ts`) were out of sync. | Keep a **single source of truth**: e.g. define prices in one place (e.g. constants or env) or document that `PLAN_PRICES` in the Edge Function and `SUBSCRIPTION_PLANS[].price` in the app must match. See [Keeping prices in sync](#10-keeping-prices-in-sync). |
| 8 | **Phone number rejected by WaafiPay** | Phone not in international format (e.g. missing 252 for Somalia). | Normalize in the Edge Function: strip non-digits, then ensure prefix `252` (e.g. `0xxxxxxxxx` → `252xxxxxxxxx`, or 9 digits → `252` + digits). Send only digits with country code to WaafiPay (e.g. `252612345678`). |

---

## 3. Prerequisites

- **Supabase project** (e.g. appforenglish). Project ref: `irgatccwxeexvvcrozxg` (replace with yours in commands).
- **WaafiPay merchant account** (from WAAFI/Telesom etc.). You need:
  - Merchant UID (e.g. `M0914145`)
  - API User ID (e.g. `1008628`)
  - API Key (e.g. `API-xxxxx`)
- **Supabase CLI** installed: `npm install -g supabase` or use `npx supabase`.
- **Logged in:** `supabase login` or set `SUPABASE_ACCESS_TOKEN`.
- **App** uses Supabase Auth; user is logged in when paying (so JWT is sent automatically with `functions.invoke`).

---

## 4. Database: subscriptions Table

Create the `subscriptions` table in the Supabase SQL Editor (or via migrations).

```sql
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', '6months', 'yearly')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled')),
  payment_reference TEXT,
  payment_channel TEXT CHECK (payment_channel IN ('EVC', 'ZAAD')),
  amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: users can only read their own rows
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- Only the Edge Function (service role) should insert/update; no policy for insert/update from anon key.
-- If you need users to update (e.g. cancel), add a policy or do it via Edge Function.
```

Important:

- **Do not** grant insert/update to `anon`/authenticated for normal users; let the Edge Function (using the service role key) insert after a successful payment.
- App only needs **SELECT** for the current user so it can show plan and end date.

---

## 5. Secrets: WaafiPay Credentials

Credentials must **only** live in Supabase Edge Function secrets, never in app code or git.

**Secret names (use one set consistently; our code supports both):**

- `WAAFI_MERCHANT_UID` (or `WAAFIPAY_MERCHANT_UID`)
- `WAAFI_API_USER_ID` (or `WAAFIPAY_API_USER_ID`)
- `WAAFI_API_KEY` (or `WAAFIPAY_API_KEY`)

**Set via CLI (recommended):**

```bash
# Replace YOUR_PROJECT_REF with your Supabase project ref (e.g. irgatccwxeexvvcrozxg)
# Replace values with your real WaafiPay credentials

supabase secrets set \
  WAAFI_MERCHANT_UID=YOUR_MERCHANT_UID \
  WAAFI_API_USER_ID=YOUR_API_USER_ID \
  "WAAFI_API_KEY=YOUR_API_KEY" \
  --project-ref YOUR_PROJECT_REF
```

If the API key contains special characters, quote it: `"WAAFI_API_KEY=API-xxxxx"`.

**Optional: support both naming conventions** (so either Dashboard or CLI naming works):

```bash
supabase secrets set \
  WAAFI_MERCHANT_UID=M0914145 \
  WAAFI_API_USER_ID=1008628 \
  "WAAFI_API_KEY=API-xxxxx" \
  WAAFIPAY_MERCHANT_UID=M0914145 \
  WAAFIPAY_API_USER_ID=1008628 \
  "WAAFIPAY_API_KEY=API-xxxxx" \
  --project-ref YOUR_PROJECT_REF
```

**Verify (names only, values are hidden):**

```bash
supabase secrets list --project-ref YOUR_PROJECT_REF
```

**Dashboard:** Project Settings → Edge Functions → Secrets. Add the same names and values if you prefer; code must use the same names via `Deno.env.get('...')`.

---

## 6. Edge Function: create_payment

**Path:** `supabase/functions/create_payment/index.ts`

**Must do:**

1. Handle **CORS**: respond to `OPTIONS` and add CORS headers to **every** response.
2. Allow **POST** only; return 405 otherwise.
3. Read **Authorization** header and verify user with `supabase.auth.getUser()` (create client with user’s token). Return 401 if missing or invalid.
4. Parse JSON body: `plan_type`, `payment_channel`, `phone_number`.
5. Validate: plan in `['monthly','6months','yearly']`, channel in `['EVC','ZAAD']`, phone present.
6. Normalize phone: digits only, then ensure prefix `252` (e.g. `0xxxxxxxxx` → `252xxxxxxxxx`).
7. Read credentials from env: `Deno.env.get('WAAFI_MERCHANT_UID') || Deno.env.get('WAAFIPAY_MERCHANT_UID')` (and same for API_USER_ID and API_KEY). Return 500 with a clear message if any are missing.
8. Build WaafiPay payload with **serviceName: "API_PURCHASE"** (not HPP_PURCHASE).
9. POST to `https://api.waafipay.net/asm` (or the URL WaafiPay gave you).
10. On success (`params.state === 'APPROVED'` or `responseCode === '2001'`): insert one row into `subscriptions` (user_id, plan_type, start_date, end_date, status: 'active', payment_reference, payment_channel, amount, currency), then return `{ success: true, message: '...', subscription_id, transaction_id, end_date }`.
11. On failure: return `{ success: false, error: '...' }` (still 200 and JSON with CORS).
12. On any thrown error: return 500 with `{ success: false, error: '...' }` and CORS.

**Plan prices in the function** must match the app (see [Keeping prices in sync](#10-keeping-prices-in-sync)). Example:

```typescript
const PLAN_PRICES: Record<string, { amount: number; months: number }> = {
  'monthly': { amount: 1.00, months: 1 },
  '6months': { amount: 25.00, months: 6 },
  'yearly': { amount: 45.00, months: 12 },
};
```

**WaafiPay request shape (API_PURCHASE):**

- `schemaVersion`: `"1.0"`
- `requestId`: unique string (e.g. `PAY-${Date.now()}-${random}`)
- `timestamp`: ISO string
- `channelName`: `"WEB"`
- `serviceName`: `"API_PURCHASE"`
- `serviceParams`: `merchantUid`, `apiUserId`, `apiKey`, `paymentMethod`: `"MWALLET_ACCOUNT"`, `payerInfo.accountNo` (e.g. `252612345678`), `payerInfo.accountType`: `"MSISDN"`, `transactionInfo`: `referenceId`, `invoiceId`, `amount`, `currency`, `description`

**Success detection:** `waafiResult?.params?.state === 'APPROVED'` or `waafiResult?.responseCode === '2001'`.

Full reference implementation is in `supabase/functions/create_payment/index.ts` in this repo.

---

## 7. Edge Function: check_subscription (Optional)

**Path:** `supabase/functions/check_subscription/index.ts`

This function is **optional**. The app currently determines subscription status by querying the `subscriptions` table directly in `useSubscription`. The Edge Function can be used for server-side checks (e.g. from a backend or another service).

It should:

- Require Authorization header.
- Verify user with `getUser()`.
- Query `subscriptions` for that user: `status = 'active'` and `end_date >= now()`, order by `end_date` desc, limit 1.
- Return `{ active: true, subscription: { plan_type, end_date, status } }` or `{ active: false }`.

No WaafiPay or payment logic here.

---

## 8. Client: useSubscription Hook

**Path:** `src/hooks/useSubscription.ts`

**Responsibilities:**

1. **Subscription state:** Query `supabase.from('subscriptions').select('*').eq('user_id', userId).eq('status','active').gte('end_date', new Date().toISOString()).order('end_date', { ascending: false }).limit(1)` and set local state (`subscription`, `isActive`).
2. **createPayment(planType, paymentChannel, phoneNumber):**
   - Ensure user is logged in (`supabase.auth.getSession()`); throw if not.
   - Call `supabase.functions.invoke('create_payment', { body: { plan_type: planType, payment_channel: paymentChannel, phone_number: phoneNumber } })`.
   - If **no error** and **data.success**: call `checkSubscription()` and return `data`.
   - If **error** (e.g. FunctionsHttpError): try **recovery** – wait ~1.5–2 s, then query `subscriptions` for current user; if an active subscription exists, call `checkSubscription()` and return `{ success: true, message: '...', recovered: true }` so the UI shows success instead of a generic error.
   - If **error** and recovery finds no subscription: parse error message from `error.context?.json()` (if available) and use `errorBody?.error` or `errorBody?.message`; then throw so the UI can show it.
   - If **data** is null/undefined (e.g. timeout) but payment might have succeeded: same recovery – query subscriptions, and if active, refresh and return success.
3. **checkSubscription:** Expose so the app can refresh after payment or when returning to the screen.

**Error parsing (avoid generic “non-2xx” message):**

```typescript
if (error && error.context && typeof error.context.json === 'function') {
  try {
    const errorBody = await error.context.json();
    errorMessage = errorBody?.error || errorBody?.message || errorMessage;
  } catch (_) {}
}
```

This way you always show the backend error when available.

---

## 9. Client: PaymentScreen and App Flow

**Path:** `src/screens/payment/PaymentScreen.tsx`

- Receives `onPayment(planType, channel, phone) => Promise<any>`.
- Local state: selected plan, payment channel (EVC | ZAAD), phone number, loading.
- Validates: phone not empty, length ≥ 9 (or your rule).
- On submit: calls `onPayment(selectedPlan.type, paymentChannel, phoneNumber)`. On success (or recovered success), show success alert; navigation is handled by the parent (AppNavigator) when `isSubscribed` becomes true. On thrown error, show `err.message` in an alert.

**App flow (AppNavigator):**

- If user is not logged in → auth screens.
- If logged in but no level → level selection.
- If logged in and level set but **no active subscription** → show Payment screen as **mandatory** (no skip; optional back to level).
- If logged in and **has active subscription** → Main app (tabs). From there, user can open Payment again to extend or change plan (optional payment).

Subscription status is derived from `useSubscription(user?.id)`: `isActive`/`isSubscribed` and `subscription` for display. After a successful payment, the navigator re-renders and shows the main app because `isSubscribed` becomes true.

---

## 10. Keeping Prices in Sync

Two places define prices:

1. **Edge Function** – `PLAN_PRICES` in `supabase/functions/create_payment/index.ts` (used for WaafiPay amount and for `end_date`).
2. **App** – `SUBSCRIPTION_PLANS` in `src/utils/constants.ts` (used for UI labels and “Pay $X”).

**Rule:** For each plan type, `PLAN_PRICES[plan_type].amount` must equal `SUBSCRIPTION_PLANS[].price` for that plan. Example:

| plan_type | Edge Function amount | constants.ts price |
|-----------|------------------------|---------------------|
| monthly   | 1.00                  | 1.0                 |
| 6months   | 25.00                 | 25.0                |
| yearly    | 45.00                 | 45.0                |

When you change prices, update **both** the Edge Function and `src/utils/constants.ts`, then redeploy the function.

---

## 11. Deployment (CLI)

**One-time / when credentials change:**

```bash
supabase login
supabase secrets set WAAFI_MERCHANT_UID=... WAAFI_API_USER_ID=... "WAAFI_API_KEY=..." --project-ref YOUR_PROJECT_REF
```

**Deploy the function (every time you change code or want to pick up new secrets):**

```bash
supabase functions deploy create_payment --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

**Important:** Always use `--no-verify-jwt` for this function so the gateway does not validate JWT; the function verifies the user with `getUser()`.

**Optional:** Deploy `check_subscription` if you use it:

```bash
supabase functions deploy check_subscription --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

We do **not** use `supabase link` for this project for deployment; we use `--project-ref` explicitly. If you use `supabase link`, you can omit `--project-ref` after linking.

---

## 12. Testing and Verification

1. **Secrets:** `supabase secrets list --project-ref YOUR_PROJECT_REF` – confirm `WAAFI_*` (or `WAAFIPAY_*`) exist.
2. **Function logs:** Supabase Dashboard → Edge Functions → create_payment → Logs. Trigger a payment and check for “Payment request”, “Calling WaafiPay API”, “WaafiPay response”, “Subscription created” or error messages.
3. **App:** Log in, go to payment, enter a test phone (e.g. 252612345678), choose EVC or ZAAD, pay. Confirm success alert and that the app navigates to the main app. Check `subscriptions` in Table Editor for the new row.
4. **Recovery:** Simulate a slow or dropped response (e.g. throttle network); confirm that the app still shows success when the subscription row exists (recovery path).
5. **Error message:** Trigger a known error (e.g. invalid plan or wrong phone format) and confirm the app shows the exact message from the Edge Function, not “Edge Function returned non-2xx”.

---

## 13. Checklist Before Going Live

- [ ] `subscriptions` table created with RLS; users can only read their own rows.
- [ ] WaafiPay credentials set only in Supabase secrets (both names if you support WAAFI_* and WAAFIPAY_*).
- [ ] Edge Function uses **API_PURCHASE** only (no HPP_PURCHASE).
- [ ] Edge Function verifies user with **getUser()** and returns 401 when auth fails.
- [ ] Deployed with **`--no-verify-jwt`**; Dashboard “Verify JWT” is off for create_payment.
- [ ] All responses from create_payment include CORS headers and JSON with `success` and `error` (and optional `message`).
- [ ] Client sends logged-in user JWT (no anon key as Bearer); recovery and error parsing implemented in useSubscription.
- [ ] Phone numbers normalized to international format (252...) in the Edge Function.
- [ ] PLAN_PRICES (Edge Function) and SUBSCRIPTION_PLANS (constants) are in sync.
- [ ] One real test payment (small amount) and confirmation that the subscription row is created and the app unlocks.

---

## 14. Troubleshooting

| Symptom | What to check |
|--------|----------------|
| 401 before function runs | Deploy with `--no-verify-jwt`; in Dashboard, turn off “Verify JWT” for create_payment. |
| Missing WaafiPay credentials | `supabase secrets list`; names must match code (WAAFI_* or WAAFIPAY_*). Redeploy after setting secrets. |
| Missing mandatory parameter [hppKey] | You used HPP_PURCHASE; change to **API_PURCHASE**. |
| Payment declined / generic WaafiPay error | Check Edge Function logs and WaafiPay response (`params.state`, `responseMsg`). Validate phone format and amount. |
| Client shows generic “Payment failed” | Implement reading `error.context?.json()` and show `error` or `message`. Add recovery via subscriptions query. |
| Success but app still on payment screen | Call `checkSubscription()` after success; ensure navigator uses `isSubscribed` from useSubscription; add recovery path. |
| Wrong amount charged | Sync PLAN_PRICES and SUBSCRIPTION_PLANS; redeploy function. |

---

## Quick Reference

- **WaafiPay:** `POST https://api.waafipay.net/asm`, `serviceName: "API_PURCHASE"`, credentials from env only.
- **Secrets:** `WAAFI_MERCHANT_UID`, `WAAFI_API_USER_ID`, `WAAFI_API_KEY` (or WAAFIPAY_*); set via CLI or Dashboard.
- **Deploy:** `supabase functions deploy create_payment --no-verify-jwt --project-ref YOUR_PROJECT_REF`
- **Auth:** No JWT at gateway; inside function use `getUser()` with request Authorization header.
- **Client:** Logged-in user; `supabase.functions.invoke('create_payment', { body: { plan_type, payment_channel, phone_number } })`; parse `error.context?.json()` on error; implement recovery by querying `subscriptions`.

---

**Last updated:** February 2026  
**Project:** appforenglish (BaroHub)  
**Supabase project ref:** irgatccwxeexvvcrozxg








payment guide waafi api


# Payment Edge Function Fix Guide

This document explains how to fix and deploy a working payment Edge Function with WaafiPay integration for Supabase projects.

## Table of Contents
1. [Problems Encountered](#problems-encountered)
2. [Solutions Implemented](#solutions-implemented)
3. [Edge Function Code](#edge-function-code)
4. [Client-Side Code](#client-side-code)
5. [Deployment Steps](#deployment-steps)
6. [Testing](#testing)

---

## Problems Encountered

### 1. **Secret Name Mismatch**
- **Issue**: Edge Function couldn't read WaafiPay credentials
- **Root Cause**: Secrets were named `WAAFI_*` but code looked for `WAAFIPAY_*`
- **Error**: `Missing WaafiPay credentials: { hasMerchantUid: false, hasApiUserId: false, hasApiKey: false }`

### 2. **Wrong WaafiPay Service Name**
- **Issue**: Used `HPP_PURCHASE` which requires `hppKey` parameter
- **Root Cause**: `HPP_PURCHASE` is for Hosted Payment Pages (web redirects), not direct API charges
- **Error**: `Payment declined: Missing mandatory parameter [hppKey]`

### 3. **JWT Verification Issue**
- **Issue**: Edge Functions had "Verify JWT with legacy secret" enabled
- **Root Cause**: Gateway-level JWT verification was blocking requests
- **Error**: `401 Unauthorized` before request reached function code

### 4. **Poor Error Handling**
- **Issue**: Client couldn't read actual error messages from Edge Function
- **Root Cause**: `FunctionsHttpError` response body wasn't being parsed
- **Error**: Generic `Edge Function returned a non-2xx status code` message

---

## Solutions Implemented

### 1. Fixed Secret Names
- Updated Edge Function to read both `WAAFI_*` and `WAAFIPAY_*` naming conventions
- Set secrets with both naming conventions using Supabase CLI

### 2. Changed Service Name
- Changed from `HPP_PURCHASE` to `API_PURCHASE` for direct mobile money charges
- `API_PURCHASE` doesn't require `hppKey` or callback URLs

### 3. Disabled Gateway JWT Verification
- Deployed functions with `--no-verify-jwt` flag
- Functions now handle JWT verification internally using `supabase.auth.getUser()`

### 4. Improved Error Handling
- Updated client code to read response body from `FunctionsHttpError.context`
- Properly extracts and displays actual error messages from Edge Function

---

## Edge Function Code

### File: `supabase/functions/create_payment/index.ts`

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Plan pricing configuration
const PLAN_PRICES: Record<string, { amount: number; months: number }> = {
  'monthly': { amount: 5.00, months: 1 },
  '6months': { amount: 25.00, months: 6 },
  'yearly': { amount: 45.00, months: 12 },
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Only allow POST
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get auth token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with service role for database operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create client with user's token to verify identity
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed. Please log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { plan_type, payment_channel, phone_number } = body;

    console.log('Payment request:', { user_id: user.id, plan_type, payment_channel, phone_number });

    // Validate inputs
    if (!plan_type || !payment_channel || !phone_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: plan_type, payment_channel, phone_number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plan = PLAN_PRICES[plan_type];
    if (!plan) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid plan type: ${plan_type}. Valid types: monthly, 6months, yearly` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['EVC', 'ZAAD'].includes(payment_channel)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid payment channel. Use EVC or ZAAD.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Clean phone number - ensure it starts with 252
    let cleanPhone = phone_number.replace(/\D/g, '');
    if (!cleanPhone.startsWith('252')) {
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '252' + cleanPhone.substring(1);
      } else if (cleanPhone.length <= 9) {
        cleanPhone = '252' + cleanPhone;
      }
    }

    // Get WaafiPay credentials from secrets
    // Support both naming conventions (WAAFI_ and WAAFIPAY_)
    const merchantUid = Deno.env.get('WAAFI_MERCHANT_UID') || Deno.env.get('WAAFIPAY_MERCHANT_UID');
    const apiUserId = Deno.env.get('WAAFI_API_USER_ID') || Deno.env.get('WAAFIPAY_API_USER_ID');
    const apiKey = Deno.env.get('WAAFI_API_KEY') || Deno.env.get('WAAFIPAY_API_KEY');

    if (!merchantUid || !apiUserId || !apiKey) {
      console.error('Missing WaafiPay credentials:', { 
        hasMerchantUid: !!merchantUid, 
        hasApiUserId: !!apiUserId, 
        hasApiKey: !!apiKey 
      });
      return new Response(
        JSON.stringify({ success: false, error: 'Payment service configuration error. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate unique reference
    const referenceId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Build WaafiPay API request (API_PURCHASE for direct mobile money charge)
    const waafiPayload = {
      schemaVersion: '1.0',
      requestId: referenceId,
      timestamp: new Date().toISOString(),
      channelName: 'WEB',
      serviceName: 'API_PURCHASE', // Use API_PURCHASE, not HPP_PURCHASE
      serviceParams: {
        merchantUid: merchantUid,
        apiUserId: apiUserId,
        apiKey: apiKey,
        paymentMethod: 'MWALLET_ACCOUNT',
        payerInfo: {
          accountNo: cleanPhone,
          accountType: 'MSISDN',
        },
        transactionInfo: {
          referenceId: referenceId,
          invoiceId: referenceId,
          amount: plan.amount,
          currency: 'USD',
          description: `SpeakEnglish ${plan_type} subscription`,
        },
      },
    };

    console.log('Calling WaafiPay API with payload:', JSON.stringify(waafiPayload));

    // Call WaafiPay API
    const waafiResponse = await fetch('https://api.waafipay.net/asm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(waafiPayload),
    });

    const waafiResult = await waafiResponse.json();
    console.log('WaafiPay response:', JSON.stringify(waafiResult));

    // Check WaafiPay response
    const responseCode = waafiResult?.params?.state || waafiResult?.responseCode;
    const isSuccess = responseCode === 'APPROVED' || waafiResult?.responseCode === '2001';

    if (isSuccess) {
      // Payment successful - create subscription
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + plan.months);

      const transactionId = waafiResult?.params?.transactionId || 
                           waafiResult?.params?.referenceId || 
                           referenceId;

      // Insert subscription using admin client
      const { data: subData, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan_type: plan_type,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
          payment_reference: transactionId,
          payment_channel: payment_channel,
          amount: plan.amount,
          currency: 'USD',
        })
        .select()
        .single();

      if (subError) {
        console.error('Subscription insert error:', subError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Payment was successful but subscription activation failed. Please contact support with reference: ' + transactionId 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Subscription created:', subData?.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Payment successful! Your subscription is now active.',
          subscription_id: subData?.id,
          transaction_id: transactionId,
          end_date: endDate.toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // Payment failed
      const errorMsg = waafiResult?.params?.description || 
                      waafiResult?.responseMsg || 
                      'Payment was declined by the provider';

      console.error('Payment declined:', errorMsg);

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Payment declined: ${errorMsg}` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Unhandled error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'An unexpected error occurred. Please try again.' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

### Key Points:
1. **CORS Headers**: Always include CORS headers for web/mobile clients
2. **JWT Verification**: Verify user internally using `supabase.auth.getUser()`
3. **Secret Names**: Support both `WAAFI_*` and `WAAFIPAY_*` naming conventions
4. **Service Name**: Use `API_PURCHASE` for direct charges, not `HPP_PURCHASE`
5. **Error Handling**: Return structured JSON with `success` and `error` fields
6. **Phone Number Formatting**: Ensure phone numbers start with country code `252`

---

## Client-Side Code

### File: `src/hooks/useSubscription.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';
import { Subscription } from '../types';

export function useSubscription(userId: string | undefined) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .order('end_date', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) {
        setSubscription(null);
        setIsActive(false);
      } else {
        setSubscription(data as Subscription);
        setIsActive(true);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
      setIsActive(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    checkSubscription();
  }, [checkSubscription]);

  const createPayment = async (
    planType: string,
    paymentChannel: 'EVC' | 'ZAAD',
    phoneNumber: string
  ) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Session error:', sessionError);
        throw new Error('Authentication error: ' + sessionError.message);
      }
      if (!session) {
        throw new Error('Not authenticated. Please log in again.');
      }

      console.log('Calling create_payment with:', {
        plan_type: planType,
        payment_channel: paymentChannel,
        phone_number: phoneNumber,
      });

      const { data, error } = await supabase.functions.invoke('create_payment', {
        body: {
          plan_type: planType,
          payment_channel: paymentChannel,
          phone_number: phoneNumber,
        },
      });

      console.log('Edge Function response:', { data, error });

      // If supabase client reports an error (non-2xx status)
      if (error) {
        let errorMessage = 'Payment failed';

        // FunctionsHttpError has a context property with the raw Response
        if (error.context && typeof error.context.json === 'function') {
          try {
            const errorBody = await error.context.json();
            console.log('Edge Function error body:', errorBody);
            errorMessage = errorBody?.error || errorBody?.message || errorMessage;
          } catch (parseErr) {
            console.log('Could not parse error response body:', parseErr);
            errorMessage = error.message || errorMessage;
          }
        } else if (data?.error) {
          errorMessage = data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }

        throw new Error(errorMessage);
      }

      // data should be our JSON response
      if (!data) {
        throw new Error('No response from payment service');
      }

      // Our Edge Function always returns {success, error?, message?}
      if (data.success) {
        await checkSubscription();
        return data;
      } else {
        // Payment declined or validation error from our function
        throw new Error(data.error || 'Payment failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      if (error.message) {
        throw error;
      }
      throw new Error('Payment failed. Please try again.');
    }
  };

  return {
    subscription,
    isActive,
    loading,
    checkSubscription,
    createPayment,
  };
}
```

### Key Points:
1. **Error Parsing**: Read response body from `error.context.json()` when `FunctionsHttpError` occurs
2. **Structured Responses**: Handle both success and error cases from Edge Function
3. **Session Check**: Always verify user session before calling Edge Function
4. **Subscription Refresh**: Call `checkSubscription()` after successful payment

---

## Deployment Steps

### 1. Set Up Supabase CLI

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Or set access token as environment variable
export SUPABASE_ACCESS_TOKEN="your_access_token_here"
```

### 2. Set Edge Function Secrets

**⚠️ SECURITY WARNING**: Never commit API keys to version control. Always use Supabase Secrets.

```bash
# Set WaafiPay credentials (use both naming conventions for compatibility)
# Replace with your actual WaafiPay credentials from your merchant account

# Example with actual values (for this project):
supabase secrets set \
  WAAFI_MERCHANT_UID=M0914145 \
  WAAFI_API_USER_ID=1008628 \
  "WAAFI_API_KEY=API-nGvapKZVWvV7XUVxh6S11XLiO3R" \
  WAAFIPAY_MERCHANT_UID=M0914145 \
  WAAFIPAY_API_USER_ID=1008628 \
  "WAAFIPAY_API_KEY=API-nGvapKZVWvV7XUVxh6S11XLiO3R" \
  --project-ref irgatccwxeexvvcrozxg

# For your own project, use:
# supabase secrets set \
#   WAAFI_MERCHANT_UID=your_merchant_uid \
#   WAAFI_API_USER_ID=your_api_user_id \
#   "WAAFI_API_KEY=your_api_key" \
#   WAAFIPAY_MERCHANT_UID=your_merchant_uid \
#   WAAFIPAY_API_USER_ID=your_api_user_id \
#   "WAAFIPAY_API_KEY=your_api_key" \
#   --project-ref your_project_ref
```

**Where to get WaafiPay credentials:**
- Log in to your WaafiPay merchant dashboard
- Navigate to API Settings or Developer Settings
- Copy your:
  - **Merchant UID**: Your unique merchant identifier
  - **API User ID**: Your API user ID
  - **API Key**: Your API authentication key

### 3. Deploy Edge Function

```bash
# Deploy with --no-verify-jwt flag to disable gateway-level JWT verification
supabase functions deploy create_payment \
  --project-ref your_project_ref \
  --no-verify-jwt
```

### 4. Verify Deployment

```bash
# List all Edge Functions
supabase functions list --project-ref your_project_ref

# Check function logs
# Go to: https://supabase.com/dashboard/project/your_project_ref/functions/create_payment/logs
```

---

## Testing

### 1. Test Edge Function Directly

```bash
# Get your user's JWT token from the app
# Then test with curl:

curl -X POST "https://your-project.supabase.co/functions/v1/create_payment" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_USER_JWT_TOKEN" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -d '{
    "plan_type": "monthly",
    "payment_channel": "EVC",
    "phone_number": "252617211084"
  }'
```

### 2. Test from Client App

1. Start your app: `npx expo start --web`
2. Create a test account
3. Navigate to payment/subscription screen
4. Enter phone number: `252617211084` (or your test number)
5. Select payment method: EVC or ZAAD
6. Click "Pay"
7. Check console logs for:
   - `Calling create_payment with: {...}`
   - `Edge Function response: {...}`
   - Success or error messages

### 3. Check Edge Function Logs

Go to Supabase Dashboard:
```
https://supabase.com/dashboard/project/your_project_ref/functions/create_payment/logs
```

Look for:
- `Payment request: {...}` - Confirms function received request
- `Calling WaafiPay API with payload: {...}` - Confirms API call
- `WaafiPay response: {...}` - Shows WaafiPay's response
- `Subscription created: {...}` - Confirms database insert

---

## Common Issues & Solutions

### Issue: "Missing WaafiPay credentials"
**Solution**: 
- Verify secrets are set: `supabase secrets list --project-ref your_project_ref`
- Ensure secret names match (`WAAFI_*` or `WAAFIPAY_*`)
- Redeploy function after setting secrets

### Issue: "Missing mandatory parameter [hppKey]"
**Solution**: 
- Change `serviceName` from `HPP_PURCHASE` to `API_PURCHASE`
- `HPP_PURCHASE` is for web redirects, `API_PURCHASE` is for direct charges

### Issue: "401 Unauthorized"
**Solution**: 
- Deploy with `--no-verify-jwt` flag
- Ensure user is logged in and JWT token is sent in Authorization header
- Check Edge Function logs for auth errors

### Issue: Generic error messages
**Solution**: 
- Update client code to read `error.context.json()`
- Ensure Edge Function returns structured JSON with `error` field

---

## WaafiPay API Reference

### Endpoint
```
POST https://api.waafipay.net/asm
```

### Required Parameters for API_PURCHASE
- `schemaVersion`: "1.0"
- `requestId`: Unique transaction ID
- `timestamp`: ISO 8601 timestamp
- `channelName`: "WEB"
- `serviceName`: "API_PURCHASE" (for direct charges)
- `serviceParams.merchantUid`: Your merchant UID
- `serviceParams.apiUserId`: Your API user ID
- `serviceParams.apiKey`: Your API key
- `serviceParams.paymentMethod`: "MWALLET_ACCOUNT"
- `serviceParams.payerInfo.accountNo`: Phone number (e.g., 252617211084)
- `serviceParams.payerInfo.accountType`: "MSISDN"
- `serviceParams.transactionInfo.referenceId`: Unique reference
- `serviceParams.transactionInfo.invoiceId`: Invoice ID
- `serviceParams.transactionInfo.amount`: Amount (number)
- `serviceParams.transactionInfo.currency`: "USD"
- `serviceParams.transactionInfo.description`: Transaction description

### Response Codes
- `APPROVED` or `2001`: Payment successful
- Other codes: Payment declined (check `params.description` or `responseMsg`)

---

## Database Schema

### subscriptions table
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('monthly', '6months', 'yearly')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled')),
  payment_reference TEXT,
  payment_channel TEXT CHECK (payment_channel IN ('EVC', 'ZAAD')),
  amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Summary Checklist

- [ ] Edge Function code uses `API_PURCHASE` (not `HPP_PURCHASE`)
- [ ] Secrets are set with both `WAAFI_*` and `WAAFIPAY_*` naming
- [ ] Function deployed with `--no-verify-jwt` flag
- [ ] Client code reads error messages from `error.context.json()`
- [ ] Phone numbers are formatted with country code (252)
- [ ] CORS headers are included in all responses
- [ ] User authentication is verified internally in function
- [ ] Subscription is created in database on successful payment
- [ ] Error messages are user-friendly and informative

---

## Additional Resources

- [Supabase Edge Functions Docs](https://supabase.com/docs/guides/functions)
- [WaafiPay API Documentation](https://docs.waafipay.com/)
- [Supabase Functions Secrets](https://supabase.com/docs/guides/functions/secrets)

---

**Last Updated**: February 9, 2026
**Tested With**: Supabase Edge Functions, WaafiPay API, React Native with Expo
