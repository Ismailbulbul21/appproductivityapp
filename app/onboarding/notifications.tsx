import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { registerForPushNotifications } from "../../services/notifications";

export default function NotificationsScreen() {
  const router = useRouter();

  const handleAllow = async () => {
    await registerForPushNotifications();
    router.replace("/onboarding/payment");
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        <View className="bg-emerald-100 rounded-full p-8 mb-8">
          <Feather name="bell" size={56} color="#059669" />
        </View>

        <Text className="text-2xl font-extrabold text-gray-900 text-center mb-4">
          Xasuusinta
        </Text>

        <Text className="text-base text-gray-500 text-center leading-6 mb-12">
          U oggolow xasuusin si aadan u illoobin hawlahaaga muhiimka ah
        </Text>

        <Pressable
          className="bg-emerald-600 rounded-2xl py-4 w-full items-center mb-4 active:bg-emerald-700"
          onPress={handleAllow}
        >
          <Text className="text-white text-lg font-bold">Oggolow</Text>
        </Pressable>

        <Pressable
          className="py-3 active:opacity-60"
          onPress={() => router.replace("/onboarding/payment")}
        >
          <Text className="text-gray-400 text-base font-medium">
            Haddii danbe
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
