import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Alert, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice } from '@/lib/utils';
import type { CatalogItem } from '@/types';

export default function CatalogIndexScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;
  const [bizId, setBizId] = React.useState<string | null>(null);

  React.useEffect(() => {
    supabase.from('businesses').select('id').eq('owner_id', profile?.id ?? '').limit(1).single()
      .then(({ data }) => { if (data) setBizId(data.id); });
  }, [profile?.id]);

  const { data: items = [] } = useQuery<CatalogItem[]>({
    queryKey: ['pro-catalog', bizId],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('*').eq('business_id', bizId ?? '').order('title');
      if (error) throw error;
      return data as CatalogItem[];
    },
    enabled: !!bizId,
    staleTime: 30_000,
  });

  const deleteItem = (id: string) => {
    Alert.alert('Supprimer', 'Voulez-vous supprimer cet article ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('services').delete().eq('id', id);
        queryClient.invalidateQueries({ queryKey: ['pro-catalog'] });
      }},
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Catalogue</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push({ pathname: '/(pro)/catalog/edit' as any, params: { bizId: bizId ?? '' } })}
        >
          <Feather name="plus" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 32 }]}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardInfo}>
              <View style={styles.typeTag}>
                <Feather name={item.allows_booking ? 'briefcase' : 'package'} size={12} color="#6B7280" />
                <Text style={styles.typeLabel}>{item.allows_booking ? 'Service' : 'Produit'}</Text>
              </View>
              <Text style={styles.itemName}>{item.title}</Text>
              {item.description && <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>}
              <Text style={styles.itemPrice}>{formatPrice(item.price)}</Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => router.push({ pathname: '/(pro)/catalog/edit' as any, params: { bizId: bizId ?? '', itemId: item.id } })}
              >
                <Feather name="edit-2" size={16} color="#FF6835" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteItem(item.id)}>
                <Feather name="trash-2" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="package" size={44} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>Catalogue vide</Text>
            <Text style={styles.emptyText}>Ajoutez vos produits et services</Text>
            <TouchableOpacity style={styles.addFirstBtn} onPress={() => router.push({ pathname: '/(pro)/catalog/edit' as any, params: { bizId: bizId ?? '' } })}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.addFirstText}>Ajouter un article</Text>
            </TouchableOpacity>
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
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardInfo: { flex: 1, gap: 4 },
  typeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  typeLabel: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  itemName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  itemDesc: { fontSize: 12, color: '#9CA3AF' },
  itemPrice: { fontSize: 15, fontWeight: '800', color: '#FF6835' },
  cardActions: { gap: 8 },
  editBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 14, color: '#9CA3AF' },
  addFirstBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FF6835', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 100, marginTop: 8 },
  addFirstText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
