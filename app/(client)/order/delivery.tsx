// app/(client)/order/delivery.tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useCart } from '@/hooks/useCart';
import { DeliveryPicker } from '@/components/order/DeliveryPicker';
import { formatPrice } from '@/lib/utils';
import type { DeliveryMethod } from '@/types';

const DELIVERY_FEES: Record<DeliveryMethod, number> = {
  pickup:   0,
  merchant: 500,
  delivery: 500,
  gozem:    1200,
  yango:    1500,
};

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export default function DeliveryScreen() {
  const insets       = useSafeAreaInsets();
  // Padding suffisant pour dépasser tab bar + safe area
  const footerPad    = Math.max((Platform.OS === 'ios' ? 83 : 60), 56) + Math.max(insets.bottom, 16) + 8;
  const topPad       = Platform.OS === 'web' ? 67 : insets.top + 8;

  const { profile }  = useAuthStore();
  const { businessId: paramBusinessId } = useLocalSearchParams<{ businessId?: string }>();

  const {
    items, businessId: cartBusinessId, businessName,
    totalAmount, clearCart,
  } = useCart();

  // businessId peut venir du cart store ou des params URL
  const bizId = cartBusinessId ?? paramBusinessId ?? '';

  const [deliveryType, setDeliveryType] = useState<DeliveryMethod>('pickup');
  const [address,      setAddress]      = useState('');
  const [loading,      setLoading]      = useState(false);

  const deliveryCost = DELIVERY_FEES[deliveryType] ?? 0;
  const total        = totalAmount + deliveryCost;
  const needsAddress = deliveryType !== 'pickup';

  // ── Créer la commande en DB ───────────────────────────────────────────────
  const handleConfirm = async () => {
    if (!profile?.id) {
      Alert.alert('Erreur', 'Vous devez être connecté pour commander.');
      return;
    }
    if (needsAddress && !address.trim()) {
      Alert.alert('Adresse requise', 'Veuillez entrer votre adresse de livraison.');
      return;
    }
    if (items.length === 0) {
      Alert.alert('Panier vide', 'Votre panier est vide.');
      return;
    }

    setLoading(true);
    try {
      const orderId = generateId();

      // 1. Créer la commande
      const { error: orderErr } = await supabase.from('orders').insert({
        id:               orderId,
        user_id:          profile.id,
        business_id:      bizId,
        status:           'pending',
        total_amount:     total,
        delivery_method:  deliveryType,
        delivery_address: needsAddress ? address.trim() : null,
        delivery_fee:     deliveryCost,
        created_at:       new Date().toISOString(),
      });
      if (orderErr) throw orderErr;

      // 2. Créer les order_items
      const orderItems = items.map((item: any) => ({
        id:         generateId(),
        order_id:   orderId,
        service_id: item.service_id ?? item.id,
        title:      item.title,
        quantity:   item.quantity,
        unit_price: item.price,
        subtotal:   item.price * item.quantity,
      }));

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(orderItems);
      if (itemsErr) throw itemsErr;

      // 3. Vider le panier
      clearCart();

      // 4. Rediriger vers la confirmation
      router.replace({
        pathname: '/(client)/order/confirmation' as any,
        params: {
          orderId,
          deliveryType,
          total: total.toString(),
        },
      });

    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de valider la commande.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F7F4' }}>

      {/* Header */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.push({
            pathname: '/(client)/order/cart' as any,
            params:   { businessId: bizId },
          })}
        >
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Mode de livraison</Text>
          {businessName ? <Text style={s.bizName}>{businessName}</Text> : null}
        </View>
      </View>

      {/* Contenu défilant */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Sélecteur de mode — composant existant */}
        <DeliveryPicker
          selected={deliveryType}
          onSelect={(m: DeliveryMethod) => setDeliveryType(m)}
        />

        {/* Champ adresse si livraison */}
        {needsAddress && (
          <View style={s.addressCard}>
            <Text style={s.addressLabel}>Adresse de livraison</Text>
            <TextInput
              style={s.addressInput}
              value={address}
              onChangeText={setAddress}
              placeholder="Entrez votre adresse complète..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={2}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Info code QR retrait */}
        {deliveryType === 'pickup' && (
          <View style={s.infoBox}>
            <Feather name="info" size={16} color="#1E3A5F" />
            <Text style={s.infoText}>
              Un code QR vous sera remis après confirmation. Le marchand le scannera pour valider la remise de votre commande.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* ✅ Footer au-dessus de la tab bar via (Platform.OS === 'ios' ? 83 : 60) */}
      <View style={[s.footer, { paddingBottom: footerPad }]}>
        <View style={s.recapRow}>
          <Text style={s.recapLabel}>Articles ({items.length})</Text>
          <Text style={s.recapValue}>{formatPrice(totalAmount)}</Text>
        </View>
        <View style={s.recapRow}>
          <Text style={s.recapLabel}>Livraison</Text>
          <Text style={[s.recapValue, deliveryCost === 0 && { color: '#22C55E' }]}>
            {deliveryCost === 0 ? 'Gratuit' : formatPrice(deliveryCost)}
          </Text>
        </View>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>{formatPrice(total)}</Text>
        </View>
        <TouchableOpacity
          style={[s.confirmBtn, loading && { opacity: 0.7 }]}
          onPress={handleConfirm}
          disabled={loading}
          activeOpacity={0.88}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <>
                <Feather name="check" size={18} color="#fff" />
                <Text style={s.confirmBtnTxt}>Confirmer la commande</Text>
              </>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn:      { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 18, fontWeight: '800', color: '#111827' },
  bizName:      { fontSize: 13, color: '#9CA3AF', marginTop: 1 },
  addressCard:  { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  addressLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  addressInput: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#111827', borderWidth: 1.5, borderColor: '#E5E7EB', minHeight: 70 },
  infoBox:      { flexDirection: 'row', gap: 10, backgroundColor: '#EEF2FF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  infoText:     { flex: 1, fontSize: 13, color: '#1E3A5F', lineHeight: 18 },
  footer:       { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, gap: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 8 },
  recapRow:     { flexDirection: 'row', justifyContent: 'space-between' },
  recapLabel:   { fontSize: 14, color: '#6B7280' },
  recapValue:   { fontSize: 14, fontWeight: '600', color: '#374151' },
  totalRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', marginTop: 4 },
  totalLabel:   { fontSize: 16, fontWeight: '700', color: '#111827' },
  totalValue:   { fontSize: 18, fontWeight: '800', color: '#FF6835' },
  confirmBtn:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FF6835', borderRadius: 16, paddingVertical: 16, shadowColor: '#FF6835', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  confirmBtnTxt:{ fontSize: 16, fontWeight: '700', color: '#fff' },
});
