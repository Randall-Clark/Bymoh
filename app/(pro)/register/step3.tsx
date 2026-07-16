import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Button } from '@/components/ui/Button';
import { DAY_LABELS } from '@/types';
import { registerDraft } from './step1';

interface DayHours { is_open: boolean; open_time: string; close_time: string; }

const defaultSchedule = (): DayHours[] =>
  Array.from({ length: 7 }, (_, i) => ({ is_open: i >= 1 && i <= 5, open_time: '08:00', close_time: '18:00' }));

export default function RegisterStep3() {
  const insets = useSafeAreaInsets();
  const [schedule, setSchedule] = useState<DayHours[]>(defaultSchedule());

  const update = (day: number, field: keyof DayHours, value: string | boolean) =>
    setSchedule((s) => s.map((d, i) => i === day ? { ...d, [field]: value } : d));

  const onNext = () => {
    (registerDraft as any).schedule = schedule;
    router.push('/(pro)/register/step4' as any);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}>
        <StepIndicator current={3} total={5} title="Horaires d'ouverture" />
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.dayCard}>
            <View style={styles.dayTop}>
              <Text style={styles.dayName}>{label}</Text>
              <Switch value={schedule[i].is_open} onValueChange={(v) => update(i, 'is_open', v)} trackColor={{ false: '#E5E7EB', true: '#FF6835' }} thumbColor="#fff" />
            </View>
            {schedule[i].is_open && (
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={styles.timeLabel}>Ouverture</Text>
                  <TextInput style={styles.timeInput} value={schedule[i].open_time} onChangeText={(v) => update(i, 'open_time', v)} placeholder="08:00" placeholderTextColor="#9CA3AF" keyboardType="numbers-and-punctuation" />
                </View>
                <Feather name="minus" size={14} color="#9CA3AF" style={{ marginTop: 20 }} />
                <View style={styles.timeField}>
                  <Text style={styles.timeLabel}>Fermeture</Text>
                  <TextInput style={styles.timeInput} value={schedule[i].close_time} onChangeText={(v) => update(i, 'close_time', v)} placeholder="18:00" placeholderTextColor="#9CA3AF" keyboardType="numbers-and-punctuation" />
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Suivant →" onPress={onNext} fullWidth size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  dayCard: { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 10 },
  dayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeField: { flex: 1, gap: 4 },
  timeLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  timeInput: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, fontWeight: '700', color: '#111827', textAlign: 'center' },
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
});
