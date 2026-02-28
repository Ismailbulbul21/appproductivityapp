# WaafiPay Subscription Payment – Full Implementation Guide

**Reusable guide for any project.** Use this when integrating WaafiPay (EVC, ZAAD, mobile wallets) with Supabase Edge Functions for subscription or one-time payments.

---

## Table of Contents

1. [WaafiPay Overview (Official API)](#1-waafipay-overview-official-api)
2. [Architecture Overview](#2-architecture-overview)
3. [Common Errors and How to Avoid Them](#3-common-errors-and-how-to-avoid-them)
4. [Prerequisites](#4-prerequisites)
5. [Database: subscriptions Table](#5-database-subscriptions-table)
6. [Secrets: WaafiPay Credentials](#6-secrets-waafipay-credentials)
7. [Edge Function: create_payment](#7-edge-function-create_payment)
8. [Edge Function: check_subscription (Optional)](#8-edge-function-check_subscription-optional)
9. [Client: useSubscription Hook](#9-client-usesubscription-hook)
10. [Client: PaymentScreen and App Flow](#10-client-paymentscreen-and-app-flow)
11. [Keeping Prices in Sync](#11-keeping-prices-in-sync)
12. [Deployment (CLI)](#12-deployment-cli)
13. [Testing and Verification](#13-testing-and-verification)
14. [Checklist Before Going Live](#14-checklist-before-going-live)
15. [Troubleshooting](#15-troubleshooting)
16. [WaafiPay API Reference](#16-waafipay-api-reference)
17. [Quick Reference](#17-quick-reference)

---

## 1. WaafiPay Overview (Official API)

- **What it is:** East Africa payment gateway. Accept payments via **mobile wallets** (WAAFI, ZAAD, EVC Plus, SAHAL), **cards**, and **bank accounts**. PCI DSS compliant; all traffic over HTTPS; JSON over one endpoint.
- **Docs:** [https://docs.waafipay.com/](https://docs.waafipay.com/)

**Services relevant for in-app subscription:**

| Service           | Use case                          | In this guide |
|------------------|------------------------------------|----------------|
| **API_PURCHASE** | Direct charge (mobile money, etc.)| ✅ Use this    |
| HPP_PURCHASE     | Hosted Payment Page (redirect)    | ❌ Do not use  |

- **Environments:**
  - **Production:** `https://api.waafipay.com/asm`
  - **Sandbox/Testing:** `http://sandbox.waafipay.net/asm`  
  (Some setups use `https://api.waafipay.net/asm` — confirm with WaafiPay.)

**Rules:**

- Amounts: up to **2 decimal places** (truncated if more).
- `referenceId`: only letters, numbers, dash, underscore, dot.
- Phone: **full international format**, no `+` or leading zeros (e.g. `252612345678`).

**Success:** `params.state === "APPROVED"` or `responseCode === "2001"`. Use `params.transactionId` for your records.

---

## 2. Architecture Overview

```
┌─────────────────┐     POST + JWT      ┌──────────────────────────┐     HTTPS      ┌──────────────┐
│  Your App       │ ──────────────────► │  Supabase Edge Function  │ ─────────────► │  WaafiPay    │
│  (React Native  │                     │  create_payment           │                │  /asm        │
│   or Web)       │                     │  - Verify user (getUser)  │                │  EVC / ZAAD  │
│  - PaymentScreen│                     │  - Validate body          │                │  mobile money│
│  - useSubscription                    │  - Call WaafiPay API      │                └──────────────┘
└────────┬────────┘                     │  - Insert subscription    │
         │                              └────────────┬───────────────┘
         │ read subscription                         │ insert row
         ▼                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│  Supabase Project                                                                                 │
│  - Auth (user session, JWT)                                                                       │
│  - Table: subscriptions (user_id, plan_type, start_date, end_date, status, payment_reference…)   │
│  - Edge Function secrets: WAAFI_MERCHANT_UID, WAAFI_API_USER_ID, WAAFI_API_KEY                   │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Flow:**

1. User selects plan (e.g. monthly / 6months / yearly), payment method (EVC or ZAAD), and phone number.
2. App calls `supabase.functions.invoke('create_payment', { body: { plan_type, payment_channel, phone_number } })`. Supabase client sends the user JWT in the `Authorization` header.
3. Edge function: verify user with `supabase.auth.getUser()`, validate input, read WaafiPay credentials from **secrets**, call WaafiPay **API_PURCHASE**, on success insert one row into `subscriptions`.
4. App refreshes subscription (query `subscriptions` or `checkSubscription()`). If user has an active subscription, show main app; otherwise show payment screen.

**Tools:**

- **CLI:** `supabase login`, `supabase secrets set`, `supabase functions deploy create_payment --no-verify-jwt --project-ref <ref>`.
- **Dashboard:** Optional for logs and table view. Leave **Verify JWT** **off** for `create_payment`; the function verifies the user itself.

---

## 3. Common Errors and How to Avoid Them

| # | Error / Symptom | Cause | Fix |
|---|-----------------|--------|-----|
| 1 | **Missing WaafiPay credentials: { hasMerchantUid: false, … }** | Secret names in code don’t match Supabase secrets. | Use one naming convention or support both: `Deno.env.get('WAAFI_MERCHANT_UID') \|\| Deno.env.get('WAAFIPAY_MERCHANT_UID')`. Set secrets with the same names. |
| 2 | **Payment declined: Missing mandatory parameter [hppKey]** | Used `HPP_PURCHASE` (Hosted Payment Page). | Use **API_PURCHASE** only for direct mobile money charge. |
| 3 | **401 Unauthorized** (before function runs) | Supabase gateway “Verify JWT” is enabled. | Deploy with **`--no-verify-jwt`**. In Dashboard → Edge Functions → create_payment → turn “Verify JWT” **off**. Verify user **inside** the function with `getUser()`. |
| 4 | **Generic “Edge Function returned a non-2xx status”** | Client doesn’t read the response body on error. | When `error` is set, call `error.context?.json()` and show `errorBody?.error` or `errorBody?.message`. |
| 5 | **Payment succeeded but app still shows “no subscription”** | Client timed out or didn’t refresh; subscription was created. | After success, always call `checkSubscription()`. Implement **recovery**: on error or empty `data`, wait 1–2 s, query `subscriptions` for current user; if active subscription exists, refresh state and treat as success. |
| 6 | **Subscription check slow or wrong** | RLS blocks read or only using Edge Function for checks. | Read subscription from DB in the app; RLS allows `SELECT` where `user_id = auth.uid()`. `check_subscription` Edge Function is optional. |
| 7 | **Prices on screen don’t match charged amount** | Plan prices in Edge Function and app are out of sync. | Keep one source of truth or document that Edge Function `PLAN_PRICES` and app `SUBSCRIPTION_PLANS[].price` must match. |
| 8 | **Phone number rejected by WaafiPay** | Phone not in international format (e.g. missing 252). | In Edge Function: strip non-digits, then ensure prefix `252` (e.g. `0xxxxxxxxx` → `252xxxxxxxxx`, or 9 digits → `252` + digits). |

---

## 4. Prerequisites

- **Supabase project.** Note your **project ref** (Dashboard URL or `supabase projects list`).
- **WaafiPay merchant account** (from WAAFI/Telesom etc.). You need:
  - Merchant UID
  - API User ID
  - API Key
- **Supabase CLI:** `npm install -g supabase` or `npx supabase`. Log in: `supabase login` or set `SUPABASE_ACCESS_TOKEN`.
- **App** uses Supabase Auth; user must be logged in when paying so the JWT is sent with `functions.invoke`.

---

## 5. Database: subscriptions Table

Create in Supabase SQL Editor (or via migration).

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

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
```

- **Do not** grant INSERT/UPDATE to anon/authenticated for normal users. Only the Edge Function (service role) inserts after a successful payment.
- App only needs **SELECT** for the current user.

To support more plans, extend the `CHECK (plan_type IN (...))` and do the same in the Edge Function and app constants.

---

## 6. Secrets: WaafiPay Credentials

Credentials must **only** live in Supabase Edge Function secrets, **never** in app code or git.

**Secret names (pick one set; code below supports both):**

- `WAAFI_MERCHANT_UID` (or `WAAFIPAY_MERCHANT_UID`)
- `WAAFI_API_USER_ID` (or `WAAFIPAY_API_USER_ID`)
- `WAAFI_API_KEY` (or `WAAFIPAY_API_KEY`)

**Set via CLI:**

```bash
# Replace YOUR_PROJECT_REF and placeholder values
supabase secrets set \
  WAAFI_MERCHANT_UID=YOUR_MERCHANT_UID \
  WAAFI_API_USER_ID=YOUR_API_USER_ID \
  "WAAFI_API_KEY=YOUR_API_KEY" \
  --project-ref YOUR_PROJECT_REF
```

If the API key has special characters, quote it: `"WAAFI_API_KEY=API-xxxxx"`.

**Support both naming conventions (optional):**

```bash
supabase secrets set \
  WAAFI_MERCHANT_UID=YOUR_MERCHANT_UID \
  WAAFI_API_USER_ID=YOUR_API_USER_ID \
  "WAAFI_API_KEY=YOUR_API_KEY" \
  WAAFIPAY_MERCHANT_UID=YOUR_MERCHANT_UID \
  WAAFIPAY_API_USER_ID=YOUR_API_USER_ID \
  "WAAFIPAY_API_KEY=YOUR_API_KEY" \
  --project-ref YOUR_PROJECT_REF
```

**Verify (names only):**

```bash
supabase secrets list --project-ref YOUR_PROJECT_REF
```

After changing secrets, redeploy the function so it picks them up.

---

## 7. Edge Function: create_payment

**Path:** `supabase/functions/create_payment/index.ts`

**Requirements:**

1. **CORS:** Respond to `OPTIONS` and add CORS headers to **every** response.
2. **POST only;** return 405 otherwise.
3. Read **Authorization** header; verify user with `supabase.auth.getUser()` (create client with user’s token). Return 401 if missing or invalid.
4. Parse JSON body: `plan_type`, `payment_channel`, `phone_number`.
5. Validate: plan in `['monthly','6months','yearly']`, channel in `['EVC','ZAAD']`, phone present.
6. Normalize phone: digits only, then ensure prefix `252`.
7. Read credentials from env (support both `WAAFI_*` and `WAAFIPAY_*`). Return 500 if any missing.
8. Build WaafiPay payload with **serviceName: "API_PURCHASE"**.
9. POST to WaafiPay (e.g. `https://api.waafipay.net/asm` or production URL).
10. On success (`params.state === 'APPROVED'` or `responseCode === '2001'`): insert one row into `subscriptions`, then return `{ success: true, message, subscription_id, transaction_id, end_date }`.
11. On payment failure: return 200 with `{ success: false, error }` and CORS.
12. On thrown error: return 500 with `{ success: false, error }` and CORS.

**Plan prices** in the function must match the app (see [Keeping prices in sync](#11-keeping-prices-in-sync)).

**Full reference implementation:**

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Keep in sync with app SUBSCRIPTION_PLANS
const PLAN_PRICES: Record<string, { amount: number; months: number }> = {
  'monthly': { amount: 5.00, months: 1 },
  '6months': { amount: 25.00, months: 6 },
  'yearly': { amount: 45.00, months: 12 },
};

// Replace "YourApp" with your product name for description
const PRODUCT_NAME = 'YourApp';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ success: false, error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication failed. Please log in again.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { plan_type, payment_channel, phone_number } = body;

    if (!plan_type || !payment_channel || !phone_number) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: plan_type, payment_channel, phone_number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const plan = PLAN_PRICES[plan_type];
    if (!plan) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid plan type: ${plan_type}. Valid: monthly, 6months, yearly` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['EVC', 'ZAAD'].includes(payment_channel)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid payment channel. Use EVC or ZAAD.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let cleanPhone = String(phone_number).replace(/\D/g, '');
    if (!cleanPhone.startsWith('252')) {
      if (cleanPhone.startsWith('0')) {
        cleanPhone = '252' + cleanPhone.substring(1);
      } else if (cleanPhone.length <= 9) {
        cleanPhone = '252' + cleanPhone;
      }
    }

    const merchantUid = Deno.env.get('WAAFI_MERCHANT_UID') || Deno.env.get('WAAFIPAY_MERCHANT_UID');
    const apiUserId = Deno.env.get('WAAFI_API_USER_ID') || Deno.env.get('WAAFIPAY_API_USER_ID');
    const apiKey = Deno.env.get('WAAFI_API_KEY') || Deno.env.get('WAAFIPAY_API_KEY');

    if (!merchantUid || !apiUserId || !apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment service configuration error. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const referenceId = `PAY-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const waafiPayload = {
      schemaVersion: '1.0',
      requestId: referenceId,
      timestamp: new Date().toISOString(),
      channelName: 'WEB',
      serviceName: 'API_PURCHASE',
      serviceParams: {
        merchantUid,
        apiUserId,
        apiKey,
        paymentMethod: 'MWALLET_ACCOUNT',
        payerInfo: {
          accountNo: cleanPhone,
          accountType: 'MSISDN',
        },
        transactionInfo: {
          referenceId,
          invoiceId: referenceId,
          amount: plan.amount,
          currency: 'USD',
          description: `${PRODUCT_NAME} ${plan_type} subscription`,
        },
      },
    };

    const waafiResponse = await fetch('https://api.waafipay.net/asm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(waafiPayload),
    });

    const waafiResult = await waafiResponse.json();
    const state = waafiResult?.params?.state;
    const responseCode = waafiResult?.responseCode;
    const isSuccess = state === 'APPROVED' || responseCode === '2001';

    if (isSuccess) {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + plan.months);

      const transactionId = waafiResult?.params?.transactionId ||
        waafiResult?.params?.referenceId || referenceId;

      const { data: subData, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .insert({
          user_id: user.id,
          plan_type,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
          payment_reference: transactionId,
          payment_channel,
          amount: plan.amount,
          currency: 'USD',
        })
        .select()
        .single();

      if (subError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Payment succeeded but subscription activation failed. Contact support with ref: ' + transactionId,
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

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
    }

    const errorMsg = waafiResult?.params?.description ||
      waafiResult?.responseMsg || 'Payment was declined by the provider';

    return new Response(
      JSON.stringify({ success: false, error: `Payment declined: ${errorMsg}` }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

**Production URL:** Replace `https://api.waafipay.net/asm` with `https://api.waafipay.com/asm` when going live if that is what WaafiPay specifies.

---

## 8. Edge Function: check_subscription (Optional)

**Path:** `supabase/functions/check_subscription/index.ts`

Optional. The app can determine subscription status by reading the `subscriptions` table directly. This function is useful for server-side or external checks.

- Require `Authorization` header.
- Verify user with `getUser()`.
- Query `subscriptions` for that user: `status = 'active'` and `end_date >= now()`, order by `end_date` desc, limit 1.
- Return `{ active: true, subscription: { plan_type, end_date, status } }` or `{ active: false }`.

No WaafiPay or payment logic here.

---

## 9. Client: useSubscription Hook

**Path (example):** `src/hooks/useSubscription.ts`

**Responsibilities:**

1. **Subscription state:** Query `subscriptions` for the current user (`user_id`, `status = 'active'`, `end_date >= now()`), order by `end_date` desc, limit 1. Set local state (`subscription`, `isActive`).
2. **createPayment(planType, paymentChannel, phoneNumber):**
   - Ensure user is logged in (`supabase.auth.getSession()`); throw if not.
   - Call `supabase.functions.invoke('create_payment', { body: { plan_type, payment_channel, phone_number } })`.
   - If no error and `data.success`: call `checkSubscription()` and return `data`.
   - If error (e.g. FunctionsHttpError): **recovery** — wait ~1.5–2 s, query `subscriptions` for current user; if an active subscription exists, call `checkSubscription()` and return `{ success: true, message: '...', recovered: true }`.
   - If error and recovery finds no subscription: parse `error.context?.json()` and throw with `errorBody?.error` or `errorBody?.message`.
   - If `data` is null/undefined (e.g. timeout): same recovery — query subscriptions; if active, refresh and return success.
3. Expose **checkSubscription** so the app can refresh after payment or when returning to the screen.

**Error parsing (avoid generic “non-2xx”):**

```typescript
if (error && error.context && typeof error.context.json === 'function') {
  try {
    const errorBody = await error.context.json();
    errorMessage = errorBody?.error || errorBody?.message || errorMessage;
  } catch (_) {}
}
```

**Example implementation:**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../path/to/supabase';

export function useSubscription(userId: string | undefined) {
  const [subscription, setSubscription] = useState<any>(null);
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
        .maybeSingle();

      if (error || !data) {
        setSubscription(null);
        setIsActive(false);
      } else {
        setSubscription(data);
        setIsActive(true);
      }
    } catch {
      setSubscription(null);
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
    if (!userId) throw new Error('Not authenticated. Please log in again.');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Not authenticated. Please log in again.');
    }

    const { data, error } = await supabase.functions.invoke('create_payment', {
      body: { plan_type: planType, payment_channel: paymentChannel, phone_number: phoneNumber },
    });

    if (data?.success) {
      await checkSubscription();
      return data;
    }

    if (error) {
      let errorMessage = 'Payment failed';
      if (error.context && typeof error.context.json === 'function') {
        try {
          const errorBody = await error.context.json();
          errorMessage = errorBody?.error || errorBody?.message || errorMessage;
        } catch (_) {}
      }
      // Recovery: payment may have succeeded; re-query subscriptions
      await new Promise((r) => setTimeout(r, 1500));
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId!)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .limit(1)
        .maybeSingle();
      await checkSubscription();
      if (sub) return { success: true, message: 'Payment successful.', recovered: true };
      throw new Error(errorMessage);
    }

    if (!data) {
      await new Promise((r) => setTimeout(r, 1500));
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', userId!)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString())
        .limit(1)
        .maybeSingle();
      await checkSubscription();
      if (sub) return { success: true, recovered: true };
      throw new Error('No response from payment service');
    }

    throw new Error(data.error || 'Payment failed.');
  };

  return { subscription, isActive, loading, checkSubscription, createPayment };
}
```

Note: In the recovery block above, `isActive` may still be the previous value; a more robust pattern is to call `checkSubscription()` and then read subscription state from a ref or from the same hook state after awaiting. In practice, calling `checkSubscription()` and then returning success when the backend actually created the row is enough; the next render will have updated `isActive`. You can refine by re-querying inside `createPayment` and returning success only if the new row exists.

---

## 10. Client: PaymentScreen and App Flow

**PaymentScreen (example):**

- Receives `onPayment(planType, channel, phone) => Promise<any>`.
- Local state: selected plan, payment channel (EVC | ZAAD), phone number, loading.
- Validate: phone not empty, length ≥ 9 (or your rule).
- On submit: call `onPayment(selectedPlan.type, paymentChannel, phoneNumber)`. On success (or recovered success), show success; parent navigator switches when `isSubscribed` becomes true. On thrown error, show `err.message`.

**App flow (e.g. AppNavigator):**

- Not logged in → auth screens.
- Logged in, no “level” or onboarding → level/onboarding.
- Logged in, **no active subscription** → show Payment screen (mandatory; optional back).
- Logged in, **has active subscription** → main app (tabs). User can open Payment again to renew or change plan.

Subscription status: `useSubscription(user?.id)` → `isActive` / `isSubscribed` and `subscription` for display. After a successful payment, call `checkSubscription()` so the navigator re-renders and shows the main app when `isSubscribed` is true.

---

## 11. Keeping Prices in Sync

Two places define prices:

1. **Edge Function:** `PLAN_PRICES` in `supabase/functions/create_payment/index.ts` (amount and months for `end_date`).
2. **App:** e.g. `SUBSCRIPTION_PLANS` in `src/utils/constants.ts` (labels and “Pay $X”).

**Rule:** For each plan type, `PLAN_PRICES[plan_type].amount` must equal the app price for that plan.

| plan_type | Edge Function amount | App price |
|-----------|------------------------|-----------|
| monthly   | 5.00                   | 5.0       |
| 6months   | 25.00                  | 25.0      |
| yearly    | 45.00                  | 45.0      |

When you change prices, update both and redeploy the Edge Function.

---

## 12. Deployment (CLI)

**One-time or when credentials change:**

```bash
supabase login
supabase secrets set WAAFI_MERCHANT_UID=... WAAFI_API_USER_ID=... "WAAFI_API_KEY=..." --project-ref YOUR_PROJECT_REF
```

**Deploy the function (on code or secret change):**

```bash
supabase functions deploy create_payment --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

Always use `--no-verify-jwt` for this function; the function verifies the user with `getUser()`.

Optional:

```bash
supabase functions deploy check_subscription --project-ref YOUR_PROJECT_REF --no-verify-jwt
```

If you use `supabase link`, you can omit `--project-ref` after linking.

---

## 13. Testing and Verification

1. **Secrets:** `supabase secrets list --project-ref YOUR_PROJECT_REF` — confirm `WAAFI_*` (or `WAAFIPAY_*`) exist.
2. **Logs:** Dashboard → Edge Functions → create_payment → Logs. Trigger a payment and check for request, WaafiPay call, response, and “Subscription created” or errors.
3. **App:** Log in → payment screen → test phone (e.g. sandbox), EVC or ZAAD → pay. Confirm success and that the app unlocks. Check `subscriptions` table for the new row.
4. **Recovery:** Throttle network or simulate timeout; confirm that if the subscription row exists, the app still shows success after recovery.
5. **Errors:** Trigger invalid plan or wrong phone; confirm the app shows the Edge Function error message, not a generic “non-2xx”.

**Sandbox test numbers (from WaafiPay docs):**

| Wallet   | Provider  | Mobile Number  | PIN  |
|----------|-----------|----------------|------|
| EVCPlus  | Hormuud   | 252611111111   | 1212 |
| ZAAD     | Telesom   | 252631111111   | 1212 |
| SAHAL    | Golis     | 252901111111   | 1212 |
| WAAFI Djibouti | WAAFI | 253771111111   | 1212 |

Use full international format (e.g. `252611111111`), no `+` or leading zeros.

---

## 14. Checklist Before Going Live

- [ ] `subscriptions` table created with RLS; users can only read their own rows.
- [ ] WaafiPay credentials only in Supabase secrets (names match code).
- [ ] Edge Function uses **API_PURCHASE** only (not HPP_PURCHASE).
- [ ] Edge Function verifies user with **getUser()** and returns 401 when auth fails.
- [ ] Deployed with **`--no-verify-jwt`**; Dashboard “Verify JWT” off for create_payment.
- [ ] All responses from create_payment include CORS headers and JSON with `success` and `error` (and optional `message`).
- [ ] Client sends logged-in user JWT; recovery and error parsing implemented in useSubscription.
- [ ] Phone numbers normalized to international format (252...) in the Edge Function.
- [ ] PLAN_PRICES and app subscription prices in sync.
- [ ] WaafiPay URL set to production if required (`https://api.waafipay.com/asm`).
- [ ] One real test payment (small amount); subscription row created and app unlocks.

---

## 15. Troubleshooting

| Symptom | What to check |
|--------|----------------|
| 401 before function runs | Deploy with `--no-verify-jwt`; Dashboard → create_payment → “Verify JWT” off. |
| Missing WaafiPay credentials | `supabase secrets list`; names match code (WAAFI_* or WAAFIPAY_*). Redeploy after setting secrets. |
| Missing mandatory parameter [hppKey] | Use **API_PURCHASE**, not HPP_PURCHASE. |
| Payment declined / generic WaafiPay error | Edge Function logs and WaafiPay response (`params.state`, `responseMsg`). Check phone format and amount. |
| Client shows generic “Payment failed” | Read `error.context?.json()` and show `error` or `message`. Add recovery via subscriptions query. |
| Success but app still on payment screen | Call `checkSubscription()` after success; navigator uses `isSubscribed` from useSubscription; implement recovery. |
| Wrong amount charged | Sync PLAN_PRICES and app prices; redeploy function. |

---

## 16. WaafiPay API Reference

**Endpoint:**

- Production: `https://api.waafipay.com/asm`
- Sandbox: `http://sandbox.waafipay.net/asm`

**API_PURCHASE request (summary):**

- `schemaVersion`: `"1.0"`
- `requestId`: unique (e.g. UUID or `PAY-${Date.now()}-${random}`)
- `timestamp`: ISO string
- `channelName`: `"WEB"`
- `serviceName`: `"API_PURCHASE"`
- `serviceParams`: `merchantUid`, `apiUserId`, `apiKey`, `paymentMethod`: `"MWALLET_ACCOUNT"`, `payerInfo.accountNo` (e.g. `252612345678`), `payerInfo.accountType`: `"MSISDN"`, `transactionInfo.referenceId`, `invoiceId`, `amount`, `currency`, `description`

**Success:** `params.state === "APPROVED"` or `responseCode === "2001"`.

**Response codes (examples):**

- `2001` — Request processed successfully (check `params.state` for transaction result).
- `53xx` — Various errors (timeout, cancelled, invalid token, etc.). See [WaafiPay API Introduction](https://docs.waafipay.com/api-introduction).

**referenceId:** Only alphanumeric, dash, underscore, dot. Unique per transaction.

---

## 17. Quick Reference

- **WaafiPay:** `POST https://api.waafipay.net/asm` (or production URL), `serviceName: "API_PURCHASE"`, credentials from env only.
- **Secrets:** `WAAFI_MERCHANT_UID`, `WAAFI_API_USER_ID`, `WAAFI_API_KEY` (or WAAFIPAY_*); set via CLI or Dashboard.
- **Deploy:** `supabase functions deploy create_payment --no-verify-jwt --project-ref YOUR_PROJECT_REF`
- **Auth:** No JWT verification at gateway; inside function use `getUser()` with request `Authorization` header.
- **Client:** Logged-in user; `supabase.functions.invoke('create_payment', { body: { plan_type, payment_channel, phone_number } })`; parse `error.context?.json()` on error; implement recovery by querying `subscriptions`.

---

**Last updated:** February 2026  
**Use for:** Any Supabase + WaafiPay subscription or one-time payment project.  
**Official docs:** [https://docs.waafipay.com/](https://docs.waafipay.com/)
