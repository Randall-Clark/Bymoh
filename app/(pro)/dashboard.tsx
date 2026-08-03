import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator, Dimensions, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { useMyBusinesses } from '@/hooks/useBusinesses';
import { buildBusinessTag } from '@/lib/businessTag';
import type { Business } from '@/types';

const { width: W } = Dimensions.get('window');
const CARD_W = (W - 52) / 2;

const QUICK_ACTIONS: {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  color: string;
  route: string | null;
}[] = [
  { icon: 'plus-circle',  label: 'Nouveau\nproduit',    color: '#FF6835', route: '/(pro)/catalog/edit' },
  { icon: 'clock',        label: 'Horaires',            color: '#1E3A5F', route: '/(pro)/hours'        },
  { icon: 'shopping-bag', label: 'Commandes',           color: '#22C55E', route: '/(pro)/orders'       },
  { icon: 'calendar',     label: 'Réservations',        color: '#8B5CF6', route: '/(pro)/bookings'     },
  { icon: 'bar-chart-2',  label: 'Statistiques',        color: '#F59E0B', route: null                  },
  { icon: 'star',         label: 'Avis clients',        color: '#EF4444', route: null                  },
];

export default function ProDashboard() {
  const insets  = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const topPad  = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad  = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data: businesses = [], isLoading } = useMyBusinesses(profile?.id);

  // ── Aucune boutique ───────────────────────────────────────────────────────
  if (!isLoading && businesses.length === 0) {
    return (
      <View style={[styles.root, styles.emptyRoot, { paddingTop: topPad }]}>
        <View style={styles.emptyIcon}>
          <Feather name="briefcase" size={48} color="#E5E7EB" />
        </View>
        <Text style={styles.emptyTitle}>Aucun commerce créé</Text>
        <Text style={styles.emptySub}>
          Créez votre premier commerce pour commencer à vendre sur Bymoh.
        </Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/(pro)/register/step1' as any)}
          activeOpacity={0.88}
        >
          <Feather name="plus" size={18} color="#fff" />
          <Text style={styles.createBtnText}>Créer mon premier commerce</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── KPI data dynamique ────────────────────────────────────────────────────
  const kpiItems = [
    { icon: 'shopping-bag' as const, label: 'Commandes',    value: '0',                          color: '#FF6835', bg: '#FEF2EC' },
    { icon: 'calendar'     as const, label: 'Réservations', value: '0',                          color: '#1E3A5F', bg: '#EEF2FF' },
    { icon: 'dollar-sign'  as const, label: 'Revenus',      value: '0 FCFA',                     color: '#22C55E', bg: '#F0FDF4' },
    { icon: 'briefcase'    as const, label: 'Boutiques',    value: businesses.length.toString(), color: '#F59E0B', bg: '#FFFBEB' },
  ];

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Tableau de bord</Text>
          <Text style={styles.headerSub}>
            Bienvenue, {profile?.name?.split(' ')[0] ?? 'Pro'} 👋
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => router.push('/(pro)/register/step1' as any)}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={20} color="#FF6835" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 80 }]}
      >
        {/* ── KPIs 2×2 ── */}
        <View style={styles.kpiGrid}>
          {kpiItems.map((k) => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: k.bg }]}>
              <View style={[styles.kpiIconWrap, { backgroundColor: k.color + '22' }]}>
                <Feather name={k.icon} size={20} color={k.color} />
              </View>
              <Text style={[styles.kpiValue, { color: k.color }]}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Actions rapides — scroll horizontal ── */}
        <Text style={styles.sectionTitle}>Actions rapides</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsRow}
        >
          {QUICK_ACTIONS.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={styles.actionCard}
              onPress={() => a.route ? router.push(a.route as any) : null}
              activeOpacity={0.8}
            >
              <View style={[styles.actionIcon, { backgroundColor: a.color + '18' }]}>
                <Feather name={a.icon} size={22} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── Mes boutiques ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Mes boutiques</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{businesses.length}</Text>
          </View>
        </View>

        {isLoading ? (
          <ActivityIndicator color="#FF6835" style={{ marginTop: 16 }} />
        ) : (
          businesses.map((biz: Business) => (
            <TouchableOpacity
              key={biz.id}
              style={styles.bizCard}
              onPress={() => router.push({
                pathname: '/(pro)/business' as any,
                params:   { id: biz.id },
              })}
              activeOpacity={0.85}
            >
              {/* Barre statut gauche */}
              <View style={[
                styles.bizStatusBar,
                biz.is_active ? styles.bizStatusActive : styles.bizStatusInactive,
              ]} />

              <View style={styles.bizBody}>
                {/* Nom + tag */}
                <View style={styles.bizNameRow}>
                  <Text style={styles.bizName} numberOfLines={1}>{biz.name}</Text>
                  <Text style={styles.bizTag}>{buildBusinessTag(biz.name, biz.id)}</Text>
                </View>

                <View style={styles.bizMeta}>
                  <Text style={styles.bizCategory}>
                    {biz.category_icon} {biz.category}
                  </Text>
                  {biz.city ? (
                    <View style={styles.bizCityRow}>
                      <Feather name="map-pin" size={11} color="#9CA3AF" />
                      <Text style={styles.bizCity}>{biz.city}</Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.bizRight}>
                <View style={[
                  styles.bizBadge,
                  biz.is_active ? styles.bizBadgeActive : styles.bizBadgeInactive,
                ]}>
                  <Text style={[
                    styles.bizBadgeText,
                    { color: biz.is_active ? '#166534' : '#6B7280' },
                  ]}>
                    {biz.is_active ? 'Actif' : 'Inactif'}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="#D1D5DB" />
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },

  // Empty
  emptyRoot: { alignItems: 'center', justifyContent: 'center', gap: 16, paddingHorizontal: 32 },
  emptyIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  emptySub: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
  createBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FF6835', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 24, marginTop: 8, shadowColor: '#FF6835', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  createBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#111827' },
  headerSub: { fontSize: 14, color: '#9CA3AF', marginTop: 2 },
  addBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#FDDCCA' },

  scroll: { paddingHorizontal: 20, gap: 20 },

  // KPI
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  kpiCard: { width: CARD_W, borderRadius: 18, padding: 16, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  kpiIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 26, fontWeight: '800' },
  kpiLabel: { fontSize: 13, fontWeight: '500', color: '#6B7280' },

  // Section
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  countBadge: { backgroundColor: '#FEF2EC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: '#FF6835' },

  // Actions
  actionsRow: { gap: 12, paddingVertical: 4 },
  actionCard: { alignItems: 'center', gap: 8, width: 80 },
  actionIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center', lineHeight: 15 },

  // Boutiques
  bizCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, overflow: 'hidden' },
  bizStatusBar: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, borderRadius: 4 },
  bizStatusActive: { backgroundColor: '#22C55E' },
  bizStatusInactive: { backgroundColor: '#E5E7EB' },
  bizBody: { flex: 1, gap: 4, paddingLeft: 12 },
  bizNameRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' },
  bizName: { fontSize: 15, fontWeight: '700', color: '#111827', flexShrink: 1 },
  bizTag: { fontSize: 12, fontWeight: '300', color: '#9CA3AF' },
  bizMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bizCategory: { fontSize: 12, color: '#6B7280' },
  bizCityRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bizCity: { fontSize: 12, color: '#9CA3AF' },
  bizRight: { alignItems: 'center', gap: 8 },
  bizBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100 },
  bizBadgeActive: { backgroundColor: '#F0FDF4' },
  bizBadgeInactive: { backgroundColor: '#F3F4F6' },
  bizBadgeText: { fontSize: 11, fontWeight: '600' },
});
