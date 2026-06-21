import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { getSearchBusinessesQueryKey, useSearchBusinesses } from "@workspace/api-client-react";
import BusinessCard from "@/components/BusinessCard";
import CategoryPill from "@/components/CategoryPill";
import EmptyState from "@/components/EmptyState";
import { ALL_CITIES, CITY_BY_COUNTRY } from "@/constants/cities";
import { CATEGORIES } from "@/constants/mockData";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "@/context/LocationContext";
import { useColors } from "@/hooks/useColors";

// ─── Filter / sort types ────────────────────────────────────────────────────────
type SortKey = "relevance" | "rating" | "distance" | "popular";
type RatingFilter = null | 3 | 4 | 4.5;

const SORT_OPTIONS: { key: SortKey; label: string; icon: string }[] = [
  { key: "relevance",  label: "Pertinence",       icon: "zap" },
  { key: "rating",     label: "Meilleures notes", icon: "star" },
  { key: "distance",   label: "Plus proches",     icon: "map-pin" },
  { key: "popular",    label: "Plus populaires",  icon: "trending-up" },
];

const RATING_OPTIONS: { value: RatingFilter; label: string }[] = [
  { value: null, label: "Toutes" },
  { value: 3,    label: "3★ et +" },
  { value: 4,    label: "4★ et +" },
  { value: 4.5,  label: "4.5★ et +" },
];

// ─── Screen ─────────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, toggleFavorite } = useAuth();
  const params = useLocalSearchParams<{ category?: string }>();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Default city: from saved address → user's country → Lomé
  const { address } = useLocation();
  const defaultCity = address?.city ?? CITY_BY_COUNTRY[user?.countryCode ?? "TG"] ?? "Lomé";

  // ── Search state ──
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Filter state ──
  const [selectedCity, setSelectedCity] = useState(defaultCity);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
  const [deliveryOnly, setDeliveryOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("relevance");
  const [minRating, setMinRating] = useState<RatingFilter>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Pre-select category from navigation params
  useEffect(() => {
    if (params.category) setSelectedCategory(params.category);
  }, [params.category]);

  // Debounce text search (400 ms)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedQuery(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // ── API call ──
  const searchParams = {
    city: selectedCity,
    ...(selectedCategory ? { category: selectedCategory } : {}),
    ...(debouncedQuery ? { search: debouncedQuery } : {}),
    ...(deliveryOnly ? { hasDelivery: "true" as const } : {}),
  };

  const { data: rawBusinesses, isLoading } = useSearchBusinesses(searchParams, {
    query: { queryKey: getSearchBusinessesQueryKey(searchParams), staleTime: 60_000 },
  });

  // ── Client-side filters ──
  let results = (rawBusinesses ?? []).filter((b) => {
    if (openOnly && !b.isOpen) return false;
    if (minRating && (b.rating ?? 0) < minRating) return false;
    return true;
  });

  // ── Client-side sort ──
  if (sortBy === "rating") {
    results = [...results].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else if (sortBy === "popular") {
    results = [...results].sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
  }

  const cityChanged = selectedCity !== defaultCity;

  // ── Filter badge count ──
  const activeFilterCount = [
    openOnly,
    deliveryOnly,
    minRating !== null,
    selectedCategory !== null,
    sortBy !== "relevance",
    cityChanged,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedCity(defaultCity);
    setSelectedCategory(null);
    setOpenOnly(false);
    setDeliveryOnly(false);
    setMinRating(null);
    setSortBy("relevance");
  };

  const activeSortLabel = SORT_OPTIONS.find((s) => s.key === sortBy)?.label ?? "Pertinence";

  const cityMeta = ALL_CITIES.find((c) => c.name === selectedCity);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Search bar */}
      <View style={[styles.searchHeader, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: focused ? colors.primary : colors.border, flex: 1 }]}>
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
              <TouchableOpacity onPress={() => { setQuery(""); setDebouncedQuery(""); }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Feather name="x" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter button */}
          <TouchableOpacity
            style={[styles.filterBtn, {
              backgroundColor: activeFilterCount > 0 ? colors.primary : colors.card,
              borderColor: activeFilterCount > 0 ? colors.primary : colors.border,
            }]}
            onPress={() => setFilterSheetOpen(true)}
          >
            <Feather name="sliders" size={17} color={activeFilterCount > 0 ? "#fff" : colors.text} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick filter bar */}
      <View style={[styles.quickBar, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickBarContent}>
          {/* Location chip — always visible, highlighted when changed */}
          <TouchableOpacity
            style={[styles.chip, {
              backgroundColor: cityChanged ? colors.primary : colors.card,
              borderColor: cityChanged ? colors.primary : colors.border,
            }]}
            onPress={() => setFilterSheetOpen(true)}
          >
            <Feather name="map-pin" size={12} color={cityChanged ? "#fff" : colors.primary} />
            <Text style={[styles.chipLabel, { color: cityChanged ? "#fff" : colors.text }]}>
              {cityMeta ? `${cityMeta.flag} ${selectedCity}` : selectedCity}
            </Text>
          </TouchableOpacity>

          {/* Sort chip */}
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: sortBy !== "relevance" ? colors.primary : colors.card, borderColor: sortBy !== "relevance" ? colors.primary : colors.border }]}
            onPress={() => setFilterSheetOpen(true)}
          >
            <Feather name="align-justify" size={12} color={sortBy !== "relevance" ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.chipLabel, { color: sortBy !== "relevance" ? "#fff" : colors.text }]}>{activeSortLabel}</Text>
          </TouchableOpacity>

          {/* Open chip */}
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: openOnly ? colors.primary : colors.card, borderColor: openOnly ? colors.primary : colors.border }]}
            onPress={() => setOpenOnly(!openOnly)}
          >
            <View style={[styles.openDot, { backgroundColor: openOnly ? "#fff" : colors.success }]} />
            <Text style={[styles.chipLabel, { color: openOnly ? "#fff" : colors.text }]}>Ouvert</Text>
          </TouchableOpacity>

          {/* Delivery chip */}
          <TouchableOpacity
            style={[styles.chip, { backgroundColor: deliveryOnly ? colors.primary : colors.card, borderColor: deliveryOnly ? colors.primary : colors.border }]}
            onPress={() => setDeliveryOnly(!deliveryOnly)}
          >
            <Feather name="package" size={12} color={deliveryOnly ? "#fff" : colors.mutedForeground} />
            <Text style={[styles.chipLabel, { color: deliveryOnly ? "#fff" : colors.text }]}>Livraison</Text>
          </TouchableOpacity>

          {/* Rating chip (when active) */}
          {minRating !== null && (
            <TouchableOpacity
              style={[styles.chip, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setMinRating(null)}
            >
              <Feather name="star" size={12} color="#fff" />
              <Text style={[styles.chipLabel, { color: "#fff" }]}>{minRating}★+</Text>
              <Feather name="x" size={11} color="#fff" />
            </TouchableOpacity>
          )}

          {/* Category pills */}
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
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : results.length === 0 ? (
        <EmptyState
          icon="search"
          title="Aucun résultat"
          subtitle={`Aucun commerce trouvé à ${selectedCity} avec ces critères`}
          actionLabel="Effacer les filtres"
          onAction={clearFilters}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 16 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.resultsHeader}>
              <Text style={[styles.count, { color: colors.mutedForeground }]}>
                {results.length} résultat{results.length > 1 ? "s" : ""} à {selectedCity}
              </Text>
              {activeFilterCount > 0 && (
                <TouchableOpacity onPress={clearFilters}>
                  <Text style={[styles.clearAll, { color: colors.primary }]}>Effacer tout</Text>
                </TouchableOpacity>
              )}
            </View>
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

      {/* ── Filter bottom sheet ── */}
      <Modal visible={filterSheetOpen} transparent animationType="slide">
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} onPress={() => setFilterSheetOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.card }]}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeaderRow}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Trier et filtrer</Text>
              <TouchableOpacity onPress={clearFilters}>
                <Text style={[styles.sheetReset, { color: colors.primary }]}>Réinitialiser</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 24, paddingBottom: botPad + 24 }}>

              {/* ── Localisation ── */}
              <View style={styles.sheetSection}>
                <View style={styles.sheetSectionHeader}>
                  <Feather name="map-pin" size={15} color={colors.primary} />
                  <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>Localisation</Text>
                  {cityChanged && (
                    <TouchableOpacity onPress={() => setSelectedCity(defaultCity)} style={[styles.resetCityBtn, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.resetCityText, { color: colors.primary }]}>Remettre {defaultCity}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityRow}>
                  {ALL_CITIES.map((c) => {
                    const active = selectedCity === c.name;
                    return (
                      <TouchableOpacity
                        key={c.name}
                        style={[styles.cityChip, {
                          backgroundColor: active ? colors.primary : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                        }]}
                        onPress={() => setSelectedCity(c.name)}
                      >
                        <Text style={styles.cityFlag}>{c.flag}</Text>
                        <View>
                          <Text style={[styles.cityName, { color: active ? "#fff" : colors.text }]}>{c.name}</Text>
                          <Text style={[styles.cityCountry, { color: active ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>{c.country}</Text>
                        </View>
                        {active && <Feather name="check" size={13} color="#fff" style={{ marginLeft: 2 }} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* ── Sort ── */}
              <View style={styles.sheetSection}>
                <View style={styles.sheetSectionHeader}>
                  <Feather name="bar-chart-2" size={15} color={colors.primary} />
                  <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>Trier par</Text>
                </View>
                <View style={styles.sheetOptions}>
                  {SORT_OPTIONS.map((s) => {
                    const active = sortBy === s.key;
                    return (
                      <TouchableOpacity
                        key={s.key}
                        style={[styles.sheetOption, {
                          backgroundColor: active ? colors.primary : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                        }]}
                        onPress={() => setSortBy(s.key)}
                      >
                        <Feather name={s.icon as any} size={16} color={active ? "#fff" : colors.mutedForeground} />
                        <Text style={[styles.sheetOptionLabel, { color: active ? "#fff" : colors.text }]}>{s.label}</Text>
                        {active && <Feather name="check" size={15} color="#fff" style={{ marginLeft: "auto" }} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Rating ── */}
              <View style={styles.sheetSection}>
                <View style={styles.sheetSectionHeader}>
                  <Feather name="star" size={15} color={colors.primary} />
                  <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>Note minimale</Text>
                </View>
                <View style={styles.ratingRow}>
                  {RATING_OPTIONS.map((r) => {
                    const active = minRating === r.value;
                    return (
                      <TouchableOpacity
                        key={String(r.value)}
                        style={[styles.ratingChip, {
                          backgroundColor: active ? colors.primary : colors.background,
                          borderColor: active ? colors.primary : colors.border,
                        }]}
                        onPress={() => setMinRating(r.value)}
                      >
                        {r.value !== null && <Feather name="star" size={13} color={active ? "#fff" : "#F59E0B"} />}
                        <Text style={[styles.ratingChipLabel, { color: active ? "#fff" : colors.text }]}>{r.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* ── Options ── */}
              <View style={styles.sheetSection}>
                <View style={styles.sheetSectionHeader}>
                  <Feather name="settings" size={15} color={colors.primary} />
                  <Text style={[styles.sheetSectionTitle, { color: colors.text }]}>Options</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggleRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => setOpenOnly(!openOnly)}
                >
                  <View style={[styles.toggleIcon, { backgroundColor: openOnly ? "#DCFCE7" : colors.muted }]}>
                    <Feather name="clock" size={18} color={openOnly ? "#16A34A" : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>Ouvert maintenant</Text>
                    <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>Afficher uniquement les commerces ouverts</Text>
                  </View>
                  <View style={[styles.toggleDot, { backgroundColor: openOnly ? colors.primary : colors.border }]}>
                    {openOnly && <Feather name="check" size={12} color="#fff" />}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.toggleRow, { backgroundColor: colors.background, borderColor: colors.border }]}
                  onPress={() => setDeliveryOnly(!deliveryOnly)}
                >
                  <View style={[styles.toggleIcon, { backgroundColor: deliveryOnly ? colors.accent : colors.muted }]}>
                    <Feather name="package" size={18} color={deliveryOnly ? colors.primary : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.toggleLabel, { color: colors.text }]}>Avec livraison</Text>
                    <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>Gozem, Yango ou livraison propre</Text>
                  </View>
                  <View style={[styles.toggleDot, { backgroundColor: deliveryOnly ? colors.primary : colors.border }]}>
                    {deliveryOnly && <Feather name="check" size={12} color="#fff" />}
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Apply button */}
            <TouchableOpacity
              style={[styles.applyBtn, { backgroundColor: colors.primary }]}
              onPress={() => setFilterSheetOpen(false)}
            >
              <Text style={styles.applyBtnText}>
                Appliquer{activeFilterCount > 0 ? ` (${activeFilterCount} filtre${activeFilterCount > 1 ? "s" : ""})` : ""}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  searchHeader: { paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 15 },
  filterBtn: {
    width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, position: "relative",
  },
  filterBadge: {
    position: "absolute", top: -4, right: -4, width: 18, height: 18, borderRadius: 9,
    backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center",
  },
  filterBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },

  quickBar: { borderBottomWidth: 1 },
  quickBarContent: { gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1,
  },
  openDot: { width: 7, height: 7, borderRadius: 3.5 },
  chipLabel: { fontSize: 12, fontWeight: "600" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  list: { padding: 16, gap: 14 },
  resultsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  count: { fontSize: 13 },
  clearAll: { fontSize: 13, fontWeight: "600" },
  card: {},

  // Filter sheet
  sheetOverlay: { flex: 1, justifyContent: "flex-end" },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24,
    gap: 20, maxHeight: "92%",
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 4 },
  sheetHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 20, fontWeight: "800" },
  sheetReset: { fontSize: 14, fontWeight: "600" },

  sheetSection: { gap: 12 },
  sheetSectionHeader: { flexDirection: "row", alignItems: "center", gap: 7 },
  sheetSectionTitle: { fontSize: 15, fontWeight: "700", flex: 1 },

  // City selector
  cityRow: { gap: 8, paddingVertical: 2 },
  cityChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5,
  },
  cityFlag: { fontSize: 20 },
  cityName: { fontSize: 13, fontWeight: "700" },
  cityCountry: { fontSize: 11, marginTop: 1 },
  resetCityBtn: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  resetCityText: { fontSize: 12, fontWeight: "600" },

  sheetOptions: { gap: 8 },
  sheetOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1.5,
  },
  sheetOptionLabel: { fontSize: 14, fontWeight: "600" },

  ratingRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  ratingChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5,
  },
  ratingChipLabel: { fontSize: 13, fontWeight: "600" },

  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 14, borderRadius: 16, borderWidth: 1,
  },
  toggleIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  toggleLabel: { fontSize: 14, fontWeight: "700" },
  toggleSub: { fontSize: 12, marginTop: 2 },
  toggleDot: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },

  applyBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  applyBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
