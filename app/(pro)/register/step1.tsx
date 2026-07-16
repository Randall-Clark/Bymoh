import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { CATEGORIES } from '@/types';
import { useCartStore } from '@/stores/cartStore';

const schema = z.object({
  name: z.string().min(2, 'Nom requis'),
  category: z.string().min(1, 'Catégorie requise'),
  phone: z.string().min(8, 'Numéro invalide'),
});
type FormData = z.infer<typeof schema>;

const registerDraft: Partial<FormData & { address: string; city: string; description: string }> = {};

export default function RegisterStep1() {
  const insets = useSafeAreaInsets();
  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', category: '', phone: '' },
  });
  const selectedCategory = watch('category');

  const onSubmit = (data: FormData) => {
    Object.assign(registerDraft, data);
    router.push('/(pro)/register/step2' as any);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} showsVerticalScrollIndicator={false}>
        <StepIndicator current={1} total={5} title="Informations de base" />

        <Controller control={control} name="name" render={({ field: { onChange, value, onBlur } }) => (
          <Input label="Nom du commerce *" placeholder="Ex: Chez Maman Restaurant" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.name?.message} leftIcon="briefcase" />
        )} />

        <View style={styles.catSection}>
          <Text style={styles.catLabel}>Catégorie *</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => {
              const active = selectedCategory === c.id;
              return (
                <TouchableOpacity key={c.id} style={[styles.catCard, active && styles.catCardActive]} onPress={() => setValue('category', c.id)}>
                  <Feather name={c.icon as any} size={20} color={active ? '#fff' : '#6B7280'} />
                  <Text style={[styles.catCardLabel, active && { color: '#fff' }]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {errors.category && <Text style={styles.error}>{errors.category.message}</Text>}
        </View>

        <Controller control={control} name="phone" render={({ field: { onChange, value, onBlur } }) => (
          <Input label="Téléphone du commerce *" placeholder="+228 90 00 00 00" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.phone?.message} leftIcon="phone" keyboardType="phone-pad" />
        )} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Suivant →" onPress={handleSubmit(onSubmit)} fullWidth size="lg" />
      </View>
    </KeyboardAvoidingView>
  );
}

export { registerDraft };

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 20 },
  catSection: { gap: 8 },
  catLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catCard: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  catCardActive: { backgroundColor: '#FF6835', borderColor: '#FF6835' },
  catCardLabel: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  error: { fontSize: 12, color: '#EF4444' },
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
});
