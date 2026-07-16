import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartItem } from '@/components/order/CartItem';
import { useCart } from '@/hooks/useCart';
import { formatPrice } from '@/lib/utils';

const DELIVERY_FEE = 500;

export default function CartScreen() {
  const insets = useSafeAreaInsets();
  const { items, businessName, totalItems, totalAmount, addToCart, removeFromCart, updateQuantity, clearCart } = useCart();
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;

  if (items.length === 0) {
    return (
      <View style={[styles.emptyRoot, { paddingTop: topPad, paddingBottom: botPad }]}>
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={styles.emptyContent}>
          <Feather name="shopping-cart" size={56} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>Panier vide</Text>
          <Text style={styles.emptyText}>Ajoutez des articles depuis un commerce pour commencer.</Text>
          <TouchableOpacity style={styles.exploreCta} onPress={() => router.push('/(client)')}>
            <Text style={styles.exploreCtaText}>Explorer les commerces</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleClearCart = () => {
    Alert.alert('Vider le panier', 'Supprimer tous les articles du panier ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Vider', style: 'destructive', onPress: clearCart },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Mon panier</Text>
          {businessName && <Text style={styles.bizName}>{businessName}</Text>}
        </View>
        <TouchableOpacity onPress={handleClearCart}>
          <Text style={styles.clearText}>Vider</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.service_id}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 160 }]}
        renderItem={({ item }) => (
          <CartItem
            item={item}
            onAdd={() => {
              const catalogItem = { id: item.service_id, title: item.title, price: item.price, allows_booking: false, is_available: true, business_id: item.business_id, show_stock: false, currency: 'XOF' };
              addToCart(catalogItem as any, item.business_id, item.business_name);
            }}
            onRemove={() => updateQuantity(item.service_id, item.quantity - 1)}
            onDelete={() => removeFromCart(item.service_id)}
          />
        )}
      />

      {/* Order summary */}
      <View style={[styles.summary, { paddingBottom: botPad + 8 }]}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Sous-total ({totalItems} articles)</Text>
          <Text style={styles.summaryValue}>{formatPrice(totalAmount)}</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Frais de livraison</Text>
          <Text style={styles.summaryValue}>{formatPrice(DELIVERY_FEE)}</Text>
        </View>
        <View style={[styles.summaryRow, styles.totalRow]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalValue}>{formatPrice(totalAmount + DELIVERY_FEE)}</Text>
        </View>
        <TouchableOpacity
          style={styles.checkoutBtn}
          onPress={() => router.push('/(client)/order/delivery')}
          activeOpacity={0.88}
        >
          <Text style={styles.checkoutText}>Choisir la livraison</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  emptyRoot: { flex: 1, backgroundColor: '#F8F7F4', paddingHorizontal: 24 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#111827' },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
  exploreCta: { backgroundColor: '#FF6835', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100 },
  exploreCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  bizName: { fontSize: 13, color: '#9CA3AF', marginTop: 1 },
  clearText: { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  summary: { backgroundColor: '#fff', paddingHorizontal: 24, paddingTop: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#374151' },
  totalRow: { paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', marginTop: 4 },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '800', color: '#FF6835' },
  checkoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FF6835', padding: 18, borderRadius: 100, marginTop: 8 },
  checkoutText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
