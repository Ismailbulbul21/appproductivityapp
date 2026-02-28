export interface Profile {
  id: string;
  email: string;
  focus_type: string | null;
  created_at: string;
  notifications_enabled?: boolean;
  goal_reminder_day?: number | null;
  goal_reminder_time?: string | null;
  goal_reminder_interval_days?: number | null;
  focus_blocked_apps?: string[];
  focus_default_duration_minutes?: number;
  focus_strict_mode?: boolean;
}

export interface FocusSession {
  id: string;
  user_id: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  completed: boolean;
  created_at: string;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  due_time: string | null;
  priority: "Hoose" | "Dhexe" | "Sare";
  status: "todo" | "done";
  goal_id: string | null;
  notification_id: string | null;
  notification_id_early: string | null;
  reminder_minutes_before: number;
  created_at: string;
  completed_at: string | null;
}

export interface FocusSchedule {
  id: string;
  user_id: string;
  blocked_apps: string[];
  start_time: string;
  duration_minutes: number;
  status: "pending" | "active" | "completed" | "cancelled";
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  type: string; // e.g. "Toddobaad", "1 bil", "2 bil", ... "11 bil", "Sanad"
  deadline: string;
  created_at: string;
}

export interface FocusGroupSession {
  id: string;
  creator_id: string;
  invite_code: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  blocked_apps: string[];
  strict_mode: boolean;
  status: "scheduled" | "active" | "ended" | "cancelled";
  created_at: string;
}

export interface FocusGroupMember {
  id: string;
  session_id: string;
  user_id: string;
  status: "invited" | "accepted";
  joined_at: string;
}
