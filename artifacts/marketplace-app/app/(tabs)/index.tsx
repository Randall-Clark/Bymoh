import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BusinessCard from "@/components/BusinessCard";
import CategoryPill from "@/components/CategoryPill";
import { CATEGORIES, MOCK_BUSINESSES } from "@/constants/mockData";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, toggleFavorite } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const filtered = MOCK_BUSINESSES.filter((b) => {
    const matchCat = selectedCategory ? b.category === selectedCategory : true;
    const matchSearch = searchQuery
      ? b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.category.toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    return matchCat && matchSearch;
  });

  const open = filtered.filter((b) => b.isOpen);
  const nearby = filtered.filter((b) => parseFloat(b.distance) < 2.5);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 12, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View style={styles.greet}>
        <View>
          <Text style={[styles.hello, { color: colors.mutedForeground }]}>Bonjour 👋</Text>
          <Text style={[styles.name, { color: colors.text }]}>{user?.name ?? "Bienvenue"}</Text>
        </View>
        <TouchableOpacity
          style={[styles.notifBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/notifications")}
        >
          <Feather name="bell" size={20} color={colors.text} />
          <View style={[styles.notifDot, { backgroundColor: colors.primary }]} />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <TouchableOpacity
        style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push("/(tabs)/search")}
        activeOpacity={0.85}
      >
        <Feather name="search" size={18} color={colors.mutedForeground} />
        <Text style={[styles.searchPlaceholder, { color: colors.mutedForeground }]}>
          Rechercher un service, commerce...
        </Text>
        <View style={[styles.filterBtn, { backgroundColor: colors.primary }]}>
          <Feather name="sliders" size={14} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Categories */}
      <View>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Catégories</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
          <CategoryPill
            label="Tout"
            icon="grid"
            selected={selectedCategory === null}
            onPress={() => setSelectedCategory(null)}
          />
          {CATEGORIES.map((c) => (
            <CategoryPill
              key={c.id}
              label={c.label}
              icon={c.icon}
              selected={selectedCategory === c.id}
              onPress={() => setSelectedCategory(c.id === selectedCategory ? null : c.id)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Open Now */}
      {open.length > 0 && (
        <View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Ouverts maintenant</Text>
            <View style={[styles.openDot, { backgroundColor: colors.success }]} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
            {open.map((b) => (
              <BusinessCard
                key={b.id}
                business={b}
                style={styles.hCard}
                onPress={() => router.push({ pathname: "/business/[id]", params: { id: b.id } })}
                isFavorite={user?.favoriteIds.includes(b.id)}
                onFavoriteToggle={() => toggleFavorite(b.id)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* Nearby */}
      {nearby.length > 0 && (
        <View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>À proximité</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/search")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {nearby.map((b) => (
            <BusinessCard
              key={b.id}
              business={b}
              style={styles.vCard}
              onPress={() => router.push({ pathname: "/business/[id]", params: { id: b.id } })}
              isFavorite={user?.favoriteIds.includes(b.id)}
              onFavoriteToggle={() => toggleFavorite(b.id)}
            />
          ))}
        </View>
      )}

      {filtered.length === 0 && (
        <View style={styles.empty}>
          <Feather name="search" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Aucun résultat trouvé</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 24 },
  greet: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  hello: { fontSize: 14 },
  name: { fontSize: 22, fontWeight: "800" },
  notifBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, position: "relative",
  },
  notifDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  searchPlaceholder: { flex: 1, fontSize: 14 },
  filterBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  openDot: { width: 8, height: 8, borderRadius: 4 },
  seeAll: { fontSize: 13, fontWeight: "600", marginLeft: "auto" },
  catRow: { gap: 8, paddingVertical: 4 },
  hRow: { gap: 14, paddingVertical: 4 },
  hCard: { width: 220 },
  vCard: { marginBottom: 14 },
  empty: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 16 },
});
