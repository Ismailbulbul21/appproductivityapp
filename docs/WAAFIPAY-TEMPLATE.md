# WaafiPay Integration Master Template
*A reusable guide for integrating WaafiPay (EVC/ZAAD) subscriptions via Supabase Edge Functions in React Native / Expo apps.*

## 1. What to Avoid (Lessons Learned)

⚠️ **DO NOT use the Supabase CLI for setting secrets.**
Setting secrets via terminal (`npx supabase secrets set`) often fails due to local authentication and versioning issues.
**Instead:** Always set your `WAAFI_MERCHANT_UID`, `WAAFI_API_USER_ID`, and `WAAFI_API_KEY` manually via the **Supabase Dashboard** (Project Settings -> Edge Functions -> Secrets).

⚠️ **DO NOT hardcode API Keys in your React Native app.**
Never place WaafiPay credentials in your client code. They must only exist as environment variables inside the Supabase Edge Function to prevent theft.

⚠️ **DO NOT enforce JWT on the Edge Function deployment if you are manually handling auth.**
When deploying the edge function, make sure to bypass the API Gateway JWT verification (e.g., using MCP `verify_jwt: false`), because the edge function uses the `Authorization` header to create a customized `supabaseUser` client and manually verifies the token. This prevents double-verification failures.

---

## 2. Database Setup (Supabase SQL)

Run this SQL in your Supabase SQL Editor to create the subscriptions table and protect it using Row Level Security (RLS).

```sql
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type TEXT NOT NULL DEFAULT 'monthly',
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled')),
  payment_reference TEXT,
  payment_channel TEXT CHECK (payment_channel IN ('EVC', 'ZAAD')),
  amount NUMERIC,
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: Users can only read their own subscription. Only the server can insert.
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 3. The Edge Function (`create_payment/index.ts`)

This runs on Supabase's Deno servers. It handles the USSD push to the user's phone, formats the phone number correctly, and securely logs the payment.

```typescript
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Define your pricing exactly here
const PLAN_PRICES: Record<string, { amount: number; months: number; name: string }> = {
  'monthly': { amount: 0.50, months: 1, name: "Monthly Plan" },
};

Deno.serve(async (req: Request) => {
  // 1. CORS Preflight
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    if (req.method !== 'POST') throw new Error('Method not allowed');

    // 2. Auth Verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Admin client for inserting the subscription later
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    // User client strictly to verify the JWT
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) throw new Error('Authentication failed');

    // 3. Validation
    const { payment_channel, phone_number, plan_type = 'monthly' } = await req.json();
    if (!payment_channel || !phone_number) throw new Error('Missing fields');
    
    const plan = PLAN_PRICES[plan_type];
    if (!plan) throw new Error('Invalid plan_type');

    // 4. Phone Normalization (Ensure exactly 252 prefix)
    let cleanPhone = String(phone_number).replace(/\D/g, '');
    if (!cleanPhone.startsWith('252') && cleanPhone.startsWith('0')) cleanPhone = '252' + cleanPhone.substring(1);
    else if (!cleanPhone.startsWith('252')) cleanPhone = '252' + cleanPhone;

    // 5. Secrets Retrieval
    const merchantUid = Deno.env.get('WAAFI_MERCHANT_UID');
    const apiUserId = Deno.env.get('WAAFI_API_USER_ID');
    const apiKey = Deno.env.get('WAAFI_API_KEY');
    if (!merchantUid || !apiUserId || !apiKey) throw new Error('Server configuration error');

    // 6. Call WaafiPay
    const referenceId = `APP-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const waafiPayload = {
      schemaVersion: '1.0',
      requestId: referenceId,
      timestamp: new Date().toISOString(),
      channelName: 'WEB',
      serviceName: 'API_PURCHASE', // Triggers instant mobile money USSD
      serviceParams: {
        merchantUid, apiUserId, apiKey,
        paymentMethod: 'MWALLET_ACCOUNT',
        payerInfo: { accountNo: cleanPhone, accountType: 'MSISDN' },
        transactionInfo: {
          referenceId,
          invoiceId: referenceId,
          amount: plan.amount,
          currency: 'USD',
          description: plan.name,
        },
      },
    };

    const waafiResponse = await fetch('https://api.waafipay.net/asm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(waafiPayload),
    });

    const waafiResult = await waafiResponse.json();
    const isSuccess = waafiResult?.params?.state === 'APPROVED' || waafiResult?.responseCode === '2001';

    // 7. Handle Success
    if (isSuccess) {
      const transactionId = waafiResult?.params?.transactionId || referenceId;
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + plan.months);

      // Securely bypass RLS with Service Role to insert row
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
        }).select().single();

      if (subError) throw new Error('Payment succeeded but database failed: ' + transactionId);

      return new Response(
        JSON.stringify({ success: true, subscription_id: subData?.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 8. Handle Failure
    const errorMsg = waafiResult?.params?.description || waafiResult?.responseMsg || 'Declined';
    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } } // Return 200 to prevent edge runtime crashes
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err.message || 'Server error' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 4. Client Side React Hook (`useSubscription.ts`)

Allows your app to listen to the subscription state and safely execute payments with a timeout recovery mechanism.

```typescript
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase"; // adjust path

export function useSubscription(userId?: string) {
  const [subscription, setSubscription] = useState<any>(null);
  const [isActive, setIsActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkSubscription = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    try {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString())
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setSubscription(data);
      setIsActive(!!data);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { checkSubscription(); }, [checkSubscription]);

  const createPayment = async (channel: "EVC" | "ZAAD", phone: string) => {
    // Calling the edge function
    const { data, error } = await supabase.functions.invoke("create_payment", {
      body: { payment_channel: channel, phone_number: phone }
    });

    if (data?.success) {
      await checkSubscription();
      return true;
    }

    // ⚠️ RECOVERY LOGIC: If the user paid, but the edge function timed out
    // returning the HTTPS response, we check the database directly just in case.
    await new Promise((r) => setTimeout(r, 1500));
    await checkSubscription();
    
    // If the check uncovers they are active, it means the payment actually succeeded.
    if (isActive) return true;

    throw new Error(data?.error || "Payment failed");
  };

  return { subscription, isActive, loading, checkSubscription, createPayment };
}
```

---

## 5. UI Integration Strategy

1. **The Paywall Gate**
   Implement the hard paywall inside your authentication routing structure. E.g., inside an `useEffect` tracking the router:
   ```typescript
   if (!isActive && !loading) {
     router.replace("/payment-screen");
   } else {
     router.replace("/(tabs)/home");
   }
   ```
2. **The Phone Input**
   Always prefix inputs with `252` visually to help users avoid mistakes, and clean the string before sending it to `createPayment(channel, cleanDigits)`.
3. **Button State**
   The Edge Function takes anywhere from `3 to 15 seconds` because it has to wait for the user to type their PIN on their phone. Ensure your button shows an `<ActivityIndicator />` while processing so the user doesn't double-tap.
