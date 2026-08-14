import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useBusinessStats, StatPeriod } from '@/hooks/useBusinessStats';
import { useBusiness } from '@/hooks/useBusinesses';
import { isBusinessOpen } from '@/lib/utils';

const PERIODS: { id: StatPeriod; label: string }[] = [
  { id: 'today', label: "Auj." },
  { id: 'week',  label: 'Sem.' },
  { id: 'month', label: 'Mois' },
  { id: 'year',  label: 'An'   },
];

interface Props { businessId: string; }

export function OverviewSection({ businessId }: Props) {
  const [period, setPeriod] = useState<StatPeriod>('month');

  // ✅ Lit DIRECTEMENT depuis le hook — rafraîchi automatiquement après invalidateQueries
  const { data: business, isLoading: bizLoading } = useBusiness(businessId);
  const { data: stats, isLoading: statsLoading }  = useBusinessStats(businessId, period);

  const currentlyOpen = isBusinessOpen(business?.hours);

  const fmtRevenue = (v: number) =>
    v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M F`
    : v >= 1_000   ? `${(v / 1_000).toFixed(0)}k F`
    : `${v} F`;

  const kpis = [
    { icon: 'shopping-bag'   as const, label: 'Commandes',       value: statsLoading ? '…' : String(stats?.orders ?? 0),      color: '#FF6835', bg: '#FEF2EC' },
    { icon: 'calendar'       as const, label: 'Réservations',    value: statsLoading ? '…' : String(stats?.bookings ?? 0),    color: '#1E3A5F', bg: '#EEF2FF' },
    { icon: 'dollar-sign'    as const, label: 'Revenus',         value: statsLoading ? '…' : fmtRevenue(stats?.revenue ?? 0), color: '#22C55E', bg: '#F0FDF4' },
    { icon: 'star'           as const, label: 'Note moy.',       value: statsLoading ? '…' : stats?.rating ? stats.rating.toFixed(1) + ' ★' : '—', color: '#F59E0B', bg: '#FFFBEB' },
    { icon: 'message-circle' as const, label: 'Avis clients',    value: statsLoading ? '…' : String(stats?.reviewCount ?? 0), color: '#8B5CF6', bg: '#F5F3FF' },
    { icon: 'users'          as const, label: 'Clients uniques', value: statsLoading ? '…' : String(stats?.clients ?? 0),     color: '#06B6D4', bg: '#ECFEFF' },
  ];

  if (bizLoading) {
    return <View style={styles.center}><ActivityIndicator color="#FF6835" /></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

      {/* Statut en temps réel */}
      <View style={[styles.statusRow, currentlyOpen ? styles.statusOpen : styles.statusClosed]}>
        <View style={[styles.statusDot, { backgroundColor: currentlyOpen ? '#22C55E' : '#9CA3AF' }]} />
        <Text style={[styles.statusText, { color: currentlyOpen ? '#166534' : '#4B5563' }]}>
          {currentlyOpen ? '✅ Boutique ouverte maintenant' : '🔴 Boutique fermée maintenant'}
        </Text>
        {business?.is_verified && (
          <View style={styles.verifiedBadge}>
            <Feather name="check-circle" size={12} color="#1E3A5F" />
            <Text style={styles.verifiedText}>Vérifiée</Text>
          </View>
        )}
      </View>

      {/* 🔍 Debug — retire ce bloc une fois que ça marche */}
      <View style={styles.debugBox}>
        <Text style={styles.debugText}>
          Horaires en mémoire : {business?.hours?.length ?? 0} jours{'\n'}
          Jour JS aujourd'hui : {new Date().getDay()} ({['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][new Date().getDay()]}){'\n'}
          Heure : {new Date().getHours()}:{String(new Date().getMinutes()).padStart(2,'0')}{'\n'}
          {business?.hours?.map((h: any) => `${h.day_of_week}|${h.open_time}-${h.close_time}|closed:${h.is_closed}`).join('\n')}
        </Text>
      </View>

      {/* Période */}
      <View style={styles.periodRow}>
        <Text style={styles.periodLabel}>Statistiques</Text>
        <View style={styles.periodPills}>
          {PERIODS.map((p) => (
            <TouchableOpacity key={p.id} style={[styles.periodPill, period === p.id && styles.periodPillActive]} onPress={() => setPeriod(p.id)}>
              <Text style={[styles.periodPillText, period === p.id && styles.periodPillTextActive]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* KPIs */}
      {statsLoading ? (
        <View style={styles.loadingWrap}><ActivityIndicator color="#FF6835" /><Text style={styles.loadingText}>Chargement…</Text></View>
      ) : (
        <View style={styles.kpiGrid}>
          {kpis.map((k) => (
            <View key={k.label} style={[styles.kpiCard, { backgroundColor: k.bg }]}>
              <View style={[styles.kpiIcon, { backgroundColor: k.color + '22' }]}>
                <Feather name={k.icon} size={18} color={k.color} />
              </View>
              <Text style={[styles.kpiValue, { color: k.color }]}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.activityCard}>
        <Text style={styles.activityTitle}>Activité récente</Text>
        <View style={styles.activityEmpty}>
          <Feather name="activity" size={28} color="#E5E7EB" />
          <Text style={styles.activityEmptyText}>Aucune activité pour le moment</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll:           { padding: 20, gap: 16, paddingBottom: 100 },
  statusRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  statusOpen:       { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  statusClosed:     { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  statusDot:        { width: 8, height: 8, borderRadius: 4 },
  statusText:       { flex: 1, fontSize: 13, fontWeight: '600' },
  verifiedBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EEF2FF', borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
  verifiedText:     { fontSize: 11, fontWeight: '700', color: '#1E3A5F' },
  debugBox:         { backgroundColor: '#111', borderRadius: 10, padding: 12 },
  debugText:        { fontSize: 10, color: '#00FF88', fontFamily: 'monospace', lineHeight: 16 },
  periodRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodLabel:      { fontSize: 16, fontWeight: '800', color: '#111827' },
  periodPills:      { flexDirection: 'row', gap: 4, backgroundColor: '#F3F4F6', borderRadius: 100, padding: 3 },
  periodPill:       { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  periodPillActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  periodPillText:   { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  periodPillTextActive: { color: '#111827' },
  loadingWrap:      { alignItems: 'center', gap: 8, paddingVertical: 32 },
  loadingText:      { fontSize: 13, color: '#9CA3AF' },
  kpiGrid:          { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpiCard:          { width: '47%', borderRadius: 16, padding: 14, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  kpiIcon:          { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  kpiValue:         { fontSize: 22, fontWeight: '800' },
  kpiLabel:         { fontSize: 12, color: '#6B7280' },
  activityCard:     { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  activityTitle:    { fontSize: 15, fontWeight: '700', color: '#111827' },
  activityEmpty:    { alignItems: 'center', gap: 8, paddingVertical: 16 },
  activityEmptyText: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});
