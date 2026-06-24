import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetMyBusinessesQueryKey,
  useGetMyBusinesses,
} from "@workspace/api-client-react";
import { useActiveBusiness } from "@/context/ActiveBusinessContext";
import { getMediaUrl } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function daysLeft(pausedAt: string | null | undefined): number {
  if (!pausedAt) return 3;
  const elapsed = Date.now() - new Date(pausedAt).getTime();
  return Math.max(0, Math.ceil((THREE_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000)));
}

export default function BusinessesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;
  const { setSelectedBusinessId } = useActiveBusiness();

  const { data: businesses = [], isLoading } = useGetMyBusinesses({
    query: { queryKey: getGetMyBusinessesQueryKey() },
  });

  const handleSelect = (businessId: string) => {
    setSelectedBusinessId(businessId);
    router.push("/pro/dashboard");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.75}
        >
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, paddingHorizontal: 12 }}>
          <Text style={styles.headerSub}>Bymoh Pro</Text>
          <Text style={styles.headerTitle}>Mes Entreprises</Text>
        </View>
        {businesses.length < 3 && (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => router.push("/pro/register")}
            activeOpacity={0.75}
          >
            <Feather name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : businesses.length === 0 ? (
        <View style={styles.centered}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "15" }]}>
            <Feather name="briefcase" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            Aucune entreprise enregistrée
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Rejoignez Bymoh Pro et commencez à gérer votre commerce directement depuis l'application.
          </Text>
          <TouchableOpacity
            style={[styles.createBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/pro/register")}
            activeOpacity={0.8}
          >
            <Feather name="plus-circle" size={18} color="#fff" />
            <Text style={styles.createBtnText}>Ajouter mon commerce</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.countHint, { color: colors.mutedForeground }]}>
            {businesses.length} / 3 commerce{businesses.length > 1 ? "s" : ""} enregistré{businesses.length > 1 ? "s" : ""}
          </Text>
          {businesses.map((biz) => {
            const isPaused = biz.isActive === false;
            const expired = isPaused && biz.pausedAt
              ? Date.now() - new Date(biz.pausedAt).getTime() > THREE_DAYS_MS
              : false;
            const remaining = daysLeft(biz.pausedAt);

            return (
              <TouchableOpacity
                key={biz.id}
                style={[
                  styles.bizCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: expired
                      ? "#EF4444"
                      : isPaused
                      ? "#FED7AA"
                      : colors.border,
                    borderWidth: isPaused || expired ? 1.5 : 1,
                  },
                ]}
                onPress={() => !expired && handleSelect(biz.id)}
                activeOpacity={expired ? 1 : 0.78}
                disabled={expired}
              >
                {/* Cover / icon */}
                <View style={styles.bizCoverWrap}>
                  {biz.coverUrl ? (
                    <Image
                      source={{ uri: getMediaUrl(biz.coverUrl) }}
                      style={styles.bizCover}
                      contentFit="cover"
                    />
                  ) : (
                    <View
                      style={[styles.bizCoverFallback, { backgroundColor: colors.primary + "20" }]}
                    >
                      <Feather name="briefcase" size={28} color={colors.primary} />
                    </View>
                  )}
                </View>

                {/* Info */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.bizName, { color: colors.text }]} numberOfLines={1}>
                    {biz.name}
                  </Text>
                  <Text style={[styles.bizCategory, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {biz.category} · {biz.city}
                  </Text>

                  {expired ? (
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: "#FEE2E2" }]}>
                        <Text style={[styles.badgeText, { color: "#EF4444" }]}>
                          Définitivement fermé
                        </Text>
                      </View>
                    </View>
                  ) : isPaused ? (
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: "#FFF7ED" }]}>
                        <Text style={[styles.badgeText, { color: "#EA580C" }]}>
                          En pause — {remaining}j restant{remaining > 1 ? "s" : ""}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, { backgroundColor: "#F0FDF4" }]}>
                        <Text style={[styles.badgeText, { color: "#16A34A" }]}>Actif</Text>
                      </View>
                    </View>
                  )}
                </View>

                {!expired && (
                  <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
                )}
              </TouchableOpacity>
            );
          })}

          {businesses.length < 3 && (
            <TouchableOpacity
              style={[styles.addAnotherBtn, { borderColor: colors.primary + "50" }]}
              onPress={() => router.push("/pro/register")}
              activeOpacity={0.8}
            >
              <Feather name="plus-circle" size={18} color={colors.primary} />
              <Text style={[styles.addAnotherText, { color: colors.primary }]}>
                Ajouter un autre commerce
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  header: {
    backgroundColor: "#E84B1A",
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: "row",
    alignItems: "center",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  headerSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "600" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },

  // Centered (loading / empty)
  centered: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36,
  },
  emptyIcon: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center",
    marginBottom: 24,
  },
  emptyTitle: { fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  emptySubtitle: {
    fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 36,
  },
  createBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 28, paddingVertical: 16,
    borderRadius: 16,
  },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // List
  list: { paddingHorizontal: 20, paddingTop: 20, gap: 14 },
  countHint: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  bizCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 18, borderWidth: 1,
  },
  bizCoverWrap: { width: 64, height: 64, borderRadius: 16, overflow: "hidden" },
  bizCover: { width: "100%", height: "100%" },
  bizCoverFallback: {
    width: 64, height: 64, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  bizName: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  bizCategory: { fontSize: 13, marginBottom: 8 },
  badgeRow: { flexDirection: "row" },
  badge: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  addAnotherBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 16, borderRadius: 18, borderWidth: 1.5,
    borderStyle: "dashed", justifyContent: "center",
    marginTop: 6,
  },
  addAnotherText: { fontSize: 15, fontWeight: "600" },
});
