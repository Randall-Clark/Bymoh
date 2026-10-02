// app/(client)/order/cart.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Alert, FlatList, Platform, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CartItem } from '@/components/order/CartItem';
import { useCart } from '@/hooks/useCart';
import { useLocalSearchParams } from 'expo-router';
import { formatPrice } from '@/lib/utils';

const DELIVERY_FEE = 500;

export default function CartScreen() {
  const insets       = useSafeAreaInsets();
  const topPad       = Platform.OS === 'web' ? 67 : insets.top + 8;

  const { businessId } = useLocalSearchParams<{ businessId?: string }>();

  const {
    items, businessName, totalItems, totalAmount,
    addToCart, removeFromCart, updateQuantity, clearCart,
  } = useCart();

  if (items.length === 0) {
    return (
      <View style={[s.emptyRoot, { paddingTop: topPad }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => {
            if (businessId) {
              router.push({ pathname: '/(client)/business/[id]' as any, params: { id: businessId } });
            } else {
              router.back();
            }
          }}
        >
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={s.emptyContent}>
          <Feather name="shopping-cart" size={56} color="#D1D5DB" />
          <Text style={s.emptyTitle}>Panier vide</Text>
          <Text style={s.emptyText}>Ajoutez des articles depuis un commerce pour commencer.</Text>
          <TouchableOpacity style={s.exploreCta} onPress={() => router.push('/(client)')}>
            <Text style={s.exploreCtaText}>Explorer les commerces</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleClear = () => {
    Alert.alert('Vider le panier', 'Supprimer tous les articles ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Vider', style: 'destructive', onPress: clearCart },
    ]);
  };

  return (
    <View style={[s.root, { paddingTop: topPad }]}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity
          onPress={() => {
            if (businessId) {
              router.push({ pathname: '/(client)/business/[id]' as any, params: { id: businessId } });
            } else {
              router.back();
            }
          }}
          style={s.backBtn}
        >
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Mon panier</Text>
          {businessName && <Text style={s.bizName}>{businessName}</Text>}
        </View>
        <TouchableOpacity onPress={handleClear}>
          <Text style={s.clearText}>Vider</Text>
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <FlatList
        data={items}
        keyExtractor={(i) => i.service_id ?? i.id ?? Math.random().toString()}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <CartItem
            item={item}
            onAdd={() => {
              const catalogItem = {
                id:           item.service_id ?? item.id,
                title:        item.title,
                price:        item.price,
                image_url:    (item as any).image_url,
                allows_booking: false,
                is_available: true,
                business_id:  item.business_id,
                show_stock:   false,
                currency:     'XOF',
              };
              addToCart(catalogItem as any, item.business_id ?? '', item.business_name ?? '');
            }}
            onRemove={() => updateQuantity((item.service_id ?? item.id) as string, item.quantity - 1)}
            onDelete={() => removeFromCart((item.service_id ?? item.id) as string)}
          />
        )}
      />

      {/* Résumé — au-dessus de la tab bar grâce à (Platform.OS === 'ios' ? 83 : 60) */}
      <View style={[s.summary, { paddingBottom: (Platform.OS === 'ios' ? 83 : 60) + 8 }]}>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Sous-total ({totalItems} article{totalItems > 1 ? 's' : ''})</Text>
          <Text style={s.summaryValue}>{formatPrice(totalAmount)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={s.summaryLabel}>Frais de livraison</Text>
          <Text style={s.summaryValue}>{formatPrice(DELIVERY_FEE)}</Text>
        </View>
        <View style={[s.summaryRow, s.totalRow]}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>{formatPrice(totalAmount + DELIVERY_FEE)}</Text>
        </View>
        <TouchableOpacity
          style={s.checkoutBtn}
          onPress={() => router.push({ pathname: '/(client)/order/delivery' as any, params: { businessId: businessId ?? '' } })}
          activeOpacity={0.88}
        >
          <Text style={s.checkoutText}>Choisir la livraison</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#F8F7F4' },
  emptyRoot:     { flex: 1, backgroundColor: '#F8F7F4', paddingHorizontal: 24 },
  emptyContent:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyTitle:    { fontSize: 22, fontWeight: '700', color: '#111827' },
  emptyText:     { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
  exploreCta:    { backgroundColor: '#FF6835', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100 },
  exploreCtaText:{ fontSize: 15, fontWeight: '700', color: '#fff' },
  header:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  backBtn:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:         { fontSize: 20, fontWeight: '800', color: '#111827' },
  bizName:       { fontSize: 13, color: '#9CA3AF', marginTop: 1 },
  clearText:     { fontSize: 14, fontWeight: '600', color: '#EF4444' },
  list:          { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  summary:       { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  summaryRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel:  { fontSize: 14, color: '#6B7280' },
  summaryValue:  { fontSize: 14, fontWeight: '600', color: '#374151' },
  totalRow:      { paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', marginTop: 4 },
  totalLabel:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalValue:    { fontSize: 18, fontWeight: '800', color: '#FF6835' },
  checkoutBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FF6835', padding: 16, borderRadius: 14, marginTop: 4 },
  checkoutText:  { fontSize: 16, fontWeight: '700', color: '#fff' },
});
