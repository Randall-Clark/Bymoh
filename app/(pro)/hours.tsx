import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { DAY_LABELS } from '@/types';
import { Button } from '@/components/ui/Button';

interface DayHours { is_open: boolean; open_time: string; close_time: string; }
type Schedule = DayHours[];

const defaultSchedule = (): Schedule =>
  Array.from({ length: 7 }, (_, i) => ({
    is_open: i >= 1 && i <= 5,
    open_time: '08:00',
    close_time: '18:00',
  }));

export default function ProHoursScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const [schedule, setSchedule] = useState<Schedule>(defaultSchedule());
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('businesses').select('id').eq('owner_id', session?.user?.id ?? '').limit(1).single();
      if (data) {
        setBusinessId(data.id);
        const { data: hours } = await supabase.from('business_hours').select('*').eq('business_id', data.id);
        if (hours && hours.length > 0) {
          const sched = defaultSchedule();
          hours.forEach((h: any) => {
            sched[h.day_of_week] = { is_open: h.is_open, open_time: h.open_time ?? '08:00', close_time: h.close_time ?? '18:00' };
          });
          setSchedule(sched);
        }
      }
    })();
  }, [session?.user?.id]);

  const save = async () => {
    if (!businessId) { Alert.alert('Aucun commerce', 'Créez d\'abord un commerce.'); return; }
    setLoading(true);
    try {
      const upserts = schedule.map((d, i) => ({ business_id: businessId, day_of_week: i, is_open: d.is_open, open_time: d.open_time, close_time: d.close_time }));
      const { error } = await supabase.from('business_hours').upsert(upserts, { onConflict: 'business_id,day_of_week' });
      if (error) throw error;
      Alert.alert('Enregistré', 'Vos horaires ont été mis à jour.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const update = (day: number, field: keyof DayHours, value: string | boolean) => {
    setSchedule((s) => s.map((d, i) => i === day ? { ...d, [field]: value } : d));
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Horaires d'ouverture</Text>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: botPad + 100 }]} showsVerticalScrollIndicator={false}>
        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.dayCard}>
            <View style={styles.dayTop}>
              <Text style={styles.dayName}>{label}</Text>
              <Switch
                value={schedule[i].is_open}
                onValueChange={(v) => update(i, 'is_open', v)}
                trackColor={{ false: '#E5E7EB', true: '#FF6835' }}
                thumbColor="#fff"
              />
            </View>
            {schedule[i].is_open && (
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <Text style={styles.timeLabel}>Ouverture</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={schedule[i].open_time}
                    onChangeText={(v) => update(i, 'open_time', v)}
                    placeholder="08:00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <Feather name="minus" size={16} color="#9CA3AF" style={{ marginTop: 20 }} />
                <View style={styles.timeField}>
                  <Text style={styles.timeLabel}>Fermeture</Text>
                  <TextInput
                    style={styles.timeInput}
                    value={schedule[i].close_time}
                    onChangeText={(v) => update(i, 'close_time', v)}
                    placeholder="18:00"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botPad + 16 }]}>
        <Button title="Enregistrer les horaires" onPress={save} loading={loading} fullWidth size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  dayCard: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  dayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timeField: { flex: 1, gap: 6 },
  timeLabel: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  timeInput: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, fontWeight: '700', color: '#111827', textAlign: 'center' },
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
});
