// app/(pro)/boutique.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Platform,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useMyBusinesses } from '@/hooks/useBusinesses';

const { width: W } = Dimensions.get('window');
const ORANGE = '#FF6835';
const DARK   = '#1A1025';
const GREEN  = '#22C55E';

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
  if (Array.isArray(raw)) return raw[0]??null;
  return null;
}

export default function BoutiqueTab() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [filter,      setFilter]      = useState<Filter>('all');
  const [activeBizId, setActiveBizId] = useState<string | null>(null);
  const [bizPickOpen, setBizPickOpen] = useState(false);

  const { data: businesses = [] } = useMyBusinesses(profile?.id ?? '');
  const bizId = activeBizId ?? (businesses[0] as any)?.id ?? null;
  const biz   = (businesses as any[]).find(b => b.id === bizId) ?? businesses[0] as any;

  // ── Catalogue ──────────────────────────────────────────────────────────────
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalog', bizId],
    queryFn: async () => {
      if (!bizId) return [];
      const { data } = await supabase.from('services').select('*')
        .eq('business_id', bizId).order('created_at', { ascending:false });
      return data ?? [];
    },
    enabled: !!bizId, staleTime: 30_000,
  });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const total     = items.length;
  const active    = items.filter((i:any) => i.is_available && (i.stock_quantity??1)>0).length;
  const rupture   = items.filter((i:any) => (i.stock_quantity??1)<=0).length;
  const avgRating = biz?.rating ?? 0;
  const reviewCount = biz?.review_count ?? 0;

  const filtered = items.filter((i:any) => {
    if (filter==='all')     return true;
    if (filter==='active')  return i.is_available && (i.stock_quantity??1)>0;
    if (filter==='rupture') return (i.stock_quantity??1)<=0;
    return true;
  });

  const statusBadge = (item: any) => {
    if (item.stock_quantity != null && item.stock_quantity <= 0) return { label:'Rupture', color:'#EF4444', bg:'#FEF2F2' };
    if (!item.is_available) return { label:'Inactif', color:'#9CA3AF', bg:'#F3F4F6' };
    return                                      { label:'Actif',     color:'#22C55E', bg:'#F0FDF4' };
  };

  const emoji = biz?.category_icon ?? '🏪';
  const topPad = (Platform.OS==='ios' ? insets.top : insets.top) + 12;

  return (
    <View style={{ flex:1, backgroundColor:'#F2F2F7' }}>

      {/* ── Hero sombre ── */}
      <View style={[s.hero, { paddingTop: topPad }]}>

        {/* Nav */}
        <View style={s.heroNav}>
          {/* Picker boutique */}
          <TouchableOpacity style={s.bizPill}
            onPress={()=>businesses.length>1&&setBizPickOpen(!bizPickOpen)}>
            <Feather name="shopping-bag" size={13} color="rgba(255,255,255,0.7)"/>
            <Text style={s.bizPillTxt}>{biz?.name ?? 'Ma boutique'}</Text>
            {businesses.length>1 && (
              <Feather name={bizPickOpen?'chevron-up':'chevron-down'} size={13} color="rgba(255,255,255,0.7)"/>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.settingsBtn}
            onPress={()=>biz&&router.navigate({pathname:'/(pro)/business/settings',params:{id:biz.id}} as any)}>
            <Feather name="settings" size={18} color="#fff"/>
          </TouchableOpacity>
        </View>

        {/* Dropdown boutiques */}
        {bizPickOpen && businesses.length>1 && (
          <View style={s.bizDrop}>
            {(businesses as any[]).map((b:any)=>(
              <TouchableOpacity key={b.id}
                style={[s.bizDropItem, bizId===b.id&&s.bizDropItemActive]}
                onPress={()=>{setActiveBizId(b.id);setBizPickOpen(false);}}>
                <Text style={[s.bizDropTxt, bizId===b.id&&{color:ORANGE,fontWeight:'700'}]}>{b.name}</Text>
                {bizId===b.id&&<Feather name="check" size={14} color={ORANGE}/>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Infos boutique */}
        <View style={s.bizInfo}>
          <View style={s.bizLogoWrap}>
            {biz?.cover_url
              ? <Image source={{uri:biz.cover_url}} style={s.bizLogo}/>
              : <View style={[s.bizLogo,{backgroundColor:ORANGE,alignItems:'center',justifyContent:'center'}]}>
                  <Text style={{fontSize:32}}>{emoji}</Text>
                </View>}
            <View style={s.activeIndicator}/>
          </View>
          <View style={{flex:1, gap:3}}>
            <Text style={s.bizName}>{biz?.name ?? '—'}</Text>
            <Text style={s.bizMeta}>{biz?.category ?? ''}{biz?.city?` · ${biz.city}`:''}</Text>
            {/* Étoiles toujours visibles */}
            <View style={{flexDirection:'row',alignItems:'center',gap:4}}>
                {[1,2,3,4,5].map(star=>(
                  <Feather key={star} name="star" size={12}
                    color={star<=Math.round(avgRating)?'#F59E0B':'rgba(255,255,255,0.3)'}/>
                ))}
                <Text style={s.ratingTxt}>{reviewCount>0?`${avgRating.toFixed(1)} · ${reviewCount} avis`:'Aucun avis'}</Text>
            </View>
          </View>
        </View>

        {/* KPIs */}
        <View style={s.kpiRow}>
          {[
            {icon:'package',  label:'Produits',  value:total,   color:'#A78BFA',bg:'rgba(167,139,250,0.15)'},
            {icon:'trending-up',label:'Actifs',  value:active,  color:GREEN,    bg:'rgba(34,197,94,0.12)'},
            {icon:'alert-circle',label:'Ruptures',value:rupture,color:'#EF4444',bg:'rgba(239,68,68,0.12)'},
          ].map((k,i)=>(
            <View key={i} style={[s.kpiCard,{borderColor:k.color+'30'}]}>
              <View style={[s.kpiIcon,{backgroundColor:k.bg}]}>
                <Feather name={k.icon as any} size={16} color={k.color}/>
              </View>
              <Text style={[s.kpiValue,{color:'#fff'}]}>{k.value}</Text>
              <Text style={s.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Carte surélevée ── */}
      <View style={s.floatingCard}>
        {/* Bouton ajouter */}
        <TouchableOpacity style={s.addBtn}
          onPress={()=>biz&&router.navigate({pathname:'/(pro)/catalog/edit',params:{businessId:biz.id}} as any)}
          activeOpacity={0.88}>
          <Feather name="plus" size={18} color="#fff"/>
          <Text style={s.addBtnTxt}>Ajouter un produit ou service</Text>
        </TouchableOpacity>

        {/* Actions rapides */}
        <View style={s.actionsRow}>
          {[
            {icon:'shopping-bag',label:'Commandes',color:'#7C3AED',bg:'#F5F3FF',
              onPress:()=>router.push('/(pro)/orders' as any)},
            {icon:'clock',label:'Horaires',color:'#059669',bg:'#F0FDF4',
              onPress:()=>biz&&router.push({pathname:'/(pro)/hours',params:{businessId:biz.id}} as any)},
            {icon:'share-2',label:'Partager',color:'#F59E0B',bg:'#FFFBEB',
              onPress:()=>{}},
          ].map((a,i)=>(
            <TouchableOpacity key={i} style={s.actionBtn} onPress={a.onPress} activeOpacity={0.8}>
              <View style={[s.actionIcon,{backgroundColor:a.bg}]}>
                <Feather name={a.icon as any} size={20} color={a.color}/>
              </View>
              <Text style={s.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Catalogue scrollable ── */}
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{padding:20,gap:14,paddingBottom:100}}>

        {/* Header catalogue */}
        <View style={{gap:2}}>
          <Text style={{fontSize:11,fontWeight:'700',color:'#9CA3AF',letterSpacing:1.2}}>CATALOGUE</Text>
          <View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}>
            <Text style={{fontSize:20,fontWeight:'800',color:'#111827'}}>Mes produits</Text>
            <TouchableOpacity onPress={()=>biz&&router.navigate({pathname:'/(pro)/business/[id]',params:{id:biz.id}} as any)}>
              <Text style={{fontSize:14,fontWeight:'600',color:ORANGE}}>Gérer tout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtres */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={{gap:8}}>
          {([['all','Tous'],['active','Actif'],['rupture','Rupture']] as [Filter,string][]).map(([f,l])=>(
            <TouchableOpacity key={f}
              style={[s.filterBtn, filter===f&&s.filterBtnActive]}
              onPress={()=>setFilter(f)}>
              <Text style={[s.filterTxt, filter===f&&s.filterTxtActive]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Liste produits */}
        {isLoading ? <ActivityIndicator color={ORANGE} style={{padding:20}}/> :
        filtered.length===0 ? (
          <View style={s.emptyWrap}>
            <Feather name="package" size={36} color="#D1D5DB"/>
            <Text style={{fontSize:14,fontWeight:'600',color:'#9CA3AF',marginTop:8}}>Aucun produit</Text>
          </View>
        ) : (
          filtered.map((item:any)=>{
            const st = statusBadge(item);
            const imgUrl = safeFirstUrl(item.image_url) || safeUrls(item.image_urls)[0];
            return (
              <TouchableOpacity key={item.id} style={s.itemCard}
                onPress={()=>biz&&router.navigate({pathname:'/(pro)/catalog/edit',params:{businessId:biz.id,serviceId:item.id}} as any)}
                activeOpacity={0.85}>
                {/* Image */}
                <View style={s.itemImgWrap}>
                  {imgUrl
                    ? <Image source={{uri:imgUrl}} style={s.itemImg}/>
                    : <Text style={{fontSize:30}}>{item.kind==='prestation'?'🛎️':'📦'}</Text>}
                </View>
                {/* Infos */}
                <View style={{flex:1,gap:3}}>
                  <Text style={s.itemName} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.itemPrice}>{(item.price??0).toLocaleString('fr-FR')} FCFA</Text>
                  <View style={{flexDirection:'row',alignItems:'center',gap:6}}>
                    {item.stock_quantity!=null&&(
                      <View style={{flexDirection:'row',alignItems:'center',gap:3}}>
                        <Feather name="clock" size={11} color="#9CA3AF"/>
                        <Text style={s.itemMeta}>
                          {item.stock_quantity>0?`${item.stock_quantity} en stock`:'Épuisé'}
                        </Text>
                      </View>
                    )}
                    {item.unit&&<Text style={s.itemMeta}>{item.unit}</Text>}
                    {item.service_category&&<Text style={s.itemMeta}>{
                      item.service_category==='at_merchant'?'Boutique':
                      item.service_category==='at_client'?'Domicile':'Hybride'
                    }</Text>}
                  </View>
                </View>
                {/* Badge + chevron */}
                <View style={{alignItems:'flex-end',gap:8}}>
                  <View style={[s.badge,{backgroundColor:st.bg}]}>
                    <Text style={[s.badgeTxt,{color:st.color}]}>{st.label}</Text>
                  </View>
                  <View style={s.chevron}>
                    <Feather name="chevron-right" size={16} color="#9CA3AF"/>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Infos boutique */}
        {biz && (
          <View style={s.infosCard}>
            <Text style={{fontSize:16,fontWeight:'800',color:'#111827',marginBottom:4}}>Infos boutique</Text>
            {[
              {icon:'arrow-up-right', sup:'LIEN PUBLIC',  val:biz.website||`bymoh.app/${biz.tag||biz.id?.slice(0,8)}`},
              {icon:'calendar',       sup:'CRÉÉE LE',     val:new Date(biz.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})},
              {icon:'tag',            sup:'CATÉGORIE',    val:biz.category||'—'},
            ].map((row,i)=>(
              <View key={i} style={[s.infoRow, i>0&&{borderTopWidth:1,borderTopColor:'#F3F4F6',marginTop:4,paddingTop:12}]}>
                <View style={s.infoIcon}><Feather name={row.icon as any} size={16} color="#6B7280"/></View>
                <View>
                  <Text style={s.infoSup}>{row.sup}</Text>
                  <Text style={s.infoVal}>{row.val}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  // Hero
  hero:          { backgroundColor:DARK, paddingBottom:68, paddingHorizontal:16 },
  heroNav:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:16 },
  bizPill:       { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(255,255,255,0.12)', borderRadius:100, paddingHorizontal:12, paddingVertical:7, borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  bizPillTxt:    { fontSize:13, fontWeight:'700', color:'rgba(255,255,255,0.85)' },
  settingsBtn:   { width:38, height:38, borderRadius:19, backgroundColor:'rgba(255,255,255,0.1)', alignItems:'center', justifyContent:'center' },
  bizDrop:       { backgroundColor:'rgba(255,255,255,0.1)', borderRadius:14, overflow:'hidden', marginBottom:12, borderWidth:1, borderColor:'rgba(255,255,255,0.12)' },
  bizDropItem:   { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:13, borderBottomWidth:1, borderBottomColor:'rgba(255,255,255,0.08)' },
  bizDropItemActive:{ backgroundColor:'rgba(255,104,53,0.15)' },
  bizDropTxt:    { fontSize:14, color:'rgba(255,255,255,0.8)', fontWeight:'600' },
  bizInfo:       { flexDirection:'row', alignItems:'flex-start', gap:14, marginBottom:20 },
  bizLogoWrap:   { position:'relative' },
  bizLogo:       { width:72, height:72, borderRadius:20, overflow:'hidden', resizeMode:'cover' },
  activeIndicator:{ position:'absolute', bottom:2, right:2, width:12, height:12, borderRadius:6, backgroundColor:GREEN, borderWidth:2, borderColor:DARK },
  bizName:       { fontSize:20, fontWeight:'900', color:'#fff' },
  bizMeta:       { fontSize:12, color:'rgba(255,255,255,0.55)' },
  ratingTxt:     { fontSize:12, color:'rgba(255,255,255,0.6)', fontWeight:'600' },
  kpiRow:        { flexDirection:'row', gap:10 },
  kpiCard:       { flex:1, backgroundColor:'rgba(255,255,255,0.06)', borderRadius:16, padding:12, gap:4, borderWidth:1 },
  kpiIcon:       { width:36, height:36, borderRadius:10, alignItems:'center', justifyContent:'center', marginBottom:4 },
  kpiValue:      { fontSize:22, fontWeight:'900' },
  kpiLabel:      { fontSize:11, color:'rgba(255,255,255,0.5)', fontWeight:'600' },
  // Floating card
  floatingCard:  { marginHorizontal:16, marginTop:-48, backgroundColor:'#fff', borderRadius:24, padding:16, gap:14, shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.10, shadowRadius:20, elevation:12 },
  addBtn:        { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:ORANGE, borderRadius:16, paddingVertical:16 },
  addBtnTxt:     { fontSize:15, fontWeight:'700', color:'#fff' },
  actionsRow:    { flexDirection:'row' },
  actionBtn:     { flex:1, alignItems:'center', gap:6 },
  actionIcon:    { width:48, height:48, borderRadius:24, alignItems:'center', justifyContent:'center' },
  actionLabel:   { fontSize:12, fontWeight:'600', color:'#374151' },
  // Filtres
  filterBtn:     { paddingHorizontal:16, paddingVertical:8, borderRadius:100, backgroundColor:'#F3F4F6' },
  filterBtnActive:{ backgroundColor:'#111827' },
  filterTxt:     { fontSize:14, fontWeight:'600', color:'#6B7280' },
  filterTxtActive:{ color:'#fff' },
  // Items
  itemCard:      { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#fff', borderRadius:18, padding:14, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  itemImgWrap:   { width:56, height:56, borderRadius:14, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center', overflow:'hidden', flexShrink:0 },
  itemImg:       { width:56, height:56, resizeMode:'cover' },
  itemName:      { fontSize:15, fontWeight:'700', color:'#111827' },
  itemPrice:     { fontSize:14, fontWeight:'700', color:ORANGE },
  itemMeta:      { fontSize:11, color:'#9CA3AF' },
  badge:         { paddingHorizontal:10, paddingVertical:4, borderRadius:100 },
  badgeTxt:      { fontSize:11, fontWeight:'700' },
  chevron:       { width:28, height:28, borderRadius:14, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  emptyWrap:     { alignItems:'center', paddingVertical:40 },
  // Infos boutique
  infosCard:     { backgroundColor:'#fff', borderRadius:20, padding:18, gap:10 },
  infoRow:       { flexDirection:'row', alignItems:'center', gap:12 },
  infoIcon:      { width:36, height:36, borderRadius:10, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center', flexShrink:0 },
  infoSup:       { fontSize:10, fontWeight:'700', color:'#9CA3AF', letterSpacing:0.8 },
  infoVal:       { fontSize:14, fontWeight:'600', color:'#111827', marginTop:1 },
});
