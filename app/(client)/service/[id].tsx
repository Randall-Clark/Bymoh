// app/(client)/service/[id].tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useLocationStore } from '@/stores/locationStore';

// ── Types locaux ────────────────────────────────────────────────────────────
type ServiceCategory = 'at_merchant' | 'at_client' | 'hybrid' | 'intermediary';
type BillingType     = 'fixed' | 'hourly' | 'per_day' | 'per_unit' | 'free' | 'quote';
type Step            = 'detail' | 'slot' | 'form' | 'payment' | 'confirm';

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmtPrice(price: number, billing: BillingType, unit?: string): string {
  if (billing === 'free')     return 'Gratuit';
  if (billing === 'quote')    return 'Sur devis';
  const p = (price ?? 0).toLocaleString('fr-FR');
  if (billing === 'hourly')   return `${p} FCFA / h`;
  if (billing === 'per_day')  return `${p} FCFA / j`;
  if (billing === 'per_unit') return `${p} FCFA / ${unit ?? 'u'}`;
  return `${p} FCFA`;
}

function fmtPromo(s: any): string | null {
  if (!s?.promo_active) return null;
  switch (s.promo_type) {
    case 'percentage':   return `-${s.promo_value}%`;
    case 'fixed_amount': return `-${(s.promo_value ?? 0).toLocaleString('fr-FR')} FCFA`;
    case 'buy_x_get_y':  return `${s.promo_buy_qty}+${s.promo_get_qty} offert`;
    case 'free_first':   return '1ere gratuite';
    default:             return null;
  }
}

function calcTotal(s: any, qty: number, hrs: number, promo: boolean): number {
  let base = s.price ?? 0;
  if (s.billing_type === 'hourly')   base = base * hrs;
  else if (s.billing_type === 'per_unit') base = base * qty;
  if (!promo || !s.promo_active) return base;
  switch (s.promo_type) {
    case 'percentage':   return base * (1 - (s.promo_value ?? 0) / 100);
    case 'fixed_amount': return Math.max(0, base - (s.promo_value ?? 0));
    case 'buy_x_get_y': {
      const free = Math.floor(qty / ((s.promo_buy_qty ?? 1) + (s.promo_get_qty ?? 1))) * (s.promo_get_qty ?? 1);
      return (qty - free) * (s.price ?? 0);
    }
    case 'free_first': return Math.max(0, base - (s.price ?? 0));
    default:           return base;
  }
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const DAYS_FR: Record<number, string> = { 0:'Dim', 1:'Lun', 2:'Mar', 3:'Mer', 4:'Jeu', 5:'Ven', 6:'Sam' };

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Especes',        emoji: '💵', desc: 'Paiement en main propre' },
  { id: 'momo', label: 'Mobile Money',   emoji: '📱', desc: 'MTN, Moov, Orange...' },
  { id: 'card', label: 'Carte bancaire', emoji: '💳', desc: 'Visa, Mastercard' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function ServiceDetailScreen() {
  const insets       = useSafeAreaInsets();
  const { id, businessId } = useLocalSearchParams<{ id: string; businessId?: string }>();
  const { profile }  = useAuthStore();
  const locStore     = useLocationStore() as any;
  const qc           = useQueryClient();

  const [step,          setStep]          = useState<Step>('detail');
  const [selectedSlot,  setSelectedSlot]  = useState<any>(null);

  // Champs communs
  const [quantity,      setQuantity]      = useState(1);
  const [hours,         setHours]         = useState(1);
  const [notes,         setNotes]         = useState('');
  const [manualDate,    setManualDate]    = useState('');
  const [manualTime,    setManualTime]    = useState('');
  const [promoCode,     setPromoCode]     = useState('');
  const [promoApplied,  setPromoApplied]  = useState(false);
  const [promoError,    setPromoError]    = useState('');
  const [payMethod,     setPayMethod]     = useState('cash');
  const [booking,       setBooking]       = useState(false);

  // Champs per_unit / livraison
  const [deliveryNeeded, setDeliveryNeeded] = useState(false);
  const [deliveryAddr,   setDeliveryAddr]   = useState(locStore?.address ?? '');
  const [parcelDesc,     setParcelDesc]     = useState('');
  const [parcelWeight,   setParcelWeight]   = useState('');

  // Champs at_client / hybrid
  const [clientAddr,     setClientAddr]     = useState('');
  const [locationChoice, setLocationChoice] = useState<'merchant'|'client'>('merchant');

  // Champs intermediary
  const [pickupAddr,    setPickupAddr]    = useState('');
  const [dropoffAddr,   setDropoffAddr]   = useState('');
  const [parcelFragile, setParcelFragile] = useState(false);
  const [nbPersons,     setNbPersons]     = useState('1');

  // ── Service ────────────────────────────────────────────────────────────────
  const { data: service, isLoading } = useQuery({
    queryKey: ['svc', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, business:businesses(id,name,city,category_icon,timezone)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Creneaux ───────────────────────────────────────────────────────────────
  const { data: slots = [] } = useQuery({
    queryKey: ['slots-client', id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('service_availability')
        .select('*')
        .eq('service_id', id!)
        .eq('is_blocked', false)
        .gte('date', today)
        .order('date').order('start_time');
      if (error) throw error;
      return (data ?? []).filter((s: any) => s.booked_slots < s.max_slots);
    },
    enabled: !!id,
  });

  if (isLoading || !service) {
    return <View style={s.center}><ActivityIndicator color="#FF6835" size="large" /></View>;
  }

  // ── Variables derives ──────────────────────────────────────────────────────
  const billing: BillingType     = service.billing_type ?? 'fixed';
  const category: ServiceCategory = service.service_category ?? 'at_merchant';
  const isPriced    = !['free','quote'].includes(billing);
  const isPerUnit   = billing === 'per_unit';
  const isHourly    = billing === 'hourly';
  const isAtClient  = category === 'at_client';
  const isHybrid    = category === 'hybrid';
  const isInter     = category === 'intermediary';
  const promoLabel  = fmtPromo(service);

  // Duree auto si creneau selectionne + service horaire
  const slotDurMin = selectedSlot
    ? (() => {
        const [sh, sm] = selectedSlot.start_time.split(':').map(Number);
        const [eh, em] = selectedSlot.end_time.split(':').map(Number);
        return (eh * 60 + em) - (sh * 60 + sm);
      })()
    : null;
  const autoHours     = (selectedSlot && isHourly && slotDurMin) ? slotDurMin / 60 : null;
  const effectiveHours = autoHours ?? hours;
  const total = isPriced ? calcTotal(service, quantity, effectiveHours, promoApplied) : 0;

  // ── Promo ──────────────────────────────────────────────────────────────────
  const applyPromo = () => {
    const valid = service.promo_active && (
      !service.promo_code || promoCode.trim().toUpperCase() === service.promo_code
    );
    setPromoApplied(valid);
    setPromoError(valid ? '' : 'Code promo invalide ou expire.');
  };

  // ── Confirmation ───────────────────────────────────────────────────────────
  const confirmBooking = async () => {
    if (!profile?.id) { Alert.alert('Connectez-vous pour reserver.'); return; }
    if (isAtClient && !clientAddr.trim()) { Alert.alert('Adresse requise', 'Entrez votre adresse.'); return; }
    if (isInter && !pickupAddr.trim())    { Alert.alert('Adresse requise', 'Entrez l\'adresse de depart.'); return; }
    if (isInter && !dropoffAddr.trim())   { Alert.alert('Adresse requise', 'Entrez l\'adresse d\'arrivee.'); return; }
    if (!selectedSlot) {
      if (!manualDate.match(/^\d{4}-\d{2}-\d{2}$/)) { Alert.alert('Date invalide', 'Format : AAAA-MM-JJ'); return; }
      if (!manualTime.match(/^\d{2}:\d{2}$/))        { Alert.alert('Heure invalide', 'Format : HH:MM'); return; }
    }

    setBooking(true);
    try {
      const noteParts = [
        notes,
        isAtClient  ? `ADRESSE: ${clientAddr}` : '',
        isHybrid && locationChoice === 'client' ? `DOMICILE: ${clientAddr}` : '',
        isInter     ? `DEPART: ${pickupAddr} | ARRIVEE: ${dropoffAddr}` : '',
        isInter && parcelFragile ? 'FRAGILE' : '',
        isInter && service.accepts_persons ? `PERSONNES: ${nbPersons}` : '',
        deliveryNeeded ? `LIVRAISON: ${deliveryAddr}` : '',
        deliveryNeeded && parcelDesc ? `COLIS: ${parcelDesc}` : '',
        deliveryNeeded && parcelWeight ? `POIDS: ${parcelWeight}` : '',
      ].filter(Boolean);

      const { error: bookErr } = await supabase.from('bookings').insert({
        id:              generateId(),
        user_id:         profile.id,
        business_id:     service.business_id,
        service_id:      service.id,
        booking_date:    selectedSlot ? selectedSlot.date       : manualDate,
        start_time:      selectedSlot ? selectedSlot.start_time : manualTime,
        quantity:        isPerUnit ? quantity : (isHourly ? effectiveHours : 1),
        unit_price:      service.price ?? 0,
        subtotal:        total,
        promo_code_used: promoApplied ? promoCode.toUpperCase() : null,
        discount_amount: 0,
        total_amount:    total,
        payment_method:  payMethod,
        payment_status:  'pending',
        notes:           noteParts.join(' | ') || null,
        status:          'confirmed',
      });
      if (bookErr) throw bookErr;

      if (selectedSlot) {
        await supabase.from('service_availability')
          .update({ booked_slots: selectedSlot.booked_slots + 1 })
          .eq('id', selectedSlot.id);
        await qc.invalidateQueries({ queryKey: ['slots-client', id] });
      }

      setStep('confirm');
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de creer la reservation.');
    } finally {
      setBooking(false);
    }
  };

  // ── Confirmation screen ────────────────────────────────────────────────────
  if (step === 'confirm') {
    return (
      <View style={[s.center, { backgroundColor: '#F8F7F4', paddingHorizontal: 24 }]}>
        <View style={s.confirmCard}>
          <View style={s.confirmIcon}><Feather name="check-circle" size={52} color="#22C55E" /></View>
          <Text style={s.confirmTitle}>Reservation confirmee !</Text>
          <Text style={s.confirmSub}>
            <Text style={{ fontWeight:'700' }}>{service.title}</Text>
            {'\n'}Le {selectedSlot?.date ?? manualDate} a {selectedSlot?.start_time ?? manualTime}
          </Text>
          {isPriced && (
            <Text style={{ fontSize:18, fontWeight:'800', color:'#FF6835' }}>
              {total.toLocaleString('fr-FR')} FCFA
            </Text>
          )}
          {payMethod === 'cash' && (
            <View style={s.cashNote}>
              <Feather name="info" size={14} color="#1E3A5F" />
              <Text style={s.cashNoteTxt}>Paiement en especes a effectuer sur place.</Text>
            </View>
          )}
          <TouchableOpacity style={s.confirmBtn}
            onPress={() => {
              if (businessId) {
                router.push({ pathname: '/(client)/business/[id]' as any, params: { id: businessId } });
              } else {
                router.replace('/(client)' as any);
              }
            }}>
            <Text style={s.confirmBtnTxt}>Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stepLabel: Record<Step, string> = {
    detail:  service.title,
    slot:    'Choisir un creneau',
    form:    'Details de la reservation',
    payment: 'Mode de paiement',
    confirm: 'Confirme',
  };

  return (
    <View style={{ flex:1, flexDirection:'column', backgroundColor:'#F8F7F4',
      paddingTop: Platform.OS === 'web' ? 67 : insets.top }}>

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn}
          onPress={() => {
            const prev: Record<Step, Step|null> = {
              detail:null, slot:'detail', form:'slot', payment:'form', confirm:null,
            };
            const p = prev[step];
            if (p) {
              setStep(p);
            } else if (businessId) {
              router.push({ pathname:'/(client)/business/[id]' as any, params:{ id: businessId } });
            } else {
              router.back();
            }
          }}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle} numberOfLines={1}>{stepLabel[step]}</Text>
        <View style={s.stepDots}>
          {(['slot','form','payment'] as Step[]).map((st, i) => (
            <View key={st} style={[
              s.stepDot,
              step === st && s.stepDotActive,
              ['form','payment','confirm'].includes(step) && i < ['slot','form','payment'].indexOf(step) && s.stepDotDone,
            ]} />
          ))}
        </View>
      </View>

      <ScrollView style={{ flex:1 }} showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding:20, gap:16, paddingBottom:20 }}
        keyboardShouldPersistTaps="handled">

        {/* ════ DETAIL ════ */}
        {step === 'detail' && (
          <>
            {service.image_url
              ? <Image source={{ uri: service.image_url }} style={s.svcImg} />
              : <View style={s.svcImgPh}><Text style={{ fontSize:52 }}>{service.business?.category_icon ?? '🛎️'}</Text></View>
            }
            <View style={s.card}>
              <View style={{ flexDirection:'row', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
                <Text style={s.svcTitle}>{service.title}</Text>
                {promoLabel && (
                  <View style={s.promoBadge}><Text style={s.promoBadgeTxt}>{promoLabel}</Text></View>
                )}
              </View>
              <Text style={s.price}>{fmtPrice(service.price ?? 0, billing, service.unit)}</Text>
              {service.duration_minutes ? (
                <View style={s.infoRow}>
                  <Feather name="clock" size={14} color="#9CA3AF" />
                  <Text style={s.infoTxt}>
                    {service.duration_minutes < 60
                      ? `${service.duration_minutes} min`
                      : `${Math.floor(service.duration_minutes/60)}h${service.duration_minutes%60>0?service.duration_minutes%60+'min':''}`}
                  </Text>
                </View>
              ) : null}
              {service.business?.name ? (
                <View style={s.infoRow}>
                  <Feather name="map-pin" size={14} color="#9CA3AF" />
                  <Text style={s.infoTxt}>{service.business.name} · {service.business.city}</Text>
                </View>
              ) : null}
              {service.description ? (
                <Text style={s.desc}>{service.description}</Text>
              ) : null}

              {/* Badge categorie */}
              {(() => {
                const cats: Record<ServiceCategory, {emoji:string;label:string;color:string}> = {
                  at_merchant: { emoji:'🏪', label:'Chez le marchand', color:'#1E3A5F' },
                  at_client:   { emoji:'🏠', label:'Chez le client',   color:'#7C3AED' },
                  hybrid:      { emoji:'🔄', label:'Hybride',          color:'#059669' },
                  intermediary:{ emoji:'🚚', label:'Transport / Livraison', color:'#FF6835' },
                };
                const cat = cats[category];
                return cat ? (
                  <View style={[s.catTag, { backgroundColor: cat.color + '15', borderColor: cat.color + '40' }]}>
                    <Text style={{ fontSize:14 }}>{cat.emoji}</Text>
                    <Text style={[s.catTagTxt, { color: cat.color }]}>{cat.label}</Text>
                  </View>
                ) : null;
              })()}
            </View>

            {promoLabel && (
              <View style={s.promoCard}>
                <Feather name="tag" size={16} color="#FF6835" />
                <View style={{ flex:1 }}>
                  <Text style={s.promoCardTxt}>Offre : {promoLabel}</Text>
                  {service.promo_code ? <Text style={s.promoCodeTxt}>Code : {service.promo_code}</Text> : null}
                </View>
              </View>
            )}
          </>
        )}

        {/* ════ CRENEAUX ════ */}
        {step === 'slot' && (
          <View style={s.card}>
            <Text style={s.cardTitle}>Choisissez un creneau</Text>
            {slots.length === 0 ? (
              <View style={s.noSlots}>
                <Feather name="calendar" size={36} color="#E5E7EB" />
                <Text style={s.noSlotsTxt}>Pas de creneaux predefinis</Text>
                <Text style={s.noSlotsSub}>
                  Choisissez votre date et heure librement.
                </Text>
                <TouchableOpacity style={s.freeBookBtn} onPress={() => setStep('form')}>
                  <Feather name="edit" size={14} color="#FF6835" />
                  <Text style={s.freeBookBtnTxt}>Choisir ma date et heure</Text>
                </TouchableOpacity>
              </View>
            ) : (
              slots.map((slot: any) => {
                const d   = new Date(slot.date + 'T12:00:00');
                const sel = selectedSlot?.id === slot.id;
                const rem = slot.max_slots - slot.booked_slots;
                return (
                  <TouchableOpacity
                    key={slot.id}
                    style={[s.slotRow, sel && s.slotRowActive]}
                    onPress={() => setSelectedSlot(slot)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex:1 }}>
                      <Text style={[s.slotDate, sel && { color:'#FF6835' }]}>
                        {DAYS_FR[d.getDay()]} {d.getDate()}/{d.getMonth()+1}
                      </Text>
                      <Text style={[s.slotTime, sel && { color:'#FF6835' }]}>
                        {slot.start_time} - {slot.end_time}
                      </Text>
                    </View>
                    <View style={{ alignItems:'flex-end', gap:4 }}>
                      <Text style={s.slotAvail}>{rem} place{rem>1?'s':''} dispo</Text>
                      <View style={[s.radio, sel && s.radioActive]}>
                        {sel && <View style={s.radioDot} />}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ════ FORMULAIRE ════ */}
        {step === 'form' && (
          <>
            {/* Recap creneau ou saisie manuelle */}
            {selectedSlot ? (
              <View style={s.slotRecap}>
                <Feather name="calendar" size={14} color="#FF6835" />
                <Text style={s.slotRecapTxt}>
                  {selectedSlot.date} · {selectedSlot.start_time} - {selectedSlot.end_time}
                </Text>
              </View>
            ) : (
              <View style={s.manualCard}>
                <Text style={s.manualTitle}>Choisissez votre date et heure</Text>
                <View style={s.field}>
                  <Text style={s.label}>Date *</Text>
                  <TextInput style={s.input} value={manualDate} onChangeText={setManualDate}
                    placeholder="AAAA-MM-JJ" placeholderTextColor="#9CA3AF"
                    keyboardType="numbers-and-punctuation" />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>Heure *</Text>
                  <TextInput style={s.input} value={manualTime} onChangeText={setManualTime}
                    placeholder="HH:MM (ex: 09:30)" placeholderTextColor="#9CA3AF"
                    keyboardType="numbers-and-punctuation" />
                </View>
              </View>
            )}

            <View style={s.card}>
              <Text style={s.cardTitle}>Informations</Text>

              {/* Quantite (per_unit) */}
              {isPerUnit && (
                <View style={s.field}>
                  <Text style={s.label}>Quantite ({service.unit ?? 'unite'})</Text>
                  <View style={s.qtyRow}>
                    <TouchableOpacity style={s.qtyBtn}
                      onPress={() => setQuantity(Math.max(service.min_quantity ?? 1, quantity - 1))}>
                      <Feather name="minus" size={16} color="#111827" />
                    </TouchableOpacity>
                    <Text style={s.qtyVal}>{quantity}</Text>
                    <TouchableOpacity style={s.qtyBtn}
                      onPress={() => setQuantity(Math.min(service.max_qty_per_client ?? service.max_quantity ?? 99, quantity + 1))}>
                      <Feather name="plus" size={16} color="#111827" />
                    </TouchableOpacity>
                    <Text style={s.qtyUnit}>{service.unit ?? 'unite'}</Text>
                  </View>
                </View>
              )}

              {/* Duree (hourly) */}
              {isHourly && (
                <View style={s.field}>
                  <Text style={s.label}>Duree</Text>
                  {autoHours !== null ? (
                    <View style={s.slotDurInfo}>
                      <Feather name="clock" size={14} color="#22C55E" />
                      <Text style={s.slotDurTxt}>
                        {slotDurMin! >= 60
                          ? `${Math.floor(slotDurMin!/60)}h${slotDurMin!%60>0?slotDurMin!%60+'min':''}`
                          : `${slotDurMin} min`}
                        {' '}- incluse dans le creneau reserve
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={{ fontSize:12, color:'#9CA3AF', marginBottom:6 }}>
                        Aucun creneau - choisissez votre duree :
                      </Text>
                      <View style={s.qtyRow}>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => setHours(Math.max(1, hours-1))}>
                          <Feather name="minus" size={16} color="#111827" />
                        </TouchableOpacity>
                        <Text style={s.qtyVal}>{hours}h</Text>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => setHours(hours+1)}>
                          <Feather name="plus" size={16} color="#111827" />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              )}

              {/* Notes */}
              <View style={s.field}>
                <Text style={s.label}>Notes (optionnel)</Text>
                <TextInput style={[s.input, { height:80, textAlignVertical:'top', paddingTop:12 }]}
                  value={notes} onChangeText={setNotes}
                  placeholder="Precisions pour le marchand..." placeholderTextColor="#9CA3AF" multiline />
              </View>
            </View>

            {/* ── Champs hybride ── */}
            {isHybrid && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Lieu de la prestation</Text>
                <View style={{ flexDirection:'row', gap:10 }}>
                  {(['merchant','client'] as const).map((loc) => (
                    <TouchableOpacity
                      key={loc}
                      style={[s.locChoice, locationChoice === loc && s.locChoiceActive]}
                      onPress={() => setLocationChoice(loc)}
                    >
                      <Text style={{ fontSize:20 }}>{loc === 'merchant' ? '🏪' : '🚗'}</Text>
                      <Text style={[s.locChoiceTxt, locationChoice === loc && { color:'#FF6835', fontWeight:'700' }]}>
                        {loc === 'merchant' ? 'En magasin' : 'A domicile'}
                      </Text>
                      {loc === 'client' && (service.travel_fee ?? 0) > 0 && (
                        <Text style={s.feeTag}>Deplacement +{(service.travel_fee ?? 0).toLocaleString('fr-FR')} FCFA</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                {locationChoice === 'client' && (
                  <View style={s.field}>
                    <Text style={s.label}>Votre adresse</Text>
                    <TextInput style={s.input} value={clientAddr} onChangeText={setClientAddr}
                      placeholder="Adresse complete" placeholderTextColor="#9CA3AF" />
                  </View>
                )}
              </View>
            )}

            {/* ── Champs at_client ── */}
            {isAtClient && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Adresse d'intervention</Text>
                <View style={s.field}>
                  <Text style={s.label}>Votre adresse *</Text>
                  <TextInput style={s.input} value={clientAddr} onChangeText={setClientAddr}
                    placeholder="Rue, quartier, ville..." placeholderTextColor="#9CA3AF" multiline />
                </View>
                {(service.travel_fee ?? 0) > 0 && (
                  <View style={s.infoRow}>
                    <Feather name="navigation" size={13} color="#FF6835" />
                    <Text style={{ fontSize:13, color:'#FF6835' }}>
                      Frais de deplacement : {(service.travel_fee ?? 0).toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* ── Champs intermediary ── */}
            {isInter && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Details du transport</Text>
                <View style={s.field}>
                  <Text style={s.label}>Adresse de depart *</Text>
                  <TextInput style={s.input} value={pickupAddr} onChangeText={setPickupAddr}
                    placeholder="D'ou souhaitez-vous partir / envoyer ?" placeholderTextColor="#9CA3AF" multiline />
                </View>
                <View style={s.field}>
                  <Text style={s.label}>Adresse d'arrivee *</Text>
                  <TextInput style={s.input} value={dropoffAddr} onChangeText={setDropoffAddr}
                    placeholder="Ou souhaitez-vous arriver / envoyer ?" placeholderTextColor="#9CA3AF" multiline />
                </View>
                {service.accepts_fragile && (
                  <TouchableOpacity
                    style={[s.checkRow, parcelFragile && s.checkRowActive]}
                    onPress={() => setParcelFragile(!parcelFragile)}
                  >
                    <Feather name={parcelFragile ? 'check-square' : 'square'} size={18}
                      color={parcelFragile ? '#FF6835' : '#9CA3AF'} />
                    <Text style={[s.checkTxt, parcelFragile && { color:'#FF6835' }]}>
                      Colis fragile (verre, electronique...)
                    </Text>
                  </TouchableOpacity>
                )}
                {service.accepts_persons && (
                  <View style={s.field}>
                    <Text style={s.label}>Nombre de personnes</Text>
                    <View style={s.qtyRow}>
                      <TouchableOpacity style={s.qtyBtn}
                        onPress={() => setNbPersons(String(Math.max(1, parseInt(nbPersons)-1)))}>
                        <Feather name="minus" size={16} color="#111827" />
                      </TouchableOpacity>
                      <Text style={s.qtyVal}>{nbPersons}</Text>
                      <TouchableOpacity style={s.qtyBtn}
                        onPress={() => setNbPersons(String(parseInt(nbPersons)+1))}>
                        <Feather name="plus" size={16} color="#111827" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── Livraison (per_unit) ── */}
            {isPerUnit && (
              <View style={s.card}>
                <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
                  <View style={{ flex:1, marginRight:12 }}>
                    <Text style={s.cardTitle}>Livraison a domicile</Text>
                    <Text style={{ fontSize:12, color:'#9CA3AF', marginTop:2 }}>
                      Des frais supplementaires peuvent s'appliquer
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[s.toggleBtn, deliveryNeeded && s.toggleBtnOn]}
                    onPress={() => setDeliveryNeeded(!deliveryNeeded)}
                  >
                    <Text style={[s.toggleBtnTxt, deliveryNeeded && { color:'#FF6835' }]}>
                      {deliveryNeeded ? 'Oui' : 'Non'}
                    </Text>
                  </TouchableOpacity>
                </View>
                {deliveryNeeded && (
                  <>
                    <View style={s.field}>
                      <Text style={s.label}>Adresse de livraison</Text>
                      <TextInput style={s.input} value={deliveryAddr} onChangeText={setDeliveryAddr}
                        placeholder="Adresse complete" placeholderTextColor="#9CA3AF" />
                    </View>
                    <View style={s.field}>
                      <Text style={s.label}>Description du colis</Text>
                      <TextInput style={s.input} value={parcelDesc} onChangeText={setParcelDesc}
                        placeholder="Contenu, fragilite..." placeholderTextColor="#9CA3AF" />
                    </View>
                    <View style={s.field}>
                      <Text style={s.label}>Poids estime</Text>
                      <TextInput style={s.input} value={parcelWeight} onChangeText={setParcelWeight}
                        placeholder={`Ex: 2 ${service.unit ?? 'kg'}`} placeholderTextColor="#9CA3AF"
                        keyboardType="numeric" />
                    </View>
                  </>
                )}
              </View>
            )}

            {/* ── Code promo ── */}
            {isPriced && service.promo_active && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Code promo</Text>
                <View style={{ flexDirection:'row', gap:10 }}>
                  <TextInput style={[s.input, { flex:1 }]} value={promoCode}
                    onChangeText={(t) => { setPromoCode(t.toUpperCase()); setPromoApplied(false); setPromoError(''); }}
                    placeholder="Votre code" placeholderTextColor="#9CA3AF" autoCapitalize="characters" />
                  <TouchableOpacity style={s.applyBtn} onPress={applyPromo}>
                    <Text style={s.applyBtnTxt}>Appliquer</Text>
                  </TouchableOpacity>
                </View>
                {promoApplied && <Text style={{ color:'#22C55E', fontWeight:'600', fontSize:13 }}>OK : {promoLabel}</Text>}
                {promoError ? <Text style={{ color:'#EF4444', fontSize:13 }}>{promoError}</Text> : null}
                {service.promo_active && !service.promo_code && !promoApplied && (
                  <TouchableOpacity style={s.autoPromo} onPress={() => setPromoApplied(true)}>
                    <Feather name="tag" size={13} color="#FF6835" />
                    <Text style={{ color:'#FF6835', fontWeight:'600', fontSize:13 }}>Appliquer l'offre {promoLabel}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Recap prix */}
            {isPriced && (
              <View style={s.recapCard}>
                <View style={s.recapRow}>
                  <Text style={s.recapLabel}>{service.title} x {isHourly ? `${effectiveHours}h` : quantity}</Text>
                  <Text style={s.recapVal}>{((service.price ?? 0) * (isHourly ? effectiveHours : quantity)).toLocaleString('fr-FR')} FCFA</Text>
                </View>
                {promoApplied && (
                  <View style={s.recapRow}>
                    <Text style={[s.recapLabel, { color:'#22C55E' }]}>Reduction</Text>
                    <Text style={[s.recapVal, { color:'#22C55E' }]}>
                      -{(((service.price ?? 0) * (isHourly ? effectiveHours : quantity)) - total).toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                )}
                <View style={[s.recapRow, { borderTopWidth:1, borderTopColor:'#F3F4F6', paddingTop:10, marginTop:4 }]}>
                  <Text style={{ fontSize:16, fontWeight:'800', color:'#111827' }}>Total</Text>
                  <Text style={{ fontSize:18, fontWeight:'800', color:'#FF6835' }}>{total.toLocaleString('fr-FR')} FCFA</Text>
                </View>
              </View>
            )}
          </>
        )}

        {/* ════ PAIEMENT ════ */}
        {step === 'payment' && (
          <>
            <View style={s.slotRecap}>
              <Feather name="calendar" size={14} color="#FF6835" />
              <Text style={s.slotRecapTxt}>
                {selectedSlot?.date ?? manualDate} · {selectedSlot?.start_time ?? manualTime}
              </Text>
            </View>
            <View style={s.card}>
              <Text style={s.cardTitle}>Mode de paiement</Text>
              {PAYMENT_METHODS.map((pm) => (
                <TouchableOpacity key={pm.id}
                  style={[s.pmRow, payMethod === pm.id && s.pmRowActive]}
                  onPress={() => setPayMethod(pm.id)} activeOpacity={0.8}>
                  <Text style={{ fontSize:22 }}>{pm.emoji}</Text>
                  <View style={{ flex:1 }}>
                    <Text style={[s.pmLabel, payMethod === pm.id && { color:'#FF6835' }]}>{pm.label}</Text>
                    <Text style={s.pmDesc}>{pm.desc}</Text>
                  </View>
                  <View style={[s.radio, payMethod === pm.id && s.radioActive]}>
                    {payMethod === pm.id && <View style={s.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            {isPriced && (
              <View style={s.recapCard}>
                <View style={[s.recapRow, { borderTopWidth:0 }]}>
                  <Text style={{ fontSize:16, fontWeight:'700', color:'#111827' }}>Total</Text>
                  <Text style={{ fontSize:20, fontWeight:'800', color:'#FF6835' }}>{total.toLocaleString('fr-FR')} FCFA</Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[s.footer, { paddingBottom: (Platform.OS === 'ios' ? 83 : 60) + 8 }]}>
        {step === 'detail' && service.allows_booking !== false && (
          <TouchableOpacity style={s.mainBtn} activeOpacity={0.88}
            onPress={() => slots.length > 0 ? setStep('slot') : setStep('form')}>
            <Feather name="calendar" size={18} color="#fff" />
            <Text style={s.mainBtnTxt}>Reserver ce service</Text>
          </TouchableOpacity>
        )}
        {step === 'detail' && service.allows_booking === false && (
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, justifyContent:'center', paddingVertical:14 }}>
            <Feather name="info" size={14} color="#9CA3AF" />
            <Text style={{ fontSize:13, color:'#9CA3AF' }}>Contactez le marchand pour reserver.</Text>
          </View>
        )}
        {step === 'slot' && (
          <TouchableOpacity style={s.mainBtn} onPress={() => setStep('form')} activeOpacity={0.88}>
            <Text style={s.mainBtnTxt}>
              {selectedSlot ? 'Continuer' : 'Choisir ma date et heure'}
            </Text>
          </TouchableOpacity>
        )}
        {step === 'form' && (
          <TouchableOpacity style={s.mainBtn} onPress={() => setStep('payment')} activeOpacity={0.88}>
            <Text style={s.mainBtnTxt}>Choisir le paiement</Text>
          </TouchableOpacity>
        )}
        {step === 'payment' && (
          <TouchableOpacity style={[s.mainBtn, booking && { opacity:0.7 }]}
            onPress={confirmBooking} disabled={booking} activeOpacity={0.88}>
            {booking
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Feather name="check" size={18} color="#fff" />
                  <Text style={s.mainBtnTxt}>
                    Confirmer · {isPriced ? `${total.toLocaleString('fr-FR')} FCFA` : 'Gratuit'}
                  </Text>
                </>
            }
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  center:        { flex:1, alignItems:'center', justifyContent:'center' },
  header:        { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:20, paddingVertical:14, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  backBtn:       { width:40, height:40, alignItems:'center', justifyContent:'center' },
  headerTitle:   { flex:1, fontSize:17, fontWeight:'800', color:'#111827' },
  stepDots:      { flexDirection:'row', gap:4 },
  stepDot:       { width:8, height:8, borderRadius:4, backgroundColor:'#E5E7EB' },
  stepDotActive: { backgroundColor:'#FF6835', width:16 },
  stepDotDone:   { backgroundColor:'#22C55E' },
  svcImg:        { width:'100%', height:220, borderRadius:18, resizeMode:'cover' },
  svcImgPh:      { width:'100%', height:160, borderRadius:18, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  card:          { backgroundColor:'#fff', borderRadius:18, padding:18, gap:12, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  cardTitle:     { fontSize:16, fontWeight:'800', color:'#111827' },
  svcTitle:      { flex:1, fontSize:20, fontWeight:'800', color:'#111827' },
  promoBadge:    { backgroundColor:'#FEF2EC', borderRadius:100, paddingHorizontal:10, paddingVertical:4, borderWidth:1, borderColor:'#FDDCCA' },
  promoBadgeTxt: { fontSize:12, fontWeight:'700', color:'#FF6835' },
  price:         { fontSize:20, fontWeight:'700', color:'#FF6835' },
  infoRow:       { flexDirection:'row', alignItems:'center', gap:6 },
  infoTxt:       { fontSize:13, color:'#6B7280' },
  desc:          { fontSize:14, color:'#374151', lineHeight:21 },
  catTag:        { flexDirection:'row', alignItems:'center', gap:8, borderRadius:100, paddingHorizontal:12, paddingVertical:5, borderWidth:1, alignSelf:'flex-start' },
  catTagTxt:     { fontSize:12, fontWeight:'700' },
  promoCard:     { flexDirection:'row', gap:10, backgroundColor:'#FEF2EC', borderRadius:14, padding:14, borderWidth:1, borderColor:'#FDDCCA' },
  promoCardTxt:  { fontSize:14, fontWeight:'700', color:'#FF6835' },
  promoCodeTxt:  { fontSize:12, color:'#FF6835', marginTop:2 },
  slotRecap:     { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#FEF2EC', borderRadius:12, padding:12 },
  slotRecapTxt:  { fontSize:14, fontWeight:'600', color:'#FF6835' },
  manualCard:    { backgroundColor:'#fff', borderRadius:16, padding:16, gap:10, borderWidth:1, borderColor:'#E5E7EB' },
  manualTitle:   { fontSize:15, fontWeight:'700', color:'#111827' },
  slotRow:       { flexDirection:'row', alignItems:'center', padding:14, borderRadius:14, backgroundColor:'#F9FAFB', borderWidth:1.5, borderColor:'#E5E7EB', marginBottom:8 },
  slotRowActive: { borderColor:'#FF6835', backgroundColor:'#FEF2EC' },
  slotDate:      { fontSize:14, fontWeight:'700', color:'#111827' },
  slotTime:      { fontSize:13, color:'#6B7280', marginTop:2 },
  slotAvail:     { fontSize:12, color:'#22C55E', fontWeight:'600' },
  noSlots:       { alignItems:'center', gap:10, paddingVertical:24 },
  noSlotsTxt:    { fontSize:15, fontWeight:'600', color:'#374151', textAlign:'center' },
  noSlotsSub:    { fontSize:13, color:'#9CA3AF', textAlign:'center' },
  freeBookBtn:   { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#FEF2EC', borderRadius:12, paddingHorizontal:16, paddingVertical:10, borderWidth:1, borderColor:'#FDDCCA', marginTop:8 },
  freeBookBtnTxt:{ fontSize:14, fontWeight:'700', color:'#FF6835' },
  field:         { gap:6 },
  label:         { fontSize:11, fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.4 },
  input:         { backgroundColor:'#F3F4F6', borderRadius:12, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:'#111827', borderWidth:1.5, borderColor:'#E5E7EB' },
  qtyRow:        { flexDirection:'row', alignItems:'center', gap:16 },
  qtyBtn:        { width:40, height:40, borderRadius:20, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'#E5E7EB', alignItems:'center', justifyContent:'center' },
  qtyVal:        { fontSize:20, fontWeight:'800', color:'#111827', minWidth:36, textAlign:'center' },
  qtyUnit:       { fontSize:14, color:'#6B7280' },
  slotDurInfo:   { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#F0FDF4', borderRadius:12, padding:12, borderWidth:1, borderColor:'#BBF7D0' },
  slotDurTxt:    { flex:1, fontSize:14, fontWeight:'600', color:'#166534' },
  locChoice:     { flex:1, alignItems:'center', gap:6, padding:12, borderRadius:14, backgroundColor:'#F9FAFB', borderWidth:1.5, borderColor:'#E5E7EB' },
  locChoiceActive:{ borderColor:'#FF6835', backgroundColor:'#FEF2EC' },
  locChoiceTxt:  { fontSize:13, fontWeight:'600', color:'#374151', textAlign:'center' },
  feeTag:        { fontSize:10, fontWeight:'700', color:'#FF6835', backgroundColor:'#FEF2EC', borderRadius:100, paddingHorizontal:8, paddingVertical:2 },
  toggleBtn:     { paddingHorizontal:14, paddingVertical:7, borderRadius:100, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'#E5E7EB' },
  toggleBtnOn:   { backgroundColor:'#FEF2EC', borderColor:'#FF6835' },
  toggleBtnTxt:  { fontSize:13, fontWeight:'700', color:'#6B7280' },
  checkRow:      { flexDirection:'row', alignItems:'center', gap:10, padding:12, borderRadius:12, backgroundColor:'#F9FAFB', borderWidth:1.5, borderColor:'#E5E7EB' },
  checkRowActive:{ borderColor:'#FF6835', backgroundColor:'#FEF2EC' },
  checkTxt:      { fontSize:14, fontWeight:'600', color:'#374151' },
  applyBtn:      { backgroundColor:'#FF6835', borderRadius:12, paddingHorizontal:16, justifyContent:'center' },
  applyBtnTxt:   { fontSize:14, fontWeight:'700', color:'#fff' },
  autoPromo:     { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#FEF2EC', borderRadius:10, padding:10 },
  recapCard:     { backgroundColor:'#fff', borderRadius:18, padding:16, gap:10 },
  recapRow:      { flexDirection:'row', justifyContent:'space-between' },
  recapLabel:    { fontSize:14, color:'#6B7280' },
  recapVal:      { fontSize:14, fontWeight:'600', color:'#111827' },
  pmRow:         { flexDirection:'row', alignItems:'center', gap:12, padding:14, borderRadius:14, backgroundColor:'#F9FAFB', borderWidth:1.5, borderColor:'#E5E7EB' },
  pmRowActive:   { borderColor:'#FF6835', backgroundColor:'#FEF2EC' },
  pmLabel:       { fontSize:14, fontWeight:'700', color:'#111827' },
  pmDesc:        { fontSize:12, color:'#9CA3AF', marginTop:1 },
  radio:         { width:22, height:22, borderRadius:11, borderWidth:2, borderColor:'#D1D5DB', alignItems:'center', justifyContent:'center' },
  radioActive:   { borderColor:'#FF6835' },
  radioDot:      { width:10, height:10, borderRadius:5, backgroundColor:'#FF6835' },
  footer:        { backgroundColor:'#fff', paddingHorizontal:20, paddingTop:12, borderTopWidth:1, borderTopColor:'#F3F4F6' },
  mainBtn:       { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:'#FF6835', borderRadius:16, paddingVertical:16, shadowColor:'#FF6835', shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:10, elevation:6 },
  mainBtnTxt:    { fontSize:16, fontWeight:'700', color:'#fff' },
  confirmCard:   { backgroundColor:'#fff', borderRadius:24, padding:28, alignItems:'center', gap:16, width:'100%', shadowColor:'#000', shadowOffset:{width:0,height:8}, shadowOpacity:0.12, shadowRadius:20, elevation:10 },
  confirmIcon:   { width:90, height:90, borderRadius:45, backgroundColor:'#F0FDF4', alignItems:'center', justifyContent:'center' },
  confirmTitle:  { fontSize:22, fontWeight:'800', color:'#111827' },
  confirmSub:    { fontSize:14, color:'#6B7280', textAlign:'center', lineHeight:22 },
  cashNote:      { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#EEF2FF', borderRadius:12, padding:12, width:'100%' },
  cashNoteTxt:   { flex:1, fontSize:13, color:'#1E3A5F' },
  confirmBtn:    { backgroundColor:'#FF6835', borderRadius:14, paddingVertical:14, paddingHorizontal:32, width:'100%', alignItems:'center' },
  confirmBtnTxt: { fontSize:15, fontWeight:'700', color:'#fff' },
});
