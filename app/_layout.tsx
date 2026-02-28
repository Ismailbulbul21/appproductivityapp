import "../global.css";
import { useEffect, useRef } from "react";
import { ActivityIndicator, View, Platform } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "../hooks/useAuth";
import { TasksProvider } from "../hooks/useTasks";
import { scheduleGoalReminderNotification } from "../services/notifications";

const GOAL_REMINDER_SCHEDULED_KEY = "goal_reminder_scheduled_for";

function getNextGoalReminderTime(
  dayOfWeek: number,
  timeStr: string
): Date | null {
  const [hours, minutes] = timeStr.split(":").map(Number);
  const now = new Date();
  let d = new Date(now);
  d.setHours(hours, minutes, 0, 0);
  const currentDay = now.getDay();
  let daysAhead = dayOfWeek - currentDay;
  if (daysAhead < 0 || (daysAhead === 0 && d.getTime() <= now.getTime())) {
    daysAhead += 7;
  }
  d.setDate(d.getDate() + daysAhead);
  return d.getTime() > now.getTime() ? d : null;
}

function RootLayoutContent() {
  const { session, profile, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const taskId = response.notification.request.content.data?.taskId;
        if (taskId) router.push(`/task/${taskId}`);
      }
    );
    responseListener.current = sub;
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (
      Platform.OS === "web" ||
      !session ||
      !profile?.notifications_enabled ||
      profile.goal_reminder_day == null ||
      profile.goal_reminder_time == null
    ) {
      return;
    }
    const day = profile.goal_reminder_day;
    const time = profile.goal_reminder_time;
    const next = getNextGoalReminderTime(day, time);
    if (!next) return;

    (async () => {
      const stored = await AsyncStorage.getItem(GOAL_REMINDER_SCHEDULED_KEY);
      const scheduledFor = stored ? new Date(stored).getTime() : 0;
      if (scheduledFor >= next.getTime() - 60000) return;
      const id = await scheduleGoalReminderNotification(
        next,
        "Yoolkaaga wali ma dhamaan. Sii wad dadaalka."
      );
      if (id) {
        await AsyncStorage.setItem(
          GOAL_REMINDER_SCHEDULED_KEY,
          next.toISOString()
        );
      }
    })();
  }, [session, profile?.notifications_enabled, profile?.goal_reminder_day, profile?.goal_reminder_time]);

  useEffect(() => {
    if (loading) return;
    const inOnboarding = segments[0] === "onboarding";

    if (!session && !inOnboarding) {
      router.replace("/onboarding/");
    } else if (session && !profile?.focus_type && !inOnboarding) {
      router.replace("/onboarding/focus-type");
    }
  }, [session, profile, loading, segments]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <TasksProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="task/[id]" options={{ presentation: "modal" }} />
      </Stack>
    </TasksProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootLayoutContent />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
