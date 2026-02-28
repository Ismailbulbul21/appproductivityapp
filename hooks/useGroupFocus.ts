import { useEffect, useState, useCallback } from "react";
import { supabase } from "../services/supabase";
import type { FocusGroupSession, FocusGroupMember } from "../services/types";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateInviteCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export interface GroupMemberWithEmail extends FocusGroupMember {
  email?: string;
}

export function useGroupFocus(userId: string | undefined) {
  const [activeSession, setActiveSession] = useState<FocusGroupSession | null>(
    null
  );
  const [members, setMembers] = useState<GroupMemberWithEmail[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMembers = useCallback(async (sessionId: string) => {
    const { data } = await supabase
      .from("focus_group_members")
      .select("*")
      .eq("session_id", sessionId);
    if (!data) return;
    const memberList = data as FocusGroupMember[];
    const userIds = memberList.map((m) => m.user_id);
    if (userIds.length === 0) {
      setMembers([]);
      return;
    }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email")
      .in("id", userIds);
    const emailMap: Record<string, string> = {};
    (profiles ?? []).forEach((p: { id: string; email: string }) => {
      emailMap[p.id] = p.email;
    });
    setMembers(
      memberList.map((m) => ({ ...m, email: emailMap[m.user_id] ?? undefined }))
    );
  }, []);

  const fetchActiveSession = useCallback(async () => {
    if (!userId) return;
    const { data: memberRows } = await supabase
      .from("focus_group_members")
      .select("session_id")
      .eq("user_id", userId);
    if (!memberRows || memberRows.length === 0) {
      setActiveSession(null);
      setMembers([]);
      return;
    }
    const sessionIds = memberRows.map((r) => r.session_id);
    const { data: sessions } = await supabase
      .from("focus_group_sessions")
      .select("*")
      .in("id", sessionIds)
      .in("status", ["scheduled", "active"])
      .order("start_time", { ascending: true })
      .limit(1);
    if (sessions && sessions.length > 0) {
      const s = sessions[0] as FocusGroupSession;
      setActiveSession(s);
      await fetchMembers(s.id);
    } else {
      setActiveSession(null);
      setMembers([]);
    }
  }, [userId, fetchMembers]);

  useEffect(() => {
    fetchActiveSession();
  }, [fetchActiveSession]);

  const createSession = useCallback(
    async (opts: {
      start_time: string;
      duration_minutes: number;
      blocked_apps: string[];
      strict_mode: boolean;
    }): Promise<{ session: FocusGroupSession | null; error?: string }> => {
      if (!userId) return { session: null, error: "Fadlan gal kohor (not signed in)" };
      setLoading(true);
      const startMs = new Date(opts.start_time).getTime();
      const endMs = startMs + opts.duration_minutes * 60 * 1000;
      const end_time = new Date(endMs).toISOString();

      let invite_code = generateInviteCode();
      let attempts = 0;
      let session: FocusGroupSession | null = null;
      let lastError = "";

      while (attempts < 5) {
        const { error: insertError } = await supabase
          .from("focus_group_sessions")
          .insert({
            creator_id: userId,
            invite_code,
            start_time: opts.start_time,
            end_time,
            duration_minutes: opts.duration_minutes,
            blocked_apps: opts.blocked_apps,
            strict_mode: opts.strict_mode,
          });

        if (insertError) {
          if (insertError.code === "23505") {
            invite_code = generateInviteCode();
            attempts++;
            continue;
          }
          lastError = `INSERT: ${insertError.message} (${insertError.code})`;
          break;
        }

        const { data, error: selectError } = await supabase
          .from("focus_group_sessions")
          .select("*")
          .eq("invite_code", invite_code)
          .eq("creator_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (selectError) {
          lastError = `SELECT: ${selectError.message} (${selectError.code})`;
          break;
        }
        if (data) session = data as FocusGroupSession;
        break;
      }

      if (session) {
        await supabase
          .from("focus_group_members")
          .insert({
            session_id: session.id,
            user_id: userId,
            status: "accepted",
          });
        setActiveSession(session);
        await fetchMembers(session.id);
      }
      setLoading(false);
      return { session, error: session ? undefined : lastError || "Unknown error" };
    },
    [userId, fetchMembers]
  );

  const joinByCode = useCallback(
    async (
      code: string
    ): Promise<{ session: FocusGroupSession | null; error?: string }> => {
      if (!userId) return { session: null, error: "Not signed in" };
      setLoading(true);
      const trimmed = code.trim().toUpperCase();

      const { data: sessions } = await supabase
        .from("focus_group_sessions")
        .select("*")
        .eq("invite_code", trimmed)
        .in("status", ["scheduled", "active"])
        .limit(1);

      if (!sessions || sessions.length === 0) {
        setLoading(false);
        return { session: null, error: "Code-kan lama helin ama waa la dhamaaday" };
      }

      const s = sessions[0] as FocusGroupSession;
      if (new Date(s.end_time).getTime() <= Date.now()) {
        setLoading(false);
        return { session: null, error: "Session-kan waa dhamaaday" };
      }

      const { error } = await supabase.from("focus_group_members").insert({
        session_id: s.id,
        user_id: userId,
        status: "accepted",
      });

      if (error) {
        if (error.code === "23505") {
          setActiveSession(s);
          await fetchMembers(s.id);
          setLoading(false);
          return { session: s };
        }
        setLoading(false);
        return { session: null, error: "Ku biirista way fashilantay" };
      }

      setActiveSession(s);
      await fetchMembers(s.id);
      setLoading(false);
      return { session: s };
    },
    [userId, fetchMembers]
  );

  const cancelSession = useCallback(
    async (sessionId: string) => {
      if (!userId) return;
      await supabase
        .from("focus_group_sessions")
        .update({ status: "cancelled" })
        .eq("id", sessionId)
        .eq("creator_id", userId);
      setActiveSession(null);
      setMembers([]);
    },
    [userId]
  );

  const leaveSession = useCallback(
    async (sessionId: string) => {
      if (!userId) return;
      await supabase
        .from("focus_group_members")
        .delete()
        .eq("session_id", sessionId)
        .eq("user_id", userId);
      setActiveSession(null);
      setMembers([]);
    },
    [userId]
  );

  const markActive = useCallback(async (sessionId: string) => {
    await supabase
      .from("focus_group_sessions")
      .update({ status: "active" })
      .eq("id", sessionId);
    setActiveSession((prev) =>
      prev && prev.id === sessionId ? { ...prev, status: "active" } : prev
    );
  }, []);

  const markEnded = useCallback(async (sessionId: string) => {
    await supabase
      .from("focus_group_sessions")
      .update({ status: "ended" })
      .eq("id", sessionId);
    setActiveSession(null);
    setMembers([]);
  }, []);

  const refreshMembers = useCallback(async () => {
    if (activeSession) await fetchMembers(activeSession.id);
  }, [activeSession, fetchMembers]);

  return {
    activeSession,
    members,
    loading,
    createSession,
    joinByCode,
    cancelSession,
    leaveSession,
    markActive,
    markEnded,
    refreshMembers,
    refetch: fetchActiveSession,
  };
}
