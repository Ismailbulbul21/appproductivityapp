import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform, Alert } from "react-native";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const canSchedule = () => Platform.OS === "ios" || Platform.OS === "android";

const MIN_SECONDS = 5;

export async function triggerTestNotification(): Promise<boolean> {
  if (!canSchedule()) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Xasuusin",
        body: "Tijaabinta xasuusinta waxay shaqeysaa.",
        sound: true,
      },
      trigger: null,
    });
    return true;
  } catch (e) {
    console.warn("[Notifications] test failed:", e);
    return false;
  }
}

export async function registerForPushNotifications(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  if (!Device.isDevice) return false;

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Xasuusinta",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return true;
}

function getSecondsUntil(dueDate: string, dueTime: string): number {
  const [year, month, day] = dueDate.split("-").map(Number);
  const [hours, minutes] = dueTime.split(":").map(Number);
  const target = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return Math.floor((target.getTime() - Date.now()) / 1000);
}

async function scheduleInSeconds(
  seconds: number,
  title: string,
  body: string,
  taskId?: string
): Promise<string | null> {
  if (!canSchedule()) return null;
  if (seconds < MIN_SECONDS) return null;

  try {
    const trigger: Record<string, unknown> = {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
    };
    if (Platform.OS === "android") {
      trigger.channelId = "default";
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: taskId ? { taskId } : {},
        sound: true,
      },
      trigger: trigger as Notifications.TimeIntervalTriggerInput,
    });
    console.log(
      `[Notifications] scheduled "${body}" in ${seconds}s → id=${id}`
    );
    return id;
  } catch (e) {
    console.warn("[Notifications] schedule failed:", e);
    return null;
  }
}

/**
 * Schedule task reminder(s).
 * - Always schedules one at the due time.
 * - If minutesBefore > 0, also schedules one earlier.
 */
export async function scheduleTaskNotifications(
  taskId: string,
  taskTitle: string,
  dueDate: string,
  dueTime: string,
  minutesBefore: number
): Promise<{ atTimeId: string | null; earlyId: string | null }> {
  const secondsUntilDue = getSecondsUntil(dueDate, dueTime);

  const atTimeId = await scheduleInSeconds(
    secondsUntilDue,
    "Xasuusin Hawl",
    `Waqtigii hawsha: ${taskTitle}`,
    taskId
  );

  let earlyId: string | null = null;
  if (minutesBefore > 0) {
    const earlySeconds = secondsUntilDue - minutesBefore * 60;
    earlyId = await scheduleInSeconds(
      earlySeconds,
      "Xasuusin Hawl",
      `${taskTitle} — ${minutesBefore} daqiiqo kahor`,
      taskId
    );
  }

  return { atTimeId, earlyId };
}

export async function cancelNotification(
  notificationId: string | null | undefined
): Promise<void> {
  if (!notificationId || !canSchedule()) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // ignore
  }
}

export async function cancelTaskNotifications(
  atTimeId: string | null | undefined,
  earlyId: string | null | undefined
): Promise<void> {
  await cancelNotification(atTimeId);
  await cancelNotification(earlyId);
}

export async function scheduleGoalReminderNotification(
  at: Date,
  body: string
): Promise<string | null> {
  const seconds = Math.floor((at.getTime() - Date.now()) / 1000);
  return scheduleInSeconds(seconds, "Xasuusin Yool", body);
}

/**
 * Debug: list all currently scheduled notifications.
 * Call from Dejinta to verify.
 */
export async function debugListScheduled(): Promise<string> {
  if (!canSchedule()) return "Web: no local notifications";
  try {
    const all = await Notifications.getAllScheduledNotificationsAsync();
    if (all.length === 0) return "Xasuusin la qorsheeyay: 0";
    return all
      .map(
        (n) =>
          `• ${n.content.body ?? "(no body)"} [${n.identifier}]`
      )
      .join("\n");
  } catch (e) {
    return `Error: ${e}`;
  }
}
