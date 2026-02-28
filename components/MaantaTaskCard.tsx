import React, { useState, useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import type { Task } from "../services/types";
import { PRIORITY_COLORS } from "../services/theme";

const CARD_HEIGHT = 78;
const TIMELINE_LEFT = 24;
const DOT_SIZE = 14;
const CARD_LEFT_MARGIN = 44;

interface MaantaTaskCardProps {
  task: Task;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onPress?: (id: string) => void;
  index: number;
  isFirst?: boolean;
  isLast?: boolean;
}

function isOverdue(task: Task): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (!task.due_date || task.due_date > today) return false;
  if (task.due_date < today) return true;
  if (!task.due_time) return false;
  const [h, m] = task.due_time.split(":").map(Number);
  const due = new Date();
  due.setHours(h, m, 0, 0);
  return new Date() > due;
}

export default function MaantaTaskCard({
  task,
  onComplete,
  onDelete,
  onPress,
  index,
  isFirst = false,
  isLast = false,
}: MaantaTaskCardProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const dotColor = isOverdue(task)
    ? "#dc2626"
    : (PRIORITY_COLORS[task.priority] ?? "#8b5cf6");
  const isOverdueTask = isOverdue(task);

  const dotCenterY = CARD_HEIGHT / 2;
  const lineWidth = 2;
  const lineLeft = TIMELINE_LEFT / 2 - lineWidth / 2;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 45).duration(260).springify().damping(18)}
      style={{ marginBottom: 10, paddingLeft: 20, paddingRight: 16 }}
    >
      <View style={{ flexDirection: "row", alignItems: "stretch", minHeight: CARD_HEIGHT }}>
        {/* Timeline: line segments + glowing dot */}
        <View
          style={{
            width: TIMELINE_LEFT + DOT_SIZE,
            position: "absolute",
            left: 0,
            top: 0,
            height: CARD_HEIGHT,
          }}
        >
          {!isFirst && (
            <View
              style={{
                position: "absolute",
                left: lineLeft,
                top: 0,
                width: lineWidth,
                height: dotCenterY,
                backgroundColor: "#e9d5ff",
                borderRadius: 1,
              }}
            />
          )}
          {!isLast && (
            <View
              style={{
                position: "absolute",
                left: lineLeft,
                top: dotCenterY,
                width: lineWidth,
                height: CARD_HEIGHT - dotCenterY,
                backgroundColor: "#e9d5ff",
                borderRadius: 1,
              }}
            />
          )}
          <View
            style={{
              width: DOT_SIZE,
              height: DOT_SIZE,
              borderRadius: DOT_SIZE / 2,
              backgroundColor: dotColor,
              position: "absolute",
              left: TIMELINE_LEFT / 2 - DOT_SIZE / 2,
              top: dotCenterY - DOT_SIZE / 2,
              shadowColor: dotColor,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 6,
              elevation: 4,
            }}
          />
        </View>

        {/* Compact card */}
        <Pressable
          onPress={() => onPress?.(task.id)}
          style={{
            flex: 1,
            marginLeft: CARD_LEFT_MARGIN,
            backgroundColor: isOverdueTask ? "#fef2f2" : "rgba(255,255,255,0.95)",
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            minHeight: CARD_HEIGHT,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.06,
            shadowRadius: 12,
            elevation: 3,
          }}
        >
          {/* Left: small icon */}
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              backgroundColor: dotColor + "22",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 12,
            }}
          >
            <Feather name="check-square" size={18} color={dotColor} />
          </View>

          {/* Center: title + meta row */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              style={{
                fontSize: 16,
                fontWeight: "600",
                color: "#111827",
              }}
            >
              {task.title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4, gap: 8, flexWrap: "wrap" }}>
              {task.due_time && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="clock" size={12} color="#6b7280" />
                  <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "500" }}>
                    {task.due_time}
                  </Text>
                </View>
              )}
              {isOverdueTask && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="alert-circle" size={12} color="#dc2626" />
                  <Text style={{ fontSize: 11, color: "#dc2626", fontWeight: "600" }}>
                    La dhaafay
                  </Text>
                </View>
              )}
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 6,
                  backgroundColor: dotColor + "20",
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: "700", color: dotColor }}>
                  {task.priority}
                </Text>
              </View>
            </View>
          </View>

          {/* Right: complete circle + trash */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Pressable
              onPress={() => onComplete(task.id)}
              hitSlop={8}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "#10b981",
                alignItems: "center",
                justifyContent: "center",
                shadowColor: "#10b981",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.35,
                shadowRadius: 4,
                elevation: 2,
              }}
            >
              <Feather name="check" size={20} color="#fff" />
            </Pressable>
            <Pressable
              onPress={() => onDelete(task.id)}
              hitSlop={8}
              style={{ padding: 4 }}
            >
              <Feather name="trash-2" size={18} color="#9ca3af" />
            </Pressable>
          </View>
        </Pressable>
      </View>
    </Animated.View>
  );
}
