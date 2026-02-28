import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInUp, Easing } from "react-native-reanimated";
import type { GoalWithProgress } from "../hooks/useGoals";

const SHEET_MAX_HEIGHT_PERCENT = 0.9;
const ANDROID_KEYBOARD_OFFSET = 0;

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
/** 24h "HH:mm" for storage/API */
function formatTimeLocal(date: Date): string {
  return date.toTimeString().slice(0, 5);
}
/** 12h with AM/PM for display (Somalia-friendly) */
function formatTime12h(date: Date): string {
  const h = date.getHours();
  const m = date.getMinutes();
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

const REMINDER_OPTIONS = [
  { value: 0, label: "Isla markii la gaaro" },
  { value: 10, label: "10 daqiiqo kahor" },
  { value: 30, label: "30 daqiiqo kahor" },
  { value: 60, label: "1 saac kahor" },
] as const;

interface AddTaskSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (task: {
    title: string;
    due_date: string | null;
    due_time: string | null;
    priority: string;
    goal_id: string | null;
    reminder_minutes_before: number;
  }) => Promise<void>;
  goals: GoalWithProgress[];
  /** When false, Yoolka (goals) section is hidden. Default true. */
  showGoal?: boolean;
}

const PRIORITIES = [
  { key: "Hoose", label: "Hoose", color: "#6b7280" },
  { key: "Dhexe", label: "Dhexe", color: "#f59e0b" },
  { key: "Sare", label: "Sare", color: "#ef4444" },
];

/** Default = now in user's device local time (location time) */
const getDefaultDate = () => new Date();

const DATE_CHIP_DAYS = 7;
function getDateChipOptions() {
  return Array.from({ length: DATE_CHIP_DAYS }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      value: formatDateLocal(d),
      label: i === 0 ? "Maanta" : i === 1 ? "Berri" : `+${i}`,
      fullLabel: i === 0 ? "Maanta" : i === 1 ? "Berri" : formatDateLocal(d),
    };
  });
}

export default function AddTaskSheet({ visible, onClose, onAdd, goals, showGoal = true }: AddTaskSheetProps) {
  const defaultDate = getDefaultDate();
  const [title, setTitle] = useState("");
  const [dateValue, setDateValue] = useState<Date>(defaultDate);
  const [dueDate, setDueDate] = useState(formatDateLocal(defaultDate));
  const [dueTime, setDueTime] = useState(formatTimeLocal(defaultDate));
  const [priority, setPriority] = useState("Dhexe");
  const [reminderMinutesBefore, setReminderMinutesBefore] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timePickerValue, setTimePickerValue] = useState<Date>(defaultDate);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible) {
      const now = getDefaultDate();
      setDateValue(now);
      setDueDate(formatDateLocal(now));
      setDueTime(formatTimeLocal(now));
    }
  }, [visible]);

  const reset = () => {
    const def = getDefaultDate();
    setTitle("");
    setDateValue(def);
    setDueDate(formatDateLocal(def));
    setDueTime(formatTimeLocal(def));
    setPriority("Dhexe");
    setReminderMinutesBefore(0);
    setSelectedGoal(null);
    setShowTimePicker(false);
  };

  const onTimeChange = (_: unknown, d?: Date) => {
    if (Platform.OS === "android") setShowTimePicker(false);
    if (d) {
      setDateValue((prev) => {
        const next = new Date(prev);
        next.setHours(d.getHours(), d.getMinutes(), 0, 0);
        return next;
      });
      setDueTime(formatTimeLocal(d));
      setTimePickerValue(d);
    }
  };

  const openTimePicker = () => {
    setTimePickerValue(new Date(dateValue.getTime()));
    setShowTimePicker(true);
  };

  const confirmTimePicker = () => {
    setDateValue(timePickerValue);
    setDueTime(formatTimeLocal(timePickerValue));
    setShowTimePicker(false);
  };

  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const windowHeight = Dimensions.get("window").height;
  const sheetMaxHeight = windowHeight * SHEET_MAX_HEIGHT_PERCENT;

  const handleAdd = async () => {
    if (!title.trim()) {
      Alert.alert("Khalad", "Fadlan ku qor magaca hawsha.");
      return;
    }
    setSaving(true);
    try {
      await onAdd({
        title: title.trim(),
        due_date: dueDate || null,
        due_time: dueTime || null,
        priority,
        goal_id: selectedGoal,
        reminder_minutes_before: reminderMinutesBefore,
      });
      reset();
      onClose();
    } catch {
      Alert.alert("Khalad", "Ma suurtogalin in la kaydiyo. Isku day mar kale.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={Platform.OS === "android" ? ANDROID_KEYBOARD_OFFSET : 0}
      >
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose} />
        <View style={{ paddingTop: 40 }}>
          <Animated.View
            entering={FadeInUp.duration(280).easing(Easing.out(Easing.cubic))}
            style={{
              height: sheetMaxHeight,
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: -4 },
              shadowOpacity: 0.12,
              shadowRadius: 16,
              elevation: 12,
            }}
          >
          {/* Header: minimal so "Hawl Cusub" stays on screen when typing */}
          <View className="px-3 pt-1.5 pb-1">
            <View className="w-8 h-0.5 bg-gray-300 rounded-full self-center mb-1.5" />
            <View className="flex-row items-center justify-between">
              <Text className="text-base font-extrabold text-gray-900">
                Hawl Cusub
              </Text>
              <Pressable
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
                hitSlop={8}
              >
                <Feather name="x" size={16} color="#374151" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Magaca hawsha – compact so all fits above keyboard */}
            <View className="mb-2">
              <Text className="text-xs font-semibold text-gray-700 mb-1">
                Magaca hawsha
              </Text>
              <TextInput
                className="border-2 border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-900 bg-gray-50"
                placeholder="Tusaale: Akhri buug..."
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                onFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
              />
              <Pressable
                className="mt-2 rounded-xl py-2.5 items-center flex-row justify-center gap-1.5 active:bg-emerald-700 disabled:opacity-70"
                style={{ backgroundColor: "#059669" }}
                onPress={handleAdd}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="check" size={16} color="#fff" />
                )}
                <Text className="text-white text-sm font-bold">
                  {saving ? "Kaydinaya..." : "Ku dar"}
                </Text>
              </Pressable>
            </View>

            <Text className="text-xs font-semibold text-gray-700 mb-1">Xasuusin</Text>
            <View className="flex-row flex-wrap gap-1.5 mb-2">
              {REMINDER_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setReminderMinutesBefore(opt.value)}
                  className={`px-3 py-2 rounded-lg border-2 ${
                    reminderMinutesBefore === opt.value
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      reminderMinutesBefore === opt.value
                        ? "text-emerald-700"
                        : "text-gray-600"
                    }`}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="text-xs font-semibold text-gray-700 mb-1">Taariikhda</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-2 -mx-1"
              contentContainerStyle={{ paddingHorizontal: 2 }}
            >
              {getDateChipOptions().map((opt) => {
                const isSelected = dueDate === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => {
                      setDueDate(opt.value);
                      const next = new Date(opt.value + "T12:00:00");
                      next.setHours(dateValue.getHours(), dateValue.getMinutes(), 0, 0);
                      setDateValue(next);
                      setDueTime(formatTimeLocal(next));
                    }}
                    className="rounded-xl px-3 py-2 min-w-[64] items-center justify-center active:opacity-90 mr-2"
                    style={{
                      backgroundColor: isSelected ? "#059669" : "#f1f5f9",
                    }}
                  >
                    <Text
                      className="text-sm font-bold"
                      style={{ color: isSelected ? "#fff" : "#475569" }}
                    >
                      {opt.label}
                    </Text>
                    {opt.label !== "Maanta" && opt.label !== "Berri" && (
                      <Text
                        className="text-[10px] font-medium mt-0.5"
                        style={{ color: isSelected ? "rgba(255,255,255,0.9)" : "#94a3b8" }}
                      >
                        {opt.fullLabel}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text className="text-xs font-semibold text-gray-700 mb-1">Mudnaanta</Text>
            <View className="flex-row gap-1.5 mb-2">
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p.key}
                  className={`flex-1 py-2 rounded-lg items-center border-2 ${
                    priority === p.key ? "border-current" : "border-gray-200"
                  }`}
                  style={
                    priority === p.key
                      ? { borderColor: p.color, backgroundColor: p.color + "15" }
                      : undefined
                  }
                  onPress={() => setPriority(p.key)}
                >
                  <Text
                    className="text-xs font-bold"
                    style={{ color: priority === p.key ? p.color : "#6b7280" }}
                  >
                    {p.label}
                  </Text>
                  <Feather name="calendar" size={16} color="#6b7280" />
                </Pressable>
              ))}
            </View>

            <Text className="text-xs font-semibold text-gray-700 mb-1">Waqtiga</Text>
            <View className="mb-2">
              <Pressable
                className="border border-gray-200 rounded-lg px-3 py-2.5 flex-row items-center justify-between bg-gray-50 active:bg-gray-100"
                onPress={() => (isIOS ? openTimePicker() : setShowTimePicker(true))}
              >
                <Text className="text-sm text-gray-900">
                  {dueTime ? formatTime12h(dateValue) : "Dooro waqtiga"}
                </Text>
                <Feather name="clock" size={18} color="#059669" />
              </Pressable>
              {isIOS && showTimePicker && (
                <Modal
                  visible
                  transparent
                  animationType="slide"
                  onRequestClose={() => setShowTimePicker(false)}
                >
                  <Pressable
                    className="flex-1 justify-end bg-black/40"
                    onPress={() => setShowTimePicker(false)}
                  >
                    <Pressable
                      className="bg-white rounded-t-3xl overflow-hidden"
                      onPress={(e) => e.stopPropagation()}
                    >
                      <SafeAreaView edges={["bottom"]} className="bg-white">
                        <View className="w-10 h-1 bg-gray-300 rounded-full self-center mt-2 mb-1" />
                        <Text className="text-center text-base font-bold text-gray-500 mb-1">
                          Waqtiga
                        </Text>
                        <Text className="text-center text-2xl font-extrabold text-emerald-600 mb-3">
                          {formatTime12h(timePickerValue)}
                        </Text>
                        <View className="bg-gray-50 mx-4 rounded-xl overflow-hidden mb-2">
                          <DateTimePicker
                            value={timePickerValue}
                            mode="time"
                            display="spinner"
                            onChange={(_, d) => d && setTimePickerValue(d)}
                            is24Hour={false}
                            textColor="#111827"
                            themeVariant="light"
                            style={{ height: 160 }}
                          />
                        </View>
                        <Pressable
                          className="mx-4 mb-2 bg-emerald-600 rounded-xl py-3 items-center active:bg-emerald-700"
                          onPress={confirmTimePicker}
                        >
                          <Text className="text-white text-base font-bold">
                            La soo dhawee
                          </Text>
                        </Pressable>
                      </SafeAreaView>
                    </Pressable>
                  </Pressable>
                </Modal>
              )}
              {showTimePicker && !isWeb && !isIOS && (
                <View className="mt-1.5 bg-white rounded-lg border border-gray-200 p-1.5">
                  <DateTimePicker
                    value={dateValue}
                    mode="time"
                    display="default"
                    onChange={onTimeChange}
                    is24Hour={false}
                    textColor="#000000"
                    themeVariant="light"
                  />
                </View>
              )}
              {showTimePicker && isWeb && (
                <View className="mt-1.5 border border-gray-300 rounded-lg p-2 bg-white">
                  <DateTimePicker
                    value={dateValue}
                    mode="time"
                    display="spinner"
                    onChange={(_, d) => {
                      if (d) {
                        setDateValue(d);
                        setDueTime(formatTimeLocal(d));
                        setShowTimePicker(false);
                      }
                    }}
                    is24Hour={false}
                    textColor="#111827"
                    themeVariant="light"
                    style={{ height: 140 }}
                  />
                </View>
              )}
            </View>

            {showGoal && goals.length > 0 && (
              <>
                <Text className="text-xs font-semibold text-gray-700 mb-1">Yoolka</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
                  <View className="flex-row gap-1.5">
                    <Pressable
                      className={`px-3 py-1.5 rounded-full border ${
                        !selectedGoal ? "bg-emerald-50 border-emerald-500" : "border-gray-200"
                      }`}
                      onPress={() => setSelectedGoal(null)}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          !selectedGoal ? "text-emerald-700" : "text-gray-500"
                        }`}
                      >
                        Midkoodna
                      </Text>
                    </Pressable>
                    {goals.map((g) => (
                      <Pressable
                        key={g.id}
                        className={`px-3 py-1.5 rounded-full border ${
                          selectedGoal === g.id
                            ? "bg-emerald-50 border-emerald-500"
                            : "border-gray-200"
                        }`}
                        onPress={() => setSelectedGoal(g.id)}
                      >
                        <Text
                          className={`text-xs font-semibold ${
                            selectedGoal === g.id ? "text-emerald-700" : "text-gray-500"
                          }`}
                          numberOfLines={1}
                        >
                          {g.title}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>
              </>
            )}
          </ScrollView>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
