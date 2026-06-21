import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PinField } from "@/components/PinField";

export default function ProfileSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { registerUser } = useAuth();
  const { phone, countryCode } = useLocalSearchParams<{ phone: string; countryCode?: string }>();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState<string[]>(Array(6).fill(""));
  const [pinConfirm, setPinConfirm] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [pinError, setPinError] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const isNameValid = name.trim().length >= 2;
  const isEmailValid = email.includes("@") && email.includes(".");
  const isPinComplete = pin.every((d) => d !== "");
  const isPinConfirmComplete = pinConfirm.every((d) => d !== "");
  const canSubmit = isNameValid && isEmailValid && isPinComplete && isPinConfirmComplete && !loading;

  const handleDone = async () => {
    if (!canSubmit) return;
    const pinStr = pin.join("");
    const pinConfirmStr = pinConfirm.join("");
    if (pinStr !== pinConfirmStr) {
      setPinError("Les deux PIN ne correspondent pas.");
      setPinConfirm(Array(6).fill(""));
      return;
    }
    setLoading(true);
    try {
      await registerUser(phone ?? "", name.trim(), email.trim(), pinStr, countryCode ?? "TG");
      router.replace("/auth/purpose");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la création du compte.";
      setPinError(msg);
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ height: topPad + 16 }} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarEmoji}>👋</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Créer votre compte</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Quelques informations pour finaliser votre inscription.
        </Text>

        {/* Name */}
        <View>
          <Text style={[styles.label, { color: colors.text }]}>Prénom / Nom complet</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="Ex : Kofi Mensah"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        {/* Email */}
        <View>
          <Text style={[styles.label, { color: colors.text }]}>Adresse e-mail</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            placeholder="exemple@email.com"
            placeholderTextColor={colors.mutedForeground}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            returnKeyType="next"
          />
        </View>

        {/* PIN creation */}
        <View style={styles.pinBlock}>
          <Text style={[styles.label, { color: colors.text }]}>Créer un code PIN (6 chiffres)</Text>
          <PinField
            value={pin}
            onChange={(d) => { setPin(d); setPinError(""); }}
            error={!!pinError}
          />
        </View>

        {/* PIN confirmation */}
        <View style={styles.pinBlock}>
          <Text style={[styles.label, { color: colors.text }]}>Confirmer le code PIN</Text>
          <PinField
            value={pinConfirm}
            onChange={(d) => { setPinConfirm(d); setPinError(""); }}
            error={!!pinError}
          />
        </View>

        {/* PIN error */}
        {!!pinError && (
          <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.errorText}>{pinError}</Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: canSubmit ? colors.primary : colors.muted }]}
          onPress={handleDone}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: canSubmit ? "#fff" : colors.mutedForeground }]}>
            {loading ? "Création du compte…" : "Créer mon compte"}
          </Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 18, alignItems: "stretch" },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
  },
  avatarEmoji: { fontSize: 38 },
  title: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, fontSize: 16,
  },
  pinBlock: { gap: 8 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, color: "#EF4444" },
  btn: {
    paddingVertical: 16, borderRadius: 100,
    alignItems: "center", justifyContent: "center",
  },
  btnText: { fontSize: 16, fontWeight: "700" },
});
