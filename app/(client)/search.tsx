import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SECTEURS, CATEGORIES } from '@/types';
import {
  useSearch, SearchFilterType, SearchFilters,
  SearchResult, DEFAULT_SEARCH_FILTERS,
} from '@/hooks/useSearch';
import { useBusinesses } from '@/hooks/useBusinesses';
import { useLocationStore } from '@/stores/locationStore';
import { useAuthStore } from '@/stores/authStore';
import type { Business } from '@/types';

const SCREEN_W   = Dimensions.get('window').width;
const RECENT_KEY = '@bymoh_recent_searches';
const MAX_RECENT = 8;

// ── Couleurs par catégorie ─────────────────────────────────────────────────────
const CAT_COLORS: Record<string, string> = {
  restaurant: '#FF6835',
  artisan:    '#F59E0B',
  beaute:     '#EC4899',
  sante:      '#059669',
  education:  '#3B82F6',
  automobile: '#6B7280',
  tech:       '#8B5CF6',
  nettoyage:  '#06B6D4',
  mode:       '#9333EA',
  epicerie:   '#22C55E',
  maison:     '#10B981',
  ouvrier:    '#EF4444',
  animalier:  '#F97316',
  divers:     '#64748B',
};

// Utilise les vraies catégories de la DB
const SEARCH_CATS = CATEGORIES.map(c => ({
  id:    c.id,
  label: c.label,
  icon:  c.icon,
  color: CAT_COLORS[c.id] ?? '#9CA3AF',
}));

const TYPE_FILTERS: { id: SearchFilterType; label: string; emoji: string }[] = [
  { id: 'all',        label: 'Tout',        emoji: '🔍' },
  { id: 'boutique',   label: 'Boutiques',   emoji: '🏪' },
  { id: 'prestation', label: 'Prestations', emoji: '🔧' },
  { id: 'article',    label: 'Articles',    emoji: '📦' },
  { id: 'lieu',       label: 'Lieux',       emoji: '📍' },
];


// ── Helper : parse image_url qui peut être un JSON array string ───────────────
function safeFirstUrl(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s.startsWith('[')) {
      try {
        const arr = JSON.parse(s);
        return Array.isArray(arr) && arr.length > 0 ? String(arr[0]) : null;
      } catch { return s || null; }
    }
    return s || null;
  }
  if (Array.isArray(raw) && raw.length > 0) return String(raw[0]);
  return null;
}

// ── Groupe service / article par boutique ─────────────────────────────────────
type ServiceGroup = {
  businessId: string;
  businessName: string;
  businessCity: string;
  businessEmoji: string;
  coverUrl: string | null;
  rating: number | null;
  reviewCount: number;
  distanceKm: number | null;
  hasPromo: boolean;
  isBiz: boolean;
  items: SearchResult[];
};

function groupServiceResults(results: SearchResult[]): ServiceGroup[] {
  const map = new Map<string, ServiceGroup>();
  for (const item of results) {
    const isBiz = item.type === 'boutique' || item.type === 'lieu';

    if (isBiz) {
      // La boutique elle-même est le résultat — pas de join "businesses"
      const raw  = item.raw ?? {};
      const bId  = item.id;
      if (!map.has(bId)) {
        map.set(bId, {
          businessId:    bId,
          businessName:  item.title,
          businessCity:  raw.city   ?? item.meta ?? '',
          businessEmoji: raw.category_icon ?? item.emoji ?? '🏪',
          coverUrl:      raw.cover_url ?? raw.cover_image ?? null,
          rating:        typeof item.rating === 'number' ? item.rating : null,
          reviewCount:   raw.review_count ?? 0,
          distanceKm:    item.distanceKm ?? null,
          hasPromo:      raw.has_delivery ?? false,
          isBiz:         true,
          items:         [],
        });
      }
    } else {
      // Article / prestation — join sous le nom de la table : "businesses"
      // businesses peut être un objet ou un tableau selon Supabase
      const rawBiz = item.raw?.businesses;
      const biz    = Array.isArray(rawBiz) ? (rawBiz[0] ?? {}) : (rawBiz ?? {});
      const bId    = (item.raw?.business_id ?? biz.id ?? item.id) as string;
      if (!bId) continue; // sécurité : ignorer si pas d'id
      if (!map.has(bId)) {
        map.set(bId, {
          businessId:    bId,
          businessName:  biz.name      ?? item.subtitle ?? 'Boutique',
          businessCity:  biz.city      ?? '',
          businessEmoji: biz.category_icon ?? item.emoji ?? '🏪',
          coverUrl:      biz.cover_url ?? null,
          rating:        typeof biz.rating === 'number' ? biz.rating
                         : (typeof item.rating === 'number' ? item.rating : null),
          reviewCount:   biz.review_count ?? 0,
          distanceKm:    item.distanceKm ?? null,
          hasPromo:      biz.has_delivery ?? false,
          isBiz:         false,
          items:         [],
        });
      }
      // Éviter les doublons (même service peut apparaître en prestation ET article)
      const existing = map.get(bId)!.items;
      if (!existing.some(i => i.id === item.id)) {
        existing.push(item);
      }
    }
  }
  return Array.from(map.values());
}

const SVC_ITEM_W = 120;

function ServiceGroupCard({ group }: { group: ServiceGroup }) {
  // Distance en minutes (vitesse moyenne ville ~30 km/h ≈ 2 min/km)
  const distMin = typeof group.distanceKm === 'number'
    ? Math.max(1, Math.round(group.distanceKm * 2))
    : null;

  return (
    <View style={svc.card}>
      {/* Business header */}
      <TouchableOpacity
        style={svc.header}
        onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: group.businessId } })}
        activeOpacity={0.85}
      >
        {/* Avatar — photo de la boutique ou fallback emoji */}
        <View style={svc.avatar}>
          {group.coverUrl ? (
            <Image source={{ uri: group.coverUrl }} style={svc.avatarImg} resizeMode="cover" />
          ) : (
            <Text style={svc.avatarEmoji}>{group.businessEmoji}</Text>
          )}
        </View>

        {/* Business info */}
        <View style={{ flex: 1 }}>
          <View style={svc.nameRow}>
            <Text style={svc.bizName} numberOfLines={1}>{group.businessName}</Text>
            {group.hasPromo && (
              <View style={svc.promoBadge}>
                <Text style={svc.promoText}>Promo</Text>
              </View>
            )}
          </View>
          <View style={svc.metaRow}>
            {group.businessCity ? (
              <Text style={svc.cityText}>{group.businessCity}</Text>
            ) : null}
            <Text style={svc.dot}>·</Text>
            <Feather name="star" size={11} color="#F59E0B" />
            <Text style={svc.ratingText}>
              {typeof group.rating === 'number' && group.rating > 0
                ? group.rating.toFixed(1)
                : '1.0'}
            </Text>
            {group.reviewCount > 0 && (
              <Text style={svc.reviewText}>({group.reviewCount})</Text>
            )}
            {distMin !== null && (
              <>
                <Text style={svc.dot}>·</Text>
                <Feather name="clock" size={10} color="#9CA3AF" />
                <Text style={svc.distText}>{distMin} min</Text>
              </>
            )}
          </View>
        </View>

        <Feather name="chevron-right" size={16} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Horizontal scroll of items (prestations / articles seulement) */}
      {group.items.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={svc.itemsRow}
        >
          {group.items.map(item => {
            const imgUrl: string | null = safeFirstUrl(item.raw?.image_url ?? item.raw?.image_urls ?? item.raw?.image);
            return (
              <TouchableOpacity
                key={String(item.id)}
                style={svc.itemCard}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: group.businessId } })}
              >
                <View style={svc.itemImgBox}>
                  {imgUrl ? (
                    <Image source={{ uri: imgUrl }} style={svc.itemImg} resizeMode="cover" />
                  ) : (
                    <Text style={svc.itemEmoji}>{item.emoji ?? '📦'}</Text>
                  )}
                </View>
                <Text style={svc.itemName} numberOfLines={2}>{String(item.title ?? '')}</Text>
                {item.meta ? <Text style={svc.itemMeta}>{String(item.meta)}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const svc = StyleSheet.create({
  card:        { backgroundColor: '#fff', borderRadius: 20, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, overflow: 'hidden' },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  avatar:      { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg:   { width: 56, height: 56, borderRadius: 28 },
  avatarEmoji: { fontSize: 26 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  bizName:     { fontSize: 15, fontWeight: '700', color: '#111827', flex: 1 },
  promoBadge:  { backgroundColor: '#EF4444', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  promoText:   { fontSize: 11, fontWeight: '700', color: '#fff' },
  metaRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  cityText:    { fontSize: 12, color: '#6B7280' },
  dot:         { fontSize: 12, color: '#D1D5DB' },
  ratingText:  { fontSize: 12, fontWeight: '600', color: '#F59E0B' },
  reviewText:  { fontSize: 12, color: '#9CA3AF' },
  distText:    { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  itemsRow:    { paddingHorizontal: 14, paddingBottom: 14, paddingTop: 10, gap: 10 },
  itemCard:    { width: SVC_ITEM_W, backgroundColor: '#F9FAFB', borderRadius: 14, overflow: 'hidden', gap: 0 },
  itemImgBox:  { width: SVC_ITEM_W, height: 80, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  itemImg:     { width: SVC_ITEM_W, height: 80 },
  itemEmoji:   { fontSize: 28 },
  itemName:    { fontSize: 12, fontWeight: '600', color: '#374151', paddingHorizontal: 8, paddingTop: 6, paddingBottom: 2 },
  itemMeta:    { fontSize: 11, color: '#22C55E', fontWeight: '700', paddingHorizontal: 8, paddingBottom: 8 },
});

// ── Carte tendance ─────────────────────────────────────────────────────────────
function TrendCard({ b }: { b: Business }) {
  const typeLabel = (b as any).category === 'restaurant' ? 'Resto'
    : (b as any).category === 'mode'    ? 'Mode'
    : (b as any).category === 'beaute'  ? 'Beauté'
    : 'Commerce';
  const typeColor = (b as any).category === 'restaurant' ? '#FF6835'
    : (b as any).category === 'mode'    ? '#9333EA'
    : (b as any).category === 'beaute'  ? '#EC4899'
    : '#3B82F6';

  return (
    <TouchableOpacity
      style={trend.card}
      onPress={() => router.push({ pathname: '/(client)/business/[id]', params: { id: b.id } })}
      activeOpacity={0.85}
    >
      <View style={trend.imgWrap}>
        {b.cover_url ? (
          <Image source={{ uri: b.cover_url }} style={trend.img} />
        ) : (
          <View style={[trend.img, { backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 28 }}>{(b as any).category_icon ?? '🏪'}</Text>
          </View>
        )}
        <View style={[trend.badge, { backgroundColor: typeColor }]}>
          <Text style={trend.badgeText}>{typeLabel}</Text>
        </View>
      </View>
      <Text style={trend.name} numberOfLines={1}>{b.name}</Text>
      {typeof b.rating === 'number' && b.rating > 0 && (
        <View style={trend.ratingRow}>
          <Feather name="star" size={11} color="#F59E0B" />
          <Text style={trend.ratingText}>{b.rating.toFixed(1)}</Text>
          {b.city && <Text style={trend.cityText}> · {b.city}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const TREND_CARD_W = (SCREEN_W - 40 - 12) / 3;
const trend = StyleSheet.create({
  card:      { width: TREND_CARD_W },
  imgWrap:   { position: 'relative', borderRadius: 12, overflow: 'hidden', marginBottom: 6 },
  img:       { width: TREND_CARD_W, height: TREND_CARD_W * 1.1, borderRadius: 12 },
  badge:     { position: 'absolute', top: 6, left: 6, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100 },
  badgeText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  name:      { fontSize: 12, fontWeight: '700', color: '#111827' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  ratingText:{ fontSize: 11, color: '#F59E0B', fontWeight: '600' },
  cityText:  { fontSize: 11, color: '#9CA3AF' },
});

// ─────────────────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const insets   = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const topPad   = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad   = Platform.OS === 'web' ? 34 : insets.bottom;

  const locationStore = useLocationStore();
  const savedCity     = (locationStore as any).city ?? null;
  const userLat       = (locationStore as any).lat  ?? null;
  const userLon       = (locationStore as any).lon  ?? null;
  const { profile }   = useAuthStore();
  const countryCode   = (profile as any)?.country_code ?? null;

  // Param reçu depuis l'accueil quand on clique "Voir tout" d'une ville
  const { preCity } = useLocalSearchParams<{ preCity?: string }>();

  const [query, setQuery]             = useState('');
  const [committed, setCommitted]     = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);

  // Mémorise la valeur de preCity vue lors du dernier focus
  // pour ne resetté l'état QUE quand l'intention de navigation change
  // (pas quand on revient depuis une fiche commerce)
  const prevPreCityRef = useRef<string | undefined>(undefined);

  useFocusEffect(
    useCallback(() => {
      const prev = prevPreCityRef.current;
      prevPreCityRef.current = preCity;

      // Même preCity qu'avant → on revient d'un écran enfant, on ne touche à rien
      if (prev === preCity) return;

      if (preCity) {
        // Nouvelle arrivée depuis "Voir tout [Ville]"
        const cityFilters = { ...DEFAULT_SEARCH_FILTERS, localisation: preCity };
        setFilters(cityFilters);
        setQuery('');
        setCommitted('');
        setHasSearched(true);
      } else {
        // Nouvelle arrivée sans contexte → état vierge
        setFilters(DEFAULT_SEARCH_FILTERS);
        setQuery('');
        setCommitted('');
        setHasSearched(false);
      }
    }, [preCity]),
  );

  const { data: results = [], isLoading } = useSearch(
    committed, filters, hasSearched, userLat, userLon,
  );

  // Tous les résultats dans le même format groupé
  const allGroups = useMemo(() => groupServiceResults(results), [results]);

  // ── Tendances : businesses de la ville de l'utilisateur ───────────────────
  const trendFilters = countryCode
    ? { country_code: countryCode, ...(savedCity ? { city: savedCity } : {}) }
    : null;
  const { data: trendBizs = [] } = useBusinesses(trendFilters);
  const trendSlice = trendBizs.slice(0, 9);

  // ── Récentes recherches (AsyncStorage) ────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then(raw => raw ? setRecentSearches(JSON.parse(raw)) : null)
      .catch(() => {});
  }, []);

  const saveRecent = useCallback(async (term: string) => {
    const updated = [term, ...recentSearches.filter(r => r !== term)].slice(0, MAX_RECENT);
    setRecentSearches(updated);
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify(updated)).catch(() => {});
  }, [recentSearches]);

  const clearRecent = useCallback(async () => {
    setRecentSearches([]);
    await AsyncStorage.removeItem(RECENT_KEY).catch(() => {});
  }, []);

  const isTagSearch = query.startsWith('#');

  const activeCategoryLabel = filters.categoryId
    ? SECTEURS.find((s) => s.id === filters.categoryId)?.label
    : null;

  const groupCount = allGroups.length;
  const resultsLabel = activeCategoryLabel
    ? `${groupCount} résultat${groupCount > 1 ? 's' : ''} · ${activeCategoryLabel}`
    : committed
      ? `${groupCount} résultat${groupCount > 1 ? 's' : ''} pour "${committed}"`
      : `${groupCount} résultat${groupCount > 1 ? 's' : ''}`;

  const emptyLabel = activeCategoryLabel
    ? `Aucun résultat en "${activeCategoryLabel}"`
    : committed
      ? `Aucun résultat pour "${committed}"`
      : filters.localisation
        ? `Aucun résultat à ${filters.localisation}`
        : 'Aucun résultat pour cette recherche';

  const doSearch = (term?: string) => {
    const t = (term ?? query).trim();
    if (t.length === 0) return;
    saveRecent(t);
    if (!term) setQuery(t);
    setCommitted(t);
    setFilters((f) => ({ ...f, categoryId: undefined }));
    setHasSearched(true);
    inputRef.current?.blur();
  };

  const clearAll = () => {
    setQuery(''); setCommitted('');
    setHasSearched(false);
    setFilters(DEFAULT_SEARCH_FILTERS);
  };

  const onQueryChange = (t: string) => {
    setQuery(t);
    if (t.length === 0) { setCommitted(''); setHasSearched(false); }
  };

  const launchCategory = (catId: string) => {
    setQuery('');
    setCommitted('');
    setFilters((f) => ({ ...f, categoryId: catId, type: 'all' }));
    setHasSearched(true);
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* ── Header barre de recherche ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.75}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>

        <View style={[styles.searchBar, isTagSearch && styles.searchBarTag]}>
          <Feather name={isTagSearch ? 'hash' : 'search'} size={17}
            color={isTagSearch ? '#FF6835' : '#9CA3AF'} />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Boutique, article ou service..."
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={onQueryChange}
            returnKeyType="search"
            onSubmitEditing={() => doSearch()}
            autoCorrect={false}
            autoCapitalize="none"
          />
          {(query.length > 0 || hasSearched) && (
            <TouchableOpacity onPress={clearAll} hitSlop={10}>
              <Feather name="x-circle" size={16} color="#C4C9D4" />
            </TouchableOpacity>
          )}
        </View>

      </View>

      {/* Chip localisation active (ex: depuis "Voir tout [Ville]") */}
      {filters.localisation.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ backgroundColor: '#fff', paddingHorizontal: 16, maxHeight: 44 }}
        >
          <View style={styles.chip}>
            <Feather name="map-pin" size={11} color="#FF6835" />
            <Text style={styles.chipText}>{filters.localisation}</Text>
          </View>
          <TouchableOpacity onPress={clearAll} style={styles.clearChip}>
            <Text style={styles.clearChipText}>Effacer</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Résultats ── */}
      {hasSearched ? (
        isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#FF6835" size="large" />
            <Text style={styles.loadingText}>Recherche en cours…</Text>
          </View>
        ) : results.length === 0 ? (
          /* ── Aucun résultat ── */
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>🔍</Text>
            <Text style={styles.emptyTitle}>Aucun résultat</Text>
            <Text style={styles.emptySub}>{emptyLabel}</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={clearAll}>
              <Text style={styles.emptyBtnText}>Retour aux catégories</Text>
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Affichage résultats ── */
          <ScrollView
            contentContainerStyle={[styles.resultsList, { paddingBottom: botPad + 80 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header résultats */}
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>{resultsLabel}</Text>
              <TouchableOpacity onPress={clearAll} style={styles.backChip}>
                <Feather name="x" size={12} color="#FF6835" />
                <Text style={styles.backChipText}>Effacer</Text>
              </TouchableOpacity>
            </View>

            {/* Tous les résultats dans le même format */}
            {allGroups.map(group => (
              <ServiceGroupCard key={group.businessId} group={group} />
            ))}
          </ScrollView>
        )
      ) : (
        /* ── État vide : recherches récentes + catégories + tendances ── */
        <ScrollView
          contentContainerStyle={[styles.discoverContent, { paddingBottom: botPad + 80 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Recherches récentes ── */}
          {recentSearches.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recherches récentes</Text>
                <TouchableOpacity onPress={clearRecent} hitSlop={8}>
                  <Text style={styles.effacer}>Effacer</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {recentSearches.map((term) => (
                  <TouchableOpacity
                    key={term}
                    style={styles.recentChip}
                    onPress={() => { setQuery(term); doSearch(term); }}
                    activeOpacity={0.75}
                  >
                    <Feather name="clock" size={13} color="#9CA3AF" />
                    <Text style={styles.recentChipText}>{term}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── Explorer par catégorie ── */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Explorer par catégorie</Text>
                <Text style={styles.sectionSub}>Trouvez rapidement ce dont vous avez besoin</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingVertical: 4 }}
            >
              {SEARCH_CATS.map((cat) => (
                <TouchableOpacity
                  key={cat.id}
                  style={styles.catItem}
                  onPress={() => launchCategory(cat.id)}
                  activeOpacity={0.8}
                >
                  <View style={styles.catIconBox}>
                    <Feather name={cat.icon as any} size={22} color={cat.color} />
                  </View>
                  <Text style={styles.catLabel} numberOfLines={2}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* ── Tendances près de vous ── */}
          {trendSlice.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Tendances près de vous</Text>
                  <Text style={styles.sectionSub}>
                    {savedCity ? `Les recherches populaires à ${savedCity}` : 'Les plus populaires'}
                  </Text>
                </View>
              </View>
              <View style={styles.trendGrid}>
                {trendSlice.map((b) => <TrendCard key={b.id} b={b} />)}
              </View>
            </View>
          )}
        </ScrollView>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#fff' },

  // ── Header ──
  header:       { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 10, paddingTop: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E5E7EB' },
  backBtn:      { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  searchBar:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: 'transparent' },
  searchBarTag: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  searchInput:  { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  filterBtn:    { width: 42, height: 42, borderRadius: 12, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FDDCCA', position: 'relative' },
  filterBtnActive: { backgroundColor: '#FF6835', borderColor: '#FF6835' },
  filterBadge:  { position: 'absolute', top: -5, right: -5, backgroundColor: '#111827', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  chipRow:      { gap: 8, paddingVertical: 6, alignItems: 'center', flexDirection: 'row' },
  chip:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2EC', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FDDCCA', alignSelf: 'center' },
  chipText:     { fontSize: 12, fontWeight: '600', color: '#FF6835' },
  clearChip:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1, borderColor: '#E5E7EB', alignSelf: 'center' },
  clearChipText:{ fontSize: 12, fontWeight: '600', color: '#9CA3AF' },

  // ── Résultats ──
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText:  { fontSize: 14, color: '#9CA3AF' },
  resultsList:  { paddingHorizontal: 16, paddingTop: 8 },
  resultsHeader:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  resultsCount: { fontSize: 13, color: '#6B7280', flex: 1 },
  backChip:     { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF2EC', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FDDCCA' },
  backChipText: { fontSize: 12, fontWeight: '600', color: '#FF6835' },
  resultsSectionTitle: { fontSize: 14, fontWeight: '800', color: '#374151', marginBottom: 12, marginTop: 4 },
  empty:        { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyEmoji:   { fontSize: 48 },
  emptyTitle:   { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySub:     { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  emptyBtn:     { backgroundColor: '#FF6835', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  // ── Discover (état vide) ──
  discoverContent: { paddingTop: 8 },
  section:      { paddingHorizontal: 20, marginBottom: 28 },
  sectionHeader:{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },
  sectionSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  effacer:      { fontSize: 13, fontWeight: '600', color: '#FF6835', marginTop: 2 },
  recentChip:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  recentChipText:{ fontSize: 13, color: '#374151', fontWeight: '500' },
  catItem:      { alignItems: 'center', gap: 7, width: 76 },
  catIconBox:   { width: 64, height: 64, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 6, elevation: 3, borderWidth: 1, borderColor: '#F3F4F6' },
  catLabel:     { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },
  trendGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  modalOuter:     { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop:  { backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet:     { backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingHorizontal: 20, maxHeight: '92%' },
  modalHandle:    { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 16 },
  modalHeader:    { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20, gap: 12 },
  modalTitle:     { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalSubtitle:  { fontSize: 13, color: '#9CA3AF', marginTop: 3 },
  modalCloseBtn:  { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginTop: 2 },

  fsection:     { marginBottom: 24 },
  flabel:       { fontSize: 12, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 },

  // Catégorie chips dans modal
  catChip:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  catChipActive:  { backgroundColor: '#FEF2EC', borderColor: '#FDDCCA' },
  catChipText:    { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  catChipTextActive: { color: '#FF6835' },

  // Distance
  distRow:        { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  distChip:       { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: 'transparent' },
  distChipActive: { backgroundColor: '#FEF2EC', borderColor: '#FDDCCA' },
  distChipText:   { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  distChipTextActive: { color: '#FF6835' },

  // Sort
  sortList:       { gap: 10 },
  sortRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#F3F4F6' },
  sortRowActive:  { backgroundColor: '#FEF2EC', borderColor: '#FDDCCA' },
  sortIconBox:    { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  sortIconBoxActive: { backgroundColor: '#FFE8DB' },
  sortTitle:      { fontSize: 14, fontWeight: '700', color: '#111827' },
  sortTitleActive:{ color: '#FF6835' },
  sortSub:        { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  radio:          { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioActive:    { borderColor: '#FF6835' },
  radioDot:       { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6835' },

  // Toggles
  togglesCard:    { backgroundColor: '#F9FAFB', borderRadius: 16, borderWidth: 1, borderColor: '#F3F4F6', overflow: 'hidden' },
  toggleRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  toggleLeft:     { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, paddingRight: 8 },
  toggleIconBox:  { width: 36, height: 36, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  toggleIconBoxActive: { backgroundColor: '#FFE8DB' },
  toggleTitle:    { fontSize: 14, fontWeight: '600', color: '#111827' },
  toggleSub:      { fontSize: 12, color: '#9CA3AF', marginTop: 2, maxWidth: 200 },
  toggleSep:      { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 14 },

  // Footer
  modalFooter:    { flexDirection: 'row', gap: 12, paddingTop: 12, paddingBottom: 4 },
  resetBtn:       { flex: 1, paddingVertical: 15, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  resetBtnText:   { fontSize: 15, fontWeight: '700', color: '#374151' },
  applyBtn:       { flex: 2, paddingVertical: 15, borderRadius: 14, backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center' },
  applyBtnText:   { fontSize: 15, fontWeight: '700', color: '#fff' },
});
