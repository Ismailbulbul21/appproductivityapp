import { Platform } from "react-native";

let NativeModule: any = null;
try {
  NativeModule = require("../modules/focus-blocking").default;
} catch {
  // Native module not available (e.g. running in Expo Go)
}

export const isNativeBlockingAvailable = NativeModule != null;

export function hasPermissions(): boolean {
  if (!NativeModule?.hasPermissions) return false;
  try {
    return NativeModule.hasPermissions();
  } catch {
    return false;
  }
}

export async function requestPermissions(): Promise<void> {
  if (!NativeModule || Platform.OS !== "android") return;
  try {
    const hasUsage: boolean = NativeModule.hasUsageAccess();
    const hasOverlay: boolean = NativeModule.hasOverlayPermission();
    if (!hasUsage) {
      await NativeModule.requestUsageAccess();
    } else if (!hasOverlay) {
      await NativeModule.requestOverlayPermission();
    }
  } catch { }
}

export function checkMissingPermission(): "usage" | "overlay" | null {
  if (!NativeModule) return null;
  try {
    if (!NativeModule.hasUsageAccess()) return "usage";
    if (!NativeModule.hasOverlayPermission()) return "overlay";
    return null;
  } catch {
    return null;
  }
}

export async function getInstalledApps(): Promise<
  { packageName: string; label: string; icon?: string }[]
> {
  if (!NativeModule || Platform.OS !== "android") return [];
  try {
    return await NativeModule.getInstalledApps();
  } catch {
    return [];
  }
}

export async function startBlocking(
  blockedPackageNames: string[],
  endTimeMs?: number
): Promise<void> {
  if (!NativeModule) return;
  try {
    if (Platform.OS === "android") {
      await NativeModule.startBlocking(blockedPackageNames, endTimeMs ?? null);
    } else if (Platform.OS === "ios") {
      await NativeModule.startBlocking();
    }
  } catch (e) {
    console.warn("FocusBlocking.startBlocking failed:", e);
  }
}

export async function stopBlocking(): Promise<void> {
  if (!NativeModule) return;
  try {
    await NativeModule.stopBlocking();
  } catch (e) {
    console.warn("FocusBlocking.stopBlocking failed:", e);
  }
}

export async function requestFocusAuthorization(): Promise<boolean> {
  if (!NativeModule || Platform.OS !== "ios") return false;
  try {
    return await NativeModule.requestAuthorization();
  } catch {
    return false;
  }
}

export async function openAppPicker(): Promise<boolean> {
  if (!NativeModule || Platform.OS !== "ios") return false;
  try {
    return await NativeModule.openAppPicker();
  } catch {
    return false;
  }
}

/**
 * Schedules a background blocking session natively using AlarmManager on Android.
 */
export async function scheduleBlocking(
  blockedPackageNames: string[],
  startTimeMs: number,
  endTimeMs: number,
  uniqueId: string
): Promise<boolean> {
  if (Platform.OS !== "android" || !NativeModule?.scheduleBlocking) {
    return false;
  }
  try {
    return await NativeModule.scheduleBlocking(
      blockedPackageNames,
      startTimeMs,
      endTimeMs,
      uniqueId
    );
  } catch (e) {
    console.warn("FocusBlocking.scheduleBlocking failed:", e);
    return false;
  }
}

/**
 * Cancels a previously scheduled background blocking session.
 */
export async function cancelScheduledBlocking(uniqueId: string): Promise<boolean> {
  if (Platform.OS !== "android" || !NativeModule?.cancelScheduledBlocking) {
    return false;
  }
  try {
    return await NativeModule.cancelScheduledBlocking(uniqueId);
  } catch (e) {
    console.warn("FocusBlocking.cancelScheduledBlocking failed:", e);
    return false;
  }
}

