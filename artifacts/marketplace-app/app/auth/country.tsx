import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

export default function CountryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState("TG");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSelect = (code: string) => {
    Haptics.selectionAsync();
    setSelected(code);
  };

  const handleContinue = () => {
    const country = COUNTRIES.find((c) => c.code === selected)!;
    router.push({
      pathname: "/auth/phone",
      params: {
        dialCode: country.dialCode,
        flag: country.flag,
        placeholder: country.placeholder,
        maxLength: String(country.maxLength),
        countryCode: country.code,
      },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Title block */}
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: colors.text }]}>
          Choisissez votre pays
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Nous afficherons les commerces et services{"\n"}disponibles dans votre région.
        </Text>
      </View>

      {/* Country list */}
      <ScrollView
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {COUNTRIES.map((country) => {
          const isSelected = selected === country.code;
          return (
            <TouchableOpacity
              key={country.code}
              style={[
                styles.row,
                {
                  backgroundColor: isSelected ? colors.accent : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => handleSelect(country.code)}
              activeOpacity={0.82}
            >
              {/* Flag badge */}
              <View style={[styles.codeBadge, { backgroundColor: isSelected ? colors.primary + "22" : colors.muted }]}>
                <Text style={styles.flagEmoji}>{country.flag}</Text>
              </View>

              {/* Country name + dial code */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.countryName, { color: colors.text, fontWeight: isSelected ? "700" : "500" }]}>
                  {country.name}
                </Text>
                <Text style={[styles.dialCode, { color: colors.mutedForeground }]}>
                  {country.dialCode}
                </Text>
              </View>

              {/* Checkmark */}
              {isSelected ? (
                <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                  <Feather name="check" size={14} color="#fff" />
                </View>
              ) : (
                <View style={{ width: 28 }} />
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Continue button */}
      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            paddingBottom: botPad + 20,
            backgroundColor: colors.background,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.continueBtn, { backgroundColor: colors.primary }]}
          onPress={handleContinue}
          activeOpacity={0.88}
        >
          <Text style={styles.continueBtnText}>Continuer</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  titleBlock: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24, gap: 8 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },
  list: { paddingHorizontal: 20, gap: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 14,
  },
  codeBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  flagEmoji: { fontSize: 26 },
  countryName: { fontSize: 16 },
  dialCode: { fontSize: 12, marginTop: 1 },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 100,
  },
  continueBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
