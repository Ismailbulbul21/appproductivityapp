import { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";

const FOCUS_TYPES = [
  { key: "Student", label: "Student", icon: "book-open" as const },
  { key: "Shaqo", label: "Shaqo", icon: "briefcase" as const },
  { key: "Ganacsi", label: "Ganacsi", icon: "trending-up" as const },
  { key: "Horumar Shakhsi", label: "Horumar Shakhsi", icon: "user" as const },
];

export default function FocusType() {
  const router = useRouter();
  const { session, updateFocusType } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      if (session) await updateFocusType(selected);
      router.push("/onboarding/notifications");
    } catch {
      Alert.alert("Khalad", "Waa la waayay in la keydiyo. Isku day mar kale.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 px-6 pt-12">
        <Text className="text-3xl font-extrabold text-gray-900 mb-2">
          Nooca Fokuuskaaga
        </Text>
        <Text className="text-base text-gray-500 mb-8">
          Dooro nooca ugu muhiimsan adiga
        </Text>

        <View className="gap-4">
          {FOCUS_TYPES.map((ft) => (
            <Pressable
              key={ft.key}
              className={`flex-row items-center p-5 rounded-2xl border-2 ${
                selected === ft.key
                  ? "border-emerald-600 bg-emerald-50"
                  : "border-gray-200 bg-white"
              }`}
              onPress={() => setSelected(ft.key)}
            >
              <View
                className={`w-14 h-14 rounded-xl items-center justify-center mr-4 ${
                  selected === ft.key ? "bg-emerald-600" : "bg-gray-100"
                }`}
              >
                <Feather
                  name={ft.icon}
                  size={26}
                  color={selected === ft.key ? "#fff" : "#6b7280"}
                />
              </View>
              <Text
                className={`text-lg font-bold ${
                  selected === ft.key ? "text-emerald-700" : "text-gray-800"
                }`}
              >
                {ft.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View className="px-6 pb-8">
        <Pressable
          className={`rounded-2xl py-4 items-center ${
            selected ? "bg-emerald-600 active:bg-emerald-700" : "bg-gray-200"
          }`}
          onPress={handleContinue}
          disabled={!selected || saving}
        >
          <Text
            className={`text-lg font-bold ${selected ? "text-white" : "text-gray-400"}`}
          >
            {saving ? "Kaydinaya..." : "Sii Wad"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
