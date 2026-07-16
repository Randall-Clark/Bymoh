import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatPrice } from '@/lib/utils';
import type { CartItem as CartItemType } from '@/types';

interface CartItemProps {
  item: CartItemType;
  onAdd: () => void;
  onRemove: () => void;
  onDelete: () => void;
}

export function CartItem({ item, onAdd, onRemove, onDelete }: CartItemProps) {
  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.price}>{formatPrice(item.price)}</Text>
      </View>

      <View style={styles.right}>
        <View style={styles.counter}>
          <TouchableOpacity onPress={onRemove} style={styles.btn} activeOpacity={0.75}>
            <Feather name="minus" size={14} color="#FF6835" />
          </TouchableOpacity>
          <Text style={styles.qty}>{item.quantity}</Text>
          <TouchableOpacity onPress={onAdd} style={styles.btn} activeOpacity={0.75}>
            <Feather name="plus" size={14} color="#FF6835" />
          </TouchableOpacity>
        </View>
        <Text style={styles.subtotal}>{formatPrice(item.price * item.quantity)}</Text>
      </View>

      <TouchableOpacity onPress={onDelete} style={styles.delete} hitSlop={8}>
        <Feather name="trash-2" size={16} color="#EF4444" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  info: { flex: 1, gap: 4 },
  name: { fontSize: 14, fontWeight: '600', color: '#111827' },
  price: { fontSize: 13, color: '#6B7280' },
  right: { alignItems: 'flex-end', gap: 6 },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#FF6835',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  btn: { padding: 2 },
  qty: { fontSize: 14, fontWeight: '700', color: '#FF6835', minWidth: 18, textAlign: 'center' },
  subtotal: { fontSize: 14, fontWeight: '800', color: '#111827' },
  delete: { padding: 4 },
});
