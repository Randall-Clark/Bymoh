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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileSetupScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [name, setName] = useState("");
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const isValid = name.trim().length >= 2;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleDone = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    await signIn(phone ?? "000000000", name.trim());
    router.replace("/auth/purpose");
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ height: topPad + 16 }} />

      <View style={styles.content}>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarEmoji}>👋</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Bienvenue !</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Comment souhaitez-vous être appelé ?
        </Text>

        <View>
          <Text style={[styles.label, { color: colors.text }]}>Votre prénom / nom</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: focused ? colors.primary : colors.border,
                color: colors.text,
              },
            ]}
            placeholder="Ex : Kofi Mensah"
            placeholderTextColor={colors.mutedForeground}
            value={name}
            onChangeText={setName}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleDone}
            autoFocus
          />
        </View>

        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isValid ? colors.primary : colors.muted }]}
          onPress={handleDone}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: isValid ? "#fff" : colors.mutedForeground }]}>
            {loading ? "Chargement..." : "Commencer"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, gap: 20, paddingTop: 24, alignItems: "stretch" },
  avatarCircle: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
  },
  avatarEmoji: { fontSize: 38 },
  title: { fontSize: 28, fontWeight: "800", textAlign: "center" },
  subtitle: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  label: { fontSize: 14, fontWeight: "600", marginBottom: 8 },
  input: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, fontSize: 16,
  },
  btn: {
    paddingVertical: 16, borderRadius: 100,
    alignItems: "center", justifyContent: "center",
  },
  btnText: { fontSize: 16, fontWeight: "700" },
});
