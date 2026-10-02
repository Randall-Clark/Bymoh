// components/pro/CatalogSection.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeCatalog } from '@/hooks/useRealtimeOrders';
import { supabase } from '@/lib/supabase';

const ORANGE = '#FF6835';
const GREEN  = '#22C55E';
const DARK   = '#111827';

type Filter = 'all' | 'active' | 'rupture';

function safeUrls(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try { const r = JSON.parse(raw); return Array.isArray(r) ? r : []; } catch { return []; }
}
function safeFirstUrl(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    if (raw.startsWith('[')) {
      try { const a = JSON.parse(raw); return Array.isArray(a) ? a[0]??null : null; }
      catch { return null; }
    }
    return raw;
  }
  if (Array.isArray(raw)) return raw[0] ?? null;
  return null;
}

interface Props { businessId: string; }

export function CatalogSection({ businessId }: Props) {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  useRealtimeCatalog(businessId);
  const [filter,    setFilter]    = useState<Filter>('all');
  const [actionItem,setActionItem] = useState<any>(null);
  const topPad = (Platform.OS === 'ios' ? insets.top : insets.top) + 8;

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalog', businessId],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*')
        .eq('business_id', businessId).order('created_at', { ascending: false });
      return data ?? [];
    },
    staleTime: 0, gcTime: 0, refetchOnMount: 'always',
  });

  const total   = items.length;
  const actifs  = items.filter((i: any) => i.is_available && (i.stock_quantity == null || i.stock_quantity > 0)).length;
  const rupture = items.filter((i: any) => i.is_available && i.stock_quantity != null && i.stock_quantity <= 0).length;

  const filtered = items.filter((i: any) => {
    if (filter === 'all')     return true;
    if (filter === 'active')  return i.is_available && (i.stock_quantity == null || i.stock_quantity > 0);
    if (filter === 'rupture') return i.is_available && i.stock_quantity != null && i.stock_quantity <= 0;
    return true;
  });

  const handleDuplicate = async (item: any) => {
    const { id: _id, created_at: _c, updated_at: _u, ...rest } = item;
    const newId = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await supabase.from('services').insert({ ...rest, id: newId, title: rest.title + ' (copie)' });
    qc.invalidateQueries({ queryKey: ['catalog', businessId] });
    setActionItem(null);
  };

  const handleToggleActive = async (item: any) => {
    await supabase.from('services').update({ is_available: !item.is_available }).eq('id', item.id);
    qc.invalidateQueries({ queryKey: ['catalog', businessId] });
    setActionItem(null);
  };

  const handleDelete = (item: any) => {
    Alert.alert('Supprimer', `Supprimer "${item.title}" ?`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        setActionItem(null);
      await supabase.from('services').delete().eq('id', item.id);
        qc.invalidateQueries({ queryKey: ['catalog', businessId] });
      }},
    ]);
  };

  const statusInfo = (item: any) => {
    if (!item.is_available)
      return { label: 'Inactif', color: '#9CA3AF', bg: '#F3F4F6' };
    if (item.stock_quantity != null && item.stock_quantity <= 0)
      return { label: 'Rupture', color: '#EF4444', bg: '#FEF2F2' };
    return { label: 'Actif', color: GREEN, bg: '#F0FDF4' };
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F2F2F7' }}>

      {/* ── Header sombre ── */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={s.backBtn}
          onPress={() => router.navigate('/(pro)/boutique' as any)}>
          <Feather name="chevron-left" size={22} color="#fff"/>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Catalogue</Text>
        <TouchableOpacity style={s.addBtn}
          onPress={() => router.navigate({
            pathname: '/(pro)/catalog/edit',
            params: { businessId },
          } as any)}>
          <Feather name="plus" size={16} color="#fff"/>
          <Text style={s.addBtnTxt}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* ── Filtres pills ── */}
      <View style={[s.filterBar, { backgroundColor: DARK }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 14 }}>
          {([
            ['all',     `Tous ${total}`],
            ['active',  `Actifs ${actifs}`],
            ['rupture', `Rupture ${rupture}`],
          ] as [Filter, string][]).map(([f, l]) => (
            <TouchableOpacity key={f}
              style={[s.filterPill, filter === f && s.filterPillActive]}
              onPress={() => setFilter(f)}>
              <Text style={[s.filterPillTxt, filter === f && s.filterPillTxtActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 80 }}>

        {/* ── Stats ── */}
        <View style={s.statsRow}>
          <View style={[s.statCard, { backgroundColor: '#fff' }]}>
            <Text style={[s.statValue, { color: DARK }]}>{total}</Text>
            <Text style={s.statLabel}>Total</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#F0FDF4' }]}>
            <Text style={[s.statValue, { color: GREEN }]}>{actifs}</Text>
            <Text style={[s.statLabel, { color: GREEN }]}>Actifs</Text>
          </View>
          <View style={[s.statCard, { backgroundColor: '#FEF2F2' }]}>
            <Text style={[s.statValue, { color: '#EF4444' }]}>{rupture}</Text>
            <Text style={[s.statLabel, { color: '#EF4444' }]}>Ruptures</Text>
          </View>
        </View>

        {/* ── Liste ── */}
        {isLoading ? (
          <ActivityIndicator color={ORANGE} style={{ padding: 40 }}/>
        ) : filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Feather name="package" size={40} color="#D1D5DB"/>
            <Text style={s.emptyTxt}>Aucun article</Text>
          </View>
        ) : (
          filtered.map((item: any) => {
            const st     = statusInfo(item);
            const imgUrl = safeFirstUrl(item.image_url) || safeUrls(item.image_urls)[0];
            const allUrls= [
              ...(safeFirstUrl(item.image_url) ? [safeFirstUrl(item.image_url)!] : []),
              ...safeUrls(item.image_urls).filter((u: string) => u !== safeFirstUrl(item.image_url)),
            ];
            const price  = (item.price ?? 0).toLocaleString('fr-FR');
            const stock  = item.stock_quantity != null
              ? item.stock_quantity > 0 ? `${item.stock_quantity} en stock` : 'Hors stock'
              : null;

            return (
              <View key={item.id} style={s.itemCard}>
                {/* Image */}
                <View style={s.imgWrap}>
                  {imgUrl ? (
                    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                      style={{ width: 64, height: 64 }} scrollEnabled={allUrls.length > 1}>
                      {allUrls.map((url: string, i: number) => (
                        <Image key={i} source={{ uri: url ?? undefined }}
                          style={{ width: 64, height: 64, resizeMode: 'cover' }}/>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={{ fontSize: 28 }}>
                      {item.kind === 'prestation' ? '🛎️' : '📦'}
                    </Text>
                  )}
                </View>

                {/* Infos */}
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={s.itemName} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.itemCat} numberOfLines={1}>
                    {item.service_category
                      ? item.service_category === 'at_merchant' ? 'Boutique'
                      : item.service_category === 'at_client'   ? 'Domicile' : 'Hybride'
                      : item.unit ?? item.billing_type ?? ''}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={s.itemPrice}>{price} FCFA</Text>
                    {stock && <Text style={s.itemStock}>·  {stock}</Text>}
                  </View>
                </View>

                {/* Status + menu */}
                <View style={{ alignItems: 'flex-end', gap: 10 }}>
                  <View style={[s.badge, { backgroundColor: st.bg }]}>
                    <Text style={[s.badgeTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <TouchableOpacity style={s.menuBtn}
                    onPress={() => setActionItem(item)}>
                    <Feather name="more-vertical" size={18} color="#9CA3AF"/>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
      {/* ── Modal action item ── */}
      <Modal visible={!!actionItem} transparent animationType="slide"
        onRequestClose={()=>setActionItem(null)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={()=>setActionItem(null)}/>
        {actionItem && (
          <View style={s.actionSheet}>
            <View style={s.sheetHandle}/>

            {/* Header produit */}
            <View style={s.sheetHeader}>
              <View style={s.sheetImgWrap}>
                {(safeFirstUrl(actionItem.image_url)||safeUrls(actionItem.image_urls)[0])
                  ? <Image source={{uri:(safeFirstUrl(actionItem.image_url)||safeUrls(actionItem.image_urls)[0]) ?? undefined}}
                      style={{width:52,height:52,resizeMode:'cover'}}/>
                  : <Text style={{fontSize:26}}>{actionItem.kind==='prestation'?'🛎️':'📦'}</Text>}
              </View>
              <View style={{flex:1}}>
                <Text style={s.sheetItemName}>{actionItem.title}</Text>
                <Text style={s.sheetItemSub}>
                  {(actionItem.price??0).toLocaleString('fr-FR')} FCFA
                  {actionItem.stock_quantity!=null?` · ${actionItem.stock_quantity} en stock`:''}
                </Text>
              </View>
              <View style={[s.sheetBadge,{
                backgroundColor: statusInfo(actionItem).bg,
              }]}>
                <Text style={[s.sheetBadgeTxt,{color:statusInfo(actionItem).color}]}>
                  {statusInfo(actionItem).label}
                </Text>
              </View>
            </View>

            <View style={s.divider}/>

            {/* Actions */}
            {[
              {
                icon:'edit-2', iconBg:'#FEF2EC', iconColor:ORANGE,
                label:'Modifier le produit', sub:'Éditer les infos, le prix, le stock',
                onPress:()=>{
                  setActionItem(null);
                  router.navigate({pathname:'/(pro)/catalog/edit',
                    params:{businessId,serviceId:actionItem.id}} as any);
                },
              },
              {
                icon:'copy', iconBg:'#F3F4F6', iconColor:'#374151',
                label:'Dupliquer', sub:'Créer une copie de ce produit',
                onPress:()=>handleDuplicate(actionItem),
              },
              {
                icon:'slash', iconBg:'#FEF2F2', iconColor:'#EF4444',
                label:actionItem.is_available?'Désactiver':'Réactiver',
                sub:actionItem.is_available?'Masquer du catalogue clients':'Rendre visible aux clients',
                onPress:()=>handleToggleActive(actionItem),
              },
              {
                icon:'trash-2', iconBg:'#FEF2F2', iconColor:'#EF4444',
                label:'Supprimer', sub:'Action irréversible', labelColor:'#EF4444',
                onPress:()=>handleDelete(actionItem),
              },
            ].map((a,i)=>(
              <TouchableOpacity key={i} style={s.actionRow} onPress={a.onPress} activeOpacity={0.7}>
                <View style={[s.actionIcon,{backgroundColor:a.iconBg}]}>
                  <Feather name={a.icon as any} size={18} color={a.iconColor}/>
                </View>
                <View style={{flex:1}}>
                  <Text style={[s.actionLabel,a.labelColor&&{color:a.labelColor}]}>{a.label}</Text>
                  <Text style={s.actionSub}>{a.sub}</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#D1D5DB"/>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  // Header
  header:         { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingBottom:12, backgroundColor:DARK },
  backBtn:        { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' },
  headerTitle:    { fontSize:17, fontWeight:'800', color:'#fff' },
  addBtn:         { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:ORANGE, borderRadius:12, paddingHorizontal:14, paddingVertical:9 },
  addBtnTxt:      { fontSize:14, fontWeight:'700', color:'#fff' },
  // Filtres
  filterBar:      { paddingTop:10 },
  filterPill:     { paddingHorizontal:14, paddingVertical:7, borderRadius:100, backgroundColor:'rgba(255,255,255,0.12)' },
  filterPillActive:{ backgroundColor:'#fff' },
  filterPillTxt:  { fontSize:13, fontWeight:'600', color:'rgba(255,255,255,0.7)' },
  filterPillTxtActive:{ color:DARK, fontWeight:'700' },
  // Stats
  statsRow:       { flexDirection:'row', gap:10 },
  statCard:       { flex:1, borderRadius:16, padding:14, gap:4, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:3, elevation:1 },
  statValue:      { fontSize:26, fontWeight:'900' },
  statLabel:      { fontSize:12, fontWeight:'600', color:'#9CA3AF' },
  // Items
  itemCard:       { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#fff', borderRadius:18, padding:14, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  imgWrap:        { width:64, height:64, borderRadius:14, backgroundColor:'#F3F4F6', overflow:'hidden', alignItems:'center', justifyContent:'center', flexShrink:0 },
  itemName:       { fontSize:15, fontWeight:'700', color:DARK },
  itemCat:        { fontSize:12, color:'#9CA3AF' },
  itemPrice:      { fontSize:14, fontWeight:'700', color:ORANGE },
  itemStock:      { fontSize:12, color:'#9CA3AF' },
  badge:          { paddingHorizontal:10, paddingVertical:4, borderRadius:100 },
  badgeTxt:       { fontSize:11, fontWeight:'700' },
  menuBtn:        { width:32, height:32, borderRadius:16, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  modalBg:       { ...StyleSheet.absoluteFill, backgroundColor:'rgba(0,0,0,0.5)' },
  actionSheet:   { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, gap:4 },
  sheetHandle:   { width:40,height:4,borderRadius:2,backgroundColor:'#E5E7EB',alignSelf:'center',marginBottom:12 },
  sheetHeader:   { flexDirection:'row',alignItems:'center',gap:14,marginBottom:4 },
  sheetImgWrap:  { width:52,height:52,borderRadius:14,backgroundColor:'#F3F4F6',overflow:'hidden',alignItems:'center',justifyContent:'center',flexShrink:0 },
  sheetItemName: { fontSize:16,fontWeight:'800',color:'#111827' },
  sheetItemSub:  { fontSize:13,color:'#9CA3AF',marginTop:2 },
  sheetBadge:    { paddingHorizontal:10,paddingVertical:4,borderRadius:100 },
  sheetBadgeTxt: { fontSize:11,fontWeight:'700' },
  divider:       { height:1,backgroundColor:'#F3F4F6',marginVertical:8 },
  actionRow:     { flexDirection:'row',alignItems:'center',gap:14,paddingVertical:14,borderBottomWidth:1,borderBottomColor:'#F9FAFB' },
  actionIcon:    { width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center',flexShrink:0 },
  actionLabel:   { fontSize:15,fontWeight:'700',color:'#111827' },
  actionSub:     { fontSize:12,color:'#9CA3AF',marginTop:1 },
  emptyWrap:      { alignItems:'center', paddingVertical:60, gap:10 },
  emptyTxt:       { fontSize:14, color:'#9CA3AF', fontWeight:'600' },
});
