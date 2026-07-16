import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useEffect, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useBusinesses } from '@/hooks/useBusinesses';
import { useLocation } from '@/hooks/useLocation';
import { isBusinessOpen } from '@/lib/utils';
import { BusinessCard } from '@/components/business/BusinessCard';
import { CATEGORIES, ALL_CITIES } from '@/types';

const { width: W } = Dimensions.get('window');
const BG = '#E84B1A';
const TILE = 72;
const COLS = Math.ceil(W / TILE) + 4;
const ROWS = 5;
const SYMBOLS = ['+', '◇', '○', '∧', '~', '⊕', 'Ш', 'M', '☀', '△', '×', '⌀'];

function seededPick(row: number, col: number) {
  return SYMBOLS[Math.abs((row * 7 + col * 13) ^ (row + col * 3)) % SYMBOLS.length];
}

const DOODLE_CELLS = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) => ({ key: `${r}-${c}`, symbol: seededPick(r, c), r, c }))
).flat();

const USE_NATIVE = Platform.OS !== 'web';

const PROMO_BANNERS = [
  { id: 'p1', title: '1ère livraison offerte', sub: 'Sur votre 1ère commande Bymoh', cta: 'Commander', bg: '#FF6835', icon: 'gift', deco: '#E84B1A' },
  { id: 'p2', title: 'Promos Week-end', sub: '-20% chez nos restaurants partenaires', cta: 'Découvrir', bg: '#1E3A5F', icon: 'percent', deco: '#162D4A' },
  { id: 'p3', title: 'Artisans locaux', sub: 'Meublez votre intérieur avec des pros', cta: 'Explorer', bg: '#059669', icon: 'tool', deco: '#047857' },
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const { address } = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [bannerIdx, setBannerIdx] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);

  const cityName = address ?? 'Lomé';
  const cityEntry = ALL_CITIES.find((c) => c.name.toLowerCase() === cityName.toLowerCase()) ?? ALL_CITIES[6];

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  // Animated doodle
  const shift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(shift, { toValue: TILE, duration: 4000, easing: Easing.linear, useNativeDriver: USE_NATIVE })
    ).start();
  }, []);

  // Banner auto-scroll
  const bannerRef = useRef<ScrollView>(null);
  const BANNER_W = W - 40;
  useEffect(() => {
    const t = setInterval(() => {
      setBannerIdx((prev) => {
        const next = (prev + 1) % PROMO_BANNERS.length;
        bannerRef.current?.scrollTo({ x: next * (BANNER_W + 14), animated: true });
        return next;
      });
    }, 3800);
    return () => clearInterval(t);
  }, [BANNER_W]);

  const bizFilters = { city: cityName, ...(selectedCategory ? { category: selectedCategory } : {}) };
  const { data: businesses = [], isLoading: bizLoading } = useBusinesses(bizFilters);

  const openBizs = businesses.filter((b) => isBusinessOpen(b.hours));

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.blobTopRight} />
        <Animated.View
          style={[styles.doodleContainer, { transform: [{ translateX: shift }, { translateY: shift }] }]}
          pointerEvents="none"
        >
          {DOODLE_CELLS.map(({ key, symbol, r, c }) => (
            <Text key={key} style={[styles.doodle, { left: c * TILE - TILE, top: r * TILE - TILE }]}>{symbol}</Text>
          ))}
        </Animated.View>

        <View style={styles.greet}>
          <TouchableOpacity style={styles.menuBtn} onPress={() => setMenuVisible(true)}>
            <Feather name="menu" size={22} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.addressPill} activeOpacity={0.8}>
            <Feather name="map-pin" size={13} color="rgba(255,255,255,0.75)" />
            <View style={{ flex: 1 }}>
              <Text style={styles.addressLabel}>Livraison à</Text>
              <Text style={styles.addressValue} numberOfLines={1}>{cityEntry.flag} {cityName}</Text>
            </View>
            <Feather name="chevron-down" size={13} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.notifBtn} onPress={() => {}}>
            <Feather name="bell" size={20} color="#fff" />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.searchBox} onPress={() => router.push('/(client)/search')} activeOpacity={0.85}>
          <Feather name="search" size={18} color="rgba(255,255,255,0.75)" />
          <Text style={styles.searchPlaceholder}>Rechercher un service, commerce...</Text>
          <View style={styles.filterBtn}>
            <Feather name="sliders" size={14} color={BG} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Scrollable content */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: botPad + 72 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Categories */}
        <View>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Catégories</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            <TouchableOpacity
              style={[styles.catPill, !selectedCategory && styles.catPillActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Feather name="grid" size={14} color={!selectedCategory ? '#fff' : '#6B7280'} />
              <Text style={[styles.catLabel, !selectedCategory && styles.catLabelActive]}>Tout</Text>
            </TouchableOpacity>
            {CATEGORIES.map((c) => {
              const active = selectedCategory === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.catPill, active && styles.catPillActive]}
                  onPress={() => setSelectedCategory(active ? null : c.id)}
                >
                  <Feather name={c.icon as any} size={14} color={active ? '#fff' : '#6B7280'} />
                  <Text style={[styles.catLabel, active && styles.catLabelActive]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Promo banners */}
        <View>
          <ScrollView
            ref={bannerRef}
            horizontal pagingEnabled={false} showsHorizontalScrollIndicator={false}
            decelerationRate="fast" snapToInterval={BANNER_W + 14} snapToAlignment="start"
            contentContainerStyle={styles.bannerRow}
            onMomentumScrollEnd={(e) => setBannerIdx(Math.round(e.nativeEvent.contentOffset.x / (BANNER_W + 14)))}
          >
            {PROMO_BANNERS.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.bannerCard, { width: BANNER_W, backgroundColor: p.bg }]} activeOpacity={0.9}>
                <View style={[styles.bannerDeco1, { backgroundColor: p.deco }]} />
                <View style={[styles.bannerDeco2, { backgroundColor: p.deco }]} />
                <View style={[styles.bannerIcon, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Feather name={p.icon as any} size={26} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bannerTitle}>{p.title}</Text>
                  <Text style={styles.bannerSub}>{p.sub}</Text>
                </View>
                <View style={styles.bannerCta}><Text style={[styles.bannerCtaText, { color: p.bg }]}>{p.cta}</Text></View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.bannerDots}>
            {PROMO_BANNERS.map((_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: i === bannerIdx ? '#FF6835' : '#E5E7EB' }]} />
            ))}
          </View>
        </View>

        {/* Open now */}
        {openBizs.length > 0 && (
          <View>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Ouverts maintenant</Text>
              <View style={styles.openDot} />
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hRow}>
              {openBizs.map((b) => <BusinessCard key={b.id} business={b} horizontal style={styles.hCard} />)}
            </ScrollView>
          </View>
        )}

        {/* All businesses */}
        {businesses.length > 0 && (
          <View>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Tous les commerces</Text>
              <TouchableOpacity onPress={() => router.push('/(client)/search')}>
                <Text style={styles.seeAll}>Voir tout</Text>
              </TouchableOpacity>
            </View>
            {businesses.map((b) => <BusinessCard key={b.id} business={b} style={styles.vCard} />)}
          </View>
        )}

        {!bizLoading && businesses.length === 0 && (
          <View style={styles.empty}>
            <Feather name="search" size={44} color="#D1D5DB" />
            <Text style={styles.emptyText}>Aucun commerce dans cette ville</Text>
          </View>
        )}
      </ScrollView>

      {/* Side menu modal */}
      <Modal visible={menuVisible} transparent animationType="slide" onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => setMenuVisible(false)} />
        <View style={[styles.sheet, { paddingBottom: botPad + 16 }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.menuHeader}>
            <View style={styles.menuAvatar}>
              <Feather name="user" size={22} color="#FF6835" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuName}>
                {profile?.name ?? 'Profil'}
              </Text>
              <Text style={styles.menuRole}>{profile?.role === 'pro' ? '🏪 Professionnel' : '🛍️ Client'}</Text>
            </View>
            <TouchableOpacity onPress={() => setMenuVisible(false)}>
              <Feather name="x" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
          {[
            { icon: 'briefcase', label: 'Espace professionnel', route: '/(pro)/dashboard' as const },
            { icon: 'settings', label: 'Paramètres', route: '/(client)/profile' as const },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.menuItem}
              onPress={() => { setMenuVisible(false); router.push(item.route as any); }}
            >
              <View style={styles.menuItemIcon}>
                <Feather name={item.icon as any} size={18} color="#FF6835" />
              </View>
              <Text style={styles.menuItemLabel}>{item.label}</Text>
              <Feather name="chevron-right" size={16} color="#D1D5DB" />
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  header: {
    paddingHorizontal: 20, paddingBottom: 20, gap: 14, overflow: 'hidden', zIndex: 10,
    backgroundColor: BG,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12, elevation: 8,
  },
  blobTopRight: {
    position: 'absolute', width: W * 0.65, height: W * 0.65, borderRadius: W * 0.325,
    backgroundColor: '#C93E12', top: -W * 0.22, right: -W * 0.18, opacity: 0.5,
  },
  doodleContainer: { position: 'absolute', width: W + TILE * 3, height: ROWS * TILE + TILE * 2, top: -TILE, left: -TILE },
  doodle: { position: 'absolute', fontSize: 16, color: 'rgba(255,255,255,0.13)', fontWeight: '300', lineHeight: TILE, width: TILE, textAlign: 'center' },
  greet: { flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 2 },
  menuBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  addressPill: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  addressLabel: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  addressValue: { fontSize: 14, color: '#fff', fontWeight: '700' },
  notifBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  notifDot: { position: 'absolute', top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff', borderWidth: 1.5, borderColor: BG },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', zIndex: 2 },
  searchPlaceholder: { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  filterBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, gap: 24 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  seeAll: { fontSize: 13, fontWeight: '600', color: '#FF6835' },
  openDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  catRow: { gap: 8, paddingVertical: 4 },
  catPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  catPillActive: { backgroundColor: '#FF6835', borderColor: '#FF6835' },
  catLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  catLabelActive: { color: '#fff' },
  bannerRow: { gap: 14, paddingVertical: 4 },
  bannerCard: { borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, overflow: 'hidden', minHeight: 100 },
  bannerDeco1: { position: 'absolute', width: 160, height: 160, borderRadius: 80, top: -60, right: -40, opacity: 0.5 },
  bannerDeco2: { position: 'absolute', width: 100, height: 100, borderRadius: 50, bottom: -40, left: -20, opacity: 0.35 },
  bannerIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  bannerTitle: { fontSize: 16, fontWeight: '800', color: '#fff', marginBottom: 4 },
  bannerSub: { fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 17 },
  bannerCta: { backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  bannerCtaText: { fontSize: 12, fontWeight: '800' },
  bannerDots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  hRow: { gap: 14, paddingVertical: 4 },
  hCard: {},
  vCard: { marginBottom: 12 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#9CA3AF' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 8 },
  menuHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 8 },
  menuAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  menuName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  menuRole: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#F3F4F6' },
  menuItemIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  menuItemLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
});
