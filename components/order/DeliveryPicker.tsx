import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { formatPrice } from '@/lib/utils';
import type { DeliveryMethod, DeliveryEstimate } from '@/types';

interface DeliveryPickerProps {
  selected: string;
  onSelect: (type: DeliveryMethod) => void;
  gozem?: DeliveryEstimate;
  yango?: DeliveryEstimate;
  loading?: boolean;
}

export function DeliveryPicker({ selected, onSelect, gozem, yango, loading }: DeliveryPickerProps) {
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#FF6835" />
        <Text style={styles.loadingText}>Calcul des tarifs…</Text>
      </View>
    );
  }

  const options: Array<{
    type: string;
    label: string;
    subtitle: string;
    icon: string;
    price?: string;
    duration?: string;
  }> = [
    ...(gozem
      ? [{
          type: 'gozem' as const,
          label: 'Gozem',
          subtitle: `~${gozem.duration_minutes} min`,
          icon: 'navigation' as const,
          price: formatPrice(gozem.price),
        }]
      : []),
    ...(yango
      ? [{
          type: 'yango' as const,
          label: 'Yango',
          subtitle: `~${yango.duration_minutes} min`,
          icon: 'navigation' as const,
          price: formatPrice(yango.price),
        }]
      : []),
    {
      type: 'delivery',
      label: 'Livraison standard',
      subtitle: 'Délai variable',
      icon: 'truck',
      price: formatPrice(500),
    },
    {
      type: 'pickup',
      label: 'Retrait sur place',
      subtitle: 'Gratuit',
      icon: 'shopping-bag',
      price: 'Gratuit',
    },
  ];

  return (
    <View style={styles.container}>
      {options.map((opt) => {
        const active = selected === opt.type;
        return (
          <TouchableOpacity
            key={opt.type}
            style={[styles.option, active && styles.optionActive]}
            onPress={() => onSelect(opt.type as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
              <Feather name={opt.icon as React.ComponentProps<typeof Feather>['name']} size={20} color={active ? '#fff' : '#6B7280'} />
            </View>
            <View style={styles.info}>
              <Text style={[styles.label, active && styles.labelActive]}>{opt.label}</Text>
              <Text style={styles.sub}>{opt.subtitle}</Text>
            </View>
            {opt.price && (
              <Text style={[styles.price, active && styles.priceActive]}>{opt.price}</Text>
            )}
            {active && (
              <View style={styles.check}>
                <Feather name="check" size={12} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10 },
  loading: { alignItems: 'center', gap: 8, paddingVertical: 24 },
  loadingText: { color: '#6B7280', fontSize: 14 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  optionActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: { backgroundColor: '#FF6835' },
  info: { flex: 1 },
  label: { fontSize: 14, fontWeight: '700', color: '#111827' },
  labelActive: { color: '#FF6835' },
  sub: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  price: { fontSize: 14, fontWeight: '800', color: '#111827' },
  priceActive: { color: '#FF6835' },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6835',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
