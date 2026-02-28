import React from "react";
import { View, Text, Pressable, Dimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { Task } from "../services/types";
import { PRIORITY_COLORS } from "../services/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = 80;
const ACTION_WIDTH = 100;

const springConfig = { damping: 20, stiffness: 200 };

interface SwipeableTaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onPress: (id: string) => void;
  index: number;
}

const PRIORITY_ICONS: Record<string, string> = {
  Sare: "arrow-up-circle",
  Dhexe: "minus-circle",
  Hoose: "arrow-down-circle",
};

export default function SwipeableTaskCard({
  task,
  onComplete,
  onDelete,
  onPress,
  index,
}: SwipeableTaskCardProps) {
  const translateX = useSharedValue(0);
  const isDone = task.status === "done";
  const barColor = PRIORITY_COLORS[task.priority] ?? "#6b7280";
  const iconName = PRIORITY_ICONS[task.priority] ?? "circle";

  const triggerComplete = () => onComplete(task.id);
  const triggerDelete = () => onDelete(task.id);

  const panGesture = Gesture.Pan()
    .enabled(!isDone)
    .onUpdate((e) => {
      const maxRight = ACTION_WIDTH;
      const maxLeft = -ACTION_WIDTH;
      const next = e.translationX;
      if (next > 0) {
        translateX.value = Math.min(next, maxRight);
      } else {
        translateX.value = Math.max(next, maxLeft);
      }
    })
    .onEnd((e) => {
      const goRight = translateX.value > SWIPE_THRESHOLD || e.velocityX > 200;
      const goLeft = translateX.value < -SWIPE_THRESHOLD || e.velocityX < -200;
      if (goRight) {
        translateX.value = withSpring(SCREEN_WIDTH, springConfig, () => {
          runOnJS(triggerComplete)();
        });
        return;
      }
      if (goLeft) {
        translateX.value = withSpring(-SCREEN_WIDTH, springConfig, () => {
          runOnJS(triggerDelete)();
        });
        return;
      }
      translateX.value = withSpring(0, springConfig);
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const leftActionStyle = useAnimatedStyle(() => {
    const opacity = translateX.value < 0 ? 1 : 0;
    return { opacity: withTiming(opacity, { duration: 150 }) };
  });

  const rightActionStyle = useAnimatedStyle(() => {
    const opacity = translateX.value > 0 ? 1 : 0;
    return { opacity: withTiming(opacity, { duration: 150 }) };
  });

  return (
    <View className="mb-5 mx-4 overflow-visible">
      <View className="absolute inset-0 flex-row">
        <Animated.View
          style={[leftActionStyle, { width: ACTION_WIDTH, justifyContent: "center", alignItems: "center", backgroundColor: "#ecfdf5", borderTopLeftRadius: 24, borderBottomLeftRadius: 24 }]}
        >
          <Feather name="check" size={28} color="#059669" />
          <Text className="text-xs font-bold text-emerald-700 mt-1">Dhammeey</Text>
        </Animated.View>
        <View style={{ flex: 1 }} />
        <Animated.View
          style={[rightActionStyle, { width: ACTION_WIDTH, justifyContent: "center", alignItems: "center", backgroundColor: "#fef2f2", borderTopRightRadius: 24, borderBottomRightRadius: 24 }]}
        >
          <Feather name="trash-2" size={28} color="#ef4444" />
          <Text className="text-xs font-bold text-red-600 mt-1">Tirtir</Text>
        </Animated.View>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View
          style={[
            cardStyle,
            {
              backgroundColor: "#fff",
              borderRadius: 24,
              minHeight: 100,
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.08,
              shadowRadius: 12,
              elevation: 4,
              overflow: "hidden",
            },
          ]}
        >
          <View style={{ width: 6, backgroundColor: barColor, position: "absolute", left: 0, top: 0, bottom: 0 }} />
          <Pressable
            className="flex-1 py-6 px-6 pl-7"
            onPress={() => {
              if (Math.abs(translateX.value) < 10) onPress(task.id);
            }}
            style={isDone ? { opacity: 0.6 } : undefined}
          >
            <View className="flex-row items-start justify-between gap-3">
              <View className="flex-1 flex-row items-center gap-3">
                {!isDone && (
                  <View
                    className="w-10 h-10 rounded-xl items-center justify-center"
                    style={{ backgroundColor: barColor + "22" }}
                  >
                    <Feather name={iconName as any} size={20} color={barColor} />
                  </View>
                )}
                <View className="flex-1">
                  <Text
                    className="text-xl font-bold text-gray-900"
                    style={isDone ? { textDecorationLine: "line-through" } : undefined}
                    numberOfLines={2}
                  >
                    {task.title}
                  </Text>
                  <View className="flex-row items-center mt-2 gap-4 flex-wrap">
                    {task.due_date && (
                      <View className="flex-row items-center gap-1.5">
                        <Feather name="calendar" size={16} color="#64748b" />
                        <Text className="text-sm text-gray-500">{task.due_date}</Text>
                      </View>
                    )}
                    {task.due_time && (
                      <View className="flex-row items-center gap-1.5">
                        <Feather name="clock" size={16} color="#64748b" />
                        <Text className="text-sm text-gray-500">{task.due_time}</Text>
                      </View>
                    )}
                    {isDone && (
                      <View className="flex-row items-center gap-1.5">
                        <Feather name="check-circle" size={16} color="#059669" />
                        <Text className="text-sm text-emerald-600 font-semibold">Dhammaystay</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
              <View
                className="px-3 py-1.5 rounded-xl"
                style={{ backgroundColor: barColor + "18" }}
              >
                <Text style={{ color: barColor, fontSize: 13, fontWeight: "700" }}>
                  {task.priority}
                </Text>
              </View>
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
