import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORIES } from "@/constants/mockData";
import { useColors } from "@/hooks/useColors";

const CATEGORY_COLORS: Record<string, { bg: string; icon: string }> = {
  restaurant: { bg: "#FF6835", icon: "#fff" },
  artisan:    { bg: "#8B5CF6", icon: "#fff" },
  beauty:     { bg: "#EC4899", icon: "#fff" },
  health:     { bg: "#10B981", icon: "#fff" },
  education:  { bg: "#3B82F6", icon: "#fff" },
  auto:       { bg: "#F59E0B", icon: "#fff" },
  tech:       { bg: "#06B6D4", icon: "#fff" },
  cleaning:   { bg: "#64748B", icon: "#fff" },
};

const DEFAULT_COLORS = { bg: "#1E3A5F", icon: "#fff" };

export default function CategoriesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleSelect = (catId: string) => {
    router.push({ pathname: "/(tabs)/search", params: { category: catId } } as any);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Parcourir les catégories</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Scrollable grid only */}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {CATEGORIES.map((cat) => {
            const c = CATEGORY_COLORS[cat.id] ?? DEFAULT_COLORS;
            return (
              <TouchableOpacity
                key={cat.id}
                style={[styles.tile, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleSelect(cat.id)}
                activeOpacity={0.82}
              >
                <View style={[styles.iconCircle, { backgroundColor: c.bg }]}>
                  <Feather name={cat.icon as any} size={28} color={c.icon} />
                </View>
                <Text style={[styles.tileLabel, { color: colors.text }]}>{cat.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Fixed bottom — "Vous avez un business ?" */}
      <View style={[styles.promoWrap, { paddingBottom: botPad + 12, backgroundColor: colors.background }]}>
        <TouchableOpacity
          style={[styles.promoCard, { backgroundColor: "#1E3A5F" }]}
          onPress={() => router.push("/pro/register" as any)}
          activeOpacity={0.88}
        >
          <View style={styles.promoCircle1} />
          <View style={styles.promoCircle2} />
          <View style={styles.promoContent}>
            <View style={[styles.promoIcon, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
              <Feather name="briefcase" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>Vous avez un business ?</Text>
              <Text style={styles.promoSub}>Inscrivez votre commerce et touchez des milliers de clients à Lomé</Text>
            </View>
            <Feather name="chevron-right" size={20} color="rgba(255,255,255,0.7)" />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },

  content: { paddingHorizontal: 20, paddingTop: 20 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  tile: {
    width: "47%",
    borderRadius: 20, borderWidth: 1,
    paddingVertical: 22, paddingHorizontal: 12,
    gap: 10,
    alignItems: "center",
  },
  iconCircle: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center",
  },
  tileLabel: { fontSize: 14, fontWeight: "700", textAlign: "center" },

  promoWrap: { paddingHorizontal: 20, paddingTop: 12 },
  promoCard: {
    borderRadius: 20, padding: 20, overflow: "hidden",
  },
  promoCircle1: {
    position: "absolute", width: 150, height: 150, borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.06)", top: -50, right: -30,
  },
  promoCircle2: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -30, left: -20,
  },
  promoContent: { flexDirection: "row", alignItems: "center", gap: 14 },
  promoIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  promoTitle: { fontSize: 15, fontWeight: "800", color: "#fff", marginBottom: 4 },
  promoSub: { fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 17 },
});
