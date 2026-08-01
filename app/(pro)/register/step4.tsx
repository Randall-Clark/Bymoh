import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
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
  const scrollRef = useRef<ScrollView>(null);
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
    // ── Pas de KeyboardAvoidingView — le footer NE bouge PAS
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>

      {/* Header fixe */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* StepIndicator fixe */}
      <View style={styles.stepWrap}>
        <StepIndicator current={4} total={5} title="Description & services" />
      </View>

      {/* Scroll seul */}
      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Controller control={control} name="description" render={({ field: { onChange, value, onBlur } }) => (
          <Input
            label="Description du commerce *"
            placeholder="Décrivez votre activité, vos spécialités, ce qui vous rend unique..."
            value={value} onChangeText={onChange} onBlur={onBlur}
            error={errors.description?.message}
            multiline style={{ minHeight: 120 }}
            onFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
          />
        )} />

        <Controller control={control} name="email" render={({ field: { onChange, value, onBlur } }) => (
          <Input
            label="Email professionnel"
            placeholder="contact@moncommerce.com"
            value={value} onChangeText={onChange} onBlur={onBlur}
            error={errors.email?.message} leftIcon="mail"
            keyboardType="email-address"
            onFocus={() => scrollRef.current?.scrollTo({ y: 140, animated: true })}
          />
        )} />

        <View style={styles.toggleCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.toggleTitle}>Livraison disponible</Text>
            <Text style={styles.toggleSub}>Activez si vous proposez un service de livraison</Text>
          </View>
          <Switch value={deliveryAvailable} onValueChange={setDeliveryAvailable} trackColor={{ false: '#E5E7EB', true: '#FF6835' }} thumbColor="#fff" />
        </View>
      </ScrollView>

      {/* Footer toujours en bas — ne bouge jamais */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Suivant →" onPress={handleSubmit(onSubmit)} fullWidth size="lg" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepWrap: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#F8F7F4' },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 20 },
  toggleCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  toggleSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  footer: { backgroundColor: '#F8F7F4', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
});
