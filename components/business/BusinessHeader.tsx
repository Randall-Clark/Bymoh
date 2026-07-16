import React from 'react';
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFavoritesStore } from '@/stores/favoritesStore';
import { isBusinessOpen } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { Business } from '@/types';

const { width: W } = Dimensions.get('window');
const COVER_HEIGHT = W * 0.55;

interface BusinessHeaderProps {
  business: Business;
}

export function BusinessHeader({ business }: BusinessHeaderProps) {
  const insets = useSafeAreaInsets();
  const isFav = useFavoritesStore((s) => s.isFavorite(business.id));
  const toggleFav = useFavoritesStore((s) => s.toggleFavorite);
  const open = isBusinessOpen(business.hours);

  return (
    <View>
      {/* Full-width cover */}
      <View style={{ width: W, height: COVER_HEIGHT }}>
        {business.cover_url ? (
          <Image source={{ uri: business.cover_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <LinearGradient colors={['#FF6835', '#E84B1A']} style={StyleSheet.absoluteFill} />
        )}
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.15)']}
          style={StyleSheet.absoluteFill}
        />

        {/* Back button */}
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8 }]}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>

        {/* Heart button */}
        <TouchableOpacity
          style={[styles.heartBtn, { top: insets.top + 8 }]}
          onPress={() => toggleFav(business.id)}
          activeOpacity={0.85}
        >
          <Feather name="heart" size={20} color={isFav ? '#FF6835' : '#fff'} />
        </TouchableOpacity>
      </View>

      {/* Business info card */}
      <View style={styles.infoCard}>
        <View style={styles.nameRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{business.name}</Text>
            <Text style={styles.category}>{business.category}</Text>
          </View>
        </View>

        <View style={styles.badgeRow}>
          <Badge label={open ? 'Ouvert maintenant' : 'Fermé'} variant={open ? 'open' : 'closed'} size="md" />
          {business.has_delivery && (
            <Badge label="Livraison" variant="primary" size="md" />
          )}
        </View>

        {business.address && (
          <View style={styles.addressRow}>
            <Feather name="map-pin" size={13} color="#6B7280" />
            <Text style={styles.address}>{business.address}, {business.city}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtn: {
    position: 'absolute',
    right: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    backgroundColor: '#fff',
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  logoWrap: {
    position: 'absolute',
    top: -28,
    left: 20,
    width: 56,
    height: 56,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#F8F7F4',
  },
  logo: { width: '100%', height: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 },
  name: { fontSize: 22, fontWeight: '800', color: '#111827' },
  category: { fontSize: 14, color: '#6B7280', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  address: { fontSize: 13, color: '#6B7280', flex: 1 },
});
