import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
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

const COUNTRIES = [
  { code: "TG", name: "Togo", dialCode: "+228", flag: "🇹🇬", placeholder: "90 00 00 00", maxLength: 10 },
  { code: "BJ", name: "Bénin", dialCode: "+229", flag: "🇧🇯", placeholder: "90 00 00 00", maxLength: 10 },
  { code: "CI", name: "Côte d'Ivoire", dialCode: "+225", flag: "🇨🇮", placeholder: "07 00 00 00 00", maxLength: 12 },
  { code: "SN", name: "Sénégal", dialCode: "+221", flag: "🇸🇳", placeholder: "70 000 00 00", maxLength: 11 },
  { code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭", placeholder: "20 000 0000", maxLength: 11 },
  { code: "CM", name: "Cameroun", dialCode: "+237", flag: "🇨🇲", placeholder: "6 00 00 00 00", maxLength: 11 },
  { code: "ML", name: "Mali", dialCode: "+223", flag: "🇲🇱", placeholder: "70 00 00 00", maxLength: 10 },
  { code: "BF", name: "Burkina Faso", dialCode: "+226", flag: "🇧🇫", placeholder: "70 00 00 00", maxLength: 10 },
];

export default function PhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { checkPhone } = useAuth();

  const params = useLocalSearchParams<{
    register?: string;
    dialCode?: string;
    flag?: string;
    placeholder?: string;
    maxLength?: string;
    countryCode?: string;
  }>();

  const isRegister = params.register === "true";

  const [selectedCountry, setSelectedCountry] = useState(
    COUNTRIES.find((c) => c.dialCode === params.dialCode) ?? COUNTRIES[0]
  );
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [phone, setPhone] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValid = phone.replace(/\s/g, "").length >= 7;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleNext = async () => {
    if (!isValid || loading) return;
    setError("");
    const fullPhone = `${selectedCountry.dialCode}${phone.replace(/\s/g, "")}`;

    if (isRegister) {
      router.push({
        pathname: "/auth/otp",
        params: { phone: fullPhone, countryCode: selectedCountry.code },
      });
      return;
    }

    setLoading(true);
    const exists = await checkPhone(fullPhone);
    setLoading(false);

    if (exists) {
      router.push({ pathname: "/auth/pin", params: { phone: fullPhone } });
    } else {
      setError("Aucun compte trouvé pour ce numéro. Créez votre compte ci-dessous.");
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Back arrow only for register mode */}
      {isRegister && (
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}
      {!isRegister && <View style={{ height: topPad + 20 }} />}

      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
          <Feather name={isRegister ? "smartphone" : "log-in"} size={28} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          {isRegister ? "Votre numéro" : "Connexion"}
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {isRegister
            ? "Entrez votre numéro pour recevoir un code de vérification."
            : "Entrez votre numéro pour accéder à votre compte."}
        </Text>

        {/* Phone input row */}
        <View style={styles.inputGroup}>
          <TouchableOpacity
            style={[styles.countryCode, { backgroundColor: colors.muted, borderColor: colors.border }]}
            onPress={() => setShowCountryPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.flag}>{selectedCountry.flag}</Text>
            <Text style={[styles.code, { color: colors.text }]}>{selectedCountry.dialCode}</Text>
            <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
          </TouchableOpacity>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.card,
                borderColor: focused ? colors.primary : error ? "#EF4444" : colors.border,
                color: colors.text,
              },
            ]}
            placeholder={selectedCountry.placeholder}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(t) => { setPhone(t); setError(""); }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            maxLength={selectedCountry.maxLength}
            autoFocus
          />
        </View>

        {/* Error message */}
        {!!error && (
          <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* CTA button */}
        <TouchableOpacity
          style={[styles.btn, { backgroundColor: isValid ? colors.primary : colors.muted }]}
          onPress={handleNext}
          disabled={!isValid || loading}
          activeOpacity={0.85}
        >
          <Text style={[styles.btnText, { color: isValid ? "#fff" : colors.mutedForeground }]}>
            {loading ? "Vérification…" : isRegister ? "Recevoir le code" : "Continuer"}
          </Text>
          {!loading && <Feather name="arrow-right" size={18} color={isValid ? "#fff" : colors.mutedForeground} />}
        </TouchableOpacity>

        {/* Register link (only in login mode) */}
        {!isRegister && (
          <TouchableOpacity
            onPress={() => router.push("/auth/country")}
            activeOpacity={0.75}
            style={styles.registerLink}
          >
            <Text style={[styles.registerLinkText, { color: colors.mutedForeground }]}>
              Vous n'avez pas de compte ?{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>S'inscrire</Text>
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Inline country picker modal */}
      <Modal visible={showCountryPicker} animationType="slide" transparent onRequestClose={() => setShowCountryPicker(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} onPress={() => setShowCountryPicker(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Choisir un pays</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Feather name="x" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {COUNTRIES.map((country) => {
                const isSelected = country.code === selectedCountry.code;
                return (
                  <TouchableOpacity
                    key={country.code}
                    style={[
                      styles.countryRow,
                      { backgroundColor: isSelected ? colors.accent : "transparent", borderBottomColor: colors.border },
                    ]}
                    onPress={() => { setSelectedCountry(country); setShowCountryPicker(false); setPhone(""); }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.countryFlag}>{country.flag}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.countryName, { color: colors.text, fontWeight: isSelected ? "700" : "500" }]}>
                        {country.name}
                      </Text>
                    </View>
                    <Text style={[styles.countryDial, { color: colors.mutedForeground }]}>{country.dialCode}</Text>
                    {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  content: { flex: 1, paddingHorizontal: 24, gap: 18, paddingTop: 8 },
  iconWrap: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { fontSize: 15, lineHeight: 22 },
  inputGroup: { flexDirection: "row", gap: 10 },
  countryCode: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, borderRadius: 12, borderWidth: 1,
  },
  flag: { fontSize: 20 },
  code: { fontSize: 15, fontWeight: "700" },
  input: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, fontSize: 18,
    letterSpacing: 2, fontWeight: "600",
  },
  errorBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, color: "#EF4444", lineHeight: 18 },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 100,
  },
  btnText: { fontSize: 16, fontWeight: "700" },
  registerLink: { alignItems: "center", paddingVertical: 4 },
  registerLinkText: { fontSize: 14, textAlign: "center" },

  /* Modal */
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "75%", overflow: "hidden" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 17, fontWeight: "700" },
  countryRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 0.5,
  },
  countryFlag: { fontSize: 24 },
  countryName: { fontSize: 15 },
  countryDial: { fontSize: 14, marginRight: 8 },
});
