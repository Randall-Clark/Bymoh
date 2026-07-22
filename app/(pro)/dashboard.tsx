import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { formatPrice } from '@/lib/utils';

interface Stats {
  orders: number;
  bookings: number;
  revenue: number;
  businesses: number;
}

export default function ProDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const { data: businesses = [], isLoading } = useQuery({
    queryKey: ['pro-businesses', profile?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('id, name, is_active, is_verified')
        .eq('owner_id', profile?.id ?? '');
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.id,
    staleTime: 30_000,
  });

  const hasBusinesses = businesses.length > 0;

  const stats: Stats = {
    orders: 0,
    bookings: 0,
    revenue: 0,
    businesses: businesses.length,
  };

  const STAT_CARDS = [
    { icon: 'shopping-bag', label: 'Commandes',      value: stats.orders.toString(),    color: '#FF6835' },
    { icon: 'calendar',     label: 'Réservations',   value: stats.bookings.toString(),   color: '#1E3A5F' },
    { icon: 'trending-up',  label: 'Revenus du mois',value: formatPrice(stats.revenue),  color: '#22C55E' },
    { icon: 'briefcase',    label: 'Commerces',      value: stats.businesses.toString(), color: '#F59E0B' },
  ];

  const QUICK_ACTIONS = [
    { icon: 'plus-circle',  label: 'Ajouter un commerce',  onPress: () => router.push('/(pro)/register/step1' as any) },
    { icon: 'book-open',    label: 'Gérer le catalogue',   onPress: () => router.push('/(pro)/catalog/index' as any) },
    { icon: 'clock',        label: 'Mes horaires',         onPress: () => router.push('/(pro)/hours' as any) },
    { icon: 'list',         label: 'Commandes reçues',     onPress: () => router.push('/(pro)/orders' as any) },
    { icon: 'calendar',     label: 'Réservations',         onPress: () => router.push('/(pro)/bookings' as any) },
    { icon: 'user',         label: 'Profil business',      onPress: () => router.push('/(pro)/profile' as any) },
  ];

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: botPad + 32 },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>Tableau de bord</Text>
          <Text style={styles.subgreeting}>{profile?.name ?? 'Professionnel'}</Text>
        </View>
        <View style={styles.badge}>
          <Feather name="briefcase" size={14} color="#FF6835" />
          <Text style={styles.badgeText}>Pro</Text>
        </View>
      </View>

      {/* ─── Pas encore de commerce ─── */}
      {!isLoading && !hasBusinesses && (
        <View style={styles.emptyContainer}>
          {/* Illustration */}
          <View style={styles.emptyIllustration}>
            <Feather name="briefcase" size={48} color="#FF6835" />
          </View>

          <Text style={styles.emptyTitle}>Vous n'avez pas encore de commerce</Text>
          <Text style={styles.emptySub}>
            Créez votre premier commerce pour accéder à vos statistiques,
            commandes, réservations et bien plus.
          </Text>

          {/* Bouton principal */}
          <TouchableOpacity
            style={styles.createBtn}
            onPress={() => router.push('/(pro)/register/step1' as any)}
            activeOpacity={0.88}
          >
            <Feather name="plus" size={20} color="#fff" />
            <Text style={styles.createBtnText}>Créer votre premier commerce</Text>
          </TouchableOpacity>

          {/* Sous-texte rassurant */}
          <Text style={styles.emptyHint}>
            Inscription en 5 étapes simples
          </Text>
        </View>
      )}

      {/* ─── Commerce(s) existant(s) : stats + actions ─── */}
      {hasBusinesses && (
        <>
          {/* Statistiques */}
          <View style={styles.statsGrid}>
            {STAT_CARDS.map((s) => (
              <View key={s.label} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: `${s.color}18` }]}>
                  <Feather name={s.icon as any} size={20} color={s.color} />
                </View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            ))}
          </View>

          {/* Actions rapides */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Actions rapides</Text>
            <View style={styles.actionsGrid}>
              {QUICK_ACTIONS.map((a) => (
                <TouchableOpacity
                  key={a.label}
                  style={styles.actionCard}
                  onPress={a.onPress}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionIcon}>
                    <Feather name={a.icon as any} size={22} color="#FF6835" />
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  content: { gap: 20 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  subgreeting: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FEF2EC', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100,
  },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#FF6835' },

  // État vide
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    gap: 16,
  },
  emptyIllustration: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#FEF2EC',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20, fontWeight: '800', color: '#111827',
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22,
  },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FF6835',
    paddingHorizontal: 28, paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    shadowColor: '#FF6835',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 6,
  },
  createBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  emptyHint: { fontSize: 13, color: '#9CA3AF' },

  // Stats
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingHorizontal: 20,
  },
  statCard: {
    flex: 1, minWidth: '44%', backgroundColor: '#fff', borderRadius: 16,
    padding: 16, gap: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 12, color: '#9CA3AF' },

  // Actions rapides
  section: { paddingHorizontal: 20, gap: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: {
    flex: 1, minWidth: '44%', backgroundColor: '#fff', borderRadius: 16,
    padding: 16, alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  actionIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center',
  },
  actionLabel: { fontSize: 13, fontWeight: '600', color: '#374151', textAlign: 'center' },
});
