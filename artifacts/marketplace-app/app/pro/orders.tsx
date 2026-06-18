import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { MOCK_BOOKINGS, MOCK_ORDERS, formatDate, formatPrice } from "@/constants/mockData";
import { Booking, Order } from "@/constants/types";
import { useColors } from "@/hooks/useColors";

type Status = "pending" | "confirmed" | "completed" | "cancelled" | "in_delivery";

export default function ProOrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<"all" | "pending">("all");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const allItems = [
    ...MOCK_BOOKINGS.map((b) => ({ ...b, type: "booking" as const })),
    ...MOCK_ORDERS.map((o) => ({ ...o, type: "order" as const })),
  ].filter((i) => filter === "all" || i.status === "pending");

  const handleAction = (id: string, action: "confirm" | "cancel") => {
    // In real app, update state
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Commandes & Réservations</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.filterRow}>
        {(["all", "pending"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, { backgroundColor: filter === f ? colors.primary : colors.card, borderColor: filter === f ? colors.primary : colors.border }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterLabel, { color: filter === f ? "#fff" : colors.text }]}>
              {f === "all" ? "Tout" : "En attente"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {allItems.length === 0 ? (
        <EmptyState icon="inbox" title="Aucune demande" subtitle="Vos réservations et commandes reçues apparaîtront ici" />
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardTop}>
                <View style={[styles.typeBadge, { backgroundColor: item.type === "booking" ? colors.proLight : colors.accent }]}>
                  <Feather
                    name={item.type === "booking" ? "calendar" : "shopping-bag"}
                    size={12}
                    color={item.type === "booking" ? colors.proColor : colors.primary}
                  />
                  <Text style={[styles.typeLabel, { color: item.type === "booking" ? colors.proColor : colors.primary }]}>
                    {item.type === "booking" ? "Réservation" : "Commande"}
                  </Text>
                </View>
                <OrderStatusBadge status={item.status as Status} />
              </View>

              {item.type === "booking" ? (
                <>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>{(item as Booking).serviceName}</Text>
                  <View style={styles.infoRow}>
                    <Feather name="calendar" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                      {formatDate((item as Booking).date)} à {(item as Booking).time}
                    </Text>
                  </View>
                  <Text style={[styles.price, { color: colors.primary }]}>{formatPrice((item as Booking).servicePrice)}</Text>
                </>
              ) : (
                <>
                  <Text style={[styles.itemTitle, { color: colors.text }]}>
                    {(item as Order).items.map((i) => i.title).join(", ")}
                  </Text>
                  <Text style={[styles.price, { color: colors.primary }]}>{formatPrice((item as Order).total)}</Text>
                </>
              )}

              {item.status === "pending" && (
                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.success }]}
                    onPress={() => handleAction(item.id, "confirm")}
                  >
                    <Feather name="check" size={14} color="#fff" />
                    <Text style={styles.actionBtnText}>Confirmer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.destructiveLight }]}
                    onPress={() => handleAction(item.id, "cancel")}
                  >
                    <Feather name="x" size={14} color={colors.destructive} />
                    <Text style={[styles.actionBtnText, { color: colors.destructive }]}>Refuser</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingBottom: 12 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100, borderWidth: 1 },
  filterLabel: { fontSize: 13, fontWeight: "600" },
  list: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  typeLabel: { fontSize: 11, fontWeight: "700" },
  itemTitle: { fontSize: 15, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoText: { fontSize: 12 },
  price: { fontSize: 15, fontWeight: "700" },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: 100 },
  actionBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});
