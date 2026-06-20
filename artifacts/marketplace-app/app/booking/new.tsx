import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOCK_BUSINESSES, TIME_SLOTS, formatPrice } from "@/constants/mockData";
import { useColors } from "@/hooks/useColors";
import { useOrders } from "@/context/OrdersContext";

// ─── Constants ─────────────────────────────────────────────────────────────────

const DATES = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return d;
});

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

// ─── Mock slot availability (deterministic per date+time) ─────────────────────
function slotSeats(date: Date, time: string): number {
  const h = time.replace(":", "");
  const d = date.getDate() + date.getMonth() * 31;
  const raw = Math.abs((d * 17 + parseInt(h, 10) * 7) ^ (d + parseInt(h, 10) * 3));
  return raw % 9; // 0–8 seats
}

type SlotState = "available" | "few" | "full";
function slotState(seats: number): SlotState {
  if (seats === 0) return "full";
  if (seats <= 2) return "few";
  return "available";
}

// ─── Booking Screen ────────────────────────────────────────────────────────────

type PayMethod = "online" | "on_site";

export default function BookingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { businessId, serviceId, bookingMode } = useLocalSearchParams<{
    businessId: string;
    serviceId?: string;
    bookingMode?: "table" | "service";
  }>();
  const { addBooking } = useOrders();

  const isTableMode = bookingMode === "table";
  const business = MOCK_BUSINESSES.find((b) => b.id === businessId);
  const service = business?.services.find((s) => s.id === serviceId);

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [partySize, setPartySize] = useState<number>(2);
  const [payMethod, setPayMethod] = useState<PayMethod | null>(null);
  const [loading, setLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const canConfirm = selectedDate && selectedTime && payMethod;

  // Slot helpers
  const getSeats = (t: string) => selectedDate ? slotSeats(selectedDate, t) : 5;
  const getState = (t: string): SlotState => slotState(getSeats(t));
  const slotColor = (state: SlotState, selected: boolean) => {
    if (selected) return colors.primary;
    if (state === "full") return colors.muted;
    if (state === "few") return "#FEF3C7";
    return colors.card;
  };
  const slotTextColor = (state: SlotState, selected: boolean) => {
    if (selected) return "#fff";
    if (state === "full") return colors.mutedForeground;
    if (state === "few") return "#92400E";
    return colors.text;
  };
  const slotBorderColor = (state: SlotState, selected: boolean) => {
    if (selected) return colors.primary;
    if (state === "full") return colors.border;
    if (state === "few") return "#F59E0B";
    return colors.border;
  };

  // ── 24h cancellation deadline ──
  const cancellationDeadline = selectedDate && selectedTime
    ? (() => {
        const dt = new Date(selectedDate);
        const [h, m] = (selectedTime ?? "00:00").split(":").map(Number);
        dt.setHours(h - 24, m);
        return dt.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      })()
    : null;

  const handleConfirm = async () => {
    if (!canConfirm || loading) return;
    const seats = slotSeats(selectedDate!, selectedTime!);
    if (seats === 0) {
      Alert.alert("Créneau indisponible", "Ce créneau est complet. Veuillez choisir un autre horaire.");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));

    const dateStr = selectedDate!.toISOString().split("T")[0];
    const serviceName = isTableMode
      ? `Table pour ${partySize} personne${partySize > 1 ? "s" : ""}`
      : (service?.title ?? "Service");

    await addBooking({
      id: `b_${Date.now()}`,
      businessId: business?.id ?? "",
      businessName: business?.name ?? "",
      businessCategory: business?.category ?? "",
      serviceName,
      servicePrice: service?.price ?? 0,
      date: dateStr,
      time: selectedTime!,
      status: "confirmed",
      paymentMethod: payMethod ?? "on_site",
      partySize: isTableMode ? partySize : undefined,
      createdAt: new Date().toISOString(),
    });

    setLoading(false);

    const payLabel = payMethod === "online" ? "Paiement en ligne (Mobile Money)" : "Paiement sur place";
    Alert.alert(
      "✅ Réservation confirmée !",
      `${serviceName} chez ${business?.name}\n\n📅 ${selectedDate!.toLocaleDateString("fr-FR")} à ${selectedTime}\n💳 ${payLabel}\n\n⚠️ Annulation gratuite jusqu'à 24h avant.`,
      [{ text: "Voir mes réservations", onPress: () => router.replace("/orders" as any) }]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isTableMode ? "Réserver une table" : "Réserver ce service"}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Service / Table summary ── */}
        {isTableMode ? (
          <View style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.serviceIcon, { backgroundColor: colors.accent }]}>
              <Feather name="coffee" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.serviceName, { color: colors.text }]}>{business?.name}</Text>
              <Text style={[styles.serviceDesc, { color: colors.mutedForeground }]}>Réservation de table</Text>
            </View>
            {business?.isOpen && (
              <View style={[styles.openBadge, { backgroundColor: "#D1FAE5" }]}>
                <View style={[styles.openDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.openText, { color: colors.success }]}>Ouvert</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.serviceIcon, { backgroundColor: colors.accent }]}>
              <Feather name="tag" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.serviceName, { color: colors.text }]}>{service?.title ?? "Service"}</Text>
              <Text style={[styles.serviceDesc, { color: colors.mutedForeground }]}>{business?.name}</Text>
            </View>
            {service?.price !== undefined && (
              <Text style={[styles.servicePrice, { color: colors.primary }]}>
                {formatPrice(service.price, service.currency)}
              </Text>
            )}
          </View>
        )}

        {/* ── Cancellation policy ── */}
        <View style={[styles.policyCard, { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" }]}>
          <Feather name="shield" size={16} color="#2563EB" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.policyTitle}>Annulation gratuite</Text>
            <Text style={styles.policyText}>
              Annulez jusqu'à 24h avant votre rendez-vous sans frais. Au-delà, des frais peuvent s'appliquer.
            </Text>
          </View>
        </View>

        {/* ── Party size (table only) ── */}
        {isTableMode && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Nombre de personnes</Text>
            <View style={styles.partyRow}>
              {PARTY_SIZES.map((n) => {
                const sel = partySize === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[styles.partyCell, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                    onPress={() => { setPartySize(n); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.partyNum, { color: sel ? "#fff" : colors.text }]}>{n}</Text>
                    <Text style={[styles.partyLabel, { color: sel ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>pers.</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Date picker ── */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Choisir une date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
            {DATES.map((d, i) => {
              const sel = selectedDate?.toDateString() === d.toDateString();
              return (
                <TouchableOpacity
                  key={i}
                  style={[styles.dateCell, { backgroundColor: sel ? colors.primary : colors.card, borderColor: sel ? colors.primary : colors.border }]}
                  onPress={() => { setSelectedDate(d); setSelectedTime(null); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.dayName, { color: sel ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>
                    {DAY_LABELS[d.getDay()]}
                  </Text>
                  <Text style={[styles.dayNum, { color: sel ? "#fff" : colors.text }]}>{d.getDate()}</Text>
                  <Text style={[styles.monthName, { color: sel ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>
                    {MONTH_LABELS[d.getMonth()]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Time slots ── */}
        {selectedDate && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Choisir un créneau</Text>
              <View style={styles.legend}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Libre</Text>
                <View style={[styles.legendDot, { backgroundColor: "#F59E0B" }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Peu de places</Text>
                <View style={[styles.legendDot, { backgroundColor: colors.muted }]} />
                <Text style={[styles.legendText, { color: colors.mutedForeground }]}>Complet</Text>
              </View>
            </View>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((t) => {
                const state = getState(t);
                const sel = selectedTime === t;
                const full = state === "full";
                const seats = getSeats(t);
                return (
                  <TouchableOpacity
                    key={t}
                    disabled={full}
                    style={[
                      styles.timeCell,
                      {
                        backgroundColor: slotColor(state, sel),
                        borderColor: slotBorderColor(state, sel),
                        opacity: full ? 0.5 : 1,
                      },
                    ]}
                    onPress={() => { setSelectedTime(t); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.timeLabel, { color: slotTextColor(state, sel) }]}>{t}</Text>
                    {!sel && state === "few" && (
                      <Text style={[styles.timeSub, { color: "#92400E" }]}>{seats} pl.</Text>
                    )}
                    {!sel && state === "full" && (
                      <Text style={[styles.timeSub, { color: colors.mutedForeground }]}>Complet</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Payment method ── */}
        {selectedDate && selectedTime && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Mode de paiement</Text>
            <View style={styles.payRow}>
              {/* Pay online */}
              <TouchableOpacity
                style={[
                  styles.payOption,
                  {
                    backgroundColor: payMethod === "online" ? colors.accent : colors.card,
                    borderColor: payMethod === "online" ? colors.primary : colors.border,
                    borderWidth: payMethod === "online" ? 2 : 1,
                  },
                ]}
                onPress={() => { setPayMethod("online"); Haptics.selectionAsync(); }}
              >
                <View style={[styles.payIconWrap, { backgroundColor: payMethod === "online" ? colors.primary + "20" : colors.muted }]}>
                  <Feather name="smartphone" size={20} color={payMethod === "online" ? colors.primary : colors.mutedForeground} />
                </View>
                <Text style={[styles.payLabel, { color: colors.text }]}>Payer maintenant</Text>
                <Text style={[styles.paySub, { color: colors.mutedForeground }]}>Mobile Money · Flooz · T-Money</Text>
                {payMethod === "online" && (
                  <View style={[styles.payCheck, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>

              {/* Pay on site */}
              <TouchableOpacity
                style={[
                  styles.payOption,
                  {
                    backgroundColor: payMethod === "on_site" ? colors.accent : colors.card,
                    borderColor: payMethod === "on_site" ? colors.primary : colors.border,
                    borderWidth: payMethod === "on_site" ? 2 : 1,
                  },
                ]}
                onPress={() => { setPayMethod("on_site"); Haptics.selectionAsync(); }}
              >
                <View style={[styles.payIconWrap, { backgroundColor: payMethod === "on_site" ? colors.primary + "20" : colors.muted }]}>
                  <Feather name="credit-card" size={20} color={payMethod === "on_site" ? colors.primary : colors.mutedForeground} />
                </View>
                <Text style={[styles.payLabel, { color: colors.text }]}>Payer sur place</Text>
                <Text style={[styles.paySub, { color: colors.mutedForeground }]}>Cash ou carte à l'arrivée</Text>
                {payMethod === "on_site" && (
                  <View style={[styles.payCheck, { backgroundColor: colors.primary }]}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Recap ── */}
        {selectedDate && selectedTime && payMethod && (
          <View style={[styles.recapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.recapTitle, { color: colors.text }]}>Récapitulatif</Text>
            {isTableMode && (
              <View style={styles.recapRow}>
                <Feather name="users" size={14} color={colors.mutedForeground} />
                <Text style={[styles.recapText, { color: colors.text }]}>
                  {partySize} personne{partySize > 1 ? "s" : ""}
                </Text>
              </View>
            )}
            <View style={styles.recapRow}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.recapText, { color: colors.text }]}>
                {selectedDate.toLocaleDateString("fr-FR")} à {selectedTime}
              </Text>
            </View>
            {!isTableMode && service?.price !== undefined && service.price > 0 && (
              <View style={styles.recapRow}>
                <Feather name="tag" size={14} color={colors.mutedForeground} />
                <Text style={[styles.recapText, { color: colors.text }]}>
                  {formatPrice(service.price, service.currency)}
                  {payMethod === "on_site" ? " (sur place)" : " (payé maintenant)"}
                </Text>
              </View>
            )}
            {cancellationDeadline && (
              <View style={[styles.recapCancel, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
                <Feather name="alert-circle" size={13} color="#EA580C" />
                <Text style={styles.recapCancelText}>
                  Annulation gratuite avant le {cancellationDeadline}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: canConfirm ? colors.primary : colors.muted }]}
          onPress={handleConfirm}
          disabled={!canConfirm || loading}
        >
          {loading ? (
            <Text style={[styles.confirmText, { color: "#fff" }]}>Confirmation en cours...</Text>
          ) : !selectedDate || !selectedTime ? (
            <Text style={[styles.confirmText, { color: colors.mutedForeground }]}>Choisissez une date et un horaire</Text>
          ) : !payMethod ? (
            <Text style={[styles.confirmText, { color: colors.mutedForeground }]}>Choisissez un mode de paiement</Text>
          ) : (
            <Text style={[styles.confirmText, { color: "#fff" }]}>
              {isTableMode
                ? `Confirmer — Table ${partySize} pers. · ${selectedTime}`
                : `Confirmer la réservation · ${selectedTime}`}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  scroll: { padding: 20, gap: 24 },

  // Summary card
  serviceCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  serviceIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  serviceName: { fontSize: 15, fontWeight: "700" },
  serviceDesc: { fontSize: 12, marginTop: 2 },
  servicePrice: { fontSize: 15, fontWeight: "700" },
  openBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  openText: { fontSize: 11, fontWeight: "700" },

  // Cancellation policy
  policyCard: { flexDirection: "row", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1, alignItems: "flex-start" },
  policyTitle: { fontSize: 13, fontWeight: "700", color: "#1D4ED8" },
  policyText: { fontSize: 12, color: "#3B82F6", lineHeight: 17 },

  // Party size
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  sectionHeaderRow: { marginBottom: 12 },
  partyRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  partyCell: { alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, minWidth: 60 },
  partyNum: { fontSize: 20, fontWeight: "800" },
  partyLabel: { fontSize: 10 },

  // Date
  dateRow: { gap: 10, paddingVertical: 4 },
  dateCell: { alignItems: "center", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, gap: 2 },
  dayName: { fontSize: 10, fontWeight: "600" },
  dayNum: { fontSize: 20, fontWeight: "800" },
  monthName: { fontSize: 10 },

  // Slots
  legend: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  timeCell: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: "center", minWidth: 72 },
  timeLabel: { fontSize: 13, fontWeight: "700" },
  timeSub: { fontSize: 9, fontWeight: "600", marginTop: 2 },

  // Payment
  payRow: { gap: 12 },
  payOption: {
    padding: 16, borderRadius: 16, gap: 4, position: "relative",
  },
  payIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  payLabel: { fontSize: 15, fontWeight: "700" },
  paySub: { fontSize: 12 },
  payCheck: {
    position: "absolute", top: 14, right: 14,
    width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center",
  },

  // Recap
  recapCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 10 },
  recapTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  recapRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recapText: { fontSize: 14 },
  recapCancel: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    marginTop: 4, padding: 10, borderRadius: 10, borderWidth: 1,
  },
  recapCancelText: { fontSize: 12, color: "#EA580C", flex: 1, lineHeight: 17 },

  // Footer
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  confirmBtn: { paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  confirmText: { fontSize: 15, fontWeight: "700" },
});
