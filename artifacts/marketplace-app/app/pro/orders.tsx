import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { MOCK_BOOKINGS, MOCK_ORDERS, formatDate, formatPrice } from "@/constants/mockData";
import { Booking, Order } from "@/constants/types";
import { useColors } from "@/hooks/useColors";

type TabKey = "all" | "confirmed" | "completed" | "cancelled";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all",       label: "Tout" },
  { key: "confirmed", label: "Confirmées" },
  { key: "completed", label: "Terminées" },
  { key: "cancelled", label: "Annulées" },
];

type AnyItem =
  | (Booking & { type: "booking" })
  | (Order   & { type: "order"   });

export default function ProOrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>("all");
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const allItems: AnyItem[] = [
    ...MOCK_BOOKINGS.map((b) => ({ ...b, type: "booking" as const })),
    ...MOCK_ORDERS.map((o)   => ({ ...o, type: "order"   as const })),
  ].filter((i) => {
    if (tab === "all")       return true;
    if (tab === "confirmed") return i.status === "confirmed" || i.status === "pending";
    if (tab === "completed") return i.status === "completed";
    if (tab === "cancelled") return i.status === "cancelled";
    return true;
  });

  const handleCancel = (item: AnyItem) => {
    const isOnlinePay =
      item.type === "booking" && (item as Booking).paymentMethod === "online";
    const price =
      item.type === "booking"
        ? (item as Booking).servicePrice
        : (item as Order).total;

    const refundMsg = isOnlinePay && price > 0
      ? `\n\n💳 Le client a payé en ligne (${formatPrice(price)}). Kola remboursera automatiquement le client sous 24–48h.`
      : "\n\nLe client sera notifié de l'annulation.";

    Alert.alert(
      "Annuler cette réservation ?",
      `Cette action est irréversible. Le créneau sera libéré et le client notifié.${refundMsg}`,
      [
        { text: "Ne pas annuler", style: "cancel" },
        {
          text: "Confirmer l'annulation",
          style: "destructive",
          onPress: () => {
            // In real app: API call to cancel
            setCancellingId(item.id);
            setTimeout(() => setCancellingId(null), 1500);
          },
        },
      ]
    );
  };

  const canCancel = (item: AnyItem) =>
    item.status === "confirmed" || item.status === "pending";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Commandes & Réservations</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Escrow info banner */}
      <View style={[styles.escrowBanner, { backgroundColor: "#EFF6FF", borderBottomColor: "#BFDBFE" }]}>
        <Feather name="lock" size={14} color="#2563EB" />
        <Text style={styles.escrowText}>
          Les paiements en ligne sont retenus par Kola et versés <Text style={{ fontWeight: "700" }}>24h après la prestation</Text>
        </Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tab, tab === t.key && { borderBottomColor: colors.primary }]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabLabel, { color: tab === t.key ? colors.primary : colors.mutedForeground, fontWeight: tab === t.key ? "700" : "500" }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {allItems.length === 0 ? (
        <EmptyState icon="inbox" title="Aucune entrée" subtitle="Vos réservations et commandes reçues apparaîtront ici" />
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isBooking = item.type === "booking";
            const booking = item as Booking & { type: "booking" };
            const order   = item as Order   & { type: "order"   };
            const paid    = isBooking && booking.paymentMethod === "online" && booking.servicePrice > 0;
            const isCancelling = cancellingId === item.id;

            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Type + status row */}
                <View style={styles.cardTop}>
                  <View style={[styles.typeBadge, { backgroundColor: isBooking ? colors.proLight : colors.accent }]}>
                    <Feather
                      name={isBooking ? "calendar" : "shopping-bag"}
                      size={12}
                      color={isBooking ? colors.proColor : colors.primary}
                    />
                    <Text style={[styles.typeLabel, { color: isBooking ? colors.proColor : colors.primary }]}>
                      {isBooking ? "Réservation" : "Commande"}
                    </Text>
                  </View>
                  <View style={styles.rightBadges}>
                    {/* Payment method badge */}
                    {isBooking && booking.paymentMethod && (
                      <View style={[
                        styles.payBadge,
                        { backgroundColor: booking.paymentMethod === "online" ? "#DBEAFE" : "#F3F4F6" },
                      ]}>
                        <Feather
                          name={booking.paymentMethod === "online" ? "smartphone" : "credit-card"}
                          size={10}
                          color={booking.paymentMethod === "online" ? "#2563EB" : "#6B7280"}
                        />
                        <Text style={[styles.payBadgeLabel, { color: booking.paymentMethod === "online" ? "#2563EB" : "#6B7280" }]}>
                          {booking.paymentMethod === "online" ? "En ligne" : "Sur place"}
                        </Text>
                      </View>
                    )}
                    <OrderStatusBadge status={item.status as any} />
                  </View>
                </View>

                {/* Content */}
                {isBooking ? (
                  <>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>{booking.serviceName}</Text>
                    <View style={styles.infoRow}>
                      <Feather name="calendar" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                        {formatDate(booking.date)} à {booking.time}
                      </Text>
                    </View>
                    {booking.partySize && (
                      <View style={styles.infoRow}>
                        <Feather name="users" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                          {booking.partySize} personne{booking.partySize > 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                    {booking.servicePrice > 0 && (
                      <Text style={[styles.price, { color: colors.primary }]}>
                        {formatPrice(booking.servicePrice)}
                      </Text>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>
                      {order.items.map((i) => i.title).join(", ")}
                    </Text>
                    <Text style={[styles.price, { color: colors.primary }]}>
                      {formatPrice(order.total)}
                    </Text>
                  </>
                )}

                {/* Escrow hold note */}
                {paid && item.status === "completed" && (
                  <View style={[styles.escrowNote, { backgroundColor: "#DBEAFE", borderColor: "#BFDBFE" }]}>
                    <Feather name="clock" size={12} color="#2563EB" />
                    <Text style={styles.escrowNoteText}>
                      Paiement retenu par Kola · versement sous 24h
                    </Text>
                  </View>
                )}

                {/* Cancellation info for cancelled paid booking */}
                {paid && item.status === "cancelled" && (
                  <View style={[styles.escrowNote, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                    <Feather name="refresh-cw" size={12} color="#DC2626" />
                    <Text style={[styles.escrowNoteText, { color: "#DC2626" }]}>
                      Remboursement client en cours (24–48h)
                    </Text>
                  </View>
                )}

                {/* Cancel action */}
                {canCancel(item) && (
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.destructive + "40", backgroundColor: colors.destructiveLight }]}
                    onPress={() => handleCancel(item)}
                    disabled={isCancelling}
                  >
                    <Feather name="x-circle" size={14} color={colors.destructive} />
                    <Text style={[styles.cancelBtnText, { color: colors.destructive }]}>
                      {isCancelling ? "Annulation..." : "Annuler cette réservation"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },

  escrowBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1,
  },
  escrowText: { fontSize: 12, color: "#2563EB", flex: 1 },

  tabRow: {
    flexDirection: "row", borderBottomWidth: 1,
  },
  tab: {
    flex: 1, alignItems: "center", paddingVertical: 12,
    borderBottomWidth: 2, borderBottomColor: "transparent",
  },
  tabLabel: { fontSize: 12 },

  list: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
  card: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 8 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  typeBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  typeLabel: { fontSize: 11, fontWeight: "700" },
  rightBadges: { flexDirection: "row", alignItems: "center", gap: 6 },
  payBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  payBadgeLabel: { fontSize: 10, fontWeight: "600" },
  itemTitle: { fontSize: 15, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoText: { fontSize: 12 },
  price: { fontSize: 15, fontWeight: "700" },
  escrowNote: {
    flexDirection: "row", alignItems: "center", gap: 6,
    padding: 8, borderRadius: 8, borderWidth: 1,
  },
  escrowNoteText: { fontSize: 11, color: "#2563EB", flex: 1 },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 4,
  },
  cancelBtnText: { fontSize: 13, fontWeight: "700" },
});
