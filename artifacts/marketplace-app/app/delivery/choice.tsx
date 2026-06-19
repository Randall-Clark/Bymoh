import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatPrice } from "@/constants/mockData";
import { DeliveryProvider } from "@/constants/types";
import { useCart } from "@/context/CartContext";
import { useOrders } from "@/context/OrdersContext";
import { useColors } from "@/hooks/useColors";

const DELIVERY_OPTIONS = [
  {
    id: "gozem" as DeliveryProvider,
    name: "Gozem",
    tagline: "Livraison rapide dans votre ville",
    estimate: "15 – 30 min",
    price: 1000,
    icon: "zap",
  },
  {
    id: "yango" as DeliveryProvider,
    name: "Yango",
    tagline: "Service de livraison fiable",
    estimate: "20 – 40 min",
    price: 800,
    icon: "truck",
  },
  {
    id: "pickup" as any,
    name: "Retrait sur place",
    tagline: "Venez récupérer votre commande",
    estimate: "Dès que prêt",
    price: 0,
    icon: "map-pin",
  },
];

export default function DeliveryChoiceScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { totalPrice, clearCart, items } = useCart();
  const { addOrder } = useOrders();
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const selectedOption = DELIVERY_OPTIONS.find((o) => o.id === selected);
  const finalTotal = totalPrice + (selectedOption?.price ?? 0);

  const handleConfirm = async () => {
    if (!selected || loading) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1200));

    const firstItem = items[0];
    if (firstItem) {
      await addOrder({
        id: `o_${Date.now()}`,
        businessId: firstItem.businessId,
        businessName: firstItem.businessName,
        businessCategory: "",
        items: items.map((i) => ({
          title: i.service.title,
          quantity: i.quantity,
          price: i.service.price,
        })),
        total: finalTotal,
        status: selected !== "pickup" ? "in_delivery" : "confirmed",
        deliveryMethod: selected as any,
        createdAt: new Date().toISOString(),
      });
    }

    setLoading(false);
    clearCart();

    if (selected !== "pickup") {
      router.replace("/delivery/tracking");
    } else {
      Alert.alert("Commande passée !", "Votre commande a été envoyée au business.", [
        { text: "Voir mes commandes", onPress: () => router.replace("/orders") },
      ]);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mode de livraison</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Choisissez comment recevoir votre commande
        </Text>

        <View style={styles.options}>
          {DELIVERY_OPTIONS.map((option) => {
            const isSelected = selected === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
                onPress={() => { setSelected(option.id); Haptics.selectionAsync(); }}
                activeOpacity={0.85}
              >
                <View style={[styles.optionIcon, { backgroundColor: isSelected ? colors.accent : colors.muted }]}>
                  <Feather name={option.icon as any} size={24} color={isSelected ? colors.primary : colors.mutedForeground} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.optionNameRow}>
                    <Text style={[styles.optionName, { color: colors.text }]}>{option.name}</Text>
                    <Text style={[styles.optionPrice, { color: option.price === 0 ? colors.success : colors.text }]}>
                      {option.price === 0 ? "Gratuit" : formatPrice(option.price)}
                    </Text>
                  </View>
                  <Text style={[styles.optionTagline, { color: colors.mutedForeground }]}>{option.tagline}</Text>
                  <View style={styles.estimateRow}>
                    <Feather name="clock" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.estimate, { color: colors.mutedForeground }]}>{option.estimate}</Text>
                  </View>
                </View>
                <View style={[styles.radio, { borderColor: isSelected ? colors.primary : colors.border }]}>
                  {isSelected && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {selected && (
          <View style={[styles.totalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Articles</Text>
              <Text style={[styles.totalValue, { color: colors.text }]}>{formatPrice(totalPrice)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={[styles.totalLabel, { color: colors.mutedForeground }]}>Livraison</Text>
              <Text style={[styles.totalValue, { color: selectedOption?.price === 0 ? colors.success : colors.text }]}>
                {selectedOption?.price === 0 ? "Gratuit" : formatPrice(selectedOption?.price ?? 0)}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.totalRow}>
              <Text style={[styles.grandLabel, { color: colors.text }]}>Total</Text>
              <Text style={[styles.grandValue, { color: colors.primary }]}>{formatPrice(finalTotal)}</Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.confirmBtn, { backgroundColor: selected ? colors.primary : colors.muted }]}
          onPress={handleConfirm}
          disabled={!selected || loading}
        >
          <Text style={[styles.confirmText, { color: selected ? "#fff" : colors.mutedForeground }]}>
            {loading ? "Traitement en cours..." : "Confirmer la commande"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  content: { flex: 1, padding: 20, gap: 20 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  options: { gap: 12 },
  optionCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, gap: 14 },
  optionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  optionNameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 2 },
  optionName: { fontSize: 15, fontWeight: "700" },
  optionPrice: { fontSize: 14, fontWeight: "700" },
  optionTagline: { fontSize: 12, marginBottom: 4 },
  estimateRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  estimate: { fontSize: 11 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  totalCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { fontSize: 14 },
  totalValue: { fontSize: 14 },
  divider: { height: 1 },
  grandLabel: { fontSize: 16, fontWeight: "700" },
  grandValue: { fontSize: 18, fontWeight: "800" },
  confirmBtn: { paddingVertical: 16, borderRadius: 100, alignItems: "center" },
  confirmText: { fontSize: 16, fontWeight: "700" },
});
