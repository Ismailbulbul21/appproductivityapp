import { Pressable, Text, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Higher on Android so the "Hawl" button stays above the bottom tab bar and fully visible
const FAB_BOTTOM = Platform.OS === "android" ? 120 : 100;

interface FloatingActionButtonProps {
  onPress: () => void;
}

export default function FloatingActionButton({ onPress }: FloatingActionButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[
        animatedStyle,
        {
          position: "absolute",
          bottom: FAB_BOTTOM,
          left: 20,
          right: 20,
          height: 52,
          borderRadius: 26,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          backgroundColor: "#8b5cf6",
          shadowColor: "#8b5cf6",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 8,
        },
      ]}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 15 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
    >
      <Feather name="plus" size={22} color="#fff" />
      <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
        Hawl
      </Text>
    </AnimatedPressable>
  );
}
