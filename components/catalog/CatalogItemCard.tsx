import React from 'react';
import { Image, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatPrice } from '@/lib/utils';
import type { CatalogItem } from '@/types';

interface CatalogItemCardProps {
  item: CatalogItem;
  quantity?: number;
  onAdd: () => void;
  onRemove?: () => void;
}

export function CatalogItemCard({ item, quantity = 0, onAdd, onRemove }: CatalogItemCardProps) {
  return (
    <View style={styles.card}>
      {/* Photo */}
      <View style={styles.photoWrap}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.placeholder]}>
            <Feather name={item.allows_booking ? 'briefcase' : 'package'} size={28} color="#D1D5DB" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
        {item.description && (
          <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
        )}
        <Text style={styles.price}>{formatPrice(item.price)}</Text>
      </View>

      {/* Action */}
      <View style={styles.action}>
        {quantity > 0 ? (
          <View style={styles.counter}>
            <TouchableOpacity style={styles.counterBtn} onPress={onRemove}>
              <Feather name="minus" size={14} color="#FF6835" />
            </TouchableOpacity>
            <Text style={styles.qty}>{quantity}</Text>
            <TouchableOpacity style={styles.counterBtn} onPress={onAdd}>
              <Feather name="plus" size={14} color="#FF6835" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addBtn} onPress={onAdd} activeOpacity={0.8}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.addText}>{item.allows_booking ? 'Réserver' : 'Ajouter'}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  photoWrap: {
    width: 72,
    height: 72,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
  },
  photo: { width: '100%', height: '100%' },
  placeholder: { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 3 },
  name: { fontSize: 14, fontWeight: '700', color: '#111827' },
  desc: { fontSize: 12, color: '#6B7280', lineHeight: 17 },
  price: { fontSize: 14, fontWeight: '800', color: '#FF6835', marginTop: 2 },
  action: { flexShrink: 0 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF6835',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  addText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#FF6835',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  counterBtn: { padding: 2 },
  qty: { fontSize: 14, fontWeight: '700', color: '#FF6835', minWidth: 20, textAlign: 'center' },
});
