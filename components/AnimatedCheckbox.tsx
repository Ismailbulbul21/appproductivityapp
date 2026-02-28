import React, { useEffect } from "react";
import { Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

interface AnimatedCheckboxProps {
  checked: boolean;
  onToggle: () => void;
}

export default function AnimatedCheckbox({
  checked,
  onToggle,
}: AnimatedCheckboxProps) {
  const scale = useSharedValue(checked ? 1 : 0);
  const fillOpacity = useSharedValue(checked ? 1 : 0);

  useEffect(() => {
    scale.value = withTiming(checked ? 1 : 0, { duration: 200 });
    fillOpacity.value = withTiming(checked ? 1 : 0, { duration: 200 });
  }, [checked]);

  const fillStyle = useAnimatedStyle(() => ({
    opacity: fillOpacity.value,
    transform: [{ scale: 0.5 + scale.value * 0.5 }],
  }));

  return (
    <Pressable
      onPress={onToggle}
      style={{
        width: 28,
        height: 28,
        borderRadius: 14,
        borderWidth: 2,
        borderColor: checked ? "#059669" : "#d1d5db",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: checked ? "#059669" : "transparent",
      }}
    >
      <Animated.View style={fillStyle}>
        {checked && <Feather name="check" size={16} color="#fff" />}
      </Animated.View>
    </Pressable>
  );
}
