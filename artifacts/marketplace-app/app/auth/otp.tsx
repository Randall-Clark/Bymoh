import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import { useColors } from "@/hooks/useColors";

export default function OtpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) { setCanResend(true); return; }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleChange = (text: string, idx: number) => {
    if (text.length > 1) {
      const chars = text.split("").slice(0, 6);
      const next = [...otp];
      chars.forEach((c, i) => { if (idx + i < 6) next[idx + i] = c; });
      setOtp(next);
      const focusIdx = Math.min(idx + chars.length, 5);
      inputs.current[focusIdx]?.focus();
      return;
    }
    const next = [...otp];
    next[idx] = text;
    setOtp(next);
    if (text && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyPress = (key: string, idx: number) => {
    if (key === "Backspace" && !otp[idx] && idx > 0) {
      const next = [...otp];
      next[idx - 1] = "";
      setOtp(next);
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleResend = () => {
    setCountdown(60);
    setCanResend(false);
  };

  const isComplete = otp.every((d) => d !== "");

  const handleVerify = () => {
    if (!isComplete) return;
    router.push("/auth/profile");
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
          <Feather name="message-square" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Code de vérification</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Entrez le code à 6 chiffres envoyé au{"\n"}
          <Text style={{ color: colors.text, fontWeight: "700" }}>+228 {phone}</Text>
        </Text>

        <View style={styles.otpRow}>
          {otp.map((digit, idx) => (
            <TextInput
              key={idx}
              ref={(r) => { inputs.current[idx] = r; }}
              style={[
                styles.otpInput,
                {
                  backgroundColor: colors.card,
                  borderColor: digit ? colors.primary : colors.border,
                  color: colors.text,
                },
              ]}
              value={digit}
              onChangeText={(t) => handleChange(t, idx)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, idx)}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isComplete ? colors.primary : colors.muted }]}
          onPress={handleVerify}
          disabled={!isComplete}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: isComplete ? "#fff" : colors.mutedForeground }]}>
            Vérifier le code
          </Text>
        </TouchableOpacity>

        <View style={styles.resendRow}>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={[styles.resendLink, { color: colors.primary }]}>Renvoyer le code</Text>
            </TouchableOpacity>
          ) : (
            <Text style={[styles.countdown, { color: colors.mutedForeground }]}>
              Renvoyer dans{" "}
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {countdown}s
              </Text>
            </Text>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  content: { flex: 1, paddingHorizontal: 24, gap: 20, paddingTop: 24 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  otpRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  otpInput: {
    width: 46, height: 56, borderRadius: 12, borderWidth: 1.5,
    fontSize: 22, fontWeight: "700",
  },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 100,
  },
  btnText: { fontSize: 16, fontWeight: "700" },
  resendRow: { alignItems: "center" },
  countdown: { fontSize: 14 },
  resendLink: { fontSize: 14, fontWeight: "700" },
});
