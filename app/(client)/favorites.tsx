import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { BusinessCard } from '@/components/business/BusinessCard';
import type { Business } from '@/types';

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const { favoriteIds } = useFavoritesStore();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data: businesses = [], isLoading } = useQuery<Business[]>({
    queryKey: ['favorites', favoriteIds],
    queryFn: async () => {
      if (favoriteIds.length === 0) return [];
      const { data, error } = await supabase
        .from('businesses')
        .select('*, hours:business_hours(*)')
        .in('id', favoriteIds);
      if (error) throw error;
      return data as Business[];
    },
    staleTime: 30_000,
  });

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Favoris</Text>
        {favoriteIds.length > 0 && (
          <Text style={styles.count}>{favoriteIds.length} enregistré{favoriteIds.length > 1 ? 's' : ''}</Text>
        )}
      </View>

      {favoriteIds.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="heart" size={40} color="#FF6835" />
          </View>
          <Text style={styles.emptyTitle}>Aucun favori pour l'instant</Text>
          <Text style={styles.emptyText}>
            Appuyez sur le ♥ d'un commerce pour l'ajouter ici.
          </Text>
          <TouchableOpacity style={styles.exploreBtn} onPress={() => router.push('/(client)')}>
            <Text style={styles.exploreText}>Explorer les commerces</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(b) => b.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
          renderItem={({ item }) => <BusinessCard business={item} style={styles.card} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  count: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  card: {},
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  emptyIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
  exploreBtn: { backgroundColor: '#FF6835', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100, marginTop: 8 },
  exploreText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
