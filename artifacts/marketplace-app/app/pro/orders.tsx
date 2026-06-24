import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import EmptyState from "@/components/EmptyState";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import {
  getGetProBookingsQueryKey,
  getGetProOrdersQueryKey,
  useGetProBookings,
  useGetProOrders,
  useUpdateOrderStatus,
  useUpdateProBookingStatus,
  type ProBooking,
  type ProOrder,
} from "@workspace/api-client-react";
import { formatDate, formatPrice } from "@/constants/mockData";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

type TabKey = "all" | "confirmed" | "completed" | "cancelled";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all",       label: "Tout" },
  { key: "confirmed", label: "Confirmées" },
  { key: "completed", label: "Terminées" },
  { key: "cancelled", label: "Annulées" },
];

type AnyItem =
  | (ProBooking & { _type: "booking" })
  | (ProOrder   & { _type: "order"   });

const PRO_CANCEL_REASONS = [
  "Client absent ou injoignable",
  "Service temporairement indisponible",
  "Problème technique ou matériel",
  "À la demande du client",
  "Conflit d'agenda",
  "Autre raison",
];

export default function ProOrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const businessId = user?.businessIds?.[0] ?? "";

  const [tab, setTab] = useState<TabKey>("all");
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<AnyItem | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelNote, setCancelNote] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // ── API ──────────────────────────────────────────────────────────────────────
  const { data: bookings = [], isLoading: bookingsLoading } = useGetProBookings({
    query: { queryKey: getGetProBookingsQueryKey(), enabled: !!businessId },
  });

  const { data: orders = [], isLoading: ordersLoading } = useGetProOrders(businessId, {
    query: { queryKey: getGetProOrdersQueryKey(businessId), enabled: !!businessId },
  });

  const isLoading = bookingsLoading || ordersLoading;

  const { mutate: cancelBooking, isPending: cancellingBooking } = useUpdateProBookingStatus({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProBookingsQueryKey() });
        setCancelModalVisible(false);
      },
      onError: () => Alert.alert("Erreur", "Impossible d'annuler. Réessayez."),
    },
  });

  const { mutate: cancelOrder, isPending: cancellingOrder } = useUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetProOrdersQueryKey(businessId) });
        setCancelModalVisible(false);
      },
      onError: () => Alert.alert("Erreur", "Impossible d'annuler. Réessayez."),
    },
  });

  const isCancelling = cancellingBooking || cancellingOrder;

  // ── Merge + filter ────────────────────────────────────────────────────────────
  const allItems: AnyItem[] = [
    ...bookings.map((b) => ({ ...b, _type: "booking" as const })),
    ...orders.map((o) => ({ ...o, _type: "order" as const })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .filter((i) => {
      if (tab === "all") return true;
      if (tab === "confirmed") return i.status === "confirmed" || i.status === "pending";
      if (tab === "completed") return i.status === "completed" || i.status === "delivered";
      if (tab === "cancelled") return i.status === "cancelled";
      return true;
    });

  // ── Actions ──────────────────────────────────────────────────────────────────
  const canCancel = (item: AnyItem) =>
    item.status === "confirmed" || item.status === "pending";

  const openCancelModal = (item: AnyItem) => {
    setCancelTarget(item);
    setCancelReason("");
    setCancelNote("");
    setCancelModalVisible(true);
  };

  const confirmCancel = () => {
    if (!cancelReason || !cancelTarget) return;
    if (cancelTarget._type === "booking") {
      cancelBooking({ bookingId: cancelTarget.id, data: { status: "cancelled" } });
    } else {
      cancelOrder({ orderId: cancelTarget.id, data: { status: "cancelled" } });
    }
  };

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
          Les paiements en ligne sont retenus par Bymoh et versés <Text style={{ fontWeight: "700" }}>24h après la prestation</Text>
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

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : allItems.length === 0 ? (
        <EmptyState icon="inbox" title="Aucune entrée" subtitle="Vos réservations et commandes reçues apparaîtront ici" />
      ) : (
        <FlatList
          data={allItems}
          keyExtractor={(item) => item.id + item._type}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isBooking = item._type === "booking";
            const booking = item as ProBooking & { _type: "booking" };
            const order   = item as ProOrder   & { _type: "order"   };

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
                  <OrderStatusBadge status={item.status as any} />
                </View>

                {/* Content */}
                {isBooking ? (
                  <>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>
                      {booking.serviceTitle ?? (booking.bookingType === "table" ? "Réservation table" : "Réservation service")}
                    </Text>
                    {booking.userName && (
                      <View style={styles.infoRow}>
                        <Feather name="user" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                          {booking.userName}{booking.userPhone ? ` · ${booking.userPhone}` : ""}
                        </Text>
                      </View>
                    )}
                    <View style={styles.infoRow}>
                      <Feather name="calendar" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                        {formatDate(booking.date)} à {booking.time}
                      </Text>
                    </View>
                    {booking.partySize != null && (
                      <View style={styles.infoRow}>
                        <Feather name="users" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                          {booking.partySize} personne{booking.partySize > 1 ? "s" : ""}
                        </Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={[styles.itemTitle, { color: colors.text }]}>
                      {order.items.map((i) => i.title).join(", ")}
                    </Text>
                    <View style={styles.infoRow}>
                      <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                        {order.deliveryMethod === "delivery" ? "Livraison" : "Retrait sur place"}
                      </Text>
                    </View>
                    <Text style={[styles.price, { color: colors.primary }]}>
                      {formatPrice(order.total)}
                    </Text>
                  </>
                )}

                {/* Cancel action */}
                {canCancel(item) && (
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.destructive + "40", backgroundColor: colors.destructiveLight }]}
                    onPress={() => openCancelModal(item)}
                    disabled={isCancelling}
                  >
                    <Feather name="x-circle" size={14} color={colors.destructive} />
                    <Text style={[styles.cancelBtnText, { color: colors.destructive }]}>
                      Annuler
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      {/* ── Cancel reason modal ── */}
      <Modal
        visible={cancelModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCancelModalVisible(false)}
        statusBarTranslucent
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setCancelModalVisible(false)}
        />
        <View style={[styles.cancelSheet, { backgroundColor: colors.card, paddingBottom: botPad + 16 }]}>
          <View style={[styles.cancelSheetHandle, { backgroundColor: colors.border }]} />
          <Text style={[styles.cancelSheetTitle, { color: colors.text }]}>Annuler cette réservation</Text>
          <Text style={[styles.cancelSheetSub, { color: colors.mutedForeground }]}>
            Veuillez indiquer la raison de l'annulation. Le client sera notifié.
          </Text>

          {/* Reason selection */}
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 260 }}>
            {PRO_CANCEL_REASONS.map((reason) => {
              const active = cancelReason === reason;
              return (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonRow, { borderColor: active ? colors.destructive : colors.border, backgroundColor: active ? "#FEF2F2" : colors.background }]}
                  onPress={() => setCancelReason(reason)}
                >
                  <View style={[styles.reasonRadio, { borderColor: active ? colors.destructive : colors.border, backgroundColor: active ? colors.destructive : "transparent" }]}>
                    {active && <View style={styles.reasonRadioDot} />}
                  </View>
                  <Text style={[styles.reasonLabel, { color: colors.text }]}>{reason}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {cancelReason === "Autre raison" && (
            <TextInput
              style={[styles.cancelNoteInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
              placeholder="Précisez la raison..."
              placeholderTextColor={colors.mutedForeground}
              value={cancelNote}
              onChangeText={setCancelNote}
              multiline
            />
          )}

          {/* Confirmation notice */}
          <View style={[styles.confirmNotice, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Feather name="info" size={13} color="#DC2626" />
            <Text style={styles.confirmNoticeText}>
              Cette action est irréversible. Le créneau sera libéré.
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.cancelSheetBtns}>
            <TouchableOpacity
              style={[styles.cancelSheetKeep, { borderColor: colors.border }]}
              onPress={() => setCancelModalVisible(false)}
            >
              <Text style={[styles.cancelSheetKeepText, { color: colors.text }]}>Conserver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelSheetConfirm, { backgroundColor: cancelReason && !isCancelling ? "#DC2626" : colors.muted }]}
              onPress={confirmCancel}
              disabled={!cancelReason || isCancelling}
            >
              {isCancelling ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.cancelSheetConfirmText, { color: cancelReason ? "#fff" : colors.mutedForeground }]}>
                  Confirmer l'annulation
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  itemTitle: { fontSize: 15, fontWeight: "700" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  infoText: { fontSize: 12 },
  price: { fontSize: 15, fontWeight: "700" },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, marginTop: 4,
  },
  cancelBtnText: { fontSize: 13, fontWeight: "700" },

  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  cancelSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 24,
  },
  cancelSheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  cancelSheetTitle: { fontSize: 18, fontWeight: "800" },
  cancelSheetSub: { fontSize: 13, lineHeight: 18 },
  reasonRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8,
  },
  reasonRadio: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  reasonRadioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  reasonLabel: { fontSize: 14, flex: 1 },
  cancelNoteInput: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, minHeight: 72, textAlignVertical: "top",
  },
  confirmNotice: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 10, borderRadius: 10, borderWidth: 1,
  },
  confirmNoticeText: { fontSize: 12, color: "#DC2626", flex: 1, lineHeight: 17 },
  cancelSheetBtns: { flexDirection: "row", gap: 10 },
  cancelSheetKeep: {
    flex: 1, paddingVertical: 14, borderRadius: 14, borderWidth: 1,
    alignItems: "center",
  },
  cancelSheetKeepText: { fontSize: 14, fontWeight: "600" },
  cancelSheetConfirm: {
    flex: 2, paddingVertical: 14, borderRadius: 14, alignItems: "center",
  },
  cancelSheetConfirmText: { fontSize: 14, fontWeight: "700" },
});
