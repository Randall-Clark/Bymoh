import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect } from "react";
import { Image, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading || isAuthenticated) return null;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad, paddingBottom: botPad + 24 }]}>
      <View style={styles.hero}>
        <View style={[styles.logoCircle, { backgroundColor: colors.primary }]}>
          <Feather name="map-pin" size={40} color="#fff" />
        </View>
        <Text style={[styles.appName, { color: colors.secondary }]}>Lokali</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
          Trouvez les meilleurs services{"\n"}et commerces près de chez vous
        </Text>
      </View>

      <View style={styles.categories}>
        {[
          { icon: "coffee", label: "Restaurants" },
          { icon: "scissors", label: "Beauté" },
          { icon: "tool", label: "Artisans" },
          { icon: "heart", label: "Santé" },
        ].map((c) => (
          <View key={c.label} style={[styles.catItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name={c.icon as any} size={20} color={colors.primary} />
            <Text style={[styles.catLabel, { color: colors.mutedForeground }]}>{c.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/auth/phone")}
          activeOpacity={0.85}
        >
          <Feather name="search" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Chercher un service</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.secondaryBtn, { backgroundColor: colors.card, borderColor: colors.secondary }]}
          onPress={() => router.push("/auth/phone")}
          activeOpacity={0.85}
        >
          <Feather name="briefcase" size={18} color={colors.secondary} />
          <Text style={[styles.secondaryBtnText, { color: colors.secondary }]}>
            Inscrire mon business
          </Text>
        </TouchableOpacity>

        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          En continuant, vous acceptez nos{" "}
          <Text style={{ color: colors.primary }}>conditions d'utilisation</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "space-between", paddingHorizontal: 24 },
  hero: { alignItems: "center", gap: 16, marginTop: 40 },
  logoCircle: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#FF6835", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 8,
  },
  appName: { fontSize: 40, fontWeight: "800", letterSpacing: -1 },
  tagline: { fontSize: 16, textAlign: "center", lineHeight: 24 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "center" },
  catItem: {
    alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 14,
    borderRadius: 16, borderWidth: 1, width: "44%",
  },
  catLabel: { fontSize: 12, fontWeight: "600" },
  actions: { gap: 12 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, borderRadius: 100,
    shadowColor: "#FF6835", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 12, elevation: 6,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, borderRadius: 100, borderWidth: 2,
  },
  secondaryBtnText: { fontSize: 16, fontWeight: "700" },
  legal: { fontSize: 11, textAlign: "center" },
});
