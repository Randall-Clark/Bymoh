import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import OrderStatusBadge from "@/components/OrderStatusBadge";
import ProDrawerMenu from "@/components/ProDrawerMenu";
import { MOCK_BOOKINGS } from "@/constants/mockData";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

// ─── Doodle config (same palette as home/profile) ─────────────────────────────
const { width: W } = Dimensions.get("window");
const BG = "#E84B1A";
const BG_DARK = "#C93E12";
const DOODLE_COLOR = "rgba(255,255,255,0.13)";
const TILE = 72;
const COLS = Math.ceil(W / TILE) + 4;
const HEADER_ROWS = 4;
const SYMBOLS = ["+", "◇", "○", "∧", "~", "⊕", "Ш", "M", "☀", "△", "×", "⌀"];

function seededPick(row: number, col: number): string {
  const i = Math.abs((row * 5 + col * 11) ^ (row * 2 + col * 7)) % SYMBOLS.length;
  return SYMBOLS[i];
}

const HEADER_CELLS = Array.from({ length: HEADER_ROWS }, (_, row) =>
  Array.from({ length: COLS }, (_, col) => ({
    key: `${row}-${col}`,
    symbol: seededPick(row + 3, col + 5),
    row,
    col,
  }))
).flat();

const USE_NATIVE = Platform.OS !== "web";

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function ProDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const shift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shift, {
        toValue: TILE,
        duration: 4800,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE,
      })
    ).start();
  }, [shift]);

  const StatCard = ({
    label,
    value,
    icon,
    color,
  }: {
    label: string;
    value: string;
    icon: string;
    color: string;
  }) => (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );

  const QuickAction = ({
    icon,
    label,
    onPress,
    color,
  }: {
    icon: string;
    label: string;
    onPress: () => void;
    color: string;
  }) => (
    <TouchableOpacity
      style={[styles.qAction, { backgroundColor: color + "15", borderColor: color + "30" }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Feather name={icon as any} size={22} color={color} />
      <Text style={[styles.qLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Fixed header: orange + doodles ── */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        {/* Blobs */}
        <View style={styles.blobTopRight} />
        <View style={styles.blobBottomLeft} />

        {/* Doodle grid */}
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

        {/* Header content */}
        <View style={styles.headerRow}>
          {/* Hamburger menu */}
          <TouchableOpacity
            style={styles.hamburger}
            onPress={() => setDrawerOpen(true)}
            activeOpacity={0.75}
          >
            <Feather name="menu" size={22} color="#fff" />
          </TouchableOpacity>

          {/* Title */}
          <View style={{ flex: 1, paddingHorizontal: 12 }}>
            <Text style={styles.headerSub}>Espace Professionnel</Text>
            <Text style={styles.headerTitle}>Mon Business</Text>
          </View>

          {/* Notification bell */}
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push("/notifications")}
            activeOpacity={0.75}
          >
            <Feather name="bell" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scrollable content ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Stats */}
        <View style={styles.statsGrid}>
          <StatCard label="Vues aujourd'hui" value="47" icon="eye" color={colors.primary} />
          <StatCard label="Réservations" value="12" icon="calendar" color={colors.success} />
          <StatCard label="Commandes" value="8" icon="shopping-bag" color="#8B5CF6" />
          <StatCard label="Revenus ce mois" value="126 500 FCFA" icon="trending-up" color={colors.warning} />
        </View>

        {/* Quick actions */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Actions rapides</Text>
          <View style={styles.qActionsGrid}>
            <QuickAction
              icon="package"
              label="Catalogue"
              onPress={() => router.push("/pro/catalog")}
              color={colors.primary}
            />
            <QuickAction
              icon="clock"
              label="Horaires"
              onPress={() => router.push("/pro/schedule")}
              color={colors.success}
            />
            <QuickAction
              icon="list"
              label="Commandes"
              onPress={() => router.push("/pro/orders")}
              color="#8B5CF6"
            />
            <QuickAction
              icon="user"
              label="Profil business"
              onPress={() => router.push("/pro/profile" as any)}
              color={colors.warning}
            />
          </View>
        </View>

        {/* Recent bookings */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Réservations récentes</Text>
            <TouchableOpacity onPress={() => router.push("/pro/orders")}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>Voir tout</Text>
            </TouchableOpacity>
          </View>
          {MOCK_BOOKINGS.slice(0, 3).map((b) => (
            <View
              key={b.id}
              style={[styles.bookingItem, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={[styles.bookingAvatar, { backgroundColor: colors.muted }]}>
                <Feather name="user" size={18} color={colors.mutedForeground} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bookingService, { color: colors.text }]}>{b.serviceName}</Text>
                <Text style={[styles.bookingTime, { color: colors.mutedForeground }]}>
                  {b.date} · {b.time}
                </Text>
              </View>
              <OrderStatusBadge status={b.status} />
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Drawer */}
      <ProDrawerMenu visible={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // ── Fixed header ──
  header: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingBottom: 20,
    overflow: "hidden",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
  },
  blobTopRight: {
    position: "absolute",
    width: W * 0.6,
    height: W * 0.6,
    borderRadius: W * 0.3,
    backgroundColor: BG_DARK,
    top: -W * 0.2,
    right: -W * 0.16,
    opacity: 0.5,
  },
  blobBottomLeft: {
    position: "absolute",
    width: W * 0.4,
    height: W * 0.4,
    borderRadius: W * 0.2,
    backgroundColor: BG_DARK,
    bottom: -W * 0.16,
    left: -W * 0.12,
    opacity: 0.35,
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

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2,
  },
  hamburger: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "600" },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#fff" },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Scrollable ──
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, gap: 24 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: { width: "47%", borderRadius: 16, padding: 14, borderWidth: 1, gap: 8 },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 12 },

  sectionTitle: { fontSize: 18, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  seeAll: { fontSize: 13, fontWeight: "600" },

  qActionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 },
  qAction: { width: "47%", alignItems: "center", gap: 8, paddingVertical: 18, borderRadius: 16, borderWidth: 1 },
  qLabel: { fontSize: 13, fontWeight: "600" },

  bookingItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  bookingAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  bookingService: { fontSize: 14, fontWeight: "600" },
  bookingTime: { fontSize: 12, marginTop: 2 },
});
