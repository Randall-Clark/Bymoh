import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { MOCK_BOOKINGS, formatPrice } from "@/constants/mockData";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ProDashboardScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const StatCard = ({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) => (
    <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.statIcon, { backgroundColor: color + "20" }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
    </View>
  );

  const QuickAction = ({ icon, label, onPress, color }: { icon: string; label: string; onPress: () => void; color: string }) => (
    <TouchableOpacity style={[styles.qAction, { backgroundColor: color + "15", borderColor: color + "30" }]} onPress={onPress} activeOpacity={0.75}>
      <Feather name={icon as any} size={22} color={color} />
      <Text style={[styles.qLabel, { color: colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: botPad + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>Espace Professionnel</Text>
          <Text style={[styles.bizName, { color: colors.text }]}>Mon Business</Text>
        </View>
        <TouchableOpacity
          style={[styles.headerBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.back()}
        >
          <Feather name="x" size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

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
          <QuickAction icon="package" label="Catalogue" onPress={() => router.push("/pro/catalog")} color={colors.primary} />
          <QuickAction icon="clock" label="Horaires" onPress={() => router.push("/pro/schedule")} color={colors.success} />
          <QuickAction icon="list" label="Commandes" onPress={() => router.push("/pro/orders")} color="#8B5CF6" />
          <QuickAction icon="edit" label="Profil" onPress={() => {}} color={colors.warning} />
        </View>
      </View>

      {/* Visibility bar */}
      <View style={[styles.visibilityCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.visibilityHeader}>
          <View style={[styles.visibilityIcon, { backgroundColor: colors.accent }]}>
            <Feather name="zap" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.visibilityTitle, { color: colors.text }]}>Visibilité du profil</Text>
            <Text style={[styles.visibilityLabel, { color: colors.mutedForeground }]}>Complétez votre profil pour apparaître en premier</Text>
          </View>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.muted }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: "72%" }]} />
        </View>
        <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>72% complété</Text>
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
          <View key={b.id} style={[styles.bookingItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.bookingAvatar, { backgroundColor: colors.muted }]}>
              <Feather name="user" size={18} color={colors.mutedForeground} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bookingService, { color: colors.text }]}>{b.serviceName}</Text>
              <Text style={[styles.bookingTime, { color: colors.mutedForeground }]}>{b.date} · {b.time}</Text>
            </View>
            <OrderStatusBadge status={b.status} />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 24 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  greeting: { fontSize: 13, fontWeight: "600" },
  bizName: { fontSize: 26, fontWeight: "800", marginTop: 2 },
  headerBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
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
  visibilityCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  visibilityHeader: { flexDirection: "row", gap: 12, alignItems: "center" },
  visibilityIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  visibilityTitle: { fontSize: 15, fontWeight: "700" },
  visibilityLabel: { fontSize: 12, marginTop: 2 },
  progressBar: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  progressLabel: { fontSize: 12 },
  bookingItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  bookingAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  bookingService: { fontSize: 14, fontWeight: "600" },
  bookingTime: { fontSize: 12, marginTop: 2 },
});
