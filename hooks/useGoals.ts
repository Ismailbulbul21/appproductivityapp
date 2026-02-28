import { useEffect, useState, useCallback } from "react";
import { supabase } from "../services/supabase";
import type { Goal, Task } from "../services/types";

export interface GoalWithProgress extends Goal {
  totalTasks: number;
  completedTasks: number;
  progress: number;
  daysRemaining: number;
}

export function useGoals(userId: string | undefined) {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGoals = useCallback(async () => {
    if (!userId) return;
    setLoading(true);

    const { data: goalsData } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", userId)
      .order("deadline", { ascending: true });

    if (!goalsData) {
      setLoading(false);
      return;
    }

    const { data: tasksData } = await supabase
      .from("tasks")
      .select("id, goal_id, status")
      .eq("user_id", userId)
      .not("goal_id", "is", null);

    const tasksByGoal = (tasksData ?? []).reduce(
      (acc, t) => {
        if (!t.goal_id) return acc;
        if (!acc[t.goal_id]) acc[t.goal_id] = { total: 0, completed: 0 };
        acc[t.goal_id].total++;
        if (t.status === "done") acc[t.goal_id].completed++;
        return acc;
      },
      {} as Record<string, { total: number; completed: number }>
    );

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const enriched: GoalWithProgress[] = goalsData.map((g) => {
      const stats = tasksByGoal[g.id] ?? { total: 0, completed: 0 };
      const [y, m, d] = (g.deadline as string).split("-").map(Number);
      const deadlineStart = new Date(y, m - 1, d);
      const daysRemaining = Math.max(
        0,
        Math.round((deadlineStart.getTime() - todayStart.getTime()) / 86400000)
      );
      return {
        ...g,
        totalTasks: stats.total,
        completedTasks: stats.completed,
        progress: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0,
        daysRemaining,
      };
    });

    setGoals(enriched);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchGoals();

    if (!userId) return;
    const channel = supabase
      .channel("goals-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "goals",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchGoals()
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchGoals()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchGoals]);

  const addGoal = useCallback(
    async (goal: { title: string; type: string; deadline: string }) => {
      if (!userId) return;
      const { error } = await supabase.from("goals").insert({
        user_id: userId,
        title: goal.title,
        type: goal.type,
        deadline: goal.deadline,
      });
      if (error) throw error;
    },
    [userId]
  );

  const deleteGoal = useCallback(
    async (goalId: string) => {
      const { error } = await supabase
        .from("goals")
        .delete()
        .eq("id", goalId);
      if (error) throw error;
      await fetchGoals();
    },
    [fetchGoals]
  );

  return { goals, loading, addGoal, deleteGoal, refetch: fetchGoals };
}
