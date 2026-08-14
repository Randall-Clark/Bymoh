import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Dimensions, Modal, Platform, ScrollView,
  StyleSheet, Text, TouchableOpacity, View, Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { TimePicker } from '@/components/TimePicker';
import { Button } from '@/components/ui/Button';
import { DAY_LABELS } from '@/types';
import { registerDraft } from './step1';

// ── Constantes ────────────────────────────────────────────────────────────────
const ITEM_H      = 50;   // hauteur d'un item dans la roue
const VISIBLE     = 5;    // nombre d'items visibles (impair — sélection au centre)
const WHEEL_H     = ITEM_H * VISIBLE;
const HOURS       = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES     = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

interface DayHours { is_open: boolean; open_time: string; close_time: string; }

const defaultSchedule = (): DayHours[] =>
  Array.from({ length: 7 }, (_, i) => ({
    is_open:    i >= 0 && i <= 4, // Lun–Ven ouverts par défaut
    open_time:  '08:00',
    close_time: '18:00',
  }));

// ── Composant roue de défilement ──────────────────────────────────────────────


const wheelStyles = StyleSheet.create({
  wrap: {
    flex: 1, position: 'relative',
    overflow: 'hidden',
  },
  selector: {
    position: 'absolute',
    top: ITEM_H * Math.floor(VISIBLE / 2),
    left: 0, right: 0, height: ITEM_H,
    backgroundColor: 'rgba(255,104,53,0.08)',
    borderTopWidth: 1.5, borderBottomWidth: 1.5,
    borderColor: '#FF6835',
    borderRadius: 8, zIndex: 10,
  },
  item: {
    height: ITEM_H,
    alignItems: 'center', justifyContent: 'center',
  },
  itemText: {
    fontSize: 18, fontWeight: '500', color: '#C4C9D4',
  },
  itemTextSelected: {
    fontSize: 24, fontWeight: '800', color: '#111827',
  },
});

// ── Step 3 principal ──────────────────────────────────────────────────────────
export default function RegisterStep3() {
  const insets = useSafeAreaInsets();
  const [schedule, setSchedule] = useState<DayHours[]>(defaultSchedule());

  // Gestion du modal sélecteur
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

  const pickerValue = pickerTarget
    ? schedule[pickerTarget.day][pickerTarget.field] as string
    : '08:00';

  const pickerTitle = pickerTarget
    ? pickerTarget.field === 'open_time' ? "Heure d'ouverture" : "Heure de fermeture"
    : '';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* StepIndicator */}
      <View style={styles.stepWrap}>
        <StepIndicator current={3} total={5} title="Horaires d'ouverture" />
      </View>

      {/* Liste des jours */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.hint}>
          Ces horaires seront utilisés pour les filtres de recherche et l'affichage "Ouvert maintenant".
        </Text>

        {DAY_LABELS.map((label, i) => (
          <View key={i} style={styles.dayCard}>
            <View style={styles.dayTop}>
              <View style={styles.dayLeft}>
                <Text style={styles.dayName}>{label}</Text>
                {schedule[i].is_open && (
                  <Text style={styles.daySummary}>
                    {schedule[i].open_time} – {schedule[i].close_time}
                  </Text>
                )}
              </View>
              <Switch
                value={schedule[i].is_open}
                onValueChange={(v) => update(i, 'is_open', v)}
                trackColor={{ false: '#E5E7EB', true: '#FF6835' }}
                thumbColor="#fff"
              />
            </View>

            {schedule[i].is_open && (
              <View style={styles.timeRow}>
                {/* Bouton Ouverture */}
                <TouchableOpacity
                  style={styles.timeBtn}
                  onPress={() => openPicker(i, 'open_time')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.timeBtnLabel}>Ouverture</Text>
                  <View style={styles.timeBtnValue}>
                    <Feather name="clock" size={13} color="#FF6835" />
                    <Text style={styles.timeBtnText}>{schedule[i].open_time}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.timeSep}>
                  <Feather name="arrow-right" size={14} color="#9CA3AF" />
                </View>

                {/* Bouton Fermeture */}
                <TouchableOpacity
                  style={styles.timeBtn}
                  onPress={() => openPicker(i, 'close_time')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.timeBtnLabel}>Fermeture</Text>
                  <View style={styles.timeBtnValue}>
                    <Feather name="clock" size={13} color="#1E3A5F" />
                    <Text style={[styles.timeBtnText, { color: '#1E3A5F' }]}>{schedule[i].close_time}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Suivant →" onPress={onNext} fullWidth size="lg" />
      </View>

      {/* Modal sélecteur d'heure */}
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
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepWrap: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#F8F7F4' },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },

  hint: { fontSize: 13, color: '#9CA3AF', lineHeight: 18, marginBottom: 4 },

  dayCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  dayTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLeft: { flex: 1, gap: 2 },
  dayName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  daySummary: { fontSize: 12, color: '#9CA3AF' },

  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeSep: { alignItems: 'center', paddingTop: 14 },

  timeBtn: {
    flex: 1, gap: 4,
    backgroundColor: '#F8F7F4', borderRadius: 12,
    padding: 12, borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  timeBtnLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.4 },
  timeBtnValue: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeBtnText: { fontSize: 18, fontWeight: '800', color: '#FF6835' },

  footer: {
    backgroundColor: '#F8F7F4',
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
});
