import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { api, getMediaUrl } from "@/lib/api";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [avatarUri, setAvatarUri] = useState<string | null>(null); // local preview
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const isValid = name.trim().length >= 2;

  const displayAvatarUrl = avatarUri ?? (user?.avatar ? getMediaUrl(user.avatar) : null);

  const initials = name.trim()
    ? name.trim().split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  // ── Photo picker ─────────────────────────────────────────────────────────────
  const handlePickPhoto = async () => {
    try {
      // Request permission on native
      if ((Platform.OS as string) !== "web") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      setAvatarUri(asset.uri);

      if (!asset.base64) return;
      setUploadingPhoto(true);
      try {
        const mimeType = asset.mimeType ?? "image/jpeg";
        const updated = await api.post<{ avatarUrl?: string }>("/users/me/avatar", {
          imageBase64: asset.base64,
          mimeType,
        });
        if (updated.avatarUrl) {
          await updateUser({ avatar: updated.avatarUrl });
        }
      } catch {
        // Photo uploaded with preview but server save failed silently
      } finally {
        setUploadingPhoto(false);
      }
    } catch {
      // Permission denied or picker error
    }
  };

  // ── Save profile ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    try {
      await api.patch("/users/me", {
        name: name.trim(),
        email: email.trim() || undefined,
      });
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
        {/* ── Avatar ── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickPhoto} style={styles.avatarWrap} activeOpacity={0.85}>
            {displayAvatarUrl ? (
              <Image
                source={{ uri: displayAvatarUrl }}
                style={styles.avatarImg}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.avatarImg, { backgroundColor: "#E84B1A", alignItems: "center", justifyContent: "center" }]}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            )}
            {/* Overlay camera icon */}
            <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
              {uploadingPhoto
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="camera" size={14} color="#fff" />}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.75}>
            <Text style={[styles.changePhotoLabel, { color: colors.primary }]}>
              {uploadingPhoto ? "Téléchargement…" : "Changer la photo"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Form ── */}
        <View style={styles.form}>
          {/* Name */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Prénom / Nom complet</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.card,
                borderColor: name.trim().length >= 2 ? colors.primary : colors.border,
                color: colors.text,
              }]}
              placeholder="Ex : Kofi Mensah"
              placeholderTextColor={colors.mutedForeground}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              returnKeyType="next"
            />
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Adresse e-mail</Text>
            <TextInput
              style={[styles.input, {
                backgroundColor: colors.card,
                borderColor: colors.border,
                color: colors.text,
              }]}
              placeholder="exemple@email.com"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSave}
            />
          </View>

          {/* Phone — editable via verification flow */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Numéro de téléphone</Text>
            <View style={[styles.phoneRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name="phone" size={15} color={colors.mutedForeground} style={{ marginLeft: 16 }} />
              <Text style={[styles.phoneText, { color: colors.text }]}>
                {user?.phone ?? "—"}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/profile/change-phone")}
                style={[styles.changePhoneBtn, { backgroundColor: colors.accent }]}
                activeOpacity={0.8}
              >
                <Feather name="edit-2" size={12} color={colors.primary} />
                <Text style={[styles.changePhoneBtnLabel, { color: colors.primary }]}>Modifier</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              Une vérification par OTP sera requise pour changer votre numéro.
            </Text>
          </View>
        </View>

        {/* ── Save button ── */}
        <TouchableOpacity
          style={[styles.saveBtn, {
            backgroundColor: saved ? "#22C55E" : isValid ? "#E84B1A" : colors.muted,
          }]}
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },

  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 48, gap: 28 },

  avatarSection: { alignItems: "center", gap: 10 },
  avatarWrap: { position: "relative" },
  avatarImg: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { fontSize: 34, fontWeight: "900", color: "#fff" },
  cameraOverlay: {
    position: "absolute", bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#fff",
  },
  changePhotoLabel: { fontSize: 13, fontWeight: "600" },

  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  input: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, fontSize: 16,
  },

  phoneRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: 12, borderWidth: 1.5, gap: 10,
    paddingVertical: 10, paddingRight: 10,
  },
  phoneText: { flex: 1, fontSize: 16, paddingVertical: 4 },
  changePhoneBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  changePhoneBtnLabel: { fontSize: 12, fontWeight: "700" },

  hint: { fontSize: 12, lineHeight: 17 },

  saveBtn: {
    paddingVertical: 16, borderRadius: 100,
    alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 8,
  },
  saveBtnText: { fontSize: 16, fontWeight: "700" },
});
