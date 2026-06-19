import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
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
import { api } from "@/lib/api";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const isValid = name.trim().length >= 2;

  const initials = name.trim()
    ? name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const handleSave = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      await api.patch("/users/me", { name: name.trim(), email: email.trim() || undefined });
    } catch { }
    await updateUser({ name: name.trim(), email: email.trim() || undefined });
    setSaved(true);
    setTimeout(() => {
      setLoading(false);
      router.back();
    }, 600);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Modifier mon profil</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: "#E84B1A" }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <TouchableOpacity style={[styles.changePhotoBtn, { borderColor: colors.border }]}>
            <Feather name="camera" size={14} color={colors.mutedForeground} />
            <Text style={[styles.changePhotoLabel, { color: colors.mutedForeground }]}>
              Changer la photo
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Prénom / Nom complet</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: name.trim().length >= 2 ? colors.primary : colors.border, color: colors.text }]}
              placeholder="Ex : Kofi Mensah"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
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

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Numéro de téléphone</Text>
            <View style={[styles.input, styles.phoneDisplay, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="phone" size={15} color={colors.mutedForeground} />
              <Text style={[styles.phoneText, { color: colors.mutedForeground }]}>
                {user?.phone ?? "—"}
              </Text>
              <View style={[styles.lockedBadge, { backgroundColor: colors.border }]}>
                <Feather name="lock" size={11} color={colors.mutedForeground} />
                <Text style={[styles.lockedLabel, { color: colors.mutedForeground }]}>Fixe</Text>
              </View>
            </View>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Le numéro de téléphone est votre identifiant et ne peut pas être modifié.
            </Text>
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[
            styles.saveBtn,
            { backgroundColor: saved ? "#22C55E" : isValid ? "#E84B1A" : colors.muted },
          ]}
          onPress={handleSave}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          {saved ? (
            <Feather name="check" size={20} color="#fff" />
          ) : (
            <Text style={[styles.saveBtnText, { color: isValid ? "#fff" : colors.mutedForeground }]}>
              {loading ? "Enregistrement…" : "Sauvegarder"}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },

  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48, gap: 28 },

  avatarSection: { alignItems: "center", gap: 12 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 32, fontWeight: "900", color: "#fff" },
  changePhotoBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 100, borderWidth: 1,
  },
  changePhotoLabel: { fontSize: 13, fontWeight: "500" },

  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  input: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, fontSize: 16,
  },

  phoneDisplay: {
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  phoneText: { flex: 1, fontSize: 16 },
  lockedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
  },
  lockedLabel: { fontSize: 11, fontWeight: "600" },
  hint: { fontSize: 12, lineHeight: 17 },

  saveBtn: {
    paddingVertical: 16, borderRadius: 100,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700" },
});
