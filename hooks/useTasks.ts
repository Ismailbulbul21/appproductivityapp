import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "../services/supabase";
import type { Task } from "../services/types";
import {
  scheduleTaskNotifications,
  cancelTaskNotifications,
} from "../services/notifications";
import { useAuth } from "./useAuth";

type TasksContextValue = {
  tasks: Task[];
  loading: boolean;
  addTask: (task: {
    title: string;
    due_date: string | null;
    due_time: string | null;
    priority: string;
    goal_id: string | null;
    reminder_minutes_before?: number;
  }) => Promise<void>;
  completeTask: (taskId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  updateTask: (
    taskId: string,
    updates: Partial<
      Pick<Task, "title" | "due_date" | "due_time" | "priority" | "goal_id">
    >
  ) => Promise<void>;
  refetch: () => Promise<void>;
};

const TasksContext = createContext<TasksContextValue | null>(null);

export function TasksProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
  const userId = session?.user.id;
  const notificationsEnabled = profile?.notifications_enabled !== false;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!userId) {
      setTasks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("due_date", { ascending: true });
    setTasks(data ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchTasks();

    if (!userId) return;
    const channel = supabase
      .channel("tasks-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchTasks]);

  const addTask = useCallback(
    async (task: {
      title: string;
      due_date: string | null;
      due_time: string | null;
      priority: string;
      goal_id: string | null;
      reminder_minutes_before?: number;
    }) => {
      if (!userId) return;

      const minutesBefore = task.reminder_minutes_before ?? 0;
      const newTask: Partial<Task> = {
        user_id: userId,
        title: task.title,
        due_date: task.due_date,
        due_time: task.due_time,
        priority: task.priority as Task["priority"],
        status: "todo",
        goal_id: task.goal_id,
        notification_id: null,
        notification_id_early: null,
        reminder_minutes_before: minutesBefore,
      };

      const optimistic = {
        ...newTask,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        completed_at: null,
      } as Task;
      setTasks((prev) => [optimistic, ...prev]);

      const { data, error } = await supabase
        .from("tasks")
        .insert(newTask)
        .select()
        .single();

      if (error) {
        setTasks((prev) => prev.filter((t) => t.id !== optimistic.id));
        throw error;
      }

      let notification_id: string | null = null;
      let notification_id_early: string | null = null;
      if (
        data &&
        task.due_date &&
        task.due_time &&
        notificationsEnabled
      ) {
        const ids = await scheduleTaskNotifications(
          data.id,
          task.title,
          task.due_date,
          task.due_time,
          minutesBefore
        );
        notification_id = ids.atTimeId;
        notification_id_early = ids.earlyId;
        await supabase
          .from("tasks")
          .update({
            notification_id: notification_id ?? null,
            notification_id_early: notification_id_early ?? null,
          })
          .eq("id", data.id);
      }

      if (data) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === optimistic.id
              ? {
                  ...(data as Task),
                  notification_id,
                  notification_id_early: notification_id_early ?? null,
                }
              : t
          )
        );
      }
    },
    [userId, notificationsEnabled]
  );

  const completeTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);

      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "done" as const, completed_at: new Date().toISOString() }
            : t
        )
      );

      const { error } = await supabase
        .from("tasks")
        .update({ status: "done", completed_at: new Date().toISOString() })
        .eq("id", taskId);

      if (error) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId ? { ...t, status: "todo" as const, completed_at: null } : t
          )
        );
        throw error;
      }

      await cancelTaskNotifications(
        task?.notification_id,
        task?.notification_id_early
      );
    },
    [tasks]
  );

  const deleteTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      const { error } = await supabase.from("tasks").delete().eq("id", taskId);
      if (error) {
        fetchTasks();
        throw error;
      }

      await cancelTaskNotifications(
        task?.notification_id,
        task?.notification_id_early
      );
    },
    [tasks, fetchTasks]
  );

  const updateTask = useCallback(
    async (
      taskId: string,
      updates: Partial<
        Pick<
          Task,
          "title" | "due_date" | "due_time" | "priority" | "goal_id" | "reminder_minutes_before"
        >
      >
    ) => {
      const task = tasks.find((t) => t.id === taskId);
      const dueChanged =
        updates.due_date !== undefined || updates.due_time !== undefined;

      if (dueChanged || updates.reminder_minutes_before !== undefined) {
        await cancelTaskNotifications(
          task?.notification_id,
          task?.notification_id_early
        );
      }

      let notification_id: string | null = null;
      let notification_id_early: string | null = null;
      const newDate = updates.due_date ?? task?.due_date;
      const newTime = updates.due_time ?? task?.due_time;
      const minutesBefore =
        updates.reminder_minutes_before ?? task?.reminder_minutes_before ?? 0;

      if (newDate && newTime && notificationsEnabled) {
        const ids = await scheduleTaskNotifications(
          taskId,
          updates.title ?? task?.title ?? "",
          newDate,
          newTime,
          minutesBefore
        );
        notification_id = ids.atTimeId;
        notification_id_early = ids.earlyId;
      }

      const { error } = await supabase
        .from("tasks")
        .update({
          ...updates,
          notification_id,
          notification_id_early: notification_id_early ?? null,
        })
        .eq("id", taskId);

      if (error) throw error;
      await fetchTasks();
    },
    [tasks, fetchTasks, notificationsEnabled]
  );

  const value: TasksContextValue = {
    tasks,
    loading,
    addTask,
    completeTask,
    deleteTask,
    updateTask,
    refetch: fetchTasks,
  };

  return React.createElement(TasksContext.Provider, { value }, children);
}

export function useTasks(): TasksContextValue {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error("useTasks must be used within TasksProvider");
  return ctx;
}
