import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { MOCK_BOOKINGS, MOCK_ORDERS, formatDate, formatPrice } from "@/constants/mockData";
import { useColors } from "@/hooks/useColors";

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<"bookings" | "orders">("bookings");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Historique</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(["bookings", "orders"] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabLabel, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
              {tab === "bookings" ? "Réservations" : "Commandes"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "bookings" ? (
        MOCK_BOOKINGS.length === 0 ? (
          <EmptyState icon="calendar" title="Aucune réservation" subtitle="Vos réservations apparaîtront ici" />
        ) : (
          <FlatList
            data={MOCK_BOOKINGS}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.catIcon, { backgroundColor: colors.muted }]}>
                    <Feather name="calendar" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.businessName}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>{item.serviceName}</Text>
                  </View>
                  <OrderStatusBadge status={item.status} />
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.cardFooter}>
                  <View style={styles.infoRow}>
                    <Feather name="calendar" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{formatDate(item.date)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Feather name="clock" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{item.time}</Text>
                  </View>
                  <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(item.servicePrice)}</Text>
                </View>
              </View>
            )}
          />
        )
      ) : (
        MOCK_ORDERS.length === 0 ? (
          <EmptyState icon="shopping-bag" title="Aucune commande" subtitle="Vos commandes apparaîtront ici" />
        ) : (
          <FlatList
            data={MOCK_ORDERS}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
            renderItem={({ item }) => (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.cardHeader}>
                  <View style={[styles.catIcon, { backgroundColor: colors.muted }]}>
                    <Feather name="shopping-bag" size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardTitle, { color: colors.text }]}>{item.businessName}</Text>
                    <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
                      {item.items.length} article{item.items.length > 1 ? "s" : ""}
                    </Text>
                  </View>
                  <OrderStatusBadge status={item.status} />
                </View>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.cardFooter}>
                  <View style={styles.infoRow}>
                    <Feather name={item.deliveryMethod === "pickup" ? "map-pin" : "truck"} size={12} color={colors.mutedForeground} />
                    <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                      {item.deliveryMethod === "gozem" ? "Gozem" : item.deliveryMethod === "yango" ? "Yango" : "Retrait"}
                    </Text>
                  </View>
                  {item.status === "in_delivery" && (
                    <TouchableOpacity onPress={() => router.push("/delivery/tracking")}>
                      <Text style={[styles.trackLink, { color: colors.primary }]}>Suivre →</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(item.total)}</Text>
                </View>
              </View>
            )}
          />
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  list: { padding: 16, gap: 12 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 12 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  catIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardSub: { fontSize: 12, marginTop: 2 },
  divider: { height: 1 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 11 },
  price: { marginLeft: "auto", fontSize: 14, fontWeight: "700" },
  trackLink: { fontSize: 12, fontWeight: "700" },
});
