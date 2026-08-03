import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  Dimensions, Image, StyleSheet, Text,
  TouchableOpacity, View, ViewStyle,
} from 'react-native';
import { isBusinessOpen } from '@/lib/utils';
import type { Business } from '@/types';

const { width: W } = Dimensions.get('window');

interface Props {
  business: Business & { tag?: string };
  style?: ViewStyle;
  horizontal?: boolean;
}

export function BusinessCard({ business, style, horizontal }: Props) {
  // ✅ Tag depuis la DB en priorité, fallback calculé si absent
  const tag  = business.tag ?? buildTagFallback(business.name, business.id);
  const open = isBusinessOpen(business.hours);

  const onPress = () =>
    router.push({ pathname: '/(client)/business/[id]', params: { id: business.id } });

  // ── Carte horizontale (scroll horizontal) ────────────────────────────────
  if (horizontal) {
    return (
      <TouchableOpacity style={[styles.hCard, style]} onPress={onPress} activeOpacity={0.88}>
        <View style={styles.hCoverWrap}>
          {business.cover_url ? (
            <Image source={{ uri: business.cover_url }} style={styles.hCover} />
          ) : (
            <View style={[styles.hCover, styles.coverPlaceholder]}>
              <Text style={styles.coverEmoji}>{business.category_icon ?? '🏪'}</Text>
            </View>
          )}
          {/* Badge ouvert/fermé */}
          <View style={[styles.openBadge, !open && styles.closedBadge]}>
            <View style={[styles.openDot, !open && styles.closedDot]} />
            <Text style={[styles.openText, !open && styles.closedText]}>
              {open ? 'Ouvert' : 'Fermé'}
            </Text>
          </View>
        </View>

        <View style={styles.hInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.hName} numberOfLines={1}>{business.name}</Text>
            {tag && <Text style={styles.tag}>{tag}</Text>}
          </View>
          <Text style={styles.hCategory} numberOfLines={1}>
            {business.category_icon} {business.category}
          </Text>
          {(business.rating ?? 0) > 0 && (
            <View style={styles.ratingRow}>
              <Feather name="star" size={11} color="#F59E0B" />
              <Text style={styles.ratingText}>
                {(business.rating ?? 0).toFixed(1)} ({business.review_count ?? 0})
              </Text>
            </View>
          )}
          {business.has_delivery && (
            <View style={styles.deliveryBadge}>
              <Feather name="truck" size={10} color="#22C55E" />
              <Text style={styles.deliveryText}>Livraison</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  }

  // ── Carte verticale (défaut) ──────────────────────────────────────────────
  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.88}>
      {/* Cover */}
      <View style={styles.coverWrap}>
        {business.cover_url ? (
          <Image source={{ uri: business.cover_url }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.coverEmoji}>{business.category_icon ?? '🏪'}</Text>
          </View>
        )}

        {/* Badge ouvert/fermé */}
        <View style={[styles.openBadge, !open && styles.closedBadge]}>
          <View style={[styles.openDot, !open && styles.closedDot]} />
          <Text style={[styles.openText, !open && styles.closedText]}>
            {open ? 'Ouvert' : 'Fermé'}
          </Text>
        </View>

        {/* Badge livraison */}
        {business.has_delivery && (
          <View style={styles.deliveryOverlay}>
            <Feather name="truck" size={10} color="#fff" />
            <Text style={styles.deliveryOverlayText}>Livraison</Text>
          </View>
        )}
      </View>

      {/* Corps */}
      <View style={styles.body}>
        <View style={styles.bodyTop}>
          <View style={{ flex: 1 }}>
            {/* Nom + tag sur la même ligne */}
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{business.name}</Text>
              {tag && <Text style={styles.tag}>{tag}</Text>}
            </View>
            <Text style={styles.category} numberOfLines={1}>
              {business.category_icon} {business.category}
            </Text>
          </View>

          {/* Note */}
          {(business.rating ?? 0) > 0 && (
            <View style={styles.ratingPill}>
              <Feather name="star" size={11} color="#F59E0B" />
              <Text style={styles.ratingPillText}>{(business.rating ?? 0).toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Méta : ville + avis */}
        <View style={styles.meta}>
          {business.city ? (
            <View style={styles.metaItem}>
              <Feather name="map-pin" size={11} color="#9CA3AF" />
              <Text style={styles.metaText}>{business.city}</Text>
            </View>
          ) : null}
          {(business.review_count ?? 0) > 0 && (
            <View style={styles.metaItem}>
              <Feather name="message-circle" size={11} color="#9CA3AF" />
              <Text style={styles.metaText}>{business.review_count} avis</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// Fallback si tag pas encore en DB (anciennes boutiques)
function buildTagFallback(name: string, id: string): string {
  const words   = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.length >= 2
    ? (words[0][0] + words[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
  const digits  = id.replace(/\D/g, '').slice(-3).padStart(3, '0');
  return `#${letters}${digits}`;
}

const styles = StyleSheet.create({
  // ── Carte verticale ───────────────────────────────────────────────────────
  card: {
    backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
  },
  coverWrap: { position: 'relative' },
  cover: { width: '100%', height: 160, resizeMode: 'cover' },
  coverPlaceholder: {
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  coverEmoji: { fontSize: 42 },

  body: { padding: 14, gap: 8 },
  bodyTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },

  // Nom + tag
  nameRow: {
    flexDirection: 'row', alignItems: 'baseline',
    gap: 6, flexWrap: 'wrap',
  },
  name: { fontSize: 16, fontWeight: '700', color: '#111827', flexShrink: 1 },
  tag: {
    fontSize: 12,
    fontWeight: '300',   // light — contraste avec le nom bold
    color: '#9CA3AF',
    letterSpacing: 0.3,
  },

  category: { fontSize: 13, color: '#6B7280', marginTop: 2 },

  ratingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 100, borderWidth: 1, borderColor: '#FDE68A',
  },
  ratingPillText: { fontSize: 12, fontWeight: '700', color: '#D97706' },

  meta: { flexDirection: 'row', gap: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: '#9CA3AF' },

  // Badges sur la cover
  openBadge: {
    position: 'absolute', top: 10, left: 10,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  closedBadge: { backgroundColor: 'rgba(0,0,0,0.5)' },
  openDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' },
  closedDot: { backgroundColor: '#9CA3AF' },
  openText: { fontSize: 11, fontWeight: '700', color: '#15803D' },
  closedText: { color: '#fff' },

  deliveryOverlay: {
    position: 'absolute', bottom: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(34,197,94,0.85)', borderRadius: 100,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  deliveryOverlayText: { fontSize: 11, fontWeight: '600', color: '#fff' },

  // ── Carte horizontale ─────────────────────────────────────────────────────
  hCard: {
    width: 200, backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07, shadowRadius: 6, elevation: 3,
  },
  hCoverWrap: { position: 'relative' },
  hCover: { width: '100%', height: 110, resizeMode: 'cover' },
  hInfo: { padding: 10, gap: 4 },
  hName: { fontSize: 14, fontWeight: '700', color: '#111827', flexShrink: 1 },
  hCategory: { fontSize: 12, color: '#6B7280' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 11, color: '#6B7280' },
  deliveryBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', backgroundColor: '#F0FDF4',
    borderRadius: 100, paddingHorizontal: 6, paddingVertical: 2,
  },
  deliveryText: { fontSize: 11, fontWeight: '600', color: '#22C55E' },
});
