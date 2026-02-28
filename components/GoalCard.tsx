import React, { useEffect } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { GoalWithProgress } from "../hooks/useGoals";

interface GoalCardProps {
  goal: GoalWithProgress;
  index: number;
  onDelete?: (goalId: string) => void;
}

function getTypeIcon(type: string): string {
  return type === "Sanad" ? "award" : "calendar";
}

export default function GoalCard({ goal, index, onDelete }: GoalCardProps) {
  const handleDelete = () => {
    Alert.alert(
      "Tirtir Yool",
      "Ma hubtaa inaad tirtirayso yoolkan? Hawlaha ku xiran waa la sii hayaa.",
      [
        { text: "Maya", style: "cancel" },
        {
          text: "Tirtir",
          style: "destructive",
          onPress: () => onDelete?.(goal.id),
        },
      ]
    );
  };
  const translateY = useSharedValue(15);
  const opacity = useSharedValue(0);
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    translateY.value = withDelay(
      index * 80,
      withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) })
    );
    opacity.value = withDelay(index * 80, withTiming(1, { duration: 300 }));
    progressWidth.value = withDelay(
      index * 80 + 200,
      withTiming(Math.min(goal.progress, 100), { duration: 500 })
    );
  }, [goal.progress]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const barFillStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%` as unknown as number,
  }));

  const pct = Math.round(goal.progress);

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          backgroundColor: "#fff",
          borderRadius: 20,
          padding: 16,
          marginHorizontal: 20,
          marginBottom: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 3,
        },
      ]}
    >
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-base font-bold text-gray-900 flex-1 mr-2" numberOfLines={1}>
          {goal.title}
        </Text>
        <View className="flex-row items-center gap-2">
          <View
            className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl"
            style={{ backgroundColor: "#ecfdf5" }}
          >
            <Feather
              name={getTypeIcon(goal.type) as any}
              size={14}
              color="#059669"
            />
            <Text className="text-xs font-bold text-emerald-700" numberOfLines={1}>
              {goal.type}
            </Text>
          </View>
          {onDelete && (
            <Pressable
              onPress={handleDelete}
              className="w-9 h-9 items-center justify-center rounded-full bg-red-50 active:bg-red-100"
              accessibilityLabel="Tirtir yool"
            >
              <Feather name="trash-2" size={18} color="#ef4444" />
            </Pressable>
          )}
        </View>
      </View>

      <View className="mb-3">
        <View
          className="rounded-full overflow-hidden"
          style={{ height: 8, backgroundColor: "#e2e8f0" }}
        >
          <Animated.View
            style={[barFillStyle, { height: 8, backgroundColor: "#059669", borderRadius: 999 }]}
            className="rounded-full"
          />
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-gray-800">{pct}%</Text>
        <View className="flex-row items-center gap-1.5">
          <Feather name="clock" size={14} color="#64748b" />
          <Text className="text-xs font-medium text-gray-500">
            {goal.daysRemaining} {goal.daysRemaining === 1 ? "maal" : "maalmood"}
          </Text>
        </View>
        <Text className="text-xs font-medium text-gray-500">
          {goal.completedTasks}/{goal.totalTasks} hawl
        </Text>
      </View>
    </Animated.View>
  );
}
