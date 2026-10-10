import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { TimePicker } from '@/components/TimePicker';
import { Button } from '@/components/ui/Button';
import { DAY_LABELS } from '@/types';
import { registerDraft } from './step1';
import { useAuthStore } from '@/stores/authStore';

const ORANGE = '#FF6835';
const DARK   = '#1A1025';

interface DayHours { is_open: boolean; open_time: string; close_time: string; }

const defaultSchedule = (): DayHours[] =>
  Array.from({ length: 7 }, (_, i) => ({
    is_open:    i >= 0 && i <= 4,
    open_time:  '08:00',
    close_time: '18:00',
  }));

export default function RegisterStep3() {
  const insets      = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [schedule, setSchedule] = useState<DayHours[]>(defaultSchedule());

  const handleCancel = () => {
    router.dismissAll();
    if ((profile as any)?.role === 'pro') {
      router.replace('/(pro)/dashboard' as any);
    } else {
      router.replace('/(client)/' as any);
    }
  };

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget]   = useState<{ day: number; field: 'open_time' | 'close_time' } | null>(null);

  const update = (day: number, field: keyof DayHours, value: string | boolean) =>
    setSchedule((s) => s.map((d, i) => i === day ? { ...d, [field]: value } : d));

  const openPicker = (day: number, field: 'open_time' | 'close_time') => {
    setPickerTarget({ day, field });
    setPickerVisible(true);
  };

  const onTimeConfirm = (time: string) => {
    if (pickerTarget) update(pickerTarget.day, pickerTarget.field, time);
    setPickerVisible(false);
    setPickerTarget(null);
  };

  const onNext = () => {
    (registerDraft as any).schedule = schedule;
    router.push('/(pro)/register/step4' as any);
  };

  const pickerValue = pickerTarget ? schedule[pickerTarget.day][pickerTarget.field] as string : '08:00';
  const pickerTitle = pickerTarget
    ? pickerTarget.field === 'open_time' ? "Heure d'ouverture" : "Heure de fermeture"
    : '';

  const openCount = schedule.filter((d) => d.is_open).length;

  return (
    <View style={s.root}>

      {/* ── Navbar sombre ── */}
      <View style={[s.navbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.navTitle}>Créer mon commerce</Text>
        <TouchableOpacity onPress={handleCancel} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </View>

      {/* ── Indicateur d'étape ── */}
      <View style={s.stepWrap}>
        <StepIndicator current={3} total={5} title="Horaires d'ouverture" />
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Bannière info */}
        {/* <View style={s.infoBanner}>
          <Feather name="info" size={14} color="#3B82F6" />
          <Text style={s.infoBannerText}>
            Ces horaires servent pour le filtre "Ouvert maintenant" et la recherche.
          </Text>
        </View> */}

        {/* Résumé ouvertures */}
        <View style={s.summaryRow}>
          <View style={s.summaryDot} />
          <Text style={s.summaryText}>
            <Text style={s.summaryCount}>{openCount}</Text>
            {' '}jour{openCount > 1 ? 's' : ''} ouvert{openCount > 1 ? 's' : ''} configuré{openCount > 1 ? 's' : ''}
          </Text>
        </View>

        {/* Jours */}
        {DAY_LABELS.map((label, i) => {
          const day = schedule[i];
          return (
            <View key={i} style={[s.dayCard, !day.is_open && s.dayCardClosed]}>
              {/* Ligne principale */}
              <View style={s.dayTop}>
                <View style={[s.dayIndicator, day.is_open && s.dayIndicatorOpen]} />
                <View style={s.dayLeft}>
                  <Text style={[s.dayName, !day.is_open && s.dayNameClosed]}>{label}</Text>
                  {day.is_open && (
                    <Text style={s.daySummary}>{day.open_time} – {day.close_time}</Text>
                  )}
                  {!day.is_open && (
                    <Text style={s.dayClosedLabel}>Fermé</Text>
                  )}
                </View>
                <Switch
                  value={day.is_open}
                  onValueChange={(v) => update(i, 'is_open', v)}
                  trackColor={{ false: '#E5E7EB', true: ORANGE }}
                  thumbColor="#fff"
                />
              </View>

              {/* Horaires si ouvert */}
              {day.is_open && (
                <View style={s.timeRow}>
                  <TouchableOpacity
                    style={s.timeBtn}
                    onPress={() => openPicker(i, 'open_time')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.timeBtnLabel}>Ouverture</Text>
                    <View style={s.timeBtnValue}>
                      <Feather name="sunrise" size={13} color={ORANGE} />
                      <Text style={[s.timeBtnText, { color: ORANGE }]}>{day.open_time}</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={s.timeSep}>
                    <Feather name="arrow-right" size={14} color="#D1D5DB" />
                  </View>

                  <TouchableOpacity
                    style={[s.timeBtn, s.timeBtnClose]}
                    onPress={() => openPicker(i, 'close_time')}
                    activeOpacity={0.8}
                  >
                    <Text style={s.timeBtnLabel}>Fermeture</Text>
                    <View style={s.timeBtnValue}>
                      <Feather name="sunset" size={13} color="#1E3A5F" />
                      <Text style={[s.timeBtnText, { color: '#1E3A5F' }]}>{day.close_time}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Suivant →" onPress={onNext} fullWidth size="lg" />
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F6F3' },
  flex: { flex: 1 },

  navbar:    { backgroundColor: DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 18 },
  backBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  navTitle:  { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },

  stepWrap: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },

  content: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },

  infoBanner:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  infoBannerText: { flex: 1, fontSize: 12, color: '#1D4ED8', lineHeight: 17 },

  summaryRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 },
  summaryDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  summaryText: { fontSize: 13, color: '#6B7280' },
  summaryCount: { fontWeight: '800', color: '#111827' },

  dayCard: {
    backgroundColor: '#fff', borderRadius: 18, padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  dayCardClosed: { opacity: 0.65 },
  dayTop:   { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dayIndicator:     { width: 4, height: 40, borderRadius: 2, backgroundColor: '#E5E7EB' },
  dayIndicatorOpen: { backgroundColor: ORANGE },
  dayLeft:  { flex: 1 },
  dayName:       { fontSize: 15, fontWeight: '700', color: '#111827' },
  dayNameClosed: { color: '#9CA3AF' },
  daySummary:    { fontSize: 12, color: '#6B7280', marginTop: 2 },
  dayClosedLabel: { fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 14 },
  timeSep: { alignItems: 'center' },

  timeBtn: {
    flex: 1, gap: 3, backgroundColor: '#FFF4EF',
    borderRadius: 12, padding: 12,
    borderWidth: 1.5, borderColor: '#FDDCCA',
  },
  timeBtnClose: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  timeBtnLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 },
  timeBtnValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeBtnText:  { fontSize: 18, fontWeight: '800' },

  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EFEFEF' },
});
