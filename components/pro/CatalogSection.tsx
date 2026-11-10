// components/pro/CatalogSection.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Image, Modal,
  Platform, Pressable, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRealtimeCatalog } from '@/hooks/useRealtimeOrders';
import { supabase } from '@/lib/supabase';
import { SuccessModal } from '@/components/SuccessModal';

const ORANGE = '#FF6835';
const GREEN  = '#22C55E';
const DARK   = '#111827';

// ─── Types ────────────────────────────────────────────────────────────────────

type KindTab      = 'all' | 'article' | 'prestation';
type StatusFilter = null | 'active' | 'indispo' | 'promo';
type PromoType    = 'percentage' | 'buy_x_get_y' | 'lot';

// ─── MiniCalendar — identique à edit.tsx ─────────────────────────────────────

const DAYS_FR   = ['Lu','Ma','Me','Je','Ve','Sa','Di'];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                   'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
const CAL_ORANGE = '#FF6835';

interface MiniCalendarProps {
  label: string;
  value: string;       // ISO YYYY-MM-DD or ''
  onChange: (v: string) => void;
  minDate?: Date;
}

function MiniCalendar({ label, value, onChange, minDate }: MiniCalendarProps) {
  const today = new Date(); today.setHours(0,0,0,0);
  const initDate = value ? new Date(value + 'T00:00:00') : (minDate ?? today);
  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1); }
    else setViewMonth(m => m-1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y+1); }
    else setViewMonth(m => m+1);
  };

  const firstDay    = new Date(viewYear, viewMonth, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(viewYear, viewMonth+1, 0).getDate();

  const cells: (number|null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_,i) => i+1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const minDay = minDate ? new Date(minDate) : today;
  minDay.setHours(0,0,0,0);

  const isSelected = (day: number) => {
    const mm = String(viewMonth+1).padStart(2,'0');
    const dd = String(day).padStart(2,'0');
    return `${viewYear}-${mm}-${dd}` === value;
  };
  const isDisabled = (day: number) => new Date(viewYear, viewMonth, day) < minDay;

  const selectDay = (day: number) => {
    const mm = String(viewMonth+1).padStart(2,'0');
    const dd = String(day).padStart(2,'0');
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const displayLabel = value
    ? new Date(value+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})
    : 'Choisir une date';

  return (
    <View style={{ flex:1 }}>
      <Text style={{ fontSize:11, fontWeight:'600', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.5, marginBottom:5 }}>
        {label}
      </Text>
      <TouchableOpacity onPress={() => setOpen(o => !o)} activeOpacity={0.75}
        style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
          borderWidth:1, borderColor: value ? CAL_ORANGE : '#E5E7EB',
          borderRadius:10, backgroundColor:'#F9FAFB', paddingHorizontal:10, paddingVertical:10 }}>
        <Text style={{ fontSize:13, color: value ? '#111827' : '#9CA3AF', flex:1 }}>{displayLabel}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#9CA3AF"/>
      </TouchableOpacity>
      {open && (
        <View style={{ marginTop:4, borderWidth:1, borderColor:'#E5E7EB', borderRadius:12,
          backgroundColor:'#fff', padding:10, zIndex:100 }}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Feather name="chevron-left" size={16} color="#374151"/>
            </TouchableOpacity>
            <Text style={{ fontSize:13, fontWeight:'700', color:'#111827' }}>
              {MONTHS_FR[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Feather name="chevron-right" size={16} color="#374151"/>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection:'row', marginBottom:4 }}>
            {DAYS_FR.map(d => (
              <Text key={d} style={{ flex:1, textAlign:'center', fontSize:10, fontWeight:'700', color:'#9CA3AF' }}>{d}</Text>
            ))}
          </View>
          {Array.from({ length: cells.length/7 }, (_,row) => (
            <View key={row} style={{ flexDirection:'row' }}>
              {cells.slice(row*7, row*7+7).map((day, col) => {
                if (!day) return <View key={col} style={{ flex:1, height:30 }}/>;
                const sel = isSelected(day);
                const dis = isDisabled(day);
                return (
                  <TouchableOpacity key={col} disabled={dis} onPress={() => selectDay(day)}
                    style={{ flex:1, height:30, alignItems:'center', justifyContent:'center',
                      borderRadius:15, backgroundColor: sel ? CAL_ORANGE : 'transparent' }}>
                    <Text style={{ fontSize:12, fontWeight: sel ? '700' : '400',
                      color: sel ? '#fff' : dis ? '#D1D5DB' : '#111827' }}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeFirstUrl(raw: any): string | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    if (raw.startsWith('[')) {
      try { const a = JSON.parse(raw); return Array.isArray(a) ? a[0] ?? null : null; }
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

// ─── Composant principal ──────────────────────────────────────────────────────

interface Props { businessId: string; }

export function CatalogSection({ businessId }: Props) {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  useRealtimeCatalog(businessId);

  const topPad = insets.top + 8;

  // Filtres liste
  const [kindTab,      setKindTab]      = useState<KindTab>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);

  // Action sheet
  const [actionItem,   setActionItem]   = useState<any>(null);

  // Modal "Ajouter" → choix type
  const [kindPickOpen, setKindPickOpen] = useState(false);

  // ── États promo (identiques à edit.tsx) ──────────────────────────────────
  const [promoItem,      setPromoItem]      = useState<any>(null);
  const [promoType,      setPromoType]      = useState<PromoType>('percentage');
  const [promoTypeOpen,  setPromoTypeOpen]  = useState(false);
  const [promoValue,     setPromoValue]     = useState('');       // %
  const [promoBuyQty,    setPromoBuyQty]    = useState('2');
  const [promoGetQty,    setPromoGetQty]    = useState('1');
  const [promoLotQty,    setPromoLotQty]    = useState('3');
  const [promoLotPrice,  setPromoLotPrice]  = useState('');
  const [promoStartDate, setPromoStartDate] = useState('');
  const [promoEndDate,   setPromoEndDate]   = useState('');
  const [promoSaving,    setPromoSaving]    = useState(false);

  // Feedback succès
  const [successVisible, setSuccessVisible] = useState(false);
  const [successMsg,     setSuccessMsg]     = useState('');

  // Animation action sheet
  const [actionSheetMounted, setActionSheetMounted] = useState(false);
  const overlayOpacity  = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(400)).current;

  const openActionSheet = (item: any) => {
    setActionItem(item);
    setActionSheetMounted(true);
    Animated.parallel([
      Animated.timing(overlayOpacity,  { toValue:1, duration:220, useNativeDriver:true }),
      Animated.spring(sheetTranslateY, { toValue:0, useNativeDriver:true, damping:22, stiffness:220 }),
    ]).start();
  };

  const closeActionSheet = () => {
    Animated.parallel([
      Animated.timing(overlayOpacity,  { toValue:0, duration:180, useNativeDriver:true }),
      Animated.timing(sheetTranslateY, { toValue:400, duration:200, useNativeDriver:true }),
    ]).start(() => {
      setActionItem(null);
      setActionSheetMounted(false);
    });
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setSuccessVisible(true);
  };

  const openPromo = (item: any) => {
    setPromoItem(item);
    setPromoType(item.promo_type ?? 'percentage');
    setPromoTypeOpen(false);
    setPromoValue(item.promo_value?.toString() ?? '');
    setPromoBuyQty(item.promo_buy_qty?.toString() ?? '2');
    setPromoGetQty(item.promo_get_qty?.toString() ?? '1');
    setPromoLotQty(item.promo_lot_qty?.toString() ?? '3');
    setPromoLotPrice(item.promo_lot_price?.toString() ?? '');
    setPromoStartDate(item.promo_start_date ?? '');
    setPromoEndDate(
      item.promo_ends_at ? item.promo_ends_at.substring(0,10) : ''
    );
    setActionItem(null);
  };

  const savePromo = async () => {
    // Validation selon le type
    if (promoType === 'percentage') {
      const v = parseFloat(promoValue);
      if (!promoValue || v <= 0 || v >= 100) {
        Alert.alert('Réduction invalide', 'La réduction doit être entre 1% et 99%.');
        return;
      }
    } else if (promoType === 'buy_x_get_y') {
      if (!promoBuyQty || !promoGetQty || parseInt(promoBuyQty) < 1 || parseInt(promoGetQty) < 1) {
        Alert.alert('Quantités invalides', 'Indique des quantités valides.');
        return;
      }
    } else if (promoType === 'lot') {
      if (!promoLotQty || !promoLotPrice || parseInt(promoLotQty) < 2 || parseFloat(promoLotPrice) <= 0) {
        Alert.alert('Lot invalide', 'Indique une quantité (≥2) et un prix de lot valides.');
        return;
      }
    }
    if (!promoStartDate || !promoEndDate) {
      Alert.alert('Dates manquantes', 'Choisis une date de début et de fin.');
      return;
    }
    if (promoEndDate <= promoStartDate) {
      Alert.alert('Dates invalides', 'La date de fin doit être après la date de début.');
      return;
    }

    setPromoSaving(true);
    const { error } = await supabase.from('services').update({
      promo_active:    true,
      promo_type:      promoType,
      promo_value:     promoType==='percentage' ? parseFloat(promoValue)||0 : null,
      promo_buy_qty:   promoType==='buy_x_get_y' ? parseInt(promoBuyQty)||2 : null,
      promo_get_qty:   promoType==='buy_x_get_y' ? parseInt(promoGetQty)||1 : null,
      promo_lot_qty:   promoType==='lot' ? parseInt(promoLotQty)||3 : null,
      promo_lot_price: promoType==='lot' ? parseFloat(promoLotPrice)||0 : null,
      promo_start_date: promoStartDate,
      promo_ends_at:   new Date(promoEndDate+'T23:59:59').toISOString(),
    }).eq('id', promoItem.id);
    setPromoSaving(false);

    if (error) { Alert.alert('Erreur', 'Impossible d\'enregistrer la promotion.'); return; }
    qc.invalidateQueries({ queryKey: ['catalog', businessId] });
    setPromoItem(null);
    showSuccess(promoItem.promo_active ? 'Promotion mise à jour !' : 'Promotion activée avec succès !');
  };

  const removePromo = () => {
    Alert.alert('Retirer la promo', 'Supprimer la promotion en cours ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Retirer', style: 'destructive', onPress: async () => {
          await supabase.from('services').update({
            promo_active: false, promo_type: null,
            promo_value: null, promo_buy_qty: null, promo_get_qty: null,
            promo_lot_qty: null, promo_lot_price: null,
            promo_start_date: null, promo_ends_at: null,
          }).eq('id', promoItem.id);
          qc.invalidateQueries({ queryKey: ['catalog', businessId] });
          setPromoItem(null);
          showSuccess('Promotion retirée.');
        },
      },
    ]);
  };

  // ── Données ───────────────────────────────────────────────────────────────

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['catalog', businessId],
    queryFn: async () => {
      const { data } = await supabase.from('services').select('*')
        .eq('business_id', businessId).order('created_at', { ascending: false });
      return data ?? [];
    },
    staleTime: 0, gcTime: 0, refetchOnMount: 'always',
  });

  const cntActive  = items.filter((i: any) => i.is_available && (i.stock_quantity==null||i.stock_quantity>0)).length;
  const cntIndispo = items.filter((i: any) => !i.is_available || (i.stock_quantity!=null&&i.stock_quantity<=0)).length;
  const cntPromo   = items.filter((i: any) => i.promo_active).length;

  const filtered = items.filter((i: any) => {
    if (kindTab==='article'    && i.kind!=='article')    return false;
    if (kindTab==='prestation' && i.kind!=='prestation') return false;
    if (statusFilter==='active')  return i.is_available && (i.stock_quantity==null||i.stock_quantity>0);
    if (statusFilter==='indispo') return !i.is_available || (i.stock_quantity!=null&&i.stock_quantity<=0);
    if (statusFilter==='promo')   return !!i.promo_active;
    return true;
  });

  const statusInfo = (item: any) => {
    if (!item.is_available)
      return { label:'Inactif', color:'#9CA3AF', bg:'#F3F4F6' };
    if (item.stock_quantity!=null && item.stock_quantity<=0)
      return { label:'Rupture', color:'#EF4444', bg:'#FEF2F2' };
    if (item.promo_active)
      return { label:'Promo',   color:ORANGE,    bg:'#FEF2EC' };
    return   { label:'Actif',   color:GREEN,     bg:'#F0FDF4' };
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleToggleActive = async (item: any) => {
    const nowActive = !item.is_available;
    closeActionSheet();
    await supabase.from('services').update({ is_available: nowActive }).eq('id', item.id);
    qc.invalidateQueries({ queryKey: ['catalog', businessId] });
    showSuccess(nowActive ? `"${item.title}" est maintenant actif.` : `"${item.title}" a été désactivé.`);
  };

  const handleDelete = (item: any) => {
    Alert.alert('Supprimer', `Supprimer "${item.title}" ?`, [
      { text:'Annuler', style:'cancel' },
      {
        text:'Supprimer', style:'destructive', onPress: async () => {
          closeActionSheet();
          const { error } = await supabase.functions.invoke('delete-service', { body:{ serviceId: item.id } });
          if (error) { Alert.alert('Erreur','La suppression a échoué. Réessaie.'); return; }
          qc.invalidateQueries({ queryKey:['catalog', businessId] });
          showSuccess(`"${item.title}" a été supprimé.`);
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex:1, backgroundColor:'#F2F2F7' }}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: topPad }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.navigate('/(pro)/boutique' as any)}>
          <Feather name="chevron-left" size={22} color="#fff"/>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Catalogue</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setKindPickOpen(true)}>
          <Feather name="plus" size={16} color="#fff"/>
          <Text style={s.addBtnTxt}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      {/* ── Onglets type ── */}
      <View style={[s.tabBar, { backgroundColor: DARK }]}>
        <View style={s.tabRow}>
          {([
            ['all','Tous'],['article','Articles'],['prestation','Services'],
          ] as [KindTab, string][]).map(([k, label]) => (
            <TouchableOpacity key={k}
              style={[s.tab, kindTab===k && s.tabActive]}
              onPress={() => setKindTab(k)}>
              <Text style={[s.tabTxt, kindTab===k && s.tabTxtActive]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding:16, gap:12, paddingBottom:80 }}>

        {/* ── Cards filtre statut ── */}
        <View style={s.filterRow}>
          {([
            { key:'active'  as StatusFilter, label:'Actifs',          value:cntActive,  color:GREEN,     bg:'#F0FDF4', border:'#BBF7D0' },
            { key:'indispo' as StatusFilter, label:'Non disponibles', value:cntIndispo, color:'#6B7280', bg:'#F9FAFB', border:'#E5E7EB' },
            { key:'promo'   as StatusFilter, label:'En promo',        value:cntPromo,   color:ORANGE,    bg:'#FFF8F5', border:'#FDDCCA' },
          ]).map(f => {
            const active = statusFilter === f.key;
            return (
              <TouchableOpacity key={f.key as string}
                style={[s.filterCard, { backgroundColor: active ? f.bg : '#fff', borderColor: active ? f.border : '#E5E7EB' }]}
                onPress={() => setStatusFilter(active ? null : f.key)}
                activeOpacity={0.75}>
                <Text style={[s.filterValue, { color: active ? f.color : DARK }]}>{f.value}</Text>
                <Text style={[s.filterLabel, { color: active ? f.color : '#9CA3AF' }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Liste ── */}
        {isLoading ? (
          <ActivityIndicator color={ORANGE} style={{ padding:40 }}/>
        ) : filtered.length === 0 ? (
          <View style={s.emptyWrap}>
            <Feather name="package" size={40} color="#D1D5DB"/>
            <Text style={s.emptyTxt}>Aucun article</Text>
          </View>
        ) : (
          filtered.map((item: any) => {
            const st      = statusInfo(item);
            const imgUrl  = safeFirstUrl(item.image_url) || safeUrls(item.image_urls)[0];
            const allUrls = [
              ...(safeFirstUrl(item.image_url) ? [safeFirstUrl(item.image_url)!] : []),
              ...safeUrls(item.image_urls).filter((u: string) => u !== safeFirstUrl(item.image_url)),
            ];
            const price = (item.price ?? 0).toLocaleString('fr-FR');
            const stock = item.stock_quantity != null
              ? item.stock_quantity > 0 ? `${item.stock_quantity} en stock` : 'Hors stock'
              : null;

            return (
              <View key={item.id} style={s.itemCard}>
                <View style={s.imgWrap}>
                  {imgUrl ? (
                    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                      style={{ width:64, height:64 }} scrollEnabled={allUrls.length>1}>
                      {allUrls.map((url: string, i: number) => (
                        <Image key={i} source={{ uri: url ?? undefined }}
                          style={{ width:64, height:64, resizeMode:'cover' }}/>
                      ))}
                    </ScrollView>
                  ) : (
                    <Text style={{ fontSize:28 }}>{item.kind==='prestation' ? '🛎️' : '📦'}</Text>
                  )}
                </View>
                <View style={{ flex:1, gap:2 }}>
                  <Text style={s.itemName} numberOfLines={1}>{item.title}</Text>
                  <Text style={s.itemCat} numberOfLines={1}>
                    {item.kind==='prestation'
                      ? (item.service_category==='at_merchant' ? 'Boutique'
                        : item.service_category==='at_client'  ? 'Domicile' : 'Hybride')
                      : 'Article'}
                  </Text>
                  <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
                    <Text style={s.itemPrice}>{price} FCFA</Text>
                    {stock && <Text style={s.itemStock}>· {stock}</Text>}
                  </View>
                </View>
                <View style={{ alignItems:'flex-end', gap:10 }}>
                  <View style={[s.badge, { backgroundColor: st.bg }]}>
                    <Text style={[s.badgeTxt, { color: st.color }]}>{st.label}</Text>
                  </View>
                  <TouchableOpacity style={s.menuBtn} onPress={() => openActionSheet(item)}>
                    <Feather name="more-vertical" size={18} color="#9CA3AF"/>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* ══════════════════════════════════════════════════
          Action sheet — fond fondu + sheet en slide
      ══════════════════════════════════════════════════ */}
      <Modal visible={actionSheetMounted} transparent animationType="none"
        onRequestClose={closeActionSheet}>
        {/* Overlay : fond qui s'estompe doucement */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor:'rgba(0,0,0,0.52)' }, { opacity: overlayOpacity }]}
          pointerEvents="box-none">
          <TouchableOpacity style={{ flex:1 }} activeOpacity={1} onPress={closeActionSheet}/>
        </Animated.View>

        {/* Sheet : glisse depuis le bas */}
        {actionItem && (
          <Animated.View style={[s.actionSheet, { transform:[{ translateY: sheetTranslateY }] }]}>
            <View style={s.sheetHandle}/>
            <View style={s.sheetHeader}>
              <View style={s.sheetImgWrap}>
                {(safeFirstUrl(actionItem.image_url) || safeUrls(actionItem.image_urls)[0])
                  ? <Image source={{ uri: (safeFirstUrl(actionItem.image_url) || safeUrls(actionItem.image_urls)[0]) ?? undefined }}
                      style={{ width:52, height:52, resizeMode:'cover' }}/>
                  : <Text style={{ fontSize:26 }}>{actionItem.kind==='prestation' ? '🛎️' : '📦'}</Text>}
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.sheetItemName}>{actionItem.title}</Text>
                <Text style={s.sheetItemSub}>
                  {(actionItem.price ?? 0).toLocaleString('fr-FR')} FCFA
                  {actionItem.stock_quantity != null ? ` · ${actionItem.stock_quantity} en stock` : ''}
                </Text>
              </View>
              <View style={[s.sheetBadge, { backgroundColor: statusInfo(actionItem).bg }]}>
                <Text style={[s.sheetBadgeTxt, { color: statusInfo(actionItem).color }]}>
                  {statusInfo(actionItem).label}
                </Text>
              </View>
            </View>
            <View style={s.divider}/>
            {[
              {
                icon:'edit-2', iconBg:'#FEF2EC', iconColor:ORANGE,
                label:'Modifier le produit', sub:'Éditer les infos, le prix, le stock',
                onPress: () => {
                  closeActionSheet();
                  setTimeout(() => router.navigate({ pathname:'/(pro)/catalog/edit', params:{ businessId, serviceId:actionItem.id } } as any), 220);
                },
              },
              {
                icon:'tag', iconBg:'#FFF8F5', iconColor:ORANGE,
                label: actionItem.promo_active ? 'Modifier la promotion' : 'Ajouter une promotion',
                sub: actionItem.promo_active
                  ? `Promo active · ${
                      actionItem.promo_type==='percentage' ? `${actionItem.promo_value}% de réduction`
                      : actionItem.promo_type==='buy_x_get_y' ? `${actionItem.promo_buy_qty} acheté, ${actionItem.promo_get_qty} offert`
                      : `Lot de ${actionItem.promo_lot_qty}`
                    }`
                  : 'Définir un type de réduction avec une période',
                onPress: () => { closeActionSheet(); setTimeout(() => openPromo(actionItem), 220); },
              },
              {
                icon: actionItem.is_available ? 'eye-off' : 'eye',
                iconBg:'#F3F4F6', iconColor:'#374151',
                label: actionItem.is_available ? 'Désactiver' : 'Réactiver',
                sub: actionItem.is_available
                  ? 'Masquer ce produit du catalogue clients'
                  : 'Rendre ce produit visible aux clients',
                onPress: () => handleToggleActive(actionItem),
              },
              {
                icon:'trash-2', iconBg:'#FEF2F2', iconColor:'#EF4444',
                label:'Supprimer', sub:'Action irréversible', labelColor:'#EF4444',
                onPress: () => handleDelete(actionItem),
              },
            ].map((a, i) => (
              <TouchableOpacity key={i} style={s.actionRow} onPress={a.onPress} activeOpacity={0.7}>
                <View style={[s.actionIcon, { backgroundColor:a.iconBg }]}>
                  <Feather name={a.icon as any} size={18} color={a.iconColor}/>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={[s.actionLabel, (a as any).labelColor && { color:(a as any).labelColor }]}>{a.label}</Text>
                  <Text style={s.actionSub}>{a.sub}</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#D1D5DB"/>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════
          Modal — formulaire promo (identique à edit.tsx)
      ══════════════════════════════════════════════════ */}
      <Modal visible={!!promoItem} transparent animationType="slide"
        onRequestClose={() => setPromoItem(null)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setPromoItem(null)}/>
        {promoItem && (
          <ScrollView style={s.promoSheet}
            contentContainerStyle={{ padding:20, paddingBottom:40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            <View style={s.sheetHandle}/>
            <Text style={s.promoTitle}>
              {promoItem.promo_active ? 'Modifier la promotion' : 'Ajouter une promotion'}
            </Text>
            <Text style={s.promoSub}>{promoItem.title}</Text>
            <View style={s.divider}/>

            {/* ── Type de promotion (dropdown identique à edit.tsx) ── */}
            <View style={p.field}>
              <Text style={p.label}>Type de promotion *</Text>
              <TouchableOpacity
                style={[p.input, { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:14 }]}
                onPress={() => setPromoTypeOpen(v => !v)}
                activeOpacity={0.85}>
                <Text style={{ fontSize:15, color:'#111827' }}>
                  {promoType==='percentage'   ? 'Réduction en pourcentage'
                  : promoType==='buy_x_get_y' ? 'X acheté, N offert'
                  : 'Prix en lot'}
                </Text>
                <Feather name={promoTypeOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280"/>
              </TouchableOpacity>
              {promoTypeOpen && (
                <View style={{ borderRadius:10, borderWidth:1, borderColor:'#E5E7EB', overflow:'hidden', marginTop:2, backgroundColor:'#fff' }}>
                  {([
                    { id:'percentage'  as PromoType, label:'Réduction en pourcentage' },
                    { id:'buy_x_get_y' as PromoType, label:'X acheté, N offert' },
                    { id:'lot'         as PromoType, label:'Prix en lot' },
                  ]).map((opt, i) => (
                    <TouchableOpacity key={opt.id}
                      style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                        paddingHorizontal:14, paddingVertical:13,
                        backgroundColor: promoType===opt.id ? '#FEF2EC' : '#fff',
                        borderTopWidth: i>0 ? 1 : 0, borderTopColor:'#F3F4F6' }}
                      onPress={() => { setPromoType(opt.id); setPromoTypeOpen(false); }}>
                      <Text style={{ fontSize:14, color:'#111827', fontWeight: promoType===opt.id ? '700' : '400' }}>
                        {opt.label}
                      </Text>
                      {promoType===opt.id && <Feather name="check" size={15} color={ORANGE}/>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* ── Champs selon le type ── */}
            {promoType==='percentage' && (
              <View style={p.field}>
                <Text style={p.label}>Réduction (%) *</Text>
                <View style={{ flexDirection:'row', alignItems:'center' }}>
                  <TextInput
                    style={[p.input, { flex:1, borderTopRightRadius:0, borderBottomRightRadius:0, borderRightWidth:0 }]}
                    value={promoValue} onChangeText={setPromoValue}
                    placeholder="Ex : 10" placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
                  <View style={{ width:44, height:50, backgroundColor:'#F3F4F6', borderWidth:1, borderColor:'#E5E7EB',
                    borderTopRightRadius:10, borderBottomRightRadius:10,
                    alignItems:'center', justifyContent:'center' }}>
                    <Text style={{ fontSize:16, color:'#6B7280', fontWeight:'600' }}>%</Text>
                  </View>
                </View>
              </View>
            )}

            {promoType==='buy_x_get_y' && (
              <View style={{ flexDirection:'row', gap:10 }}>
                <View style={[p.field, { flex:1 }]}>
                  <Text style={p.label}>Nombre acheté (X) *</Text>
                  <TextInput style={p.input} value={promoBuyQty} onChangeText={setPromoBuyQty}
                    keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                </View>
                <View style={[p.field, { flex:1 }]}>
                  <Text style={p.label}>Nombre offert (N) *</Text>
                  <TextInput style={p.input} value={promoGetQty} onChangeText={setPromoGetQty}
                    keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                </View>
              </View>
            )}

            {promoType==='lot' && (
              <View style={{ flexDirection:'row', gap:10 }}>
                <View style={[p.field, { flex:1 }]}>
                  <Text style={p.label}>Qté dans le lot *</Text>
                  <TextInput style={p.input} value={promoLotQty} onChangeText={setPromoLotQty}
                    placeholder="Ex : 3" keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                </View>
                <View style={[p.field, { flex:1 }]}>
                  <Text style={p.label}>Prix du lot *</Text>
                  <TextInput style={p.input} value={promoLotPrice} onChangeText={setPromoLotPrice}
                    placeholder="Ex : 5000" keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                </View>
              </View>
            )}

            {/* ── Durée : date début + date fin (côte à côte, identique à edit.tsx) ── */}
            <View style={p.field}>
              <Text style={p.label}>Durée de la promotion *</Text>
              <View style={{ flexDirection:'row', gap:10 }}>
                <MiniCalendar
                  label="Date de début"
                  value={promoStartDate}
                  onChange={setPromoStartDate}
                  minDate={new Date()}
                />
                <MiniCalendar
                  label="Date de fin"
                  value={promoEndDate}
                  onChange={setPromoEndDate}
                  minDate={promoStartDate ? new Date(promoStartDate+'T00:00:00') : new Date()}
                />
              </View>
              {promoStartDate && promoEndDate && promoEndDate <= promoStartDate && (
                <Text style={{ fontSize:11, color:'#DC2626', marginTop:2 }}>
                  ⚠ La date de fin doit être après la date de début
                </Text>
              )}
            </View>

            {/* ── CTA ── */}
            <View style={{ gap:10, marginTop:8 }}>
              <TouchableOpacity
                style={[s.promoCta, { opacity: promoSaving ? 0.7 : 1 }]}
                onPress={savePromo} disabled={promoSaving} activeOpacity={0.85}>
                {promoSaving
                  ? <ActivityIndicator color="#fff" size="small"/>
                  : <Text style={s.promoCtaTxt}>
                      {promoItem.promo_active ? 'Mettre à jour la promotion' : 'Activer la promotion'}
                    </Text>}
              </TouchableOpacity>

              {promoItem.promo_active && (
                <TouchableOpacity style={s.promoRemove} onPress={removePromo} activeOpacity={0.8}>
                  <Feather name="x-circle" size={15} color="#EF4444"/>
                  <Text style={s.promoRemoveTxt}>Retirer la promotion</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={s.promoCancel} onPress={() => setPromoItem(null)} activeOpacity={0.8}>
                <Text style={s.promoCancelTxt}>Annuler</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </Modal>

      {/* ══════════════════════════════════════════════════
          Feedback succès
      ══════════════════════════════════════════════════ */}
      <SuccessModal
        visible={successVisible}
        title="Succès !"
        message={successMsg}
        onClose={() => setSuccessVisible(false)}
      />

      {/* ══════════════════════════════════════════════════
          Modal — choix type Ajouter
      ══════════════════════════════════════════════════ */}
      <Modal visible={kindPickOpen} transparent animationType="fade"
        onRequestClose={() => setKindPickOpen(false)}>
        <Pressable style={s.kindOverlay} onPress={() => setKindPickOpen(false)}>
          <Pressable style={s.kindSheet} onPress={e => e.stopPropagation()}>
            <View style={s.kindHandle}/>
            <Text style={s.kindTitle}>Que souhaitez-vous ajouter ?</Text>
            <Text style={s.kindSub}>Choisissez le type avant de remplir le formulaire</Text>
            <View style={s.kindRow}>
              <TouchableOpacity
                style={[s.kindCard, { backgroundColor:'#FEF2EC', borderColor:'#FDDCCA' }]}
                activeOpacity={0.82}
                onPress={() => {
                  setKindPickOpen(false);
                  router.navigate({ pathname:'/(pro)/catalog/edit', params:{ businessId, defaultKind:'article' } } as any);
                }}>
                <Image source={require('@/assets/images/article.png')} style={s.kindCardImg} resizeMode="contain"/>
                <View style={{ flex:1 }}>
                  <Text style={s.kindCardTitle}>Article</Text>
                  <Text style={s.kindCardSub}>Produit physique avec stock & livraison</Text>
                </View>
                <Feather name="chevron-right" size={18} color={ORANGE}/>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.kindCard, { backgroundColor:'#F0FDF4', borderColor:'#BBF7D0' }]}
                activeOpacity={0.82}
                onPress={() => {
                  setKindPickOpen(false);
                  router.navigate({ pathname:'/(pro)/catalog/edit', params:{ businessId, defaultKind:'prestation' } } as any);
                }}>
                <Image source={require('@/assets/images/s_stars.png')} style={s.kindCardImg} resizeMode="contain"/>
                <View style={{ flex:1 }}>
                  <Text style={[s.kindCardTitle, { color:'#16A34A' }]}>Service</Text>
                  <Text style={s.kindCardSub}>Prestation réalisée sur rendez-vous</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#16A34A"/>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={s.kindCancel} onPress={() => setKindPickOpen(false)}>
              <Text style={s.kindCancelTxt}>Annuler</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles promo (identiques à edit.tsx) ────────────────────────────────────

const p = StyleSheet.create({
  field: { gap:6 },
  label: { fontSize:11, fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.4 },
  input: { backgroundColor:'#F3F4F6', borderRadius:12, paddingHorizontal:14, paddingVertical:13,
           fontSize:15, color:'#111827', borderWidth:1.5, borderColor:'#E5E7EB' },
});

// ─── Styles globaux ───────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Header
  header:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:16, paddingBottom:12, backgroundColor:DARK },
  backBtn:      { width:36, height:36, borderRadius:18, backgroundColor:'rgba(255,255,255,0.12)', alignItems:'center', justifyContent:'center' },
  headerTitle:  { fontSize:17, fontWeight:'800', color:'#fff' },
  addBtn:       { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:ORANGE, borderRadius:12, paddingHorizontal:14, paddingVertical:9 },
  addBtnTxt:    { fontSize:14, fontWeight:'700', color:'#fff' },

  // Onglets type
  tabBar:       { paddingTop:4, paddingBottom:14, paddingHorizontal:16 },
  tabRow:       { flexDirection:'row', backgroundColor:'rgba(255,255,255,0.1)', borderRadius:14, padding:3, gap:2 },
  tab:          { flex:1, alignItems:'center', paddingVertical:8, borderRadius:11 },
  tabActive:    { backgroundColor:'#fff' },
  tabTxt:       { fontSize:13, fontWeight:'600', color:'rgba(255,255,255,0.65)' },
  tabTxtActive: { fontSize:13, fontWeight:'700', color:DARK },

  // Cards filtre statut
  filterRow:    { flexDirection:'row', gap:10 },
  filterCard:   { flex:1, borderRadius:14, borderWidth:1.5, padding:12, gap:4 },
  filterValue:  { fontSize:22, fontWeight:'900' },
  filterLabel:  { fontSize:11, fontWeight:'600' },

  // Items
  itemCard:  { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#fff', borderRadius:18, padding:14, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  imgWrap:   { width:64, height:64, borderRadius:14, backgroundColor:'#F3F4F6', overflow:'hidden', alignItems:'center', justifyContent:'center', flexShrink:0 },
  itemName:  { fontSize:15, fontWeight:'700', color:DARK },
  itemCat:   { fontSize:12, color:'#9CA3AF' },
  itemPrice: { fontSize:14, fontWeight:'700', color:ORANGE },
  itemStock: { fontSize:12, color:'#9CA3AF' },
  badge:     { paddingHorizontal:10, paddingVertical:4, borderRadius:100 },
  badgeTxt:  { fontSize:11, fontWeight:'700' },
  menuBtn:   { width:32, height:32, borderRadius:16, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },

  // Fond modal
  modalBg:      { ...StyleSheet.absoluteFill, backgroundColor:'rgba(0,0,0,0.5)' },

  // Action sheet
  actionSheet:   { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, padding:20, gap:4 },
  sheetHandle:   { width:40, height:4, borderRadius:2, backgroundColor:'#E5E7EB', alignSelf:'center', marginBottom:12 },
  sheetHeader:   { flexDirection:'row', alignItems:'center', gap:14, marginBottom:4 },
  sheetImgWrap:  { width:52, height:52, borderRadius:14, backgroundColor:'#F3F4F6', overflow:'hidden', alignItems:'center', justifyContent:'center', flexShrink:0 },
  sheetItemName: { fontSize:16, fontWeight:'800', color:'#111827' },
  sheetItemSub:  { fontSize:13, color:'#9CA3AF', marginTop:2 },
  sheetBadge:    { paddingHorizontal:10, paddingVertical:4, borderRadius:100 },
  sheetBadgeTxt: { fontSize:11, fontWeight:'700' },
  divider:       { height:1, backgroundColor:'#F3F4F6', marginVertical:8 },
  actionRow:     { flexDirection:'row', alignItems:'center', gap:14, paddingVertical:14, borderBottomWidth:1, borderBottomColor:'#F9FAFB' },
  actionIcon:    { width:44, height:44, borderRadius:14, alignItems:'center', justifyContent:'center', flexShrink:0 },
  actionLabel:   { fontSize:15, fontWeight:'700', color:'#111827' },
  actionSub:     { fontSize:12, color:'#9CA3AF', marginTop:1 },

  // Promo sheet
  promoSheet:     { position:'absolute', bottom:0, left:0, right:0, backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, maxHeight:'92%' },
  promoTitle:     { fontSize:19, fontWeight:'800', color:DARK, marginBottom:2 },
  promoSub:       { fontSize:13, color:'#9CA3AF', marginBottom:4 },
  promoCta:       { borderRadius:14, paddingVertical:16, alignItems:'center', backgroundColor:ORANGE },
  promoCtaTxt:    { fontSize:15, fontWeight:'800', color:'#fff' },
  promoRemove:    { flexDirection:'row', alignItems:'center', gap:8, justifyContent:'center', borderRadius:14, paddingVertical:13, borderWidth:1, borderColor:'#FEE2E2', backgroundColor:'#FEF2F2' },
  promoRemoveTxt: { fontSize:14, fontWeight:'700', color:'#EF4444' },
  promoCancel:    { borderRadius:14, paddingVertical:14, alignItems:'center', backgroundColor:'#F3F4F6' },
  promoCancelTxt: { fontSize:14, fontWeight:'700', color:'#6B7280' },

  // Modal type Ajouter
  kindOverlay:   { flex:1, backgroundColor:'rgba(0,0,0,0.55)', alignItems:'center', justifyContent:'center', padding:24 },
  kindSheet:     { width:'100%', backgroundColor:'#fff', borderRadius:28, padding:24, alignItems:'center', gap:16, shadowColor:'#000', shadowOffset:{width:0,height:12}, shadowOpacity:0.18, shadowRadius:32, elevation:20 },
  kindHandle:    { width:40, height:4, borderRadius:2, backgroundColor:'#E5E7EB', marginBottom:4 },
  kindTitle:     { fontSize:20, fontWeight:'800', color:'#111827', textAlign:'center' },
  kindSub:       { fontSize:13, color:'#9CA3AF', textAlign:'center', marginTop:-8 },
  kindRow:       { flexDirection:'column', gap:10, width:'100%' },
  kindCard:      { flexDirection:'row', alignItems:'center', gap:14, borderRadius:18, padding:14, borderWidth:1.5 },
  kindCardImg:   { width:52, height:52, borderRadius:12 },
  kindCardTitle: { fontSize:16, fontWeight:'800', color:'#111827', marginBottom:2 },
  kindCardSub:   { fontSize:12, color:'#6B7280', lineHeight:17 },
  kindCancel:    { paddingVertical:14, paddingHorizontal:32, borderRadius:14, backgroundColor:'#F3F4F6', width:'100%', alignItems:'center' },
  kindCancelTxt: { fontSize:15, fontWeight:'700', color:'#6B7280' },

  // Vide
  emptyWrap: { alignItems:'center', paddingVertical:60, gap:10 },
  emptyTxt:  { fontSize:14, color:'#9CA3AF', fontWeight:'600' },
});
