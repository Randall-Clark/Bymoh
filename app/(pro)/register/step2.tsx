import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ALL_CITIES } from '@/types';
import { registerDraft } from './step1';

const schema = z.object({
  address: z.string().min(5, 'Adresse requise'),
  city: z.string().min(1, 'Ville requise'),
});
type FormData = z.infer<typeof schema>;

export default function RegisterStep2() {
  const insets = useSafeAreaInsets();
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { address: '', city: '' },
  });
  const selectedCity = watch('city');

  const onSubmit = (data: FormData) => {
    Object.assign(registerDraft, data);
    router.push('/(pro)/register/step3' as any);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        <StepIndicator current={2} total={5} title="Localisation" />

        <View style={styles.citySection}>
          <Text style={styles.cityLabel}>Ville *</Text>
          <FlatList
            horizontal
            data={[...ALL_CITIES]}
            keyExtractor={(c) => c.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => {
              const active = selectedCity === item.name;
              return (
                <TouchableOpacity
                  style={[styles.cityChip, active && styles.cityChipActive]}
                  onPress={() => setValue('city', item.name)}
                >
                  <Text style={styles.flag}>{item.flag}</Text>
                  <Text style={[styles.cityName, active && { color: '#FF6835' }]}>{item.name}</Text>
                </TouchableOpacity>
              );
            }}
          />
          {errors.city && <Text style={styles.error}>{errors.city.message}</Text>}
        </View>

        <Controller control={control} name="address" render={({ field: { onChange, value, onBlur } }) => (
          <Input label="Adresse complète *" placeholder="Rue, quartier, numéro..." value={value} onChangeText={onChange} onBlur={onBlur} error={errors.address?.message} leftIcon="map-pin" />
        )} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Suivant →" onPress={handleSubmit(onSubmit)} fullWidth size="lg" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 20 },
  citySection: { gap: 8 },
  cityLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  cityChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  cityChipActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  flag: { fontSize: 18 },
  cityName: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  error: { fontSize: 12, color: '#EF4444' },
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
});
