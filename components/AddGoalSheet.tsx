import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";

const SHEET_MAX_HEIGHT_PERCENT = 0.9;

function formatDateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface AddGoalSheetProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (goal: { title: string; type: string; deadline: string }) => Promise<void>;
}

type FeatherIconName = "zap" | "calendar" | "sun" | "moon" | "star" | "cloud" | "heart" | "gift" | "book" | "coffee" | "target" | "flag" | "award";

const GOAL_TYPES: { key: string; label: string; sublabel: string; icon: FeatherIconName; accent: string }[] = [
  { key: "Toddobaad", label: "Toddobaad", sublabel: "1 usbuuc", icon: "zap", accent: "#f59e0b" },
  { key: "1 bil", label: "1 bil", sublabel: "1 bil", icon: "calendar", accent: "#059669" },
  { key: "2 bil", label: "2 bil", sublabel: "2 bilood", icon: "sun", accent: "#eab308" },
  { key: "3 bil", label: "3 bil", sublabel: "3 bilood", icon: "moon", accent: "#6366f1" },
  { key: "4 bil", label: "4 bil", sublabel: "4 bilood", icon: "star", accent: "#f97316" },
  { key: "5 bil", label: "5 bil", sublabel: "5 bilood", icon: "cloud", accent: "#0ea5e9" },
  { key: "6 bil", label: "6 bil", sublabel: "6 bilood", icon: "heart", accent: "#ec4899" },
  { key: "7 bil", label: "7 bil", sublabel: "7 bilood", icon: "gift", accent: "#8b5cf6" },
  { key: "8 bil", label: "8 bil", sublabel: "8 bilood", icon: "book", accent: "#14b8a6" },
  { key: "9 bil", label: "9 bil", sublabel: "9 bilood", icon: "coffee", accent: "#78716c" },
  { key: "10 bil", label: "10 bil", sublabel: "10 bilood", icon: "target", accent: "#dc2626" },
  { key: "11 bil", label: "11 bil", sublabel: "11 bilood", icon: "flag", accent: "#2563eb" },
  { key: "Sanad", label: "Sanad", sublabel: "1 sanad", icon: "award", accent: "#ca8a04" },
];

/** Today's date only (local), no time – for consistent deadline math */
function todayLocal(): Date {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

function getDeadlineFromType(type: string): string {
  const today = todayLocal();
  if (type === "Toddobaad") {
    // 1 usbuuc = 7 days exactly (not 8)
    const deadline = new Date(today);
    deadline.setDate(deadline.getDate() + 7);
    return formatDateLocal(deadline);
  }
  if (type === "Sanad") {
    // 1 sanad = same calendar date next year
    const deadline = new Date(today);
    deadline.setFullYear(deadline.getFullYear() + 1);
    return formatDateLocal(deadline);
  }
  const months: Record<string, number> = {
    "1 bil": 1, "2 bil": 2, "3 bil": 3, "4 bil": 4, "5 bil": 5,
    "6 bil": 6, "7 bil": 7, "8 bil": 8, "9 bil": 9, "10 bil": 10, "11 bil": 11,
  };
  const add = months[type] ?? 1;
  const deadline = new Date(today);
  deadline.setMonth(deadline.getMonth() + add);
  return formatDateLocal(deadline);
}

export default function AddGoalSheet({ visible, onClose, onAdd }: AddGoalSheetProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("Toddobaad");
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const windowHeight = Dimensions.get("window").height;
  const sheetMaxHeight = windowHeight * SHEET_MAX_HEIGHT_PERCENT;

  const reset = () => {
    setTitle("");
    setType("Toddobaad");
  };

  const handleAdd = async () => {
    if (!title.trim()) {
      Alert.alert("Khalad", "Fadlan ku qor magaca yoolka.");
      return;
    }
    setSaving(true);
    try {
      const deadline = getDeadlineFromType(type);
      await onAdd({ title: title.trim(), type, deadline });
      reset();
      onClose();
    } catch {
      Alert.alert("Khalad", "Ma suurtogalin in la kaydiyo. Isku day mar kale.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)" }} onPress={onClose} />
        <View
          style={{
            height: sheetMaxHeight,
            backgroundColor: "#fff",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 10,
          }}
        >
          {/* Header */}
          <View className="px-5 pt-3 pb-2">
            <View className="w-12 h-1.5 bg-gray-300 rounded-full self-center mb-4" />
            <View className="flex-row items-center justify-between">
              <Text className="text-xl font-extrabold text-gray-900">
                Yool Cusub
              </Text>
              <Pressable
                onPress={onClose}
                className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center active:bg-gray-200"
                hitSlop={8}
              >
                <Feather name="x" size={20} color="#374151" />
              </Pressable>
            </View>
          </View>

          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            {/* Magaca yoolka – scroll to top on focus so it stays visible on Android */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Magaca yoolka
              </Text>
              <TextInput
                className="border-2 border-gray-200 rounded-xl px-4 py-3.5 text-base text-gray-900 bg-gray-50"
                placeholder="Tusaale: Baro luuqad cusub..."
                placeholderTextColor="#9ca3af"
                value={title}
                onChangeText={setTitle}
                onFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
              />
              {/* Ku dar Yool – right below input so user can tap after typing */}
              <Pressable
                className="mt-3 rounded-2xl py-3.5 items-center flex-row justify-center gap-2 active:bg-emerald-700 disabled:opacity-70"
                style={{ backgroundColor: "#059669" }}
                onPress={handleAdd}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Feather name="check" size={18} color="#fff" />
                )}
                <Text className="text-white text-base font-bold">
                  {saving ? "Kaydinaya..." : "Ku dar Yool"}
                </Text>
              </Pressable>
            </View>

            {/* Nooca wakhtiga yoolka – vertical list, all visible, no horizontal scroll */}
            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-3">
                Wakhtiga yoolka
              </Text>
              <View className="rounded-2xl overflow-hidden border border-gray-200 bg-white">
                {GOAL_TYPES.map((gt, index) => {
                  const isSelected = type === gt.key;
                  const isLast = index === GOAL_TYPES.length - 1;
                  return (
                    <Pressable
                      key={gt.key}
                      onPress={() => setType(gt.key)}
                      className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-gray-50 ${!isLast ? "border-b border-gray-100" : ""}`}
                      style={{
                        backgroundColor: isSelected ? "#ecfdf5" : "transparent",
                      }}
                    >
                      <View
                        className="w-10 h-10 rounded-xl items-center justify-center"
                        style={{ backgroundColor: isSelected ? "#059669" : "#f1f5f9" }}
                      >
                        <Feather
                          name={gt.icon}
                          size={20}
                          color={isSelected ? "#fff" : "#64748b"}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-gray-900">
                          {gt.label}
                        </Text>
                        <Text className="text-xs text-gray-500 mt-0.5">
                          {gt.sublabel}
                        </Text>
                      </View>
                      {isSelected && (
                        <View className="w-6 h-6 rounded-full bg-emerald-600 items-center justify-center">
                          <Feather name="check" size={14} color="#fff" />
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
