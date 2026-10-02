// app/(pro)/dashboard.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Image, Modal, Platform,
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { useMyBusinesses } from '@/hooks/useBusinesses';
import { supabase } from '@/lib/supabase';

const { width: W } = Dimensions.get('window');
const ORANGE  = '#FF6835';
const DARK    = '#1A1025';
const CARD3_W = (W - 52) / 2 + 16; // 2 cartes + aperçu 16px de la 3e

type Period   = 'week' | 'month' | 'year';
interface Business { id: string; name: string; }

function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}
function fmt(n: number) { return n.toLocaleString('fr-FR', { maximumFractionDigits: 0 }); }

function getRange(p: Period) {
  const now = new Date(); const from = new Date(); const pF = new Date(); const pT = new Date();
  if (p === 'week')  { from.setDate(now.getDate()-7);  pF.setDate(now.getDate()-14); pT.setDate(now.getDate()-7); }
  if (p === 'month') { from.setDate(1); from.setHours(0,0,0,0); pF.setMonth(now.getMonth()-1); pF.setDate(1); pF.setHours(0,0,0,0); pT.setDate(1); pT.setHours(0,0,0,0); }
  if (p === 'year')  { from.setFullYear(now.getFullYear(),0,1); from.setHours(0,0,0,0); pF.setFullYear(now.getFullYear()-1,0,1); pT.setFullYear(now.getFullYear(),0,1); }
  return { from, prevFrom: pF, prevTo: pT };
}

function KpiCard({ icon, label, sub, value, pctVal, color, bg }: {
  icon: string; label: string; sub: string; value: number; pctVal: number; color: string; bg: string;
}) {
  const pos = pctVal > 0;
  const zero = pctVal === 0;
  return (
    <View style={[s.kpiCard, { width: CARD3_W }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={[s.kpiIcon, { backgroundColor: bg }]}>
          <Feather name={icon as any} size={18} color={color} />
        </View>
        <Text style={[s.kpiPct, { color: zero ? '#9CA3AF' : pos ? '#22C55E' : '#EF4444' }]}>
          {zero ? '0 %' : pos ? `+${pctVal} %` : `${pctVal} %`}
        </Text>
      </View>
      <Text style={s.kpiVal}>{fmt(value)}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiSub}>{sub}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [period, setPeriod] = useState<Period>('month');
  const [filterBiz, setFilterBiz] = useState<string | null>(null);
  const [bizPickerOpen, setBizPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: businesses = [] } = useMyBusinesses(profile?.id ?? '');

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notif-count', profile?.id],
    queryFn: async () => {
      try {
        const { count } = await supabase.from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', profile!.id).eq('is_read', false);
        return count ?? 0;
      } catch { return 0; }
    },
    enabled: !!profile?.id, staleTime: 30_000,
  });

  const bizIds = useMemo(
    () => filterBiz ? [filterBiz] : businesses.map((b: Business) => b.id),
    [filterBiz, businesses]
  );
  const { from, prevFrom, prevTo } = getRange(period);

  const { data: curr, isLoading } = useQuery({
    queryKey: ['dash-curr', bizIds.join(','), period],
    queryFn: async () => {
      if (!bizIds.length) return null;
      const [orders, bookings, reviews] = await Promise.all([
        supabase.from('orders').select('id,total_amount,created_at')
          .in('business_id', bizIds).gte('created_at', from.toISOString()).neq('status', 'cancelled'),
        supabase.from('bookings').select('id,created_at')
          .in('business_id', bizIds).gte('created_at', from.toISOString()),
        supabase.from('reviews').select('id,rating,created_at')
          .in('business_id', bizIds).gte('created_at', from.toISOString()),
      ]);
      const ol = orders.data ?? [];
      const bl = bookings.data ?? [];
      const rl = reviews.data ?? [];
      const revenue = ol.reduce((acc: number, o: any) => acc + (o.total_amount ?? 0), 0);
      const dayMap: Record<string, number> = {};
      ol.forEach((o: any) => {
        const d = o.created_at?.slice(0, 10) ?? '';
        dayMap[d] = (dayMap[d] ?? 0) + (o.total_amount ?? 0);
      });
      return { revenue, orders: ol.length, bookings: bl.length, reviews: rl.length, views: 0, dayMap };
    },
    staleTime: 60_000, enabled: bizIds.length > 0,
  });

  const { data: prev } = useQuery({
    queryKey: ['dash-prev', bizIds.join(','), period],
    queryFn: async () => {
      if (!bizIds.length) return null;
      const [orders, bookings, reviews] = await Promise.all([
        supabase.from('orders').select('id,total_amount').in('business_id', bizIds)
          .gte('created_at', prevFrom.toISOString()).lt('created_at', prevTo.toISOString()).neq('status', 'cancelled'),
        supabase.from('bookings').select('id').in('business_id', bizIds)
          .gte('created_at', prevFrom.toISOString()).lt('created_at', prevTo.toISOString()),
        supabase.from('reviews').select('id').in('business_id', bizIds)
          .gte('created_at', prevFrom.toISOString()).lt('created_at', prevTo.toISOString()),
      ]);
      return {
        revenue: (orders.data ?? []).reduce((acc: number, o: any) => acc + (o.total_amount ?? 0), 0),
        orders: orders.data?.length ?? 0,
        bookings: bookings.data?.length ?? 0,
        reviews: reviews.data?.length ?? 0,
      };
    },
    staleTime: 60_000, enabled: bizIds.length > 0,
  });

  const { data: activity = [] } = useQuery({
    queryKey: ['activity', bizIds.join(',')],
    queryFn: async () => {
      if (!bizIds.length) return [];
      const [orders, bookings] = await Promise.all([
        supabase.from('orders').select('id,status,created_at,total_amount')
          .in('business_id', bizIds).order('created_at', { ascending: false }).limit(3),
        supabase.from('bookings').select('id,status,created_at')
          .in('business_id', bizIds).order('created_at', { ascending: false }).limit(3),
      ]);
      return [
        ...(orders.data ?? []).map((o: any) => ({ icon: 'shopping-bag', label: `Commande #${o.id.slice(-4)}`, sub: o.status, ts: o.created_at })),
        ...(bookings.data ?? []).map((b: any) => ({ icon: 'calendar', label: `Réservation #${b.id.slice(-4)}`, sub: b.status, ts: b.created_at })),
      ].sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime()).slice(0, 5);
    },
    staleTime: 60_000, enabled: bizIds.length > 0,
  });

  const revenue  = curr?.revenue ?? 0;
  const tRev     = pct(revenue, prev?.revenue ?? 0);
  const orders   = curr?.orders ?? 0;
  const tOrd     = pct(orders, prev?.orders ?? 0);
  const bookings = curr?.bookings ?? 0;
  const tBook    = pct(bookings, prev?.bookings ?? 0);
  const reviews  = curr?.reviews ?? 0;
  const tRev2    = pct(reviews, prev?.reviews ?? 0);
  const views    = curr?.views ?? 0;
  const periodLabel = period === 'week' ? 'semaine' : period === 'month' ? 'mois' : 'année';
  const filterLabel = filterBiz ? businesses.find((b: Business) => b.id === filterBiz)?.name ?? 'Boutique' : 'Toutes les boutiques';
  const initials = profile?.name
    ? profile.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'SA';

  const chartData = useMemo(() => {
    const days: number[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(curr?.dayMap?.[d.toISOString().slice(0, 10)] ?? 0);
    }
    return days;
  }, [curr?.dayMap]);
  const chartMax = Math.max(...chartData, 1);

  const last7 = chartData.slice(-7);
  const max7  = Math.max(...last7, 1);

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── Hero sombre ── */}
        <View style={[s.hero, { paddingTop: (Platform.OS === 'ios' ? insets.top : insets.top) + 12 }]}>
          <View style={s.heroNav}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              {profile?.avatar_url
                ? <Image source={{ uri: profile.avatar_url }} style={s.avatar} />
                : <View style={s.avatar}><Text style={s.avatarTxt}>{initials}</Text></View>}
              <View>
                <Text style={s.helloTxt}>Bonjour,</Text>
                <Text style={s.nameTxt}>{profile?.name ?? 'Marchand'}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity style={s.exportBtn} onPress={() => router.navigate('/(pro)/notifications' as any)}>
                {(unreadCount as number) > 0 && (
                  <View style={{ position: 'absolute', top: 4, right: 4, width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', zIndex: 1 }} />
                )}
                <Feather name="bell" size={16} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={s.exportBtn} onPress={() => setMenuOpen(true)}>
                <Feather name="menu" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.revenueRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.revLabel}>Chiffre d'affaires</Text>
              <Text style={s.revAmt}>{fmt(revenue)}<Text style={s.revCur}> FCFA</Text></Text>
              <View style={s.pctBadge}>
                <Text style={s.pctBadgeTxt}>{tRev >= 0 ? `+${tRev}` : tRev}%</Text>
              </View>
              <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 4 }}>sur la période</Text>
            </View>
            <View style={s.miniChart}>
              {last7.map((v, i) => (
                <View key={i} style={[s.miniBar, {
                  height: Math.max(4, (v / max7) * 44),
                  backgroundColor: i === 6 ? ORANGE : 'rgba(255,255,255,0.22)',
                }]} />
              ))}
            </View>
          </View>
        </View>

        {/* ── Carte filtre & période ── */}
        <View style={s.floatingCard}>
          <TouchableOpacity style={s.bizPicker} onPress={() => setBizPickerOpen(!bizPickerOpen)}>
            <View style={[s.bizPickerIcon, { backgroundColor: '#FEF2EC' }]}>
              <Feather name="shopping-bag" size={16} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.bizPickerSup}>VUE ACTUELLE</Text>
              <Text style={s.bizPickerLabel}>{filterLabel}</Text>
            </View>
            <Feather name={bizPickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#6B7280" />
          </TouchableOpacity>
          {bizPickerOpen && (
            <View style={s.bizDropdown}>
              <TouchableOpacity style={[s.bizOption, !filterBiz && s.bizOptionActive]}
                onPress={() => { setFilterBiz(null); setBizPickerOpen(false); }}>
                <Text style={[s.bizOptionTxt, !filterBiz && { color: ORANGE, fontWeight: '700' }]}>Toutes les boutiques</Text>
                {!filterBiz && <Feather name="check" size={14} color={ORANGE} />}
              </TouchableOpacity>
              {businesses.map((b: Business) => (
                <TouchableOpacity key={b.id} style={[s.bizOption, filterBiz === b.id && s.bizOptionActive]}
                  onPress={() => { setFilterBiz(b.id); setBizPickerOpen(false); }}>
                  <Text style={[s.bizOptionTxt, filterBiz === b.id && { color: ORANGE, fontWeight: '700' }]}>{b.name}</Text>
                  {filterBiz === b.id && <Feather name="check" size={14} color={ORANGE} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
          <View style={s.periodRow}>
            {(['week', 'month', 'year'] as Period[]).map((p, i) => {
              const labels = ['Semaine', 'Mois', 'Année'];
              return (
                <TouchableOpacity key={p} style={[s.periodBtn, period === p && s.periodBtnActive]} onPress={() => setPeriod(p)}>
                  <Text style={[s.periodTxt, period === p && { color: '#111827', fontWeight: '700' }]}>{labels[i]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Contenu ── */}
        <View style={{ gap: 20, paddingTop: 20 }}>
          {/* Section KPI */}
          <View style={{ paddingHorizontal: 20, gap: 6 }}>
            <Text style={s.sectionSup}>VUE D'ENSEMBLE</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.sectionTitle}>Performance du {periodLabel}</Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF' }}>Mis à jour à l'instant</Text>
            </View>
          </View>

          {isLoading ? <ActivityIndicator color={ORANGE} style={{ padding: 20 }} /> : (<>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 6 }}
              snapToInterval={CARD3_W + 12} decelerationRate="fast">
              <KpiCard icon="shopping-bag" label="Commandes" sub="Total période" value={orders} pctVal={tOrd} color="#FF6835" bg="#FEF2EC" />
              <KpiCard icon="users" label="Clients" sub="Clients uniques" value={0} pctVal={0} color="#7C3AED" bg="#F5F3FF" />
              <KpiCard icon="star" label="Avis clients" sub="Avis reçus" value={reviews} pctVal={tRev2} color="#F59E0B" bg="#FFFBEB" />
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 12, paddingHorizontal: 20, paddingBottom: 6 }}
              snapToInterval={CARD3_W + 12} decelerationRate="fast">
              <KpiCard icon="trending-up" label="Ventes total" sub="Ce mois-ci" value={orders} pctVal={tOrd} color="#059669" bg="#F0FDF4" />
              <KpiCard icon="calendar" label="Réservations total" sub="Total période" value={bookings} pctVal={tBook} color="#3B82F6" bg="#EFF6FF" />
              <KpiCard icon="eye" label="Trafic boutique" sub="Vues totales" value={views} pctVal={0} color="#8B5CF6" bg="#F5F3FF" />
            </ScrollView>
          </>)}

          {/* Graphe évolution */}
          <View style={[s.chartCard, { marginHorizontal: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <Text style={s.chartTitle}>Évolution des ventes</Text>
                <Text style={s.chartSub}>Mois en cours</Text>
              </View>
              <View style={s.realtimeBadge}><Text style={s.realtimeTxt}>Temps réel</Text></View>
            </View>
            <View style={{ height: 90, marginTop: 12, position: 'relative', justifyContent: 'flex-end' }}>
              {[0.75, 0.5, 0.25].map((h, i) => (
                <View key={i} style={{ position: 'absolute', left: 0, right: 0, top: 90 * (1 - h), borderTopWidth: 1, borderTopColor: '#F3F4F6' }} />
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 2 }}>
                {chartData.map((v, i) => (
                  <View key={i} style={{ flex: 1, height: Math.max(2, (v / chartMax) * 80), backgroundColor: ORANGE + '55', borderRadius: 2 }} />
                ))}
              </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              {['01', '08', '15', '22', '30'].map(d => (
                <Text key={d} style={{ fontSize: 11, color: '#9CA3AF', fontWeight: '600' }}>{d}</Text>
              ))}
            </View>
          </View>

          {/* Activité récente */}
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={s.sectionTitle}>Activité récente</Text>
              <TouchableOpacity><Text style={{ fontSize: 14, fontWeight: '600', color: ORANGE }}>Tout voir</Text></TouchableOpacity>
            </View>
            {activity.length === 0 ? (
              <View style={s.emptyCard}>
                <View style={s.emptyIcon}><Feather name="file-text" size={20} color="#D1D5DB" /></View>
                <View>
                  <Text style={s.emptyTitle}>Aucune activité récente</Text>
                  <Text style={s.emptySub}>Les nouvelles commandes apparaîtront ici.</Text>
                </View>
              </View>
            ) : activity.map((item: any, i: number) => (
              <View key={i} style={s.actRow}>
                <View style={s.actIcon}><Feather name={item.icon} size={16} color="#6B7280" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{item.label}</Text>
                  <Text style={{ fontSize: 12, color: '#9CA3AF' }}>{item.sub}</Text>
                </View>
                <Text style={{ fontSize: 11, color: '#9CA3AF' }}>{new Date(item.ts).toLocaleDateString('fr-FR')}</Text>
              </View>
            ))}
          </View>

          {/* Créer boutique */}
          <TouchableOpacity style={s.createBizBtn}
            onPress={() => router.push('/(pro)/register/step1' as any)} activeOpacity={0.88}>
            <View style={s.createBizIcon}><Feather name="plus" size={20} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>Créer une nouvelle boutique</Text>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1 }}>Développez votre activité</Text>
            </View>
            <Feather name="chevron-right" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Modal menu bottom sheet ── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} activeOpacity={1}
          onPress={() => setMenuOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={s.menuSheet}>
            <View style={s.menuHandle} />
            {[
              { icon: 'user', emoji: '👤', label: 'Espace Client',
                sub: 'Accéder à votre espace client',
                onPress: () => { setMenuOpen(false); router.navigate('/(client)' as any); } },
              { icon: 'download', emoji: '📊', label: 'Télécharger vos rapports',
                sub: 'Exporter ventes, commandes et finances',
                onPress: () => { setMenuOpen(false); Alert.alert('Bientôt disponible', 'Le téléchargement des rapports sera disponible prochainement.'); } },
              { icon: 'help-circle', emoji: '❓', label: 'Aide',
                sub: 'FAQ, support et contact',
                onPress: () => { setMenuOpen(false); Alert.alert('Aide', 'Contactez-nous sur support@bymoh.app'); } },
            ].map((item, i) => (
              <TouchableOpacity key={i} style={[s.menuItem, i > 0 && { borderTopWidth: 1, borderTopColor: '#F3F4F6' }]}
                onPress={item.onPress} activeOpacity={0.8}>
                <View style={s.menuIconWrap}>
                  <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.menuLabel}>{item.label}</Text>
                  <Text style={s.menuSub}>{item.sub}</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  hero:           { backgroundColor: DARK, paddingHorizontal: 20, paddingBottom: 72 },
  heroNav:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  avatar:         { width: 44, height: 44, borderRadius: 22, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  avatarTxt:      { fontSize: 16, fontWeight: '800', color: '#fff' },
  helloTxt:       { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  nameTxt:        { fontSize: 18, fontWeight: '800', color: '#fff' },
  exportBtn:      { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  revenueRow:     { flexDirection: 'row', alignItems: 'flex-end', gap: 16 },
  revLabel:       { fontSize: 13, color: 'rgba(255,255,255,0.55)', fontWeight: '600', marginBottom: 4 },
  revAmt:         { fontSize: 44, fontWeight: '900', color: '#fff' },
  revCur:         { fontSize: 20, fontWeight: '700', color: 'rgba(255,255,255,0.65)' },
  pctBadge:       { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4, marginTop: 8 },
  pctBadgeTxt:    { fontSize: 12, fontWeight: '700', color: '#fff' },
  miniChart:      { flexDirection: 'row', alignItems: 'flex-end', gap: 5, paddingBottom: 4 },
  miniBar:        { width: 10, borderRadius: 3 },
  floatingCard:   { marginHorizontal: 16, marginTop: -52, backgroundColor: '#fff', borderRadius: 24, padding: 16, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 20, elevation: 12 },
  bizPicker:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F9FAFB', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#E5E7EB' },
  bizPickerIcon:  { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  bizPickerSup:   { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1 },
  bizPickerLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  bizDropdown:    { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  bizOption:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  bizOptionActive:{ backgroundColor: '#FEF2EC' },
  bizOptionTxt:   { fontSize: 14, color: '#374151' },
  periodRow:      { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 4 },
  periodBtn:      { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  periodBtnActive:{ backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  periodTxt:      { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  sectionSup:     { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.2 },
  sectionTitle:   { fontSize: 20, fontWeight: '800', color: '#111827' },
  kpiCard:        { backgroundColor: '#fff', borderRadius: 20, padding: 16, paddingBottom: 18, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 },
  kpiIcon:        { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  kpiPct:         { fontSize: 13, fontWeight: '700' },
  kpiVal:         { fontSize: 26, fontWeight: '900', color: '#111827', marginTop: 4 },
  kpiLabel:       { fontSize: 14, fontWeight: '700', color: '#374151' },
  kpiSub:         { fontSize: 12, color: '#9CA3AF' },
  chartCard:      { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  chartTitle:     { fontSize: 18, fontWeight: '800', color: '#111827' },
  chartSub:       { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  realtimeBadge:  { backgroundColor: '#F0FDF4', borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: '#BBF7D0' },
  realtimeTxt:    { fontSize: 12, fontWeight: '700', color: '#166534' },
  emptyCard:      { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#F3F4F6' },
  emptyIcon:      { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  emptyTitle:     { fontSize: 14, fontWeight: '700', color: '#374151' },
  emptySub:       { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  actRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14 },
  actIcon:        { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  createBizBtn:   { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#FEF2EC', borderRadius: 18, padding: 16, marginHorizontal: 20, borderWidth: 1, borderColor: '#FDDCCA' },
  createBizIcon:  { width: 44, height: 44, borderRadius: 14, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  menuSheet:      { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  menuHandle:     { width: 36, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  menuItem:       { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  menuIconWrap:   { width: 44, height: 44, borderRadius: 12, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  menuLabel:      { fontSize: 15, fontWeight: '700', color: '#111827' },
  menuSub:        { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
});