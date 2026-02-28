import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  Easing,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { Task } from "../services/types";
import { PRIORITY_COLORS } from "../services/theme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface TaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onPress: (id: string) => void;
  index: number;
}

export default function TaskCard({
  task,
  onComplete,
  onDelete,
  onPress,
  index,
}: TaskCardProps) {
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(1);
  const checkScale = useSharedValue(1);
  const deleteScale = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      index * 60,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) })
    );
    opacity.value = withDelay(index * 60, withTiming(1, { duration: 350 }));
  }, [index]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const isDone = task.status === "done";
  const barColor = PRIORITY_COLORS[task.priority] ?? "#6b7280";

  return (
    <Animated.View style={containerStyle} className="mb-4 mx-4">
      <View
        className="flex-row bg-white rounded-2xl overflow-hidden"
        style={{
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <View style={{ width: 5, backgroundColor: barColor }} />
        <Pressable
          className="flex-1 py-5 px-5"
          onPress={() => onPress(task.id)}
          style={isDone ? { opacity: 0.5 } : undefined}
        >
          <View className="flex-row items-start justify-between gap-3">
            <Text
              className="text-lg font-bold text-gray-900 flex-1"
              style={isDone ? { textDecorationLine: "line-through" } : undefined}
              numberOfLines={2}
            >
              {task.title}
            </Text>
            <View
              className="px-2.5 py-1 rounded-full"
              style={{ backgroundColor: barColor + "22" }}
            >
              <Text style={{ color: barColor, fontSize: 12, fontWeight: "700" }}>
                {task.priority}
              </Text>
            </View>
          </View>

          <View className="flex-row items-center mt-3 gap-4 flex-wrap">
            {task.due_date && (
              <View className="flex-row items-center gap-1.5">
                <Feather name="calendar" size={14} color="#64748b" />
                <Text className="text-sm text-gray-500">{task.due_date}</Text>
              </View>
            )}
            {task.due_time && (
              <View className="flex-row items-center gap-1.5">
                <Feather name="clock" size={14} color="#64748b" />
                <Text className="text-sm text-gray-500">{task.due_time}</Text>
              </View>
            )}
            {isDone && (
              <View className="flex-row items-center gap-1.5">
                <Feather name="check-circle" size={14} color="#059669" />
                <Text className="text-sm text-emerald-600 font-semibold">Dhammaystay</Text>
              </View>
            )}
          </View>
        </Pressable>

        <View className="flex-row items-center pr-3 gap-1">
          {!isDone && (
            <Pressable
              className="w-11 h-11 rounded-full bg-emerald-100 items-center justify-center active:bg-emerald-200"
              onPress={() => onComplete(task.id)}
            >
              <Feather name="check" size={22} color="#059669" />
            </Pressable>
          )}
          <Pressable
            className="w-11 h-11 rounded-full bg-red-50 items-center justify-center active:bg-red-100"
            onPress={() => onDelete(task.id)}
          >
            <Feather name="trash-2" size={18} color="#ef4444" />
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}
