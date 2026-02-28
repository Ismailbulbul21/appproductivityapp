import { View, Text, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Welcome() {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#6d28d9]">
      <View className="flex-1 items-center justify-center px-8">
        <Image
          source={require("../../assets/icon.png")}
          className="w-32 h-32 mb-8"
          resizeMode="contain"
          style={{ width: 128, height: 128 }}
        />

        <Text className="text-5xl font-extrabold text-white mb-4 text-center">
          Qorsheyn
        </Text>

        <Text className="text-lg text-purple-200 text-center leading-7 mb-12">
          Abaabul Maalintaada.{"\n"}Gaadh Yoolalkaaga.
        </Text>

        <Pressable
          className="bg-white rounded-2xl py-4 px-16 active:opacity-80"
          onPress={() => router.push("/onboarding/auth")}
        >
          <Text className="text-[#6d28d9] text-lg font-bold text-center">
            Bilow
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
