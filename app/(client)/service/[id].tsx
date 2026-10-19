// app/(client)/service/[id].tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Dimensions, Image, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const { width: W } = Dimensions.get('window');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPrice(price: number, billing: string, unit?: string) {
  if (billing === 'free')     return 'Gratuit';
  if (billing === 'quote')    return 'Sur devis';
  const p = (price ?? 0).toLocaleString('fr-FR');
  if (billing === 'hourly')   return `${p} FCFA / h`;
  if (billing === 'per_day')  return `${p} FCFA / j`;
  if (billing === 'per_unit') return `${p} FCFA / ${unit ?? 'u'}`;
  return `${p} FCFA`;
}

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

// Génère les 7 prochains jours
function getNextDays(n = 7) {
  const days: { label: string; shortDay: string; dayNum: number; date: Date }[] = [];
  const today = new Date();
  const FR_DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push({
      label: i === 0 ? 'Aujourd\'hui' : i === 1 ? 'Demain' : FR_DAYS[d.getDay()],
      shortDay: FR_DAYS[d.getDay()],
      dayNum: d.getDate(),
      date: d,
    });
  }
  return days;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServiceDetailPage() {
  const insets = useSafeAreaInsets();
  const { id, businessId } = useLocalSearchParams<{ id: string; businessId: string }>();

  const topOverlay  = (Platform.OS === 'ios' ? insets.top : 0) + 50;
  // Tab bar height: 49pt standard + safe area bottom (home indicator iPhone / nav bar Android)
  const tabBarHeight = 49 + insets.bottom;

  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [selectedSlot,   setSelectedSlot]   = useState<string | null>(null);
  const [qty,            setQty]            = useState(1);

  const days = getNextDays(7);

  // ── Requête service ───────────────────────────────────────────────────────
  const { data: service, isLoading: svcLoading } = useQuery({
    queryKey: ['service-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*, business:businesses(name, cover_url, category_icon)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ── Requête créneaux ──────────────────────────────────────────────────────
  const selectedDate = days[selectedDayIdx]?.date;
  const dateStr = selectedDate
    ? selectedDate.toISOString().split('T')[0]
    : '';

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['service-slots', id, dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_slots')
        .select('*')
        .eq('service_id', id!)
        .eq('slot_date', dateStr)
        .order('start_time', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id && !!dateStr,
  });

  // ── Loading ───────────────────────────────────────────────────────────────
  if (svcLoading || !service) {
    return <View style={s.center}><ActivityIndicator color="#FF6835" size="large" /></View>;
  }

  const imgUrl    = safeFirstUrl(service.image_url) ?? (service as any).business?.cover_url;
  const bizName   = (service as any).business?.name ?? '';
  const duration  = (service as any).duration_minutes ?? (service as any).duration ?? null;
  const maxPlaces = (service as any).max_per_slot ?? (service as any).places_per_slot ?? 1;

  // Slot sélectionné → places dispo
  const selectedSlotData = slots.find((sl: any) => sl.start_time === selectedSlot);
  const placesLeft = selectedSlotData
    ? ((selectedSlotData as any).capacity ?? maxPlaces) - ((selectedSlotData as any).booked_count ?? 0)
    : maxPlaces;

  const canContinue = !!selectedSlot && qty >= 1 && qty <= placesLeft;

  const handleContinue = () => {
    if (!canContinue) return;
    router.push({
      pathname: '/(client)/booking/confirm' as any,
      params: {
        serviceId: id,
        businessId,
        slotDate: dateStr,
        slotTime: selectedSlot!,
        qty: String(qty),
      },
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>

      {/* ══ IMAGE COVER pleine largeur (même style page boutique) ══ */}
      <View style={s.coverWrap}>
        {imgUrl
          ? <Image source={{ uri: imgUrl }} style={s.cover} />
          : <View style={[s.cover, s.coverPh]}>
              <Text style={{ fontSize: 64 }}>{(service as any).business?.category_icon ?? '🛎️'}</Text>
            </View>
        }
        <View style={s.coverDim} />

        {/* Bouton retour */}
        <TouchableOpacity
          style={[s.backBtn, { top: topOverlay, left: 14 }]}
          onPress={() => businessId
            ? router.push({ pathname: '/(client)/business/[id]' as any, params: { id: businessId } })
            : router.back()
          }
        >
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* ══ SCROLL CONTENU ══ */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: tabBarHeight + 80 }}
      >
        <View style={s.content}>

          {/* 1. Titre */}
          <Text style={s.title}>{service.title}</Text>

          {/* 2. Boutique */}
          {bizName ? <Text style={s.bizName}>par {bizName}</Text> : null}

          {/* 4. Durée */}
          {duration ? (
            <Text style={s.durationLine}>Durée : {duration} min</Text>
          ) : null}

          {/* 5. Description */}
          {service.description ? (
            <View style={s.descBlock}>
              <Text style={s.descLabel}>Description</Text>
              <Text style={s.description}>{service.description}</Text>
            </View>
          ) : null}

          {/* ── Sélection date ── */}
          <Text style={s.sectionLabel}>Choisissez une date</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 4 }}
          >
            {days.map((d, i) => (
              <TouchableOpacity
                key={i}
                style={[s.datePill, selectedDayIdx === i && s.datePillActive]}
                onPress={() => { setSelectedDayIdx(i); setSelectedSlot(null); setQty(1); }}
                activeOpacity={0.8}
              >
                <Text style={[s.datePillTxt, selectedDayIdx === i && s.datePillTxtActive]}>
                  {d.label} {d.dayNum}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* ── Créneaux ── */}
          <Text style={[s.sectionLabel, { marginTop: 20 }]}>Créneaux disponibles</Text>

          {slotsLoading
            ? <ActivityIndicator color="#FF6835" style={{ marginTop: 12 }} />
            : slots.length === 0
              ? <Text style={s.noSlots}>Aucun créneau disponible pour cette date.</Text>
              : <View style={s.slotsGrid}>
                  {slots.map((sl: any) => {
                    const cap    = (sl.capacity ?? maxPlaces);
                    const booked = (sl.booked_count ?? 0);
                    const left   = cap - booked;
                    const full   = left <= 0;
                    const active = selectedSlot === sl.start_time;
                    return (
                      <TouchableOpacity
                        key={sl.id ?? sl.start_time}
                        style={[s.slotPill, active && s.slotPillActive, full && s.slotPillFull]}
                        onPress={() => { if (!full) { setSelectedSlot(sl.start_time); setQty(1); } }}
                        activeOpacity={full ? 1 : 0.8}
                        disabled={full}
                      >
                        <Text style={[s.slotTime, active && s.slotTimeActive, full && s.slotTimeFull]}>
                          {sl.start_time?.slice(0, 5).replace(':', 'h')}
                        </Text>
                        {cap > 1 && (
                          <Text style={[s.slotPlaces, active && { color: '#FF6835' }, full && { color: '#D1D5DB' }]}>
                            {full ? 'Complet' : `${left} place${left > 1 ? 's' : ''}`}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
          }

          {/* ── Nombre de personnes (si places > 1 et créneau sélectionné) ── */}
          {selectedSlot && placesLeft > 1 && (
            <View style={s.qtySection}>
              <Text style={s.qtyLabel}>Nombre de personnes</Text>
              <View style={s.qtyRow}>
                <TouchableOpacity
                  style={[s.qtyBtn, qty <= 1 && s.qtyBtnDisabled]}
                  onPress={() => setQty(q => Math.max(1, q - 1))}
                  disabled={qty <= 1}
                >
                  <Feather name="minus" size={16} color={qty <= 1 ? '#D1D5DB' : '#FF6835'} />
                </TouchableOpacity>
                <Text style={s.qtyVal}>{qty}</Text>
                <TouchableOpacity
                  style={[s.qtyBtn, qty >= placesLeft && s.qtyBtnDisabled]}
                  onPress={() => setQty(q => Math.min(placesLeft, q + 1))}
                  disabled={qty >= placesLeft}
                >
                  <Feather name="plus" size={16} color={qty >= placesLeft ? '#D1D5DB' : '#FF6835'} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── Note info ── */}
          <View style={s.infoBox}>
            <Feather name="info" size={14} color="#6B7280" style={{ marginTop: 1 }} />
            <Text style={s.infoTxt}>
              Le prestataire confirmera votre rendez-vous. Annulation gratuite jusqu'à 12 heures avant le créneau.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* ══ BOUTON BAS ══ */}
      <View style={[s.footer, { bottom: tabBarHeight, paddingBottom: 12 }]}>
        <TouchableOpacity
          style={[s.ctaBtn, !canContinue && s.ctaBtnDisabled]}
          onPress={handleContinue}
          activeOpacity={0.85}
          disabled={!canContinue}
        >
          <View style={s.ctaInner}>
            <Text style={s.ctaTxt}>Confirmer la réservation</Text>
            <Text style={s.ctaPrice}>{fmtPrice(service.price, service.billing_type, service.unit)}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Cover
  coverWrap:        { width: W, height: 260, position: 'relative' },
  cover:            { width: W, height: 260, resizeMode: 'cover' },
  coverPh:          { backgroundColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  coverDim:         { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.22)' },
  backBtn:          { position: 'absolute', width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },

  // Contenu
  content:          { paddingHorizontal: 20, paddingTop: 20, gap: 4 },

  title:            { fontSize: 22, fontWeight: '800', color: '#FF6835', lineHeight: 28 },
  bizName:          { fontSize: 13, color: '#9CA3AF', marginTop: 1 },
  price:            { fontSize: 18, fontWeight: '800', color: '#FF6835', marginTop: 6 },
  durationLine:     { fontSize: 14, fontWeight: '700', color: '#374151', marginTop: 4 },
  descBlock:        { marginTop: 10, gap: 4 },
  descLabel:        { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  description:      { fontSize: 14, color: '#374151', lineHeight: 21 },

  sectionLabel:     { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 24, marginBottom: 12 },

  // Date pills — rectangulaires (faible border radius)
  datePill:         { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB' },
  datePillActive:   { backgroundColor: '#111827', borderColor: '#111827' },
  datePillTxt:      { fontSize: 14, fontWeight: '600', color: '#374151' },
  datePillTxtActive:{ color: '#fff' },

  // Slots — rectangulaires
  slotsGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotPill:         { width: (W - 40 - 10) / 2, borderRadius: 8, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff', paddingVertical: 14, alignItems: 'center', gap: 3 },
  slotPillActive:   { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  slotPillFull:     { borderColor: '#F3F4F6', backgroundColor: '#F9FAFB' },
  slotTime:         { fontSize: 15, fontWeight: '700', color: '#111827' },
  slotTimeActive:   { color: '#FF6835' },
  slotTimeFull:     { color: '#D1D5DB' },
  slotPlaces:       { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  noSlots:          { fontSize: 14, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },

  // Qty personnes
  qtySection:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6' },
  qtyLabel:         { fontSize: 15, fontWeight: '700', color: '#111827' },
  qtyRow:           { flexDirection: 'row', alignItems: 'center', gap: 16 },
  qtyBtn:           { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#FF6835', alignItems: 'center', justifyContent: 'center' },
  qtyBtnDisabled:   { borderColor: '#E5E7EB' },
  qtyVal:           { fontSize: 18, fontWeight: '800', color: '#111827', minWidth: 24, textAlign: 'center' },

  // Info
  infoBox:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#F9FAFB', borderRadius: 12, padding: 14, marginTop: 20 },
  infoTxt:          { fontSize: 13, color: '#6B7280', lineHeight: 19, flex: 1 },

  // Footer CTA
  footer:           { position: 'absolute', left: 0, right: 0, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12 },
  ctaBtn:           { backgroundColor: '#FF6835', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 20 },
  ctaBtnDisabled:   { backgroundColor: '#FDBA74' },
  ctaInner:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ctaTxt:           { fontSize: 16, fontWeight: '800', color: '#fff' },
  ctaPrice:         { fontSize: 15, fontWeight: '700', color: 'rgba(255,255,255,0.9)' },
});
