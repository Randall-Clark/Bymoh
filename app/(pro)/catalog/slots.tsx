// app/(pro)/catalog/slots.tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SuccessModal } from '@/components/SuccessModal';

const ORANGE = '#FF6835';

// ─── Types & constantes ───────────────────────────────────────────────────────

type Horizon = 'week' | '2weeks' | 'month';

const HORIZONS: { key: Horizon; label: string; sub: string }[] = [
  { key: 'week',   label: 'Cette semaine',    sub: "Jusqu'à dimanche"        },
  { key: '2weeks', label: 'Pour 2 semaines',  sub: 'Les 14 prochains jours'  },
  { key: 'month',  label: 'Pour le mois',     sub: 'Les 30 prochains jours'  },
];

const DAYS_FR = ['Lu','Ma','Me','Je','Ve','Sa','Di'];
function jsDayToIndex(jsDay: number) { return jsDay === 0 ? 6 : jsDay - 1; }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function parseTime(t: string): number | null {
  const m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = parseInt(m[1]), min = parseInt(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function fmtTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2,'0')}:${String(minutes % 60).padStart(2,'0')}`;
}

function autoFormatTime(raw: string): string {
  const digits = raw.replace(/\D/g,'').slice(0,4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0,2)}:${digits.slice(2)}`;
}

function getEndDate(horizon: Horizon): Date {
  const today = new Date(); today.setHours(0,0,0,0);
  if (horizon === 'week') {
    const day = today.getDay();
    const end = new Date(today);
    end.setDate(today.getDate() + (day === 0 ? 0 : 7 - day));
    return end;
  }
  const days = horizon === '2weeks' ? 14 : 30;
  const end = new Date(today);
  end.setDate(today.getDate() + days);
  return end;
}

function generateSlots(
  horizon: Horizon, activeDays: boolean[],
  startMin: number, endMin: number, durationMin: number,
): { date: string; start_time: string; end_time: string }[] {
  const nowPlusBuffer = Date.now() + 30 * 60 * 1000;
  const today = new Date(); today.setHours(0,0,0,0);
  const end = getEndDate(horizon);
  const result: { date: string; start_time: string; end_time: string }[] = [];
  const cursor = new Date(today);
  while (cursor <= end) {
    if (activeDays[jsDayToIndex(cursor.getDay())]) {
      const dateStr = cursor.toISOString().slice(0,10);
      let slotStart = startMin;
      while (slotStart + durationMin <= endMin) {
        const slotEnd = slotStart + durationMin;
        const slotDt  = new Date(cursor);
        slotDt.setHours(Math.floor(slotStart/60), slotStart%60, 0, 0);
        if (slotDt.getTime() >= nowPlusBuffer) {
          result.push({ date: dateStr, start_time: fmtTime(slotStart)+':00', end_time: fmtTime(slotEnd)+':00' });
        }
        slotStart = slotEnd;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}

// ─── Composant ───────────────────────────────────────────────────────────────

export default function SlotsPage() {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();

  const { id: serviceId, durationMin: durParam, businessId } = useLocalSearchParams<{
    id: string; durationMin: string; businessId: string;
  }>();
  const durationMin = Math.max(15, parseInt(durParam ?? '60'));

  // Config
  const [horizon,       setHorizon]       = useState<Horizon>('week');
  const [horizonOpen,   setHorizonOpen]   = useState(false);
  const [activeDays,    setActiveDays]    = useState([true,true,true,true,true,false,false]);
  const [startTime,     setStartTime]     = useState('09:00');
  const [endTime,       setEndTime]       = useState('18:00');

  // UI
  const [saving,         setSaving]         = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  const toggleDay = (i: number) => setActiveDays(d => d.map((v,j) => j===i ? !v : v));

  // Créneaux générés
  const slots = useMemo(() => {
    const sMin = parseTime(startTime), eMin = parseTime(endTime);
    if (!sMin || !eMin || eMin <= sMin + durationMin) return [];
    if (!activeDays.some(Boolean)) return [];
    return generateSlots(horizon, activeDays, sMin, eMin, durationMin);
  }, [horizon, activeDays, startTime, endTime, durationMin]);

  const slotsByDate = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const sl of slots) (map[sl.date] ??= []).push(sl.start_time.slice(0,5));
    return Object.entries(map).sort(([a],[b]) => a.localeCompare(b));
  }, [slots]);

  const configError = useMemo(() => {
    const sMin = parseTime(startTime), eMin = parseTime(endTime);
    if (!sMin) return 'Heure de début invalide';
    if (!eMin) return 'Heure de fin invalide';
    if (eMin <= sMin + durationMin) return `La plage doit être > ${durationMin} min`;
    if (!activeDays.some(Boolean)) return 'Sélectionne au moins un jour';
    return null;
  }, [startTime, endTime, activeDays, durationMin]);

  const horizonLabel = HORIZONS.find(h => h.key === horizon)!.label;

  const save = async () => {
    if (configError) { Alert.alert('Configuration incomplète', configError); return; }
    if (slots.length === 0) { Alert.alert('Aucun créneau', 'Aucun créneau futur disponible avec cette configuration.'); return; }
    setSaving(true);
    try {
      await supabase.from('service_availability').delete().eq('service_id', serviceId).eq('booked_slots', 0);
      const rows = slots.map(sl => ({
        id: generateId(), service_id: serviceId,
        date: sl.date, start_time: sl.start_time, end_time: sl.end_time,
        max_slots: 1, booked_slots: 0, is_blocked: false,
      }));
      const { error } = await supabase.from('service_availability').insert(rows);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['catalog', businessId] });
      await qc.invalidateQueries({ queryKey: ['biz-client', businessId] });
      setSuccessVisible(true);
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de sauvegarder.');
    } finally { setSaving(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Créneaux de réservation</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        {/* Info */}
        <View style={s.infoBox}>
          <Feather name="info" size={15} color="#1E3A5F" />
          <Text style={s.infoTxt}>
            Configure tes disponibilités ci-dessous. Seuls les créneaux futurs sont enregistrés.
          </Text>
        </View>

        {/* ── Card configuration ── */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Configuration</Text>

          {/* Planifier pour — liste dépliable */}
          <View>
            <Text style={s.fieldLabel}>Planifier pour</Text>
            <TouchableOpacity
              style={[s.selectBtn, horizonOpen && s.selectBtnOpen]}
              onPress={() => setHorizonOpen(o => !o)}
              activeOpacity={0.75}>
              <Text style={s.selectBtnTxt}>{horizonLabel}</Text>
              <Feather name={horizonOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" />
            </TouchableOpacity>
            {horizonOpen && (
              <View style={s.dropdown}>
                {HORIZONS.map((h, idx) => (
                  <TouchableOpacity
                    key={h.key}
                    style={[
                      s.dropdownItem,
                      idx < HORIZONS.length - 1 && s.dropdownItemBorder,
                      horizon === h.key && s.dropdownItemActive,
                    ]}
                    onPress={() => { setHorizon(h.key); setHorizonOpen(false); }}
                    activeOpacity={0.7}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.dropdownLabel, horizon === h.key && { color: ORANGE }]}>{h.label}</Text>
                      <Text style={s.dropdownSub}>{h.sub}</Text>
                    </View>
                    {horizon === h.key && <Feather name="check" size={15} color={ORANGE} />}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Séparateur */}
          <View style={s.sep} />

          {/* Jours */}
          <View>
            <Text style={s.fieldLabel}>Jours disponibles</Text>
            <View style={{ flexDirection:'row', gap:5 }}>
              {DAYS_FR.map((d,i) => (
                <TouchableOpacity
                  key={d} onPress={() => toggleDay(i)}
                  style={[s.dayChip, activeDays[i] && s.dayChipActive]}
                  activeOpacity={0.75}>
                  <Text style={[s.dayChipTxt, activeDays[i] && s.dayChipTxtActive]}>{d}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Séparateur */}
          <View style={s.sep} />

          {/* Horaires */}
          <View>
            <Text style={s.fieldLabel}>Horaires</Text>
            <View style={{ flexDirection:'row', gap:10 }}>
              <View style={{ flex:1 }}>
                <Text style={s.timeLabel}>Début</Text>
                <TextInput
                  style={s.timeInput}
                  value={startTime}
                  onChangeText={v => setStartTime(autoFormatTime(v))}
                  keyboardType="number-pad" placeholder="09:00"
                  placeholderTextColor="#9CA3AF" maxLength={5}
                />
              </View>
              <View style={{ flex:1 }}>
                <Text style={s.timeLabel}>Fin</Text>
                <TextInput
                  style={s.timeInput}
                  value={endTime}
                  onChangeText={v => setEndTime(autoFormatTime(v))}
                  keyboardType="number-pad" placeholder="18:00"
                  placeholderTextColor="#9CA3AF" maxLength={5}
                />
              </View>
            </View>
            <Text style={{ fontSize:11, color:'#9CA3AF', marginTop:5 }}>
              Créneaux de {durationMin} min générés entre ces heures
            </Text>
            {!!configError && (
              <Text style={{ fontSize:11, color:'#DC2626', marginTop:3 }}>{configError}</Text>
            )}
          </View>
        </View>

        {/* ── Card aperçu (style ancien) ── */}
        <View style={s.card}>
          <View style={{ flexDirection:'row', alignItems:'center', justifyContent:'space-between' }}>
            <Text style={s.cardTitle}>Disponibilités</Text>
            {slots.length > 0 && (
              <View style={s.countBadge}>
                <Text style={s.countBadgeTxt}>{slots.length} créneau{slots.length>1?'x':''}</Text>
              </View>
            )}
          </View>

          {slots.length === 0 ? (
            <View style={s.emptyBox}>
              <Feather name="calendar" size={28} color="#D1D5DB" />
              <Text style={s.emptyTxt}>Aucun créneau disponible</Text>
              <Text style={s.emptySub}>
                {configError ?? 'Ajuste la configuration ci-dessus'}
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {slotsByDate.slice(0,6).map(([date, times]) => (
                <View key={date} style={s.dayRow}>
                  <View style={s.dayBadge}>
                    <Text style={s.dayBadgeTxt}>
                      {new Date(date+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'short',day:'numeric',month:'short'})}
                    </Text>
                  </View>
                  <View style={{ flex:1, flexDirection:'row', flexWrap:'wrap', gap:5 }}>
                    {times.slice(0,5).map((t,i) => (
                      <View key={i} style={s.slotChip}>
                        <Text style={s.slotChipTxt}>{t}</Text>
                      </View>
                    ))}
                    {times.length > 5 && (
                      <View style={s.slotChipMore}>
                        <Text style={s.slotChipMoreTxt}>+{times.length-5}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              {slotsByDate.length > 6 && (
                <Text style={{ fontSize:12, color:'#9CA3AF', textAlign:'center' }}>
                  +{slotsByDate.length-6} autre{slotsByDate.length-6>1?'s':''} jour{slotsByDate.length-6>1?'s':''}…
                </Text>
              )}

              <View style={s.summaryRow}>
                <Feather name="check-circle" size={14} color="#166534" />
                <Text style={s.summaryTxt}>
                  {slots.length} créneau{slots.length>1?'x':''} configuré{slots.length>1?'s':''}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* CTA */}
        <TouchableOpacity
          style={[s.cta, (saving || slots.length===0) && { opacity:0.5 }]}
          onPress={save} disabled={saving || slots.length===0} activeOpacity={0.85}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.ctaTxt}>Publier le service →</Text>
          }
        </TouchableOpacity>

        {/* Passer */}
        <TouchableOpacity style={{ alignItems:'center', paddingVertical:8 }} onPress={() => router.navigate('/(pro)/boutique' as any)}>
          <Text style={{ fontSize:13, color:'#9CA3AF', fontWeight:'500' }}>Passer cette étape — configurer plus tard</Text>
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      <SuccessModal
        visible={successVisible}
        title="Service publié !"
        message={`${slots.length} créneau${slots.length>1?'x':''} configuré${slots.length>1?'s':''}. Les clients peuvent maintenant réserver.`}
        onClose={() => { setSuccessVisible(false); router.navigate('/(pro)/boutique' as any); }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  header:      { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingBottom:14, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  backBtn:     { width:36, height:36, borderRadius:18, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  headerTitle: { fontSize:17, fontWeight:'800', color:'#111827' },

  infoBox: { flexDirection:'row', alignItems:'flex-start', gap:10, backgroundColor:'#EEF2FF', borderRadius:12, padding:14 },
  infoTxt: { flex:1, fontSize:13, color:'#1E3A5F', lineHeight:19 },

  card:      { backgroundColor:'#fff', borderRadius:16, padding:18, gap:14, borderWidth:1, borderColor:'#E5E7EB' },
  cardTitle: { fontSize:15, fontWeight:'800', color:'#111827' },
  sep:       { height:1, backgroundColor:'#F3F4F6' },

  fieldLabel: { fontSize:11, fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.5, marginBottom:7 },

  // Dropdown dépliable
  selectBtn:     { flexDirection:'row', alignItems:'center', justifyContent:'space-between', borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, backgroundColor:'#F9FAFB', paddingHorizontal:13, paddingVertical:12 },
  selectBtnOpen: { borderColor:ORANGE, borderBottomLeftRadius:0, borderBottomRightRadius:0 },
  selectBtnTxt:  { fontSize:14, fontWeight:'600', color:'#111827' },
  dropdown:      { borderWidth:1, borderTopWidth:0, borderColor:ORANGE, borderBottomLeftRadius:10, borderBottomRightRadius:10, backgroundColor:'#fff', overflow:'hidden' },
  dropdownItem:  { flexDirection:'row', alignItems:'center', paddingHorizontal:13, paddingVertical:13 },
  dropdownItemBorder: { borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  dropdownItemActive: { backgroundColor:'#FFF8F5' },
  dropdownLabel: { fontSize:14, fontWeight:'600', color:'#374151' },
  dropdownSub:   { fontSize:11, color:'#9CA3AF', marginTop:1 },

  // Jours
  dayChip:          { flex:1, alignItems:'center', paddingVertical:9, borderRadius:10, borderWidth:1.5, borderColor:'#E5E7EB', backgroundColor:'#F9FAFB' },
  dayChipActive:    { borderColor:ORANGE, backgroundColor:'#FFF8F5' },
  dayChipTxt:       { fontSize:11, fontWeight:'700', color:'#9CA3AF' },
  dayChipTxtActive: { color:ORANGE },

  // Horaires
  timeLabel: { fontSize:11, fontWeight:'600', color:'#9CA3AF', marginBottom:5 },
  timeInput: { borderWidth:1, borderColor:'#E5E7EB', borderRadius:10, backgroundColor:'#F9FAFB', paddingHorizontal:14, paddingVertical:12, fontSize:16, fontWeight:'700', color:'#111827', textAlign:'center' },

  // Aperçu (style ancien)
  countBadge:     { backgroundColor:'#ECFDF5', borderRadius:100, paddingHorizontal:10, paddingVertical:3 },
  countBadgeTxt:  { fontSize:12, fontWeight:'700', color:'#166534' },
  emptyBox:       { alignItems:'center', paddingVertical:24, gap:8 },
  emptyTxt:       { fontSize:15, fontWeight:'700', color:'#374151' },
  emptySub:       { fontSize:13, color:'#9CA3AF', textAlign:'center', maxWidth:260 },
  dayRow:         { flexDirection:'row', alignItems:'flex-start', gap:10 },
  dayBadge:       { backgroundColor:'#F3F4F6', borderRadius:8, paddingHorizontal:10, paddingVertical:5, alignSelf:'flex-start' },
  dayBadgeTxt:    { fontSize:12, fontWeight:'700', color:'#374151' },
  slotChip:       { backgroundColor:'#FEF2EC', borderRadius:8, paddingHorizontal:8, paddingVertical:4 },
  slotChipTxt:    { fontSize:12, fontWeight:'600', color:ORANGE },
  slotChipMore:   { backgroundColor:'#F3F4F6', borderRadius:8, paddingHorizontal:8, paddingVertical:4 },
  slotChipMoreTxt:{ fontSize:12, fontWeight:'600', color:'#6B7280' },
  summaryRow:     { flexDirection:'row', alignItems:'center', gap:6, marginTop:4 },
  summaryTxt:     { fontSize:13, color:'#166534', fontWeight:'600' },

  cta:    { backgroundColor:'#111827', borderRadius:16, paddingVertical:17, alignItems:'center' },
  ctaTxt: { fontSize:16, fontWeight:'700', color:'#fff', letterSpacing:0.2 },
});
