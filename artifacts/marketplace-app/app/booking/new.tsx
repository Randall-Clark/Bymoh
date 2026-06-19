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

const DATES = Array.from({ length: 14 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);
  return d;
});

const DAY_LABELS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const PARTY_SIZES = [1, 2, 3, 4, 5, 6, 7, 8];

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

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [partySize, setPartySize] = useState<number>(2);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const business = MOCK_BUSINESSES.find((b) => b.id === businessId);
  const service = business?.services.find((s) => s.id === serviceId);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const canConfirm = selectedDate && selectedTime;

  const handleConfirm = async () => {
    if (!canConfirm || loading) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 900));

    if (isTableMode) {
      await addBooking({
        id: `b_${Date.now()}`,
        businessId: business?.id ?? "",
        businessName: business?.name ?? "",
        businessCategory: business?.category ?? "",
        serviceName: `Table pour ${partySize} personne${partySize > 1 ? "s" : ""}`,
        servicePrice: 0,
        date: selectedDate.toISOString().split("T")[0],
        time: selectedTime!,
        status: "confirmed",
        createdAt: new Date().toISOString(),
      });
      setLoading(false);
      Alert.alert(
        "Réservation confirmée !",
        `Table pour ${partySize} personne${partySize > 1 ? "s" : ""} chez ${business?.name}\n\nDate : ${selectedDate.toLocaleDateString("fr-FR")}\nHeure : ${selectedTime}`,
        [{ text: "Voir mes réservations", onPress: () => router.replace("/orders/index") }]
      );
    } else {
      await addBooking({
        id: `b_${Date.now()}`,
        businessId: business?.id ?? "",
        businessName: business?.name ?? "",
        businessCategory: business?.category ?? "",
        serviceName: service?.title ?? "",
        servicePrice: service?.price ?? 0,
        date: selectedDate.toISOString().split("T")[0],
        time: selectedTime!,
        status: "confirmed",
        createdAt: new Date().toISOString(),
      });
      setLoading(false);
      Alert.alert(
        "Réservation confirmée !",
        `"${service?.title}" chez ${business?.name}\n\nDate : ${selectedDate.toLocaleDateString("fr-FR")}\nHeure : ${selectedTime}`,
        [{ text: "Voir mes réservations", onPress: () => router.replace("/orders/index") }]
      );
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {isTableMode ? "Réserver une table" : "Réserver un service"}
        </Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 100 }]} showsVerticalScrollIndicator={false}>

        {/* Summary card */}
        {isTableMode ? (
          <View style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.serviceIcon, { backgroundColor: colors.accent }]}>
              <Feather name="coffee" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.serviceName, { color: colors.text }]}>{business?.name}</Text>
              <Text style={[styles.businessName, { color: colors.mutedForeground }]}>Réservation de table</Text>
            </View>
            <View style={[styles.openBadge, { backgroundColor: colors.successLight }]}>
              <View style={[styles.openDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.openText, { color: colors.success }]}>Ouvert</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.serviceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.serviceIcon, { backgroundColor: colors.accent }]}>
              <Feather name="tag" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.serviceName, { color: colors.text }]}>{service?.title ?? "Service"}</Text>
              <Text style={[styles.businessName, { color: colors.mutedForeground }]}>{business?.name}</Text>
            </View>
            {service?.price !== undefined && (
              <Text style={[styles.servicePrice, { color: colors.primary }]}>
                {formatPrice(service.price, service.currency)}
              </Text>
            )}
          </View>
        )}

        {/* Party size (table mode only) */}
        {isTableMode && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Nombre de personnes</Text>
            <View style={styles.partyRow}>
              {PARTY_SIZES.map((n) => {
                const isSelected = partySize === n;
                return (
                  <TouchableOpacity
                    key={n}
                    style={[
                      styles.partyCell,
                      { backgroundColor: isSelected ? colors.primary : colors.card, borderColor: isSelected ? colors.primary : colors.border },
                    ]}
                    onPress={() => { setPartySize(n); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.partyNum, { color: isSelected ? "#fff" : colors.text }]}>{n}</Text>
                    <Text style={[styles.partyLabel, { color: isSelected ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>
                      pers.
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Date picker */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Choisir une date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
            {DATES.map((d, i) => {
              const isSelected = selectedDate?.toDateString() === d.toDateString();
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.dateCell,
                    { backgroundColor: isSelected ? colors.primary : colors.card, borderColor: isSelected ? colors.primary : colors.border },
                  ]}
                  onPress={() => { setSelectedDate(d); Haptics.selectionAsync(); }}
                >
                  <Text style={[styles.dayName, { color: isSelected ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>
                    {DAY_LABELS[d.getDay()]}
                  </Text>
                  <Text style={[styles.dayNum, { color: isSelected ? "#fff" : colors.text }]}>
                    {d.getDate()}
                  </Text>
                  <Text style={[styles.monthName, { color: isSelected ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>
                    {MONTH_LABELS[d.getMonth()]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Time slots */}
        {selectedDate && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Choisir une heure</Text>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((t) => {
                const isSelected = selectedTime === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.timeCell,
                      { backgroundColor: isSelected ? colors.primary : colors.card, borderColor: isSelected ? colors.primary : colors.border },
                    ]}
                    onPress={() => { setSelectedTime(t); Haptics.selectionAsync(); }}
                  >
                    <Text style={[styles.timeLabel, { color: isSelected ? "#fff" : colors.text }]}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Recap (table mode) */}
        {isTableMode && selectedDate && selectedTime && (
          <View style={[styles.recapCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.recapTitle, { color: colors.text }]}>Récapitulatif</Text>
            <View style={styles.recapRow}>
              <Feather name="users" size={14} color={colors.mutedForeground} />
              <Text style={[styles.recapText, { color: colors.text }]}>
                {partySize} personne{partySize > 1 ? "s" : ""}
              </Text>
            </View>
            <View style={styles.recapRow}>
              <Feather name="calendar" size={14} color={colors.mutedForeground} />
              <Text style={[styles.recapText, { color: colors.text }]}>
                {selectedDate.toLocaleDateString("fr-FR")} à {selectedTime}
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Confirm button */}
      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
        {canConfirm && !isTableMode && (
          <View style={styles.summaryRow}>
            <Feather name="calendar" size={14} color={colors.mutedForeground} />
            <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>
              {selectedDate!.toLocaleDateString("fr-FR")} à {selectedTime}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: canConfirm ? colors.primary : colors.muted }]}
          onPress={handleConfirm}
          disabled={!canConfirm || loading}
        >
          <Text style={[styles.confirmText, { color: canConfirm ? "#fff" : colors.mutedForeground }]}>
            {loading ? "Confirmation en cours..." : isTableMode ? `Réserver — ${partySize} pers.` : "Confirmer la réservation"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  scroll: { padding: 20, gap: 24 },
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceName: { fontSize: 15, fontWeight: "700" },
  businessName: { fontSize: 12, marginTop: 2 },
  servicePrice: { fontSize: 15, fontWeight: "700" },
  openBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  openDot: { width: 6, height: 6, borderRadius: 3 },
  openText: { fontSize: 11, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  partyRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  partyCell: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    minWidth: 60,
  },
  partyNum: { fontSize: 20, fontWeight: "800" },
  partyLabel: { fontSize: 10 },
  dateRow: { gap: 10, paddingVertical: 4 },
  dateCell: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
  },
  dayName: { fontSize: 10, fontWeight: "600" },
  dayNum: { fontSize: 20, fontWeight: "800" },
  monthName: { fontSize: 10 },
  timeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  timeCell: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1 },
  timeLabel: { fontSize: 13, fontWeight: "600" },
  recapCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
  },
  recapTitle: { fontSize: 14, fontWeight: "700" },
  recapRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  recapText: { fontSize: 14 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  summaryText: { fontSize: 13 },
  confirmBtn: { paddingVertical: 16, borderRadius: 100, alignItems: "center" },
  confirmText: { fontSize: 16, fontWeight: "700" },
});
