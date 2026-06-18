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
  { code: "TG", name: "Togo", dialCode: "+228" },
  { code: "BJ", name: "Bénin", dialCode: "+229" },
  { code: "CI", name: "Côte d'Ivoire", dialCode: "+225" },
  { code: "SN", name: "Sénégal", dialCode: "+221" },
  { code: "GH", name: "Ghana", dialCode: "+233" },
  { code: "CM", name: "Cameroun", dialCode: "+237" },
  { code: "ML", name: "Mali", dialCode: "+223" },
  { code: "BF", name: "Burkina Faso", dialCode: "+226" },
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
    router.push("/auth/phone");
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
                  backgroundColor: isSelected
                    ? colors.accent
                    : colors.card,
                  borderColor: isSelected ? colors.primary : colors.border,
                  borderWidth: isSelected ? 2 : 1,
                },
              ]}
              onPress={() => handleSelect(country.code)}
              activeOpacity={0.82}
            >
              {/* Code badge */}
              <View
                style={[
                  styles.codeBadge,
                  { backgroundColor: colors.accent },
                ]}
              >
                <Text style={[styles.codeText, { color: colors.primary }]}>
                  {country.code}
                </Text>
              </View>

              {/* Country name */}
              <Text
                style={[
                  styles.countryName,
                  { color: colors.text, fontWeight: isSelected ? "700" : "500" },
                ]}
              >
                {country.name}
              </Text>

              {/* Checkmark */}
              {isSelected ? (
                <View
                  style={[
                    styles.checkCircle,
                    { backgroundColor: colors.primary },
                  ]}
                >
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
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 14,
  },
  codeBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  codeText: { fontSize: 14, fontWeight: "800", letterSpacing: 0.5 },
  countryName: { flex: 1, fontSize: 17 },
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
