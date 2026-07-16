import React from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { isBusinessOpen } from '@/lib/utils';
import type { Business } from '@/types';

const { width: W } = Dimensions.get('window');

interface BusinessCardProps {
  business: Business;
  style?: ViewStyle;
  horizontal?: boolean;
}

export function BusinessCard({ business, style, horizontal = false }: BusinessCardProps) {
  const isFav = useFavoritesStore((s) => s.isFavorite(business.id));
  const toggleFav = useFavoritesStore((s) => s.toggleFavorite);
  const open = isBusinessOpen(business.hours);

  const cardWidth = horizontal ? W * 0.62 : undefined;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        horizontal && { width: cardWidth },
        pressed && { opacity: 0.93 },
        style,
      ]}
      onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: business.id } })}
    >
      {/* Cover photo */}
      <View style={styles.coverWrap}>
        {business.cover_url ? (
          <Image source={{ uri: business.cover_url }} style={styles.cover} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#FF6835', '#E84B1A']} style={styles.cover} />
        )}

        {/* Open/closed badge */}
        <View style={[styles.openBadge, { backgroundColor: open ? '#22C55E' : '#6B7280' }]}>
          <View style={[styles.openDot, { backgroundColor: open ? '#fff' : '#E5E7EB' }]} />
          <Text style={styles.openText}>{open ? 'Ouvert' : 'Fermé'}</Text>
        </View>

        {/* Heart */}
        <TouchableOpacity
          style={styles.heartBtn}
          onPress={() => toggleFav(business.id)}
          activeOpacity={0.8}
          hitSlop={8}
        >
          <Feather name="heart" size={15} color={isFav ? '#FF6835' : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{business.name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {business.category} · {business.city}
        </Text>
        {business.has_delivery && (
          <View style={styles.deliveryRow}>
            <Feather name="truck" size={11} color="#FF6835" />
            <Text style={styles.deliveryText}>Livraison disponible</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  coverWrap: {
    width: '100%',
    aspectRatio: 16 / 9,
    position: 'relative',
    overflow: 'hidden',
  },
  cover: { width: '100%', height: '100%' },
  logoWrap: {
    position: 'absolute',
    bottom: 8,
    left: 10,
    width: 40,
    height: 40,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#fff',
  },
  logo: { width: '100%', height: '100%' },
  openBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  openDot: { width: 5, height: 5, borderRadius: 3 },
  openText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { padding: 12, gap: 4 },
  name: { fontSize: 14, fontWeight: '700', color: '#111827' },
  meta: { fontSize: 12, color: '#6B7280' },
  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  deliveryText: { fontSize: 11, color: '#FF6835', fontWeight: '600' },
});
