import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../hooks/useAuth";

export default function Index() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!session) return <Redirect href="/onboarding/" />;
  if (!profile?.focus_type) return <Redirect href="/onboarding/focus-type" />;
  return <Redirect href="/(tabs)/maanta" />;
}
