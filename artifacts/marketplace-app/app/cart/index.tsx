import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import { formatPrice } from "@/constants/mockData";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";

export default function CartScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { items, totalItems, totalPrice, updateQuantity, removeItem } = useCart();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleCheckout = () => {
    router.push("/delivery/choice");
  };

  if (items.length === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Mon panier</Text>
          <View style={{ width: 22 }} />
        </View>
        <EmptyState
          icon="shopping-cart"
          title="Panier vide"
          subtitle="Ajoutez des services ou produits pour passer une commande"
          actionLabel="Explorer les services"
          onAction={() => router.push("/(tabs)")}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mon panier ({totalItems})</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.service.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          items.length > 0 ? (
            <Text style={[styles.from, { color: colors.mutedForeground }]}>
              De : {items[0].businessName}
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <View style={[styles.cartItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.itemTitle, { color: colors.text }]}>{item.service.title}</Text>
              <Text style={[styles.itemPrice, { color: colors.primary }]}>
                {formatPrice(item.service.price, item.service.currency)}
              </Text>
            </View>
            <View style={styles.qtyRow}>
              <TouchableOpacity
                style={[styles.qtyBtn, { backgroundColor: colors.muted }]}
                onPress={() => { Haptics.selectionAsync(); updateQuantity(item.service.id, item.quantity - 1); }}
              >
                <Feather name="minus" size={14} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.qty, { color: colors.text }]}>{item.quantity}</Text>
              <TouchableOpacity
                style={[styles.qtyBtn, { backgroundColor: colors.primary }]}
                onPress={() => { Haptics.selectionAsync(); updateQuantity(item.service.id, item.quantity + 1); }}
              >
                <Feather name="plus" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListFooterComponent={
          <View style={[styles.summary, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.mutedForeground }]}>Sous-total</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formatPrice(totalPrice)}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.totalLabel, { color: colors.text }]}>Total</Text>
              <Text style={[styles.totalValue, { color: colors.primary }]}>{formatPrice(totalPrice)}</Text>
            </View>
          </View>
        }
      />

      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
        <TouchableOpacity
          style={[styles.checkoutBtn, { backgroundColor: colors.primary }]}
          onPress={handleCheckout}
        >
          <Text style={styles.checkoutText}>Passer la commande</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  from: { fontSize: 13, marginBottom: 12 },
  list: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 16, gap: 12 },
  cartItem: { flexDirection: "row", alignItems: "center", padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  itemTitle: { fontSize: 14, fontWeight: "700" },
  itemPrice: { fontSize: 14, fontWeight: "600" },
  qtyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  qtyBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  qty: { fontSize: 16, fontWeight: "700", minWidth: 20, textAlign: "center" },
  summary: { marginTop: 8, borderRadius: 16, padding: 16, borderWidth: 1, gap: 10 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14 },
  summaryDivider: { height: 1 },
  totalLabel: { fontSize: 16, fontWeight: "700" },
  totalValue: { fontSize: 18, fontWeight: "800" },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  checkoutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 100 },
  checkoutText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
