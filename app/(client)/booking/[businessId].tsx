import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useBusiness, useBusinessCatalog } from '@/hooks/useBusinesses';
import { Button } from '@/components/ui/Button';
import { formatDate, generateTimeSlots } from '@/lib/utils';
import type { CatalogItem } from '@/types';

const schema = z.object({
  notes: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

const DAYS_AHEAD = 14;

function getNextDays(n: number): Date[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i + 1);
    return d;
  });
}

export default function BookingScreen() {
  const insets = useSafeAreaInsets();
  const { businessId } = useLocalSearchParams<{ businessId: string }>();
  const { session } = useAuthStore();
  const { data: business } = useBusiness(businessId ?? '');
  const { data: catalog = [] } = useBusinessCatalog(businessId ?? '');
  const services = (catalog as CatalogItem[]).filter((i) => i.allows_booking);

  const [selectedService, setSelectedService] = useState<CatalogItem | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit } = useForm<FormData>({ resolver: zodResolver(schema) });

  const days = getNextDays(DAYS_AHEAD);
  const timeSlots = generateTimeSlots();

  const onSubmit = async (data: FormData) => {
    if (!selectedService || !selectedDate || !selectedTime) {
      Alert.alert('Sélection incomplète', 'Veuillez choisir un service, une date et un horaire.');
      return;
    }
    if (!session?.user?.id) {
      Alert.alert('Non connecté', 'Vous devez être connecté pour réserver.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from('bookings').insert({
        user_id: session.user.id,
        business_id: businessId,
        service_id: selectedService.id,
        booking_type: 'appointment',
        date: selectedDate.toISOString().split('T')[0],
        time: selectedTime,
        notes: data.notes ?? '',
        status: 'pending',
      });
      if (error) throw error;
      router.replace('/(client)/booking/confirmation');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la réservation';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Réserver</Text>
        <Text style={styles.bizName}>{business?.name}</Text>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        {/* Service selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choisir un service</Text>
          {services.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.serviceCard, selectedService?.id === s.id && styles.serviceCardActive]}
              onPress={() => setSelectedService(s)}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.serviceName, selectedService?.id === s.id && { color: '#FF6835' }]}>{s.title}</Text>
                {s.description && <Text style={styles.serviceDesc} numberOfLines={1}>{s.description}</Text>}
              </View>
              <Text style={[styles.servicePrice, selectedService?.id === s.id && { color: '#FF6835' }]}>
                {s.price.toLocaleString('fr-FR')} FCFA
              </Text>
              {selectedService?.id === s.id && <Feather name="check-circle" size={18} color="#FF6835" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Date selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choisir une date</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {days.map((d) => {
              const isSelected = selectedDate?.toDateString() === d.toDateString();
              return (
                <TouchableOpacity
                  key={d.toISOString()}
                  style={[styles.dayBtn, isSelected && styles.dayBtnActive]}
                  onPress={() => setSelectedDate(d)}
                >
                  <Text style={[styles.dayName, isSelected && { color: '#FF6835' }]}>
                    {d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}
                  </Text>
                  <Text style={[styles.dayNum, isSelected && { color: '#FF6835' }]}>{d.getDate()}</Text>
                  <Text style={[styles.dayMonth, isSelected && { color: '#FF6835' }]}>
                    {d.toLocaleDateString('fr-FR', { month: 'short' }).replace('.', '')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Time selection */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choisir un horaire</Text>
            <View style={styles.timeGrid}>
              {timeSlots.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.timeBtn, selectedTime === t && styles.timeBtnActive]}
                  onPress={() => setSelectedTime(t)}
                >
                  <Text style={[styles.timeLabel, selectedTime === t && { color: '#fff' }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes (facultatif)</Text>
          <Controller
            control={control}
            name="notes"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={styles.notesInput}
                placeholder="Informations supplémentaires pour le prestataire..."
                placeholderTextColor="#9CA3AF"
                value={value}
                onChangeText={onChange}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title="Confirmer la réservation"
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          fullWidth
          size="lg"
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, gap: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginLeft: -8 },
  title: { fontSize: 24, fontWeight: '800', color: '#111827' },
  bizName: { fontSize: 14, color: '#6B7280' },
  content: { paddingHorizontal: 20, paddingTop: 16, gap: 16 },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  serviceCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  serviceCardActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  serviceName: { fontSize: 14, fontWeight: '700', color: '#111827' },
  serviceDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  servicePrice: { fontSize: 14, fontWeight: '800', color: '#111827' },
  dayBtn: { alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff', minWidth: 60 },
  dayBtnActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  dayName: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'capitalize' },
  dayNum: { fontSize: 20, fontWeight: '800', color: '#111827' },
  dayMonth: { fontSize: 11, color: '#9CA3AF', textTransform: 'capitalize' },
  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timeBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 100, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  timeBtnActive: { borderColor: '#FF6835', backgroundColor: '#FF6835' },
  timeLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  notesInput: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, padding: 14, fontSize: 14, color: '#111827', minHeight: 100, backgroundColor: '#fff' },
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
});
