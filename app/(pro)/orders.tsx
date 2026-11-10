// app/(pro)/orders.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Image, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useMyBusinesses } from '@/hooks/useBusinesses';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';

const ORANGE = '#FF6835';
const DARK   = '#111827';

type Tab    = 'orders' | 'bookings';
type Filter = 'all' | 'pending' | 'confirmed' | 'in_progress' | 'delivered' | 'cancelled';

const STATUS_INFO: Record<string, { label:string; color:string; bg:string; dot:string }> = {
  pending:     { label:'En attente',  color:'#F59E0B', bg:'#FEF3C7', dot:'#F59E0B' },
  confirmed:   { label:'Confirmée',   color:'#3B82F6', bg:'#EFF6FF', dot:'#3B82F6' },
  in_progress: { label:'En cours',    color:'#6366F1', bg:'#EEF2FF', dot:'#6366F1' },
  delivered:   { label:'Livrée',      color:'#22C55E', bg:'#F0FDF4', dot:'#22C55E' },
  completed:   { label:'Terminée',    color:'#22C55E', bg:'#F0FDF4', dot:'#22C55E' },
  cancelled:   { label:'Annulée',     color:'#9CA3AF', bg:'#F3F4F6', dot:'#9CA3AF' },
};

const ORDER_FILTERS: [Filter, string][] = [
  ['all','Toutes'], ['pending','En attente'], ['confirmed','Confirmées'],
  ['in_progress','En cours'], ['delivered','Livrées'], ['cancelled','Annulées'],
];

const BOOKING_FILTERS: [string, string][] = [
  ['all','Toutes'], ['pending','En attente'], ['confirmed','Confirmées'],
  ['completed','Terminées'], ['cancelled','Annulées'],
];

const AVATAR_COLORS = [
  '#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7',
  '#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9',
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}
function getAvatarColor(name: string) {
  const idx = name.split('').reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}
function fmtAmount(n: number) {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return n.toLocaleString('fr-FR');
}
function fmtDate(d: string) {
  const date = new Date(d);
  const now  = new Date();
  const diff = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  const time = date.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
  if (diff < 1) return `Aujourd'hui, ${time}`;
  if (diff < 2) return `Hier, ${time}`;
  return `${date.toLocaleDateString('fr-FR', { day:'numeric', month:'short' })}, ${time}`;
}

export default function OrdersTab() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const topPad = (Platform.OS === 'ios' ? insets.top : insets.top) + 12;

  const [activeTab,    setActiveTab]    = useState<Tab>('orders');
  const [bizDropOpen,  setBizDropOpen]  = useState(false);
  const [selectedBiz,  setSelectedBiz]  = useState<string | null>(null);
  const [filter,       setFilter]       = useState<Filter>('all');
  const [bookFilter,   setBookFilter]   = useState('all');
  const [search,       setSearch]       = useState('');

  const { data: businesses = [] } = useMyBusinesses(profile?.id ?? '');
  const allBizIds = (businesses as any[]).map(b => b.id);
  const activeBizIds = selectedBiz ? [selectedBiz] : allBizIds;
  const selectedBizName = selectedBiz
    ? (businesses as any[]).find(b => b.id === selectedBiz)?.name ?? 'Boutique'
    : 'Toutes';

  useRealtimeOrders(allBizIds);

  // ── Commandes ──────────────────────────────────────────────────────────────
  const { data: orders = [], isLoading: ordLoading } = useQuery({
    queryKey: ['pro-orders', activeBizIds.join(',')],
    queryFn: async () => {
      if (!activeBizIds.length) return [];
      const { data } = await supabase
        .from('orders')
        .select('*, user:users(id, name, phone), items:order_items(id, title, quantity, unit_price, service_id)')
        .in('business_id', activeBizIds)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: activeBizIds.length > 0, staleTime: 10_000, refetchOnMount: 'always',
  });

  // ── Réservations ───────────────────────────────────────────────────────────
  const { data: bookings = [], isLoading: bookLoading } = useQuery({
    queryKey: ['pro-bookings', activeBizIds.join(',')],
    queryFn: async () => {
      if (!activeBizIds.length) return [];
      const { data } = await supabase
        .from('bookings')
        .select('*, user:users(id, name, phone), service:services(id, title)')
        .in('business_id', activeBizIds)
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: activeBizIds.length > 0, staleTime: 10_000, refetchOnMount: 'always',
  });

  // ── Counts ────────────────────────────────────────────────────────────────
  const pendingOrders   = orders.filter((o:any) => o.status === 'pending').length;
  const pendingBookings = bookings.filter((b:any) => b.status === 'pending').length;
  const totalPending    = pendingOrders + pendingBookings;

  const q = search.toLowerCase().trim();

  const filteredOrders = orders
    .filter((o:any) => filter === 'all' || o.status === filter)
    .filter((o:any) => {
      if (!q) return true;
      const name  = (o.user?.name ?? '').toLowerCase();
      const items = (o.items ?? []).map((i:any) => (i.title ?? '').toLowerCase()).join(' ');
      return name.includes(q) || items.includes(q);
    });

  const filteredBookings = bookings
    .filter((b:any) => bookFilter === 'all' || b.status === bookFilter)
    .filter((b:any) => {
      if (!q) return true;
      const name    = (b.user?.name ?? '').toLowerCase();
      const service = (b.service?.title ?? '').toLowerCase();
      return name.includes(q) || service.includes(q);
    });

  const currentFilters   = activeTab === 'orders' ? ORDER_FILTERS : BOOKING_FILTERS;
  const currentFilterVal = activeTab === 'orders' ? filter : bookFilter;
  const setCurrentFilter = activeTab === 'orders'
    ? (v: string) => setFilter(v as Filter)
    : setBookFilter;

  return (
    <View style={{ flex:1, backgroundColor:'#F2F2F7' }}>

      {/* ══ Header ══════════════════════════════════════════════════════════════ */}
      <View style={[s.hero, { paddingTop: topPad }]}>

        {/* Ligne 1 : sélecteur | titre | badge */}
        <View style={s.topBar}>
          <TouchableOpacity
            style={s.bizBtn}
            onPress={() => setBizDropOpen(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={s.bizBtnTxt} numberOfLines={1}>{selectedBizName}</Text>
            <Feather name={bizDropOpen ? 'chevron-up' : 'chevron-down'} size={12} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          <Text style={s.topTitle}>Commandes</Text>

          {totalPending > 0 ? (
            <View style={s.notifBadge}>
              <View style={s.notifDot} />
              <Text style={s.notifCount}>{totalPending}</Text>
            </View>
          ) : (
            <View style={s.notifPlaceholder} />
          )}
        </View>

        {/* Dropdown boutiques */}
        {bizDropOpen && (
          <View style={s.bizDropdown}>
            <TouchableOpacity
              style={[s.bizOption, selectedBiz === null && s.bizOptionActive]}
              onPress={() => { setSelectedBiz(null); setBizDropOpen(false); }}
              activeOpacity={0.8}
            >
              <Text style={s.bizOptionTxt}>Toutes les boutiques</Text>
              {selectedBiz === null && <Feather name="check" size={14} color={ORANGE} />}
            </TouchableOpacity>
            {(businesses as any[]).map((b:any) => (
              <TouchableOpacity
                key={b.id}
                style={[s.bizOption, selectedBiz === b.id && s.bizOptionActive]}
                onPress={() => { setSelectedBiz(b.id); setBizDropOpen(false); }}
                activeOpacity={0.8}
              >
                <Text style={s.bizOptionTxt}>{b.name}</Text>
                {selectedBiz === b.id && <Feather name="check" size={14} color={ORANGE} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Onglets Commandes / Réservations */}
        <View style={s.tabRow}>
          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'orders' && s.tabBtnActive]}
            onPress={() => setActiveTab('orders')}
            activeOpacity={0.85}
          >
            <Image
              source={require('@/assets/images/orders_icon.png')}
              style={[s.tabIcon, { tintColor: activeTab === 'orders' ? DARK : 'rgba(255,255,255,0.6)' }]}
              resizeMode="contain"
            />
            <Text style={[s.tabTxt, activeTab === 'orders' && s.tabTxtActive]}>Commandes</Text>
            {pendingOrders > 0 && (
              <View style={s.tabBadge}><Text style={s.tabBadgeTxt}>{pendingOrders}</Text></View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[s.tabBtn, activeTab === 'bookings' && s.tabBtnActive]}
            onPress={() => setActiveTab('bookings')}
            activeOpacity={0.85}
          >
            <Image
              source={require('@/assets/images/reservations_icon.png')}
              style={[s.tabIcon, { tintColor: activeTab === 'bookings' ? DARK : 'rgba(255,255,255,0.6)' }]}
              resizeMode="contain"
            />
            <Text style={[s.tabTxt, activeTab === 'bookings' && s.tabTxtActive]}>Réservations</Text>
            {pendingBookings > 0 && (
              <View style={s.tabBadge}><Text style={s.tabBadgeTxt}>{pendingBookings}</Text></View>
            )}
          </TouchableOpacity>
        </View>

        {/* Filtres pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap:8, paddingBottom:14, paddingTop:2 }}>
          {currentFilters.map(([f, l]) => {
            const count = activeTab === 'orders'
              ? (f === 'all' ? orders.length : orders.filter((o:any) => o.status === f).length)
              : (f === 'all' ? bookings.length : bookings.filter((b:any) => b.status === f).length);
            return (
              <TouchableOpacity key={f}
                style={[s.pill, currentFilterVal === f && s.pillActive]}
                onPress={() => setCurrentFilter(f)}
              >
                <Text style={[s.pillTxt, currentFilterVal === f && s.pillTxtActive]}>
                  {l}{count > 0 ? ` ${count}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ══ Corps ══════════════════════════════════════════════════════════════ */}
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding:16, gap:14, paddingBottom:90 }}>

        {/* Barre de recherche */}
        <View style={s.searchBar}>
          <Feather name="search" size={16} color="#9CA3AF" />
          <TextInput
            style={s.searchInput}
            placeholder={activeTab === 'orders' ? 'Chercher une commande, client…' : 'Chercher une réservation, client…'}
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top:8, bottom:8, left:8, right:8 }}>
              <Feather name="x" size={15} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Liste commandes ── */}
        {activeTab === 'orders' && (
          ordLoading ? (
            <ActivityIndicator color={ORANGE} style={{ padding:40 }} />
          ) : filteredOrders.length === 0 ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}><Feather name="shopping-bag" size={32} color="#D1D5DB" /></View>
              <Text style={s.emptyTxt}>Aucune commande pour l'instant</Text>
            </View>
          ) : filteredOrders.map((order:any) => {
            const st       = STATUS_INFO[order.status] ?? STATUS_INFO['pending'];
            const name     = order.user?.name ?? 'Client';
            const initials = getInitials(name);
            const avatarBg = getAvatarColor(name);
            const items    = (order.items ?? []) as any[];
            const itemsLine = items.slice(0, 2).map((item:any) => {
              return `📦 ${item.title}${item.quantity > 1 ? ` ×${item.quantity}` : ''}`;
            }).join(' · ') + (items.length > 2 ? ` +${items.length - 2}` : '');

            return (
              <TouchableOpacity key={order.id} style={s.card}
                onPress={() => router.navigate({
                  pathname: '/(pro)/orders/[id]',
                  params: { id: order.id },
                } as any)} activeOpacity={0.85}>
                <View style={[s.avatar, { backgroundColor: avatarBg }]}>
                  <Text style={s.avatarTxt}>{initials}</Text>
                </View>
                <View style={{ flex:1, gap:3 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                    <Text style={s.cardName}>{name}</Text>
                    <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                      <View style={[s.statusDot, { backgroundColor: st.dot }]} />
                      <Text style={[s.statusTxt, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  {itemsLine.length > 0 && (
                    <Text style={s.itemsLine} numberOfLines={1}>{itemsLine}</Text>
                  )}
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <Text style={s.idTag}>#{order.id.slice(-6).toUpperCase()}</Text>
                    <Text style={s.dotSep}>·</Text>
                    <Text style={s.amount}>{(order.total_amount ?? order.total ?? 0).toLocaleString('fr-FR')} FCFA</Text>
                    <Text style={s.dotSep}>·</Text>
                    <Text style={s.dateStr}>{fmtDate(order.created_at)}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color="#D1D5DB" style={{ marginLeft:4 }} />
              </TouchableOpacity>
            );
          })
        )}

        {/* ── Liste réservations ── */}
        {activeTab === 'bookings' && (
          bookLoading ? (
            <ActivityIndicator color={ORANGE} style={{ padding:40 }} />
          ) : filteredBookings.length === 0 ? (
            <View style={s.emptyWrap}>
              <View style={s.emptyIcon}><Feather name="calendar" size={32} color="#D1D5DB" /></View>
              <Text style={s.emptyTxt}>Aucune réservation pour l'instant</Text>
            </View>
          ) : filteredBookings.map((book:any) => {
            const st       = STATUS_INFO[book.status] ?? STATUS_INFO['pending'];
            const name     = book.user?.name ?? 'Client';
            const initials = getInitials(name);
            const avatarBg = getAvatarColor(name);
            // Affichage de la date/heure du créneau
            const bookingDate = book.booking_date
              ? new Date(book.booking_date).toLocaleDateString('fr-FR', { day:'numeric', month:'short' })
              : book.date
                ? new Date(book.date).toLocaleDateString('fr-FR', { day:'numeric', month:'short' })
                : null;
            const bookingTime = book.start_time ?? book.time ?? null;
            const dateSlot = bookingDate
              ? `${bookingDate}${bookingTime ? ` · ${bookingTime.slice(0,5)}` : ''}`
              : fmtDate(book.created_at);

            return (
              <TouchableOpacity key={book.id} style={s.card}
                onPress={() => router.navigate({
                  pathname: '/(pro)/bookings/[id]',
                  params: { id: book.id },
                } as any)} activeOpacity={0.85}>
                <View style={[s.avatar, { backgroundColor: avatarBg }]}>
                  <Text style={s.avatarTxt}>{initials}</Text>
                </View>
                <View style={{ flex:1, gap:3 }}>
                  <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                    <Text style={s.cardName}>{name}</Text>
                    <View style={[s.statusBadge, { backgroundColor: st.bg }]}>
                      <View style={[s.statusDot, { backgroundColor: st.dot }]} />
                      <Text style={[s.statusTxt, { color: st.color }]}>{st.label}</Text>
                    </View>
                  </View>
                  {book.service?.title && (
                    <Text style={s.itemsLine} numberOfLines={1}>🛎️ {book.service.title}</Text>
                  )}
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <Text style={s.idTag}>#{book.id.slice(-6).toUpperCase()}</Text>
                    <Text style={s.dotSep}>·</Text>
                    {book.total_amount ? (
                      <>
                        <Text style={s.amount}>{Number(book.total_amount).toLocaleString('fr-FR')} FCFA</Text>
                        <Text style={s.dotSep}>·</Text>
                      </>
                    ) : null}
                    <Feather name="clock" size={11} color="#9CA3AF" />
                    <Text style={s.dateStr}>{dateSlot}</Text>
                  </View>
                </View>
                <Feather name="chevron-right" size={16} color="#D1D5DB" style={{ marginLeft:4 }} />
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  hero: {
    backgroundColor: DARK,
    paddingHorizontal: 20,
    paddingBottom: 0,
  },

  // ── Ligne 1 ───────────────────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
  },
  bizBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  bizBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    flexShrink: 1,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  notifBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'center',
  },
  notifPlaceholder: { width: 40 },
  notifDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#F59E0B' },
  notifCount: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },

  // ── Dropdown ──────────────────────────────────────────────────────────────
  bizDropdown: {
    backgroundColor: '#fff',
    borderRadius: 14,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  bizOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F3F4F6',
  },
  bizOptionActive: { backgroundColor: '#FEF2EC' },
  bizOptionTxt: { fontSize: 14, fontWeight: '600', color: DARK },

  // ── Onglets ───────────────────────────────────────────────────────────────
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  tabBtnActive: { backgroundColor: '#fff' },
  tabIcon: { width: 18, height: 18 },
  tabTxt: { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.6)' },
  tabTxtActive: { color: DARK, fontWeight: '700' },
  tabBadge: {
    backgroundColor: ORANGE,
    borderRadius: 100,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeTxt: { fontSize: 10, fontWeight: '800', color: '#fff' },

  // ── Pills ─────────────────────────────────────────────────────────────────
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  pillActive:    { backgroundColor: '#fff' },
  pillTxt:       { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },
  pillTxtActive: { color: DARK, fontWeight: '700' },

  // ── Recherche ─────────────────────────────────────────────────────────────
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: DARK,
    paddingVertical: 0,
  },

  // ── Empty state ───────────────────────────────────────────────────────────
  emptyWrap: { alignItems:'center', paddingVertical:60, gap:12 },
  emptyIcon: {
    width:64, height:64, borderRadius:32,
    backgroundColor:'#F3F4F6',
    alignItems:'center', justifyContent:'center',
  },
  emptyTxt: { fontSize:14, color:'#9CA3AF', fontWeight:'600' },

  // ── Cards ─────────────────────────────────────────────────────────────────
  card: {
    flexDirection:'row', alignItems:'center', gap:14,
    backgroundColor:'#fff', borderRadius:18, padding:16,
    borderWidth: 1, borderColor: '#F0F0F0',
  },
  avatar: {
    width:46, height:46, borderRadius:23,
    alignItems:'center', justifyContent:'center', flexShrink:0,
  },
  avatarTxt:   { fontSize:15, fontWeight:'800', color:'#fff' },
  cardName:    { fontSize:15, fontWeight:'700', color:DARK },
  statusBadge: {
    flexDirection:'row', alignItems:'center', gap:5,
    paddingHorizontal:10, paddingVertical:4, borderRadius:100,
  },
  statusDot:  { width:6, height:6, borderRadius:3 },
  statusTxt:  { fontSize:11, fontWeight:'700' },
  itemsLine:  { fontSize:12, color:'#9CA3AF' },
  idTag:      { fontSize:11, fontWeight:'700', color:'#C4B5FD', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  amount:     { fontSize:14, fontWeight:'800', color:DARK },
  dotSep:     { fontSize:12, color:'#D1D5DB' },
  dateStr:    { fontSize:12, color:'#9CA3AF' },
});
