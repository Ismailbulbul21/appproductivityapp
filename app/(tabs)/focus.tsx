import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  Switch,
  Alert,
  AppState,
  Platform,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Share,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import { useAuth } from "../../hooks/useAuth";
import { useFocusSettings } from "../../hooks/useFocusSettings";
import { useScheduledBlocking } from "../../hooks/useScheduledBlocking";
import { useGroupFocus } from "../../hooks/useGroupFocus";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import {
  isNativeBlockingAvailable,
  startBlocking,
  stopBlocking,
  hasPermissions as checkNativePermissions,
  requestPermissions as requestNativePermissions,
  checkMissingPermission,
  getInstalledApps,
  requestFocusAuthorization,
  openAppPicker as nativeOpenAppPicker,
  scheduleBlocking,
  cancelScheduledBlocking,
} from "../../services/focusBlocking";

// ── Storage keys ─────────────────────────────────────────────────
const FOCUS_SESSION_END_TIME_KEY = "focus_session_end_time_ms";
const FOCUS_SESSION_START_TIME_KEY = "focus_session_start_time_ms";
const FOCUS_SESSION_BLOCKED_APPS_KEY = "focus_session_blocked_apps";
const FOCUS_SESSION_USER_ID_KEY = "focus_session_user_id";
const FOCUS_STRICT_FIRST_VISIT_KEY_PREFIX = "focus_strict_first_visit_done_";
const GROUP_SESSION_KEY = "group_focus_session_id";
const GROUP_SESSION_END_KEY = "group_focus_end_time_ms";
const GROUP_SESSION_APPS_KEY = "group_focus_blocked_apps";
const SCHED_ACTIVE_ID_KEY = "sched_blocking_active_id";
const SCHED_ACTIVE_END_KEY = "sched_blocking_end_ms";
const SCHED_ACTIVE_APPS_KEY = "sched_blocking_apps";

// ── Somali date helpers ──────────────────────────────────────────
const SOMALI_DAYS = [
  "Axad",
  "Isniin",
  "Talaado",
  "Arbaco",
  "Khamiis",
  "Jimce",
  "Sabti",
];
const SOMALI_MONTHS = [
  "Janaayo",
  "Febraayo",
  "Maarso",
  "Abriil",
  "Maayo",
  "Juun",
  "Luuliyo",
  "Ogost",
  "Sebtembar",
  "Oktoobar",
  "Nofembar",
  "Disembar",
];

function formatSomaliDate(): string {
  const d = new Date();
  return `${SOMALI_DAYS[d.getDay()]}, ${d.getDate()} ${SOMALI_MONTHS[d.getMonth()]}`;
}

// ── Duration presets ─────────────────────────────────────────────
const DURATION_PRESETS_MINUTES = [
  { minutes: 1 },
  { minutes: 15 },
  { minutes: 25 },
  { minutes: 45 },
] as const;
const DURATION_PRESETS_HOURS = [
  { minutes: 60 },
  { minutes: 90 },
  { minutes: 120 },
] as const;
const DURATION_PRESETS_DAYS = [
  { minutes: 1440 },
  { minutes: 2880 },
  { minutes: 4320 },
] as const;

function formatDurationLabel(minutes: number): string {
  if (minutes >= 1440) {
    const d = Math.round(minutes / 1440);
    return d === 1 ? "1 maal" : d + " maalmood";
  }
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h + ":" + (m < 10 ? "0" + m : m) + " saac";
  }
  return minutes + " daqiiqo";
}

function formatTimerDisplay(totalSeconds: number): string {
  if (totalSeconds >= 86400) {
    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    return d + "d " + h + "h";
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

function formatScheduleTime(isoString: string): string {
  const d = new Date(isoString);
  return `${d.getHours()}:${d.getMinutes() < 10 ? "0" + d.getMinutes() : d.getMinutes()}`;
}

function formatScheduleDate(isoString: string): string {
  const d = new Date(isoString);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  if (d.toDateString() === today.toDateString()) return "Maanta";
  if (d.toDateString() === tomorrow.toDateString()) return "Berri";
  return `${d.getDate()} ${SOMALI_MONTHS[d.getMonth()]}`;
}

function getScheduleStatus(
  startTime: string,
  durationMinutes: number,
  status: string
): "upcoming" | "active" | "ended" {
  if (status === "completed" || status === "cancelled") return "ended";
  const start = new Date(startTime).getTime();
  const end = start + durationMinutes * 60 * 1000;
  const now = Date.now();
  if (now < start) return "upcoming";
  if (now < end) return "active";
  return "ended";
}

// ── Demo apps ────────────────────────────────────────────────────
const DEMO_BLOCKED_APPS = [
  { id: "instagram", name: "Instagram", icon: "📷" },
  { id: "tiktok", name: "TikTok", icon: "🎵" },
  { id: "youtube", name: "YouTube", icon: "▶️" },
  { id: "twitter", name: "X (Twitter)", icon: "🐦" },
  { id: "snapchat", name: "Snapchat", icon: "💬" },
  { id: "facebook", name: "Facebook", icon: "📘" },
  { id: "reddit", name: "Reddit", icon: "🟠" },
  { id: "whatsapp", name: "WhatsApp", icon: "💚" },
];

function AppIcon({ icon, size = 24 }: { icon: string; size?: number }) {
  if (icon.startsWith("data:image")) {
    return (
      <Image
        source={{ uri: icon }}
        style={{ width: size, height: size, borderRadius: 6 }}
      />
    );
  }
  return <Text style={{ fontSize: size * 0.75 }}>{icon}</Text>;
}

// ── Pill button helper ───────────────────────────────────────────
function Pill({
  label,
  selected,
  onPress,
  color = "#059669",
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-xl px-4 py-2.5 items-center justify-center active:opacity-80"
      style={{
        backgroundColor: selected ? color : "#f1f5f9",
        minWidth: 64,
      }}
    >
      <Text
        className="text-sm font-bold"
        style={{ color: selected ? "#fff" : "#64748b" }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ── Back header ──────────────────────────────────────────────────
function BackHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3 px-5 pt-4 pb-3">
      <Pressable
        onPress={onBack}
        className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center active:bg-gray-200"
      >
        <Feather name="arrow-left" size={20} color="#374151" />
      </Pressable>
      <Text className="text-xl font-extrabold text-gray-900 flex-1">
        {title}
      </Text>
    </View>
  );
}

type FocusScreen =
  | "home"
  | "timer"
  | "groupChoices"
  | "joinCode"
  | "groupWaiting"
  | "groupInvite"
  | "groupTimer";

// ═════════════════════════════════════════════════════════════════
// ██ Main Component ██
// ═════════════════════════════════════════════════════════════════
export default function Focus() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const { settings, loading, setBlockedApps, setStrictMode, logSession } =
    useFocusSettings(userId);
  const {
    schedules,
    addSchedule,
    cancelSchedule: rawCancelSchedule,
    updateScheduleStatus,
    refetch: refetchSchedules,
  } = useScheduledBlocking(userId);

  const cancelScheduleWrapper = async (id: string) => {
    if (Platform.OS === "android" && isNativeBlockingAvailable) {
      await cancelScheduledBlocking(id);
    }
    return rawCancelSchedule(id);
  };
  const {
    activeSession: groupSession,
    members: groupMembers,
    loading: groupLoading,
    createSession: createGroupSession,
    joinByCode,
    cancelSession: cancelGroupSession,
    leaveSession: leaveGroupSession,
    markActive: markGroupActive,
    markEnded: markGroupEnded,
    refreshMembers,
  } = useGroupFocus(userId);

  // ── Screen navigation ────────────────────────────────────────
  const [screen, setScreen] = useState<FocusScreen>("home");

  // ── Solo focus state ─────────────────────────────────────────
  const [sheetOpen, setSheetOpen] = useState(false);
  const [appPickerOpen, setAppPickerOpen] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [isCustomDuration, setIsCustomDuration] = useState(false);
  const [customMinutesInput, setCustomMinutesInput] = useState("25");
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [nativeApps, setNativeApps] = useState<
    { packageName: string; label: string; icon?: string }[]
  >([]);
  const [permGranted, setPermGranted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [sessionStartedAt, setSessionStartedAt] = useState<Date | null>(null);
  const [sessionDurationSeconds, setSessionDurationSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number>(0);
  const effectiveDurationRef = useRef(25);

  // ── Schedule state ───────────────────────────────────────────
  const [scheduleSheetOpen, setScheduleSheetOpen] = useState(false);
  const [scheduleStartTime, setScheduleStartTime] = useState(new Date());
  const [scheduleDuration, setScheduleDuration] = useState(25);
  const [scheduleApps, setScheduleApps] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [schedTick, setSchedTick] = useState(0);
  const schedActiveIdRef = useRef<string | null>(null);

  // ── Group focus state ────────────────────────────────────────
  const [groupSheetOpen, setGroupSheetOpen] = useState(false);
  const [groupStartTime, setGroupStartTime] = useState(new Date());
  const [groupDuration, setGroupDuration] = useState(60);
  const [groupApps, setGroupApps] = useState<string[]>([]);
  const [groupStrict, setGroupStrict] = useState(true);
  const [showGroupDatePicker, setShowGroupDatePicker] = useState(false);
  const [showGroupTimePicker, setShowGroupTimePicker] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [joinError, setJoinError] = useState("");
  const [groupRemainingSeconds, setGroupRemainingSeconds] = useState(0);
  const groupIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const groupEndTimeRef = useRef<number>(0);

  // ── Duration calc ────────────────────────────────────────────
  const getEffectiveDurationMinutes = useCallback((): number => {
    if (isCustomDuration) {
      const v = parseInt(customMinutesInput, 10);
      return Math.max(1, Math.min(120, isNaN(v) ? 25 : v));
    }
    return selectedDuration;
  }, [isCustomDuration, customMinutesInput, selectedDuration]);

  useEffect(() => {
    effectiveDurationRef.current = getEffectiveDurationMinutes();
  }, [getEffectiveDurationMinutes]);

  // ── Solo session callbacks (declared before effects) ─────────
  const endSession = useCallback(
    async (completed: boolean) => {
      await stopBlocking();
      await AsyncStorage.multiRemove([
        FOCUS_SESSION_END_TIME_KEY,
        FOCUS_SESSION_START_TIME_KEY,
        FOCUS_SESSION_BLOCKED_APPS_KEY,
        FOCUS_SESSION_USER_ID_KEY,
      ]);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (sessionStartedAt) {
        await logSession({
          started_at: sessionStartedAt.toISOString(),
          ended_at: new Date().toISOString(),
          duration_seconds: sessionDurationSeconds,
          completed,
        });
      }
      setScreen("home");
      setRemainingSeconds(0);
      setSessionStartedAt(null);
      if (completed) {
        Alert.alert(
          "Hambalyo!",
          "Focus session-kaaga wuu dhammaday. Waa ku mahadsantahay!"
        );
      }
    },
    [sessionStartedAt, sessionDurationSeconds, logSession]
  );

  const startSession = useCallback(() => {
    const durationMinutes = effectiveDurationRef.current;
    const durationSec = durationMinutes * 60;
    const now = new Date();
    const endTimeMs = now.getTime() + durationSec * 1000;
    endTimeRef.current = endTimeMs;
    setSessionStartedAt(now);
    setSessionDurationSeconds(durationSec);
    setRemainingSeconds(durationSec);
    setScreen("timer");
    setSheetOpen(false);
    startBlocking(selectedApps, endTimeMs);
    AsyncStorage.setItem(FOCUS_SESSION_END_TIME_KEY, String(endTimeMs));
    AsyncStorage.setItem(
      FOCUS_SESSION_START_TIME_KEY,
      String(now.getTime())
    );
    AsyncStorage.setItem(
      FOCUS_SESSION_BLOCKED_APPS_KEY,
      JSON.stringify(selectedApps)
    );
    if (userId) AsyncStorage.setItem(FOCUS_SESSION_USER_ID_KEY, userId);
    intervalRef.current = setInterval(() => {
      const left = Math.max(
        0,
        Math.round((endTimeRef.current - Date.now()) / 1000)
      );
      setRemainingSeconds(left);
      if (left <= 0) endSession(true);
    }, 1000);
  }, [selectedApps, endSession]);

  // ── Group session callbacks (declared before effects) ────────
  const endGroupSession = useCallback(
    async (completed: boolean) => {
      await stopBlocking();
      if (groupIntervalRef.current) {
        clearInterval(groupIntervalRef.current);
        groupIntervalRef.current = null;
      }
      await AsyncStorage.multiRemove([
        GROUP_SESSION_KEY,
        GROUP_SESSION_END_KEY,
        GROUP_SESSION_APPS_KEY,
      ]);
      if (groupSession && completed) {
        await markGroupEnded(groupSession.id);
        await logSession({
          started_at: groupSession.start_time,
          ended_at: new Date().toISOString(),
          duration_seconds: groupSession.duration_minutes * 60,
          completed: true,
        });
      }
      setScreen("home");
      setGroupRemainingSeconds(0);
      if (completed) {
        Alert.alert("Hambalyo!", "Focus kooxda wuu dhammaday!");
      }
    },
    [groupSession, markGroupEnded, logSession]
  );

  const startGroupBlocking = useCallback(
    (endTimeMs: number, blockedApps: string[]) => {
      groupEndTimeRef.current = endTimeMs;
      const left = Math.max(0, Math.round((endTimeMs - Date.now()) / 1000));
      setGroupRemainingSeconds(left);
      setScreen("groupTimer");
      startBlocking(blockedApps, endTimeMs);
      AsyncStorage.setItem(GROUP_SESSION_KEY, groupSession?.id ?? "");
      AsyncStorage.setItem(GROUP_SESSION_END_KEY, String(endTimeMs));
      AsyncStorage.setItem(
        GROUP_SESSION_APPS_KEY,
        JSON.stringify(blockedApps)
      );
      if (groupIntervalRef.current) clearInterval(groupIntervalRef.current);
      groupIntervalRef.current = setInterval(() => {
        const rem = Math.max(
          0,
          Math.round((groupEndTimeRef.current - Date.now()) / 1000)
        );
        setGroupRemainingSeconds(rem);
        if (rem <= 0) endGroupSession(true);
      }, 1000);
    },
    [groupSession, endGroupSession]
  );

  // ── Init effects ─────────────────────────────────────────────
  useEffect(() => {
    if (loading || !userId) return;
    const key = FOCUS_STRICT_FIRST_VISIT_KEY_PREFIX + userId;
    AsyncStorage.getItem(key).then((done) => {
      if (done) return;
      setStrictMode(true);
      AsyncStorage.setItem(key, "1");
    });
  }, [loading, userId, setStrictMode]);

  useEffect(() => {
    if (!loading && !sheetOpen) {
      setSelectedDuration(settings.defaultDurationMinutes);
      setSelectedApps(settings.blockedApps);
    }
  }, [loading, settings.defaultDurationMinutes, settings.blockedApps, sheetOpen]);

  useEffect(() => {
    if (Platform.OS === "android" && isNativeBlockingAvailable) {
      getInstalledApps().then(setNativeApps);
      setPermGranted(checkNativePermissions());
    }
  }, []);

  // ── Restore solo session on mount ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const endTimeStr = await AsyncStorage.getItem(FOCUS_SESSION_END_TIME_KEY);
      const appsStr = await AsyncStorage.getItem(FOCUS_SESSION_BLOCKED_APPS_KEY);
      if (cancelled || !endTimeStr || !appsStr) return;
      const storedUserId = await AsyncStorage.getItem(FOCUS_SESSION_USER_ID_KEY);
      if (storedUserId && storedUserId !== userId) {
        await AsyncStorage.multiRemove([
          FOCUS_SESSION_END_TIME_KEY,
          FOCUS_SESSION_START_TIME_KEY,
          FOCUS_SESSION_BLOCKED_APPS_KEY,
          FOCUS_SESSION_USER_ID_KEY,
        ]);
        return;
      }
      const endTimeMs = parseInt(endTimeStr, 10);
      const startTimeStr = await AsyncStorage.getItem(
        FOCUS_SESSION_START_TIME_KEY
      );
      if (isNaN(endTimeMs) || Date.now() >= endTimeMs || !startTimeStr) {
        await AsyncStorage.multiRemove([
          FOCUS_SESSION_END_TIME_KEY,
          FOCUS_SESSION_START_TIME_KEY,
          FOCUS_SESSION_BLOCKED_APPS_KEY,
          FOCUS_SESSION_USER_ID_KEY,
        ]);
        return;
      }
      const startTimeMs = parseInt(startTimeStr, 10);
      if (isNaN(startTimeMs)) return;
      let blockedApps: string[] = [];
      try {
        blockedApps = JSON.parse(appsStr);
      } catch {
        return;
      }
      if (cancelled) return;
      const totalDurationSec = Math.round((endTimeMs - startTimeMs) / 1000);
      const remainingSec = Math.max(
        0,
        Math.round((endTimeMs - Date.now()) / 1000)
      );
      endTimeRef.current = endTimeMs;
      setSessionStartedAt(new Date(startTimeMs));
      setSessionDurationSeconds(totalDurationSec);
      setRemainingSeconds(remainingSec);
      setScreen("timer");
      startBlocking(blockedApps, endTimeMs);
      intervalRef.current = setInterval(() => {
        const left = Math.max(
          0,
          Math.round((endTimeRef.current - Date.now()) / 1000)
        );
        setRemainingSeconds(left);
        if (left <= 0) endSession(true);
      }, 1000);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Restore group session on mount ───────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const endStr = await AsyncStorage.getItem(GROUP_SESSION_END_KEY);
      const appsStr = await AsyncStorage.getItem(GROUP_SESSION_APPS_KEY);
      if (cancelled || !endStr || !appsStr) return;
      const endMs = parseInt(endStr, 10);
      if (isNaN(endMs) || Date.now() >= endMs) {
        await AsyncStorage.multiRemove([
          GROUP_SESSION_KEY,
          GROUP_SESSION_END_KEY,
          GROUP_SESSION_APPS_KEY,
        ]);
        return;
      }
      let apps: string[] = [];
      try {
        apps = JSON.parse(appsStr);
      } catch {
        return;
      }
      if (cancelled) return;
      startGroupBlocking(endMs, apps);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-start group when start_time arrives ─────────────────
  useEffect(() => {
    if (screen !== "groupWaiting" || !groupSession) return;
    const endMs = new Date(groupSession.end_time).getTime();
    if (endMs <= Date.now()) return;
    const startMs = new Date(groupSession.start_time).getTime();
    if (Date.now() >= startMs) {
      markGroupActive(groupSession.id);
      startGroupBlocking(endMs, groupSession.blocked_apps as string[]);
      return;
    }
    const timeToStart = startMs - Date.now();
    const timer = setTimeout(() => {
      markGroupActive(groupSession.id);
      startGroupBlocking(endMs, groupSession.blocked_apps as string[]);
    }, timeToStart);
    return () => clearTimeout(timer);
  }, [screen, groupSession, markGroupActive, startGroupBlocking]);

  // ── AppState listener ────────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        if (screen === "timer" && endTimeRef.current > 0) {
          const left = Math.max(
            0,
            Math.round((endTimeRef.current - Date.now()) / 1000)
          );
          setRemainingSeconds(left);
          if (left <= 0) endSession(true);
        }
        if (Platform.OS === "android" && isNativeBlockingAvailable) {
          setPermGranted(checkNativePermissions());
        }
      }
    });
    return () => sub.remove();
  }, [screen, endSession]);

  // ── Cleanup intervals ────────────────────────────────────────
  useEffect(
    () => () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    },
    []
  );
  useEffect(
    () => () => {
      if (groupIntervalRef.current) clearInterval(groupIntervalRef.current);
    },
    []
  );

  // ── Schedule monitor: auto-start / auto-stop blocking ────────
  useEffect(() => {
    if (schedules.length === 0) return;
    const checkSchedules = () => {
      setSchedTick((t) => t + 1);
      const now = Date.now();

      // Keep track of which schedules we've told Android to alarm for
      for (const sched of schedules) {
        const startMs = new Date(sched.start_time).getTime();
        const endMs = startMs + sched.duration_minutes * 60 * 1000;
        const apps = sched.blocked_apps as string[];

        // 1. If it's completely in the future, Register/Update the Android AlarmManager
        if (sched.status === "pending" && now < startMs) {
          if (Platform.OS === "android" && isNativeBlockingAvailable) {
            scheduleBlocking(apps, startMs, endMs, sched.id);
          }
        }

        // 2. If we are currently IN the time window
        if (sched.status === "pending" && now >= startMs && now < endMs) {
          schedActiveIdRef.current = sched.id;
          updateScheduleStatus(sched.id, "active");
          if (Platform.OS === "android" && isNativeBlockingAvailable) {
            // Also directly start it just in case the app was foregrounded when the second ticked over
            startBlocking(apps, endMs);
          }
          AsyncStorage.setItem(SCHED_ACTIVE_ID_KEY, sched.id);
          AsyncStorage.setItem(SCHED_ACTIVE_END_KEY, String(endMs));
          AsyncStorage.setItem(SCHED_ACTIVE_APPS_KEY, JSON.stringify(apps));
        }

        // 3. If it has finished
        if (
          (sched.status === "active" || schedActiveIdRef.current === sched.id) &&
          now >= endMs
        ) {
          schedActiveIdRef.current = null;
          updateScheduleStatus(sched.id, "completed");
          stopBlocking();
          AsyncStorage.multiRemove([SCHED_ACTIVE_ID_KEY, SCHED_ACTIVE_END_KEY, SCHED_ACTIVE_APPS_KEY]);
        }
      }
    };
    checkSchedules();
    const iv = setInterval(checkSchedules, 1000);
    return () => clearInterval(iv);
  }, [schedules, updateScheduleStatus]);

  // Restore scheduled blocking on mount (app was killed while schedule was active)
  useEffect(() => {
    (async () => {
      const activeId = await AsyncStorage.getItem(SCHED_ACTIVE_ID_KEY);
      const endStr = await AsyncStorage.getItem(SCHED_ACTIVE_END_KEY);
      const appsStr = await AsyncStorage.getItem(SCHED_ACTIVE_APPS_KEY);
      if (!activeId || !endStr || !appsStr) return;
      const endMs = parseInt(endStr, 10);
      if (isNaN(endMs) || Date.now() >= endMs) {
        await AsyncStorage.multiRemove([SCHED_ACTIVE_ID_KEY, SCHED_ACTIVE_END_KEY, SCHED_ACTIVE_APPS_KEY]);
        updateScheduleStatus(activeId, "completed");
        return;
      }
      let apps: string[] = [];
      try { apps = JSON.parse(appsStr); } catch { return; }
      schedActiveIdRef.current = activeId;
      if (Platform.OS === "android" && isNativeBlockingAvailable) {
        startBlocking(apps, endMs);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-check schedules when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refetchSchedules();
        setSchedTick((t) => t + 1);
      }
    });
    return () => sub.remove();
  }, [refetchSchedules]);

  // ── App toggles ──────────────────────────────────────────────
  const toggleApp = (appId: string) =>
    setSelectedApps((prev) =>
      prev.includes(appId) ? prev.filter((a) => a !== appId) : [...prev, appId]
    );

  const saveApps = async () => {
    await setBlockedApps(selectedApps);
    setAppPickerOpen(false);
  };

  // ── Schedule actions ─────────────────────────────────────────
  const openScheduleSheet = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 1);
    now.setSeconds(0, 0);
    setScheduleStartTime(now);
    setScheduleDuration(25);
    setScheduleApps(selectedApps.length > 0 ? [...selectedApps] : []);
    setScheduleSheetOpen(true);
  };

  const saveSchedule = async () => {
    if (scheduleApps.length === 0) {
      Alert.alert("Apps", "Fadlan dooro ugu yaraan 1 app.");
      return;
    }
    if (scheduleStartTime.getTime() <= Date.now()) {
      Alert.alert("Wakhti", "Start time-ku waa inuu ka dambeeyaa hadda.");
      return;
    }
    const result = await addSchedule({
      blocked_apps: scheduleApps,
      start_time: scheduleStartTime.toISOString(),
      duration_minutes: scheduleDuration,
    });
    setScheduleSheetOpen(false);
    if (result) {
      Alert.alert("Waa lagu guuleystay!", "Qorshahaaga waa la keydiyay.");
      refetchSchedules();
    }
  };

  const toggleScheduleApp = (appId: string) =>
    setScheduleApps((prev) =>
      prev.includes(appId) ? prev.filter((a) => a !== appId) : [...prev, appId]
    );

  // ── Group focus actions ──────────────────────────────────────
  const openGroupSheet = () => {
    const defaultStart = new Date();
    defaultStart.setMinutes(defaultStart.getMinutes() + 5);
    defaultStart.setSeconds(0, 0);
    setGroupStartTime(defaultStart);
    setGroupDuration(60);
    setGroupApps(selectedApps.length > 0 ? [...selectedApps] : []);
    setGroupStrict(true);
    requestAnimationFrame(() => setGroupSheetOpen(true));
  };

  const toggleGroupApp = (appId: string) =>
    setGroupApps((prev) =>
      prev.includes(appId) ? prev.filter((a) => a !== appId) : [...prev, appId]
    );

  const handleCreateGroup = async () => {
    if (groupApps.length === 0) {
      Alert.alert("Apps", "Fadlan dooro ugu yaraan 1 app.");
      return;
    }
    const { session: s, error } = await createGroupSession({
      start_time: groupStartTime.toISOString(),
      duration_minutes: groupDuration,
      blocked_apps: groupApps,
      strict_mode: groupStrict,
    });
    setGroupSheetOpen(false);
    if (s) {
      setScreen("groupInvite");
    } else {
      Alert.alert("Khalad", error || "Session abuurista way fashilantay.");
    }
  };

  const handleJoinCode = async () => {
    setJoinError("");
    if (joinCodeInput.trim().length < 3) {
      setJoinError("Geli code sax ah (tusaale: ABC123)");
      return;
    }
    const { session: s, error } = await joinByCode(joinCodeInput);
    if (error || !s) {
      setJoinError(error ?? "Ku biirista way fashilantay");
      return;
    }
    setJoinCodeInput("");
    setScreen("groupWaiting");
  };

  // ── Computed ─────────────────────────────────────────────────
  const progress =
    sessionDurationSeconds > 0
      ? 1 - remainingSeconds / sessionDurationSeconds
      : 0;
  const groupProgress =
    groupSession && groupSession.duration_minutes > 0
      ? 1 - groupRemainingSeconds / (groupSession.duration_minutes * 60)
      : 0;

  const appList =
    Platform.OS === "android" && nativeApps.length > 0
      ? nativeApps.map((a) => ({
        id: a.packageName,
        name: a.label,
        icon: a.icon ? `data:image/png;base64,${a.icon}` : "",
      }))
      : DEMO_BLOCKED_APPS;

  const blockedAppNames = appList.filter((a) => selectedApps.includes(a.id));

  const openAppPickerForPlatform = async () => {
    if (Platform.OS === "ios" && isNativeBlockingAvailable) {
      const ok = await requestFocusAuthorization();
      if (ok) await nativeOpenAppPicker();
    } else {
      setAppPickerOpen(true);
    }
  };

  // ═════════════════════════════════════════════════════════════
  // ██ Screen Content ██
  // ═════════════════════════════════════════════════════════════
  let screenContent: React.ReactNode = null;

  // ── Solo timer ───────────────────────────────────────────────
  if (screen === "timer") {
    const pct = Math.min(progress * 100, 100);
    screenContent = (
      <SafeAreaView className="flex-1 bg-gray-950" edges={["top"]}>
        <Animated.View entering={FadeIn.duration(400)} className="flex-1">
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View className="items-center pt-8 px-6">
              <Animated.View
                entering={FadeInDown.delay(100).duration(500)}
                className="flex-row items-center gap-2 mb-8 px-4 py-2 rounded-full"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.15)" }}
              >
                <View className="w-2 h-2 rounded-full bg-emerald-400" />
                <Text className="text-sm font-bold text-emerald-400">
                  Focus waa firfircoon
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(200).duration(600).springify()}
                className="w-56 h-56 rounded-full items-center justify-center mb-10"
                style={{
                  borderWidth: 4,
                  borderColor: `rgba(16, 185, 129, ${0.3 + progress * 0.7})`,
                  backgroundColor: "rgba(16, 185, 129, 0.06)",
                }}
              >
                <Text
                  className="text-5xl font-extrabold text-white"
                  style={{ letterSpacing: -2, fontVariant: ["tabular-nums"] }}
                >
                  {formatTimerDisplay(remainingSeconds)}
                </Text>
                <Text className="text-xs text-gray-500 font-semibold mt-2 uppercase tracking-widest">
                  ka hadhay
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(300).duration(400)}
                className="w-full mb-6"
              >
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs font-semibold text-gray-500">
                    Horumarka
                  </Text>
                  <Text className="text-xs font-bold text-emerald-400">
                    {Math.round(pct)}%
                  </Text>
                </View>
                <View className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: pct >= 100 ? "#ef4444" : "#10b981",
                    }}
                  />
                </View>
              </Animated.View>

              {blockedAppNames.length > 0 && (
                <Animated.View
                  entering={FadeInDown.delay(400).duration(400)}
                  className="w-full rounded-2xl px-4 py-4 mb-4"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                >
                  <View className="flex-row items-center gap-2 mb-3">
                    <Feather name="lock" size={14} color="#6b7280" />
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Apps-ka la xirey
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {blockedAppNames.map((app) => (
                      <View
                        key={app.id}
                        className="flex-row items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                      >
                        <AppIcon icon={app.icon} size={16} />
                        <Text className="text-sm font-semibold text-red-400">
                          {app.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </Animated.View>
              )}

              <Animated.View
                entering={FadeInDown.delay(500).duration(400)}
                className="rounded-xl px-4 py-3 w-full mb-6"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.08)" }}
              >
                <Text className="text-xs text-emerald-400 text-center leading-4 font-medium">
                  Apps-ka la xirey way xidhan yihiin. Haddii aad isku daydo,
                  shaashad xiritaan ayaa soo bixi doonta.
                </Text>
              </Animated.View>

              {!settings.strictMode && (
                <Pressable
                  className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-2xl active:opacity-80"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderWidth: 1,
                    borderColor: "rgba(239, 68, 68, 0.2)",
                  }}
                  onPress={() =>
                    Alert.alert(
                      "Dhamaystir session",
                      "Ma hubtaa inaad dhamaystirto focus session-ka?",
                      [
                        { text: "Maya", style: "cancel" },
                        {
                          text: "Haa, Dhamaystir",
                          style: "destructive",
                          onPress: () => endSession(false),
                        },
                      ]
                    )
                  }
                >
                  <Feather name="x-circle" size={18} color="#f87171" />
                  <Text className="text-sm font-bold text-red-400">
                    Dhamaystir
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Group timer ──────────────────────────────────────────────
  else if (screen === "groupTimer" && groupSession) {
    const pct = Math.min(groupProgress * 100, 100);
    const groupBlockedNames = appList.filter((a) =>
      (groupSession.blocked_apps as string[]).includes(a.id)
    );
    screenContent = (
      <SafeAreaView className="flex-1 bg-gray-950" edges={["top"]}>
        <Animated.View entering={FadeIn.duration(400)} className="flex-1">
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
          >
            <View className="items-center pt-8 px-6">
              <Animated.View
                entering={FadeInDown.delay(100).duration(500)}
                className="flex-row items-center gap-3 mb-3"
              >
                <View
                  className="px-3 py-1.5 rounded-full"
                  style={{ backgroundColor: "rgba(139, 92, 246, 0.15)" }}
                >
                  <Text className="text-xs font-bold text-purple-400">
                    {groupMembers.length} xubnood
                  </Text>
                </View>
                {groupSession.strict_mode && (
                  <View
                    className="px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: "rgba(251, 191, 36, 0.15)" }}
                  >
                    <Text className="text-xs font-bold text-amber-400">
                      Strict
                    </Text>
                  </View>
                )}
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(150).duration(500)}
                className="flex-row items-center gap-2 mb-8 px-4 py-2 rounded-full"
                style={{ backgroundColor: "rgba(139, 92, 246, 0.12)" }}
              >
                <View className="w-2 h-2 rounded-full bg-purple-400" />
                <Text className="text-sm font-bold text-purple-400">
                  Focus kooxda waa firfircoon
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(250).duration(600).springify()}
                className="w-56 h-56 rounded-full items-center justify-center mb-10"
                style={{
                  borderWidth: 4,
                  borderColor: `rgba(139, 92, 246, ${0.3 + groupProgress * 0.7})`,
                  backgroundColor: "rgba(139, 92, 246, 0.06)",
                }}
              >
                <Text
                  className="text-5xl font-extrabold text-white"
                  style={{ letterSpacing: -2, fontVariant: ["tabular-nums"] }}
                >
                  {formatTimerDisplay(groupRemainingSeconds)}
                </Text>
                <Text className="text-xs text-gray-500 font-semibold mt-2 uppercase tracking-widest">
                  ka hadhay
                </Text>
              </Animated.View>

              <Animated.View
                entering={FadeInDown.delay(350).duration(400)}
                className="w-full mb-4"
              >
                <View className="flex-row justify-between mb-2">
                  <Text className="text-xs font-semibold text-gray-500">
                    Horumarka
                  </Text>
                  <Text className="text-xs font-bold text-purple-400">
                    {Math.round(pct)}%
                  </Text>
                </View>
                <View className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                  <View
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: "#8b5cf6" }}
                  />
                </View>
              </Animated.View>

              <View className="flex-row flex-wrap gap-1.5 mb-4 justify-center">
                {groupMembers.map((m) => (
                  <View
                    key={m.id}
                    className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: "rgba(139, 92, 246, 0.1)" }}
                  >
                    <View className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <Text className="text-xs font-semibold text-purple-300">
                      {m.email ? m.email.split("@")[0] : "Xubin"}
                      {m.user_id === groupSession.creator_id ? " ★" : ""}
                    </Text>
                  </View>
                ))}
              </View>

              {groupBlockedNames.length > 0 && (
                <View
                  className="w-full rounded-2xl px-4 py-4 mb-4"
                  style={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                >
                  <View className="flex-row items-center gap-2 mb-3">
                    <Feather name="lock" size={14} color="#6b7280" />
                    <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide">
                      Apps-ka la xirey
                    </Text>
                  </View>
                  <View className="flex-row flex-wrap gap-2">
                    {groupBlockedNames.map((app) => (
                      <View
                        key={app.id}
                        className="flex-row items-center gap-2 px-3 py-2 rounded-xl"
                        style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                      >
                        <AppIcon icon={app.icon} size={16} />
                        <Text className="text-sm font-semibold text-red-400">
                          {app.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {groupSession.strict_mode ? (
                <View
                  className="rounded-xl px-4 py-3 w-full mb-4"
                  style={{ backgroundColor: "rgba(251, 191, 36, 0.08)" }}
                >
                  <Text className="text-xs text-amber-400 text-center leading-4 font-medium">
                    Strict mode — ma joogi kartid. Sug inta wakhtigu dhammaado.
                  </Text>
                </View>
              ) : (
                <Pressable
                  className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-2xl active:opacity-80"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    borderWidth: 1,
                    borderColor: "rgba(239, 68, 68, 0.2)",
                  }}
                  onPress={() =>
                    Alert.alert(
                      "Ka bax",
                      "Ma hubtaa inaad ka baxeyso session-ka?",
                      [
                        { text: "Maya", style: "cancel" },
                        {
                          text: "Haa",
                          style: "destructive",
                          onPress: () => endGroupSession(false),
                        },
                      ]
                    )
                  }
                >
                  <Feather name="x-circle" size={18} color="#f87171" />
                  <Text className="text-sm font-bold text-red-400">
                    Ka bax session
                  </Text>
                </Pressable>
              )}
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ── Group invite (creator shares code) ───────────────────────
  else if (screen === "groupInvite" && groupSession) {
    screenContent = (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          <BackHeader title="Wadaag code-ka" onBack={() => setScreen("home")} />
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            className="px-5 pt-2"
          >
            <Text className="text-sm text-gray-500 mb-6">
              Saaxiibadaada geli code-kan si ay ugu biiraan session-ka
            </Text>

            <View
              className="rounded-2xl py-8 items-center mb-5"
              style={{ backgroundColor: "#111827" }}
            >
              <Text className="text-xs text-gray-500 font-semibold mb-2 uppercase tracking-wider">
                Invite Code
              </Text>
              <Text
                className="text-4xl font-extrabold text-white"
                style={{ letterSpacing: 10 }}
              >
                {groupSession.invite_code}
              </Text>
            </View>

            <Pressable
              className="rounded-2xl py-4 items-center flex-row justify-center gap-2 mb-3 active:opacity-90"
              style={{ backgroundColor: "#7c3aed" }}
              onPress={() => {
                Share.share({
                  message: `Ku biir focus session-kayga Qorsheyn app-ka! Code: ${groupSession.invite_code}`,
                }).catch(() => { });
              }}
            >
              <Feather name="share-2" size={18} color="#fff" />
              <Text className="text-white text-base font-bold">
                Wadaag code-ka
              </Text>
            </Pressable>

            <View
              className="bg-gray-50 rounded-2xl p-5 mb-5"
              style={{
                borderWidth: 1,
                borderColor: "#f3f4f6",
              }}
            >
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                Session-ka faahfaahinta
              </Text>
              <View className="flex-row items-center gap-2 mb-2">
                <Feather name="clock" size={14} color="#7c3aed" />
                <Text className="text-sm font-semibold text-gray-800">
                  {formatScheduleDate(groupSession.start_time)}{" "}
                  {formatScheduleTime(groupSession.start_time)} •{" "}
                  {formatDurationLabel(groupSession.duration_minutes)}
                </Text>
              </View>
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="shield" size={14} color="#d97706" />
                <Text className="text-sm text-gray-600">
                  Strict mode:{" "}
                  {groupSession.strict_mode ? "Shidan" : "Damisan"}
                </Text>
              </View>
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Xubnaha ({groupMembers.length})
              </Text>
              <View className="flex-row flex-wrap gap-1.5">
                {groupMembers.map((m) => (
                  <View
                    key={m.id}
                    className="flex-row items-center gap-1.5 bg-purple-50 px-3 py-1.5 rounded-full"
                  >
                    <View className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                    <Text className="text-xs font-semibold text-purple-700">
                      {m.email ? m.email.split("@")[0] : "Xubin"}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <Pressable
              className="bg-emerald-600 rounded-2xl py-4 items-center mb-3 active:bg-emerald-700"
              onPress={async () => {
                await refreshMembers();
                setScreen("groupWaiting");
              }}
            >
              <Text className="text-white text-base font-bold">
                Sug bilaabashada →
              </Text>
            </Pressable>

            <Pressable
              className="rounded-2xl py-3 items-center active:bg-red-50"
              onPress={() =>
                Alert.alert("Tirtir session", "Ma hubtaa?", [
                  { text: "Maya", style: "cancel" },
                  {
                    text: "Haa, tirtir",
                    style: "destructive",
                    onPress: async () => {
                      await cancelGroupSession(groupSession.id);
                      setScreen("home");
                    },
                  },
                ])
              }
            >
              <Text className="text-sm font-bold text-red-500">
                Tirtir session
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Group waiting ────────────────────────────────────────────
  else if (screen === "groupWaiting" && groupSession) {
    const startMs = new Date(groupSession.start_time).getTime();
    const startsIn = Math.max(0, Math.round((startMs - Date.now()) / 1000));
    const groupBlockedNames = appList.filter((a) =>
      (groupSession.blocked_apps as string[]).includes(a.id)
    );
    screenContent = (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          <BackHeader title="Sug bilaabashada" onBack={() => setScreen("home")} />
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            className="px-5 pt-2"
          >
            <View
              className="rounded-2xl p-5 mb-5"
              style={{
                backgroundColor: "#faf5ff",
                borderWidth: 1,
                borderColor: "#ede9fe",
              }}
            >
              <View className="flex-row items-center gap-2 mb-4">
                <View className="w-10 h-10 rounded-xl bg-purple-100 items-center justify-center">
                  <Feather name="users" size={20} color="#7c3aed" />
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-extrabold text-gray-900">
                    Focus kooxda
                  </Text>
                  <Text className="text-xs text-gray-500">
                    Session diiwaangashan
                  </Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2 mb-2">
                <Feather name="calendar" size={14} color="#7c3aed" />
                <Text className="text-base font-bold text-gray-900">
                  {formatScheduleDate(groupSession.start_time)}{" "}
                  {formatScheduleTime(groupSession.start_time)}
                </Text>
              </View>
              <View className="flex-row items-center gap-2 mb-3">
                <Feather name="clock" size={14} color="#6b7280" />
                <Text className="text-sm text-gray-600">
                  {formatDurationLabel(groupSession.duration_minutes)}
                  {startsIn > 0
                    ? ` • Bilaabmayo ${formatTimerDisplay(startsIn)} kadib`
                    : " • Hadda bilaabmayo!"}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-1.5 mb-3">
                {groupMembers.map((m) => (
                  <View
                    key={m.id}
                    className="flex-row items-center gap-1.5 bg-purple-100 px-3 py-1.5 rounded-full"
                  >
                    <View className="w-1.5 h-1.5 rounded-full bg-purple-600" />
                    <Text className="text-xs font-semibold text-purple-700">
                      {m.email ? m.email.split("@")[0] : "Xubin"}
                      {m.user_id === userId ? " (Adiga)" : ""}
                    </Text>
                  </View>
                ))}
              </View>

              {groupSession.strict_mode && (
                <View className="bg-amber-50 rounded-lg px-3 py-2 flex-row items-center gap-2 mb-2">
                  <Feather name="lock" size={14} color="#b45309" />
                  <Text className="text-xs font-bold text-amber-700">
                    Strict mode — ma joogi kartid
                  </Text>
                </View>
              )}

              {groupBlockedNames.length > 0 && (
                <View className="flex-row flex-wrap gap-1 mt-1">
                  {groupBlockedNames.map((a) => (
                    <View
                      key={a.id}
                      className="flex-row items-center gap-1 bg-white px-2 py-1 rounded-lg"
                    >
                      <AppIcon icon={a.icon} size={14} />
                      <Text className="text-xs text-gray-600">{a.name}</Text>
                    </View>
                  ))}
                </View>
              )}

              {groupSession.creator_id === userId && (
                <View className="bg-gray-100 rounded-lg px-3 py-2 mt-3">
                  <Text className="text-xs text-gray-500">
                    Code:{" "}
                    <Text className="font-bold text-gray-900">
                      {groupSession.invite_code}
                    </Text>
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              className="rounded-2xl py-3 items-center active:bg-red-50"
              onPress={() =>
                Alert.alert(
                  "Ka bax",
                  "Ma hubtaa inaad ka baxeyso session-ka?",
                  [
                    { text: "Maya", style: "cancel" },
                    {
                      text: "Haa",
                      style: "destructive",
                      onPress: async () => {
                        if (groupSession.creator_id === userId) {
                          await cancelGroupSession(groupSession.id);
                        } else {
                          await leaveGroupSession(groupSession.id);
                        }
                        setScreen("home");
                      },
                    },
                  ]
                )
              }
            >
              <Text className="text-sm font-bold text-red-500">
                Ka bax session-ka
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Group choices ────────────────────────────────────────────
  else if (screen === "groupChoices") {
    screenContent = (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 60 }}
        >
          <BackHeader title="Focus kooxda" onBack={() => setScreen("home")} />
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            className="px-5 pt-2"
          >
            <Text className="text-sm text-gray-500 mb-6">
              Abuur session cusub ama ku biir code-ka saaxiibadiinba
            </Text>

            <Pressable
              onPress={openGroupSheet}
              className="rounded-2xl overflow-hidden active:opacity-90 mb-4"
              style={{
                backgroundColor: "#7c3aed",
                shadowColor: "#7c3aed",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.3,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <View className="p-5">
                <View className="flex-row items-center gap-4 mb-4">
                  <View
                    className="w-14 h-14 rounded-2xl items-center justify-center"
                    style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                  >
                    <Feather name="plus-circle" size={28} color="#fff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-extrabold text-white">
                      Abuur session cusub
                    </Text>
                    <Text className="text-sm text-purple-200 mt-0.5">
                      Dooro wakhti, apps iyo strict mode
                    </Text>
                  </View>
                </View>
                <View
                  className="rounded-xl py-3 items-center"
                  style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                >
                  <Text className="text-white text-sm font-bold">
                    Abuur →
                  </Text>
                </View>
              </View>
            </Pressable>

            <Pressable
              onPress={() => {
                setJoinCodeInput("");
                setJoinError("");
                setScreen("joinCode");
              }}
              className="rounded-2xl overflow-hidden active:opacity-90"
              style={{
                backgroundColor: "#fff",
                borderWidth: 1.5,
                borderColor: "#e5e7eb",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 10,
                elevation: 3,
              }}
            >
              <View className="p-5">
                <View className="flex-row items-center gap-4 mb-4">
                  <View className="w-14 h-14 rounded-2xl bg-gray-100 items-center justify-center">
                    <Feather name="log-in" size={28} color="#6b7280" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900">
                      Ku biir code-ka
                    </Text>
                    <Text className="text-sm text-gray-500 mt-0.5">
                      Geli code-ka laguu soo diray
                    </Text>
                  </View>
                </View>
                <View className="bg-gray-100 rounded-xl py-3 items-center">
                  <Text className="text-gray-600 text-sm font-bold">
                    Geli code →
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Join code ────────────────────────────────────────────────
  else if (screen === "joinCode") {
    screenContent = (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          className="flex-1"
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 60 }}
          >
            <BackHeader
              title="Geli code-ka"
              onBack={() => setScreen("groupChoices")}
            />
            <Animated.View
              entering={FadeInDown.duration(400).springify()}
              className="px-5 pt-2"
            >
              <Text className="text-sm text-gray-500 mb-6">
                Geli code-ka 6 xaraf ee saaxiibkaaga kuu soo diray
              </Text>
              <TextInput
                value={joinCodeInput}
                onChangeText={(t) => {
                  setJoinCodeInput(
                    t
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6)
                  );
                  setJoinError("");
                }}
                placeholder="ABC123"
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                className="bg-gray-50 rounded-2xl px-5 py-5 text-center text-2xl font-extrabold mb-3"
                style={{
                  letterSpacing: 8,
                  borderWidth: 2,
                  borderColor: joinError ? "#fecaca" : "#e5e7eb",
                }}
              />
              {joinError ? (
                <Text className="text-sm text-red-600 font-semibold mb-5 text-center">
                  {joinError}
                </Text>
              ) : (
                <Text className="text-xs text-gray-400 mb-5 text-center">
                  Code-ka waa inuu ahaadaa 6 xaraf
                </Text>
              )}
              <Pressable
                className="rounded-2xl py-4 items-center flex-row justify-center gap-2 active:opacity-90"
                style={{ backgroundColor: "#7c3aed" }}
                onPress={handleJoinCode}
              >
                {groupLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="log-in" size={18} color="#fff" />
                    <Text className="text-white text-base font-bold">
                      Ku biir
                    </Text>
                  </>
                )}
              </Pressable>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Home ─────────────────────────────────────────────────────
  else {
    screenContent = (
      <SafeAreaView className="flex-1 bg-white" edges={["top"]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Header */}
          <Animated.View
            entering={FadeInDown.duration(400).springify()}
            className="px-5 pt-5 pb-2"
          >
            <Text className="text-sm text-gray-400 font-medium">
              {formatSomaliDate()}
            </Text>
            <Text className="text-3xl font-extrabold text-gray-900 mt-1">
              Iska xir
            </Text>
          </Animated.View>

          {/* Permission warning */}
          {Platform.OS === "android" &&
            isNativeBlockingAvailable &&
            !permGranted && (
              <Animated.View
                entering={FadeInDown.delay(50).duration(400).springify()}
                className="mx-5 mb-4"
              >
                <View
                  className="rounded-2xl p-4"
                  style={{
                    backgroundColor: "#fffbeb",
                    borderWidth: 1,
                    borderColor: "#fde68a",
                  }}
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    <Feather name="alert-triangle" size={16} color="#d97706" />
                    <Text className="text-sm font-bold text-amber-800">
                      Ogolaansho loo baahan yahay
                    </Text>
                  </View>
                  <Text className="text-xs text-amber-700 mb-3 leading-4">
                    {checkMissingPermission() === "usage"
                      ? '1/2 — Fur "Usage Access" oo shid app-kayaga'
                      : '2/2 — Fur "Display over other apps" oo shid'}
                  </Text>
                  <Pressable
                    className="bg-amber-500 rounded-xl py-2.5 items-center active:bg-amber-600"
                    onPress={async () => {
                      await requestNativePermissions();
                      const recheck = () => {
                        if (
                          Platform.OS === "android" &&
                          isNativeBlockingAvailable
                        )
                          setPermGranted(checkNativePermissions());
                      };
                      setTimeout(recheck, 800);
                      setTimeout(recheck, 2000);
                      setTimeout(recheck, 4000);
                    }}
                  >
                    <Text className="text-white text-sm font-bold">
                      Ogolow
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            )}

          {/* ── Solo Focus Card ──────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(400).springify()}
            className="mx-5 mb-4"
          >
            <Pressable
              onPress={() => setSheetOpen(true)}
              className="rounded-2xl overflow-hidden active:opacity-95"
              style={{
                backgroundColor: "#111827",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <View className="p-5">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-11 h-11 rounded-xl items-center justify-center"
                      style={{ backgroundColor: "rgba(16, 185, 129, 0.2)" }}
                    >
                      <Feather name="zap" size={22} color="#34d399" />
                    </View>
                    <View>
                      <Text className="text-base font-extrabold text-white">
                        Solo Focus
                      </Text>
                      <Text className="text-xs text-gray-400 mt-0.5">
                        Keligaa iska xir
                      </Text>
                    </View>
                  </View>
                  <View
                    className="px-3 py-1.5 rounded-full"
                    style={{ backgroundColor: "rgba(16, 185, 129, 0.15)" }}
                  >
                    <Text className="text-xs font-bold text-emerald-400">
                      {formatDurationLabel(getEffectiveDurationMinutes())}
                    </Text>
                  </View>
                </View>
                <View
                  className="rounded-xl py-3 items-center flex-row justify-center gap-2"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.15)" }}
                >
                  <Feather name="play" size={16} color="#34d399" />
                  <Text className="text-emerald-400 text-sm font-bold">
                    Bilow focus
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* ── Group Focus Card ──────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(140).duration(400).springify()}
            className="mx-5 mb-4"
          >
            <Pressable
              onPress={() => {
                if (
                  groupSession &&
                  (groupSession.status === "scheduled" ||
                    groupSession.status === "active")
                ) {
                  const endMs = new Date(groupSession.end_time).getTime();
                  if (groupSession.status === "active" && endMs > Date.now()) {
                    startGroupBlocking(
                      endMs,
                      groupSession.blocked_apps as string[]
                    );
                  } else {
                    setScreen("groupWaiting");
                  }
                } else {
                  setScreen("groupChoices");
                }
              }}
              className="rounded-2xl overflow-hidden active:opacity-95"
              style={{
                backgroundColor: "#7c3aed",
                shadowColor: "#7c3aed",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.25,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <View className="p-5">
                <View className="flex-row items-center justify-between mb-4">
                  <View className="flex-row items-center gap-3">
                    <View
                      className="w-11 h-11 rounded-xl items-center justify-center"
                      style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                    >
                      <Feather name="users" size={22} color="#fff" />
                    </View>
                    <View>
                      <Text className="text-base font-extrabold text-white">
                        Group Focus
                      </Text>
                      <Text className="text-xs text-purple-200 mt-0.5">
                        Saaxiibadaada wada iska xira
                      </Text>
                    </View>
                  </View>
                  {groupSession &&
                    (groupSession.status === "scheduled" ||
                      groupSession.status === "active") && (
                      <View
                        className="px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
                      >
                        <Text className="text-xs font-bold text-white">
                          {groupMembers.length} xubnood
                        </Text>
                      </View>
                    )}
                </View>
                <View
                  className="rounded-xl py-3 items-center flex-row justify-center gap-2"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                >
                  <Feather
                    name={
                      groupSession &&
                        (groupSession.status === "scheduled" ||
                          groupSession.status === "active")
                        ? "arrow-right"
                        : "users"
                    }
                    size={16}
                    color="#fff"
                  />
                  <Text className="text-white text-sm font-bold">
                    {groupSession &&
                      (groupSession.status === "scheduled" ||
                        groupSession.status === "active")
                      ? "Fur session-ka"
                      : "Bilow ama ku biir"}
                  </Text>
                </View>
              </View>
            </Pressable>
          </Animated.View>

          {/* ── Apps section ──────────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(200).duration(400).springify()}
            className="px-5 mt-2"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Feather name="smartphone" size={14} color="#9ca3af" />
                <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  Apps-ka la xiro
                </Text>
              </View>
              <Pressable
                className="flex-row items-center gap-1.5 bg-gray-100 px-3 py-1.5 rounded-full active:bg-gray-200"
                onPress={openAppPickerForPlatform}
              >
                <Feather name="plus" size={14} color="#6b7280" />
                <Text className="text-xs font-bold text-gray-600">Dooro</Text>
              </Pressable>
            </View>

            {blockedAppNames.length === 0 ? (
              <Pressable
                className="rounded-2xl py-8 items-center active:bg-gray-50"
                style={{
                  borderWidth: 1.5,
                  borderColor: "#e5e7eb",
                  borderStyle: "dashed",
                }}
                onPress={openAppPickerForPlatform}
              >
                <Feather name="plus-circle" size={28} color="#d1d5db" />
                <Text className="text-gray-400 text-sm font-semibold mt-2">
                  Dooro apps-ka aad rabto in la xiro
                </Text>
              </Pressable>
            ) : (
              <View
                className="rounded-2xl overflow-hidden"
                style={{
                  borderWidth: 1,
                  borderColor: "#f3f4f6",
                }}
              >
                {blockedAppNames.map((app, i) => (
                  <View
                    key={app.id}
                    className="px-4 py-3 flex-row items-center gap-3"
                    style={
                      i < blockedAppNames.length - 1
                        ? { borderBottomWidth: 1, borderBottomColor: "#f3f4f6" }
                        : {}
                    }
                  >
                    <View className="w-9 h-9 rounded-lg bg-gray-50 items-center justify-center">
                      <AppIcon icon={app.icon} size={24} />
                    </View>
                    <Text className="flex-1 text-sm font-semibold text-gray-900">
                      {app.name}
                    </Text>
                    <View className="bg-red-50 px-2 py-1 rounded-md">
                      <Text className="text-[10px] font-bold text-red-500">
                        XIRO
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* ── Strict mode toggle ────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(260).duration(400).springify()}
            className="px-5 mt-5"
          >
            <View
              className="rounded-2xl px-4 py-3.5 flex-row items-center justify-between"
              style={{ borderWidth: 1, borderColor: "#f3f4f6" }}
            >
              <View className="flex-row items-center gap-3 flex-1 mr-3">
                <View className="w-9 h-9 rounded-lg bg-amber-50 items-center justify-center">
                  <Feather name="shield" size={18} color="#d97706" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-gray-900">
                    Strict focus
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Session-ka ma joojin kartid
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.strictMode}
                onValueChange={setStrictMode}
                trackColor={{ true: "#10b981", false: "#e5e7eb" }}
                thumbColor="#fff"
              />
            </View>
          </Animated.View>

          {/* ── Scheduled section ──────────────────────────────── */}
          <Animated.View
            entering={FadeInDown.delay(320).duration(400).springify()}
            className="px-5 mt-6"
          >
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-2">
                <Feather name="calendar" size={14} color="#9ca3af" />
                <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                  Qorsheyn
                </Text>
              </View>
            </View>

            <Pressable
              onPress={openScheduleSheet}
              className="rounded-2xl overflow-hidden active:opacity-95 mb-4"
              style={{
                backgroundColor: "#1e293b",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <View className="p-4 flex-row items-center gap-3">
                <View
                  className="w-11 h-11 rounded-xl items-center justify-center"
                  style={{ backgroundColor: "rgba(124, 58, 237, 0.2)" }}
                >
                  <Feather name="calendar" size={22} color="#a78bfa" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-white">
                    Qorshee xiritaanka
                  </Text>
                  <Text className="text-xs text-gray-400 mt-0.5">
                    Wakhti mustaqbalka ah dooro
                  </Text>
                </View>
                <Feather name="plus" size={20} color="#a78bfa" />
              </View>
            </Pressable>

            {schedules.length > 0 && (
              <View className="gap-3">
                {schedules.map((schedule) => {
                  const liveStatus = getScheduleStatus(
                    schedule.start_time,
                    schedule.duration_minutes,
                    schedule.status
                  );
                  const endTime = new Date(
                    new Date(schedule.start_time).getTime() +
                    schedule.duration_minutes * 60 * 1000
                  );
                  const scheduleAppNames = appList.filter((a) =>
                    (schedule.blocked_apps as string[]).includes(a.id)
                  );
                  return (
                    <View
                      key={schedule.id}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        borderWidth: 1,
                        borderColor:
                          liveStatus === "active"
                            ? "#d1fae5"
                            : liveStatus === "upcoming"
                              ? "#ede9fe"
                              : "#f3f4f6",
                        backgroundColor:
                          liveStatus === "active"
                            ? "#f0fdf4"
                            : liveStatus === "upcoming"
                              ? "#faf5ff"
                              : "#fafafa",
                      }}
                    >
                      <View className="px-4 py-3.5">
                        <View className="flex-row items-center justify-between mb-2">
                          <View className="flex-row items-center gap-2">
                            <View
                              className="w-2 h-2 rounded-full"
                              style={{
                                backgroundColor:
                                  liveStatus === "active"
                                    ? "#10b981"
                                    : liveStatus === "upcoming"
                                      ? "#8b5cf6"
                                      : "#9ca3af",
                              }}
                            />
                            <Text className="text-sm font-bold text-gray-900">
                              {formatScheduleDate(schedule.start_time)}{" "}
                              {formatScheduleTime(schedule.start_time)} –{" "}
                              {formatScheduleTime(endTime.toISOString())}
                            </Text>
                          </View>
                          <Text
                            className="text-[10px] font-bold uppercase"
                            style={{
                              color:
                                liveStatus === "active"
                                  ? "#10b981"
                                  : liveStatus === "upcoming"
                                    ? "#8b5cf6"
                                    : "#9ca3af",
                            }}
                          >
                            {liveStatus === "active"
                              ? "Firfircoon"
                              : liveStatus === "upcoming"
                                ? "Soo socda"
                                : "Dhammaatay"}
                          </Text>
                        </View>
                        <Text className="text-xs text-gray-500 mb-2">
                          {formatDurationLabel(schedule.duration_minutes)}
                        </Text>
                        {scheduleAppNames.length > 0 && (
                          <View className="flex-row flex-wrap gap-1.5 mb-2">
                            {scheduleAppNames.slice(0, 4).map((app) => (
                              <View
                                key={app.id}
                                className="flex-row items-center gap-1 bg-white px-2 py-1 rounded-md"
                              >
                                <AppIcon icon={app.icon} size={12} />
                                <Text className="text-[10px] font-medium text-gray-600">
                                  {app.name}
                                </Text>
                              </View>
                            ))}
                            {scheduleAppNames.length > 4 && (
                              <View className="bg-white px-2 py-1 rounded-md">
                                <Text className="text-[10px] font-medium text-gray-400">
                                  +{scheduleAppNames.length - 4}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                        {liveStatus !== "ended" && (
                          <Pressable
                            className="flex-row items-center justify-center gap-1.5 py-2 rounded-lg active:opacity-80"
                            style={{
                              backgroundColor: "rgba(239, 68, 68, 0.08)",
                            }}
                            onPress={() =>
                              Alert.alert(
                                "Tirtir qorshe",
                                "Ma hubtaa inaad tirtirto qorshahaas?",
                                [
                                  { text: "Maya", style: "cancel" },
                                  {
                                    text: "Haa, tirtir",
                                    style: "destructive",
                                    onPress: () => {
                                      if (liveStatus === "active") {
                                        stopBlocking();
                                        AsyncStorage.multiRemove([SCHED_ACTIVE_ID_KEY, SCHED_ACTIVE_END_KEY, SCHED_ACTIVE_APPS_KEY]);
                                        schedActiveIdRef.current = null;
                                      }
                                      cancelScheduleWrapper(schedule.id);
                                    },
                                  },
                                ]
                              )
                            }
                          >
                            <Feather name="x" size={12} color="#ef4444" />
                            <Text className="text-xs font-bold text-red-500">
                              Tirtir
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // ██ Final Return: screen content + ALL modals ██
  // ═════════════════════════════════════════════════════════════
  return (
    <>
      {screenContent}

      {/* ── Solo session sheet ────────────────────────────────── */}
      <Modal visible={sheetOpen} animationType="slide" transparent>
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setSheetOpen(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl"
            onPress={(e) => e.stopPropagation()}
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <View className="w-10 h-1 bg-gray-300 rounded-full self-center mt-3 mb-4" />
            <View className="px-5 pb-2">
              <View className="flex-row items-center gap-3 mb-5">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: "#111827" }}
                >
                  <Feather name="zap" size={20} color="#34d399" />
                </View>
                <View>
                  <Text className="text-lg font-extrabold text-gray-900">
                    Focus session cusub
                  </Text>
                  <Text className="text-xs text-gray-400 font-medium">
                    Dooro wakhti iyo apps
                  </Text>
                </View>
              </View>

              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Wakhtiga
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-2"
                contentContainerStyle={{ gap: 6 }}
              >
                {DURATION_PRESETS_MINUTES.map((p) => (
                  <Pill
                    key={p.minutes}
                    label={formatDurationLabel(p.minutes)}
                    selected={!isCustomDuration && selectedDuration === p.minutes}
                    onPress={() => {
                      setIsCustomDuration(false);
                      setSelectedDuration(p.minutes);
                    }}
                    color="#111827"
                  />
                ))}
                {DURATION_PRESETS_HOURS.map((p) => (
                  <Pill
                    key={p.minutes}
                    label={formatDurationLabel(p.minutes)}
                    selected={!isCustomDuration && selectedDuration === p.minutes}
                    onPress={() => {
                      setIsCustomDuration(false);
                      setSelectedDuration(p.minutes);
                    }}
                    color="#111827"
                  />
                ))}
              </ScrollView>

              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 mt-1">
                Maalmood
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-2"
                contentContainerStyle={{ gap: 6 }}
              >
                {DURATION_PRESETS_DAYS.map((p) => (
                  <Pill
                    key={p.minutes}
                    label={formatDurationLabel(p.minutes)}
                    selected={!isCustomDuration && selectedDuration === p.minutes}
                    onPress={() => {
                      setIsCustomDuration(false);
                      setSelectedDuration(p.minutes);
                    }}
                    color="#111827"
                  />
                ))}
                <Pill
                  label="Custom"
                  selected={isCustomDuration}
                  onPress={() => {
                    setIsCustomDuration(true);
                    const v = parseInt(customMinutesInput, 10);
                    setCustomMinutesInput(
                      String(isNaN(v) ? 25 : Math.max(1, Math.min(120, v)))
                    );
                  }}
                  color="#111827"
                />
              </ScrollView>

              {isCustomDuration && (
                <KeyboardAvoidingView
                  behavior={Platform.OS === "ios" ? "padding" : undefined}
                  className="mb-2"
                >
                  <View className="flex-row items-center gap-3">
                    <TextInput
                      value={customMinutesInput}
                      onChangeText={(t) => {
                        const digits = t.replace(/\D/g, "");
                        const v =
                          digits === ""
                            ? ""
                            : String(
                              Math.max(
                                1,
                                Math.min(120, parseInt(digits, 10) || 1)
                              )
                            );
                        setCustomMinutesInput(v);
                      }}
                      onBlur={() => {
                        const v = parseInt(customMinutesInput, 10);
                        setCustomMinutesInput(
                          String(isNaN(v) ? 25 : Math.max(1, Math.min(120, v)))
                        );
                      }}
                      placeholder="25"
                      keyboardType="number-pad"
                      maxLength={3}
                      className="rounded-xl border-2 border-gray-200 px-4 py-2.5 text-base font-bold min-w-[80px]"
                    />
                    <Text className="text-sm text-gray-400">
                      daqiiqo (1–120)
                    </Text>
                  </View>
                </KeyboardAvoidingView>
              )}

              <View className="bg-gray-50 rounded-xl px-4 py-2.5 mb-4 mt-1">
                <Text className="text-sm font-bold text-gray-700">
                  {formatDurationLabel(getEffectiveDurationMinutes())}
                </Text>
              </View>

              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Apps-ka la xiro ({blockedAppNames.length})
              </Text>
              {blockedAppNames.length > 0 ? (
                <View className="flex-row flex-wrap gap-2 mb-4">
                  {blockedAppNames.map((app) => (
                    <View
                      key={app.id}
                      className="flex-row items-center gap-1.5 bg-red-50 px-3 py-1.5 rounded-lg"
                    >
                      <AppIcon icon={app.icon} size={16} />
                      <Text className="text-sm font-semibold text-red-600">
                        {app.name}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text className="text-xs text-gray-400 mb-4">
                  Wali ma dooran — taabo "Dooro" Focus home-ka
                </Text>
              )}
            </View>

            <View className="px-5 pb-10 pt-2 border-t border-gray-100">
              <Pressable
                className="rounded-2xl py-4 items-center flex-row justify-center gap-2 active:opacity-90"
                style={{ backgroundColor: "#111827" }}
                onPress={startSession}
              >
                <Feather name="zap" size={20} color="#34d399" />
                <Text className="text-white text-lg font-bold">
                  Bilow focus
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── App picker ────────────────────────────────────────── */}
      <Modal visible={appPickerOpen} animationType="slide" transparent>
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setAppPickerOpen(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl"
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: "80%",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <View className="w-10 h-1 bg-gray-300 rounded-full self-center mt-3 mb-5" />
            <View className="px-5 pb-2">
              <Text className="text-xl font-extrabold text-gray-900 mb-1">
                Dooro apps-ka la xiro
              </Text>
              <Text className="text-sm text-gray-500 mb-4">
                Taabo app-ka aad rabto in la xiro
              </Text>
            </View>

            <ScrollView className="px-5" style={{ maxHeight: 400 }}>
              {appList.map((app) => {
                const checked = selectedApps.includes(app.id);
                return (
                  <Pressable
                    key={app.id}
                    className="flex-row items-center gap-3 py-3 border-b border-gray-100 active:opacity-80"
                    onPress={() => toggleApp(app.id)}
                  >
                    <View
                      className="w-6 h-6 rounded-md items-center justify-center"
                      style={{
                        backgroundColor: checked ? "#111827" : "#fff",
                        borderWidth: 2,
                        borderColor: checked ? "#111827" : "#d1d5db",
                      }}
                    >
                      {checked && (
                        <Feather name="check" size={14} color="#fff" />
                      )}
                    </View>
                    <View className="w-9 h-9 rounded-lg bg-gray-100 items-center justify-center">
                      <AppIcon icon={app.icon} size={24} />
                    </View>
                    <Text className="flex-1 text-sm font-semibold text-gray-900">
                      {app.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <View className="px-5 pb-10 pt-4 border-t border-gray-100">
              <Pressable
                className="rounded-2xl py-4 items-center flex-row justify-center gap-2 active:opacity-90"
                style={{ backgroundColor: "#111827" }}
                onPress={saveApps}
              >
                <Feather name="check" size={20} color="#fff" />
                <Text className="text-white text-lg font-bold">Kaydi</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Schedule creation modal ───────────────────────────── */}
      <Modal visible={scheduleSheetOpen} animationType="slide" transparent>
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setScheduleSheetOpen(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl"
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: "88%",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <View className="w-10 h-1 bg-gray-300 rounded-full self-center mt-3 mb-4" />
            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
              <View className="flex-row items-center gap-3 mb-5">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: "#1e293b" }}
                >
                  <Feather name="calendar" size={20} color="#a78bfa" />
                </View>
                <View>
                  <Text className="text-lg font-extrabold text-gray-900">
                    Qorshee cusub
                  </Text>
                  <Text className="text-xs text-gray-400 font-medium">
                    Dooro wakhti bilowga iyo muddo
                  </Text>
                </View>
              </View>

              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                Goorma bilaabmayaa
              </Text>

              <View
                className="rounded-2xl overflow-hidden mb-6"
                style={{
                  backgroundColor: "#f8fafc",
                  borderWidth: 1,
                  borderColor: "#e2e8f0",
                }}
              >
                <Pressable
                  className="flex-row items-center p-4 active:bg-slate-100"
                  onPress={() => setShowDatePicker(true)}
                >
                  <View className="w-10 h-10 rounded-xl bg-purple-50 items-center justify-center mr-4">
                    <Feather name="calendar" size={18} color="#8b5cf6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Taariikhda</Text>
                    <Text className="text-base font-bold text-slate-800">
                      {formatScheduleDate(scheduleStartTime.toISOString())}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#cbd5e1" />
                </Pressable>

                <View style={{ height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 16 }} />

                <Pressable
                  className="flex-row items-center p-4 active:bg-slate-100"
                  onPress={() => setShowTimePicker(true)}
                >
                  <View className="w-10 h-10 rounded-xl bg-purple-50 items-center justify-center mr-4">
                    <Feather name="clock" size={18} color="#8b5cf6" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Saacadda</Text>
                    <Text className="text-base font-bold text-slate-800">
                      {formatScheduleTime(scheduleStartTime.toISOString())}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#cbd5e1" />
                </Pressable>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={scheduleStartTime}
                  mode="date"
                  display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    setShowDatePicker(false);
                    if (event.type === 'set' && date) {
                      const merged = new Date(scheduleStartTime);
                      merged.setFullYear(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate()
                      );
                      setScheduleStartTime(merged);
                    }
                  }}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={scheduleStartTime}
                  mode="time"
                  display={Platform.OS === 'android' ? 'clock' : 'spinner'}
                  is24Hour
                  onChange={(event, date) => {
                    setShowTimePicker(false);
                    if (event.type === 'set' && date) {
                      const merged = new Date(scheduleStartTime);
                      merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
                      setScheduleStartTime(merged);
                    }
                  }}
                />
              )}

              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Wakhtiga (muddo)
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-2"
                contentContainerStyle={{ gap: 6 }}
              >
                {DURATION_PRESETS_MINUTES.map((p) => (
                  <Pill
                    key={p.minutes}
                    label={formatDurationLabel(p.minutes)}
                    selected={scheduleDuration === p.minutes}
                    onPress={() => setScheduleDuration(p.minutes)}
                    color="#1e293b"
                  />
                ))}
                {DURATION_PRESETS_HOURS.map((p) => (
                  <Pill
                    key={p.minutes}
                    label={formatDurationLabel(p.minutes)}
                    selected={scheduleDuration === p.minutes}
                    onPress={() => setScheduleDuration(p.minutes)}
                    color="#1e293b"
                  />
                ))}
              </ScrollView>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-3"
                contentContainerStyle={{ gap: 6 }}
              >
                {DURATION_PRESETS_DAYS.map((p) => (
                  <Pill
                    key={p.minutes}
                    label={formatDurationLabel(p.minutes)}
                    selected={scheduleDuration === p.minutes}
                    onPress={() => setScheduleDuration(p.minutes)}
                    color="#1e293b"
                  />
                ))}
              </ScrollView>

              <View
                className="bg-purple-50 rounded-2xl p-4 mb-6"
                style={{ borderWidth: 1, borderColor: "#ede9fe" }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Feather name="info" size={14} color="#8b5cf6" />
                  <Text className="text-xs text-purple-600 font-extrabold uppercase tracking-widest">
                    Faahfaahinta Qorshaha
                  </Text>
                </View>
                <Text className="text-sm font-bold text-slate-800 leading-5">
                  Blocking-ka wuxuu bilaaban doonaa{" "}
                  <Text className="text-purple-600">
                    {formatScheduleDate(scheduleStartTime.toISOString())}
                  </Text>{" "}
                  markay tahay{" "}
                  <Text className="text-purple-600">
                    {formatScheduleTime(scheduleStartTime.toISOString())}
                  </Text>{" "}
                  codsiyada aad dooratana wey xirmi doonaan muddo dhan{" "}
                  <Text className="text-purple-600">
                    {formatDurationLabel(scheduleDuration)}
                  </Text>.
                </Text>
              </View>

              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                Apps-ka la xiri doono
              </Text>
              {appList.map((app) => {
                const checked = scheduleApps.includes(app.id);
                return (
                  <Pressable
                    key={app.id}
                    className="flex-row items-center gap-3 py-3 border-b border-gray-100 active:opacity-80"
                    onPress={() => toggleScheduleApp(app.id)}
                  >
                    <View
                      className="w-6 h-6 rounded-md items-center justify-center"
                      style={{
                        backgroundColor: checked ? "#1e293b" : "#fff",
                        borderWidth: 2,
                        borderColor: checked ? "#1e293b" : "#d1d5db",
                      }}
                    >
                      {checked && (
                        <Feather name="check" size={14} color="#fff" />
                      )}
                    </View>
                    <View className="w-9 h-9 rounded-lg bg-gray-100 items-center justify-center">
                      <AppIcon icon={app.icon} size={24} />
                    </View>
                    <Text className="flex-1 text-sm font-semibold text-gray-900">
                      {app.name}
                    </Text>
                  </Pressable>
                );
              })}

              {Platform.OS === "ios" && (
                <View
                  className="rounded-xl px-4 py-3 mt-4 mb-2"
                  style={{
                    backgroundColor: "#fffbeb",
                    borderWidth: 1,
                    borderColor: "#fde68a",
                  }}
                >
                  <Text className="text-xs text-amber-700 leading-4">
                    iOS: Wakhti bilow, notification ayaa laguu soo dirin doonaa
                    si aad app-ka u furto oo aad session bilowdo.
                  </Text>
                </View>
              )}
              <View style={{ height: 16 }} />
            </ScrollView>

            <View className="px-5 pb-10 pt-3 border-t border-gray-100">
              <Pressable
                className="rounded-2xl py-4 items-center flex-row justify-center gap-2 active:opacity-90"
                style={{ backgroundColor: "#1e293b" }}
                onPress={saveSchedule}
              >
                <Feather name="check" size={20} color="#fff" />
                <Text className="text-white text-lg font-bold">
                  Kaydi qorshe
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Group create session modal ────────────────────────── */}
      <Modal visible={groupSheetOpen} animationType="slide" transparent>
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={() => setGroupSheetOpen(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl"
            onPress={(e) => e.stopPropagation()}
            style={{
              maxHeight: "88%",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.15,
              shadowRadius: 20,
              elevation: 12,
            }}
          >
            <View className="w-10 h-1 bg-gray-300 rounded-full self-center mt-3 mb-4" />
            <ScrollView className="px-5" showsVerticalScrollIndicator={false}>
              <View className="flex-row items-center gap-3 mb-5">
                <View
                  className="w-10 h-10 rounded-xl items-center justify-center"
                  style={{ backgroundColor: "#7c3aed" }}
                >
                  <Feather name="users" size={20} color="#fff" />
                </View>
                <View>
                  <Text className="text-lg font-extrabold text-gray-900">
                    Abuur focus kooxda
                  </Text>
                  <Text className="text-xs text-gray-400 font-medium">
                    Dooro wakhti, apps iyo strict mode
                  </Text>
                </View>
              </View>

              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                Goorma bilaabmayaa
              </Text>

              <View
                className="rounded-2xl overflow-hidden mb-6"
                style={{
                  backgroundColor: "#faf5ff",
                  borderWidth: 1,
                  borderColor: "#ede9fe",
                }}
              >
                <Pressable
                  className="flex-row items-center p-4 active:bg-purple-100/50"
                  onPress={() => setShowGroupDatePicker(true)}
                >
                  <View className="w-10 h-10 rounded-xl bg-white items-center justify-center mr-4 shadow-sm">
                    <Feather name="calendar" size={18} color="#7c3aed" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] text-purple-400 font-bold uppercase tracking-tight">Taariikhda</Text>
                    <Text className="text-base font-bold text-purple-900">
                      {formatScheduleDate(groupStartTime.toISOString())}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#ddd6fe" />
                </Pressable>

                <View style={{ height: 1, backgroundColor: "#f3e8ff", marginHorizontal: 16 }} />

                <Pressable
                  className="flex-row items-center p-4 active:bg-purple-100/50"
                  onPress={() => setShowGroupTimePicker(true)}
                >
                  <View className="w-10 h-10 rounded-xl bg-white items-center justify-center mr-4 shadow-sm">
                    <Feather name="clock" size={18} color="#7c3aed" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[10px] text-purple-400 font-bold uppercase tracking-tight">Saacadda</Text>
                    <Text className="text-base font-bold text-purple-900">
                      {formatScheduleTime(groupStartTime.toISOString())}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#ddd6fe" />
                </Pressable>
              </View>
              {showGroupDatePicker && (
                <DateTimePicker
                  value={groupStartTime}
                  mode="date"
                  display={Platform.OS === 'android' ? 'calendar' : 'spinner'}
                  minimumDate={new Date()}
                  onChange={(event, date) => {
                    setShowGroupDatePicker(false);
                    if (event.type === 'set' && date) {
                      const m = new Date(groupStartTime);
                      m.setFullYear(
                        date.getFullYear(),
                        date.getMonth(),
                        date.getDate()
                      );
                      setGroupStartTime(m);
                    }
                  }}
                />
              )}
              {showGroupTimePicker && (
                <DateTimePicker
                  value={groupStartTime}
                  mode="time"
                  display={Platform.OS === 'android' ? 'clock' : 'spinner'}
                  is24Hour
                  onChange={(event, date) => {
                    setShowGroupTimePicker(false);
                    if (event.type === 'set' && date) {
                      const m = new Date(groupStartTime);
                      m.setHours(date.getHours(), date.getMinutes(), 0, 0);
                      setGroupStartTime(m);
                    }
                  }}
                />
              )}

              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                Daqiiqo
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-2"
                contentContainerStyle={{ gap: 6 }}
              >
                {DURATION_PRESETS_MINUTES.map((p) => (
                  <Pill
                    key={p.minutes}
                    label={formatDurationLabel(p.minutes)}
                    selected={groupDuration === p.minutes}
                    onPress={() => setGroupDuration(p.minutes)}
                    color="#7c3aed"
                  />
                ))}
              </ScrollView>
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 mt-1">
                Saac
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-2"
                contentContainerStyle={{ gap: 6 }}
              >
                {DURATION_PRESETS_HOURS.map((p) => (
                  <Pill
                    key={p.minutes}
                    label={formatDurationLabel(p.minutes)}
                    selected={groupDuration === p.minutes}
                    onPress={() => setGroupDuration(p.minutes)}
                    color="#7c3aed"
                  />
                ))}
              </ScrollView>
              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 mt-1">
                Maalmood
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4"
                contentContainerStyle={{ gap: 6 }}
              >
                {DURATION_PRESETS_DAYS.map((p) => (
                  <Pill
                    key={p.minutes}
                    label={formatDurationLabel(p.minutes)}
                    selected={groupDuration === p.minutes}
                    onPress={() => setGroupDuration(p.minutes)}
                    color="#7c3aed"
                  />
                ))}
              </ScrollView>

              <View
                className="rounded-2xl p-4 mb-6 shadow-sm"
                style={{
                  backgroundColor: "#faf5ff",
                  borderWidth: 1,
                  borderColor: "#ede9fe",
                }}
              >
                <View className="flex-row items-center gap-2 mb-2">
                  <Feather name="info" size={14} color="#7c3aed" />
                  <Text className="text-xs text-purple-600 font-extrabold uppercase tracking-widest">
                    Faahfaahinta Focus kooxda
                  </Text>
                </View>
                <Text className="text-sm font-bold text-slate-800 leading-5">
                  Focus kooxda wuxuu bilaaban doonaa{" "}
                  <Text className="text-purple-600">
                    {formatScheduleDate(groupStartTime.toISOString())}
                  </Text>{" "}
                  markay tahay{" "}
                  <Text className="text-purple-600">
                    {formatScheduleTime(groupStartTime.toISOString())}
                  </Text>{" "}
                  dhammaan xubnaha kooxdana apps-ka wey xirnaan doonaan muddo dhan{" "}
                  <Text className="text-purple-600">
                    {formatDurationLabel(groupDuration)}
                  </Text>.
                </Text>
              </View>

              <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
                Apps-ka la xiro (kooxda oo dhan)
              </Text>
              {appList.map((app) => {
                const checked = groupApps.includes(app.id);
                return (
                  <Pressable
                    key={app.id}
                    className="flex-row items-center gap-3 py-3 border-b border-gray-100 active:opacity-80"
                    onPress={() => toggleGroupApp(app.id)}
                  >
                    <View
                      className="w-6 h-6 rounded-md items-center justify-center"
                      style={{
                        backgroundColor: checked ? "#7c3aed" : "#fff",
                        borderWidth: 2,
                        borderColor: checked ? "#7c3aed" : "#d1d5db",
                      }}
                    >
                      {checked && (
                        <Feather name="check" size={14} color="#fff" />
                      )}
                    </View>
                    <View className="w-9 h-9 rounded-lg bg-gray-100 items-center justify-center">
                      <AppIcon icon={app.icon} size={24} />
                    </View>
                    <Text className="flex-1 text-sm font-semibold text-gray-900">
                      {app.name}
                    </Text>
                  </Pressable>
                );
              })}

              <View
                className="flex-row items-center justify-between mt-5 mb-3 rounded-xl px-4 py-3.5"
                style={{ borderWidth: 1, borderColor: "#ede9fe" }}
              >
                <View className="flex-row items-center gap-3 flex-1 mr-3">
                  <View className="w-9 h-9 rounded-lg bg-amber-50 items-center justify-center">
                    <Feather name="shield" size={18} color="#d97706" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm font-bold text-gray-900">
                      Strict mode
                    </Text>
                    <Text className="text-xs text-gray-400 mt-0.5">
                      Ma jiraan "End early"
                    </Text>
                  </View>
                </View>
                <Switch
                  value={groupStrict}
                  onValueChange={setGroupStrict}
                  trackColor={{ true: "#7c3aed", false: "#e5e7eb" }}
                  thumbColor="#fff"
                />
              </View>
              <View style={{ height: 16 }} />
            </ScrollView>

            <View className="px-5 pb-10 pt-3 border-t border-gray-100">
              <Pressable
                className="rounded-2xl py-4 items-center flex-row justify-center gap-2 active:opacity-90"
                style={{ backgroundColor: "#7c3aed" }}
                onPress={handleCreateGroup}
              >
                {groupLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Feather name="users" size={20} color="#fff" />
                    <Text className="text-white text-lg font-bold">
                      Abuur & wadaag code
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
