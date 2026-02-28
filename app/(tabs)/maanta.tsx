import { useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import { useTasks } from "../../hooks/useTasks";
import { useGoals } from "../../hooks/useGoals";
import MaantaTaskCard from "../../components/MaantaTaskCard";
import FloatingActionButton from "../../components/FloatingActionButton";
import AddTaskSheet from "../../components/AddTaskSheet";
import type { Task } from "../../services/types";
import { getTodayDateString } from "../../services/dateUtils";

const PRIORITY_ORDER: Record<string, number> = { Sare: 0, Dhexe: 1, Hoose: 2 };

type FilterType = "maanta" | "la-dhaafay" | "sare" | "dhexe" | "hoose";

const FILTER_LABELS: Record<FilterType, string> = {
  maanta: "Maanta",
  "la-dhaafay": "La dhaafay",
  sare: "Sare",
  dhexe: "Dhexe",
  hoose: "Hoose",
};

export default function Maanta() {
  const router = useRouter();
  const { session } = useAuth();
  const { tasks: allTasks, loading, completeTask, deleteTask, addTask } = useTasks();
  const { goals } = useGoals(session?.user.id);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>("maanta");

  const todayStr = getTodayDateString();

  const todayTasks = useMemo(() => {
    const active = allTasks.filter((t) => t.status !== "done");
    const byPriority = (a: Task, b: Task) =>
      (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
    const overdue = active
      .filter((t) => t.due_date && t.due_date < todayStr)
      .sort(byPriority);
    const today = active
      .filter((t) => t.due_date === todayStr)
      .sort(byPriority);
    const base = [...overdue, ...today];

    if (filter === "la-dhaafay") return overdue;
    if (filter === "sare") return base.filter((t) => t.priority === "Sare");
    if (filter === "dhexe") return base.filter((t) => t.priority === "Dhexe");
    if (filter === "hoose") return base.filter((t) => t.priority === "Hoose");
    return base;
  }, [allTasks, todayStr, filter]);

  const handleDelete = (id: string, title: string) => {
    Alert.alert(
      "Tirtir hawsha",
      `Ma hubtaa inaad tirtirto "${title}"?`,
      [
        { text: "Maya", style: "cancel" },
        { text: "Tirtir", style: "destructive", onPress: () => deleteTask(id) },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center"
        style={{ backgroundColor: "#faf5ff" }}
        edges={["top"]}
      >
        <ActivityIndicator size="large" color="#8b5cf6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: "#faf5ff" }}
      edges={["top"]}
    >
      {/* Header with gradient feel */}
      <View
        style={{
          backgroundColor: "#fdf2f8",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 16,
          borderBottomLeftRadius: 24,
          borderBottomRightRadius: 24,
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 24,
                fontWeight: "700",
                color: "#1f2937",
                letterSpacing: -0.5,
              }}
            >
              Your Beautiful Progress 🌷
            </Text>
            <Text
              style={{
                fontSize: 14,
                color: "#6b7280",
                marginTop: 4,
              }}
            >
              What will you do today?
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255,255,255,0.8)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="bell" size={22} color="#6b7280" />
            </Pressable>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#e9d5ff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#7c3aed" }}>
                {session?.user?.email?.[0]?.toUpperCase() ?? "?"}
              </Text>
            </View>
          </View>
        </View>

        {/* Filter: single pill */}
        <Pressable
          onPress={() => setFilterOpen(true)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            alignSelf: "flex-start",
            marginTop: 16,
            paddingHorizontal: 18,
            paddingVertical: 10,
            backgroundColor: "rgba(255,255,255,0.9)",
            borderRadius: 20,
            gap: 6,
            borderWidth: 1,
            borderColor: "rgba(0,0,0,0.06)",
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151" }}>
            {FILTER_LABELS[filter]}
          </Text>
          <Feather name="chevron-down" size={18} color="#6b7280" />
        </Pressable>
      </View>

      <FlatList
        data={todayTasks}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <MaantaTaskCard
            task={item}
            onComplete={completeTask}
            onDelete={(id) => handleDelete(id, item.title)}
            onPress={(id) => router.push(`/task/${id}`)}
            index={index}
            isFirst={index === 0}
            isLast={index === todayTasks.length - 1}
          />
        )}
        contentContainerStyle={{ paddingBottom: 140, paddingTop: 20 }}
        ListEmptyComponent={
          <View className="items-center justify-center py-20 px-6">
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: "#f5f3ff",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
              }}
            >
              <Feather name="sun" size={44} color="#8b5cf6" />
            </View>
            <Text
              style={{
                fontSize: 20,
                fontWeight: "700",
                color: "#1f2937",
                textAlign: "center",
              }}
            >
              Hawl maanta ah ma jirto
            </Text>
            <Text
              style={{
                fontSize: 15,
                color: "#6b7280",
                textAlign: "center",
                marginTop: 8,
                lineHeight: 22,
              }}
            >
              Taabo + si aad ugu dartid hawsha maanta
            </Text>
          </View>
        }
      />

      <FloatingActionButton onPress={() => setSheetOpen(true)} />

      {/* Filter modal */}
      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          onPress={() => setFilterOpen(false)}
        >
          <Pressable
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 20,
              paddingBottom: 40,
              paddingHorizontal: 20,
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#1f2937",
                marginBottom: 16,
              }}
            >
              Dooro filter
            </Text>
            <ScrollView>
              {(Object.keys(FILTER_LABELS) as FilterType[]).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => {
                    setFilter(key);
                    setFilterOpen(false);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 14,
                    paddingHorizontal: 16,
                    borderRadius: 14,
                    backgroundColor: filter === key ? "#f5f3ff" : "transparent",
                    marginBottom: 4,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 16,
                      fontWeight: filter === key ? "600" : "500",
                      color: filter === key ? "#6d28d9" : "#374151",
                    }}
                  >
                    {FILTER_LABELS[key]}
                  </Text>
                  {filter === key && (
                    <Feather name="check" size={20} color="#6d28d9" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <AddTaskSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onAdd={addTask}
        goals={goals}
        showGoal={false}
      />
    </SafeAreaView>
  );
}
