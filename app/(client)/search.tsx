import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Dimensions, FlatList, Modal, Platform,
  PanResponder, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SECTEURS } from '@/types';
import {
  useSearch, SearchFilterType, SearchFilters,
  SearchResult, DEFAULT_SEARCH_FILTERS,
} from '@/hooks/useSearch';

const SCREEN_W  = Dimensions.get('window').width;
const SLIDER_W  = SCREEN_W - 100;
const MAX_PRICE = 200_000;

const TYPE_FILTERS: { id: SearchFilterType; label: string; emoji: string }[] = [
  { id: 'all',        label: 'Tout',        emoji: '🔍' },
  { id: 'boutique',   label: 'Boutiques',   emoji: '🏪' },
  { id: 'prestation', label: 'Prestations', emoji: '🔧' },
  { id: 'article',    label: 'Articles',    emoji: '📦' },
  { id: 'lieu',       label: 'Lieux',       emoji: '📍' },
];

const RATINGS = [
  { label: 'Toutes',  value: null },
  { label: '3 ★+',   value: 3    },
  { label: '3.5 ★+', value: 3.5  },
  { label: '4 ★+',   value: 4    },
  { label: '4.5 ★+', value: 4.5  },
  { label: '5 ★',    value: 5    },
];

// ── Slider ────────────────────────────────────────────────────────────────────
function Slider({ value, min, max, onChange, fmt }: {
  value: number; min: number; max: number;
  onChange: (v: number) => void; fmt: (v: number) => string;
}) {
  const trackRef = useRef<View>(null);
  const ratio    = (value - min) / (max - min);
  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => {
      trackRef.current?.measure((_fx, _fy, _w, _h, px) => {
        const x   = g.moveX - px;
        const r   = Math.min(1, Math.max(0, x / SLIDER_W));
        const raw = min + r * (max - min);
        const step = max >= 10_000 ? 5_000 : 1;
        onChange(Math.round(raw / step) * step);
      });
    },
  })).current;

  return (
    <View style={sl.wrap}>
      <View ref={trackRef} style={sl.track}>
        <View style={[sl.fill, { width: `${ratio * 100}%` as any }]} />
        <View {...pan.panHandlers} style={[sl.thumb, { left: ratio * SLIDER_W - 12 }]} />
      </View>
      <View style={sl.row}>
        <Text style={sl.min}>{fmt(min)}</Text>
        <Text style={sl.val}>{fmt(value)}</Text>
        <Text style={sl.max}>{value >= max ? 'Illimité' : fmt(max)}</Text>
      </View>
    </View>
  );
}
const sl = StyleSheet.create({
  wrap:  { gap: 8 },
  track: { height: 6, backgroundColor: '#E5E7EB', borderRadius: 3, marginHorizontal: 12, position: 'relative' },
  fill:  { height: 6, backgroundColor: '#FF6835', borderRadius: 3 },
  thumb: { position: 'absolute', top: -9, width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', borderWidth: 3, borderColor: '#FF6835', elevation: 4, shadowColor: '#FF6835', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  row:   { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 4 },
  min:   { fontSize: 11, color: '#9CA3AF' },
  val:   { fontSize: 13, fontWeight: '800', color: '#FF6835' },
  max:   { fontSize: 11, color: '#9CA3AF' },
});

// ── Carte résultat ────────────────────────────────────────────────────────────
function ResultCard({ item }: { item: SearchResult }) {
  const cfg = {
    boutique:   { color: '#FF6835', bg: '#FEF2EC', label: 'Boutique'   },
    prestation: { color: '#1E3A5F', bg: '#EEF2FF', label: 'Prestation' },
    article:    { color: '#22C55E', bg: '#F0FDF4', label: 'Article'    },
    lieu:       { color: '#F59E0B', bg: '#FFFBEB', label: 'Lieu'       },
  }[item.type];

  return (
    <TouchableOpacity
      style={styles.resultCard}
      onPress={() => {
        if (item.type === 'boutique' || item.type === 'lieu') {
          router.push({ pathname: '/(client)/business/[id]', params: { id: item.id } });
        }
      }}
      activeOpacity={0.85}
    >
      <View style={[styles.resultIcon, { backgroundColor: cfg.bg }]}>
        <Text style={styles.resultEmoji}>{item.emoji ?? '🏪'}</Text>
      </View>
      <View style={styles.resultBody}>
        <View style={styles.resultTitleRow}>
          <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
          {item.tag && <Text style={styles.resultTag}>{item.tag}</Text>}
        </View>
        {item.subtitle && <Text style={styles.resultSub} numberOfLines={1}>{item.subtitle}</Text>}
        <View style={styles.resultMetaRow}>
          {item.meta && <Text style={styles.resultMeta}>{item.meta}</Text>}
          {item.isOpen !== undefined && (
            <View style={[styles.openDot, { backgroundColor: item.isOpen ? '#22C55E' : '#9CA3AF' }]} />
          )}
          {typeof item.rating === 'number' && item.rating > 0 && (
            <View style={styles.ratingRow}>
              <Feather name="star" size={11} color="#F59E0B" />
              <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={[styles.typeBadge, { backgroundColor: cfg.bg }]}>
        <Text style={[styles.typeBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function SearchScreen() {
  const insets   = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const topPad   = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad   = Platform.OS === 'web' ? 34 : insets.bottom;

  const [query, setQuery]             = useState('');
  const [committed, setCommitted]     = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);

  const [filters, setFilters]         = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);
  const [tempFilters, setTempFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);

  const { data: results = [], isLoading } = useSearch(committed, filters, hasSearched);

  const isTagSearch = query.startsWith('#');

  // ✅ categoryId compte aussi comme filtre actif
  const activeFilterCount = [
    filters.openNow,
    filters.nearMe,
    filters.minRating !== null,
    filters.maxPrice !== null,
    filters.localisation.length > 0,
    filters.type !== 'all',
    !!filters.categoryId,
  ].filter(Boolean).length;

  // ── Libellé affiché dans le header des résultats ──────────────────────────
  const activeCategoryLabel = filters.categoryId
    ? SECTEURS.find((s) => s.id === filters.categoryId)?.label
    : null;

  const resultsLabel = activeCategoryLabel
    ? `${results.length} résultat${results.length > 1 ? 's' : ''} · ${activeCategoryLabel}`
    : committed
      ? `${results.length} résultat${results.length > 1 ? 's' : ''} pour "${committed}"`
      : `${results.length} résultat${results.length > 1 ? 's' : ''}`;

  const emptyLabel = activeCategoryLabel
    ? `Aucun résultat en "${activeCategoryLabel}"`
    : `Aucun résultat pour "${committed}"`;

  // ── Lancer la recherche ───────────────────────────────────────────────────
  const doSearch = () => {
    if (query.trim().length === 0) return;
    setCommitted(query.trim());
    setFilters((f) => ({ ...f, categoryId: undefined })); // texte libre → pas de filtre catégorie
    setHasSearched(true);
    inputRef.current?.blur();
  };

  // ── Réinitialiser tout ────────────────────────────────────────────────────
  const clearAll = () => {
    setQuery(''); setCommitted('');
    setHasSearched(false);
    setFilters(DEFAULT_SEARCH_FILTERS);
    setTempFilters(DEFAULT_SEARCH_FILTERS);
  };

  const onQueryChange = (t: string) => {
    setQuery(t);
    if (t.length === 0) { setCommitted(''); setHasSearched(false); }
  };

  const setTypeFilter = (type: SearchFilterType) => setFilters((f) => ({ ...f, type }));

  const applyFilters = () => {
    setFilters(tempFilters);
    setFilterVisible(false);
  };

  const fmtPrice = (v: number) => v >= MAX_PRICE ? 'Illimité' : `${v.toLocaleString('fr-FR')} F`;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Recherche</Text>

        <View style={styles.searchRow}>
          <View style={[styles.searchBar, isTagSearch && styles.searchBarTag]}>
            <Feather name={isTagSearch ? 'hash' : 'search'} size={18}
              color={isTagSearch ? '#FF6835' : '#9CA3AF'} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Ex : iPhone 17, PC gaming, #BT123…"
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={onQueryChange}
              returnKeyType="search"
              onSubmitEditing={doSearch}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {(query.length > 0 || hasSearched) && (
              <TouchableOpacity onPress={clearAll} hitSlop={10}>
                <Feather name="x-circle" size={17} color="#C4C9D4" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={() => { setTempFilters({ ...filters }); setFilterVisible(true); }}
            activeOpacity={0.8}
          >
            <Feather name="sliders" size={18} color={activeFilterCount > 0 ? '#fff' : '#FF6835'} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.searchBtn, query.trim().length === 0 && styles.searchBtnDisabled]}
            onPress={doSearch}
            disabled={query.trim().length === 0}
            activeOpacity={0.85}
          >
            <Text style={styles.searchBtnText}>Chercher</Text>
          </TouchableOpacity>
        </View>

        {/* Chips filtres actifs */}
        {activeFilterCount > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {filters.openNow && <View style={styles.chip}><Feather name="zap" size={11} color="#FF6835" /><Text style={styles.chipText}>Ouvert</Text></View>}
            {filters.nearMe && <View style={styles.chip}><Feather name="navigation" size={11} color="#FF6835" /><Text style={styles.chipText}>Près de moi</Text></View>}
            {filters.minRating !== null && <View style={styles.chip}><Text style={{ fontSize: 11 }}>⭐</Text><Text style={styles.chipText}>{filters.minRating}+</Text></View>}
            {filters.maxPrice !== null && <View style={styles.chip}><Feather name="tag" size={11} color="#FF6835" /><Text style={styles.chipText}>Max {filters.maxPrice.toLocaleString('fr-FR')} F</Text></View>}
            {filters.localisation.length > 0 && <View style={styles.chip}><Feather name="map-pin" size={11} color="#FF6835" /><Text style={styles.chipText}>{filters.localisation}</Text></View>}
            {filters.type !== 'all' && <View style={styles.chip}><Text style={{ fontSize: 11 }}>{TYPE_FILTERS.find(f => f.id === filters.type)?.emoji}</Text><Text style={styles.chipText}>{TYPE_FILTERS.find(f => f.id === filters.type)?.label}</Text></View>}
            {/* ✅ Chip catégorie active */}
            {filters.categoryId && (
              <View style={styles.chip}>
                <Text style={{ fontSize: 11 }}>{SECTEURS.find(s => s.id === filters.categoryId)?.emoji}</Text>
                <Text style={styles.chipText}>{SECTEURS.find(s => s.id === filters.categoryId)?.label}</Text>
              </View>
            )}
            <TouchableOpacity onPress={clearAll} style={styles.clearChip}>
              <Text style={styles.clearChipText}>Effacer</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* Filtres de type — après recherche */}
        {hasSearched && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
            {TYPE_FILTERS.map((f) => {
              const active = filters.type === f.id;
              return (
                <TouchableOpacity key={f.id} style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setTypeFilter(f.id)} activeOpacity={0.8}>
                  <Text style={styles.typeChipEmoji}>{f.emoji}</Text>
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{f.label}</Text>
                  {active && results.length > 0 && (
                    <View style={styles.typeCount}>
                      <Text style={styles.typeCountText}>{results.length}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* ── Résultats ── */}
      {hasSearched ? (
        isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#FF6835" size="large" />
            <Text style={styles.loadingText}>Recherche en cours…</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(r) => `${r.type}-${r.id}`}
            contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListHeaderComponent={
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsCount}>{resultsLabel}</Text>
                <TouchableOpacity onPress={clearAll} style={styles.backBtn}>
                  <Feather name="grid" size={12} color="#FF6835" />
                  <Text style={styles.backBtnText}>Catégories</Text>
                </TouchableOpacity>
              </View>
            }
            renderItem={({ item }) => <ResultCard item={item} />}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyEmoji}>🔍</Text>
                <Text style={styles.emptyTitle}>Aucun résultat</Text>
                <Text style={styles.emptySub}>{emptyLabel}</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={clearAll}>
                  <Text style={styles.emptyBtnText}>Retour aux catégories</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )
      ) : (
        // ── Grille catégories ──
        <ScrollView contentContainerStyle={[styles.catGrid, { paddingBottom: botPad + 80 }]} showsVerticalScrollIndicator={false}>
          <View style={styles.tipBox}>
            <Feather name="info" size={14} color="#1E3A5F" />
            <Text style={styles.tipText}>
              Tapez un nom, une prestation (ex : <Text style={styles.tipBold}>iPhone 17</Text>), une phrase (ex : <Text style={styles.tipBold}>pc gaming</Text>), ou le <Text style={styles.tipBold}>#tag</Text> d'une boutique.
            </Text>
          </View>
          <Text style={styles.catGridTitle}>Explorer par catégorie</Text>
          <View style={styles.catGridWrap}>
            {SECTEURS.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.catCard}
                onPress={() => {
                  // ✅ Filtre par categoryId — pas de texte libre
                  setQuery('');
                  setCommitted('');
                  setFilters((f) => ({
                    ...f,
                    categoryId: s.id,   // ← filtre DB par category = 'tech' etc.
                    type: 'all',        // boutiques + prestations
                  }));
                  setHasSearched(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.catEmoji}>{s.emoji}</Text>
                <Text style={styles.catLabel}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Modal filtres ── */}
      <Modal visible={filterVisible} transparent animationType="slide" onRequestClose={() => setFilterVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setFilterVisible(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtres</Text>
            <TouchableOpacity onPress={() => setTempFilters(DEFAULT_SEARCH_FILTERS)}>
              <Text style={styles.resetText}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Type de résultat */}
            <View style={styles.fsection}>
              <Text style={styles.flabel}>Type de résultat</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {TYPE_FILTERS.map((f) => {
                  const active = tempFilters.type === f.id;
                  return (
                    <TouchableOpacity key={f.id} style={[styles.typeChip, active && styles.typeChipActive]}
                      onPress={() => setTempFilters((p) => ({ ...p, type: f.id }))}>
                      <Text style={styles.typeChipEmoji}>{f.emoji}</Text>
                      <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Disponibilité */}
            <View style={styles.fsection}>
              <Text style={styles.flabel}>Disponibilité</Text>
              <TouchableOpacity
                style={[styles.toggleRow, tempFilters.openNow && styles.toggleRowActive]}
                onPress={() => setTempFilters((f) => ({ ...f, openNow: !f.openNow }))}
              >
                <View style={styles.toggleLeft}>
                  <Feather name="zap" size={16} color={tempFilters.openNow ? '#FF6835' : '#6B7280'} />
                  <View>
                    <Text style={[styles.toggleTitle, tempFilters.openNow && { color: '#FF6835' }]}>Ouvert maintenant</Text>
                    <Text style={styles.toggleSub}>Afficher uniquement les commerces ouverts</Text>
                  </View>
                </View>
                <View style={[styles.check, tempFilters.openNow && styles.checkActive]}>
                  {tempFilters.openNow && <Feather name="check" size={12} color="#fff" />}
                </View>
              </TouchableOpacity>
            </View>

            {/* Localisation */}
            <View style={styles.fsection}>
              <Text style={styles.flabel}>Localisation</Text>
              <TouchableOpacity
                style={[styles.toggleRow, tempFilters.nearMe && styles.toggleRowActive]}
                onPress={() => setTempFilters((f) => ({ ...f, nearMe: !f.nearMe }))}
              >
                <View style={styles.toggleLeft}>
                  <Feather name="navigation" size={16} color={tempFilters.nearMe ? '#FF6835' : '#6B7280'} />
                  <View>
                    <Text style={[styles.toggleTitle, tempFilters.nearMe && { color: '#FF6835' }]}>Près de moi</Text>
                    <Text style={styles.toggleSub}>Utiliser ma position GPS</Text>
                  </View>
                </View>
                <View style={[styles.check, tempFilters.nearMe && styles.checkActive]}>
                  {tempFilters.nearMe && <Feather name="check" size={12} color="#fff" />}
                </View>
              </TouchableOpacity>

              <View style={styles.locRow}>
                <Feather name="map-pin" size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.locInput}
                  value={tempFilters.localisation}
                  onChangeText={(t) => setTempFilters((f) => ({ ...f, localisation: t }))}
                  placeholder="Quartier, ville, adresse…"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                />
                {tempFilters.localisation.length > 0 && (
                  <TouchableOpacity onPress={() => setTempFilters((f) => ({ ...f, localisation: '' }))} hitSlop={8}>
                    <Feather name="x-circle" size={16} color="#C4C9D4" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Recommandation */}
            <View style={styles.fsection}>
              <Text style={styles.flabel}>Recommandation (note)</Text>
              <View style={styles.ratingGrid}>
                {RATINGS.map((r) => {
                  const active = tempFilters.minRating === r.value;
                  return (
                    <TouchableOpacity key={String(r.value)}
                      style={[styles.ratingChip, active && styles.ratingChipActive]}
                      onPress={() => setTempFilters((f) => ({ ...f, minRating: r.value }))}>
                      <Text style={[styles.ratingChipText, active && { color: '#FF6835' }]}>{r.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Budget */}
            <View style={[styles.fsection, { marginBottom: 8 }]}>
              <Text style={styles.flabel}>Budget maximum</Text>
              <Slider
                value={tempFilters.maxPrice ?? MAX_PRICE}
                min={0}
                max={MAX_PRICE}
                onChange={(v) => setTempFilters((f) => ({ ...f, maxPrice: v >= MAX_PRICE ? null : v }))}
                fmt={fmtPrice}
              />
              {(tempFilters.maxPrice ?? MAX_PRICE) >= MAX_PRICE && (
                <Text style={styles.unlimitedNote}>Aucune limite de prix</Text>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity style={styles.applyBtn} onPress={applyFilters}>
            <Text style={styles.applyBtnText}>
              Appliquer{activeFilterCount > 0 ? ` · ${activeFilterCount} filtre${activeFilterCount > 1 ? 's' : ''}` : ''}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 12, paddingTop: 8, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1.5, borderColor: 'transparent' },
  searchBarTag: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  filterBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FDDCCA', position: 'relative' },
  filterBtnActive: { backgroundColor: '#FF6835', borderColor: '#FF6835' },
  filterBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#111827', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  searchBtn: { backgroundColor: '#FF6835', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  searchBtnDisabled: { backgroundColor: '#D1D5DB' },
  searchBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2EC', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FDDCCA' },
  chipText: { fontSize: 12, fontWeight: '600', color: '#FF6835' },
  clearChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1, borderColor: '#E5E7EB' },
  clearChipText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  typeRow: { gap: 8, paddingVertical: 2 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1.5, borderColor: 'transparent' },
  typeChipActive: { backgroundColor: '#FEF2EC', borderColor: '#FDDCCA' },
  typeChipEmoji: { fontSize: 13 },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  typeChipTextActive: { color: '#FF6835' },
  typeCount: { backgroundColor: '#FF6835', borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  typeCountText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#9CA3AF' },
  list: { paddingHorizontal: 20, paddingTop: 8 },
  sep: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 2 },
  resultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  resultsCount: { fontSize: 13, color: '#6B7280', flex: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF2EC', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FDDCCA' },
  backBtnText: { fontSize: 12, fontWeight: '600', color: '#FF6835' },
  resultCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginVertical: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  resultIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  resultEmoji: { fontSize: 22 },
  resultBody: { flex: 1, gap: 3 },
  resultTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  resultTitle: { fontSize: 15, fontWeight: '700', color: '#111827', flexShrink: 1 },
  resultTag: { fontSize: 11, fontWeight: '300', color: '#9CA3AF' },
  resultSub: { fontSize: 13, color: '#6B7280' },
  resultMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultMeta: { fontSize: 12, fontWeight: '600', color: '#22C55E' },
  openDot: { width: 7, height: 7, borderRadius: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  typeBadgeText: { fontSize: 11, fontWeight: '700' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 60 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  emptyBtn: { backgroundColor: '#FF6835', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  tipBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EEF2FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#C7D2FE', marginBottom: 8 },
  tipText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 19 },
  tipBold: { fontWeight: '700', color: '#1E3A5F' },
  catGrid: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  catGridTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  catGridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard: { width: '47%', backgroundColor: '#fff', borderRadius: 16, paddingVertical: 20, paddingHorizontal: 14, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  catEmoji: { fontSize: 30 },
  catLabel: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '90%', gap: 16 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  resetText: { fontSize: 14, fontWeight: '600', color: '#FF6835' },
  fsection: { gap: 10, marginBottom: 22 },
  flabel: { fontSize: 12, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  toggleRowActive: { backgroundColor: '#FEF2EC', borderColor: '#FDDCCA' },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  toggleSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  checkActive: { backgroundColor: '#FF6835', borderColor: '#FF6835' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  locInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },
  ratingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ratingChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  ratingChipActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  ratingChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  unlimitedNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', fontStyle: 'italic' },
  applyBtn: { backgroundColor: '#FF6835', borderRadius: 14, padding: 16, alignItems: 'center' },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
