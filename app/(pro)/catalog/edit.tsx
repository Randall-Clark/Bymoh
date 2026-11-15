// app/(pro)/catalog/edit.tsx
import { uploadImageToSupabase } from '@/lib/uploadImage';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, Image, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AvailabilityModal, SlotConfig } from '@/components/pro/AvailabilityModal';
import { ServiceCategoryPicker, ServiceCategory } from '@/components/pro/ServiceCategoryPicker';
import { SuccessModal } from '@/components/SuccessModal';
import { useDeliveryZoneGuard } from '@/components/DeliveryZoneSetupModal';

const { width: W } = Dimensions.get('window');
const ORANGE = '#FF6835';

type ItemKind       = 'article' | 'prestation';
type BillingType    = 'fixed' | 'hourly' | 'per_day' | 'per_unit' | 'free' | 'quote';
type MediaTab       = 'upload';
type FulfillmentType = 'pickup_only' | 'delivery_only' | 'both';

const FULFILLMENT_OPTIONS: { id: FulfillmentType; icon: any; label: string; sub: string; color: string; bg: string }[] = [
  { id: 'pickup_only',   icon: require('@/assets/images/pick-up_icon.png'),   label: 'Ramassage Uniquement', sub: "L'article ne peut pas être livré — retrait en boutique uniquement", color: '#FF6835', bg: '#FEF2EC' },
  { id: 'delivery_only', icon: require('@/assets/images/delivery_icon.png'),  label: 'Livraison Uniquement',  sub: "Disponible en ligne uniquement — pas de retrait en boutique",       color: '#7C3AED', bg: '#F5F3FF' },
  { id: 'both',          icon: require('@/assets/images/pick-del_icon.png'),  label: 'Ramasser ou Livrer',    sub: "Disponible en boutique ET en livraison",                            color: '#059669', bg: '#F0FDF4' },
];

interface BillingOption {
  id: BillingType; emoji: string; label: string;
  forArticle: boolean; forService: boolean;
}
const BILLING_OPTIONS: BillingOption[] = [
  { id:'fixed',  emoji:'💵', label:'Prix fixe',      forArticle:false, forService:true },
  { id:'hourly', emoji:'⏱️', label:'Tarif horaire',  forArticle:false, forService:true },
  { id:'quote',  emoji:'✂️', label:'Sur devis',      forArticle:false, forService:true },
];

const UNIT_SERVICE = [
  { id:'m2',       label:'m² — Surface'         },
  { id:'metre',    label:'Metre — Longueur'      },
  { id:'kg',       label:'Kg — Poids'            },
  { id:'piece',    label:'Piece / Tache / Unite' },
  { id:'appareil', label:'Appareil / Equipement' },
  { id:'km',       label:'km — Distance'         },
  { id:'autre',    label:'Autre / Personnalise'  },
];
const UNIT_ARTICLE = [
  { id:'kg',     label:'Kilogramme (kg)' },
  { id:'g',      label:'Gramme (g)'      },
  { id:'litre',  label:'Litre (L)'       },
  { id:'sachet', label:'Sachet / Sac'    },
  { id:'bol',    label:'Bol / Portion'   },
  { id:'metre',  label:'Metre (m)'       },
  { id:'unite',  label:'Unite'           },
  { id:'piece',  label:'Piece'           },
];

function generateId() { return Math.random().toString(36).slice(2,10)+Date.now().toString(36); }

// ─── Types personnalisation ───────────────────────────────────────────────────
interface CustomOption { id: string; label: string; price: string; }
interface CustomGroup  { id: string; name: string; required: boolean; options: CustomOption[]; }

export default function CatalogEditScreen() {
  const insets = useSafeAreaInsets();
  const { businessId, serviceId, defaultKind } = useLocalSearchParams<{
    businessId?:string; serviceId?:string; defaultKind?:string;
  }>();
  const isEditing = !!serviceId;
  const qc = useQueryClient();

  // ── Delivery zone guard ──────────────────────────────────────────────────────
  const { checkZones, DeliveryZoneModal } = useDeliveryZoneGuard(businessId ?? '');

  const [kind,           setKind]           = useState<ItemKind>(
    defaultKind==='article'||defaultKind==='prestation' ? defaultKind as ItemKind : 'article'
  );
  const kindStr = kind as string;

  // Resynchronise et réinitialise le formulaire si le param change (Expo Router réutilise l'instance)
  const prevDefaultKind = React.useRef<string|undefined>(defaultKind);
  useEffect(() => {
    if (!isEditing && (defaultKind==='article' || defaultKind==='prestation')) {
      if (prevDefaultKind.current !== defaultKind) {
        prevDefaultKind.current = defaultKind;
        kindInitDone.current = false;
        setKind(defaultKind as ItemKind);
        // Remettre tous les champs à zéro pour une nouvelle création
        setTitle(''); setDescription(''); setIsAvailable(true);
        setImages([]); setBillingType('fixed'); setPrice('');
        setUnit('kg'); setCustomUnit(''); setMinQty('1');
        setStockEnabled(false); setStockQty(''); setShowStock(false);
        setReturnsAccepted(false); setReturnPolicy('none');
        setReturnDays('14'); setServiceCategory('at_merchant');
        setTravelFee(''); setDurH('1'); setDurM('00');
        setPromoActive(false); setPromoType('percentage'); setPromoValue('');
        setPromoLotQty('3'); setPromoLotPrice(''); setPromoStartDate(''); setPromoEndDate('');
        setIsCustomizable(false); setCustomGroups([]); setOpenGroupId(null);
        setFulfillmentType('both');
      }
    }
  }, [defaultKind]);

  // Cartes pliables
  const [openCards, setOpenCards] = useState<Record<string,boolean>>({
    general: true, prix: true, stock: true, creneaux: true, deplacement: false,
  });
  const toggleCard = (key: string) =>
    setOpenCards(prev => ({ ...prev, [key]: !prev[key] }));

  // Infos générales
  const [title,          setTitle]          = useState('');
  const [description,    setDescription]    = useState('');
  const [isAvailable,    setIsAvailable]    = useState(true);

  // Images
  const [images,         setImages]         = useState<{uri?:string; url?:string}[]>([]);
  const [mediaSheetMounted,       setMediaSheetMounted]       = useState(false);
  const [fulfillmentSheetMounted, setFulfillmentSheetMounted] = useState(false);

  // Animated values — media modal
  const mediaOverlay    = useRef(new Animated.Value(0)).current;
  const mediaTranslateY = useRef(new Animated.Value(400)).current;

  // Animated values — fulfillment modal
  const fulfillOverlay    = useRef(new Animated.Value(0)).current;
  const fulfillTranslateY = useRef(new Animated.Value(400)).current;

  const openModal = (
    setMounted: (v: boolean) => void,
    overlay: Animated.Value,
    translateY: Animated.Value,
  ) => {
    setMounted(true);
    Animated.parallel([
      Animated.timing(overlay,     { toValue:1, duration:220, useNativeDriver:true }),
      Animated.spring(translateY,  { toValue:0, useNativeDriver:true, damping:22, stiffness:220 }),
    ]).start();
  };

  const closeModal = (
    setMounted: (v: boolean) => void,
    overlay: Animated.Value,
    translateY: Animated.Value,
    onDone?: () => void,
  ) => {
    Animated.parallel([
      Animated.timing(overlay,    { toValue:0, duration:180, useNativeDriver:true }),
      Animated.timing(translateY, { toValue:400, duration:200, useNativeDriver:true }),
    ]).start(() => { setMounted(false); onDone?.(); });
  };

  const openMedia       = () => openModal(setMediaSheetMounted,       mediaOverlay,   mediaTranslateY);
  const closeMedia      = (cb?: () => void) => closeModal(setMediaSheetMounted,       mediaOverlay,   mediaTranslateY, cb);
  const openFulfill     = () => openModal(setFulfillmentSheetMounted, fulfillOverlay, fulfillTranslateY);
  const closeFulfill    = (cb?: () => void) => closeModal(setFulfillmentSheetMounted, fulfillOverlay, fulfillTranslateY, cb);

  // Durée (timer HH:MM — toujours visible pour les prestations)
  const [durH,           setDurH]           = useState('');
  const [durM,           setDurM]           = useState('');

  // Facturation
  const [billingType,    setBillingType]    = useState<BillingType>('fixed');
  const [price,          setPrice]          = useState('');
  const [unit,           setUnit]           = useState('kg');
  const [unitOpen,       setUnitOpen]       = useState(false);
  const [customUnit,     setCustomUnit]     = useState('');
  const [minQty,         setMinQty]         = useState('1');

  // Stock (article)
  const [stockEnabled,   setStockEnabled]   = useState(false);
  const [stockQty,       setStockQty]       = useState('');
  const [showStock,      setShowStock]      = useState(false);
  const [returnsAccepted,setReturnsAccepted]= useState(false);
  const [returnPolicy,   setReturnPolicy]   = useState<'none'|'yes'|'conditions'>('none');
  const [returnDays,     setReturnDays]     = useState('7');
  const [returnMaxAmount,setReturnMaxAmount]= useState('');
  const [exchangeOk,     setExchangeOk]     = useState(false);

  // Catégorie service
  const [catPickerOpen,  setCatPickerOpen]  = useState(false);
  const [serviceCategory,setServiceCategory]= useState<ServiceCategory>('at_merchant');
  const [travelFee,      setTravelFee]      = useState('');

  // Fulfillment (article)
  const [fulfillmentType,    setFulfillmentType]    = useState<FulfillmentType>('both');

  // Personnalisation
  const [isCustomizable, setIsCustomizable] = useState(false);
  const [customGroups,   setCustomGroups]   = useState<CustomGroup[]>([]);
  const [openGroupId,    setOpenGroupId]    = useState<string|null>(null);

  // Promotions
  const [promoActive,      setPromoActive]      = useState(false);
  const [promoType,        setPromoType]        = useState<'percentage'|'buy_x_get_y'|'lot'>('percentage');
  const [promoTypeOpen,    setPromoTypeOpen]    = useState(false);
  const [promoValue,       setPromoValue]       = useState('');
  const [promoBuyQty,      setPromoBuyQty]      = useState('2');
  const [promoGetQty,      setPromoGetQty]      = useState('1');
  const [promoLotQty,      setPromoLotQty]      = useState('3');
  const [promoLotPrice,    setPromoLotPrice]    = useState('');
  const [promoStartDate,   setPromoStartDate]   = useState('');
  const [promoEndDate,     setPromoEndDate]     = useState('');

  // Créneaux
  const [slotModalOpen,  setSlotModalOpen]  = useState(false);
  const [pendingSlots,   setPendingSlots]   = useState<SlotConfig[]>([]);
  const [slotsModified,  setSlotsModified]  = useState(false); // true seulement si le pro a reconfiguré

  // Succès
  const [saving,         setSaving]         = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successMsg,     setSuccessMsg]     = useState('');

  const { data: bizHours = [] } = useQuery({
    queryKey: ['biz-hours', businessId],
    queryFn: async () => {
      const { data } = await supabase.from('business_hours').select('*').eq('business_id', businessId!);
      return data ?? [];
    },
    enabled: !!businessId,
  });

  useEffect(() => {
    if (!isEditing || !serviceId) return;
    supabase.from('services').select('*').eq('id', serviceId).single()
      .then(({ data }: { data: any }) => {
        if (!data) return;
        setKind(data.kind ?? 'article');
        setTitle(data.title ?? '');
        setDescription(data.description ?? '');
        setIsAvailable(data.is_available ?? true);
        setBillingType(data.billing_type ?? 'fixed');
        setPrice(data.price?.toString() ?? '');
        const dbUnit = data.unit ?? 'kg';
        const known = [...UNIT_SERVICE,...UNIT_ARTICLE].map(u=>u.id);
        if (known.includes(dbUnit)) setUnit(dbUnit); else { setUnit('autre'); setCustomUnit(dbUnit); }
        setMinQty(data.min_quantity?.toString() ?? '1');
        const sq = data.stock_quantity;
        setStockEnabled(sq != null && sq > 0);
        setStockQty(sq?.toString() ?? '');
        setShowStock(!!data.show_stock);
        setReturnsAccepted(!!(data as any).returns_accepted);
        setReturnPolicy((data as any).return_policy ?? 'none');
        setReturnDays((data as any).return_days?.toString() ?? '7');
        setReturnMaxAmount((data as any).return_max_amount?.toString() ?? '');
        setExchangeOk(!!(data as any).exchange_ok);
        setServiceCategory(data.service_category ?? 'at_merchant');
        setTravelFee(data.travel_fee?.toString() ?? '');
        setPromoActive(data.promo_active ?? false);
        setPromoType(data.promo_type ?? 'percentage');
        setPromoValue(data.promo_value?.toString() ?? '');
        setPromoBuyQty(data.promo_buy_qty?.toString() ?? '2');
        setPromoGetQty(data.promo_get_qty?.toString() ?? '1');
        setPromoLotQty(data.promo_lot_qty?.toString() ?? '3');
        setPromoLotPrice(data.promo_lot_price?.toString() ?? '');
        setPromoStartDate(data.promo_start_date ?? '');
        setPromoEndDate(data.promo_ends_at ? data.promo_ends_at.substring(0,10) : '');
        setFulfillmentType((data as any).fulfillment_type ?? 'both');
        if (data.duration_minutes) {
          const mins = data.duration_minutes;
          setDurH(String(Math.floor(mins / 60)));
          setDurM(String(mins % 60));
        }
        const dbUrls: string[] = data.image_urls
          ? (typeof data.image_urls==='string' ? JSON.parse(data.image_urls) : data.image_urls)
          : (data.image_url ? [data.image_url] : []);
        setImages(dbUrls.map((url:string) => ({ url })));
        // Personnalisation
        setIsCustomizable(!!(data as any).is_customizable);
        const rawCustom = (data as any).customizations;
        if (rawCustom) {
          const parsed = typeof rawCustom === 'string' ? JSON.parse(rawCustom) : rawCustom;
          if (Array.isArray(parsed)) {
            setCustomGroups(parsed.map((g: any) => ({
              id: g.id ?? generateId(),
              name: g.name ?? '',
              required: !!g.required,
              options: (g.options ?? []).map((o: any) => ({
                id: o.id ?? generateId(),
                label: o.label ?? '',
                price: (o.price ?? 0).toString(),
              })),
            })));
          }
        }
        // Créneaux existants — charger pour afficher le compteur et passer la validation
        if (data.kind === 'prestation') {
          const today = new Date().toISOString().split('T')[0];
          supabase
            .from('service_availability')
            .select('date, start_time, end_time, max_slots')
            .eq('service_id', serviceId)
            .gte('date', today)
            .order('date').order('start_time')
            .then(({ data: slotRows }) => {
              if (slotRows && slotRows.length > 0) {
                setPendingSlots(slotRows as SlotConfig[]);
                setSlotsModified(false); // chargés depuis DB, pas encore modifiés
              }
            });
        }
      });
  }, [serviceId]);

  // Ouvre le picker de catégorie / fulfillment uniquement quand defaultKind arrive (première fois)
  const kindInitDone = React.useRef(false);
  useEffect(() => {
    if (isEditing) return;
    if (!kindInitDone.current) {
      kindInitDone.current = true;
      if (kind==='prestation') setCatPickerOpen(true);
      if (kind==='article')    openFulfill();
    }
  }, [kind]);


  const uploadImages = async (id: string): Promise<string[]> => {
    const results: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img.url && !img.uri) {
        results.push(img.url.split('?t=')[0]);
      } else if (img.uri) {
        try {
          const ext = (img.uri.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase();
          // Stocker dans services/{businessId}/ pour isoler les images par boutique
          const path = `services/${businessId}/${id}_${i}.${ext}`;
          const url = await uploadImageToSupabase(img.uri, 'businesses', path);
          if (url) results.push(url);
        } catch (e) { console.warn('Upload img', i, e); }
      }
    }
    return results;
  };

  const getDurationMinutes = (): number | null => {
    const total = parseInt(durH||'0')*60 + parseInt(durM||'0');
    return total > 0 ? total : null;
  };

  const getDurationLabel = () => {
    const h = parseInt(durH||'0');
    const m = parseInt(durM||'0');
    if (h === 0 && m === 0) return '';
    if (h === 0) return `${m} min`;
    if (m === 0) return `${h}h`;
    return `${h}h${m.toString().padStart(2,'0')}`;
  };

  // ─── Helpers groupes/options ──────────────────────────────────────────────
  const addGroup = () => {
    const newId = generateId();
    setCustomGroups(prev => [...prev, { id: newId, name: '', required: true, options: [] }]);
    setOpenGroupId(newId);
  };

  const updateGroup = (gId: string, patch: Partial<CustomGroup>) => {
    setCustomGroups(prev => prev.map(g => g.id === gId ? { ...g, ...patch } : g));
  };

  const removeGroup = (gId: string) => {
    setCustomGroups(prev => prev.filter(g => g.id !== gId));
  };

  const addOption = (gId: string) => {
    setCustomGroups(prev => prev.map(g =>
      g.id === gId
        ? { ...g, options: [...g.options, { id: generateId(), label: '', price: '0' }] }
        : g
    ));
  };

  const updateOption = (gId: string, oId: string, patch: Partial<CustomOption>) => {
    setCustomGroups(prev => prev.map(g =>
      g.id === gId
        ? { ...g, options: g.options.map(o => o.id === oId ? { ...o, ...patch } : o) }
        : g
    ));
  };

  const removeOption = (gId: string, oId: string) => {
    setCustomGroups(prev => prev.map(g =>
      g.id === gId ? { ...g, options: g.options.filter(o => o.id !== oId) } : g
    ));
  };

  const save = async () => {
    // Vérifier que la boutique n'est pas suspendue
    if (businessId) {
      const { data: bizStatus } = await supabase
        .from('businesses')
        .select('status')
        .eq('id', businessId)
        .single();
      if (bizStatus?.status === 'suspended') {
        Alert.alert('Boutique suspendue', 'Les modifications sont désactivées pendant la suspension.');
        return;
      }
    }

    if (!title.trim()) { Alert.alert('Erreur','Le nom est requis.'); return; }
    if (images.length === 0) { Alert.alert('Photo requise','Ajoute au moins une photo.'); return; }
    if (kind === 'article' && stockEnabled) {
      const s = parseInt(stockQty || '0');
      if (s < 1) { Alert.alert('Stock invalide', 'Le stock minimum est de 1 article.'); return; }
    }
    if (!businessId)   { Alert.alert('Erreur','Boutique introuvable.'); return; }

    // Bloquer la sauvegarde si livraison sélectionnée sans zones configurées
    if (kind === 'article' && (fulfillmentType === 'delivery_only' || fulfillmentType === 'both')) {
      const { count: zoneCount } = await supabase
        .from('delivery_zones')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId);
      if ((zoneCount ?? 0) === 0) {
        Alert.alert(
          'Zones de livraison requises',
          'Tu dois configurer au moins une zone de livraison avant de proposer cet article à la livraison.',
          [
            { text: 'Configurer', onPress: checkZones },
            { text: 'Annuler', style: 'cancel' },
          ]
        );
        return;
      }
    }
    if (kind==='prestation' && !getDurationMinutes()) {
      Alert.alert('Durée requise','Indique la durée estimée de ta prestation.'); return;
    }
    // Validation personnalisation
    if (isCustomizable) {
      for (const g of customGroups) {
        if (!g.name.trim()) { Alert.alert('Erreur', 'Chaque groupe doit avoir un nom.'); return; }
        if (g.options.length === 0) { Alert.alert('Erreur', `Le groupe "${g.name}" doit avoir au moins une option.`); return; }
        for (const o of g.options) {
          if (!o.label.trim()) { Alert.alert('Erreur', 'Chaque option doit avoir un nom.'); return; }
        }
      }
    }
    setSaving(true);
    try {
      const id = serviceId ?? generateId();
      const uploadedUrls = await uploadImages(id);
      // Articles → billing fixe implicite ; Services → billing choisi par le marchand
      const effectiveBilling = kind==='article' ? 'fixed' : billingType;
      const showPrice = effectiveBilling !== 'quote';
      // Sérialiser les groupes de personnalisation
      const customizationsPayload = isCustomizable
        ? customGroups.map(g => ({
            id: g.id, name: g.name, required: g.required,
            options: g.options.map(o => ({
              id: o.id, label: o.label, price: parseFloat(o.price) || 0,
            })),
          }))
        : [];
      const payload: Record<string,any> = {
        id, business_id: businessId, kind,
        title: title.trim(), description: description.trim(),
        image_url:  uploadedUrls[0] ?? null,
        image_urls: JSON.stringify(uploadedUrls),
          price: showPrice ? parseFloat(price)||0 : 0,
        currency:   'FCFA',
        billing_type:     effectiveBilling,
        unit:             null,
        min_quantity:     null,
        stock_quantity:   kind==='article' && stockEnabled ? parseInt(stockQty)||0 : null,
        show_stock:       kind==='article' && stockEnabled ? showStock : false,
        returns_accepted: kind==='article' ? returnsAccepted : false,
        return_policy:    kind==='article' ? returnPolicy : 'none',
        return_days:      kind==='article' && returnPolicy!=='none' ? parseInt(returnDays)||7 : null,
        return_max_amount:kind==='article' && returnPolicy!=='none' && returnMaxAmount ? parseFloat(returnMaxAmount) : null,
        exchange_ok:      kind==='article' ? exchangeOk : false,
        is_available:     isAvailable,
        allows_booking:   kind==='prestation',
        duration_minutes: getDurationMinutes(),
        service_category: kind==='prestation' ? serviceCategory : null,
        travel_fee:       kind==='prestation' && ['at_client','hybrid'].includes(serviceCategory) && travelFee ? parseFloat(travelFee) : null,
        promo_active:     promoActive,
        promo_type:       promoActive ? promoType : null,
        promo_value:      promoActive && promoType==='percentage' ? parseFloat(promoValue)||0 : null,
        promo_buy_qty:    promoActive && promoType==='buy_x_get_y' ? parseInt(promoBuyQty)||2 : null,
        promo_get_qty:    promoActive && promoType==='buy_x_get_y' ? parseInt(promoGetQty)||1 : null,
        promo_lot_qty:    promoActive && promoType==='lot' ? parseInt(promoLotQty)||3 : null,
        promo_lot_price:  promoActive && promoType==='lot' ? parseFloat(promoLotPrice)||0 : null,
        promo_start_date: promoActive && promoStartDate ? promoStartDate : null,
        promo_ends_at:    promoActive && promoEndDate ? new Date(promoEndDate+'T23:59:59').toISOString() : null,
        fulfillment_type: kind==='article' ? fulfillmentType : null,
        is_customizable:  isCustomizable,
        customizations:   JSON.stringify(customizationsPayload),
      };
      let error;
      if (isEditing) {
        const r = await supabase.from('services').update(payload).eq('id', id);
        error = r.error;
      } else {
        const r = await supabase.from('services').insert(payload);
        error = r.error;
      }
      if (error) throw error;
      await qc.invalidateQueries({ queryKey:['catalog', businessId] });
      await qc.invalidateQueries({ queryKey:['biz-client', businessId] });
      await qc.invalidateQueries({ queryKey:['cat-client', businessId] });
      // Nouvelle prestation → aller configurer les créneaux
      if (!isEditing && kind==='prestation') {
        router.replace({ pathname:'/(pro)/catalog/slots', params:{ id, durationMin: String(getDurationMinutes()??60), businessId: businessId??'' } } as any);
        return;
      }
      await new Promise(r => setTimeout(r, 1500));
      setSuccessMsg(isEditing ? 'Mis a jour avec succes.' : 'Article cree avec succes !');
      setSuccessVisible(true);
    } catch (err:any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de sauvegarder.');
    } finally {
      setSaving(false);
    }
  };

  const billingOptions = BILLING_OPTIONS.filter(b => b.forService); // articles ont leur propre bloc simplifié
  const units = kindStr==='prestation' ? UNIT_SERVICE : UNIT_ARTICLE;
  const durationMin = Math.max(15, getDurationMinutes() ?? 60);

  const CAT_INFO: Record<ServiceCategory,{emoji:string;label:string;color:string;bg:string}> = {
    at_merchant:  {emoji:'🏪',label:'Chez le marchand', color:'#1E3A5F',bg:'#EEF2FF'},
    at_client:    {emoji:'🏠',label:'Chez le client',   color:'#7C3AED',bg:'#F5F3FF'},
    hybrid:       {emoji:'🔄',label:'Hybride',          color:'#059669',bg:'#F0FDF4'},
  };

  const BLUE = '#2563EB';

  return (
    <View style={{flex:1,backgroundColor:'#F8F7F4'}}>
      {/* Header */}
      <View style={[s.header,{paddingTop:(Platform.OS==='ios'?insets.top:insets.top)+8}]}>
        <TouchableOpacity style={s.backBtn} onPress={()=>{ router.navigate('/(pro)/boutique' as any); }}>
          <Feather name="arrow-left" size={20} color="#111827"/>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditing?'Modifier':'Nouveau'} {kind==='article'?'article':'service'}</Text>
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{paddingHorizontal:20,paddingTop:16,paddingBottom:60,gap:16}}
          keyboardShouldPersistTaps="handled">

          {/* ── Grande carte unique : tout le formulaire ── */}
          <View style={s.flatCard}>
            <Text style={s.sectionTitle}>Informations du service</Text>

            {/* Badge catégorie service — KEEP EXISTING STYLE */}
            {kind==='prestation' && (()=>{
              const cat = CAT_INFO[serviceCategory];
              return (
                <TouchableOpacity style={[s.catBadge,{backgroundColor:cat.bg,borderColor:cat.color+'40'}]}
                  onPress={()=>setCatPickerOpen(true)}>
                  <Text style={{fontSize:22}}>{cat.emoji}</Text>
                  <View style={{flex:1}}>
                    <Text style={[s.catBadgeLabel,{color:cat.color}]}>{cat.label}</Text>
                    <Text style={s.catBadgeSub}>Appuyer pour changer</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={cat.color}/>
                </TouchableOpacity>
              );
            })()}

            {/* Badge fulfillment article — KEEP EXISTING STYLE */}
            {kind==='article' && (()=>{
              const ff = FULFILLMENT_OPTIONS.find(o=>o.id===fulfillmentType) ?? FULFILLMENT_OPTIONS[2];
              return (
                <TouchableOpacity style={[s.catBadge,{backgroundColor:ff.bg,borderColor:ff.color+'40'}]}
                  onPress={openFulfill}>
                  <Image source={ff.icon} style={{width:26,height:26}} resizeMode="contain"/>
                  <View style={{flex:1}}>
                    <Text style={[s.catBadgeLabel,{color:ff.color}]}>{ff.label}</Text>
                    <Text style={s.catBadgeSub}>Appuyer pour changer le mode de retrait/livraison</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={ff.color}/>
                </TouchableOpacity>
              );
            })()}

            {/* Photos — KEEP EXISTING STYLE */}
            {images.length===0 ? (
              <TouchableOpacity style={s.imgBtnEmpty} onPress={openMedia} activeOpacity={0.85}>
                <View style={s.imgBtnEmptyIcon}><Feather name="camera" size={24} color="#9CA3AF"/></View>
                <Text style={s.imgBtnEmptyTxt}>Ajouter des photos *</Text>
                <Text style={s.imgBtnEmptySub}>1 photo minimum — 4 maximum</Text>
              </TouchableOpacity>
            ) : (
              <View style={{flexDirection:'row',flexWrap:'wrap',gap:10}}>
                {images.map((img,i)=>(
                  <View key={i} style={{position:'relative',width:100,height:100}}>
                    <Image source={{uri:img.uri??img.url!}}
                      style={{width:100,height:100,borderRadius:14,resizeMode:'cover'}}/>
                    <TouchableOpacity
                      style={{position:'absolute',top:4,right:4,width:22,height:22,borderRadius:11,backgroundColor:'rgba(0,0,0,0.6)',alignItems:'center',justifyContent:'center'}}
                      onPress={()=>setImages(prev=>prev.filter((_,j)=>j!==i))}>
                      <Feather name="x" size={12} color="#fff"/>
                    </TouchableOpacity>
                    {i===0&&(
                      <View style={{position:'absolute',bottom:4,left:4,backgroundColor:'rgba(0,0,0,0.55)',borderRadius:6,paddingHorizontal:6,paddingVertical:2}}>
                        <Text style={{fontSize:9,color:'#fff',fontWeight:'700'}}>PRINCIPALE</Text>
                      </View>
                    )}
                  </View>
                ))}
                {images.length<4&&(
                  <TouchableOpacity style={s.imgBtnAdd} onPress={openMedia} activeOpacity={0.85}>
                    <Feather name="plus" size={22} color="#9CA3AF"/>
                    <Text style={{fontSize:11,color:'#9CA3AF',fontWeight:'600'}}>{images.length}/4</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Séparateur */}
            <View style={{height:1,backgroundColor:'#F3F4F6'}}/>

            {/* Nom */}
            <View style={s.flatField}>
              <Text style={s.label}>Nom du service *</Text>
              <TextInput style={s.flatInput} value={title} onChangeText={setTitle}
                placeholder={kind==='prestation'?'Ex : Coupe femme, Massage...':'Ex : Riz local, Savon...'}
                placeholderTextColor="#9CA3AF"/>
            </View>

            {/* Description */}
            <View style={s.flatField}>
              <Text style={s.label}>Description *</Text>
              <TextInput style={[s.flatInput,{height:90,textAlignVertical:'top',paddingTop:12}]}
                value={description} onChangeText={setDescription}
                placeholder="Décrivez ce que vous proposez..." placeholderTextColor="#9CA3AF" multiline/>
            </View>

            {/* Durée estimée */}
            {kind==='prestation'&&(
              <View style={s.flatField}>
                <Text style={s.label}>Durée estimée *</Text>
                <View style={{flexDirection:'row',alignItems:'stretch',gap:10}}>
                  {/* Heures */}
                  <View style={{flex:1,flexDirection:'row',height:48}}>
                    <TextInput
                      style={[s.flatInput,{flex:1,borderTopRightRadius:0,borderBottomRightRadius:0,borderRightWidth:0,textAlign:'center',height:48,paddingVertical:0}]}
                      value={durH}
                      onChangeText={v=>setDurH(v.replace(/[^0-9]/g,''))}
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor="#9CA3AF"
                      maxLength={2}
                    />
                    <View style={{backgroundColor:'#F3F4F6',borderWidth:1,borderColor:'#E5E7EB',
                                  borderTopRightRadius:10,borderBottomRightRadius:10,
                                  width:40,alignItems:'center',justifyContent:'center'}}>
                      <Text style={{fontSize:13,fontWeight:'600',color:'#6B7280'}}>h</Text>
                    </View>
                  </View>
                  {/* Minutes */}
                  <View style={{flex:1,flexDirection:'row',height:48}}>
                    <TextInput
                      style={[s.flatInput,{flex:1,borderTopRightRadius:0,borderBottomRightRadius:0,borderRightWidth:0,textAlign:'center',height:48,paddingVertical:0}]}
                      value={durM}
                      onChangeText={v=>{
                        const n = parseInt(v.replace(/[^0-9]/g,'')||'0');
                        setDurM(n>59?'59':v.replace(/[^0-9]/g,''));
                      }}
                      keyboardType="number-pad"
                      placeholder="00"
                      placeholderTextColor="#9CA3AF"
                      maxLength={2}
                    />
                    <View style={{backgroundColor:'#F3F4F6',borderWidth:1,borderColor:'#E5E7EB',
                                  borderTopRightRadius:10,borderBottomRightRadius:10,
                                  width:44,alignItems:'center',justifyContent:'center'}}>
                      <Text style={{fontSize:13,fontWeight:'600',color:'#6B7280'}}>min</Text>
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Frais de déplacement (inline si at_client/hybrid) */}
            {kind==='prestation'&&(serviceCategory==='at_client'||serviceCategory==='hybrid')&&(
              <View style={s.flatField}>
                <Text style={s.label}>Frais de déplacement</Text>
                <TextInput style={s.flatInput} value={travelFee} onChangeText={setTravelFee}
                  placeholder="Laisser vide si inclus dans le prix"
                  placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
              </View>
            )}

            {/* Séparateur */}
            <View style={{height:1,backgroundColor:'#F3F4F6'}}/>

            {/* Prix */}
            <View style={s.flatField}>
              <Text style={s.label}>Prix *</Text>
              <TextInput style={s.flatInput} value={price} onChangeText={setPrice}
                placeholder="Ex : 5 000" placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
            </View>

            {/* Séparateur */}
            <View style={{height:1,backgroundColor:'#F3F4F6'}}/>

            {/* Disponible */}
            <View style={s.switchRow}>
              <View style={{flex:1}}>
                <Text style={s.switchLabel}>Disponible</Text>
                <Text style={s.switchSub}>Visible et commandable par les clients</Text>
              </View>
              <Switch value={isAvailable} onValueChange={setIsAvailable}
                trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
            </View>

            {/* Séparateur */}
            <View style={{height:1,backgroundColor:'#F3F4F6'}}/>

            {/* Personnalisation */}
            <View style={s.switchRow}>
              <View style={{flex:1}}>
                <Text style={s.switchLabel}>Personnalisation</Text>
                <Text style={s.switchSub}>Tailles, couleurs, options — s'ajoutent au prix</Text>
              </View>
              <Switch
                value={isCustomizable}
                onValueChange={v=>{
                  setIsCustomizable(v);
                  if (!v) { setCustomGroups([]); setOpenGroupId(null); }
                  else if (customGroups.length===0) {
                    const gId = generateId(); const oId = generateId();
                    setCustomGroups([{id:gId,name:'',required:false,options:[{id:oId,label:'',price:''}]}]);
                    setOpenGroupId(gId);
                  }
                }}
                trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
            </View>

            {isCustomizable&&(
              <View style={{gap:12}}>
                {customGroups.map((group)=>(
                  <View key={group.id} style={{borderWidth:1,borderColor:'#E5E7EB',borderRadius:14,backgroundColor:'#fff',padding:14,gap:12}}>

                    {/* Supprimer ce bloc */}
                    <View style={{alignItems:'flex-end'}}>
                      <TouchableOpacity
                        style={{paddingHorizontal:12,paddingVertical:6,borderRadius:8,borderWidth:1,borderColor:'#E5E7EB'}}
                        onPress={()=>removeGroup(group.id)}>
                        <Text style={{fontSize:12,fontWeight:'600',color:'#374151'}}>Supprimer ce bloc</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Titre */}
                    <View style={{gap:5}}>
                      <Text style={{fontSize:12,fontWeight:'700',color:ORANGE}}>Titre de la personnalisation *</Text>
                      <TextInput
                        style={[s.flatInput,{borderColor:ORANGE,borderWidth:1.5}]}
                        value={group.name}
                        onChangeText={t=>updateGroup(group.id,{name:t})}
                        placeholder="Ex. Finition souhaitée"
                        placeholderTextColor="#9CA3AF"/>
                    </View>

                    {/* Choix obligatoire — off par défaut */}
                    <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
                      <Text style={{fontSize:13,color:'#6B7280'}}>Choix obligatoire</Text>
                      <Switch value={group.required} onValueChange={v=>updateGroup(group.id,{required:v})}
                        trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
                    </View>

                    {/* Options */}
                    <View style={{gap:8}}>
                      {group.options.map((opt,oi)=>(
                        <View key={opt.id} style={{gap:4}}>
                          {oi===0&&<Text style={{fontSize:12,fontWeight:'700',color:'#374151'}}>Option *</Text>}
                          {/* Ligne : description + prix + retirer */}
                          <View style={{flexDirection:'row',alignItems:'center',gap:8}}>
                            <TextInput
                              style={[s.flatInput,{flex:1,marginBottom:0}]}
                              value={opt.label}
                              onChangeText={t=>updateOption(group.id,opt.id,{label:t})}
                              placeholder="Décrivez cette option"
                              placeholderTextColor="#9CA3AF"/>
                            <TextInput
                              style={[s.flatInput,{width:68,marginBottom:0,textAlign:'center'}]}
                              value={opt.price==='0'?'':opt.price}
                              onChangeText={t=>updateOption(group.id,opt.id,{price:t||'0'})}
                              placeholder="+Prix"
                              placeholderTextColor="#9CA3AF"
                              keyboardType="numeric"/>
                            <TouchableOpacity
                              style={{paddingHorizontal:10,paddingVertical:10,borderRadius:8,borderWidth:1,borderColor:'#E5E7EB',backgroundColor:'#F9FAFB'}}
                              onPress={()=>removeOption(group.id,opt.id)}>
                              <Text style={{fontSize:12,fontWeight:'600',color:'#374151'}}>Retirer</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}

                      {/* + Ajouter une option */}
                      <TouchableOpacity
                        style={{alignItems:'center',paddingVertical:13,borderRadius:10,borderWidth:1,borderColor:'#E5E7EB',marginTop:2}}
                        onPress={()=>addOption(group.id)}>
                        <Text style={{fontSize:13,fontWeight:'600',color:ORANGE}}>+ Ajouter une option</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {/* + Ajouter une personnalisation */}
                <TouchableOpacity
                  style={{alignItems:'center',paddingVertical:13,borderRadius:12,borderWidth:1,borderColor:'#E5E7EB',backgroundColor:'#fff'}}
                  onPress={addGroup}>
                  <Text style={{fontSize:13,fontWeight:'600',color:'#374151'}}>+ Ajouter une personnalisation</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Séparateur */}
            <View style={{height:1,backgroundColor:'#F3F4F6'}}/>

            {/* Promotion toggle + details */}
            <View style={s.switchRow}>
              <Text style={s.switchLabel}>Promotion</Text>
              <Switch value={promoActive} onValueChange={setPromoActive}
                trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
            </View>

            {promoActive&&(
              <View style={{gap:12,marginTop:4}}>

                {/* Type dropdown */}
                <View style={s.field}>
                  <Text style={s.label}>Type de promotion *</Text>
                  <TouchableOpacity
                    style={[s.input,{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:14}]}
                    onPress={()=>setPromoTypeOpen(v=>!v)}
                    activeOpacity={0.85}>
                    <Text style={{fontSize:15,color:'#111827'}}>
                      {promoType==='percentage'?'Réduction en pourcentage':promoType==='buy_x_get_y'?'X acheté, N offert':'Prix en lot'}
                    </Text>
                    <Feather name={promoTypeOpen?'chevron-up':'chevron-down'} size={16} color="#6B7280"/>
                  </TouchableOpacity>
                  {promoTypeOpen&&(
                    <View style={{borderRadius:10,borderWidth:1,borderColor:'#E5E7EB',overflow:'hidden',marginTop:2,backgroundColor:'#fff'}}>
                      {([
                        {id:'percentage',  label:'Réduction en pourcentage'},
                        {id:'buy_x_get_y', label:'X acheté, N offert'},
                        {id:'lot',         label:'Prix en lot'},
                      ] as const).map((opt,i)=>(
                        <TouchableOpacity key={opt.id}
                          style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
                                  paddingHorizontal:14,paddingVertical:13,
                                  backgroundColor: promoType===opt.id ? '#FEF2EC' : '#fff',
                                  borderTopWidth: i>0 ? 1 : 0, borderTopColor:'#F3F4F6'}}
                          onPress={()=>{setPromoType(opt.id);setPromoTypeOpen(false);}}>
                          <Text style={{fontSize:14,color:'#111827',fontWeight:promoType===opt.id?'700':'400'}}>{opt.label}</Text>
                          {promoType===opt.id&&<Feather name="check" size={15} color={ORANGE}/>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {/* Réduction % */}
                {promoType==='percentage'&&(
                  <View style={s.field}>
                    <Text style={s.label}>Réduction (%) *</Text>
                    <View style={{flexDirection:'row',alignItems:'center'}}>
                      <TextInput style={[s.input,{flex:1,borderTopRightRadius:0,borderBottomRightRadius:0,borderRightWidth:0}]}
                        value={promoValue} onChangeText={setPromoValue}
                        placeholder="Ex : 10" placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
                      <View style={{width:44,height:50,backgroundColor:'#F3F4F6',borderWidth:1,borderColor:'#E5E7EB',
                                    borderTopRightRadius:10,borderBottomRightRadius:10,
                                    alignItems:'center',justifyContent:'center'}}>
                        <Text style={{fontSize:16,color:'#6B7280',fontWeight:'600'}}>%</Text>
                      </View>
                    </View>
                  </View>
                )}

                {/* X acheté N offert */}
                {promoType==='buy_x_get_y'&&(
                  <View style={{flexDirection:'row',gap:10}}>
                    <View style={[s.field,{flex:1}]}>
                      <Text style={s.label}>Nombre acheté (X) *</Text>
                      <TextInput style={s.input} value={promoBuyQty} onChangeText={setPromoBuyQty}
                        keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    </View>
                    <View style={[s.field,{flex:1}]}>
                      <Text style={s.label}>Nombre offert (N) *</Text>
                      <TextInput style={s.input} value={promoGetQty} onChangeText={setPromoGetQty}
                        keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    </View>
                  </View>
                )}

                {/* Prix en lot */}
                {promoType==='lot'&&(
                  <View style={{flexDirection:'row',gap:10}}>
                    <View style={[s.field,{flex:1}]}>
                      <Text style={s.label}>Qté dans le lot *</Text>
                      <TextInput style={s.input} value={promoLotQty} onChangeText={setPromoLotQty}
                        placeholder="Ex : 3" keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    </View>
                    <View style={[s.field,{flex:1}]}>
                      <Text style={s.label}>Prix du lot *</Text>
                      <TextInput style={s.input} value={promoLotPrice} onChangeText={setPromoLotPrice}
                        placeholder="Ex : 5000" keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    </View>
                  </View>
                )}

                {/* Durée — date de début + date de fin */}
                <View style={s.field}>
                  <Text style={s.label}>Durée de la promotion *</Text>
                  <View style={{flexDirection:'row',gap:10}}>
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
                      minDate={promoStartDate ? new Date(promoStartDate + 'T00:00:00') : new Date()}
                    />
                  </View>
                  {/* Validation concordance */}
                  {promoStartDate && promoEndDate && promoEndDate <= promoStartDate && (
                    <Text style={{fontSize:11,color:'#DC2626',marginTop:2}}>⚠ La date de fin doit être après la date de début</Text>
                  )}
                </View>

              </View>
            )}

            {/* Séparateur */}
            {kind==='article'&&<View style={{height:1,backgroundColor:'#F3F4F6'}}/>}

            {/* Stock (article only) */}
            {kind==='article'&&(
              <View style={{gap:12}}>
                {/* Toggle stock */}
                <View style={s.switchRow}>
                  <View style={{flex:1}}>
                    <Text style={s.switchLabel}>Gérer le stock</Text>
                    <Text style={s.switchSub}>Suivi de la quantité disponible</Text>
                  </View>
                  <Switch value={stockEnabled}
                    onValueChange={v=>{ setStockEnabled(v); if(!v){setStockQty('');setShowStock(false);} }}
                    trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
                </View>
                {stockEnabled&&(
                  <View style={{gap:10}}>
                    <View style={s.field}>
                      <Text style={s.label}>Quantité en stock</Text>
                      <TextInput style={s.input} value={stockQty} onChangeText={setStockQty}
                        placeholder="Ex : 10" placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
                    </View>
                    <View style={s.switchRow}>
                      <View style={{flex:1}}>
                        <Text style={s.switchLabel}>Afficher le stock</Text>
                        <Text style={s.switchSub}>Les clients verront le nombre restant</Text>
                      </View>
                      <Switch value={showStock} onValueChange={setShowStock}
                        trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
                    </View>
                  </View>
                )}

                {/* Toggle politique de retour */}
                <View style={{height:1,backgroundColor:'#F3F4F6'}}/>
                <View style={s.switchRow}>
                  <View style={{flex:1}}>
                    <Text style={s.switchLabel}>Politique de retour</Text>
                    <Text style={s.switchSub}>Autoriser les retours et remboursements</Text>
                  </View>
                  <Switch value={returnsAccepted} onValueChange={v=>{
                    setReturnsAccepted(v);
                    setReturnPolicy(v ? 'yes' : 'none');
                  }} trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
                </View>
                {returnsAccepted&&(
                  <View style={{gap:10}}>
                    {/* Conditions ou oui */}
                    <View style={{flexDirection:'row',gap:8}}>
                      {([{id:'yes',label:'Retour libre'},{id:'conditions',label:'Sous conditions'}] as const).map(opt=>(
                        <TouchableOpacity key={opt.id}
                          style={[s.unitChip,returnPolicy===opt.id&&s.unitChipActive,{flex:1,justifyContent:'center'}]}
                          onPress={()=>setReturnPolicy(opt.id)}>
                          <Text style={[s.unitChipTxt,{textAlign:'center'},returnPolicy===opt.id&&{color:ORANGE,fontWeight:'700'}]}>
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={s.field}>
                      <Text style={s.label}>Délai de retour (jours)</Text>
                      <View style={s.durationRow}>
                        <TouchableOpacity style={s.durationBtn}
                          onPress={()=>setReturnDays(String(Math.max(1,parseInt(returnDays||'7')-1)))}>
                          <Feather name="minus" size={16} color="#374151"/>
                        </TouchableOpacity>
                        <Text style={s.durationVal}>{parseInt(returnDays||'7')} jour{parseInt(returnDays||'7')>1?'s':''}</Text>
                        <TouchableOpacity style={s.durationBtn}
                          onPress={()=>setReturnDays(String(parseInt(returnDays||'7')+1))}>
                          <Feather name="plus" size={16} color="#374151"/>
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={s.field}>
                      <Text style={s.label}>Montant max remboursable (optionnel)</Text>
                      <TextInput style={s.input} value={returnMaxAmount} onChangeText={setReturnMaxAmount}
                        placeholder="Ex : 5000" placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
                    </View>
                    <View style={s.switchRow}>
                      <View style={{flex:1}}>
                        <Text style={s.switchLabel}>Échange accepté</Text>
                        <Text style={s.switchSub}>Le client peut échanger au lieu d'être remboursé</Text>
                      </View>
                      <Switch value={exchangeOk} onValueChange={setExchangeOk}
                        trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
                    </View>
                  </View>
                )}
              </View>
            )}

          </View>

          {/* ── CTA ── */}
          <TouchableOpacity
            style={[{backgroundColor:'#111827',borderRadius:16,paddingVertical:17,alignItems:'center',marginTop:4},saving&&{opacity:0.6}]}
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color="#fff"/>
              : <Text style={{fontSize:16,fontWeight:'700',color:'#fff',letterSpacing:0.2}}>
                  {kind==='prestation'
                    ? (isEditing ? 'Enregistrer les modifications' : 'Continuer vers les créneaux →')
                    : (isEditing ? 'Enregistrer les modifications' : 'Créer l\'article')}
                </Text>
            }
          </TouchableOpacity>

          <View style={{height:20}}/>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      <ServiceCategoryPicker visible={catPickerOpen}
        onClose={()=>setCatPickerOpen(false)}
        onSelect={cat=>setServiceCategory(cat)}/>

      <SuccessModal visible={successVisible} title="Succes !" message={successMsg}
        onClose={()=>{setSuccessVisible(false); router.navigate('/(pro)/boutique' as any);}}/>

      {/* ── Modal zones de livraison — affiché si livraison sélectionnée sans zones ── */}
      {DeliveryZoneModal}

      {/* ── Modal Add Media — fond fondu + sheet en slide ── */}
      <Modal visible={mediaSheetMounted} transparent animationType="none"
        onRequestClose={() => closeMedia()}>
        <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(0,0,0,0.52)'},
          {opacity: mediaOverlay}]} pointerEvents="box-none">
          <TouchableOpacity style={{flex:1}} activeOpacity={1} onPress={() => closeMedia()}/>
        </Animated.View>
        <Animated.View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#fff',
          borderTopLeftRadius:24,borderTopRightRadius:24,
          transform:[{translateY: mediaTranslateY}]}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',
            padding:20,borderBottomWidth:1,borderBottomColor:'#F3F4F6'}}>
            <Text style={{fontSize:18,fontWeight:'800',color:'#111827'}}>Ajouter une photo</Text>
            <TouchableOpacity style={{width:32,height:32,borderRadius:16,backgroundColor:'#F3F4F6',
              alignItems:'center',justifyContent:'center'}}
              onPress={() => closeMedia()}>
              <Feather name="x" size={16} color="#374151"/>
            </TouchableOpacity>
          </View>
          <View style={{padding:20,gap:12}}>
            <TouchableOpacity style={s.uploadOption}
              onPress={async()=>{
                if(images.length>=4){Alert.alert('Maximum atteint','4 photos maximum.');return;}
                const {status}=await ImagePicker.requestCameraPermissionsAsync();
                if(status!=='granted'){Alert.alert('Permission requise');return;}
                const r=await ImagePicker.launchCameraAsync({quality:0.85});
                if(!r.canceled&&r.assets[0]){
                  setImages(prev=>[...prev,{uri:r.assets[0].uri}]);
                  closeMedia();
                }
              }}>
              <View style={[s.uploadIcon,{backgroundColor:'#FEF2EC'}]}><Feather name="camera" size={22} color={ORANGE}/></View>
              <View style={{flex:1}}>
                <Text style={s.uploadLabel}>Prendre une photo</Text>
                <Text style={s.uploadSub}>Utiliser l'appareil photo</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#9CA3AF"/>
            </TouchableOpacity>
            <TouchableOpacity style={s.uploadOption}
              onPress={async()=>{
                if(images.length>=4){Alert.alert('Maximum atteint','4 photos maximum.');return;}
                const {status}=await ImagePicker.requestMediaLibraryPermissionsAsync();
                if(status!=='granted'){Alert.alert('Permission requise');return;}
                const r=await ImagePicker.launchImageLibraryAsync({quality:0.85,mediaTypes:['images'] as any});
                if(!r.canceled&&r.assets[0]){
                  setImages(prev=>[...prev,{uri:r.assets[0].uri}]);
                  closeMedia();
                }
              }}>
              <View style={[s.uploadIcon,{backgroundColor:'#EEF2FF'}]}><Feather name="image" size={22} color="#1E3A5F"/></View>
              <View style={{flex:1}}>
                <Text style={s.uploadLabel}>Choisir dans la galerie</Text>
                <Text style={s.uploadSub}>Sélectionner depuis vos photos</Text>
              </View>
              <Feather name="chevron-right" size={18} color="#9CA3AF"/>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </Modal>

      {/* ── Modal Fulfillment — fond fondu + sheet en slide ── */}
      <Modal visible={fulfillmentSheetMounted} transparent animationType="none"
        onRequestClose={() => closeFulfill()}>
        <Animated.View style={[StyleSheet.absoluteFill,{backgroundColor:'rgba(0,0,0,0.52)'},
          {opacity: fulfillOverlay}]} pointerEvents="box-none">
          <TouchableOpacity style={{flex:1}} activeOpacity={1} onPress={() => closeFulfill()}/>
        </Animated.View>
        <Animated.View style={{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#fff',
          borderTopLeftRadius:28,borderTopRightRadius:28,paddingBottom:insets.bottom+20,
          transform:[{translateY: fulfillTranslateY}]}}>
          <View style={{padding:20,borderBottomWidth:1,borderBottomColor:'#F3F4F6'}}>
            <Text style={{fontSize:18,fontWeight:'800',color:'#111827'}}>Mode de disponibilité</Text>
            <Text style={{fontSize:13,color:'#9CA3AF',marginTop:2}}>Comment cet article sera-t-il disponible ?</Text>
          </View>
          <View style={{padding:16,gap:12}}>
            {FULFILLMENT_OPTIONS.map(opt=>{
              const active = fulfillmentType===opt.id;
              return (
                <TouchableOpacity key={opt.id}
                  style={{flexDirection:'row',alignItems:'center',gap:14,borderRadius:18,padding:16,
                          backgroundColor: active ? opt.bg : '#F9FAFB',
                          borderWidth:2, borderColor: active ? opt.color : '#F3F4F6'}}
                  onPress={()=>{
                    setFulfillmentType(opt.id);
                    closeFulfill(() => {
                      if (opt.id === 'delivery_only' || opt.id === 'both') checkZones();
                    });
                  }}
                  activeOpacity={0.8}>
                  <View style={{width:52,height:52,borderRadius:16,backgroundColor: active ? opt.color+'18' : '#F3F4F6',
                                alignItems:'center',justifyContent:'center'}}>
                    <Image source={opt.icon} style={{width:30,height:30}} resizeMode="contain"/>
                  </View>
                  <View style={{flex:1,gap:3}}>
                    <Text style={{fontSize:15,fontWeight:'800',color: active ? opt.color : '#111827'}}>{opt.label}</Text>
                    <Text style={{fontSize:12,color:'#6B7280',lineHeight:17}}>{opt.sub}</Text>
                  </View>
                  {active && (
                    <View style={{width:26,height:26,borderRadius:13,backgroundColor:opt.color,alignItems:'center',justifyContent:'center'}}>
                      <Feather name="check" size={14} color="#fff"/>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  // ── Header ──────────────────────────────────────────────────────────────────
  header:           { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingBottom:14, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  backBtn:          { width:38, height:38, borderRadius:19, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  headerTitle:      { flex:1, fontSize:17, fontWeight:'800', color:'#111827' },
  // ── Badges (keep existing style) ────────────────────────────────────────────
  kindRow:          { flexDirection:'row', gap:12 },
  kindBtn:          { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#F3F4F6', borderRadius:14, paddingVertical:14, borderWidth:1.5, borderColor:'#E5E7EB' },
  kindBtnActive:    { backgroundColor:'#FEF2EC', borderColor:ORANGE },
  kindLabel:        { fontSize:15, fontWeight:'600', color:'#6B7280' },
  catBadge:         { flexDirection:'row', alignItems:'center', gap:12, borderRadius:16, padding:14, borderWidth:1.5 },
  catBadgeLabel:    { fontSize:15, fontWeight:'800' },
  catBadgeSub:      { fontSize:11, color:'#9CA3AF', marginTop:1 },
  // ── Images (keep existing style) ────────────────────────────────────────────
  imgBtnEmpty:      { width:'100%', height:160, borderRadius:18, backgroundColor:'#F3F4F6', borderWidth:2, borderColor:'#E5E7EB', borderStyle:'dashed', alignItems:'center', justifyContent:'center', gap:10 },
  imgBtnEmptyIcon:  { width:52, height:52, borderRadius:26, backgroundColor:'#E5E7EB', alignItems:'center', justifyContent:'center' },
  imgBtnEmptyTxt:   { fontSize:14, fontWeight:'600', color:'#9CA3AF' },
  imgBtnEmptySub:   { fontSize:12, color:'#C4C9D4' },
  imgBtnAdd:        { width:100, height:100, borderRadius:14, backgroundColor:'#F3F4F6', borderWidth:2, borderColor:'#E5E7EB', borderStyle:'dashed', alignItems:'center', justifyContent:'center', gap:4 },
  // ── Flat form cards ──────────────────────────────────────────────────────────
  flatCard:         { backgroundColor:'#fff', borderRadius:16, padding:18, gap:14, borderWidth:1, borderColor:'#E5E7EB' },
  sectionTitle:     { fontSize:15, fontWeight:'800', color:'#111827', marginBottom:2 },
  flatField:        { gap:6 },
  blueLabel:        { fontSize:13, fontWeight:'600', color:'#2563EB' },
  flatInput:        { backgroundColor:'#fff', borderRadius:10, paddingHorizontal:14, paddingVertical:12, fontSize:15, color:'#111827', borderWidth:1, borderColor:'#D1D5DB' },
  // ── Shared ──────────────────────────────────────────────────────────────────
  switchRow:        { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:2 },
  switchLabel:      { fontSize:14, fontWeight:'600', color:'#111827' },
  switchSub:        { fontSize:12, color:'#9CA3AF', marginTop:1 },
  // ── Legacy (kept for backward compat with untouched sections) ───────────────
  card:             { backgroundColor:'#fff', borderRadius:18, padding:18, gap:12 },
  cardTitle:        { fontSize:16, fontWeight:'800', color:'#111827' },
  cardHeader:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between' } as const,
  field:            { gap:6 },
  label:            { fontSize:11, fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.4 },
  input:            { backgroundColor:'#F3F4F6', borderRadius:12, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:'#111827', borderWidth:1.5, borderColor:'#E5E7EB' },
  durInput:         { width:56, height:40, borderWidth:1.5, borderColor:'#E5E7EB', borderRadius:10, backgroundColor:'#F9FAFB', textAlign:'center', fontSize:16, fontWeight:'700', color:'#111827' },
  timerSep:         { fontSize:18, fontWeight:'700', color:'#9CA3AF', marginBottom:18 },
  timerUnit:        { fontSize:11, fontWeight:'600', color:'#9CA3AF' },
  unitChip:         { paddingHorizontal:12, paddingVertical:8, borderRadius:100, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'#E5E7EB' },
  unitChipActive:   { backgroundColor:'#FEF2EC', borderColor:ORANGE },
  unitChipTxt:      { fontSize:13, fontWeight:'600', color:'#6B7280' },
  durationRow:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#F3F4F6', borderRadius:14, padding:10, borderWidth:1.5, borderColor:'#E5E7EB' },
  durationBtn:      { width:40, height:40, borderRadius:20, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.08, shadowRadius:3, elevation:2 },
  durationVal:      { fontSize:20, fontWeight:'800', color:'#111827', minWidth:80, textAlign:'center' },
  billingChip:      { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:12, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'#E5E7EB' },
  billingChipActive:{ backgroundColor:'#FEF2EC', borderColor:ORANGE },
  billingChipTxt:   { fontSize:13, fontWeight:'600', color:'#6B7280' },
  dropdown:         { backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:'#E5E7EB', overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.08, shadowRadius:6, elevation:4 },
  dropdownItem:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  dropdownItemActive:{ backgroundColor:'#FEF2EC' },
  dropdownTxt:      { fontSize:14, color:'#374151' },
  slotBtn:          { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#FEF2EC', borderRadius:14, paddingVertical:13, borderWidth:1.5, borderColor:'#FDDCCA' },
  slotBtnTxt:       { fontSize:14, fontWeight:'700', color:ORANGE },
  uploadOption:     { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#F9FAFB', borderRadius:16, padding:14, borderWidth:1, borderColor:'#F3F4F6' },
  uploadIcon:       { width:48, height:48, borderRadius:14, alignItems:'center', justifyContent:'center' },
  uploadLabel:      { fontSize:15, fontWeight:'700', color:'#111827' },
  uploadSub:        { fontSize:12, color:'#9CA3AF', marginTop:2 },
  saveBtn:          { backgroundColor:ORANGE, borderRadius:10, paddingHorizontal:14, paddingVertical:8 },
  saveBtnTxt:       { fontSize:13, fontWeight:'700', color:'#fff' },
});

// ─── MiniCalendar ─────────────────────────────────────────────────────────────

const DAYS_FR   = ['Lu','Ma','Me','Je','Ve','Sa','Di'];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                   'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const CAL_ORANGE = '#FF6835';

interface MiniCalendarProps {
  label: string;
  /** ISO YYYY-MM-DD or '' */
  value: string;
  onChange: (v: string) => void;
  minDate?: Date;
}

function MiniCalendar({ label, value, onChange, minDate }: MiniCalendarProps) {
  const today = new Date();
  today.setHours(0,0,0,0);

  // État ouvert/fermé + mois affiché
  const initDate = value ? new Date(value + 'T00:00:00') : (minDate ?? today);
  const [open,     setOpen]     = useState(false);
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth,setViewMonth]= useState(initDate.getMonth()); // 0-11

  // recalcule la vue quand la valeur change depuis l'extérieur
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Construire la grille (lundi en 1er)
  const firstDay = new Date(viewYear, viewMonth, 1);
  // offset: lundi=0 … dimanche=6
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth  = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number|null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({length: daysInMonth}, (_,i) => i+1),
  ];
  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  const minDay = minDate ? new Date(minDate) : today;
  minDay.setHours(0,0,0,0);

  const selectedISO = value; // YYYY-MM-DD

  const selectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2,'0');
    const dd = String(day).padStart(2,'0');
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  };

  // Format affichage bouton
  const displayLabel = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })
    : 'Choisir une date';

  const isSelected = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2,'0');
    const dd = String(day).padStart(2,'0');
    return `${viewYear}-${mm}-${dd}` === selectedISO;
  };

  const isDisabled = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    return d < minDay;
  };

  return (
    <View style={{ flex:1 }}>
      <Text style={{ fontSize:11, fontWeight:'600', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.5, marginBottom:5 }}>
        {label}
      </Text>

      {/* Bouton déclencheur */}
      <TouchableOpacity
        onPress={() => setOpen(o => !o)}
        activeOpacity={0.75}
        style={{
          flexDirection:'row', alignItems:'center', justifyContent:'space-between',
          borderWidth:1,
          borderColor: value ? CAL_ORANGE : '#E5E7EB',
          borderRadius:10, backgroundColor:'#F9FAFB',
          paddingHorizontal:10, paddingVertical:10,
        }}>
        <Text style={{ fontSize:13, color: value ? '#111827' : '#9CA3AF', flex:1 }}>{displayLabel}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#9CA3AF" />
      </TouchableOpacity>

      {/* Calendrier inline */}
      {open && (
        <View style={{
          marginTop:4,
          borderWidth:1, borderColor:'#E5E7EB', borderRadius:12,
          backgroundColor:'#fff',
          padding:10,
          zIndex:100,
        }}>
          {/* Navigation mois */}
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Feather name="chevron-left" size={16} color="#374151" />
            </TouchableOpacity>
            <Text style={{ fontSize:13, fontWeight:'700', color:'#111827' }}>
              {MONTHS_FR[viewMonth]} {viewYear}
            </Text>
            <TouchableOpacity onPress={nextMonth} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Feather name="chevron-right" size={16} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Jours de la semaine */}
          <View style={{ flexDirection:'row', marginBottom:4 }}>
            {DAYS_FR.map(d => (
              <Text key={d} style={{ flex:1, textAlign:'center', fontSize:10, fontWeight:'700', color:'#9CA3AF' }}>{d}</Text>
            ))}
          </View>

          {/* Grille */}
          {Array.from({ length: cells.length / 7 }, (_,row) => (
            <View key={row} style={{ flexDirection:'row' }}>
              {cells.slice(row*7, row*7+7).map((day, col) => {
                if (!day) return <View key={col} style={{ flex:1, height:30 }} />;
                const sel = isSelected(day);
                const dis = isDisabled(day);
                return (
                  <TouchableOpacity
                    key={col}
                    disabled={dis}
                    onPress={() => selectDay(day)}
                    style={{
                      flex:1, height:30,
                      alignItems:'center', justifyContent:'center',
                      borderRadius:15,
                      backgroundColor: sel ? CAL_ORANGE : 'transparent',
                    }}>
                    <Text style={{
                      fontSize:12,
                      fontWeight: sel ? '700' : '400',
                      color: sel ? '#fff' : dis ? '#D1D5DB' : '#111827',
                    }}>{day}</Text>
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
