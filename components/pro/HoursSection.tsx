import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { TimePicker } from '@/components/TimePicker';
import { isBusinessOpen } from '@/lib/utils';

// ── Constantes ────────────────────────────────────────────────────────────────
const DAY_ENUM    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_NAMES   = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

type DayKey = typeof DAY_ENUM[number];

interface DayHours {
  day_of_week: DayKey;
  open_time:   string;
  close_time:  string;
  is_closed:   boolean;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

// ── Construit le schedule depuis les données DB ───────────────────────────────
function buildSchedule(hours: any[]): DayHours[] {
  return DAY_ENUM.map((key, i) => {
    const row = hours.find((h: any) => h.day_of_week === key);
    return {
      day_of_week: key,
      open_time:   row?.open_time  ?? '08:00',
      close_time:  row?.close_time ?? '18:00',
      is_closed:   row ? Boolean(row.is_closed) : i >= 5, // Sam+Dim fermés par défaut
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
interface Props { business: any; }

export function HoursSection({ business }: Props) {
  const queryClient = useQueryClient();

  const [schedule, setSchedule]         = useState<DayHours[]>(() => buildSchedule(business.hours ?? []));
  const [saving, setSaving]             = useState(false);
  const [saved, setSaved]               = useState(false);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget]   = useState<{ idx: number; field: 'open_time' | 'close_time' } | null>(null);

  // Re-sync si business.hours change (après invalidateQueries)
  useEffect(() => {
    setSchedule(buildSchedule(business.hours ?? []));
  }, [JSON.stringify(business.hours)]);

  const update = (idx: number, field: keyof DayHours, val: any) =>
    setSchedule((s) => s.map((d, i) => i === idx ? { ...d, [field]: val } : d));

  const openPicker = (idx: number, field: 'open_time' | 'close_time') => {
    setPickerTarget({ idx, field });
    setPickerVisible(true);
  };

  const onTimeConfirm = (time: string) => {
    if (pickerTarget) update(pickerTarget.idx, pickerTarget.field, time);
    setPickerVisible(false);
    setPickerTarget(null);
  };

  // ── Sauvegarde : DELETE tout puis INSERT 7 jours proprement ──────────────
  const saveHours = async () => {
    setSaving(true);
    setErrorMsg(null);
    try {
      // 1. Supprimer tous les anciens horaires de cette boutique
      const { error: delError } = await supabase
        .from('business_hours')
        .delete()
        .eq('business_id', business.id);

      if (delError) throw new Error('Suppression échouée: ' + delError.message);

      // 2. Insérer les 7 jours avec le bon enum
      const rows = schedule.map((day) => ({
        id:          generateId(),
        business_id: business.id,
        day_of_week: day.day_of_week, // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
        open_time:   day.open_time,
        close_time:  day.close_time,
        is_closed:   day.is_closed,
      }));

      const { error: insError } = await supabase
        .from('business_hours')
        .insert(rows);

      if (insError) throw new Error('Insertion échouée: ' + insError.message);

      // 3. Recalculer is_open pour aujourd'hui
      const tz     = (business as any).timezone ?? 'Africa/Porto-Novo';
      const parts  = Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour12: false }).formatToParts(new Date());
      const wdStr  = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
      const DAY_UI = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
      const uiIdx  = DAY_UI.indexOf(wdStr as any);
      const today  = schedule[uiIdx];
      const now    = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();
      let isOpenNow = false;
      if (!today.is_closed) {
        const [oh, om] = today.open_time.split(':').map(Number);
        const [ch, cm] = today.close_time.split(':').map(Number);
        isOpenNow = nowMin >= oh * 60 + om && nowMin < ch * 60 + cm;
      }

      await supabase
        .from('businesses')
        .update({ is_open: isOpenNow })
        .eq('id', business.id);

      // 4. Invalider le cache → refetch automatique → useEffect re-sync le schedule
      await queryClient.invalidateQueries({ queryKey: ['business', business.id] });
      await queryClient.invalidateQueries({ queryKey: ['businesses'] });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);

    } catch (err: any) {
      setErrorMsg(err.message ?? 'Erreur inconnue');
    } finally {
      setSaving(false);
    }
  };

  const pickerValue = pickerTarget
    ? schedule[pickerTarget.idx][pickerTarget.field] as string
    : '08:00';
  const pickerTitle = pickerTarget?.field === 'open_time' ? "Heure d'ouverture" : "Heure de fermeture";

  // Statut actuel calculé dynamiquement
  const currentlyOpen = isBusinessOpen(business.hours);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Statut actuel */}
        <View style={[styles.statusBar, currentlyOpen ? styles.statusOpen : styles.statusClosed]}>
          <View style={[styles.statusDot, { backgroundColor: currentlyOpen ? '#22C55E' : '#9CA3AF' }]} />
          <Text style={[styles.statusText, { color: currentlyOpen ? '#166534' : '#4B5563' }]}>
            {currentlyOpen ? 'Actuellement ouverte' : 'Actuellement fermée'}
          </Text>
        </View>

        <Text style={styles.hint}>
          Ces horaires déterminent le badge "Ouvert/Fermé" visible par les clients.
        </Text>

        {/* Jours */}
        {schedule.map((day, i) => (
          <View key={day.day_of_week} style={styles.dayCard}>
            <View style={styles.dayTop}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.dayName}>{DAY_NAMES[i]}</Text>
                {!day.is_closed && (
                  <Text style={styles.daySummary}>{day.open_time} – {day.close_time}</Text>
                )}
              </View>

              {/* Toggle */}
              <TouchableOpacity
                style={[styles.toggle, !day.is_closed && styles.toggleOpen]}
                onPress={() => update(i, 'is_closed', !day.is_closed)}
                activeOpacity={0.8}
              >
                <View style={[styles.thumb, !day.is_closed && styles.thumbOpen]} />
              </TouchableOpacity>
            </View>

            {!day.is_closed && (
              <View style={styles.timeRow}>
                <TouchableOpacity style={styles.timeBtn} onPress={() => openPicker(i, 'open_time')}>
                  <Text style={styles.timeBtnLabel}>Ouverture</Text>
                  <View style={styles.timeBtnRow}>
                    <Feather name="clock" size={13} color="#FF6835" />
                    <Text style={styles.timeBtnText}>{day.open_time}</Text>
                  </View>
                </TouchableOpacity>

                <Feather name="arrow-right" size={14} color="#9CA3AF" />

                <TouchableOpacity style={styles.timeBtn} onPress={() => openPicker(i, 'close_time')}>
                  <Text style={styles.timeBtnLabel}>Fermeture</Text>
                  <View style={styles.timeBtnRow}>
                    <Feather name="clock" size={13} color="#1E3A5F" />
                    <Text style={[styles.timeBtnText, { color: '#1E3A5F' }]}>{day.close_time}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Footer fixe */}
      <View style={styles.footer}>
        {saved && (
          <View style={styles.savedBanner}>
            <Feather name="check-circle" size={14} color="#22C55E" />
            <Text style={styles.savedText}>Horaires sauvegardés ✓</Text>
          </View>
        )}
        {errorMsg && (
          <View style={styles.errorBanner}>
            <Feather name="alert-circle" size={14} color="#EF4444" />
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={saveHours}
          disabled={saving}
          activeOpacity={0.88}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="save" size={16} color="#fff" />}
          <Text style={styles.saveBtnText}>
            {saving ? 'Sauvegarde en cours…' : 'Sauvegarder les horaires'}
          </Text>
        </TouchableOpacity>
      </View>

      <TimePicker
        visible={pickerVisible}
        title={pickerTitle}
        value={pickerValue}
        onConfirm={onTimeConfirm}
        onClose={() => { setPickerVisible(false); setPickerTarget(null); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 120 },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 12, borderWidth: 1 },
  statusOpen: { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  statusClosed: { backgroundColor: '#F9FAFB', borderColor: '#E5E7EB' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  dayCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  dayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  daySummary: { fontSize: 12, color: '#9CA3AF' },
  toggle: { width: 50, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', justifyContent: 'center', paddingHorizontal: 3 },
  toggleOpen: { backgroundColor: '#FF6835' },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  thumbOpen: { alignSelf: 'flex-end' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeBtn: { flex: 1, gap: 4, backgroundColor: '#F8F7F4', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  timeBtnLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 },
  timeBtnRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeBtnText: { fontSize: 18, fontWeight: '800', color: '#FF6835' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 8 },
  savedBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 8 },
  savedText: { fontSize: 13, color: '#22C55E', fontWeight: '600' },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 8 },
  errorText: { flex: 1, fontSize: 12, color: '#EF4444' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF6835', borderRadius: 14, padding: 16 },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
