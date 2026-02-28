import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "../../hooks/useAuth";
import { useSubscription } from "../../hooks/useSubscription";

type PaymentChannel = "EVC" | "ZAAD" | "SAHAL";

export default function PaymentScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { createPayment, isActive } = useSubscription(userId);

  const [channel, setChannel] = useState<PaymentChannel>("EVC");
  const [phone, setPhone] = useState("25261");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const updateChannel = (c: PaymentChannel) => {
    setChannel(c);
    if (c === "EVC") setPhone("25261");
    if (c === "ZAAD") setPhone("25263");
    if (c === "SAHAL") setPhone("25290");
  };

  useEffect(() => {
    // If already subscribed, go to main app
    if (isActive) {
      router.replace("/(tabs)/maanta");
    }
  }, [isActive, router]);

  const handlePay = async () => {
    setError("");

    // Validate phone
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 12) {
      setError("Fadlan geli nambar telefon sax ah (tusaale: 252612345678)");
      return;
    }

    setLoading(true);
    try {
      await createPayment(channel, digits);
      Alert.alert(
        "Hambalyo! 🎉",
        "Lacag bixintaadu way guuleysatay! Ku soo dhawoow Qorsheyn.",
        [{ text: "Bilow", onPress: () => router.replace("/(tabs)/maanta") }],
      );
    } catch (e: any) {
      setError(e?.message || "Khalad ayaa dhacay. Fadlan isku day mar kale.");
    } finally {
      setLoading(false);
    }
  };

  const KeyboardWrapper = Platform.OS === "ios" ? KeyboardAvoidingView : View;

  return (
    <SafeAreaView className='flex-1 bg-gray-50' edges={["top"]}>
      <KeyboardWrapper
        className='flex-1'
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className='flex-1'
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: 24,
            paddingTop: 32,
            paddingBottom: 100,
          }}
          keyboardShouldPersistTaps='handled'
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View className='items-center mb-8'>
            <View
              className='w-20 h-20 rounded-2xl items-center justify-center mb-5'
              style={{
                backgroundColor: "#ecfdf5",
                shadowColor: "#059669",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 12,
                elevation: 4,
              }}
            >
              <Feather name='zap' size={40} color='#059669' />
            </View>
            <Text className='text-2xl font-extrabold text-gray-900 text-center'>
              Ku biir Qorsheyn
            </Text>
            <Text className='text-base text-gray-500 text-center mt-2 max-w-[300px]'>
              Si aad u isticmaasho app-ka, fadlan bixi lacag yar oo bishi ah
            </Text>
          </View>

          {/* Plan card */}
          <View
            className='bg-white rounded-3xl px-5 py-5 mb-5'
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 16,
              elevation: 3,
              borderWidth: 2,
              borderColor: "#059669",
            }}
          >
            <View className='flex-row items-center justify-between mb-2'>
              <View className='flex-row items-center gap-2'>
                <View className='bg-emerald-100 rounded-full p-2'>
                  <Feather name='check-circle' size={20} color='#059669' />
                </View>
                <Text className='text-lg font-bold text-gray-900'>Bishii</Text>
              </View>
              <View className='flex-row items-baseline'>
                <Text className='text-3xl font-extrabold text-emerald-600'>
                  $0.50
                </Text>
                <Text className='text-sm text-gray-400 ml-1'>/bisha</Text>
              </View>
            </View>
            <View className='flex-row flex-wrap gap-2 mt-3'>
              {[
                "Focus & App Blocking",
                "Hawlaha (Tasks)",
                "Yoolalka (Goals)",
                "Kooxda Focus",
                "Qorsheeyo xiritaan",
              ].map((feature) => (
                <View
                  key={feature}
                  className='flex-row items-center gap-1.5 px-3 py-1.5 rounded-full'
                  style={{ backgroundColor: "#ecfdf5" }}
                >
                  <Feather name='check' size={12} color='#059669' />
                  <Text className='text-xs font-semibold text-emerald-700'>
                    {feature}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Payment method */}
          <View
            className='bg-white rounded-3xl px-5 py-5 mb-5'
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.06,
              shadowRadius: 16,
              elevation: 3,
            }}
          >
            <Text className='text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide'>
              Habka lacag bixinta
            </Text>
            <View className='flex-row gap-2'>
              <Pressable
                className='flex-1 py-3.5 rounded-2xl items-center'
                style={{
                  backgroundColor: channel === "EVC" ? "#059669" : "#f3f4f6",
                  shadowColor: channel === "EVC" ? "#059669" : "transparent",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: channel === "EVC" ? 0.3 : 0,
                  shadowRadius: 6,
                  elevation: channel === "EVC" ? 3 : 0,
                }}
                onPress={() => updateChannel("EVC")}
              >
                <Text
                  className='text-sm font-bold'
                  style={{
                    color: channel === "EVC" ? "#fff" : "#6b7280",
                  }}
                >
                  EVC Plus
                </Text>
              </Pressable>
              <Pressable
                className='flex-1 py-3.5 rounded-2xl items-center'
                style={{
                  backgroundColor: channel === "ZAAD" ? "#059669" : "#f3f4f6",
                  shadowColor: channel === "ZAAD" ? "#059669" : "transparent",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: channel === "ZAAD" ? 0.3 : 0,
                  shadowRadius: 6,
                  elevation: channel === "ZAAD" ? 3 : 0,
                }}
                onPress={() => updateChannel("ZAAD")}
              >
                <Text
                  className='text-sm font-bold'
                  style={{
                    color: channel === "ZAAD" ? "#fff" : "#6b7280",
                  }}
                >
                  ZAAD
                </Text>
              </Pressable>
              <Pressable
                className='flex-1 py-3.5 rounded-2xl items-center'
                style={{
                  backgroundColor: channel === "SAHAL" ? "#059669" : "#f3f4f6",
                  shadowColor: channel === "SAHAL" ? "#059669" : "transparent",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: channel === "SAHAL" ? 0.3 : 0,
                  shadowRadius: 6,
                  elevation: channel === "SAHAL" ? 3 : 0,
                }}
                onPress={() => updateChannel("SAHAL")}
              >
                <Text
                  className='text-sm font-bold'
                  style={{
                    color: channel === "SAHAL" ? "#fff" : "#6b7280",
                  }}
                >
                  SAHAL
                </Text>
              </Pressable>
            </View>

            {/* Phone */}
            <Text className='text-sm font-bold text-gray-700 mt-5 mb-2 uppercase tracking-wide'>
              Telefon nambarka
            </Text>
            <View
              className='flex-row items-center rounded-xl border-2 px-4 py-3.5 bg-gray-50'
              style={{ borderColor: "#e5e7eb" }}
            >
              <Feather
                name='phone'
                size={20}
                color='#9ca3af'
                style={{ marginRight: 12 }}
              />
              <TextInput
                className='flex-1 text-base text-gray-900 py-0'
                placeholder='252XXXXXXXXX'
                placeholderTextColor='#9ca3af'
                value={phone}
                onChangeText={(t) => {
                  // Protect the correct prefix based on chosen channel
                  let prefix = "25261";
                  if (channel === "ZAAD") prefix = "25263";
                  if (channel === "SAHAL") prefix = "25290";

                  if (t.length < 5) {
                    setPhone(prefix);
                  } else {
                    // Ensure it starts with the prefix if user tries to overwrite
                    const cleanDigits = t.replace(/[^0-9]/g, "");
                    if (!cleanDigits.startsWith(prefix)) {
                      setPhone(
                        prefix +
                          cleanDigits.substring(
                            Math.min(cleanDigits.length, 5),
                          ),
                      );
                    } else {
                      setPhone(cleanDigits);
                    }
                  }
                }}
                keyboardType='phone-pad'
                maxLength={15}
              />
            </View>
          </View>

          {/* Error */}
          {error ? (
            <View className='flex-row items-center bg-red-50 rounded-xl px-4 py-3 mb-4 border border-red-100'>
              <Feather
                name='alert-circle'
                size={20}
                color='#dc2626'
                style={{ marginRight: 10 }}
              />
              <Text className='flex-1 text-red-600 text-sm font-medium'>
                {error}
              </Text>
            </View>
          ) : null}

          {/* Pay button */}
          <Pressable
            className='rounded-2xl py-4.5 items-center flex-row justify-center active:opacity-90'
            style={{
              backgroundColor: loading ? "#6ee7b7" : "#059669",
              shadowColor: "#059669",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
              paddingVertical: 18,
            }}
            onPress={handlePay}
            disabled={loading}
          >
            {loading ? (
              <View className='flex-row items-center gap-3'>
                <ActivityIndicator color='#fff' />
                <Text className='text-white text-lg font-bold'>
                  Sugaya jawaab...
                </Text>
              </View>
            ) : (
              <>
                <Feather
                  name='credit-card'
                  size={20}
                  color='#fff'
                  style={{ marginRight: 8 }}
                />
                <Text className='text-white text-lg font-bold'>Bixi $0.50</Text>
              </>
            )}
          </Pressable>

          {/* Info */}
          <View className='mt-5 px-2'>
            <Text className='text-xs text-gray-400 text-center leading-5'>
              Lacag bixintu waxay ku dhacaysaa{" "}
              {channel === "EVC" ? "EVC Plus" : "ZAAD"} akaawunkaaga.{"\n"}
              Waxaad heli doontaa USSD PIN si aad u xaqiijiso.
            </Text>
          </View>
        </ScrollView>
      </KeyboardWrapper>
    </SafeAreaView>
  );
}
