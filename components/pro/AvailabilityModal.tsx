// components/pro/AvailabilityModal.tsx
import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Alert, Modal, Platform, ScrollView, StyleSheet,
  Switch, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TimePicker } from '@/components/TimePicker';

// ── Helpers ────────────────────────────────────────────────────────────────────
function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minToTime(m: number): string {
  return `${Math.floor(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}`;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() + n); return r;
}
function toDateStr(d: Date): string { return d.toISOString().slice(0, 10); }

const DAY_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const DAY_ENUM = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// Ordre d'affichage : Lundi → Dimanche
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type RepeatMode = 'none' | 'weekly' | 'monthly';
const REPEAT_OPTIONS: { id: RepeatMode; label: string }[] = [
  { id: 'none',    label: 'Ne pas répéter' },
  { id: 'weekly',  label: 'Chaque semaine' },
  { id: 'monthly', label: 'Chaque mois' },
];
const REPEAT_WEEKS: Record<RepeatMode, number> = { none: 1, weekly: 4, monthly: 12 };

// ── Types publics ─────────────────────────────────────────────────────────────
export interface SlotConfig {
  date:       string;
  start_time: string;
  end_time:   string;
  max_slots:  number;
}

interface BusinessHour {
  day_of_week: string; // 'Mon','Tue',...
  open_time:   string;
  close_time:  string;
  is_closed:   boolean;
}

interface Props {
  visible:                boolean;
  durationMin?:           number;
  businessHours?:         BusinessHour[];
  onClose:                () => void;
  onConfirm:              (slots: SlotConfig[]) => void;
  onUpdateBusinessHour?:  (dayKey: string, openTime: string, closeTime: string) => void;
  existingCount?:         number;
}

// ── Génération ────────────────────────────────────────────────────────────────
function generateSlots(params: {
  dates: string[]; openTime: string; closeTime: string;
  durationMin: number; breakMin: number; maxSlots: number;
}): SlotConfig[] {
  const { dates, openTime, closeTime, durationMin, breakMin, maxSlots } = params;
  const interval = durationMin + breakMin;
  const result: SlotConfig[] = [];
  for (const date of dates) {
    let cur = timeToMin(openTime);
    const end = timeToMin(closeTime);
    while (cur + durationMin <= end) {
      result.push({ date, start_time: minToTime(cur), end_time: minToTime(cur + durationMin), max_slots: maxSlots });
      cur += interval;
    }
  }
  return result;
}

// ── Composant ─────────────────────────────────────────────────────────────────
export function AvailabilityModal({
  visible, durationMin = 60, businessHours = [], onClose, onConfirm,
  onUpdateBusinessHour, existingCount = 0,
}: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 16;
  const hasBizHours = businessHours.length > 0;

  // ── Helpers horaires boutique ─────────────────────────────────────────────
  const getDayBizHours = (dayIdx: number): { open: string; close: string } | null => {
    if (!hasBizHours) return null;
    const bh = businessHours.find(h => h.day_of_week === DAY_ENUM[dayIdx]);
    if (!bh || bh.is_closed) return null;
    return { open: bh.open_time.slice(0, 5), close: bh.close_time.slice(0, 5) };
  };
  const isDayOpenInBiz = (dayIdx: number): boolean => {
    if (!hasBizHours) return true; // pas de contrainte
    const bh = businessHours.find(h => h.day_of_week === DAY_ENUM[dayIdx]);
    return !!bh && !bh.is_closed;
  };

  // ── State ─────────────────────────────────────────────────────────────────
  const buildInitEnabledDays = (): Record<number, boolean> => {
    const out: Record<number, boolean> = {};
    for (let i = 0; i < 7; i++) out[i] = isDayOpenInBiz(i);
    return out;
  };

  const [enabledDays,  setEnabledDays]  = useState<Record<number, boolean>>(buildInitEnabledDays);
  const [breakInput,   setBreakInput]   = useState('');
  const [maxSlots,     setMaxSlots]     = useState(1);
  const [repeatMode,   setRepeatMode]   = useState<RepeatMode>('weekly');

  // Time pickers pour les jours (si on veut éditer l'horaire d'un jour spécifique)
  const [timePicker, setTimePicker] = useState<{ day: number; which: 'open' | 'close' } | null>(null);
  // Horaires overrides (si le pro personnalise les heures d'un jour par rapport à la boutique)
  const [hoursOverride, setHoursOverride] = useState<Record<number, { open: string; close: string }>>({});

  // Réinitialiser quand le modal s'ouvre
  useEffect(() => {
    if (visible) {
      setEnabledDays(buildInitEnabledDays());
      setBreakInput('');
      setMaxSlots(1);
      setRepeatMode('weekly');
      setHoursOverride({});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Toggle d'un jour ─────────────────────────────────────────────────────
  const handleToggleDay = (dayIdx: number) => {
    const wasEnabled = enabledDays[dayIdx];
    if (wasEnabled) {
      setEnabledDays(p => ({ ...p, [dayIdx]: false }));
      return;
    }
    // Activer → vérifier si le jour est fermé dans les horaires boutique
    if (hasBizHours && !isDayOpenInBiz(dayIdx)) {
      Alert.alert(
        'Jour habituellement fermé',
        `${DAY_FULL[dayIdx]} n'est pas un jour d'ouverture de votre boutique. Souhaitez-vous l'ajouter à vos jours d'ouverture ?`,
        [
          { text: 'Non', style: 'cancel' },
          {
            text: 'Oui, ajouter',
            onPress: () => {
              const defaultOpen  = '08:00';
              const defaultClose = '18:00';
              setEnabledDays(p => ({ ...p, [dayIdx]: true }));
              setHoursOverride(p => ({ ...p, [dayIdx]: { open: defaultOpen, close: defaultClose } }));
              onUpdateBusinessHour?.(DAY_ENUM[dayIdx], defaultOpen + ':00', defaultClose + ':00');
            },
          },
        ]
      );
    } else {
      setEnabledDays(p => ({ ...p, [dayIdx]: true }));
    }
  };

  // Retourne les heures effectives pour un jour (override > biz hours > défaut)
  const getEffectiveHours = (dayIdx: number): { open: string; close: string } => {
    if (hoursOverride[dayIdx]) return hoursOverride[dayIdx];
    return getDayBizHours(dayIdx) ?? { open: '08:00', close: '18:00' };
  };

  // ── Génération des créneaux ───────────────────────────────────────────────
  const computeSlots = (): SlotConfig[] => {
    const breakMin   = parseInt(breakInput) || 0;
    const weeksAhead = REPEAT_WEEKS[repeatMode];
    const result: SlotConfig[] = [];
    const today = new Date();
    for (const dayIdx of DAY_ORDER) {
      if (!enabledDays[dayIdx]) continue;
      const hours = getEffectiveHours(dayIdx);
      const dates: string[] = [];
      for (let i = 0; i < weeksAhead * 7; i++) {
        const d = addDays(today, i);
        if (d.getDay() === dayIdx) dates.push(toDateStr(d));
      }
      result.push(...generateSlots({
        dates, openTime: hours.open, closeTime: hours.close,
        durationMin, breakMin, maxSlots,
      }));
    }
    return result;
  };

  const slots = computeSlots();
  const count = slots.length;
  const anyDayEnabled = DAY_ORDER.some(d => enabledDays[d]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: topPad }]}>

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity style={s.closeBtn} onPress={onClose}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={18} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Configurer les créneaux</Text>
            <Text style={s.headerSub}>Durée : {durationMin} min par créneau</Text>
          </View>
          {existingCount > 0 && (
            <View style={s.badge}>
              <Text style={s.badgeTxt}>{existingCount} existants</Text>
            </View>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false}
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
          keyboardShouldPersistTaps="handled">

          {/* ─── Jours ─────────────────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Jours disponibles</Text>
            <View style={s.card}>
              {DAY_ORDER.map((dayIdx, i) => {
                const enabled = enabledDays[dayIdx];
                const hours   = getEffectiveHours(dayIdx);
                const isLast  = i === DAY_ORDER.length - 1;
                return (
                  <View key={dayIdx}>
                    <View style={s.dayRow}>
                      <Switch
                        value={enabled}
                        onValueChange={() => handleToggleDay(dayIdx)}
                        trackColor={{ false: '#E5E7EB', true: '#111827' }}
                        thumbColor="#fff"
                        ios_backgroundColor="#E5E7EB"
                        style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
                      />
                      <Text style={[s.dayName, enabled && s.dayNameOn]}>
                        {DAY_FULL[dayIdx]}
                      </Text>
                      {enabled ? (
                        <View style={s.dayHoursRow}>
                          <TouchableOpacity onPress={() => setTimePicker({ day: dayIdx, which: 'open' })}>
                            <Text style={s.dayHoursTxt}>{hours.open}</Text>
                          </TouchableOpacity>
                          <Text style={s.dayHoursDash}> – </Text>
                          <TouchableOpacity onPress={() => setTimePicker({ day: dayIdx, which: 'close' })}>
                            <Text style={s.dayHoursTxt}>{hours.close}</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <Text style={s.dayClosedTxt}>Fermé</Text>
                      )}
                    </View>
                    {!isLast && <View style={s.rowDiv} />}
                  </View>
                );
              })}
            </View>
          </View>

          <View style={s.divider} />

          {/* ─── Pause entre créneaux ──────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Pause entre créneaux</Text>
            <View style={s.inputRow}>
              <View style={s.inputWrap}>
                <TextInput
                  style={s.numInput}
                  value={breakInput}
                  onChangeText={v => setBreakInput(v.replace(/[^0-9]/g, '').slice(0, 3))}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />
                <Text style={s.inputUnit}>min</Text>
              </View>
              <Text style={s.inputHint}>Entre deux créneaux consécutifs</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* ─── Places par créneau ────────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Places par créneau</Text>
            <View style={s.qtyRow}>
              <TouchableOpacity
                style={[s.qtyBtn, maxSlots <= 1 && s.qtyBtnOff]}
                onPress={() => setMaxSlots(n => Math.max(1, n - 1))}
                disabled={maxSlots <= 1}
              >
                <Feather name="minus" size={14} color={maxSlots <= 1 ? '#D1D5DB' : '#111827'} />
              </TouchableOpacity>
              <Text style={s.qtyVal}>{maxSlots}</Text>
              <TouchableOpacity style={s.qtyBtn} onPress={() => setMaxSlots(n => n + 1)}>
                <Feather name="plus" size={14} color="#111827" />
              </TouchableOpacity>
              <Text style={s.qtyHint}>personne{maxSlots > 1 ? 's' : ''} max par créneau</Text>
            </View>
          </View>

          <View style={s.divider} />

          {/* ─── Répéter ce créneau sur ─────────────────────────────────── */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>Répéter ce créneau sur</Text>
            <View style={s.chipRow}>
              {REPEAT_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[s.chip, repeatMode === opt.id && s.chipActive]}
                  onPress={() => setRepeatMode(opt.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.chipTxt, repeatMode === opt.id && s.chipTxtOn]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.divider} />

          {/* ─── Récapitulatif ─────────────────────────────────────────── */}
          <View style={[s.preview, count === 0 && anyDayEnabled && s.previewWarn]}>
            <View style={[s.previewDot, count === 0 && anyDayEnabled && s.previewDotWarn]} />
            <Text style={[s.previewTxt, count === 0 && anyDayEnabled && s.previewTxtWarn]}>
              {!anyDayEnabled
                ? 'Activez au moins un jour pour générer des créneaux'
                : count > 0
                  ? `${count} créneau${count > 1 ? 'x' : ''} de ${durationMin} min`
                  : 'Aucun créneau possible avec ces paramètres'}
            </Text>
          </View>

        </ScrollView>

        {/* ── Footer ── */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.cancelTxt}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.confirmBtn, count === 0 && s.confirmBtnOff]}
            onPress={() => { if (count > 0) { onConfirm(slots); onClose(); } }}
            disabled={count === 0}
            activeOpacity={0.85}
          >
            <Text style={s.confirmTxt}>
              Valider {count} créneau{count > 1 ? 'x' : ''}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Time picker (édition horaire d'un jour) ── */}
        {timePicker && (
          <TimePicker
            visible
            title={`${DAY_FULL[timePicker.day]} — ${timePicker.which === 'open' ? 'Début' : 'Fin'}`}
            value={getEffectiveHours(timePicker.day)[timePicker.which]}
            onConfirm={(t) => {
              setHoursOverride(p => ({
                ...p,
                [timePicker.day]: {
                  ...getEffectiveHours(timePicker.day),
                  [timePicker.which]: t,
                },
              }));
              setTimePicker(null);
            }}
            onClose={() => setTimePicker(null)}
          />
        )}
      </View>
    </Modal>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#fff' },

  // Header
  header:      { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  closeBtn:    { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerSub:   { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  badge:       { backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt:    { fontSize: 11, fontWeight: '600', color: '#6B7280' },

  // Scroll / sections
  scroll:        { paddingTop: 4 },
  section:       { paddingHorizontal: 20, paddingVertical: 18, gap: 12 },
  sectionTitle:  { fontSize: 14, fontWeight: '700', color: '#111827' },
  divider:       { height: 1, backgroundColor: '#F3F4F6' },

  // Card jours (liste avec lignes)
  card:        { borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 14, overflow: 'hidden' },
  dayRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13 },
  rowDiv:      { height: 1, backgroundColor: '#F3F4F6', marginLeft: 60 },
  dayName:     { flex: 1, fontSize: 14, fontWeight: '500', color: '#9CA3AF' },
  dayNameOn:   { color: '#111827', fontWeight: '600' },
  dayHoursRow: { flexDirection: 'row', alignItems: 'center' },
  dayHoursTxt: { fontSize: 13, fontWeight: '700', color: '#111827', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#F3F4F6' },
  dayHoursDash:{ fontSize: 13, color: '#9CA3AF', paddingHorizontal: 2 },
  dayClosedTxt:{ fontSize: 12, color: '#D1D5DB', fontWeight: '500' },

  // Champ pause
  inputRow:    { flexDirection: 'row', alignItems: 'center', gap: 16 },
  inputWrap:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2, backgroundColor: '#F9FAFB' },
  numInput:    { width: 52, height: 40, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111827' },
  inputUnit:   { fontSize: 13, fontWeight: '600', color: '#9CA3AF' },
  inputHint:   { fontSize: 13, color: '#9CA3AF', flex: 1 },

  // Places par créneau
  qtyRow:      { flexDirection: 'row', alignItems: 'center', gap: 14 },
  qtyBtn:      { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  qtyBtnOff:   { borderColor: '#F3F4F6' },
  qtyVal:      { fontSize: 20, fontWeight: '800', color: '#111827', minWidth: 28, textAlign: 'center' },
  qtyHint:     { fontSize: 13, color: '#9CA3AF' },

  // Repeat chips
  chipRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:         { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  chipActive:   { backgroundColor: '#111827', borderColor: '#111827' },
  chipTxt:      { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTxtOn:    { color: '#fff' },

  // Preview
  preview:         { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 8, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  previewWarn:     { backgroundColor: '#FEF2F2' },
  previewDot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: '#111827' },
  previewDotWarn:  { backgroundColor: '#EF4444' },
  previewTxt:      { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  previewTxtWarn:  { color: '#EF4444' },

  // Footer
  footer:       { flexDirection: 'row', gap: 10, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  cancelBtn:    { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingVertical: 15 },
  cancelTxt:    { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  confirmBtn:   { flex: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111827', borderRadius: 12, paddingVertical: 15 },
  confirmBtnOff:{ opacity: 0.35 },
  confirmTxt:   { fontSize: 14, fontWeight: '700', color: '#fff' },
});
