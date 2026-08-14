import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useBusinessCatalog } from '@/hooks/useBusinesses';

interface Props { businessId: string; }

export function CatalogSection({ businessId }: Props) {
  const { data: items = [], isLoading } = useBusinessCatalog(businessId);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FF6835" />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Catalogue ({items.length})</Text>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push({ pathname: '/(pro)/catalog/edit' as any, params: { businessId } })}
          activeOpacity={0.85}
        >
          <Feather name="plus" size={14} color="#fff" />
          <Text style={styles.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyEmoji}>📦</Text>
          <Text style={styles.emptyTitle}>Catalogue vide</Text>
          <Text style={styles.emptySub}>Ajoutez vos premiers articles ou prestations.</Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => router.push({ pathname: '/(pro)/catalog/edit' as any, params: { businessId } })}
          >
            <Feather name="plus" size={14} color="#FF6835" />
            <Text style={styles.emptyBtnText}>Ajouter un article</Text>
          </TouchableOpacity>
        </View>
      ) : (
        items.map((item: any) => (
          <View key={item.id} style={styles.card}>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <View style={[styles.availDot, { backgroundColor: item.is_available ? '#22C55E' : '#E5E7EB' }]} />
              </View>
              {item.description ? (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
              ) : null}
              {item.price ? (
                <Text style={styles.cardPrice}>
                  {item.price.toLocaleString('fr-FR')} {item.currency ?? 'FCFA'}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.editBtn}>
              <Feather name="edit-2" size={14} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, gap: 12, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF6835', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyWrap: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2EC', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, borderWidth: 1, borderColor: '#FDDCCA', marginTop: 4 },
  emptyBtnText: { fontSize: 14, fontWeight: '600', color: '#FF6835' },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  cardBody: { flex: 1, gap: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#111827' },
  availDot: { width: 8, height: 8, borderRadius: 4 },
  cardDesc: { fontSize: 12, color: '#9CA3AF', lineHeight: 18 },
  cardPrice: { fontSize: 13, fontWeight: '700', color: '#22C55E' },
  editBtn: { padding: 8 },
});
