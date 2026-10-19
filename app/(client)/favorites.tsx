import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator, FlatList, Image, Platform,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFavoritesStore } from '@/stores/favoritesStore';
import type { Business } from '@/types';

// ─── Item de la liste favoris ─────────────────────────────────────────────────
function FavoriteItem({ item }: { item: Business }) {
  const favStore = useFavoritesStore();
  const qc       = useQueryClient();

  const removeFavorite = async () => {
    // 1. Retrait immédiat dans Zustand → cœur home page + page boutique réagissent instantanément
    if (favStore.isFavorite(item.id)) favStore.toggleFavorite(item.id);

    // 2. Suppression Supabase
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from('favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('business_id', item.id);
    }

    // 3. Rafraîchir la liste favoris
    qc.invalidateQueries({ queryKey: ['favorites-supabase'] });
  };

  const goToDetail = () =>
    router.push({ pathname: '/(client)/business/[id]', params: { id: item.id } });

  return (
    <TouchableOpacity style={styles.item} onPress={goToDetail} activeOpacity={0.85}>
      {/* Thumbnail */}
      {item.cover_url ? (
        <Image source={{ uri: item.cover_url }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Text style={styles.thumbEmoji}>{(item as any).category_icon ?? '🏪'}</Text>
        </View>
      )}

      {/* Infos */}
      <View style={styles.info}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemSub} numberOfLines={2}>
          {(item as any).description
            ? (item as any).description
            : `${(item as any).category_icon ?? ''} ${item.category ?? ''}`.trim()}
        </Text>
      </View>

      {/* Cœur rouge → retire le favori */}
      <TouchableOpacity
        style={styles.heartBtn}
        onPress={removeFavorite}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        activeOpacity={0.7}
      >
        <Ionicons name="heart" size={22} color="#EF4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Page Favoris ─────────────────────────────────────────────────────────────
export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 0 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data: businesses = [], isLoading } = useQuery<Business[]>({
    queryKey: ['favorites-supabase'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Étape 1 : IDs favoris
      const { data: favRows, error: favErr } = await supabase
        .from('favorites')
        .select('business_id')
        .eq('user_id', user.id);

      if (favErr) throw favErr;

      const ids = (favRows ?? []).map((r: any) => r.business_id).filter(Boolean);
      if (ids.length === 0) return [];

      // Étape 2 : boutiques correspondantes
      const { data, error } = await supabase
        .from('businesses')
        .select('*, hours:business_hours(*)')
        .in('id', ids);

      if (error) throw error;
      return (data ?? []) as Business[];
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  return (
    <View style={styles.root}>
      {/* ── En-tête (padding safe area inclus) ── */}
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        {/* Bouton retour */}
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/(client)')}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={22} color="#111827" />
        </TouchableOpacity>

        {/* Titre centré */}
        <Text style={styles.title}>Favorites</Text>

        {/* Icône droite (placeholder visuel, peut ouvrir un menu) */}
        <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
          <Ionicons name="ellipsis-horizontal" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* ── Contenu ── */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#EF4444" size="large" />
        </View>
      ) : businesses.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="heart-outline" size={40} color="#EF4444" />
          </View>
          <Text style={styles.emptyTitle}>Aucun favori pour l'instant</Text>
          <Text style={styles.emptyText}>
            Appuyez sur le ♥ d'un commerce pour l'ajouter ici.
          </Text>
          <TouchableOpacity
            style={styles.exploreBtn}
            onPress={() => router.push('/(client)')}
          >
            <Text style={styles.exploreText}>Explorer les commerces</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(b) => b.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          renderItem={({ item }) => <FavoriteItem item={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F4F0' },

  // Header
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    backgroundColor: '#F5F4F0',
    paddingHorizontal: 8,
    paddingBottom:   14,
  },
  headerBtn: {
    width:           40,
    height:          40,
    alignItems:      'center',
    justifyContent:  'center',
    borderRadius:    20,
  },
  title: {
    fontSize:   20,
    fontWeight: '700',
    color:      '#111827',
    letterSpacing: 0.2,
  },

  // List
  list:      { paddingHorizontal: 16, paddingTop: 8 },
  separator: { height: 12 },

  // Item card
  item: {
    flexDirection:  'row',
    alignItems:     'center',
    backgroundColor: '#fff',
    borderRadius:   16,
    padding:        12,
    shadowColor:    '#000',
    shadowOffset:   { width: 0, height: 1 },
    shadowOpacity:  0.06,
    shadowRadius:   4,
    elevation:      2,
    gap:            12,
  },
  thumb: {
    width:        80,
    height:       80,
    borderRadius: 12,
    resizeMode:   'cover',
  },
  thumbPlaceholder: {
    backgroundColor: '#F3F4F6',
    alignItems:      'center',
    justifyContent:  'center',
  },
  thumbEmoji: { fontSize: 30 },
  info:       { flex: 1 },
  itemName:   { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 5 },
  itemSub:    { fontSize: 13, color: '#9CA3AF', lineHeight: 18 },
  heartBtn:   { paddingLeft: 4 },

  // Empty / loading
  center:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 14 },
  emptyIcon:  { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center' },
  emptyText:  { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 21 },
  exploreBtn: { backgroundColor: '#FF6835', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100, marginTop: 8 },
  exploreText:{ color: '#fff', fontWeight: '700', fontSize: 15 },
});
