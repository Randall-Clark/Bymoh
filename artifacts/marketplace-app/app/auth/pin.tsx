import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PinField } from "@/components/PinField";

export default function PinScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { loginWithPin } = useAuth();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [pin, setPin] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isComplete = pin.every((d) => d !== "");

  const handlePinChange = (digits: string[]) => {
    setPin(digits);
    setError("");
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
      setPin(Array(6).fill(""));
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
        <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
          <Feather name="lock" size={28} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Entrez votre PIN</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Code PIN pour le numéro{"\n"}
          <Text style={{ color: colors.text, fontWeight: "700" }}>{maskedPhone}</Text>
        </Text>

        <PinField value={pin} onChange={handlePinChange} error={!!error} autoFocus />

        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

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
