import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BusinessCard } from '@/components/business/BusinessCard';
import { useBusinesses } from '@/hooks/useBusinesses';
import { CATEGORIES, ALL_CITIES } from '@/types';

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState('Lomé');

  const { data: businesses = [], isLoading } = useBusinesses({
    city: selectedCity,
    category: category ?? undefined,
    searchQuery: query || undefined,
  });

  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Recherche</Text>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder="Restaurants, artisans, beauté…"
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Feather name="x" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* City filter */}
        <View style={styles.cityRow}>
          <Feather name="map-pin" size={14} color="#FF6835" />
          <FlatList
            horizontal
            data={ALL_CITIES}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.cityChip, selectedCity === item.name && styles.cityChipActive]}
                onPress={() => setSelectedCity(item.name)}
              >
                <Text style={styles.cityEmoji}>{item.flag}</Text>
                <Text style={[styles.cityLabel, selectedCity === item.name && { color: '#FF6835' }]}>
                  {item.name}
                </Text>
              </TouchableOpacity>
            )}
            contentContainerStyle={{ gap: 8 }}
          />
        </View>

        {/* Category filter */}
        <FlatList
          horizontal
          data={[{ id: '', label: 'Tous', icon: 'grid' }, ...CATEGORIES]}
          keyExtractor={(c) => c.id}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const active = (item.id === '' && !category) || item.id === category;
            return (
              <TouchableOpacity
                style={[styles.catChip, active && styles.catChipActive]}
                onPress={() => setCategory(item.id === '' ? null : item.id)}
              >
                <Feather name={item.icon as any} size={13} color={active ? '#fff' : '#6B7280'} />
                <Text style={[styles.catLabel, active && { color: '#fff' }]}>{item.label}</Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
        />
      </View>

      {/* Results */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#FF6835" size="large" />
        </View>
      ) : (
        <FlatList
          data={businesses}
          keyExtractor={(b) => b.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 80 }]}
          renderItem={({ item }) => <BusinessCard business={item} style={styles.card} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="search" size={44} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>Aucun résultat</Text>
              <Text style={styles.emptyText}>Essayez d'autres mots-clés ou une autre ville.</Text>
            </View>
          }
          ListHeaderComponent={
            businesses.length > 0 ? (
              <Text style={styles.resultsCount}>{businesses.length} résultat{businesses.length > 1 ? 's' : ''}</Text>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827' },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cityChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  cityChipActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  cityEmoji: { fontSize: 14 },
  cityLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  catChipActive: { backgroundColor: '#FF6835', borderColor: '#FF6835' },
  catLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  list: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  card: {},
  resultsCount: { fontSize: 13, color: '#6B7280', marginBottom: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151' },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
});
