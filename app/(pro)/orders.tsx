import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/Badge';
import { formatPrice, formatDateShort } from '@/lib/utils';
import type { OrderStatus } from '@/types';

interface OrderRow {
  id: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  items: Array<{ title: string; quantity: number }>;
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'delivering', delivering: 'delivered',
};
const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'En attente', confirmed: 'Confirmé', preparing: 'En préparation',
  ready: 'Prêt', delivering: 'En livraison', delivered: 'Livré', cancelled: 'Annulé',
};

export default function ProOrdersScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data: orders = [] } = useQuery<OrderRow[]>({
    queryKey: ['pro-orders', profile?.id],
    queryFn: async () => {
      const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', profile?.id ?? '');
      const bizIds = (biz ?? []).map((b: { id: string }) => b.id);
      if (bizIds.length === 0) return [];
      const { data, error } = await supabase.from('orders').select('*, items:order_items(title, quantity)').in('business_id', bizIds).order('created_at', { ascending: false });
      if (error) throw error;
      return data as OrderRow[];
    },
    enabled: !!profile?.id,
    staleTime: 30_000,
  });

  const advanceStatus = async (order: OrderRow) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    const { error } = await supabase.from('orders').update({ status: next }).eq('id', order.id);
    if (!error) queryClient.invalidateQueries({ queryKey: ['pro-orders'] });
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Commandes</Text>
        <Text style={styles.count}>{orders.length}</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 32 }]}
        renderItem={({ item: o }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.orderRef}>#{o.id.slice(0, 8).toUpperCase()}</Text>
                <Text style={styles.date}>{formatDateShort(o.created_at)}</Text>
              </View>
              <Badge label={STATUS_LABELS[o.status]} variant={o.status} size="md" />
            </View>
            <Text style={styles.items}>{(o.items ?? []).map((i) => `${i.quantity}× ${i.title}`).join(' · ')}</Text>
            <View style={styles.cardBottom}>
              <Text style={styles.total}>{formatPrice(o.total)}</Text>
              {NEXT_STATUS[o.status] && (
                <TouchableOpacity style={styles.advanceBtn} onPress={() => advanceStatus(o)}>
                  <Text style={styles.advanceBtnText}>→ {STATUS_LABELS[NEXT_STATUS[o.status]!]}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="shopping-bag" size={44} color="#D1D5DB" />
            <Text style={styles.emptyText}>Aucune commande pour l'instant</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 22, fontWeight: '800', color: '#111827' },
  count: { fontSize: 14, fontWeight: '700', color: '#6B7280', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  orderRef: { fontSize: 14, fontWeight: '700', color: '#111827', fontFamily: 'monospace' },
  date: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  items: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  total: { fontSize: 16, fontWeight: '800', color: '#111827' },
  advanceBtn: { backgroundColor: '#FEF2EC', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100 },
  advanceBtnText: { fontSize: 12, fontWeight: '700', color: '#FF6835' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 80 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
});
