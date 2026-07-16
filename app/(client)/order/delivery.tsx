import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useCart } from '@/hooks/useCart';
import { DeliveryPicker } from '@/components/order/DeliveryPicker';
import { formatPrice } from '@/lib/utils';
import type { DeliveryMethod } from '@/types';

export default function DeliveryScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { items, businessId, businessName, totalAmount, clearCart } = useCart();
  const [deliveryType, setDeliveryType] = useState<DeliveryMethod>('pickup');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const deliveryFee = deliveryType === 'pickup' ? 0 : deliveryType === 'gozem' ? 1500 : 1200;
  const total = totalAmount + deliveryFee;

  const handleOrder = async () => {
    if (deliveryType !== 'pickup' && !address.trim()) {
      Alert.alert('Adresse requise', 'Entrez votre adresse de livraison.');
      return;
    }
    if (!session?.user?.id) {
      Alert.alert('Non connecté');
      return;
    }
    setLoading(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: session.user.id,
          business_id: businessId,
          status: 'pending',
          delivery_method: deliveryType,
          delivery_address: deliveryType !== 'pickup' ? address : null,
          delivery_fee: deliveryFee,
          subtotal: totalAmount,
          total,
        })
        .select('id')
        .single();
      if (orderError) throw orderError;

      const orderItems = items.map((i) => ({
        order_id: orderData.id,
        service_id: i.service_id,
        title: i.title,
        quantity: i.quantity,
        unit_price: i.price,
        currency: 'XOF',
      }));
      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
      if (itemsError) throw itemsError;

      clearCart();
      router.replace('/(client)/order/confirmation');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la commande';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Mode de livraison</Text>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: botPad + 180 }]} showsVerticalScrollIndicator={false}>
        <DeliveryPicker selected={deliveryType} onSelect={(v) => setDeliveryType(v as DeliveryMethod)} />

        {deliveryType !== 'pickup' && (
          <View style={styles.addressSection}>
            <Text style={styles.addressLabel}>Adresse de livraison</Text>
            <View style={styles.addressInput}>
              <Feather name="map-pin" size={18} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Rue, quartier, ville..."
                placeholderTextColor="#9CA3AF"
                value={address}
                onChangeText={setAddress}
                multiline
              />
            </View>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botPad + 16 }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total commande</Text>
          <Text style={styles.totalValue}>{formatPrice(total)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.feeLabel}>dont {formatPrice(deliveryFee)} de livraison</Text>
        </View>
        <TouchableOpacity
          style={[styles.orderBtn, loading && { opacity: 0.7 }]}
          onPress={handleOrder}
          disabled={loading}
          activeOpacity={0.88}
        >
          <Text style={styles.orderBtnText}>{loading ? 'Traitement…' : 'Passer la commande'}</Text>
          <Feather name="arrow-right" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  content: { padding: 20, gap: 16 },
  addressSection: { gap: 10 },
  addressLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  addressInput: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  input: { flex: 1, fontSize: 15, color: '#111827', minHeight: 60 },
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 10 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalValue: { fontSize: 20, fontWeight: '800', color: '#FF6835' },
  feeLabel: { fontSize: 12, color: '#9CA3AF' },
  orderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FF6835', padding: 18, borderRadius: 100, marginTop: 10 },
  orderBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
