import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function PinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loginWithPin } = useAuth();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [pin, setPin] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isComplete = pin.every((d) => d !== "");

  const handleChange = (text: string, idx: number) => {
    const digit = text.replace(/\D/g, "").slice(-1);
    const next = [...pin];
    next[idx] = digit;
    setPin(next);
    setError("");
    if (digit && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === "Backspace" && !pin[idx] && idx > 0) {
      const next = [...pin];
      next[idx - 1] = "";
      setPin(next);
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleLogin = async () => {
    if (!isComplete || loading) return;
    setLoading(true);
    const success = await loginWithPin(phone ?? "", pin.join(""));
    setLoading(false);

    if (success) {
      router.replace("/(tabs)");
    } else {
      setError("PIN incorrect. Vérifiez et réessayez.");
      setPin(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    }
  };

  const maskedPhone = phone
    ? phone.slice(0, -4).replace(/./g, "•") + phone.slice(-4)
    : "";

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ height: topPad + 20 }} />

      <View style={styles.content}>
        {/* Icon */}
        <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
          <Feather name="lock" size={28} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Entrez votre PIN</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Code PIN pour le numéro{"\n"}
          <Text style={{ color: colors.text, fontWeight: "700" }}>{maskedPhone}</Text>
        </Text>

        {/* PIN boxes */}
        <View style={styles.pinRow}>
          {pin.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={(r) => { inputs.current[idx] = r; }}
              style={[
                styles.pinBox,
                {
                  backgroundColor: colors.card,
                  borderColor: error ? "#EF4444" : digit ? colors.primary : colors.border,
                  color: colors.text,
                },
              ]}
              value={digit ? "●" : ""}
              onChangeText={(t) => handleChange(t, idx)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
              keyboardType="number-pad"
              maxLength={1}
              textAlign="center"
              selectTextOnFocus
              autoFocus={idx === 0}
              secureTextEntry={false}
            />
          ))}
        </View>

        {/* Error */}
        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Login button */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isComplete ? colors.primary : colors.muted }]}
          onPress={handleLogin}
          disabled={!isComplete || loading}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: isComplete ? "#fff" : colors.mutedForeground }]}>
            {loading ? "Connexion…" : "Se connecter"}
          </Text>
          {!loading && (
            <Feather name="arrow-right" size={18} color={isComplete ? "#fff" : colors.mutedForeground} />
          )}
        </TouchableOpacity>

        {/* Back to phone */}
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.75} style={styles.backLink}>
          <Feather name="arrow-left" size={14} color={colors.mutedForeground} />
          <Text style={[styles.backLinkText, { color: colors.mutedForeground }]}>
            Utiliser un autre numéro
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, gap: 20, paddingTop: 8 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  pinRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  pinBox: {
    width: 46, height: 56, borderRadius: 12, borderWidth: 1.5,
    fontSize: 22, fontWeight: "700",
  },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, color: "#EF4444" },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 100,
  },
  btnText: { fontSize: 16, fontWeight: "700" },
  backLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  backLinkText: { fontSize: 13 },
});
