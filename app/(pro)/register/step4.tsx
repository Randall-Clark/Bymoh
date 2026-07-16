import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { registerDraft } from './step1';

const schema = z.object({
  description: z.string().min(20, 'Description trop courte (min 20 caractères)'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
});
type FormData = z.infer<typeof schema>;

export default function RegisterStep4() {
  const insets = useSafeAreaInsets();
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', email: '' },
  });

  const onSubmit = (data: FormData) => {
    Object.assign(registerDraft, { ...data, has_delivery: deliveryAvailable });
    router.push('/(pro)/register/payment' as any);
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        <StepIndicator current={4} total={5} title="Description & services" />

        <Controller control={control} name="description" render={({ field: { onChange, value, onBlur } }) => (
          <Input label="Description du commerce *" placeholder="Décrivez votre activité, vos spécialités, ce qui vous rend unique..." value={value} onChangeText={onChange} onBlur={onBlur} error={errors.description?.message} multiline style={{ minHeight: 120 }} />
        )} />

        <Controller control={control} name="email" render={({ field: { onChange, value, onBlur } }) => (
          <Input label="Email professionnel" placeholder="contact@moncommerce.com" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.email?.message} leftIcon="mail" keyboardType="email-address" />
        )} />

        <View style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Livraison disponible</Text>
            <Text style={styles.toggleSub}>Activez si vous proposez un service de livraison</Text>
          </View>
          <Switch value={deliveryAvailable} onValueChange={setDeliveryAvailable} trackColor={{ false: '#E5E7EB', true: '#FF6835' }} thumbColor="#fff" />
        </View>
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
  toggleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  toggleSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
});
