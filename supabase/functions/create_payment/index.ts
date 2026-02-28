import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Single plan: monthly $0.50
const PLAN_PRICES: Record<string, { amount: number; months: number }> = {
    'monthly': { amount: 0.50, months: 1 },
};

const PRODUCT_NAME = 'Qorsheyn';

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

        // Create Supabase clients
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

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
        const { payment_channel, phone_number } = body;
        const plan_type = 'monthly'; // Only monthly plan

        console.log('Payment request:', { user_id: user.id, plan_type, payment_channel, phone_number });

        // Validate inputs
        if (!payment_channel || !phone_number) {
            return new Response(
                JSON.stringify({ success: false, error: 'Missing required fields: payment_channel, phone_number' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        const plan = PLAN_PRICES[plan_type];

        if (!['EVC', 'ZAAD', 'SAHAL'].includes(payment_channel)) {
            return new Response(
                JSON.stringify({ success: false, error: 'Invalid payment channel. Use EVC, ZAAD, or SAHAL.' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Clean phone number - ensure it starts with 252
        let cleanPhone = String(phone_number).replace(/\D/g, '');
        if (!cleanPhone.startsWith('252')) {
            if (cleanPhone.startsWith('0')) {
                cleanPhone = '252' + cleanPhone.substring(1);
            } else if (cleanPhone.length <= 9) {
                cleanPhone = '252' + cleanPhone;
            }
        }

        // Get WaafiPay credentials from secrets
        const merchantUid = Deno.env.get('WAAFI_MERCHANT_UID') || Deno.env.get('WAAFIPAY_MERCHANT_UID');
        const apiUserId = Deno.env.get('WAAFI_API_USER_ID') || Deno.env.get('WAAFIPAY_API_USER_ID');
        const apiKey = Deno.env.get('WAAFI_API_KEY') || Deno.env.get('WAAFIPAY_API_KEY');

        if (!merchantUid || !apiUserId || !apiKey) {
            console.error('Missing WaafiPay credentials:', {
                hasMerchantUid: !!merchantUid,
                hasApiUserId: !!apiUserId,
                hasApiKey: !!apiKey,
            });
            return new Response(
                JSON.stringify({ success: false, error: 'Payment service configuration error. Please contact support.' }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // Generate unique reference
        const referenceId = `QORSHEYN-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        // Build WaafiPay API request (API_PURCHASE for direct mobile money charge)
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

        console.log('Calling WaafiPay API...');

        // Call WaafiPay API
        const waafiResponse = await fetch('https://api.waafipay.net/asm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(waafiPayload),
        });

        const waafiResult = await waafiResponse.json();
        console.log('WaafiPay response:', JSON.stringify(waafiResult));

        // Check WaafiPay response
        const state = waafiResult?.params?.state;
        const responseCode = waafiResult?.responseCode;
        const isSuccess = state === 'APPROVED' || responseCode === '2001';

        if (isSuccess) {
            // Payment successful - create subscription
            const startDate = new Date();
            const endDate = new Date();
            endDate.setMonth(endDate.getMonth() + plan.months);

            const transactionId = waafiResult?.params?.transactionId ||
                waafiResult?.params?.referenceId || referenceId;

            // Insert subscription using admin client
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
                console.error('Subscription insert error:', subError);
                return new Response(
                    JSON.stringify({
                        success: false,
                        error: 'Payment was successful but subscription activation failed. Please contact support with reference: ' + transactionId,
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
        }

        // Payment failed
        const errorMsg = waafiResult?.params?.description ||
            waafiResult?.responseMsg || 'Payment was declined by the provider';

        console.error('Payment declined:', errorMsg);

        return new Response(
            JSON.stringify({ success: false, error: `Payment declined: ${errorMsg}` }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    } catch (err: any) {
        console.error('Unhandled error:', err);
        return new Response(
            JSON.stringify({ success: false, error: 'An unexpected error occurred. Please try again.' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
});
