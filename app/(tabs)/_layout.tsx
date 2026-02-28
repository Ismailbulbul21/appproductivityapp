import { Tabs, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { Platform, View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { useSubscription } from "../../hooks/useSubscription";
import { useEffect } from "react";

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, loading: authLoading } = useAuth();
  const userId = session?.user?.id;
  const { isActive, loading: subLoading } = useSubscription(userId);

  useEffect(() => {
    if (!authLoading && !subLoading) {
      if (!session) {
        router.replace("/onboarding/");
      } else if (!isActive) {
        router.replace("/onboarding/payment");
      }
    }
  }, [authLoading, subLoading, session, isActive, router]);

  if (authLoading || subLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  // If user is authenticated but hasn't paid, do not render the tabs so they can't flashes of content
  if (!session || !isActive) {
    return null;
  }

  const tabBarPaddingBottom = Platform.OS === "ios" ? 28 : 10 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#059669",
        tabBarInactiveTintColor: "#9ca3af",
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "#fff",
          borderTopWidth: 0,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          height: Platform.OS === "ios" ? 88 : 68 + insets.bottom,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="maanta"
        options={{
          title: "Maanta",
          tabBarIcon: ({ color, size }) => (
            <Feather name="sun" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="hawlaha"
        options={{
          title: "Hawlaha",
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="yoolalka"
        options={{
          title: "Yoolalka",
          tabBarIcon: ({ color, size }) => (
            <Feather name="target" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="focus"
        options={{
          title: "Iska xir",
          tabBarIcon: ({ color, size }) => (
            <Feather name="zap" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="dejinta"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
