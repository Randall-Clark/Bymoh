// components/pro/AvailabilityManager.tsx
import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView, StyleSheet,
  Switch, Text, TouchableOpacity, View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TimePicker } from '@/components/TimePicker';

interface Props {
  serviceId:       string;
  durationMinutes?: number; // durée du service (pour le calcul des créneaux)
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${h.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const DAY_FR  = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

// ── Modes de disponibilité ─────────────────────────────────────────────────────
type Mode = 'week' | 'weekend' | 'workweek' | 'now' | 'custom';

const MODES: { id: Mode; label: string; emoji: string; desc: string }[] = [
  { id: 'workweek', label: 'Lun – Ven',        emoji: '💼', desc: 'Du lundi au vendredi' },
  { id: 'week',     label: 'Toute la semaine',  emoji: '📅', desc: 'Du lundi au dimanche' },
  { id: 'weekend',  label: 'Week-end',          emoji: '🎉', desc: 'Samedi et dimanche' },
  { id: 'now',      label: 'Maintenant',        emoji: '⚡',  desc: 'Un créneau unique aujourd\'hui' },
  { id: 'custom',   label: 'Personnaliser',     emoji: '⚙️', desc: 'Configurer jour par jour' },
];

const MODE_DAYS: Record<Mode, number[]> = {
  week:     [0, 1, 2, 3, 4, 5, 6],
  weekend:  [0, 6],
  workweek: [1, 2, 3, 4, 5],
  now:      [],
  custom:   [],
};

// ── Génère les créneaux selon les paramètres ───────────────────────────────────
interface SlotParams {
  dates:          string[];
  openTime:       string;
  closeTime:      string;
  durationMin:    number;
  breakMin:       number;
  maxSlots:       number;
}

function generateSlots(params: SlotParams) {
  const { dates, openTime, closeTime, durationMin, breakMin, maxSlots } = params;
  const interval = durationMin + breakMin;
  const results: { date: string; start_time: string; end_time: string; max_slots: number }[] = [];

  for (const date of dates) {
    let cur = timeToMin(openTime);
    const end = timeToMin(closeTime);
    while (cur + durationMin <= end) {
      results.push({
        date,
        start_time: minToTime(cur),
        end_time:   minToTime(cur + durationMin),
        max_slots:  maxSlots,
      });
      cur += interval;
    }
  }
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
export function AvailabilityManager({ serviceId, durationMinutes = 60 }: Props) {
  const qc = useQueryClient();

  const [mode,        setMode]       = useState<Mode>('workweek');
  const [openTime,    setOpenTime]   = useState('08:00');
  const [closeTime,   setCloseTime]  = useState('18:00');
  const [breakMin,    setBreakMin]   = useState(15);
  const [maxSlots,    setMaxSlots]   = useState(1);
  const [weeksAhead,  setWeeksAhead] = useState(2);
  const [saving,      setSaving]     = useState(false);
  const [showForm,    setShowForm]   = useState(false);

  // Custom : activation par jour + horaires spécifiques
  const [customDays, setCustomDays] = useState<Record<number, {
    enabled: boolean; open: string; close: string;
  }>>({
    0: { enabled: false, open: '08:00', close: '18:00' },
    1: { enabled: true,  open: '08:00', close: '18:00' },
    2: { enabled: true,  open: '08:00', close: '18:00' },
    3: { enabled: true,  open: '08:00', close: '18:00' },
    4: { enabled: true,  open: '08:00', close: '18:00' },
    5: { enabled: true,  open: '08:00', close: '18:00' },
    6: { enabled: false, open: '08:00', close: '18:00' },
  });

  const [openPicker,  setOpenPicker]  = useState(false);
  const [closePicker, setClosePicker] = useState(false);
  const [customPicker, setCustomPicker] = useState<{ day: number; which: 'open' | 'close' } | null>(null);

  // Créneaux existants
  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['slots', serviceId],
    queryFn:  async () => {
      const { data, error } = await supabase
        .from('service_availability')
        .select('*')
        .eq('service_id', serviceId)
        .gte('date', toDateStr(new Date()))
        .order('date').order('start_time');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!serviceId,
  });

  // ── Calcul preview ───────────────────────────────────────────────────────
  const getPreviewDates = (): string[] => {
    if (mode === 'now') return [toDateStr(new Date())];
    const dates: string[] = [];
    const today = new Date();
    const targetDays = MODE_DAYS[mode];
    for (let i = 0; i < weeksAhead * 7; i++) {
      const d = addDays(today, i);
      if (targetDays.includes(d.getDay())) {
        dates.push(toDateStr(d));
      }
    }
    return dates;
  };

  const getCustomDates = (): string[] => {
    const dates: string[] = [];
    const today = new Date();
    for (let i = 0; i < weeksAhead * 7; i++) {
      const d = addDays(today, i);
      if (customDays[d.getDay()]?.enabled) {
        dates.push(toDateStr(d));
      }
    }
    return dates;
  };

  const previewCount = (() => {
    if (mode === 'custom') {
      let total = 0;
      for (const [dayN, cfg] of Object.entries(customDays)) {
        if (!cfg.enabled) continue;
        const slotsForDay = generateSlots({
          dates: ['2000-01-01'], openTime: cfg.open, closeTime: cfg.close,
          durationMin: durationMinutes, breakMin, maxSlots,
        });
        const datesForDay = [];
        const today = new Date();
        for (let i = 0; i < weeksAhead * 7; i++) {
          const d = addDays(today, i);
          if (d.getDay() === parseInt(dayN)) datesForDay.push(toDateStr(d));
        }
        total += slotsForDay.length * datesForDay.length;
      }
      return total;
    }
    const dates = getPreviewDates();
    if (mode === 'now') {
      return generateSlots({ dates, openTime, closeTime: minToTime(timeToMin(openTime) + durationMinutes),
        durationMin: durationMinutes, breakMin: 0, maxSlots }).length;
    }
    return generateSlots({ dates, openTime, closeTime, durationMin: durationMinutes, breakMin, maxSlots }).length;
  })();

  // ── Publier les créneaux ─────────────────────────────────────────────────
  const publishSlots = async () => {
    setSaving(true);
    try {
      let allSlots: { date: string; start_time: string; end_time: string; max_slots: number }[] = [];

      if (mode === 'now') {
        const today = toDateStr(new Date());
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        const startTime = minToTime(Math.ceil(nowMin / 15) * 15 + 15); // prochain quart d'heure
        allSlots = [{
          date: today, start_time: startTime,
          end_time: minToTime(timeToMin(startTime) + durationMinutes), max_slots: maxSlots,
        }];
      } else if (mode === 'custom') {
        for (const [dayN, cfg] of Object.entries(customDays)) {
          if (!cfg.enabled) continue;
          const today = new Date();
          const dates: string[] = [];
          for (let i = 0; i < weeksAhead * 7; i++) {
            const d = addDays(today, i);
            if (d.getDay() === parseInt(dayN)) dates.push(toDateStr(d));
          }
          const daySlots = generateSlots({
            dates, openTime: cfg.open, closeTime: cfg.close,
            durationMin: durationMinutes, breakMin, maxSlots,
          });
          allSlots.push(...daySlots);
        }
      } else {
        const dates = getPreviewDates();
        allSlots = generateSlots({ dates, openTime, closeTime, durationMin: durationMinutes, breakMin, maxSlots });
      }

      if (allSlots.length === 0) {
        Alert.alert('Aucun créneau', 'Aucun créneau ne peut être généré avec ces paramètres.');
        return;
      }

      const rows = allSlots.map((s) => ({
        id:           generateId(),
        service_id:   serviceId,
        date:         s.date,
        start_time:   s.start_time,
        end_time:     s.end_time,
        max_slots:    s.max_slots,
        booked_slots: 0,
        is_blocked:   false,
      }));

      const { error } = await supabase.from('service_availability').insert(rows);
      if (error) throw error;

      await qc.invalidateQueries({ queryKey: ['slots', serviceId] });
      Alert.alert('✅ Créneaux publiés', `${rows.length} créneau${rows.length > 1 ? 'x' : ''} ajouté${rows.length > 1 ? 's' : ''}.`);
      setShowForm(false);

    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteSlot = (id: string) => {
    Alert.alert('Supprimer ?', '', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        await supabase.from('service_availability').delete().eq('id', id);
        await qc.invalidateQueries({ queryKey: ['slots', serviceId] });
      }},
    ]);
  };

  const deleteAll = () => {
    Alert.alert('Supprimer tous les créneaux ?', `${slots.length} créneau${slots.length > 1 ? 'x' : ''} à venir seront supprimés.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Tout supprimer', style: 'destructive', onPress: async () => {
        const ids = slots.map((s: any) => s.id);
        await supabase.from('service_availability').delete().in('id', ids);
        await qc.invalidateQueries({ queryKey: ['slots', serviceId] });
      }},
    ]);
  };

  return (
    <View style={s.root}>
      {/* Header */}
      <View style={s.headerRow}>
        <View>
          <Text style={s.title}>Créneaux disponibles</Text>
          <Text style={s.sub}>
            {slots.length} créneau{slots.length !== 1 ? 'x' : ''} à venir · Durée : {durationMinutes} min
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {slots.length > 0 && (
            <TouchableOpacity style={s.deleteAllBtn} onPress={deleteAll}>
              <Feather name="trash-2" size={14} color="#EF4444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.addBtn} onPress={() => setShowForm(!showForm)}>
            <Feather name={showForm ? 'x' : 'plus'} size={15} color="#fff" />
            <Text style={s.addBtnTxt}>{showForm ? 'Fermer' : 'Configurer'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Formulaire */}
      {showForm && (
        <View style={s.form}>
          {/* Sélecteur de mode */}
          <Text style={s.formLabel}>Répétition</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {MODES.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[s.modeChip, mode === m.id && s.modeChipActive]}
                onPress={() => setMode(m.id)}
              >
                <Text style={s.modeEmoji}>{m.emoji}</Text>
                <Text style={[s.modeLabel, mode === m.id && { color: '#FF6835', fontWeight: '700' }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={s.modeDesc}>{MODES.find((m_) => m_.id === mode)?.desc}</Text>

          {/* Horaires globaux (sauf custom et now) */}
          {mode !== 'custom' && mode !== 'now' && (
            <View style={s.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.formLabel}>Ouverture</Text>
                <TouchableOpacity style={s.timeBtn} onPress={() => setOpenPicker(true)}>
                  <Feather name="clock" size={14} color="#FF6835" />
                  <Text style={s.timeTxt}>{openTime}</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.timeSep}>→</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.formLabel}>Fermeture</Text>
                <TouchableOpacity style={s.timeBtn} onPress={() => setClosePicker(true)}>
                  <Feather name="clock" size={14} color="#FF6835" />
                  <Text style={s.timeTxt}>{closeTime}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Mode personnalisé — par jour */}
          {mode === 'custom' && (
            <View style={s.customGrid}>
              {[1, 2, 3, 4, 5, 6, 0].map((dayN) => {
                const cfg = customDays[dayN];
                return (
                  <View key={dayN} style={[s.customDay, !cfg.enabled && s.customDayOff]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[s.customDayName, cfg.enabled && { color: '#111827', fontWeight: '700' }]}>
                        {DAY_FULL[dayN]}
                      </Text>
                      <Switch
                        value={cfg.enabled}
                        onValueChange={(v) => setCustomDays((prev) => ({ ...prev, [dayN]: { ...prev[dayN], enabled: v } }))}
                        trackColor={{ false: '#E5E7EB', true: '#FF6835' }}
                        thumbColor="#fff"
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                      />
                    </View>
                    {cfg.enabled && (
                      <View style={s.timeRow}>
                        <TouchableOpacity
                          style={[s.timeBtn, { flex: 1 }]}
                          onPress={() => setCustomPicker({ day: dayN, which: 'open' })}
                        >
                          <Text style={s.timeTxt}>{cfg.open}</Text>
                        </TouchableOpacity>
                        <Text style={s.timeSep}>–</Text>
                        <TouchableOpacity
                          style={[s.timeBtn, { flex: 1 }]}
                          onPress={() => setCustomPicker({ day: dayN, which: 'close' })}
                        >
                          <Text style={s.timeTxt}>{cfg.close}</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* Pause entre créneaux */}
          {mode !== 'now' && (
            <View>
              <Text style={s.formLabel}>Pause entre créneaux</Text>
              <View style={s.breakRow}>
                {[0, 10, 15, 20, 30].map((min) => (
                  <TouchableOpacity
                    key={min}
                    style={[s.breakChip, breakMin === min && s.breakChipActive]}
                    onPress={() => setBreakMin(min)}
                  >
                    <Text style={[s.breakChipTxt, breakMin === min && { color: '#FF6835', fontWeight: '700' }]}>
                      {min === 0 ? 'Aucune' : `${min} min`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Nombre de semaines (sauf now) */}
          {mode !== 'now' && (
            <View>
              <Text style={s.formLabel}>Planifier sur</Text>
              <View style={s.breakRow}>
                {[1, 2, 4, 8].map((w) => (
                  <TouchableOpacity
                    key={w}
                    style={[s.breakChip, weeksAhead === w && s.breakChipActive]}
                    onPress={() => setWeeksAhead(w)}
                  >
                    <Text style={[s.breakChipTxt, weeksAhead === w && { color: '#FF6835', fontWeight: '700' }]}>
                      {w} sem.
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Places par créneau */}
          <View>
            <Text style={s.formLabel}>Places par créneau</Text>
            <View style={s.qtyRow}>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setMaxSlots(Math.max(1, maxSlots - 1))}>
                <Feather name="minus" size={14} color="#374151" />
              </TouchableOpacity>
              <Text style={s.qtyVal}>{maxSlots}</Text>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setMaxSlots(maxSlots + 1)}>
                <Feather name="plus" size={14} color="#374151" />
              </TouchableOpacity>
              <Text style={s.qtyHint}>personne{maxSlots > 1 ? 's' : ''} max par créneau</Text>
            </View>
          </View>

          {/* Preview */}
          {previewCount > 0 && (
            <View style={s.preview}>
              <Feather name="calendar" size={14} color="#FF6835" />
              <Text style={s.previewTxt}>
                {previewCount} créneau{previewCount > 1 ? 'x' : ''} de {durationMinutes} min seront créés
                {mode !== 'now' ? ` sur ${weeksAhead} semaine${weeksAhead > 1 ? 's' : ''}` : ''}
              </Text>
            </View>
          )}

          {/* Bouton publier */}
          <TouchableOpacity
            style={[s.publishBtn, (saving || previewCount === 0) && { opacity: 0.6 }]}
            onPress={publishSlots}
            disabled={saving || previewCount === 0}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <>
                  <Feather name="check" size={15} color="#fff" />
                  <Text style={s.publishBtnTxt}>Publier {previewCount} créneau{previewCount > 1 ? 'x' : ''}</Text>
                </>
            }
          </TouchableOpacity>
        </View>
      )}

      {/* Liste des créneaux existants */}
      {isLoading
        ? <ActivityIndicator color="#FF6835" style={{ marginTop: 12 }} />
        : slots.length === 0
        ? <Text style={s.empty}>Aucun créneau défini. Les clients ne pourront pas réserver.</Text>
        : <View style={s.slotList}>
            {slots.slice(0, 10).map((slot: any) => {
              const d    = new Date(slot.date + 'T12:00:00');
              const full = slot.booked_slots >= slot.max_slots;
              return (
                <View key={slot.id} style={[s.slotRow, slot.is_blocked && { opacity: 0.4 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.slotDate}>{DAY_FR[d.getDay()]} {d.getDate()}/{d.getMonth() + 1}</Text>
                    <Text style={s.slotTime}>{slot.start_time} – {slot.end_time}</Text>
                  </View>
                  <View style={s.slotRight}>
                    <Text style={[s.slotCap, full && { color: '#EF4444' }]}>
                      {slot.booked_slots}/{slot.max_slots}
                    </Text>
                    {full && <View style={s.fullBadge}><Text style={s.fullBadgeTxt}>Complet</Text></View>}
                  </View>
                  <TouchableOpacity style={s.slotDelete} onPress={() => deleteSlot(slot.id)}>
                    <Feather name="trash-2" size={13} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              );
            })}
            {slots.length > 10 && (
              <Text style={s.moreSlots}>+ {slots.length - 10} autres créneaux</Text>
            )}
          </View>
      }

      {/* Time pickers globaux */}
      <TimePicker visible={openPicker}  title="Heure d'ouverture" value={openTime}
        onConfirm={(t) => { setOpenTime(t);  setOpenPicker(false); }}
        onClose={() => setOpenPicker(false)} />
      <TimePicker visible={closePicker} title="Heure de fermeture" value={closeTime}
        onConfirm={(t) => { setCloseTime(t); setClosePicker(false); }}
        onClose={() => setClosePicker(false)} />

      {/* Time picker custom */}
      {customPicker && (
        <TimePicker
          visible={true}
          title={`${DAY_FULL[customPicker.day]} — ${customPicker.which === 'open' ? 'Ouverture' : 'Fermeture'}`}
          value={customDays[customPicker.day][customPicker.which]}
          onConfirm={(t) => {
            setCustomDays((prev) => ({
              ...prev,
              [customPicker.day]: {
                ...prev[customPicker.day],
                [customPicker.which]: t,
              },
            }));
            setCustomPicker(null);
          }}
          onClose={() => setCustomPicker(null)}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root:           { gap: 12 },
  headerRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:          { fontSize: 16, fontWeight: '800', color: '#111827' },
  sub:            { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  addBtn:         { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF6835', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  addBtnTxt:      { fontSize: 13, fontWeight: '700', color: '#fff' },
  deleteAllBtn:   { width: 34, height: 34, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  form:           { backgroundColor: '#FEF2EC', borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: '#FDDCCA' },
  formLabel:      { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 },
  modeChip:       { alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', minWidth: 80 },
  modeChipActive: { borderColor: '#FF6835', backgroundColor: '#fff' },
  modeEmoji:      { fontSize: 20 },
  modeLabel:      { fontSize: 11, fontWeight: '600', color: '#374151', textAlign: 'center' },
  modeDesc:       { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  timeRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1.5, borderColor: '#E5E7EB' },
  timeTxt:        { fontSize: 15, fontWeight: '700', color: '#111827' },
  timeSep:        { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
  customGrid:     { gap: 10 },
  customDay:      { backgroundColor: '#fff', borderRadius: 12, padding: 12, gap: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  customDayOff:   { opacity: 0.5 },
  customDayName:  { fontSize: 13, fontWeight: '500', color: '#9CA3AF' },
  breakRow:       { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  breakChip:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 100, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB' },
  breakChipActive:{ borderColor: '#FF6835' },
  breakChipTxt:   { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  qtyRow:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  qtyBtn:         { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  qtyVal:         { fontSize: 18, fontWeight: '800', color: '#111827', minWidth: 28, textAlign: 'center' },
  qtyHint:        { fontSize: 12, color: '#9CA3AF', flex: 1 },
  preview:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, padding: 12 },
  previewTxt:     { fontSize: 13, color: '#FF6835', fontWeight: '600', flex: 1 },
  publishBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF6835', borderRadius: 12, paddingVertical: 14 },
  publishBtnTxt:  { fontSize: 14, fontWeight: '700', color: '#fff' },
  empty:          { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 12, fontStyle: 'italic' },
  slotList:       { gap: 8 },
  slotRow:        { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F3F4F6' },
  slotDate:       { fontSize: 13, fontWeight: '700', color: '#111827' },
  slotTime:       { fontSize: 12, color: '#FF6835', fontWeight: '600', marginTop: 2 },
  slotRight:      { alignItems: 'flex-end', gap: 4, marginRight: 8 },
  slotCap:        { fontSize: 12, color: '#6B7280' },
  fullBadge:      { backgroundColor: '#FEF2F2', borderRadius: 100, paddingHorizontal: 7, paddingVertical: 2 },
  fullBadgeTxt:   { fontSize: 9, fontWeight: '700', color: '#EF4444' },
  slotDelete:     { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center' },
  moreSlots:      { fontSize: 12, color: '#9CA3AF', textAlign: 'center', paddingVertical: 4 },
});
