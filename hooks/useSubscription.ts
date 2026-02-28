import { useState, useEffect, useCallback } from "react";
import { supabase } from "../services/supabase";

export interface Subscription {
  id: string;
  user_id: string;
  plan_type: string;
  start_date: string;
  end_date: string;
  status: string;
  payment_reference: string | null;
  payment_channel: string | null;
  amount: number | null;
  currency: string | null;
  created_at: string;
}

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
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString())
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setSubscription(null);
        setIsActive(false);
      } else {
        setSubscription(data as Subscription);
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
    paymentChannel: "EVC" | "ZAAD" | "SAHAL",
    phoneNumber: string
  ) => {
    if (!userId) throw new Error("Fadlan gal akaawunkaaga.");

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error("Fadlan gal akaawunkaaga mar kale.");
    }

    const { data, error } = await supabase.functions.invoke("create_payment", {
      body: {
        payment_channel: paymentChannel,
        phone_number: phoneNumber,
      },
    });

    // Success path
    if (data?.success) {
      await checkSubscription();
      return data;
    }

    // Error path with recovery
    if (error) {
      let errorMessage = "Lacag bixintu way fashilantay.";
      if (error.context && typeof error.context.json === "function") {
        try {
          const errorBody = await error.context.json();
          errorMessage =
            errorBody?.error || errorBody?.message || errorMessage;
        } catch { }
      }
      // Recovery: payment may have succeeded but response was lost
      await new Promise((r) => setTimeout(r, 1500));
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      await checkSubscription();
      if (sub)
        return {
          success: true,
          message: "Lacag bixintaadu way guuleysatay!",
          recovered: true,
        };
      throw new Error(errorMessage);
    }

    // Null data (timeout) with recovery
    if (!data) {
      await new Promise((r) => setTimeout(r, 1500));
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .gte("end_date", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      await checkSubscription();
      if (sub)
        return {
          success: true,
          message: "Lacag bixintaadu way guuleysatay!",
          recovered: true,
        };
      throw new Error("Jawaab lama helin. Fadlan isku day mar kale.");
    }

    throw new Error(data.error || "Lacag bixintu way fashilantay.");
  };

  return { subscription, isActive, loading, checkSubscription, createPayment };
}
