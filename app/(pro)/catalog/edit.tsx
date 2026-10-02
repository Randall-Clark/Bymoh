// app/(pro)/catalog/edit.tsx
import { uploadImageToSupabase } from '@/lib/uploadImage';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Dimensions, Image, KeyboardAvoidingView,
  Modal, Platform, ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { AvailabilityModal, SlotConfig } from '@/components/pro/AvailabilityModal';
import { ServiceCategoryPicker, ServiceCategory } from '@/components/pro/ServiceCategoryPicker';
import { SuccessModal } from '@/components/SuccessModal';

const { width: W } = Dimensions.get('window');
const ORANGE = '#FF6835';

type ItemKind    = 'article' | 'prestation';
type BillingType = 'fixed' | 'hourly' | 'per_day' | 'per_unit' | 'free' | 'quote';
type DurUnit     = 'minutes' | 'heures' | 'jours';
type MediaTab    = 'library' | 'upload';

interface BillingOption {
  id: BillingType; emoji: string; label: string;
  forArticle: boolean; forService: boolean;
}
const BILLING_OPTIONS: BillingOption[] = [
  { id:'fixed',    emoji:'💵', label:'Prix fixe',                forArticle:true,  forService:true  },
  { id:'hourly',   emoji:'⏱️', label:'Tarif horaire',            forArticle:false, forService:true  },
  { id:'per_day',  emoji:'📅', label:'Tarif journalier',         forArticle:false, forService:true  },
  { id:'per_unit', emoji:'🔢', label:'En vrac',                  forArticle:true,  forService:true  },
  { id:'free',     emoji:'🎁', label:'Gratuit',                  forArticle:true,  forService:true  },
  { id:'quote',    emoji:'✂️', label:'Sur mesure / Personnalise',forArticle:false, forService:true  },
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

export default function CatalogEditScreen() {
  const insets = useSafeAreaInsets();
  const { businessId, serviceId, defaultKind } = useLocalSearchParams<{
    businessId?:string; serviceId?:string; defaultKind?:string;
  }>();
  const isEditing = !!serviceId;
  const qc = useQueryClient();

  const [kind,           setKind]           = useState<ItemKind>(
    defaultKind==='article'||defaultKind==='prestation' ? defaultKind as ItemKind : 'article'
  );
  const kindStr = kind as string;

  // Infos générales
  const [title,          setTitle]          = useState('');
  const [description,    setDescription]    = useState('');
  const [isAvailable,    setIsAvailable]    = useState(true);

  // Images
  const [images,         setImages]         = useState<{uri?:string; url?:string}[]>([]);
  const [mediaOpen,      setMediaOpen]      = useState(false);
  const [mediaTab,       setMediaTab]       = useState<MediaTab>('library');
  const [library,        setLibrary]        = useState<string[]>([]);
  const [libLoading,     setLibLoading]     = useState(false);

  // Durée
  const [showDuration,   setShowDuration]   = useState(false);
  const [durUnit,        setDurUnit]        = useState<DurUnit>('heures');
  const [durH,           setDurH]           = useState('0');
  const [durM,           setDurM]           = useState('30');

  // Facturation
  const [billingType,    setBillingType]    = useState<BillingType>('fixed');
  const [price,          setPrice]          = useState('');
  const [unit,           setUnit]           = useState('kg');
  const [unitOpen,       setUnitOpen]       = useState(false);
  const [customUnit,     setCustomUnit]     = useState('');
  const [minQty,         setMinQty]         = useState('1');

  // Stock (article)
  const [stockQty,       setStockQty]       = useState('1');
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

  // Promotions
  const [promoActive,    setPromoActive]    = useState(false);
  const [promoType,      setPromoType]      = useState<'percentage'|'fixed_amount'|'buy_x_get_y'|'free_first'>('percentage');
  const [promoValue,     setPromoValue]     = useState('');
  const [promoCode,      setPromoCode]      = useState('');
  const [promoBuyQty,    setPromoBuyQty]    = useState('2');
  const [promoGetQty,    setPromoGetQty]    = useState('1');

  // Créneaux
  const [slotModalOpen,  setSlotModalOpen]  = useState(false);
  const [pendingSlots,   setPendingSlots]   = useState<SlotConfig[]>([]);

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
        setStockQty(data.stock_quantity?.toString() ?? '1');
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
        setPromoCode(data.promo_code ?? '');
        setPromoBuyQty(data.promo_buy_qty?.toString() ?? '2');
        setPromoGetQty(data.promo_get_qty?.toString() ?? '1');
        setShowDuration(!!data.duration_minutes);
        if (data.duration_minutes) {
          const mins = data.duration_minutes;
          if (mins%(60*24)===0) { setDurUnit('jours'); setDurH(String(mins/(60*24))); setDurM('0'); }
          else if (mins%60===0)  { setDurUnit('heures'); setDurH(String(mins/60)); setDurM('0'); }
          else { setDurUnit('minutes'); setDurH('0'); setDurM(String(mins)); }
        }
        const dbUrls: string[] = data.image_urls
          ? (typeof data.image_urls==='string' ? JSON.parse(data.image_urls) : data.image_urls)
          : (data.image_url ? [data.image_url] : []);
        setImages(dbUrls.map((url:string) => ({ url })));
      });
  }, [serviceId]);

  useEffect(() => {
    if (!isEditing && kind==='prestation') setCatPickerOpen(true);
  }, [kind]);

  const openMedia = () => {
    setMediaOpen(true); setMediaTab('library'); setLibLoading(true);
    supabase.storage.from('businesses').list('services', { limit:50, sortBy:{ column:'created_at', order:'desc' } })
      .then(({ data }: { data: any }) => {
        if (data) setLibrary(data
          .filter((f:any) => /\.(jpg|jpeg|png|webp)$/i.test(f.name))
          .map((f:any) => supabase.storage.from('businesses').getPublicUrl(`services/${f.name}`).data.publicUrl)
        );
        setLibLoading(false);
      });
  };

  const uploadImages = async (id: string): Promise<string[]> => {
    const results: string[] = [];
    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      if (img.url && !img.uri) {
        results.push(img.url.split('?t=')[0]);
      } else if (img.uri) {
        try {
          const ext = (img.uri.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase();
          const path = `services/${id}_${i}.${ext}`;
          const url = await uploadImageToSupabase(img.uri, 'businesses', path);
          if (url) results.push(url);
        } catch (e) { console.warn('Upload img', i, e); }
      }
    }
    return results;
  };

  const getDurationMinutes = (): number | null => {
    if (!showDuration) return null;
    const val = durUnit==='minutes' ? parseInt(durM||'0')
              : durUnit==='heures'  ? parseInt(durH||'0')*60
              : parseInt(durH||'0')*60*24;
    return val > 0 ? val : null;
  };

  const getDurationLabel = () => {
    const val = durUnit==='minutes' ? parseInt(durM||'0') : parseInt(durH||'0');
    if (val<=0) return '';
    return durUnit==='minutes' ? `${val} min` : durUnit==='heures' ? `${val}h` : `${val} j`;
  };

  const save = async () => {
    if (!title.trim()) { Alert.alert('Erreur','Le nom est requis.'); return; }
    if (kind === 'article') {
      const s = parseInt(stockQty || '0');
      if (s < 1) { Alert.alert('Stock invalide', 'Le stock minimum est de 1 article.'); return; }
    }
    if (!businessId)   { Alert.alert('Erreur','Boutique introuvable.'); return; }
    if (kind==='prestation' && showDuration && !getDurationMinutes()) {
      Alert.alert('Duree invalide','Indiquez une duree valide.'); return;
    }
    setSaving(true);
    try {
      const id = serviceId ?? generateId();
      const uploadedUrls = await uploadImages(id);
      const showPrice = !['free','quote'].includes(billingType);
      const payload: Record<string,any> = {
        id, business_id: businessId, kind,
        title: title.trim(), description: description.trim(),
        image_url:  uploadedUrls[0] ?? null,
        image_urls: JSON.stringify(uploadedUrls),
        price:      showPrice ? parseFloat(price)||0 : 0,
        currency:   'FCFA',
        billing_type:     billingType,
        unit:             billingType==='per_unit' ? (unit==='autre' ? customUnit.trim()||'autre' : unit) : null,
        min_quantity:     billingType==='per_unit' ? parseInt(minQty)||1 : null,
        stock_quantity:   kind==='article' ? parseInt(stockQty)||0 : null,
        show_stock:       kind==='article' ? showStock : false,
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
        promo_value:      promoActive && ['percentage','fixed_amount'].includes(promoType) ? parseFloat(promoValue)||0 : null,
        promo_code:       promoActive && promoCode.trim() ? promoCode.trim().toUpperCase() : null,
        promo_buy_qty:    promoActive && promoType==='buy_x_get_y' ? parseInt(promoBuyQty)||2 : null,
        promo_get_qty:    promoActive && promoType==='buy_x_get_y' ? parseInt(promoGetQty)||1 : null,
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
      if (pendingSlots.length>0) {
        const rows = pendingSlots.map(s => ({
          id:generateId(), service_id:id, date:s.date,
          start_time:s.start_time, end_time:s.end_time,
          max_slots:s.max_slots, booked_slots:0, is_blocked:false,
        }));
        await supabase.from('service_availability').insert(rows);
      }
      await qc.invalidateQueries({ queryKey:['catalog', businessId] });
      await qc.invalidateQueries({ queryKey:['biz-client', businessId] });
      await qc.invalidateQueries({ queryKey:['cat-client', businessId] });
      await new Promise(r => setTimeout(r, 1500));
      setSuccessMsg(isEditing ? 'Mis a jour avec succes.' : kind==='article' ? 'Article cree avec succes !' : 'Service cree avec succes !');
      setSuccessVisible(true);
    } catch (err:any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de sauvegarder.');
    } finally {
      setSaving(false);
    }
  };

  const billingOptions = BILLING_OPTIONS.filter(b => kind==='article' ? b.forArticle : b.forService);
  const units = kindStr==='prestation' ? UNIT_SERVICE : UNIT_ARTICLE;
  const durationMin = Math.max(15, getDurationMinutes() ?? 60);
  const durVal = durUnit==='minutes' ? parseInt(durM||'0') : parseInt(durH||'0');

  const CAT_INFO: Record<ServiceCategory,{emoji:string;label:string;color:string;bg:string}> = {
    at_merchant:  {emoji:'🏪',label:'Chez le marchand', color:'#1E3A5F',bg:'#EEF2FF'},
    at_client:    {emoji:'🏠',label:'Chez le client',   color:'#7C3AED',bg:'#F5F3FF'},
    hybrid:       {emoji:'🔄',label:'Hybride',          color:'#059669',bg:'#F0FDF4'},
  };

  return (
    <View style={{flex:1,backgroundColor:'#F8F7F4'}}>
      {/* Header */}
      <View style={[s.header,{paddingTop:(Platform.OS==='ios'?insets.top:insets.top)+8}]}>
        <TouchableOpacity style={s.backBtn} onPress={()=>{ router.navigate('/(pro)/boutique' as any); }}>
          <Feather name="arrow-left" size={20} color="#111827"/>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{isEditing?'Modifier':'Ajouter'} {kind==='article'?'un article':'un service'}</Text>
        <TouchableOpacity style={[s.saveBtn,saving&&{opacity:0.7}]} onPress={save} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#fff"/>
                  : <Text style={s.saveBtnTxt}>Enregistrer</Text>}
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':'height'}>
        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={{padding:20,gap:16,paddingBottom:60}}
          keyboardShouldPersistTaps="handled">

          {/* Sélecteur Article / Service */}
          <View style={s.kindRow}>
            {(['article','prestation'] as ItemKind[]).map(k => {
              const info = {article:{emoji:'📦',label:'Article'},prestation:{emoji:'🛎️',label:'Service'}}[k];
              return (
                <TouchableOpacity key={k} style={[s.kindBtn,kind===k&&s.kindBtnActive]}
                  onPress={()=>{setKind(k); if(k==='prestation'&&!isEditing) setCatPickerOpen(true);}}>
                  <Text style={{fontSize:22}}>{info.emoji}</Text>
                  <Text style={[s.kindLabel,kind===k&&{color:ORANGE,fontWeight:'700'}]}>{info.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Badge catégorie service */}
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

          {/* Images */}
          {images.length===0 ? (
            <TouchableOpacity style={s.imgBtnEmpty} onPress={openMedia} activeOpacity={0.85}>
              <View style={s.imgBtnEmptyIcon}><Feather name="camera" size={24} color="#9CA3AF"/></View>
              <Text style={s.imgBtnEmptyTxt}>Ajouter des photos</Text>
              <Text style={s.imgBtnEmptySub}>Jusqu'a 4 photos</Text>
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

          {/* Informations générales */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Informations generales</Text>
            <View style={s.field}>
              <Text style={s.label}>Nom *</Text>
              <TextInput style={s.input} value={title} onChangeText={setTitle}
                placeholder={kind==='prestation'?'Ex : Coupe femme...':'Ex : Riz local...'}
                placeholderTextColor="#9CA3AF"/>
            </View>
            <View style={s.field}>
              <Text style={s.label}>Description</Text>
              <TextInput style={[s.input,{height:80,textAlignVertical:'top',paddingTop:12}]}
                value={description} onChangeText={setDescription}
                placeholder="Decrivez ce que vous proposez..." placeholderTextColor="#9CA3AF" multiline/>
            </View>
            <View style={s.switchRow}>
              <View style={{flex:1}}>
                <Text style={s.switchLabel}>Disponible</Text>
                <Text style={s.switchSub}>Visible et commandable par les clients</Text>
              </View>
              <Switch value={isAvailable} onValueChange={setIsAvailable}
                trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
            </View>

            {/* Durée estimée */}
            {kind==='prestation'&&(
              <View style={{gap:10}}>
                <View style={s.switchRow}>
                  <View style={{flex:1}}>
                    <Text style={s.switchLabel}>Duree estimee{getDurationLabel()?' · '+getDurationLabel():''}</Text>
                    <Text style={s.switchSub}>Indiquer la duree de ce service</Text>
                  </View>
                  <Switch value={showDuration}
                    onValueChange={v=>{setShowDuration(v); if(!v){setDurH('0');setDurM('30');}}}
                    trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
                </View>
                {showDuration&&(
                  <View style={{gap:10}}>
                    <View style={{flexDirection:'row',gap:8}}>
                      {(['minutes','heures','jours'] as DurUnit[]).map(u=>(
                        <TouchableOpacity key={u}
                          style={[s.unitChip,durUnit===u&&s.unitChipActive]}
                          onPress={()=>{setDurUnit(u);setDurH('0');setDurM(u==='minutes'?'30':'0');}}>
                          <Text style={[s.unitChipTxt,durUnit===u&&{color:ORANGE,fontWeight:'700'}]}>
                            {u.charAt(0).toUpperCase()+u.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <View style={s.durationRow}>
                      <TouchableOpacity style={s.durationBtn} onPress={()=>{
                        if(durUnit==='minutes') setDurM(String(Math.max(5,parseInt(durM||'0')-5)));
                        else setDurH(String(Math.max(1,parseInt(durH||'0')-1)));
                      }}><Feather name="minus" size={18} color="#374151"/></TouchableOpacity>
                      <Text style={s.durationVal}>
                        {durVal} {durUnit==='minutes'?'min':durUnit==='heures'?'h':'jour'+(durVal>1?'s':'')}
                      </Text>
                      <TouchableOpacity style={s.durationBtn} onPress={()=>{
                        if(durUnit==='minutes') setDurM(String(Math.min(55,parseInt(durM||'0')+5)));
                        else setDurH(String(parseInt(durH||'0')+1));
                      }}><Feather name="plus" size={18} color="#374151"/></TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Déplacement chez le client */}
          {kind==='prestation'&&(serviceCategory==='at_client'||serviceCategory==='hybrid')&&(
            <View style={s.card}>
              <Text style={s.cardTitle}>{serviceCategory==='at_client'?'🏠 Deplacement chez le client':'🔄 Option deplacement'}</Text>
              <View style={s.field}>
                <Text style={s.label}>Frais de deplacement (FCFA)</Text>
                <TextInput style={s.input} value={travelFee} onChangeText={setTravelFee}
                  placeholder="Ex : 1000 — laisser vide si inclus"
                  placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
              </View>
            </View>
          )}

          {/* Facturation */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Mode de facturation</Text>
            <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
              {billingOptions.map(b=>(
                <TouchableOpacity key={b.id}
                  style={[s.billingChip,billingType===b.id&&s.billingChipActive]}
                  onPress={()=>setBillingType(b.id)}>
                  <Text style={{fontSize:16}}>{b.emoji}</Text>
                  <Text style={[s.billingChipTxt,billingType===b.id&&{color:ORANGE,fontWeight:'700'}]}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!['free','quote'].includes(billingType)&&(
              <View style={s.field}>
                <Text style={s.label}>
                  {billingType==='hourly' ? 'Tarif horaire (FCFA / h)'
                  :billingType==='per_day' ? 'Tarif journalier (FCFA / j)'
                  :billingType==='per_unit' ? `Prix par ${unit==='autre'?(customUnit||'unite'):unit} (FCFA)`
                  :'Prix (FCFA)'}
                </Text>
                <TextInput style={s.input} value={price} onChangeText={setPrice}
                  placeholder="0" placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
              </View>
            )}
            {billingType==='per_unit'&&(
              <>
                <View style={s.field}>
                  <Text style={s.label}>Unite de mesure *</Text>
                  <TouchableOpacity style={[s.input,{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}]}
                    onPress={()=>setUnitOpen(!unitOpen)}>
                    <Text style={{fontSize:15,color:unit?'#111827':'#9CA3AF'}}>
                      {units.find(u2=>u2.id===unit)?.label ?? 'Choisir'}
                    </Text>
                    <Feather name={unitOpen?'chevron-up':'chevron-down'} size={16} color="#9CA3AF"/>
                  </TouchableOpacity>
                  {unitOpen&&(
                    <View style={s.dropdown}>
                      {units.map(opt=>(
                        <TouchableOpacity key={opt.id}
                          style={[s.dropdownItem,unit===opt.id&&s.dropdownItemActive]}
                          onPress={()=>{setUnit(opt.id);setUnitOpen(false);if(opt.id!=='autre')setCustomUnit('');}}>
                          <Text style={[s.dropdownTxt,unit===opt.id&&{color:ORANGE,fontWeight:'700'}]}>{opt.label}</Text>
                          {unit===opt.id&&<Feather name="check" size={14} color={ORANGE}/>}
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  {unit==='autre'&&(
                    <TextInput style={[s.input,{marginTop:8}]} value={customUnit} onChangeText={setCustomUnit}
                      placeholder="Ex : panneau, baie..." placeholderTextColor="#9CA3AF" maxLength={30}/>
                  )}
                </View>
                {kindStr==='prestation'&&(
                  <View style={s.field}>
                    <Text style={s.label}>Quantite minimale d'intervention (optionnel)</Text>
                    <TextInput style={s.input} value={minQty} onChangeText={setMinQty}
                      placeholder={`Ex : 2 ${unit==='autre'?(customUnit||'unites'):unit}`}
                      placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
                  </View>
                )}
              </>
            )}
          </View>

          {/* Stock (article) */}
          {kind==='article'&&(
            <View style={s.card}>
              <Text style={s.cardTitle}>Stock</Text>
              <View style={s.field}>
                <Text style={s.label}>Quantite en stock *</Text>
                <TextInput style={s.input} value={stockQty} onChangeText={setStockQty}
                  placeholder="Ex : 10" placeholderTextColor="#9CA3AF" keyboardType="numeric" defaultValue="1"/>
              </View>
              <View style={s.switchRow}>
                <View style={{flex:1}}>
                  <Text style={s.switchLabel}>Afficher le stock</Text>
                  <Text style={s.switchSub}>Les clients verront le nombre restant</Text>
                </View>
                <Switch value={showStock} onValueChange={setShowStock}
                  trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
              </View>
              <View style={{gap:8}}>
                <Text style={s.label}>Politique de retour</Text>
                <View style={{flexDirection:'row',gap:8}}>
                  {([{id:'none',label:'Non'},{id:'yes',label:'Oui'},{id:'conditions',label:'Sous conditions'}] as const).map(opt=>(
                    <TouchableOpacity key={opt.id}
                      style={[s.unitChip,returnPolicy===opt.id&&s.unitChipActive,{flex:1,justifyContent:'center'}]}
                      onPress={()=>setReturnPolicy(opt.id)}>
                      <Text style={[s.unitChipTxt,{textAlign:'center'},returnPolicy===opt.id&&{color:ORANGE,fontWeight:'700'}]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {returnPolicy!=='none'&&(
                  <View style={{gap:10}}>
                    <View style={s.field}>
                      <Text style={s.label}>Delai de retour (jours)</Text>
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
                      <Text style={s.label}>Montant max remboursable (FCFA) — optionnel</Text>
                      <TextInput style={s.input} value={returnMaxAmount} onChangeText={setReturnMaxAmount}
                        placeholder="Ex : 5000" placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
                    </View>
                    <View style={s.switchRow}>
                      <View style={{flex:1}}>
                        <Text style={s.switchLabel}>Echange accepte</Text>
                        <Text style={s.switchSub}>Le client peut echanger au lieu d'etre rembourse</Text>
                      </View>
                      <Switch value={exchangeOk} onValueChange={setExchangeOk}
                        trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
                    </View>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Promotions */}
          <View style={s.card}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}>
              <Text style={s.cardTitle}>Promotion</Text>
              <Switch value={promoActive} onValueChange={setPromoActive}
                trackColor={{false:'#E5E7EB',true:ORANGE}} thumbColor="#fff"/>
            </View>
            {promoActive&&(
              <View style={{gap:12}}>
                <View style={s.field}>
                  <Text style={s.label}>Type</Text>
                  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                    {[{id:'percentage',l:'% Reduction'},{id:'fixed_amount',l:'Montant fixe'},{id:'buy_x_get_y',l:'X+Y offert'},{id:'free_first',l:'1ere gratuite'}].map(t=>(
                      <TouchableOpacity key={t.id}
                        style={[s.unitChip,promoType===t.id&&s.unitChipActive]}
                        onPress={()=>setPromoType(t.id as any)}>
                        <Text style={[s.unitChipTxt,promoType===t.id&&{color:ORANGE,fontWeight:'700'}]}>{t.l}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                {(promoType==='percentage'||promoType==='fixed_amount')&&(
                  <View style={s.field}>
                    <Text style={s.label}>{promoType==='percentage'?'Reduction (%)':'Montant reduit (FCFA)'}</Text>
                    <TextInput style={s.input} value={promoValue} onChangeText={setPromoValue}
                      placeholder={promoType==='percentage'?'Ex : 10':'Ex : 500'}
                      placeholderTextColor="#9CA3AF" keyboardType="numeric"/>
                  </View>
                )}
                {promoType==='buy_x_get_y'&&(
                  <View style={{flexDirection:'row',gap:10}}>
                    <View style={[s.field,{flex:1}]}>
                      <Text style={s.label}>Acheter</Text>
                      <TextInput style={s.input} value={promoBuyQty} onChangeText={setPromoBuyQty}
                        keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    </View>
                    <View style={[s.field,{flex:1}]}>
                      <Text style={s.label}>Obtenir</Text>
                      <TextInput style={s.input} value={promoGetQty} onChangeText={setPromoGetQty}
                        keyboardType="numeric" placeholderTextColor="#9CA3AF"/>
                    </View>
                  </View>
                )}
                <View style={s.field}>
                  <Text style={s.label}>Code promo (optionnel)</Text>
                  <TextInput style={s.input} value={promoCode}
                    onChangeText={t=>setPromoCode(t.toUpperCase())}
                    placeholder="Ex : BYMOH10" placeholderTextColor="#9CA3AF" autoCapitalize="characters"/>
                </View>
              </View>
            )}
          </View>

          {/* Créneaux */}
          {kind==='prestation'&&(
            <View style={s.card}>
              <Text style={s.cardTitle}>Creneaux de reservation</Text>
              {pendingSlots.length>0&&(
                <View style={{backgroundColor:'#F0FDF4',borderRadius:12,padding:10}}>
                  <Text style={{fontSize:13,color:'#166534',fontWeight:'600'}}>
                    {pendingSlots.length} creneau{pendingSlots.length>1?'x':''} configure{pendingSlots.length>1?'s':''}
                  </Text>
                </View>
              )}
              <TouchableOpacity style={s.slotBtn} onPress={()=>setSlotModalOpen(true)}>
                <Feather name="calendar" size={16} color={ORANGE}/>
                <Text style={s.slotBtnTxt}>{pendingSlots.length>0?'Modifier les creneaux':'Configurer les creneaux'}</Text>
              </TouchableOpacity>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modals */}
      <ServiceCategoryPicker visible={catPickerOpen}
        onClose={()=>setCatPickerOpen(false)}
        onSelect={cat=>setServiceCategory(cat)}/>

      <SuccessModal visible={successVisible} title="Succes !" message={successMsg}
        onClose={()=>{setSuccessVisible(false); router.navigate('/(pro)/boutique' as any);}}/>

      {/* Modal Add Media */}
      <Modal visible={mediaOpen} transparent animationType="slide" onRequestClose={()=>setMediaOpen(false)}>
        <View style={{flex:1,backgroundColor:'rgba(0,0,0,0.5)',justifyContent:'flex-end'}}>
          <View style={{backgroundColor:'#fff',borderTopLeftRadius:24,borderTopRightRadius:24,maxHeight:'85%'}}>
            <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',padding:20,borderBottomWidth:1,borderBottomColor:'#F3F4F6'}}>
              <Text style={{fontSize:18,fontWeight:'800',color:'#111827'}}>Ajouter une photo</Text>
              <TouchableOpacity style={{width:32,height:32,borderRadius:16,backgroundColor:'#F3F4F6',alignItems:'center',justifyContent:'center'}}
                onPress={()=>setMediaOpen(false)}>
                <Feather name="x" size={16} color="#374151"/>
              </TouchableOpacity>
            </View>
            <View style={{flexDirection:'row',padding:16,gap:8}}>
              {(['library','upload'] as MediaTab[]).map(tab=>(
                <TouchableOpacity key={tab}
                  style={{flex:1,paddingVertical:10,borderRadius:12,alignItems:'center',backgroundColor:mediaTab===tab?'#111827':'#F3F4F6'}}
                  onPress={()=>setMediaTab(tab)}>
                  <Text style={{fontSize:14,fontWeight:'700',color:mediaTab===tab?'#fff':'#6B7280'}}>
                    {tab==='library'?'Bibliotheque':'Ajouter nouveau'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {mediaTab==='library'&&(
              <ScrollView contentContainerStyle={{padding:16}}>
                {libLoading ? <ActivityIndicator color={ORANGE} style={{padding:40}}/>
                : library.length===0 ? (
                  <View style={{alignItems:'center',padding:40,gap:10}}>
                    <Feather name="image" size={40} color="#E5E7EB"/>
                    <Text style={{color:'#9CA3AF',fontSize:14,textAlign:'center'}}>
                      Aucune image.{'\n'}Utilisez "Ajouter nouveau".
                    </Text>
                  </View>
                ) : (
                  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>
                    {library.map((url,i)=>{
                      const selected = images.some(img=>img.url===url);
                      return (
                        <TouchableOpacity key={i}
                          style={{width:(W-64)/3,aspectRatio:1,borderRadius:10,overflow:'hidden',borderWidth:selected?3:0,borderColor:selected?ORANGE:'transparent'}}
                          onPress={()=>{setImages(prev=>[...prev,{url}]);setMediaOpen(false);}}>
                          <Image source={{uri:url}} style={{width:'100%',height:'100%',resizeMode:'cover'}}/>
                          {selected&&(
                            <View style={{position:'absolute',top:6,right:6,width:22,height:22,borderRadius:11,backgroundColor:ORANGE,alignItems:'center',justifyContent:'center'}}>
                              <Feather name="check" size={12} color="#fff"/>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            )}
            {mediaTab==='upload'&&(
              <View style={{padding:20,gap:12}}>
                <TouchableOpacity style={s.uploadOption}
                  onPress={async()=>{
                    if(images.length>=4){Alert.alert('Maximum atteint','4 photos maximum.');return;}
                    const {status}=await ImagePicker.requestCameraPermissionsAsync();
                    if(status!=='granted'){Alert.alert('Permission requise');return;}
                    const r=await ImagePicker.launchCameraAsync({quality:0.85});
                    if(!r.canceled&&r.assets[0]){setImages(prev=>[...prev,{uri:r.assets[0].uri}]);setMediaOpen(false);}
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
                    if(!r.canceled&&r.assets[0]){setImages(prev=>[...prev,{uri:r.assets[0].uri}]);setMediaOpen(false);}
                  }}>
                  <View style={[s.uploadIcon,{backgroundColor:'#EEF2FF'}]}><Feather name="image" size={22} color="#1E3A5F"/></View>
                  <View style={{flex:1}}>
                    <Text style={s.uploadLabel}>Choisir dans la galerie</Text>
                    <Text style={s.uploadSub}>Selectionner depuis vos photos</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#9CA3AF"/>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <AvailabilityModal
        visible={slotModalOpen}
        durationMin={durationMin}
        businessHours={bizHours}
        existingCount={pendingSlots.length}
        onClose={()=>setSlotModalOpen(false)}
        onConfirm={slots=>setPendingSlots(slots)}/>
    </View>
  );
}

const s = StyleSheet.create({
  header:          { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingBottom:14, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  backBtn:         { width:38, height:38, borderRadius:19, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  headerTitle:     { flex:1, fontSize:16, fontWeight:'800', color:'#111827' },
  saveBtn:         { backgroundColor:ORANGE, borderRadius:10, paddingHorizontal:14, paddingVertical:8 },
  saveBtnTxt:      { fontSize:13, fontWeight:'700', color:'#fff' },
  kindRow:         { flexDirection:'row', gap:12 },
  kindBtn:         { flex:1, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#F3F4F6', borderRadius:14, paddingVertical:14, borderWidth:1.5, borderColor:'#E5E7EB' },
  kindBtnActive:   { backgroundColor:'#FEF2EC', borderColor:ORANGE },
  kindLabel:       { fontSize:15, fontWeight:'600', color:'#6B7280' },
  catBadge:        { flexDirection:'row', alignItems:'center', gap:12, borderRadius:16, padding:14, borderWidth:1.5 },
  catBadgeLabel:   { fontSize:15, fontWeight:'800' },
  catBadgeSub:     { fontSize:11, color:'#9CA3AF', marginTop:1 },
  imgBtnEmpty:     { width:'100%', height:160, borderRadius:18, backgroundColor:'#F3F4F6', borderWidth:2, borderColor:'#E5E7EB', borderStyle:'dashed', alignItems:'center', justifyContent:'center', gap:10 },
  imgBtnEmptyIcon: { width:52, height:52, borderRadius:26, backgroundColor:'#E5E7EB', alignItems:'center', justifyContent:'center' },
  imgBtnEmptyTxt:  { fontSize:14, fontWeight:'600', color:'#9CA3AF' },
  imgBtnEmptySub:  { fontSize:12, color:'#C4C9D4' },
  imgBtnAdd:       { width:100, height:100, borderRadius:14, backgroundColor:'#F3F4F6', borderWidth:2, borderColor:'#E5E7EB', borderStyle:'dashed', alignItems:'center', justifyContent:'center', gap:4 },
  card:            { backgroundColor:'#fff', borderRadius:18, padding:18, gap:12, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  cardTitle:       { fontSize:16, fontWeight:'800', color:'#111827' },
  field:           { gap:6 },
  label:           { fontSize:11, fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.4 },
  input:           { backgroundColor:'#F3F4F6', borderRadius:12, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:'#111827', borderWidth:1.5, borderColor:'#E5E7EB' },
  switchRow:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:2 },
  switchLabel:     { fontSize:14, fontWeight:'600', color:'#111827' },
  switchSub:       { fontSize:12, color:'#9CA3AF', marginTop:1 },
  unitChip:        { paddingHorizontal:12, paddingVertical:8, borderRadius:100, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'#E5E7EB' },
  unitChipActive:  { backgroundColor:'#FEF2EC', borderColor:ORANGE },
  unitChipTxt:     { fontSize:13, fontWeight:'600', color:'#6B7280' },
  durationRow:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#F3F4F6', borderRadius:14, padding:10, borderWidth:1.5, borderColor:'#E5E7EB' },
  durationBtn:     { width:40, height:40, borderRadius:20, backgroundColor:'#fff', alignItems:'center', justifyContent:'center', shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.08, shadowRadius:3, elevation:2 },
  durationVal:     { fontSize:20, fontWeight:'800', color:'#111827', minWidth:80, textAlign:'center' },
  billingChip:     { flexDirection:'row', alignItems:'center', gap:6, paddingHorizontal:12, paddingVertical:8, borderRadius:12, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'#E5E7EB' },
  billingChipActive:{ backgroundColor:'#FEF2EC', borderColor:ORANGE },
  billingChipTxt:  { fontSize:13, fontWeight:'600', color:'#6B7280' },
  dropdown:        { backgroundColor:'#fff', borderRadius:12, borderWidth:1, borderColor:'#E5E7EB', overflow:'hidden', shadowColor:'#000', shadowOffset:{width:0,height:2}, shadowOpacity:0.08, shadowRadius:6, elevation:4 },
  dropdownItem:    { flexDirection:'row', alignItems:'center', justifyContent:'space-between', padding:14, borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  dropdownItemActive:{ backgroundColor:'#FEF2EC' },
  dropdownTxt:     { fontSize:14, color:'#374151' },
  slotBtn:         { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8, backgroundColor:'#FEF2EC', borderRadius:14, paddingVertical:13, borderWidth:1.5, borderColor:'#FDDCCA' },
  slotBtnTxt:      { fontSize:14, fontWeight:'700', color:ORANGE },
  uploadOption:    { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#F9FAFB', borderRadius:16, padding:14, borderWidth:1, borderColor:'#F3F4F6' },
  uploadIcon:      { width:48, height:48, borderRadius:14, alignItems:'center', justifyContent:'center' },
  uploadLabel:     { fontSize:15, fontWeight:'700', color:'#111827' },
  uploadSub:       { fontSize:12, color:'#9CA3AF', marginTop:2 },
});
