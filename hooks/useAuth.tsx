import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../services/supabase";
import { stopBlocking } from "../services/focusBlocking";
import type { Session } from "@supabase/supabase-js";
import type { Profile } from "../services/types";

const FOCUS_STORAGE_KEYS = [
  "focus_session_end_time_ms",
  "focus_session_start_time_ms",
  "focus_session_blocked_apps",
  "focus_session_user_id",
];

type AuthContextValue = {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateFocusType: (focusType: string) => Promise<void>;
  updateNotificationsEnabled: (enabled: boolean) => Promise<void>;
  updateGoalReminder: (opts: {
    day: number | null;
    time: string | null;
    intervalDays: number | null;
  }) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) fetchProfile(s.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) {
        setLoading(true);
        fetchProfile(s.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
    setLoading(false);
  }

  const updateFocusType = useCallback(
    async (focusType: string) => {
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .update({ focus_type: focusType })
        .eq("id", session.user.id)
        .select()
        .single();
      if (data) setProfile(data);
    },
    [session]
  );

  const updateNotificationsEnabled = useCallback(
    async (enabled: boolean) => {
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .update({ notifications_enabled: enabled })
        .eq("id", session.user.id)
        .select()
        .single();
      if (data) setProfile(data);
    },
    [session]
  );

  const updateGoalReminder = useCallback(
    async (opts: {
      day: number | null;
      time: string | null;
      intervalDays: number | null;
    }) => {
      if (!session) return;
      const { data } = await supabase
        .from("profiles")
        .update({
          goal_reminder_day: opts.day,
          goal_reminder_time: opts.time,
          goal_reminder_interval_days: opts.intervalDays,
        })
        .eq("id", session.user.id)
        .select()
        .single();
      if (data) setProfile(data);
    },
    [session]
  );

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await stopBlocking();
    await AsyncStorage.multiRemove(FOCUS_STORAGE_KEYS);
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value: AuthContextValue = {
    session,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    updateFocusType,
    updateNotificationsEnabled,
    updateGoalReminder,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
