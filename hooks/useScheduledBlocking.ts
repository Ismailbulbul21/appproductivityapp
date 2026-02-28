import { useEffect, useState, useCallback } from "react";
import { supabase } from "../services/supabase";
import type { FocusSchedule } from "../services/types";

export function useScheduledBlocking(userId: string | undefined) {
  const [schedules, setSchedules] = useState<FocusSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const { data } = await supabase
      .from("focus_schedules")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["pending", "active"])
      .order("start_time", { ascending: true });
    if (data) setSchedules(data as FocusSchedule[]);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const addSchedule = useCallback(
    async (schedule: {
      blocked_apps: string[];
      start_time: string;
      duration_minutes: number;
    }) => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("focus_schedules")
        .insert({ user_id: userId, ...schedule })
        .select()
        .single();
      if (error) return null;
      const newSchedule = data as FocusSchedule;
      setSchedules((prev) =>
        [...prev, newSchedule].sort(
          (a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        )
      );
      return newSchedule;
    },
    [userId]
  );

  const cancelSchedule = useCallback(
    async (scheduleId: string) => {
      if (!userId) return;
      await supabase
        .from("focus_schedules")
        .update({ status: "cancelled" })
        .eq("id", scheduleId)
        .eq("user_id", userId);
      setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    },
    [userId]
  );

  const updateScheduleStatus = useCallback(
    async (scheduleId: string, status: FocusSchedule["status"]) => {
      if (!userId) return;
      await supabase
        .from("focus_schedules")
        .update({ status })
        .eq("id", scheduleId)
        .eq("user_id", userId);
      if (status === "completed" || status === "cancelled") {
        setSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
      } else {
        setSchedules((prev) =>
          prev.map((s) => (s.id === scheduleId ? { ...s, status } : s))
        );
      }
    },
    [userId]
  );

  return {
    schedules,
    loading,
    addSchedule,
    cancelSchedule,
    updateScheduleStatus,
    refetch: fetchSchedules,
  };
}
