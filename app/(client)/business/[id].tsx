// app/(client)/business/[id].tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Linking, Modal,
  Platform, ScrollView, Share, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isBusinessOpen } from '@/lib/utils';
import { useCartStore } from '@/stores/cartStore';


const ItemImages = React.memo(function ItemImages({ item }: { item: any }) {
  const allUrls = [
    ...(safeFirstUrl(item.image_url) ? [safeFirstUrl(item.image_url)!] : []),
    ...safeUrls(item.image_urls).filter((u: string) => u !== safeFirstUrl(item.image_url)),
  ];
  if (allUrls.length === 0) return (
    <View style={{ width:90, height:90, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center', borderRadius:10 }}>
      <Text style={{ fontSize:26 }}>{item.kind==='article'?'📦':'🛎️'}</Text>
    </View>
  );
  return (
    <View style={{ position:'relative', width:90, height:90 }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        style={{ width:90, height:90 }} scrollEnabled={allUrls.length > 1}>
        {allUrls.map((url: string, i: number) => (
          <Image key={i} source={{ uri: url ?? undefined }}
            style={{ width:90, height:90, borderRadius:10, resizeMode:'cover' }}
            onError={() => {}}/>
        ))}
      </ScrollView>
      {allUrls.length > 1 && (
        <View style={{ position:'absolute', bottom:4, left:0, right:0, flexDirection:'row', justifyContent:'center', gap:3 }}>
          {allUrls.map((_: string, i: number) => (
            <View key={i} style={{ width:4, height:4, borderRadius:2, backgroundColor:'rgba(255,255,255,0.85)' }}/>
          ))}
        </View>
      )}
    </View>
  );
});

function safeFirstUrl(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    if (raw.startsWith('[')) {
      try { const arr = JSON.parse(raw); return Array.isArray(arr) ? arr[0] ?? null : null; }
      catch { return null; }
    }
    return raw;
  }
  if (Array.isArray(raw)) return raw[0] ?? null;
  return null;
}

function safeUrls(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const r = JSON.parse(raw); return Array.isArray(r) ? r : []; } catch { return []; }
}


const { width: W } = Dimensions.get('window');

const DAY_FR: Record<string, string> = {
  Mon:'Lundi', Tue:'Mardi', Wed:'Mercredi',
  Thu:'Jeudi', Fri:'Vendredi', Sat:'Samedi', Sun:'Dimanche',
};

function fmtPrice(price: number, billing: string, unit?: string) {
  if (billing === 'free')     return 'Gratuit';
  if (billing === 'quote')    return 'Sur devis';
  const p = (price ?? 0).toLocaleString('fr-FR');
  if (billing === 'hourly')   return `${p} FCFA / h`;
  if (billing === 'per_day')  return `${p} FCFA / j`;
  if (billing === 'per_unit') return `${p} FCFA / ${unit ?? 'u'}`;
  return `${p} FCFA`;
}

type TabId = 'all' | 'article' | 'prestation' | 'promo';

export default function ClientBusinessPage() {
  const insets       = useSafeAreaInsets();
  const { id }  = useLocalSearchParams<{ id: string }>();

  // ── Cart ─────────────────────────────────────────────────────────────────
  const cartStore      = useCartStore() as any;
  const cartItems      = cartStore.items ?? [];

  const getItemQty = (itemId: string) =>
    cartItems.find((i: any) => i.id === itemId || i.service_id === itemId)?.quantity ?? 0;

  const totalItems = cartItems.reduce((acc: number, i: any) => acc + (i.quantity ?? 0), 0);
  const totalAmount = cartItems.reduce((acc: number, i: any) =>
    acc + ((i.price ?? 0) * (i.quantity ?? 0)), 0);

  const [activeTab,    setActiveTab]    = useState<TabId>('all');
  const [aboutVisible, setAboutVisible] = useState(false);
  const [menuVisible,  setMenuVisible]  = useState(false);

  // ── Boutique ──────────────────────────────────────────────────────────
  const { data: business, isLoading } = useQuery({
    queryKey: ['biz-client', id],
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*, hours:business_hours(*)')
        .eq('id', id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    refetchOnMount: 'always',
  });

  // ── Catalogue ─────────────────────────────────────────────────────────
  const { data: catalog = [], isLoading: catLoading } = useQuery({
    queryKey: ['cat-client', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services').select('*')
        .eq('business_id', id!).eq('is_available', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
    refetchOnMount: 'always',
  });

  if (isLoading || !business) {
    return <View style={s.center}><ActivityIndicator color="#FF6835" size="large" /></View>;
  }

  const isOpen  = isBusinessOpen(business.hours, business.timezone);
  const tag     = (business as any).tag ?? '';
  const botPad  = Math.max(insets.bottom, 16);

  const hasPromos = !catLoading && catalog.length > 0 && catalog.some((i: any) => i.promo_active === true);

  const tabs: { id: TabId; label: string; color: string; bg: string }[] = [
    { id: 'all',        label: 'Tout',       color: '#FF6835', bg: '#FEF2EC' },
    { id: 'article',    label: 'Articles',   color: '#1E3A5F', bg: '#EEF2FF' },
    { id: 'prestation', label: 'Services',   color: '#7C3AED', bg: '#F5F3FF' },
    ...(hasPromos ? [{ id: 'promo' as TabId, label: 'Promos 🏷️', color: '#EF4444', bg: '#FEF2F2' }] : []),
  ];

  const items = activeTab === 'all'
    ? catalog
    : activeTab === 'promo'
    ? catalog.filter((i: any) => i.promo_active)
    : catalog.filter((i: any) => i.kind === activeTab);

  // ── Ajouter au panier ─────────────────────────────────────────────────
  const handleAdd = (item: any) => {
    cartStore.addItem(
      {
        id:             item.id,
        title:          item.title,
        price:          item.price ?? 0,
        image_url:      safeFirstUrl(item.image_url) ?? safeUrls(item.image_urls)[0] ?? undefined,
        allows_booking: false,
        is_available:   true,
        show_stock:     false,
        currency:       'XOF',
        kind:           item.kind,
      },
      id!,
      business.name,
    );
  };

  // ── Décrémenter quantité (− 1 ; à 0 → supprime) ──────────────────────
  const handleDecrement = (item: any) => {
    const qty = getItemQty(item.id);
    if (qty <= 1) {
      cartStore.removeItem(item.id);
    } else {
      cartStore.updateQuantity(item.id, qty - 1);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F7F4' }}>

      {/* Back flottant */}
      <TouchableOpacity
        style={[s.backBtn, { top: (Platform.OS === 'ios' ? 83 : 60) + 10 }]}
        onPress={() => router.back()}
      >
        <Feather name="arrow-left" size={20} color="#111827" />
      </TouchableOpacity>

      {/* ══ PARTIE FIXE : cover + infos + onglets ══ */}

        {/* Cover */}
        {business.cover_url
          ? <Image
              source={{ uri: business.cover_url }}
              style={s.cover}
              onError={(e) => console.warn('[cover] erreur chargement:', business.cover_url, e.nativeEvent)}
              onLoad={() => console.log('[cover] image chargee:', business.cover_url)}
            />
          : <View style={[s.cover, s.coverPh]}>
              <Text style={{ fontSize: 56 }}>{(business as any).category_icon ?? '🏪'}</Text>
            </View>
        }

        {/* Infos */}
        <View style={s.infoCard}>
          <View style={s.nameRow}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection:'row', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                <Text style={s.bizName} numberOfLines={1}>{business.name}</Text>
                {tag ? <Text style={s.tag}>{tag}</Text> : null}
              </View>
              <Text style={s.category}>{(business as any).category_icon} {business.category}</Text>
            </View>

            <TouchableOpacity style={s.menuBtn} onPress={() => setMenuVisible(true)}>
              <Feather name="more-vertical" size={20} color="#374151" />
            </TouchableOpacity>

            {menuVisible && (
              <>
                <TouchableOpacity style={s.menuBackdrop} activeOpacity={1} onPress={() => setMenuVisible(false)} />
                <View style={s.menuPopup}>
                  {[
                    { icon:'info',    label:'À propos', action:() => { setMenuVisible(false); setAboutVisible(true); } },
                    { icon:'heart',   label:'Favoris',  action:() => setMenuVisible(false) },
                    { icon:'share-2', label:'Partager', action:() => { setMenuVisible(false); Share.share({ message:`Découvrez ${business.name} sur Bymoh ! ${tag}` }); } },
                  ].map((item, i, arr) => (
                    <React.Fragment key={item.label}>
                      <TouchableOpacity style={s.menuItem} onPress={item.action}>
                        <Feather name={item.icon as any} size={16} color="#374151" />
                        <Text style={s.menuItemTxt}>{item.label}</Text>
                      </TouchableOpacity>
                      {i < arr.length - 1 && <View style={s.menuDiv} />}
                    </React.Fragment>
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={s.badges}>
            <View style={[s.badge, isOpen ? s.badgeOpen : s.badgeClosed]}>
              <View style={[s.dot, { backgroundColor: isOpen ? '#22C55E' : '#9CA3AF' }]} />
              <Text style={[s.badgeTxt, { color: isOpen ? '#166534' : '#4B5563' }]}>
                {isOpen ? 'Ouvert' : 'Fermé'}
              </Text>
            </View>
            {business.has_delivery && (
              <View style={[s.badge, s.badgeDel]}>
                <Feather name="truck" size={11} color="#FF6835" />
                <Text style={[s.badgeTxt, { color:'#FF6835' }]}>Livraison</Text>
              </View>
            )}
          </View>
        </View>

        {/* Onglets */}
        <View style={s.tabBar}>
          {tabs.map((t) => {
            const active = activeTab === t.id;
            const count = t.id === 'all' ? catalog.length
              : t.id === 'promo' ? catalog.filter((i: any) => i.promo_active).length
              : catalog.filter((i: any) => i.kind === t.id).length;
            return (
              <TouchableOpacity
                key={t.id}
                style={[s.tab, active && { backgroundColor:t.bg, borderColor:t.color }]}
                onPress={() => setActiveTab(t.id)}
              >
                <Text style={[s.tabTxt, active && { color:t.color, fontWeight:'700' }]}>
                  {t.label}{count > 0 ? ` (${count})` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

      {/* ══ PARTIE DÉFILANTE : seulement la liste ══ */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
      >
        {/* Catalogue */}
        <View style={{ gap: 12 }}>
          {catLoading
            ? <ActivityIndicator color="#FF6835" style={{ marginTop:40 }} />
            : items.length === 0
            ? <View style={s.empty}>
                <Feather name="package" size={40} color="#E5E7EB" />
                <Text style={s.emptyTxt}>Aucun élément</Text>
              </View>
            : items.map((item: any) => {
                const qty = getItemQty(item.id);
                return (
                  <View key={item.id} style={s.card}>
                    <ItemImages item={item} />
                    <View style={s.cardBody}>
                      <View style={{ flexDirection:'row', alignItems:'center', gap:6 }}>
                        <Text style={s.cardTitle} numberOfLines={1}>{item.title}</Text>
                      </View>
                      {item.description
                        ? <Text style={s.cardDesc} numberOfLines={2}>{item.description}</Text>
                        : null}
                      <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                        <Text style={s.cardPrice}>{fmtPrice(item.price, item.billing_type, item.unit)}</Text>
                        {item.promo_active && (
                          <View style={s.promoTag}>
                            <Feather name="tag" size={10} color="#FF6835" />
                            <Text style={s.promoTxt}>Promo</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* ── Action selon le type ── */}
                    {item.kind === 'prestation' && item.allows_booking !== false
                      ? /* Service → Réserver */
                        <TouchableOpacity
                          style={s.reserveBtn}
                          activeOpacity={0.8}
                          onPress={() => router.push({
                            pathname: '/(client)/service/[id]' as any,
                            params: { id: item.id, businessId: id },
                          })}
                        >
                          <Feather name="calendar" size={13} color="#fff" />
                          <Text style={s.reserveTxt}>Réserver</Text>
                        </TouchableOpacity>
                      : item.kind === 'article'
                      ? /* Article → Panier avec quantité */
                        qty === 0
                        ? <TouchableOpacity style={s.addBtn} activeOpacity={0.8} onPress={() => handleAdd(item)}>
                            <Feather name="plus" size={18} color="#fff" />
                          </TouchableOpacity>
                        : <View style={s.qtyControl}>
                            <TouchableOpacity style={s.qtyBtnMinus} onPress={() => handleDecrement(item)}>
                              <Feather name="minus" size={14} color="#FF6835" />
                            </TouchableOpacity>
                            <Text style={s.qtyVal}>{qty}</Text>
                            <TouchableOpacity style={s.qtyBtnPlus} onPress={() => handleAdd(item)}>
                              <Feather name="plus" size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                      : null
                    }
                  </View>
                );
              })
          }
        </View>
      </ScrollView>

      {/* ── Modal À propos ── */}
      <Modal visible={aboutVisible} transparent animationType="slide" onRequestClose={() => setAboutVisible(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setAboutVisible(false)} />
        <View style={[s.modalSheet, { paddingBottom: botPad + 20 }]}>
          <View style={s.handle} />
          <Text style={s.modalTitle}>À propos</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.aSection}>
              <Text style={s.aSectionTitle}>Boutique</Text>
              <View style={s.aRow}><Feather name="briefcase" size={15} color="#9CA3AF" /><Text style={s.aTxt}>{business.name}</Text>{tag ? <Text style={s.aTag}>{tag}</Text> : null}</View>
              <View style={s.aRow}><Text style={{ fontSize:15 }}>{(business as any).category_icon}</Text><Text style={s.aTxt}>{business.category}</Text></View>
            </View>
            {business.address
              ? <TouchableOpacity style={s.aSection} onPress={() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(business.address + ' ' + (business.city ?? ''))}`)}>
                  <Text style={s.aSectionTitle}>Adresse</Text>
                  <View style={s.aRow}>
                    <Feather name="map-pin" size={15} color="#FF6835" />
                    <Text style={[s.aTxt, { color:'#FF6835', textDecorationLine:'underline', flex:1 }]}>{business.address}{business.city ? `, ${business.city}` : ''}</Text>
                    <Feather name="external-link" size={13} color="#FF6835" />
                  </View>
                </TouchableOpacity>
              : null}
            {business.phone
              ? <TouchableOpacity style={s.aSection} onPress={() => Linking.openURL(`tel:${business.phone}`)}>
                  <Text style={s.aSectionTitle}>Téléphone</Text>
                  <View style={s.aRow}>
                    <Feather name="phone" size={15} color="#22C55E" />
                    <Text style={[s.aTxt, { color:'#22C55E', fontWeight:'600', flex:1 }]}>{business.phone}</Text>
                    <View style={s.callPill}><Text style={s.callPillTxt}>Appeler</Text></View>
                  </View>
                </TouchableOpacity>
              : null}
            {business.description
              ? <View style={s.aSection}><Text style={s.aSectionTitle}>Description</Text><Text style={s.aDesc}>{business.description}</Text></View>
              : null}
            <View style={s.aSection}>
              <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                <Text style={s.aSectionTitle}>Horaires</Text>
                <View style={[s.openPill, isOpen ? s.openPillOn : s.openPillOff]}>
                  <Text style={[s.openPillTxt, { color: isOpen ? '#166534' : '#4B5563' }]}>{isOpen ? 'Ouvert' : 'Fermé'}</Text>
                </View>
              </View>
              {business.hours && business.hours.length > 0
                ? [...business.hours]
                    .sort((a:any,b:any) => ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(a.day_of_week) - ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(b.day_of_week))
                    .map((h:any) => (
                      <View key={h.id ?? h.day_of_week} style={s.hRow}>
                        <Text style={s.hDay}>{DAY_FR[h.day_of_week] ?? h.day_of_week}</Text>
                        {h.is_closed ? <Text style={s.hClosed}>Fermé</Text> : <Text style={s.hTime}>{h.open_time} – {h.close_time}</Text>}
                      </View>
                    ))
                : <Text style={s.aDesc}>Horaires non renseignés.</Text>
              }
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  center:        { flex:1, alignItems:'center', justifyContent:'center' },
  backBtn:       { position:'absolute', left:16, zIndex:20, width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.92)', alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.12, shadowRadius:6, elevation:4 },
  cover:         { width:W, height:220, resizeMode:'cover' },
  coverPh:       { backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  infoCard:      { backgroundColor:'#fff', paddingHorizontal:20, paddingTop:16, paddingBottom:12, gap:10 },
  nameRow:       { flexDirection:'row', alignItems:'flex-start', gap:8 },
  bizName:       { fontSize:22, fontWeight:'800', color:'#111827', flexShrink:1 },
  tag:           { fontSize:12, color:'#9CA3AF', fontWeight:'300' },
  category:      { fontSize:14, color:'#6B7280', marginTop:2 },
  menuBtn:       { width:36, height:36, borderRadius:18, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  menuBackdrop:  { position:'absolute', top:-500, left:-500, right:-500, bottom:-500, zIndex:30 },
  menuPopup:     { position:'absolute', top:44, right:0, zIndex:40, backgroundColor:'#fff', borderRadius:14, width:190, shadowColor:'#000', shadowOffset:{width:0,height:6}, shadowOpacity:0.12, shadowRadius:16, elevation:12, overflow:'hidden' },
  menuItem:      { flexDirection:'row', alignItems:'center', gap:10, paddingHorizontal:16, paddingVertical:13 },
  menuItemTxt:   { fontSize:14, fontWeight:'600', color:'#374151' },
  menuDiv:       { height:1, backgroundColor:'#F3F4F6' },
  badges:        { flexDirection:'row', flexWrap:'wrap', gap:8 },
  badge:         { flexDirection:'row', alignItems:'center', gap:5, backgroundColor:'#F3F4F6', borderRadius:100, paddingHorizontal:10, paddingVertical:5, borderWidth:1, borderColor:'#E5E7EB' },
  badgeOpen:     { backgroundColor:'#F0FDF4', borderColor:'#BBF7D0' },
  badgeClosed:   { backgroundColor:'#F9FAFB', borderColor:'#E5E7EB' },
  badgeDel:      { backgroundColor:'#FEF2EC', borderColor:'#FDDCCA' },
  dot:           { width:6, height:6, borderRadius:3 },
  badgeTxt:      { fontSize:12, fontWeight:'600' },
  tabBar:        { flexDirection:'row', backgroundColor:'#fff', paddingHorizontal:16, paddingVertical:10, gap:8, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  tab:           { paddingHorizontal:14, paddingVertical:7, borderRadius:100, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'transparent' },
  tabTxt:        { fontSize:13, fontWeight:'600', color:'#6B7280' },
  list:          { padding:16, gap:12 },
  empty:         { alignItems:'center', gap:10, paddingVertical:40 },
  emptyTxt:      { fontSize:15, color:'#9CA3AF' },
  card:          { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:16, overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  cardImg:       { width:96, height:96, resizeMode:'cover' },
  cardImgPh:     { width:96, height:96, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  cardBody:      { flex:1, padding:12, gap:4 },
  cardTitle:     { flex:1, fontSize:14, fontWeight:'700', color:'#111827' },
  cardDesc:      { fontSize:12, color:'#9CA3AF', lineHeight:17 },
  cardPrice:     { fontSize:13, fontWeight:'700', color:'#FF6835' },
  promoTag:      { flexDirection:'row', alignItems:'center', gap:3, backgroundColor:'#FEF2EC', borderRadius:100, paddingHorizontal:6, paddingVertical:2 },
  promoTxt:      { fontSize:10, fontWeight:'700', color:'#FF6835' },
  reserveBtn:    { backgroundColor:'#FF6835', margin:10, paddingHorizontal:10, paddingVertical:8, borderRadius:12, flexDirection:'row', alignItems:'center', gap:4 },
  reserveTxt:    { fontSize:12, fontWeight:'700', color:'#fff' },
  addBtn:        { width:38, height:38, borderRadius:19, backgroundColor:'#FF6835', alignItems:'center', justifyContent:'center', margin:12 },
  qtyControl:    { flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6, paddingHorizontal:10, paddingVertical:8 },
  qtyBtnPlus:    { width:30, height:30, borderRadius:15, backgroundColor:'#FF6835', alignItems:'center', justifyContent:'center' },
  qtyBtnMinus:   { width:30, height:30, borderRadius:15, backgroundColor:'#FEF2EC', borderWidth:1.5, borderColor:'#FF6835', alignItems:'center', justifyContent:'center' },
  qtyVal:        { fontSize:15, fontWeight:'800', color:'#111827' },
  fab:           { position:'absolute', right:20, width:56, height:56, borderRadius:28, backgroundColor:'#1E3A5F', alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.2, shadowRadius:10, elevation:8 },
  fabBadge:      { position:'absolute', top:-4, right:-4, width:20, height:20, borderRadius:10, backgroundColor:'#FF6835', alignItems:'center', justifyContent:'center', borderWidth:2, borderColor:'#fff' },
  fabBadgeTxt:   { fontSize:10, fontWeight:'800', color:'#fff' },
  modalBg:       { flex:1, backgroundColor:'rgba(0,0,0,0.5)' },
  modalSheet:    { backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, maxHeight:'85%', gap:14 },
  handle:        { width:40, height:4, borderRadius:2, backgroundColor:'#E5E7EB', alignSelf:'center', marginBottom:4 },
  modalTitle:    { fontSize:20, fontWeight:'800', color:'#111827' },
  aSection:      { gap:8, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  aSectionTitle: { fontSize:11, fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.5 },
  aRow:          { flexDirection:'row', alignItems:'center', gap:10 },
  aTxt:          { fontSize:15, color:'#374151' },
  aTag:          { fontSize:12, color:'#9CA3AF' },
  aDesc:         { fontSize:14, color:'#374151', lineHeight:22 },
  callPill:      { backgroundColor:'#F0FDF4', borderRadius:100, paddingHorizontal:10, paddingVertical:4 },
  callPillTxt:   { fontSize:12, fontWeight:'700', color:'#22C55E' },
  openPill:      { borderRadius:100, paddingHorizontal:10, paddingVertical:3 },
  openPillOn:    { backgroundColor:'#F0FDF4' },
  openPillOff:   { backgroundColor:'#F3F4F6' },
  openPillTxt:   { fontSize:11, fontWeight:'700' },
  hRow:          { flexDirection:'row', justifyContent:'space-between', paddingVertical:5 },
  hDay:          { fontSize:14, color:'#374151', fontWeight:'500', width:90 },
  hTime:         { fontSize:14, color:'#22C55E', fontWeight:'600' },
  hClosed:       { fontSize:14, color:'#9CA3AF' },
});
