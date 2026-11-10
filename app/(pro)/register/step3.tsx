import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View, Switch,
} from 'react-native';
import Animated, { SlideInRight, SlideInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { TimePicker } from '@/components/TimePicker';
import { DAY_LABELS } from '@/types';
import { registerDraft } from './step1';
import { useAuthStore } from '@/stores/authStore';
import { navDir } from '@/lib/navDir';

const ORANGE = '#FF6835';
const DARK   = '#1A1025';

interface DayHours { is_open: boolean; open_time: string; close_time: string; }

const defaultSchedule = (): DayHours[] =>
  Array.from({ length: 7 }, (_, i) => ({
    is_open:    i >= 0 && i <= 4,
    open_time:  '09:00',
    close_time: '17:30',
  }));

/** Converts "09:00" → "09:00 AM" / "17:30" → "5:30 PM" */
function fmt(time: string): string {
  const [hStr, mStr] = time.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const ampm = h < 12 ? 'AM' : 'PM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export default function RegisterStep3() {
  const insets      = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [schedule, setSchedule] = useState<DayHours[]>(
    (registerDraft as any).schedule ?? defaultSchedule()
  );

  const entering = navDir.current === 'back' ? SlideInLeft.duration(300) : SlideInRight.duration(300);
  navDir.current = 'forward';
  const goBack = () => {
    navDir.current = 'back';
    router.replace('/(pro)/register/step2' as any);
  };

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

  const pickerValue = pickerTarget ? schedule[pickerTarget.day][pickerTarget.field] as string : '09:00';
  const pickerTitle = pickerTarget
    ? pickerTarget.field === 'open_time' ? "Heure d'ouverture" : "Heure de fermeture"
    : '';

  return (
    <View style={s.root}>

      {/* ── Navbar sombre (fixe) ── */}
      <View style={[s.navbar, { paddingTop: insets.top + 8 }]}>
        <Text style={s.navTitle}>Créer mon commerce</Text>
        <TouchableOpacity onPress={handleCancel} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </View>

      {/* ── Indicateur d'étape (fixe) ── */}
      <View style={s.stepWrap}>
        <StepIndicator current={3} total={5} title="Horaires d'ouverture" />
      </View>

      {/* ── Zone animée ── */}
      <Animated.View style={s.flex} entering={entering}>

        <ScrollView
          style={s.flex}
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Une seule carte plate pour tous les jours */}
          <View style={s.flatCard}>
            {DAY_LABELS.map((label, i) => {
              const day  = schedule[i];
              const last = i === DAY_LABELS.length - 1;
              return (
                <View key={i}>
                  <View style={s.dayRow}>
                    {/* Toggle + Nom du jour */}
                    <Switch
                      value={day.is_open}
                      onValueChange={(v) => update(i, 'is_open', v)}
                      trackColor={{ false: '#E5E7EB', true: ORANGE }}
                      thumbColor="#fff"
                      style={s.toggle}
                    />
                    <Text style={[s.dayName, !day.is_open && s.dayNameOff]}>{label}</Text>

                    {/* Plage horaire ou "Closed" */}
                    {day.is_open ? (
                      <View style={s.timeSlot}>
                        <Text style={s.timeLabel}>De</Text>
                        <TouchableOpacity onPress={() => openPicker(i, 'open_time')} activeOpacity={0.75}>
                          <Text style={s.timeValue}>{fmt(day.open_time)}</Text>
                        </TouchableOpacity>
                        <Text style={s.timeLabel}>A</Text>
                        <TouchableOpacity onPress={() => openPicker(i, 'close_time')} activeOpacity={0.75}>
                          <Text style={s.timeValue}>{fmt(day.close_time)}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <View style={s.closedSlot}>
                        <Text style={s.closedText}>Closed</Text>
                      </View>
                    )}
                  </View>
                  {!last && <View style={s.sep} />}
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* ── Footer ── */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.footerRow}>
            <TouchableOpacity style={s.prevBtn} onPress={goBack} activeOpacity={0.8}>
              <Feather name="arrow-left" size={15} color="#6B7280" />
              <Text style={s.prevBtnTxt}>Précédent (2/5)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.nextBtn} onPress={onNext} activeOpacity={0.85}>
              <Text style={s.nextBtnTxt}>Suivant</Text>
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>

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
  navTitle:  { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },

  stepWrap: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },

  content:  { paddingHorizontal: 16, paddingTop: 18 },

  flatCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  sep:      { height: 1, backgroundColor: '#F3F4F6', marginLeft: 16 },

  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },

  toggle:     { /* natively sized */ },
  dayName:    { fontSize: 15, fontWeight: '600', color: '#111827', width: 100 },
  dayNameOff: { color: '#9CA3AF' },

  timeSlot:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  timeLabel: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  timeValue: { fontSize: 13, fontWeight: '700', color: '#111827' },

  closedSlot: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  closedMoon: { fontSize: 14 },
  closedText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500', fontStyle: 'italic' },

  footer:    { backgroundColor: 'transparent', paddingHorizontal: 20, paddingTop: 14 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prevBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9F8F6' },
  prevBtnTxt: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  nextBtn:   { flex: 1, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  nextBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
