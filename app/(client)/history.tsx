import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/Badge';
import { formatDateShort, formatPrice } from '@/lib/utils';
import type { OrderStatus, BookingStatus } from '@/types';

type Tab = 'orders' | 'bookings';

interface OrderRow {
  id: string;
  status: OrderStatus;
  delivery_method: string;
  total: number;
  created_at: string;
  business: { name: string } | null;
  items: Array<{ title: string; quantity: number }>;
}

interface BookingRow {
  id: string;
  status: BookingStatus;
  date: string;
  time: string;
  notes?: string;
  business: { name: string } | null;
  service: { title: string } | null;
}

const ORDER_STATUS_MAP: Record<OrderStatus, string> = {
  pending: 'En attente', confirmed: 'Confirmée', preparing: 'En préparation',
  ready: 'Prêt', delivering: 'En livraison', delivered: 'Livré', cancelled: 'Annulé',
};
const BOOKING_STATUS_MAP: Record<BookingStatus, string> = {
  pending: 'En attente', confirmed: 'Confirmé', completed: 'Terminé', cancelled: 'Annulé',
};

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [tab, setTab] = useState<Tab>('orders');
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data: orders = [] } = useQuery<OrderRow[]>({
    queryKey: ['orders', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, business:businesses(name), items:order_items(title, quantity)')
        .eq('user_id', profile?.id ?? '')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as OrderRow[];
    },
    enabled: !!profile?.id,
    staleTime: 30_000,
  });

  const { data: bookings = [] } = useQuery<BookingRow[]>({
    queryKey: ['bookings', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, business:businesses(name), service:services(title)')
        .eq('user_id', profile?.id ?? '')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as BookingRow[];
    },
    enabled: !!profile?.id,
    staleTime: 30_000,
  });

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Mes commandes</Text>
        <View style={styles.tabs}>
          {(['orders', 'bookings'] as Tab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabLabel, tab === t && styles.tabLabelActive]}>
                {t === 'orders' ? `Commandes (${orders.length})` : `Réservations (${bookings.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === 'orders' ? (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
          renderItem={({ item: o }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bizName}>{o.business?.name ?? '—'}</Text>
                  <Text style={styles.date}>{formatDateShort(o.created_at)}</Text>
                </View>
                <Badge label={ORDER_STATUS_MAP[o.status] ?? o.status} variant={o.status} />
              </View>
              <Text style={styles.items}>
                {(o.items ?? []).map((i) => `${i.quantity}× ${i.title}`).join(', ')}
              </Text>
              <View style={styles.cardBottom}>
                <Text style={styles.total}>{formatPrice(o.total)}</Text>
                <View style={styles.deliveryTag}>
                  <Feather name="truck" size={12} color="#6B7280" />
                  <Text style={styles.deliveryLabel}>{o.delivery_method}</Text>
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="shopping-bag" text="Aucune commande pour l'instant" />}
        />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
          renderItem={({ item: b }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bizName}>{b.business?.name ?? '—'}</Text>
                  <Text style={styles.date}>{b.date} à {b.time}</Text>
                </View>
                <Badge label={BOOKING_STATUS_MAP[b.status] ?? b.status} variant={b.status} />
              </View>
              <Text style={styles.items}>{b.service?.title ?? 'Réservation'}</Text>
              {b.notes && <Text style={styles.notes}>{b.notes}</Text>}
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="calendar" text="Aucune réservation pour l'instant" />}
        />
      )}
    </View>
  );
}

function EmptyState({ icon, text }: { icon: React.ComponentProps<typeof Feather>['name']; text: string }) {
  return (
    <View style={empty.wrap}>
      <Feather name={icon} size={44} color="#D1D5DB" />
      <Text style={empty.text}>{text}</Text>
    </View>
  );
}

const empty = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingVertical: 80 },
  text: { fontSize: 16, color: '#9CA3AF', textAlign: 'center' },
});

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827', paddingBottom: 16 },
  tabs: { flexDirection: 'row', gap: 0 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#FF6835' },
  tabLabel: { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  tabLabelActive: { color: '#FF6835' },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bizName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  date: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  items: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  notes: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  total: { fontSize: 16, fontWeight: '800', color: '#111827' },
  deliveryTag: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deliveryLabel: { fontSize: 12, color: '#6B7280', textTransform: 'capitalize' },
});
