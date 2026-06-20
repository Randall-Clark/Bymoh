import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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
import EmptyState from "@/components/EmptyState";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { formatPrice } from "@/constants/mockData";
import { Booking } from "@/constants/types";
import { useOrders } from "@/context/OrdersContext";
import { useColors } from "@/hooks/useColors";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

const CLIENT_CANCEL_REASONS = [
  "Changement de plans",
  "Erreur dans la réservation",
  "Je n'en ai plus besoin",
  "J'ai trouvé un autre prestataire",
  "Prix trop élevé",
  "Autre raison",
];

export default function OrdersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { bookings, orders } = useOrders();
  const [activeTab, setActiveTab] = useState<"bookings" | "orders">("bookings");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Cancel modal state
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelNote, setCancelNote] = useState("");

  const openCancelModal = (booking: Booking) => {
    setCancelTarget(booking);
    setCancelReason("");
    setCancelNote("");
    setCancelModalVisible(true);
  };

  const confirmCancel = () => {
    if (!cancelReason) return;
    setCancelModalVisible(false);
    // In a real app: API call to cancel booking
  };

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
              {tab === "bookings" ? `Réservations${bookings.length > 0 ? ` (${bookings.length})` : ""}` : `Commandes${orders.length > 0 ? ` (${orders.length})` : ""}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === "bookings" ? (
        bookings.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="Aucune réservation"
            subtitle="Vos réservations apparaîtront ici après confirmation"
            actionLabel="Explorer les commerces"
            onAction={() => router.push("/(tabs)/search")}
          />
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
            renderItem={({ item }) => {
              const canCancel = item.status === "confirmed" || item.status === "pending";
              return (
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
                  {/* Cancel button */}
                  {canCancel && (
                    <TouchableOpacity
                      style={[styles.cancelBtn, { borderColor: "#FECACA", backgroundColor: "#FEF2F2" }]}
                      onPress={() => openCancelModal(item)}
                    >
                      <Feather name="x-circle" size={14} color="#DC2626" />
                      <Text style={styles.cancelBtnText}>Annuler cette réservation</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        )
      ) : (
        orders.length === 0 ? (
          <EmptyState
            icon="shopping-bag"
            title="Aucune commande"
            subtitle="Vos commandes apparaîtront ici après paiement"
            actionLabel="Explorer les commerces"
            onAction={() => router.push("/(tabs)/search")}
          />
        ) : (
          <FlatList
            data={orders}
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

      {/* ── Cancel reason modal (client) ── */}
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
            Aidez-nous à comprendre pourquoi. Le business sera notifié.
          </Text>

          {/* Refund info */}
          {cancelTarget?.paymentMethod === "online" && (cancelTarget?.servicePrice ?? 0) > 0 && (
            <View style={[styles.refundInfo, { backgroundColor: "#D1FAE5", borderColor: "#A7F3D0" }]}>
              <Feather name="check-circle" size={14} color="#059669" />
              <Text style={styles.refundInfoText}>
                Vous avez payé en ligne ({formatPrice(cancelTarget.servicePrice)}).
                Kola vous remboursera automatiquement sous 24–48h si l'annulation est dans les délais.
              </Text>
            </View>
          )}

          {/* Reason list */}
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 250 }}>
            {CLIENT_CANCEL_REASONS.map((reason) => {
              const active = cancelReason === reason;
              return (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonRow, { borderColor: active ? "#DC2626" : colors.border, backgroundColor: active ? "#FEF2F2" : colors.background }]}
                  onPress={() => setCancelReason(reason)}
                >
                  <View style={[styles.reasonRadio, { borderColor: active ? "#DC2626" : colors.border, backgroundColor: active ? "#DC2626" : "transparent" }]}>
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
              placeholder="Précisez votre raison..."
              placeholderTextColor={colors.mutedForeground}
              value={cancelNote}
              onChangeText={setCancelNote}
              multiline
            />
          )}

          {/* Warning */}
          <View style={[styles.confirmNotice, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
            <Feather name="alert-triangle" size={13} color="#D97706" />
            <Text style={[styles.confirmNoticeText, { color: "#92400E" }]}>
              L'annulation après le délai peut entraîner des frais selon la politique du commerce.
            </Text>
          </View>

          {/* Buttons */}
          <View style={styles.cancelSheetBtns}>
            <TouchableOpacity
              style={[styles.cancelSheetKeep, { borderColor: colors.border }]}
              onPress={() => setCancelModalVisible(false)}
            >
              <Text style={[styles.cancelSheetKeepText, { color: colors.text }]}>Garder</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.cancelSheetConfirm, { backgroundColor: cancelReason ? "#DC2626" : colors.muted }]}
              onPress={confirmCancel}
              disabled={!cancelReason}
            >
              <Text style={[styles.cancelSheetConfirmText, { color: cancelReason ? "#fff" : colors.mutedForeground }]}>
                Annuler la réservation
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  cancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  cancelBtnText: { fontSize: 13, fontWeight: "700", color: "#DC2626" },

  // Cancel modal
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  cancelSheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16, elevation: 24,
  },
  cancelSheetHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },
  cancelSheetTitle: { fontSize: 18, fontWeight: "800" },
  cancelSheetSub: { fontSize: 13, lineHeight: 18 },
  refundInfo: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    padding: 12, borderRadius: 12, borderWidth: 1,
  },
  refundInfoText: { fontSize: 12, color: "#065F46", flex: 1, lineHeight: 17 },
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
  confirmNoticeText: { fontSize: 12, flex: 1, lineHeight: 17 },
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
