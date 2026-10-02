// components/order/CartItem.tsx
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { CatalogItem } from '@/types';

// Type panier étendu
interface CartItemType extends Partial<CatalogItem> {
  service_id?:   string;
  quantity:      number;
  business_id:   string;
  business_name: string;
}

interface CartItemProps {
  item: CartItemType;
  onAdd:    () => void;
  onRemove: () => void;
  onDelete: () => void;
}

export function CartItem({ item, onAdd, onRemove, onDelete }: CartItemProps) {
  return (
    <View style={s.row}>
      {/* ── Image ── */}
      {(item as any).image_url
        ? <Image source={{ uri: (item as any).image_url }} style={s.img} />
        : <View style={s.imgPh}><Text style={{ fontSize: 22 }}>📦</Text></View>
      }

      {/* ── Titre + prix unitaire ── */}
      <View style={s.body}>
        <Text style={s.name} numberOfLines={2}>{item.title}</Text>
        <Text style={s.unitPrice}>
          {(item.price ?? 0).toLocaleString('fr-FR')} FCFA / u
        </Text>
      </View>

      {/* ── Quantité + poubelle (colonne droite) ── */}
      <View style={s.actions}>
        {/* Poubelle en haut */}
        <TouchableOpacity style={s.trashBtn} onPress={onDelete} hitSlop={8}>
          <Feather name="trash-2" size={14} color="#EF4444" />
        </TouchableOpacity>

        {/* Compteur en bas */}
        <View style={s.counter}>
          <TouchableOpacity style={s.counterBtn} onPress={onRemove} activeOpacity={0.75}>
            <Feather name="minus" size={12} color="#374151" />
          </TouchableOpacity>
          <Text style={s.qty}>{item.quantity}</Text>
          <TouchableOpacity style={s.counterBtn} onPress={onAdd} activeOpacity={0.75}>
            <Feather name="plus" size={12} color="#374151" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  img:        { width: 80, height: 80, resizeMode: 'cover' },
  imgPh:      { width: 80, height: 80, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  body:       { flex: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  name:       { fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 19 },
  unitPrice:  { fontSize: 12, color: '#9CA3AF' },
  actions:    { paddingRight: 12, paddingVertical: 10, alignItems: 'center', gap: 8 },
  trashBtn:   { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  counter:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  counterBtn: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  qty:        { fontSize: 13, fontWeight: '800', color: '#111827', minWidth: 18, textAlign: 'center' },
});
