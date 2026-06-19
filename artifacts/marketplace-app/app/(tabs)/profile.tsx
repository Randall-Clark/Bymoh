import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useRef, useEffect } from "react";
import {
  Alert,
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
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

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
    symbol: seededPick(row + 2, col + 1),
    row,
    col,
  }))
).flat();

const USE_NATIVE = Platform.OS !== "web";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const shift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shift, {
        toValue: TILE,
        duration: 4500,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE,
      })
    ).start();
  }, [shift]);

  const handleSignOut = () => {
    Alert.alert("Se déconnecter", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => { await signOut(); router.replace("/"); },
      },
    ]);
  };

  const handleBecomeDriver = () => {
    Alert.alert(
      "Devenir livreur",
      "Cette option n'est pas encore disponible dans votre région.\n\nNous travaillons à l'étendre prochainement. Revenez bientôt !",
      [{ text: "Compris", style: "default" }]
    );
  };

  const MenuItem = ({
    icon,
    label,
    onPress,
    danger,
    badge,
  }: {
    icon: string;
    label: string;
    onPress: () => void;
    danger?: boolean;
    badge?: string;
  }) => (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? colors.destructiveLight : colors.muted }]}>
        <Feather name={icon as any} size={18} color={danger ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.text }]}>{label}</Text>
      {badge ? (
        <View style={[styles.badge, { backgroundColor: colors.primary }]}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </TouchableOpacity>
  );

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "U";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>

      {/* ── Fixed header ── */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <View style={styles.blobTopRight} />
        <View style={styles.blobBottomLeft} />

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

        <View style={styles.avatarWrap}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.userName}>{user?.name ?? "—"}</Text>
        <Text style={styles.userPhone}>{user?.phone ?? ""}</Text>

        <View style={[
          styles.roleBadge,
          { backgroundColor: user?.role === "pro" ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.18)" },
        ]}>
          <Feather
            name={user?.role === "pro" ? "briefcase" : user?.role === "driver" ? "truck" : "user"}
            size={12}
            color="#fff"
          />
          <Text style={styles.roleText}>
            {user?.role === "pro" ? "Professionnel" : user?.role === "driver" ? "Livreur" : "Client"}
          </Text>
        </View>
      </View>

      {/* ── Scrollable menu ── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Client section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>MON ESPACE CLIENT</Text>
          <MenuItem icon="clock" label="Historique des réservations" onPress={() => router.push("/orders/index")} />
          <MenuItem icon="heart" label="Mes favoris" onPress={() => router.push("/(tabs)/favorites")} />
          <MenuItem icon="bell" label="Notifications" onPress={() => router.push("/notifications")} />
        </View>

        {/* Pro section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ESPACE PROFESSIONNEL</Text>
          {user?.businessIds && user.businessIds.length > 0 ? (
            <MenuItem icon="bar-chart-2" label="Tableau de bord Pro" onPress={() => router.push("/pro/dashboard")} />
          ) : (
            <TouchableOpacity
              style={[styles.proPromo, { backgroundColor: colors.secondary }]}
              onPress={() => router.push("/pro/register")}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.proPromoTitle}>Vous avez un business ?</Text>
                <Text style={styles.proPromoSub}>Inscrivez-le et gagnez en visibilité</Text>
              </View>
              <View style={[styles.proPromoBtn, { backgroundColor: colors.primary }]}>
                <Feather name="plus" size={16} color="#fff" />
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Driver section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ESPACE LIVREUR</Text>
          <TouchableOpacity
            style={[styles.driverPromo, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={handleBecomeDriver}
            activeOpacity={0.85}
          >
            <View style={[styles.driverIconWrap, { backgroundColor: colors.accent }]}>
              <Feather name="truck" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.driverTitle, { color: colors.text }]}>Devenir livreur</Text>
              <Text style={[styles.driverSub, { color: colors.mutedForeground }]}>
                Gagnez de l'argent en livrant près de chez vous
              </Text>
            </View>
            <View style={[styles.driverArrow, { backgroundColor: colors.primary }]}>
              <Feather name="arrow-right" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PARAMÈTRES</Text>
          <MenuItem icon="edit-2" label="Modifier mon profil" onPress={() => {}} />
          <MenuItem icon="lock" label="Confidentialité" onPress={() => {}} />
          <MenuItem icon="help-circle" label="Aide et support" onPress={() => {}} />
          <MenuItem icon="log-out" label="Se déconnecter" onPress={handleSignOut} danger />
          <MenuItem
            icon="trash-2"
            label="Supprimer mon compte"
            onPress={() =>
              Alert.alert("Suppression", "Cette action est irréversible.", [
                { text: "Annuler" },
                { text: "Supprimer", style: "destructive" },
              ])
            }
            danger
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: "center",
    gap: 6,
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
    width: W * 0.65,
    height: W * 0.65,
    borderRadius: W * 0.325,
    backgroundColor: BG_DARK,
    top: -W * 0.22,
    right: -W * 0.18,
    opacity: 0.5,
  },
  blobBottomLeft: {
    position: "absolute",
    width: W * 0.45,
    height: W * 0.45,
    borderRadius: W * 0.225,
    backgroundColor: BG_DARK,
    bottom: -W * 0.18,
    left: -W * 0.14,
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
  avatarWrap: { marginBottom: 4, zIndex: 2 },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 30, fontWeight: "900", color: "#fff" },
  userName: { fontSize: 22, fontWeight: "800", color: "#fff", zIndex: 2 },
  userPhone: { fontSize: 13, color: "rgba(255,255,255,0.75)", zIndex: 2 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 100,
    marginTop: 4,
    zIndex: 2,
  },
  roleText: { fontSize: 12, fontWeight: "700", color: "#fff" },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, gap: 24 },
  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 100 },
  badgeText: { fontSize: 11, fontWeight: "700", color: "#fff" },
  proPromo: {
    padding: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  proPromoTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  proPromoSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  proPromoBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  driverPromo: {
    padding: 14,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
  },
  driverIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  driverTitle: { fontSize: 15, fontWeight: "700" },
  driverSub: { fontSize: 12, marginTop: 2 },
  driverArrow: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
