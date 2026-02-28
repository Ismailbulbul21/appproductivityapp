import { useEffect, useState, useCallback } from "react";
import { supabase } from "../services/supabase";
import type { FocusSession } from "../services/types";

export interface FocusSettings {
  blockedApps: string[];
  defaultDurationMinutes: number;
  strictMode: boolean;
}

const DEFAULT_SETTINGS: FocusSettings = {
  blockedApps: [],
  defaultDurationMinutes: 25,
  strictMode: true,
};

export function useFocusSettings(userId: string | undefined) {
  const [settings, setSettings] = useState<FocusSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("focus_blocked_apps, focus_default_duration_minutes, focus_strict_mode")
      .eq("id", userId)
      .single();
    if (data) {
      setSettings({
        blockedApps: (data.focus_blocked_apps as string[]) ?? [],
        defaultDurationMinutes: data.focus_default_duration_minutes ?? 25,
        strictMode: data.focus_strict_mode ?? true,
      });
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const setBlockedApps = useCallback(
    async (apps: string[]) => {
      if (!userId) return;
      setSettings((prev) => ({ ...prev, blockedApps: apps }));
      await supabase
        .from("profiles")
        .update({ focus_blocked_apps: apps })
        .eq("id", userId);
    },
    [userId]
  );

  const setDefaultDuration = useCallback(
    async (minutes: number) => {
      if (!userId) return;
      setSettings((prev) => ({ ...prev, defaultDurationMinutes: minutes }));
      await supabase
        .from("profiles")
        .update({ focus_default_duration_minutes: minutes })
        .eq("id", userId);
    },
    [userId]
  );

  const setStrictMode = useCallback(
    async (enabled: boolean) => {
      if (!userId) return;
      setSettings((prev) => ({ ...prev, strictMode: enabled }));
      await supabase
        .from("profiles")
        .update({ focus_strict_mode: enabled })
        .eq("id", userId);
    },
    [userId]
  );

  const logSession = useCallback(
    async (session: {
      started_at: string;
      ended_at: string;
      duration_seconds: number;
      completed: boolean;
    }) => {
      if (!userId) return;
      await supabase.from("focus_sessions").insert({
        user_id: userId,
        ...session,
      });
    },
    [userId]
  );

  return {
    settings,
    loading,
    setBlockedApps,
    setDefaultDuration,
    setStrictMode,
    logSession,
    refetch: fetchSettings,
  };
}
