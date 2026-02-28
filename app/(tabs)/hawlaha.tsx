import { useMemo, useState } from "react";
import {
  View,
  Text,
  SectionList,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useAuth } from "../../hooks/useAuth";
import { useTasks } from "../../hooks/useTasks";
import { useGoals } from "../../hooks/useGoals";
import TaskCard from "../../components/TaskCard";
import FloatingActionButton from "../../components/FloatingActionButton";
import AddTaskSheet from "../../components/AddTaskSheet";
import type { Task } from "../../services/types";
import { getTodayDateString } from "../../services/dateUtils";

const PRIORITY_ORDER: Record<string, number> = { Sare: 0, Dhexe: 1, Hoose: 2 };

export default function Hawlaha() {
  const router = useRouter();
  const { session } = useAuth();
  const { tasks, loading, completeTask, deleteTask, addTask } = useTasks();
  const { goals } = useGoals(session?.user.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const todayStr = getTodayDateString();
  const byPriority = (a: Task, b: Task) =>
    (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);

  const { sections, overdueCount, todayCount, upcomingCount, completedCount } =
    useMemo(() => {
      const active = tasks.filter((t) => t.status !== "done");
      const completed = tasks.filter((t) => t.status === "done");

      const overdue = active
        .filter((t) => t.due_date && t.due_date < todayStr)
        .sort(byPriority);
      const today = active
        .filter((t) => t.due_date === todayStr)
        .sort(byPriority);
      const upcoming = active
        .filter((t) => !t.due_date || t.due_date > todayStr)
        .sort(byPriority);

      const result: { title: string; data: Task[]; key: string }[] = [];
      if (overdue.length > 0)
        result.push({ title: "La dhaafay", data: overdue, key: "overdue" });
      if (today.length > 0)
        result.push({
          title: "Due maanta",
          data: today,
          key: "today",
        });
      if (upcoming.length > 0)
        result.push({ title: "Soo socda", data: upcoming, key: "upcoming" });
      if (completed.length > 0 && showCompleted)
        result.push({
          title: "La dhammeeyay",
          data: completed,
          key: "completed",
        });

      return {
        sections: result,
        overdueCount: overdue.length,
        todayCount: today.length,
        upcomingCount: upcoming.length,
        completedCount: completed.length,
      };
    }, [tasks, todayStr, showCompleted]);

  const handleDelete = (id: string, title: string) => {
    Alert.alert("Tirtir hawsha", `Ma hubtaa inaad tirtirto "${title}"?`, [
      { text: "Maya", style: "cancel" },
      { text: "Tirtir", style: "destructive", onPress: () => deleteTask(id) },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#059669" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <Animated.View
        entering={FadeInDown.duration(400).springify()}
        className="px-5 pt-4 pb-3"
      >
        <Text className="text-3xl font-extrabold text-gray-900">
          Hawlaha
        </Text>
        <Text className="text-sm text-gray-500 mt-1">
          Dhammaan hawlahaaga – la dhaafay, maanta, iyo soo socda
        </Text>

        {tasks.length > 0 && (
          <View className="flex-row flex-wrap gap-2 mt-4">
            {overdueCount > 0 && (
              <View className="flex-row items-center bg-red-50 rounded-xl px-3 py-2">
                <Feather name="alert-circle" size={14} color="#ef4444" />
                <Text className="text-red-700 text-sm font-semibold ml-1.5">
                  {overdueCount} la dhaafay
                </Text>
              </View>
            )}
            {todayCount > 0 && (
              <View className="flex-row items-center bg-amber-50 rounded-xl px-3 py-2">
                <Feather name="sun" size={14} color="#d97706" />
                <Text className="text-amber-800 text-sm font-semibold ml-1.5">
                  {todayCount} maanta
                </Text>
              </View>
            )}
            {upcomingCount > 0 && (
              <View className="flex-row items-center bg-emerald-50 rounded-xl px-3 py-2">
                <Feather name="calendar" size={14} color="#059669" />
                <Text className="text-emerald-800 text-sm font-semibold ml-1.5">
                  {upcomingCount} soo socda
                </Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section }) => (
          <View className="px-5 pt-5 pb-2 bg-gray-50">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-2">
                {section.key === "overdue" && (
                  <Feather name="alert-circle" size={16} color="#ef4444" />
                )}
                {section.key === "today" && (
                  <Feather name="sun" size={16} color="#d97706" />
                )}
                {section.key === "upcoming" && (
                  <Feather name="calendar" size={16} color="#059669" />
                )}
                {section.key === "completed" && (
                  <Feather name="check-circle" size={16} color="#059669" />
                )}
                <Text
                  className="text-base font-bold text-gray-700"
                  style={{
                    color:
                      section.key === "overdue"
                        ? "#b91c1c"
                        : section.key === "today"
                          ? "#b45309"
                          : "#374151",
                  }}
                >
                  {section.title}
                </Text>
              </View>
              <Text className="text-sm text-gray-400 font-medium">
                {section.data.length} hawl
              </Text>
            </View>
          </View>
        )}
        renderItem={({ item, index }) => (
          <TaskCard
            task={item}
            onComplete={completeTask}
            onDelete={(id) => handleDelete(id, item.title)}
            onPress={(id) => router.push(`/task/${id}`)}
            index={index}
          />
        )}
        contentContainerStyle={{ paddingBottom: 140 }}
        ListFooterComponent={
          completedCount > 0 ? (
            <Pressable
              className="mx-5 mt-4 mb-2 py-4 items-center rounded-2xl border-2 border-dashed border-gray-200 active:bg-gray-100"
              onPress={() => setShowCompleted(!showCompleted)}
            >
              <Feather name="check-square" size={20} color="#6b7280" />
              <Text className="text-sm font-semibold text-gray-600 mt-1.5">
                {showCompleted
                  ? "Qari la dhammeeyay"
                  : `Tus ${completedCount} hawl oo la dhammeeyay`}
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          <View className="items-center justify-center py-20 px-6">
            <View className="w-20 h-20 rounded-full bg-gray-100 items-center justify-center mb-4">
              <Feather name="list" size={40} color="#9ca3af" />
            </View>
            <Text className="text-gray-700 text-lg font-semibold text-center">
              Weli hawl ma lihid
            </Text>
            <Text className="text-gray-500 text-sm text-center mt-2 leading-5">
              Ku dar hawsha koowaad si aad u abaabulato maalintaada
            </Text>
          </View>
        }
      />

      <FloatingActionButton onPress={() => setSheetOpen(true)} />
      <AddTaskSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={addTask}
        goals={goals}
      />
    </SafeAreaView>
  );
}
