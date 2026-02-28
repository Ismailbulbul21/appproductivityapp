import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../hooks/useAuth";
import { useTasks } from "../../hooks/useTasks";
import { PRIORITY_COLORS } from "../../services/theme";
import type { Task } from "../../services/types";

export default function TaskDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { completeTask, deleteTask, updateTask } = useTasks();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase.from("tasks").select("*").eq("id", id).single();
      setTask(data);
      setEditTitle(data?.title ?? "");
      setLoading(false);
    })();
  }, [id]);

  const handleComplete = async () => {
    if (!task) return;
    await completeTask(task.id);
    router.back();
  };

  const handleDelete = () => {
    Alert.alert("Tirtir Hawsha", "Ma hubtaa inaad tirtirayso hawshan?", [
      { text: "Maya", style: "cancel" },
      {
        text: "Haa, Tirtir",
        style: "destructive",
        onPress: async () => {
          if (!task) return;
          await deleteTask(task.id);
          router.back();
        },
      },
    ]);
  };

  const handleSaveEdit = async () => {
    if (!task || !editTitle.trim()) return;
    setSaving(true);
    try {
      await updateTask(task.id, { title: editTitle.trim() });
      setTask({ ...task, title: editTitle.trim() });
      setEditing(false);
    } catch {
      Alert.alert("Khalad", "Ma suurtogalin in la keydiyo.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#059669" />
      </SafeAreaView>
    );
  }

  if (!task) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-400 text-base">Hawsha lama helin</Text>
        <Pressable className="mt-4" onPress={() => router.back()}>
          <Text className="text-emerald-600 font-bold">Dib u noqo</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const barColor = PRIORITY_COLORS[task.priority] ?? "#6b7280";
  const isDone = task.status === "done";

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 pt-2 pb-4">
        <Pressable
          className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={22} color="#374151" />
        </Pressable>
        <View className="flex-1" />
        {!isDone && (
          <Pressable
            className="w-10 h-10 items-center justify-center rounded-full bg-gray-100 active:bg-gray-200"
            onPress={() => setEditing(!editing)}
          >
            <Feather name={editing ? "x" : "edit-2"} size={18} color="#374151" />
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 120 }}>
        <View
          className="rounded-full px-3 py-1 self-start mb-4"
          style={{ backgroundColor: barColor + "1A" }}
        >
          <Text style={{ color: barColor, fontSize: 13, fontWeight: "700" }}>
            {task.priority}
          </Text>
        </View>

        {editing ? (
          <TextInput
            className="text-2xl font-extrabold text-gray-900 mb-4 border-b-2 border-emerald-500 pb-2"
            value={editTitle}
            onChangeText={setEditTitle}
            autoFocus
          />
        ) : (
          <Text
            className="text-2xl font-extrabold text-gray-900 mb-4"
            style={isDone ? { textDecorationLine: "line-through", opacity: 0.5 } : undefined}
          >
            {task.title}
          </Text>
        )}

        <View className="gap-4">
          {task.due_date && (
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center mr-3">
                <Feather name="calendar" size={18} color="#6b7280" />
              </View>
              <View>
                <Text className="text-xs text-gray-400">Taariikhda</Text>
                <Text className="text-base font-semibold text-gray-800">
                  {task.due_date}
                </Text>
              </View>
            </View>
          )}

          {task.due_time && (
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-gray-100 items-center justify-center mr-3">
                <Feather name="clock" size={18} color="#6b7280" />
              </View>
              <View>
                <Text className="text-xs text-gray-400">Waqtiga</Text>
                <Text className="text-base font-semibold text-gray-800">
                  {task.due_time}
                </Text>
              </View>
            </View>
          )}

          {task.goal_id && (
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center mr-3">
                <Feather name="target" size={18} color="#059669" />
              </View>
              <View>
                <Text className="text-xs text-gray-400">Yoolka</Text>
                <View className="bg-emerald-100 px-3 py-1 rounded-full mt-0.5">
                  <Text className="text-sm font-semibold text-emerald-700">
                    {task.goal_id}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {isDone && task.completed_at && (
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center mr-3">
                <Feather name="check-circle" size={18} color="#059669" />
              </View>
              <View>
                <Text className="text-xs text-gray-400">La dhammeeyay</Text>
                <Text className="text-base font-semibold text-emerald-700">
                  {task.completed_at.split("T")[0]}
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4 bg-white border-t border-gray-100">
        {editing ? (
          <Pressable
            className="bg-emerald-600 rounded-2xl py-4 items-center active:bg-emerald-700"
            onPress={handleSaveEdit}
            disabled={saving}
          >
            <Text className="text-white text-base font-bold">
              {saving ? "Kaydinaya..." : "Kaydi"}
            </Text>
          </Pressable>
        ) : isDone ? (
          <Pressable
            className="bg-red-50 rounded-2xl py-4 items-center active:bg-red-100"
            onPress={handleDelete}
          >
            <Text className="text-red-500 text-base font-bold">Tirtir</Text>
          </Pressable>
        ) : (
          <View className="flex-row gap-3">
            <Pressable
              className="flex-1 bg-emerald-600 rounded-2xl py-4 items-center active:bg-emerald-700"
              onPress={handleComplete}
            >
              <Text className="text-white text-base font-bold">Dhammeey</Text>
            </Pressable>
            <Pressable
              className="bg-red-50 rounded-2xl py-4 px-6 items-center active:bg-red-100"
              onPress={handleDelete}
            >
              <Feather name="trash-2" size={20} color="#ef4444" />
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
