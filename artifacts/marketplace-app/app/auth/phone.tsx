import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
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

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    dialCode: string;
    flag: string;
    placeholder: string;
    maxLength: string;
    countryCode: string;
  }>();

  const dialCode = params.dialCode ?? "+228";
  const flag = params.flag ?? "🇹🇬";
  const placeholder = params.placeholder ?? "90 00 00 00";
  const maxLength = params.maxLength ? parseInt(params.maxLength, 10) : 10;

  const [phone, setPhone] = useState("");
  const [focused, setFocused] = useState(false);

  const isValid = phone.replace(/\s/g, "").length >= 8;

  const handleNext = () => {
    if (!isValid) return;
    const fullPhone = `${dialCode}${phone}`;
    router.push({ pathname: "/auth/otp", params: { phone: fullPhone } });
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
          <Feather name="smartphone" size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Votre numéro</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Entrez votre numéro de téléphone pour recevoir un code de vérification par SMS.
        </Text>

        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={[styles.countryCode, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Text style={styles.flag}>{flag}</Text>
            <Text style={[styles.code, { color: colors.text }]}>{dialCode}</Text>
            <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: focused ? colors.primary : colors.border,
                color: colors.text,
              },
            ]}
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={maxLength}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[
            styles.btn,
            { backgroundColor: isValid ? colors.primary : colors.muted },
          ]}
          onPress={handleNext}
          disabled={!isValid}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: isValid ? "#fff" : colors.mutedForeground }]}>
            Recevoir le code
          </Text>
          <Feather name="arrow-right" size={18} color={isValid ? "#fff" : colors.mutedForeground} />
        </TouchableOpacity>

        <Text style={[styles.info, { color: colors.mutedForeground }]}>
          Un SMS sera envoyé à ce numéro. Des frais standards peuvent s'appliquer.
        </Text>
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
  inputGroup: { flexDirection: "row", gap: 10 },
  countryCode: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  flag: { fontSize: 20 },
  code: { fontSize: 15, fontWeight: "700" },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    fontSize: 18,
    letterSpacing: 2,
    fontWeight: "600",
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 100,
  },
  btnText: { fontSize: 16, fontWeight: "700" },
  info: { fontSize: 12, textAlign: "center", lineHeight: 18 },
});
