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
const DAY_ENUM_UI = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
const DAY_NAMES   = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

// index UI (0=Lundi…6=Dim) → string enum DB ('Mon'…'Sun')
const toDB   = (i: number): string => DAY_ENUM_UI[i];
// string enum DB → index UI
const fromDB = (d: string): number => DAY_ENUM_UI.indexOf(d as any);

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

interface DayHours {
  id?:         string;
  day_of_week: string;   // 'Mon' | 'Tue' | ...
  open_time:   string;
  close_time:  string;
  is_closed:   boolean;
}

export function HoursSection({ business }: { business: any }) {
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget]   = useState<{
    idx: number; field: 'open_time' | 'close_time';
  } | null>(null);

  // ── Initialise depuis la DB ─────────────────────────────────────────────
  const initSchedule = (): DayHours[] =>
    Array.from({ length: 7 }, (_, i) => {
      const enumVal = toDB(i);                // 'Mon', 'Tue'...
      const dbDay   = (business.hours ?? []).find(
        (h: any) => {
          // Gérer string ('Mon') ET integer (0-6)
          if (typeof h.day_of_week === 'number') {
            return DAY_ENUM_UI[h.day_of_week] === enumVal;
          }
          return h.day_of_week === enumVal;
        }
      );
      return {
        id:          dbDay?.id,
        day_of_week: enumVal,
        open_time:   dbDay?.open_time  ?? '08:00',
        close_time:  dbDay?.close_time ?? '18:00',
        is_closed:   dbDay ? dbDay.is_closed : i >= 5, // Sam+Dim fermés par défaut
      };
    });

  const [schedule, setSchedule] = useState<DayHours[]>(initSchedule);

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

  // ── Sauvegarde en DB ────────────────────────────────────────────────────
  const saveHours = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < schedule.length; i++) {
        const day = schedule[i];
        const record = {
          business_id: business.id,
          day_of_week: day.day_of_week,  // 'Mon', 'Tue'...
          open_time:   day.open_time,
          close_time:  day.close_time,
          is_closed:   day.is_closed,
        };

        if (day.id) {
          // Mise à jour
          await supabase
            .from('business_hours')
            .update({
              open_time:  record.open_time,
              close_time: record.close_time,
              is_closed:  record.is_closed,
            })
            .eq('id', day.id);
        } else {
          // Insertion
          const { data } = await supabase
            .from('business_hours')
            .insert({ id: generateId(), ...record })
            .select('id')
            .single();
          if (data?.id) {
            setSchedule((s) => s.map((d, idx) =>
              idx === i ? { ...d, id: data.id } : d
            ));
          }
        }
      }

      // ── Recalcule is_open pour aujourd'hui ──────────────────────────────
      // JS getDay() : 0=Sun,1=Mon,...,6=Sat
      // Index UI    : 0=Mon,...,5=Sat,6=Sun
      const jsDay  = new Date().getDay();
      const uiIdx  = jsDay === 0 ? 6 : jsDay - 1; // Sun(JS0)→uiIdx6, Mon(JS1)→uiIdx0
      const today  = schedule[uiIdx];
      const now    = new Date();
      const nowMin = now.getHours() * 60 + now.getMinutes();

      let isOpenNow = false;
      if (!today.is_closed && today.open_time && today.close_time) {
        const [oh, om] = today.open_time.split(':').map(Number);
        const [ch, cm] = today.close_time.split(':').map(Number);
        isOpenNow = nowMin >= oh * 60 + om && nowMin < ch * 60 + cm;
      }

      await supabase
        .from('businesses')
        .update({ is_open: isOpenNow })
        .eq('id', business.id);

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('[HoursSection] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const pickerValue = pickerTarget
    ? schedule[pickerTarget.idx][pickerTarget.field] as string
    : '08:00';
  const pickerTitle = pickerTarget?.field === 'open_time'
    ? "Heure d'ouverture"
    : "Heure de fermeture";

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={hs.headerRow}>
          <Text style={hs.sectionTitle}>Horaires d'ouverture</Text>
          <Text style={hs.hint}>Les clients voient ces horaires dans les filtres</Text>
        </View>

        {schedule.map((day, i) => (
          <View key={i} style={hs.dayCard}>
            <View style={hs.dayTop}>
              <View style={hs.dayLeft}>
                <Text style={hs.dayName}>{DAY_NAMES[i]}</Text>
                {!day.is_closed && (
                  <Text style={hs.daySummary}>{day.open_time} – {day.close_time}</Text>
                )}
              </View>

              {/* Toggle ouvert/fermé style iOS */}
              <TouchableOpacity
                style={[hs.toggle, !day.is_closed && hs.toggleOpen]}
                onPress={() => update(i, 'is_closed', !day.is_closed)}
                activeOpacity={0.8}
              >
                <View style={[hs.toggleThumb, !day.is_closed && hs.toggleThumbOpen]} />
              </TouchableOpacity>
            </View>

            {!day.is_closed && (
              <View style={hs.timeRow}>
                <TouchableOpacity style={hs.timeBtn} onPress={() => openPicker(i, 'open_time')} activeOpacity={0.8}>
                  <Text style={hs.timeBtnLabel}>Ouverture</Text>
                  <View style={hs.timeBtnValue}>
                    <Feather name="clock" size={13} color="#FF6835" />
                    <Text style={hs.timeBtnText}>{day.open_time}</Text>
                  </View>
                </TouchableOpacity>

                <Feather name="arrow-right" size={14} color="#9CA3AF" />

                <TouchableOpacity style={hs.timeBtn} onPress={() => openPicker(i, 'close_time')} activeOpacity={0.8}>
                  <Text style={hs.timeBtnLabel}>Fermeture</Text>
                  <View style={hs.timeBtnValue}>
                    <Feather name="clock" size={13} color="#1E3A5F" />
                    <Text style={[hs.timeBtnText, { color: '#1E3A5F' }]}>{day.close_time}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bouton fixe en bas */}
      <View style={hs.footer}>
        {saved && (
          <View style={hs.savedBanner}>
            <Feather name="check-circle" size={14} color="#22C55E" />
            <Text style={hs.savedText}>Horaires sauvegardés avec succès</Text>
          </View>
        )}
        <TouchableOpacity
          style={[hs.saveBtn, saving && { opacity: 0.7 }]}
          onPress={saveHours}
          disabled={saving}
          activeOpacity={0.88}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Feather name="save" size={16} color="#fff" />}
          <Text style={hs.saveBtnText}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder les horaires'}
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

const hs = StyleSheet.create({
  sectionTitle: { fontSize:16, fontWeight:'800', color:'#111827' },
  headerRow:       { gap: 4 },
  hint:            { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic' },
  dayCard:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  dayTop:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLeft:         { flex: 1, gap: 2 },
  dayName:         { fontSize: 15, fontWeight: '700', color: '#111827' },
  daySummary:      { fontSize: 12, color: '#9CA3AF' },
  toggle:          { width: 50, height: 28, borderRadius: 14, backgroundColor: '#E5E7EB', justifyContent: 'center', paddingHorizontal: 3 },
  toggleOpen:      { backgroundColor: '#FF6835' },
  toggleThumb:     { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  toggleThumbOpen: { alignSelf: 'flex-end' },
  timeRow:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeBtn:         { flex: 1, gap: 4, backgroundColor: '#F8F7F4', borderRadius: 12, padding: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  timeBtnLabel:    { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 },
  timeBtnValue:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeBtnText:     { fontSize: 18, fontWeight: '800', color: '#FF6835' },
  footer:          { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 8 },
  savedBanner:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 8 },
  savedText:       { fontSize: 13, color: '#22C55E', fontWeight: '600' },
  saveBtn:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FF6835', borderRadius: 14, padding: 16 },
  saveBtnText:     { fontSize: 15, fontWeight: '700', color: '#fff' },
});