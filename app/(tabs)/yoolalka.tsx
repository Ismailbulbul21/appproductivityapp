import { useState, useEffect } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import { useGoals } from "../../hooks/useGoals";
import GoalCard from "../../components/GoalCard";
import FloatingActionButton from "../../components/FloatingActionButton";
import AddGoalSheet from "../../components/AddGoalSheet";

const DAY_LABELS = ["Axad", "Isniin", "Talaado", "Arbaco", "Khamiis", "Jimce", "Sabti"];

const INTERVAL_OPTIONS = [
  { value: 1, label: "Maalin walba" },
  { value: 3, label: "3 maalmood" },
  { value: 7, label: "Usbuuc walba" },
];

function formatTimeLabel(t: string) {
  const [h, m] = t.split(":").map(Number);
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

function GoalReminderCard() {
  const { profile, updateGoalReminder } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [day, setDay] = useState(0);
  const [time, setTime] = useState("19:00");
  const [interval, setInterval] = useState(7);

  useEffect(() => {
    if (profile) {
      setDay(profile.goal_reminder_day ?? 0);
      setTime(profile.goal_reminder_time ?? "19:00");
      setInterval(profile.goal_reminder_interval_days ?? 7);
    }
  }, [profile]);

  const save = async (d: number, t: string, i: number) => {
    setDay(d);
    setTime(t);
    setInterval(i);
    await updateGoalReminder({ day: d, time: t, intervalDays: i });
  };

  const currentLabel = `${DAY_LABELS[day]} ${formatTimeLabel(time)}, ${
    INTERVAL_OPTIONS.find((o) => o.value === interval)?.label ?? ""
  }`;

  return (
    <View
      className="mx-5 mb-3 bg-white rounded-2xl overflow-hidden"
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Pressable
        className="px-4 py-3.5 flex-row items-center justify-between active:bg-gray-50"
        onPress={() => setExpanded(!expanded)}
      >
        <View className="flex-row items-center flex-1 mr-2">
          <View className="w-9 h-9 rounded-xl bg-emerald-100 items-center justify-center mr-3">
            <Feather name="bell" size={18} color="#059669" />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-bold text-gray-900">
              Xasuusin yoolalka
            </Text>
            <Text className="text-xs text-gray-500 mt-0.5" numberOfLines={1}>
              {currentLabel}
            </Text>
          </View>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color="#9ca3af"
        />
      </Pressable>

      {expanded && (
        <View className="px-4 pb-4 border-t border-gray-100 pt-3">
          <Text className="text-xs font-semibold text-gray-500 mb-2">
            Maalinta
          </Text>
          <View className="flex-row flex-wrap gap-1.5 mb-3">
            {DAY_LABELS.map((label, i) => (
              <Pressable
                key={i}
                onPress={() => save(i, time, interval)}
                className={`px-3 py-1.5 rounded-lg ${
                  day === i
                    ? "bg-emerald-600"
                    : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    day === i ? "text-white" : "text-gray-600"
                  }`}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text className="text-xs font-semibold text-gray-500 mb-2">
            Waqtiga
          </Text>
          <View className="flex-row flex-wrap gap-1.5 mb-3">
            {["07:00", "08:00", "12:00", "17:00", "19:00", "20:00"].map(
              (t) => (
                <Pressable
                  key={t}
                  onPress={() => save(day, t, interval)}
                  className={`px-3 py-1.5 rounded-lg ${
                    time === t ? "bg-emerald-600" : "bg-gray-100"
                  }`}
                >
                  <Text
                    className={`text-xs font-semibold ${
                      time === t ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {formatTimeLabel(t)}
                  </Text>
                </Pressable>
              )
            )}
          </View>

          <Text className="text-xs font-semibold text-gray-500 mb-2">
            Inta jeer
          </Text>
          <View className="flex-row gap-2">
            {INTERVAL_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => save(day, time, opt.value)}
                className={`flex-1 py-2 rounded-lg items-center ${
                  interval === opt.value
                    ? "bg-emerald-600"
                    : "bg-gray-100"
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    interval === opt.value
                      ? "text-white"
                      : "text-gray-600"
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

export default function Yoolalka() {
  const { session } = useAuth();
  const { goals, loading, addGoal, deleteGoal } = useGoals(session?.user.id);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#059669" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <View className="px-5 pt-4 pb-2">
        <Text className="text-3xl font-extrabold text-gray-900">Yoolalka</Text>
        <Text className="text-sm text-gray-500 mt-1">{goals.length} yool</Text>
      </View>

      <FlatList
        data={goals}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <GoalCard goal={item} index={index} onDelete={deleteGoal} />
        )}
        contentContainerStyle={{ paddingBottom: 100, paddingTop: 8 }}
        ListHeaderComponent={<GoalReminderCard />}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Feather name="target" size={48} color="#d1d5db" />
            <Text className="text-gray-400 text-base mt-4">
              Weli yool ma lihid
            </Text>
            <Text className="text-gray-300 text-sm mt-1">
              Ku dar yoolkaaga koowaad
            </Text>
          </View>
        }
      />

      <FloatingActionButton onPress={() => setSheetOpen(true)} />
      <AddGoalSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={addGoal}
      />
    </SafeAreaView>
  );
}
