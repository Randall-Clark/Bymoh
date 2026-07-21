import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Badge } from '@/components/ui/Badge';
import type { Booking, BookingStatus } from '@/types';

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'En attente', confirmed: 'Confirmé', completed: 'Terminé', cancelled: 'Annulé',
};

export default function ProBookingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['pro-bookings', profile?.id],
    queryFn: async () => {
      const { data: biz } = await supabase.from('businesses').select('id').eq('owner_id', profile?.id ?? '');
      const bizIds = (biz ?? []).map((b: { id: string }) => b.id);
      if (bizIds.length === 0) return [];
      const { data, error } = await supabase.from('bookings').select('*').in('business_id', bizIds).order('date', { ascending: true });
      if (error) throw error;
      return data as Booking[];
    },
    enabled: !!profile?.id,
    staleTime: 30_000,
  });

  const updateStatus = async (id: string, status: BookingStatus) => {
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id);
    if (!error) queryClient.invalidateQueries({ queryKey: ['pro-bookings'] });
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Réservations</Text>
      </View>

      <FlatList
        data={bookings}
        keyExtractor={(b) => b.id}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 32 }]}
        renderItem={({ item: b }) => (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.serviceName}>{b.booking_type ?? 'Réservation'}</Text>
                <Text style={styles.datetime}>{b.date} à {b.time}</Text>
              </View>
              <Badge label={STATUS_LABELS[b.status]} variant={b.status} size="md" />
            </View>
            {b.notes && <Text style={styles.notes}>{b.notes}</Text>}
            {b.status === 'pending' && (
              <View style={styles.actions}>
                <TouchableOpacity style={styles.confirmBtn} onPress={() => updateStatus(b.id, 'confirmed')}>
                  <Feather name="check" size={14} color="#fff" />
                  <Text style={styles.confirmText}>Confirmer</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => updateStatus(b.id, 'cancelled')}>
                  <Feather name="x" size={14} color="#EF4444" />
                  <Text style={styles.cancelText}>Refuser</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="calendar" size={44} color="#D1D5DB" />
            <Text style={styles.emptyText}>Aucune réservation</Text>
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
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  serviceName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  datetime: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  notes: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10 },
  confirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#22C55E', paddingVertical: 10, borderRadius: 100 },
  confirmText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#FEE2E2', paddingVertical: 10, borderRadius: 100 },
  cancelText: { fontSize: 13, fontWeight: '700', color: '#EF4444' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 80 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
});
