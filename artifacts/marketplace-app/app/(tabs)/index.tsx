import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useEffect, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BusinessCard from "@/components/BusinessCard";
import CategoryPill from "@/components/CategoryPill";
import { CATEGORIES, MOCK_BUSINESSES } from "@/constants/mockData";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

// ─── Doodle grid constants (same as splash) ────────────────────────────────────
const { width: W } = Dimensions.get("window");
const BG = "#E84B1A";
const BG_DARK = "#C93E12";
const DOODLE_COLOR = "rgba(255,255,255,0.13)";
const TILE = 72;
const COLS = Math.ceil(W / TILE) + 4;
const HEADER_ROWS = 5;
const SYMBOLS = ["+", "◇", "○", "∧", "~", "⊕", "Ш", "M", "☀", "△", "×", "⌀"];

function seededPick(row: number, col: number): string {
  const i = Math.abs((row * 7 + col * 13) ^ (row + col * 3)) % SYMBOLS.length;
  return SYMBOLS[i];
}

const HEADER_CELLS = Array.from({ length: HEADER_ROWS }, (_, row) =>
  Array.from({ length: COLS }, (_, col) => ({
    key: `${row}-${col}`,
    symbol: seededPick(row, col),
    row,
    col,
  }))
).flat();

const USE_NATIVE = Platform.OS !== "web";

// ─── Home Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, toggleFavorite } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Animated doodle diagonal shift (same as splash)
  const shift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shift, {
        toValue: TILE,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE,
      })
    ).start();
  }, [shift]);

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
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Fixed header: orange + doodles ── */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: BG }]}>
        {/* Blob decoration */}
        <View style={styles.blobTopRight} />

        {/* Animated doodle grid */}
        <Animated.View
          style={[
            styles.doodleContainer,
            { transform: [{ translateX: shift }, { translateY: shift }] },
          ]}
          pointerEvents="none"
        >
          {HEADER_CELLS.map(({ key, symbol, row, col }) => (
            <Text
              key={key}
              style={[styles.doodle, { left: col * TILE - TILE, top: row * TILE - TILE }]}
            >
              {symbol}
            </Text>
          ))}
        </Animated.View>

        {/* Greeting row */}
        <View style={styles.greet}>
          <View>
            <Text style={styles.hello}>Bonjour 👋</Text>
            <Text style={styles.name}>{user?.name ?? "Bienvenue"}</Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push("/notifications")}
          >
            <Feather name="bell" size={20} color="#fff" />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <TouchableOpacity
          style={styles.searchBox}
          onPress={() => router.push("/(tabs)/search")}
          activeOpacity={0.85}
        >
          <Feather name="search" size={18} color="rgba(255,255,255,0.75)" />
          <Text style={styles.searchPlaceholder}>
            Rechercher un service, commerce...
          </Text>
          <View style={styles.filterBtn}>
            <Feather name="sliders" size={14} color={BG} />
          </View>
        </TouchableOpacity>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
    overflow: "hidden",
    zIndex: 10,
    // iOS shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    // Android
    elevation: 8,
  },
  blobTopRight: {
    position: "absolute",
    width: W * 0.65,
    height: W * 0.65,
    borderRadius: W * 0.325,
    backgroundColor: BG_DARK,
    top: -W * 0.22,
    right: -W * 0.18,
    opacity: 0.5,
  },
  doodleContainer: {
    position: "absolute",
    width: W + TILE * 3,
    height: HEADER_ROWS * TILE + TILE * 2,
    top: -TILE,
    left: -TILE,
    pointerEvents: "none",
  },
  doodle: {
    position: "absolute",
    fontSize: 16,
    color: DOODLE_COLOR,
    fontWeight: "300",
    lineHeight: TILE,
    width: TILE,
    textAlign: "center",
  },
  greet: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 2,
  },
  hello: { fontSize: 13, color: "rgba(255,255,255,0.80)", fontWeight: "500" },
  name: { fontSize: 22, fontWeight: "800", color: "#fff" },
  notifBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    position: "relative",
    zIndex: 2,
  },
  notifDot: {
    position: "absolute",
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: BG,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 13,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    zIndex: 2,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: "rgba(255,255,255,0.8)" },
  filterBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  // ── Scroll ──
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, gap: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
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
