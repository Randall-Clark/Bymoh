import { Feather } from '@expo/vector-icons';
import React, { useState, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  PanResponder,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BusinessCard } from '@/components/business/BusinessCard';
import { useBusinesses } from '@/hooks/useBusinesses';
import { SECTEURS } from '@/types';

const SCREEN_W = Dimensions.get('window').width;
const SLIDER_W = SCREEN_W - 80; // largeur de la barre slider
const MAX_KM = 50;
const MAX_PRICE = 200000;


// ── Disponibilité ─────────────────────────────────────────────────────────────
const DISPONIBILITES = [
  { id: 'open_now',    label: 'Ouvert maintenant', icon: 'zap' },
  { id: 'weekend',     label: 'Seulement les weekends', icon: 'calendar' },
  { id: 'all_week',    label: 'Toute la semaine',  icon: 'check-circle' },
  { id: 'until_hour',  label: "Jusqu'à une heure", icon: 'clock' },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Filters {
  nearMe: boolean;
  distanceKm: number;
  disponibilite: string | null;
  untilHour: string;
  localisation: string;
  minRating: number | null;
  maxPrice: number | null; // null = illimité
}

const DEFAULT_FILTERS: Filters = {
  nearMe: false,
  distanceKm: 10,
  disponibilite: null,
  untilHour: '22:00',
  localisation: '',
  minRating: null,
  maxPrice: null,
};

// ── Slider horizontal custom ──────────────────────────────────────────────────
function Slider({
  value, min, max, onChange, formatLabel,
}: {
  value: number; min: number; max: number;
  onChange: (v: number) => void;
  formatLabel: (v: number) => string;
}) {
  const sliderRef = useRef<View>(null);
  const ratio = (value - min) / (max - min);
  const thumbX = ratio * SLIDER_W;

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {},
    onPanResponderMove: (_, g) => {
      sliderRef.current?.measure((fx, fy, w, h, px) => {
        const x = g.moveX - px;
        const newRatio = Math.min(1, Math.max(0, x / SLIDER_W));
        const raw = min + newRatio * (max - min);
        const step = max > 1000 ? 5000 : 1;
        onChange(Math.round(raw / step) * step);
      });
    },
  })).current;

  return (
    <View style={sliderStyles.wrap}>
      <View ref={sliderRef} style={sliderStyles.track}>
        <View style={[sliderStyles.fill, { width: `${ratio * 100}%` }]} />
        <View
          {...pan.panHandlers}
          style={[sliderStyles.thumb, { left: thumbX - 12 }]}
        />
      </View>
      <View style={sliderStyles.labels}>
        <Text style={sliderStyles.labelMin}>{formatLabel(min)}</Text>
        <Text style={sliderStyles.labelVal}>{formatLabel(value)}</Text>
        <Text style={sliderStyles.labelMax}>{max === MAX_PRICE ? 'Illimité' : formatLabel(max)}</Text>
      </View>
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  wrap: { gap: 10 },
  track: {
    height: 6, backgroundColor: '#E5E7EB', borderRadius: 3,
    marginHorizontal: 12, position: 'relative',
  },
  fill: { height: 6, backgroundColor: '#FF6835', borderRadius: 3 },
  thumb: {
    position: 'absolute', top: -9,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#fff', borderWidth: 3, borderColor: '#FF6835',
    shadowColor: '#FF6835', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 4, elevation: 4,
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 4 },
  labelMin: { fontSize: 11, color: '#9CA3AF' },
  labelVal: { fontSize: 13, fontWeight: '800', color: '#FF6835' },
  labelMax: { fontSize: 11, color: '#9CA3AF' },
});

// ── Composant principal ───────────────────────────────────────────────────────
export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [tempFilters, setTempFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const activeFilterCount = [
    filters.nearMe,
    filters.disponibilite,
    filters.localisation,
    filters.minRating !== null,
    filters.maxPrice !== null,
  ].filter(Boolean).length;

  const { data: businesses = [], isLoading } = useBusinesses({
    category: selectedCategory ?? undefined,
    searchQuery: query || undefined,
  });

  const clearSearch = () => {
    setQuery('');
    setSelectedCategory(null);
    setHasSearched(false);
    setFilters(DEFAULT_FILTERS);
  };

  const openFilters = () => {
    setTempFilters({ ...filters });
    setFilterVisible(true);
  };

  const applyFilters = () => {
    setFilters(tempFilters);
    setFilterVisible(false);
    setHasSearched(true);
  };

  const showResults = hasSearched || query.length > 0 || selectedCategory !== null;

  const formatKm = (v: number) => `${v} km`;
  const formatPrice = (v: number) => v >= MAX_PRICE ? 'Illimité' : `${v.toLocaleString('fr-FR')} F`;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.title}>Recherche</Text>

        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Feather name="search" size={18} color="#9CA3AF" />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Rechercher un service, commerce…"
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={(t) => { setQuery(t); if (t.length > 0) setHasSearched(true); }}
              returnKeyType="search"
              onSubmitEditing={() => { setHasSearched(true); inputRef.current?.blur(); }}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={clearSearch} hitSlop={8}>
                <Feather name="x" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity
            style={[styles.filterBtn, activeFilterCount > 0 && styles.filterBtnActive]}
            onPress={openFilters}
            activeOpacity={0.8}
          >
            <Feather name="sliders" size={18} color={activeFilterCount > 0 ? '#fff' : '#FF6835'} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Chips filtres actifs */}
        {activeFilterCount > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activeRow}>
            {filters.nearMe && (
              <View style={styles.activeChip}>
                <Feather name="navigation" size={11} color="#FF6835" />
                <Text style={styles.activeChipText}>Près de moi · {filters.distanceKm} km</Text>
              </View>
            )}
            {filters.disponibilite && (
              <View style={styles.activeChip}>
                <Feather name="clock" size={11} color="#FF6835" />
                <Text style={styles.activeChipText}>
                  {DISPONIBILITES.find(d => d.id === filters.disponibilite)?.label}
                  {filters.disponibilite === 'until_hour' ? ` · ${filters.untilHour}` : ''}
                </Text>
              </View>
            )}
            {filters.localisation ? (
              <View style={styles.activeChip}>
                <Feather name="map-pin" size={11} color="#FF6835" />
                <Text style={styles.activeChipText}>{filters.localisation}</Text>
              </View>
            ) : null}
            {filters.minRating !== null && (
              <View style={styles.activeChip}>
                <Text style={{ fontSize: 11 }}>⭐</Text>
                <Text style={styles.activeChipText}>{filters.minRating}+ étoiles</Text>
              </View>
            )}
            {filters.maxPrice !== null && (
              <View style={styles.activeChip}>
                <Feather name="tag" size={11} color="#FF6835" />
                <Text style={styles.activeChipText}>Max {filters.maxPrice.toLocaleString('fr-FR')} F</Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.clearChip}
              onPress={() => { setFilters(DEFAULT_FILTERS); setHasSearched(false); }}
            >
              <Text style={styles.clearChipText}>Tout effacer</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>

      {/* ── Résultats ou Catégories ── */}
      {showResults ? (
        isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color="#FF6835" size="large" />
          </View>
        ) : (
          <FlatList
            data={businesses}
            keyExtractor={(b) => b.id}
            contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
            renderItem={({ item }) => <BusinessCard business={item} style={styles.card} />}
            ListHeaderComponent={
              businesses.length > 0 ? (
                <Text style={styles.resultsCount}>
                  {businesses.length} résultat{businesses.length > 1 ? 's' : ''}
                  {selectedCategory ? ` · ${SECTEURS.find(s => s.id === selectedCategory)?.label}` : ''}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.empty}>
                <Feather name="search" size={44} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>Aucun résultat</Text>
                <Text style={styles.emptyText}>Essayez d'autres mots-clés ou ajustez vos filtres.</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={clearSearch}>
                  <Text style={styles.emptyBtnText}>Réinitialiser</Text>
                </TouchableOpacity>
              </View>
            }
          />
        )
      ) : (
        // ── Grille catégories ──
        <ScrollView
          contentContainerStyle={[styles.catGrid, { paddingBottom: botPad + 80 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.catGridTitle}>Explorer par catégorie</Text>
          <View style={styles.catGridWrap}>
            {SECTEURS.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.catCard}
                onPress={() => { setSelectedCategory(s.id); setHasSearched(true); }}
                activeOpacity={0.8}
              >
                <Text style={styles.catEmoji}>{s.emoji}</Text>
                <Text style={styles.catCardLabel}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* ── Modal filtres ── */}
      <Modal
        visible={filterVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setFilterVisible(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtres</Text>
            <TouchableOpacity onPress={() => setTempFilters(DEFAULT_FILTERS)}>
              <Text style={styles.resetText}>Réinitialiser</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* ── Distance ── */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Distance</Text>

              <TouchableOpacity
                style={[styles.toggleRow, tempFilters.nearMe && styles.toggleRowActive]}
                onPress={() => setTempFilters((f) => ({ ...f, nearMe: !f.nearMe }))}
                activeOpacity={0.8}
              >
                <View style={styles.toggleLeft}>
                  <Feather name="navigation" size={16} color={tempFilters.nearMe ? '#FF6835' : '#6B7280'} />
                  <View>
                    <Text style={[styles.toggleTitle, tempFilters.nearMe && { color: '#FF6835' }]}>
                      Près de moi
                    </Text>
                    <Text style={styles.toggleSub}>Utiliser ma position GPS</Text>
                  </View>
                </View>
                <View style={[styles.checkbox, tempFilters.nearMe && styles.checkboxActive]}>
                  {tempFilters.nearMe && <Feather name="check" size={12} color="#fff" />}
                </View>
              </TouchableOpacity>

              {/* Barre de distance */}
              <View style={styles.sliderSection}>
                <Text style={styles.sliderSubLabel}>Rayon de recherche</Text>
                <Slider
                  value={tempFilters.distanceKm}
                  min={1}
                  max={MAX_KM}
                  onChange={(v) => setTempFilters((f) => ({ ...f, distanceKm: v }))}
                  formatLabel={formatKm}
                />
              </View>
            </View>

            {/* ── Disponibilité ── */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Disponibilité</Text>
              <View style={styles.dispoGrid}>
                {DISPONIBILITES.map((d) => {
                  const active = tempFilters.disponibilite === d.id;
                  return (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.dispoCard, active && styles.dispoCardActive]}
                      onPress={() => setTempFilters((f) => ({
                        ...f,
                        disponibilite: f.disponibilite === d.id ? null : d.id,
                      }))}
                      activeOpacity={0.8}
                    >
                      <Feather name={d.icon as any} size={18} color={active ? '#FF6835' : '#9CA3AF'} />
                      <Text style={[styles.dispoLabel, active && { color: '#FF6835' }]}>{d.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Champ heure si "jusqu'à une heure" sélectionné */}
              {tempFilters.disponibilite === 'until_hour' && (
                <View style={styles.hourRow}>
                  <Feather name="clock" size={16} color="#FF6835" />
                  <Text style={styles.hourLabel}>Ouvert jusqu'à</Text>
                  <TextInput
                    style={styles.hourInput}
                    value={tempFilters.untilHour}
                    onChangeText={(t) => setTempFilters((f) => ({ ...f, untilHour: t }))}
                    placeholder="22:00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numbers-and-punctuation"
                    maxLength={5}
                  />
                </View>
              )}
            </View>

            {/* ── Localisation ── */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Localisation</Text>
              <View style={styles.locRow}>
                <Feather name="map-pin" size={16} color="#9CA3AF" style={styles.locIcon} />
                <TextInput
                  style={styles.locInput}
                  value={tempFilters.localisation}
                  onChangeText={(t) => setTempFilters((f) => ({ ...f, localisation: t }))}
                  placeholder="Quartier, ville, adresse…"
                  placeholderTextColor="#9CA3AF"
                  returnKeyType="done"
                />
                {tempFilters.localisation.length > 0 && (
                  <TouchableOpacity
                    onPress={() => setTempFilters((f) => ({ ...f, localisation: '' }))}
                    hitSlop={8}
                  >
                    <Feather name="x-circle" size={16} color="#C4C9D4" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* ── Recommandation (note) ── */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Recommandation</Text>
              <View style={styles.ratingGrid}>
                {[
                  { label: 'Toutes', value: null },
                  { label: '0 - 3 ★', value: 0 },
                  { label: '3 ★+', value: 3 },
                  { label: '3.5 ★+', value: 3.5 },
                  { label: '4 ★+', value: 4 },
                  { label: '4.5 ★+', value: 4.5 },
                  { label: '5 ★', value: 5 },
                ].map((r) => {
                  const active = tempFilters.minRating === r.value;
                  return (
                    <TouchableOpacity
                      key={String(r.value)}
                      style={[styles.ratingChip, active && styles.ratingChipActive]}
                      onPress={() => setTempFilters((f) => ({ ...f, minRating: r.value }))}
                    >
                      <Text style={[styles.ratingChipText, active && { color: '#FF6835' }]}>
                        {r.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* ── Budget ── */}
            <View style={[styles.filterSection, { marginBottom: 8 }]}>
              <Text style={styles.filterLabel}>Budget maximum</Text>
              <View style={styles.sliderSection}>
                <Slider
                  value={tempFilters.maxPrice ?? MAX_PRICE}
                  min={0}
                  max={MAX_PRICE}
                  onChange={(v) => setTempFilters((f) => ({
                    ...f,
                    maxPrice: v >= MAX_PRICE ? null : v,
                  }))}
                  formatLabel={formatPrice}
                />
                {(tempFilters.maxPrice ?? MAX_PRICE) >= MAX_PRICE && (
                  <Text style={styles.unlimitedNote}>Aucune limite de prix appliquée</Text>
                )}
              </View>
            </View>
          </ScrollView>

          {/* Bouton appliquer */}
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

  header: {
    backgroundColor: '#fff', paddingHorizontal: 20,
    paddingBottom: 14, paddingTop: 8, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 4,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },

  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },

  filterBtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: '#FDDCCA', position: 'relative',
  },
  filterBtnActive: { backgroundColor: '#FF6835', borderColor: '#FF6835' },
  filterBadge: {
    position: 'absolute', top: -5, right: -5,
    backgroundColor: '#111827', borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  filterBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },

  activeRow: { gap: 8, paddingVertical: 2 },
  activeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FEF2EC', borderRadius: 100,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#FDDCCA',
  },
  activeChipText: { fontSize: 12, fontWeight: '600', color: '#FF6835' },
  clearChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100, borderWidth: 1, borderColor: '#E5E7EB' },
  clearChipText: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },

  list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  card: {},
  resultsCount: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  emptyBtn: { backgroundColor: '#FF6835', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  catGrid: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  catGridTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  catGridWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  catCard: {
    width: '47%', backgroundColor: '#fff', borderRadius: 16,
    paddingVertical: 20, paddingHorizontal: 14,
    alignItems: 'center', gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  catEmoji: { fontSize: 30 },
  catCardLabel: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, maxHeight: '90%', gap: 16,
  },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  resetText: { fontSize: 14, fontWeight: '600', color: '#FF6835' },

  filterSection: { gap: 12, marginBottom: 24 },
  filterLabel: { fontSize: 13, fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.5 },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  toggleRowActive: { backgroundColor: '#FEF2EC', borderColor: '#FDDCCA' },
  toggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  toggleSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  checkbox: {
    width: 24, height: 24, borderRadius: 7,
    borderWidth: 2, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: { backgroundColor: '#FF6835', borderColor: '#FF6835' },

  sliderSection: { gap: 8, paddingHorizontal: 4 },
  sliderSubLabel: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
  unlimitedNote: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', fontStyle: 'italic' },

  // Disponibilité
  dispoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  dispoCard: {
    flex: 1, minWidth: '44%', alignItems: 'center', gap: 6,
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  dispoCardActive: { backgroundColor: '#FEF2EC', borderColor: '#FDDCCA' },
  dispoLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', textAlign: 'center' },

  hourRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FEF2EC', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#FDDCCA',
  },
  hourLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  hourInput: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14,
    paddingVertical: 8, fontSize: 16, fontWeight: '700', color: '#FF6835',
    borderWidth: 1.5, borderColor: '#FDDCCA', minWidth: 70, textAlign: 'center',
  },

  // Localisation
  locRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  locIcon: {},
  locInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },

  // Recommandation
  ratingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ratingChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 100, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  ratingChipActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  ratingChipText: { fontSize: 13, fontWeight: '600', color: '#6B7280' },

  applyBtn: { backgroundColor: '#FF6835', borderRadius: 14, padding: 16, alignItems: 'center' },
  applyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
