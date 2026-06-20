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

// ─── Doodle grid constants ──────────────────────────────────────────────────────
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

// ─── Promo banners ──────────────────────────────────────────────────────────────
const PROMO_BANNERS = [
  {
    id: "p1",
    title: "1ère livraison offerte",
    sub: "Sur votre 1ère commande Kola",
    cta: "Commander",
    bg: "#FF6835",
    icon: "gift",
    deco: "#E84B1A",
  },
  {
    id: "p2",
    title: "Promos Week-end",
    sub: "-20% chez nos restaurants partenaires",
    cta: "Découvrir",
    bg: "#1E3A5F",
    icon: "percent",
    deco: "#162D4A",
  },
  {
    id: "p3",
    title: "Artisans Lomé",
    sub: "Meublez votre intérieur avec des pros locaux",
    cta: "Explorer",
    bg: "#059669",
    icon: "tool",
    deco: "#047857",
  },
];

// ─── Home Screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, toggleFavorite } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [bannerIdx, setBannerIdx] = useState(0);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Animated doodle diagonal shift
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

  // Banner auto-scroll
  const bannerRef = useRef<ScrollView>(null);
  const BANNER_W = W - 40; // 20px padding each side
  useEffect(() => {
    const t = setInterval(() => {
      setBannerIdx((prev) => {
        const next = (prev + 1) % PROMO_BANNERS.length;
        bannerRef.current?.scrollTo({ x: next * (BANNER_W + 14), animated: true });
        return next;
      });
    }, 3800);
    return () => clearInterval(t);
  }, [BANNER_W]);

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

      {/* ── Fixed header ── */}
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: BG }]}>
        <View style={styles.blobTopRight} />
        <Animated.View
          style={[styles.doodleContainer, { transform: [{ translateX: shift }, { translateY: shift }] }]}
          pointerEvents="none"
        >
          {HEADER_CELLS.map(({ key, symbol, row, col }) => (
            <Text key={key} style={[styles.doodle, { left: col * TILE - TILE, top: row * TILE - TILE }]}>
              {symbol}
            </Text>
          ))}
        </Animated.View>

        {/* Greeting */}
        <View style={styles.greet}>
          <View>
            <Text style={styles.hello}>Bonjour 👋</Text>
            <Text style={styles.name}>{user?.name ?? "Bienvenue"}</Text>
          </View>
          <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/notifications")}>
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
          <Text style={styles.searchPlaceholder}>Rechercher un service, commerce...</Text>
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
        {/* ── Categories ── */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Catégories</Text>
            <TouchableOpacity onPress={() => router.push("/categories" as any)}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>Voir plus →</Text>
            </TouchableOpacity>
          </View>
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

        {/* ── Promotional banner ── */}
        <View>
          <ScrollView
            ref={bannerRef}
            horizontal
            pagingEnabled={false}
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={BANNER_W + 14}
            snapToAlignment="start"
            contentContainerStyle={styles.bannerRow}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / (BANNER_W + 14));
              setBannerIdx(idx);
            }}
          >
            {PROMO_BANNERS.map((p) => (
              <TouchableOpacity
                key={p.id}
                style={[styles.bannerCard, { width: BANNER_W, backgroundColor: p.bg }]}
                activeOpacity={0.9}
                onPress={() => router.push("/(tabs)/search" as any)}
              >
                {/* Deco circles */}
                <View style={[styles.bannerDeco1, { backgroundColor: p.deco }]} />
                <View style={[styles.bannerDeco2, { backgroundColor: p.deco }]} />

                <View style={[styles.bannerIconWrap, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
                  <Feather name={p.icon as any} size={26} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>{p.title}</Text>
                  <Text style={styles.bannerSub}>{p.sub}</Text>
                </View>
                <View style={styles.bannerCta}>
                  <Text style={[styles.bannerCtaText, { color: p.bg }]}>{p.cta}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          {/* Dots */}
          <View style={styles.bannerDots}>
            {PROMO_BANNERS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  { backgroundColor: i === bannerIdx ? colors.primary : colors.border },
                ]}
              />
            ))}
          </View>
        </View>

        {/* ── Open Now ── */}
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

        {/* ── Nearby ── */}
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

  header: {
    paddingHorizontal: 20, paddingBottom: 20, gap: 14, overflow: "hidden", zIndex: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 8,
  },
  blobTopRight: {
    position: "absolute", width: W * 0.65, height: W * 0.65, borderRadius: W * 0.325,
    backgroundColor: BG_DARK, top: -W * 0.22, right: -W * 0.18, opacity: 0.5,
  },
  doodleContainer: {
    position: "absolute", width: W + TILE * 3, height: HEADER_ROWS * TILE + TILE * 2,
    top: -TILE, left: -TILE, pointerEvents: "none",
  },
  doodle: {
    position: "absolute", fontSize: 16, color: DOODLE_COLOR,
    fontWeight: "300", lineHeight: TILE, width: TILE, textAlign: "center",
  },
  greet: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", zIndex: 2 },
  hello: { fontSize: 13, color: "rgba(255,255,255,0.80)", fontWeight: "500" },
  name: { fontSize: 22, fontWeight: "800", color: "#fff" },
  notifBtn: {
    width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)", position: "relative", zIndex: 2,
  },
  notifDot: {
    position: "absolute", top: 9, right: 9, width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: BG,
  },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 13, borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)", zIndex: 2,
  },
  searchPlaceholder: { flex: 1, fontSize: 14, color: "rgba(255,255,255,0.8)" },
  filterBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, gap: 24 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  openDot: { width: 8, height: 8, borderRadius: 4 },
  seeAll: { fontSize: 13, fontWeight: "600" },
  catRow: { gap: 8, paddingVertical: 4 },
  hRow: { gap: 14, paddingVertical: 4 },
  hCard: { width: 220 },
  vCard: { marginBottom: 14 },
  empty: { alignItems: "center", gap: 12, paddingTop: 60 },
  emptyText: { fontSize: 16 },

  // Banner
  bannerRow: { gap: 14, paddingVertical: 4 },
  bannerCard: {
    borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center",
    gap: 14, overflow: "hidden", minHeight: 100,
  },
  bannerDeco1: {
    position: "absolute", width: 160, height: 160, borderRadius: 80, top: -60, right: -40, opacity: 0.5,
  },
  bannerDeco2: {
    position: "absolute", width: 100, height: 100, borderRadius: 50, bottom: -40, left: -20, opacity: 0.35,
  },
  bannerIconWrap: {
    width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  bannerTitle: { fontSize: 16, fontWeight: "800", color: "#fff", marginBottom: 4 },
  bannerSub: { fontSize: 12, color: "rgba(255,255,255,0.78)", lineHeight: 17 },
  bannerCta: {
    backgroundColor: "#fff", paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 100, flexShrink: 0, alignSelf: "flex-end",
  },
  bannerCtaText: { fontSize: 12, fontWeight: "800" },
  bannerDots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
});
