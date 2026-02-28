import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import { useSubscription } from "../../hooks/useSubscription";

export default function AuthScreen() {
  const router = useRouter();
  const { session, profile, loading: authLoading, signIn, signUp } = useAuth();
  const userId = session?.user?.id;
  const { isActive: isSubscribed, loading: subLoading } = useSubscription(userId);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        if (Platform.OS === "android") {
          setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (authLoading || subLoading || !session) return;
    if (!profile?.focus_type) {
      router.replace("/onboarding/focus-type");
    } else if (!isSubscribed) {
      router.replace("/onboarding/payment");
    } else {
      router.replace("/(tabs)/maanta");
    }
  }, [session, profile, authLoading, isSubscribed, subLoading]);

  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Fadlan buuxi dhammaan meelaha.");
      return;
    }
    setLoading(true);
    try {
      if (isLogin) {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("Invalid login")) {
        setError("Email ama password-ku waa khalad.");
      } else if (msg.includes("already registered")) {
        setError("Email-kan horay ayaa loo diiwaangeliyay.");
      } else if (msg.includes("weak_password")) {
        setError("Password-ku aad u gaaban yahay. Ugu yaraan 6 xaraf.");
      } else {
        setError("Khalad ayaa dhacay. Isku day mar kale.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          className="flex-1"
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: 40 + (Platform.OS === "android" ? keyboardHeight : 0),
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className="items-center mb-10">
            <View
              className="w-20 h-20 rounded-2xl items-center justify-center mb-5"
              style={{
                backgroundColor: "#ecfdf5",
                shadowColor: "#059669",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 4,
              }}
            >
              <Feather name="user" size={40} color="#059669" />
            </View>
            <Text className="text-2xl font-extrabold text-gray-900 text-center">
              {isLogin ? "Ku soo dhawoow" : "Samee akaawun"}
            </Text>
            <Text className="text-base text-gray-500 text-center mt-2 max-w-[280px]">
              {isLogin
                ? "Geli emailkaaga iyo password-kaaga si aad u galato"
                : "Diiwaangeliso si aad u bilowdo adoo isticmaalaya app-kan"}
            </Text>
          </View>

          {/* Form card */}
          <View
            className="bg-white rounded-3xl px-5 py-6 mb-6"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 16,
              elevation: 3,
            }}
          >
            {/* Toggle: Gal / Is diiwaan geli */}
            <View className="flex-row bg-gray-100 rounded-2xl p-1 mb-6">
              <Pressable
                onPress={() => {
                  setIsLogin(true);
                  setError("");
                }}
                className="flex-1 py-3 rounded-xl items-center"
                style={{
                  backgroundColor: isLogin ? "#fff" : "transparent",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isLogin ? 0.06 : 0,
                  shadowRadius: 4,
                  elevation: isLogin ? 2 : 0,
                }}
              >
                <Text
                  className="text-sm font-bold"
                  style={{ color: isLogin ? "#059669" : "#6b7280" }}
                >
                  Gal
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setIsLogin(false);
                  setError("");
                }}
                className="flex-1 py-3 rounded-xl items-center"
                style={{
                  backgroundColor: !isLogin ? "#fff" : "transparent",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: !isLogin ? 0.06 : 0,
                  shadowRadius: 4,
                  elevation: !isLogin ? 2 : 0,
                }}
              >
                <Text
                  className="text-sm font-bold"
                  style={{ color: !isLogin ? "#059669" : "#6b7280" }}
                >
                  Is diiwaan geli
                </Text>
              </Pressable>
            </View>

            {error ? (
              <View className="flex-row items-center bg-red-50 rounded-xl px-4 py-3 mb-4 border border-red-100">
                <Feather name="alert-circle" size={20} color="#dc2626" style={{ marginRight: 10 }} />
                <Text className="flex-1 text-red-600 text-sm font-medium">{error}</Text>
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Email
              </Text>
              <View
                className="flex-row items-center rounded-xl border-2 px-4 py-3.5 bg-gray-50"
                style={{ borderColor: "#e5e7eb" }}
              >
                <Feather name="mail" size={20} color="#9ca3af" style={{ marginRight: 12 }} />
                <TextInput
                  className="flex-1 text-base text-gray-900 py-0"
                  placeholder="Tusaale: email@tusaale.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            <View className="mb-5">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Password (sirta)
              </Text>
              <View
                className="flex-row items-center rounded-xl border-2 px-4 py-3.5 bg-gray-50"
                style={{ borderColor: "#e5e7eb" }}
              >
                <Feather name="lock" size={20} color="#9ca3af" style={{ marginRight: 12 }} />
                <TextInput
                  className="flex-1 text-base text-gray-900 py-0"
                  placeholder="Geli sirtaada"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            <Pressable
              className="rounded-2xl py-4 items-center flex-row justify-center active:opacity-90 disabled:opacity-70"
              style={{
                backgroundColor: "#059669",
                shadowColor: "#059669",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 4,
              }}
              onPress={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name={isLogin ? "log-in" : "user-plus"} size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text className="text-white text-lg font-bold">
                    {isLogin ? "Gal" : "Is diiwaan geli"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Switch mode hint */}
          <Pressable
            className="items-center py-3 active:opacity-60"
            onPress={() => {
              setIsLogin(!isLogin);
              setError("");
            }}
          >
            <Text className="text-gray-500 text-sm">
              {isLogin ? "Akaawun ma lihid? " : "Horay akaawun u leedahay? "}
              <Text className="text-emerald-600 font-bold">
                {isLogin ? "Is diiwaan geli" : "Gal"}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
