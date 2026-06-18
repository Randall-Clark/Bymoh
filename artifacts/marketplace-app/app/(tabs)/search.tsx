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
import EmptyState from "@/components/EmptyState";
import { CATEGORIES, MOCK_BUSINESSES } from "@/constants/mockData";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, toggleFavorite } = useAuth();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const results = MOCK_BUSINESSES.filter((b) => {
    const matchQ = !query || b.name.toLowerCase().includes(query.toLowerCase()) ||
      b.category.toLowerCase().includes(query.toLowerCase()) ||
      b.city.toLowerCase().includes(query.toLowerCase());
    const matchCat = !selectedCategory || b.category === selectedCategory;
    const matchOpen = !openOnly || b.isOpen;
    const matchDel = !deliveryOnly || b.hasDelivery;
    return matchQ && matchCat && matchOpen && matchDel;
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View style={[styles.searchHeader, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: focused ? colors.primary : colors.border }]}>
          <Feather name="search" size={18} color={colors.mutedForeground} />
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="Restaurant, coiffeur, artisan..."
            placeholderTextColor={colors.mutedForeground}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoFocus
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={[styles.filtersContainer, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          <TouchableOpacity
            style={[styles.filterChip, { backgroundColor: openOnly ? colors.primary : colors.card, borderColor: openOnly ? colors.primary : colors.border }]}
            onPress={() => setOpenOnly(!openOnly)}
          >
            <View style={[styles.openDot, { backgroundColor: openOnly ? "#fff" : colors.success }]} />
            <Text style={[styles.chipLabel, { color: openOnly ? "#fff" : colors.text }]}>Ouvert</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, { backgroundColor: deliveryOnly ? colors.primary : colors.card, borderColor: deliveryOnly ? colors.primary : colors.border }]}
            onPress={() => setDeliveryOnly(!deliveryOnly)}
          >
            <Feather name="package" size={12} color={deliveryOnly ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.chipLabel, { color: deliveryOnly ? "#fff" : colors.text }]}>Livraison</Text>
          </TouchableOpacity>
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

      {/* Results */}
      {results.length === 0 ? (
        <EmptyState
          icon="search"
          title="Aucun résultat"
          subtitle="Essayez d'autres mots-clés ou ajustez vos filtres"
          actionLabel="Effacer les filtres"
          onAction={() => { setQuery(""); setSelectedCategory(null); setOpenOnly(false); setDeliveryOnly(false); }}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={[styles.count, { color: colors.mutedForeground }]}>
              {results.length} résultat{results.length > 1 ? "s" : ""}
            </Text>
          }
          renderItem={({ item }) => (
            <BusinessCard
              business={item}
              style={styles.card}
              onPress={() => router.push({ pathname: "/business/[id]", params: { id: item.id } })}
              isFavorite={user?.favoriteIds.includes(item.id)}
              onFavoriteToggle={() => toggleFavorite(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchHeader: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 15 },
  filtersContainer: { borderBottomWidth: 1 },
  filters: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1,
  },
  openDot: { width: 7, height: 7, borderRadius: 3.5 },
  chipLabel: { fontSize: 12, fontWeight: "600" },
  list: { padding: 16, gap: 14 },
  count: { fontSize: 13, marginBottom: 4 },
  card: {},
});
