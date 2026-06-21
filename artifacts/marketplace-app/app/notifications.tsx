import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getGetNotificationsQueryKey,
  useGetNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type Notification,
} from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";

// ─── Icon / colour per notification type ────────────────────────────────────────
const TYPE_META: Record<
  Notification["type"],
  { icon: string; color: string }
> = {
  order:    { icon: "shopping-bag", color: "#F59E0B" },
  booking:  { icon: "calendar",     color: "#3B82F6" },
  promo:    { icon: "gift",          color: "#8B5CF6" },
  delivery: { icon: "truck",         color: "#FF6835" },
  system:   { icon: "info",          color: "#6B7280" },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 7) return `Il y a ${d} jours`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ─── Notification item ──────────────────────────────────────────────────────────
function NotifItem({
  item,
  onPress,
}: {
  item: Notification;
  onPress: (id: string) => void;
}) {
  const colors = useColors();
  const meta = TYPE_META[item.type] ?? TYPE_META.system;

  return (
    <TouchableOpacity
      style={[
        styles.notifItem,
        {
          backgroundColor: colors.card,
          borderColor: item.isRead ? colors.border : colors.primary + "30",
          borderLeftWidth: item.isRead ? 1 : 3,
          borderLeftColor: item.isRead ? colors.border : meta.color,
        },
      ]}
      activeOpacity={0.75}
      onPress={() => onPress(item.id)}
    >
      <View style={[styles.iconWrap, { backgroundColor: meta.color + "20" }]}>
        <Feather name={meta.icon as any} size={20} color={meta.color} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={styles.notifRow}>
          <Text style={[styles.notifTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.isRead && (
            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
          )}
        </View>
        <Text
          style={[styles.notifBody, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {item.body}
        </Text>
        <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>
          {timeAgo(item.createdAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ─────────────────────────────────────────────────────────────────────
export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { data: notifs = [], isLoading, isError, refetch } = useGetNotifications({
    query: {
      queryKey: getGetNotificationsQueryKey(),
      staleTime: 30_000,
    },
  });

  const markOne = useMarkNotificationRead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      },
    },
  });

  const markAll = useMarkAllNotificationsRead({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
      },
    },
  });

  const unreadCount = notifs.filter((n) => !n.isRead).length;

  const handlePress = (id: string) => {
    markOne.mutate({ notifId: id });
  };

  const handleMarkAll = () => {
    markAll.mutate();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
          {unreadCount > 0 && (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
            </Text>
          )}
        </View>
        {unreadCount > 0 && (
          <TouchableOpacity
            style={[styles.markAllBtn, { borderColor: colors.border }]}
            onPress={handleMarkAll}
            disabled={markAll.isPending}
            activeOpacity={0.75}
          >
            {markAll.isPending ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.markAllText, { color: colors.primary }]}>Tout lire</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Loading */}
      {isLoading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* Error */}
      {isError && !isLoading && (
        <View style={styles.center}>
          <Feather name="wifi-off" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Impossible de charger les notifications
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => refetch()}
          >
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Empty */}
      {!isLoading && !isError && notifs.length === 0 && (
        <View style={styles.center}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.accent }]}>
            <Feather name="bell-off" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune notification</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Vous serez notifié de vos commandes, réservations et offres ici.
          </Text>
        </View>
      )}

      {/* List */}
      {!isLoading && !isError && notifs.length > 0 && (
        <FlatList
          data={notifs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}
          renderItem={({ item }) => (
            <NotifItem item={item} onPress={handlePress} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingBottom: 16,
  },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 12, marginTop: 1 },
  markAllBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, minWidth: 72, alignItems: "center",
  },
  markAllText: { fontSize: 13, fontWeight: "600" },
  list: { padding: 16, gap: 10 },
  notifItem: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  notifTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  notifBody: { fontSize: 13, lineHeight: 18 },
  notifTime: { fontSize: 11 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: "#fff", fontWeight: "700" },
});
