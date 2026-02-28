import { useState, useEffect } from "react";
import { View, Text, Pressable, Switch, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useAuth } from "../../hooks/useAuth";
import { useSubscription } from "../../hooks/useSubscription";

export default function Dejinta() {
  const router = useRouter();
  const { session, profile, signOut, updateNotificationsEnabled } = useAuth();
  const { subscription, isActive } = useSubscription(session?.user?.id);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  useEffect(() => {
    if (profile) {
      setNotificationsEnabled(profile.notifications_enabled ?? true);
    }
  }, [profile]);

  const handleNotificationsToggle = async (value: boolean) => {
    setNotificationsEnabled(value);
    await updateNotificationsEnabled(value);
  };

  const handleLogout = () => {
    Alert.alert("Ka Bax", "Ma hubtaa inaad ka baxeyso?", [
      { text: "Maya", style: "cancel" },
      {
        text: "Haa, Ka Bax",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/onboarding/auth");
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Header */}
        <View className="px-5 pt-6 pb-2">
          <View className="flex-row items-center gap-3">
            <View
              className="w-12 h-12 rounded-2xl items-center justify-center"
              style={{
                backgroundColor: "#059669",
                shadowColor: "#059669",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.25,
                shadowRadius: 8,
                elevation: 4,
              }}
            >
              <Feather name="settings" size={24} color="#fff" />
            </View>
            <View>
              <Text className="text-2xl font-extrabold text-gray-900">Settings</Text>
              <Text className="text-sm text-gray-500 mt-0.5">Dejinta app-ka</Text>
            </View>
          </View>
        </View>

        {/* Account card */}
        <View className="px-5 mt-4 mb-4">
          <View
            className="bg-white rounded-2xl overflow-hidden"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <View className="px-4 py-4 flex-row items-center">
              <View className="w-12 h-12 rounded-full bg-emerald-100 items-center justify-center mr-4">
                <Feather name="user" size={22} color="#059669" />
              </View>
              <View className="flex-1 min-w-0">
                <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
                  {session?.user.email ?? "—"}
                </Text>
                <View className="flex-row items-center gap-1.5 mt-1">
                  <View className="bg-gray-100 px-2 py-0.5 rounded-md">
                    <Text className="text-xs font-semibold text-gray-600">
                      {profile?.focus_type ?? "—"}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Subscription */}
        {isActive && subscription && (
          <View className="px-5 mb-4">
            <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
              Diiwaangelinta (Subscription)
            </Text>
            <View
              className="bg-white rounded-2xl p-4"
              style={{
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 12,
                elevation: 3,
                borderWidth: 1,
                borderColor: "#059669",
              }}
            >
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-xl bg-emerald-50 items-center justify-center">
                    <Feather name="zap" size={20} color="#059669" />
                  </View>
                  <View>
                    <Text className="text-base font-semibold text-gray-900">Qorsheyn</Text>
                    <Text className="text-xs text-gray-500 mt-0.5">${subscription.amount}/bisha</Text>
                  </View>
                </View>
                <View className="bg-emerald-100 px-2.5 py-1 rounded-full">
                  <Text className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Firfircoon</Text>
                </View>
              </View>

              <View className="bg-gray-50 rounded-xl p-3 mt-1 border border-gray-100">
                <View className="flex-row justify-between items-center mb-1">
                  <Text className="text-xs font-medium text-gray-500">Dhammaadka</Text>
                  <Text className="text-xs font-bold text-gray-900">
                    {new Date(subscription.end_date).toLocaleDateString('so-SO', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Text>
                </View>
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs font-medium text-gray-500">Habka</Text>
                  <Text className="text-xs font-bold text-gray-900">{subscription.payment_channel}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Notifications */}
        <View className="px-5 mb-4">
          <Text className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2 px-1">
            Xasuusinta
          </Text>
          <View
            className="bg-white rounded-2xl px-4 py-4 flex-row items-center justify-between"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
            }}
          >
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 rounded-xl bg-amber-50 items-center justify-center">
                <Feather name="bell" size={20} color="#d97706" />
              </View>
              <View>
                <Text className="text-base font-semibold text-gray-900">Xasuusinta</Text>
                <Text className="text-xs text-gray-500 mt-0.5">Ogowsiinta hawsha iyo yoolka</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleNotificationsToggle}
              trackColor={{ true: "#059669", false: "#e2e8f0" }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Sign out */}
        <View className="px-5 mb-6">
          <Pressable
            className="bg-white rounded-2xl overflow-hidden flex-row items-center justify-center gap-2 py-4 active:opacity-90"
            onPress={handleLogout}
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 12,
              elevation: 3,
              borderWidth: 1.5,
              borderColor: "#fecaca",
              backgroundColor: "#fef2f2",
            }}
          >
            <Feather name="log-out" size={20} color="#dc2626" />
            <Text className="text-base font-bold text-red-600">Ka Bax</Text>
          </Pressable>
        </View>

        {/* Version */}
        <View className="items-center py-4">
          <Text className="text-xs text-gray-400">
            Qorsheyn v{Constants.expoConfig?.version ?? "1.0.0"}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
