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
import { useAuthStore } from '@/stores/authStore';

const ORANGE = '#FF6835';
const DARK   = '#1A1025';

const schema = z.object({
  description:    z.string().min(20, 'Description trop courte (min 20 caractères)'),
  email:          z.string().email('Email invalide').optional().or(z.literal('')),
  delivery_price: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export default function RegisterStep4() {
  const insets        = useSafeAreaInsets();
  const scrollRef     = useRef<ScrollView>(null);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const { profile } = useAuthStore();
  const savedCity   = (registerDraft as any).city ?? null;

  const handleCancel = () => {
    router.dismissAll();
    if ((profile as any)?.role === 'pro') {
      router.replace('/(pro)/dashboard' as any);
    } else {
      router.replace('/(client)/' as any);
    }
  };

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { description: '', email: '', delivery_price: '' },
  });

  const onSubmit = (data: FormData) => {
    Object.assign(registerDraft, {
      ...data,
      has_delivery:   deliveryAvailable,
      delivery_price: deliveryAvailable ? (parseFloat(data.delivery_price ?? '0') || 0) : 0,
    });
    router.push('/(pro)/register/payment' as any);
  };

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
        <StepIndicator current={4} total={5} title="Description & services" />
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.flex}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Description */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIcon}><Feather name="file-text" size={15} color={ORANGE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Description du commerce</Text>
              <Text style={s.cardSub}>Décrivez votre activité et ce qui vous rend unique</Text>
            </View>
          </View>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                placeholder="Ex : Spécialiste de la restauration traditionnelle béninoise, plats faits maison chaque jour..."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.description?.message}
                multiline
                style={{ minHeight: 120 }}
                onFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
              />
            )}
          />
          <View style={s.charHint}>
            <Feather name="info" size={11} color="#9CA3AF" />
            <Text style={s.charHintText}>Minimum 20 caractères</Text>
          </View>
        </View>

        {/* Email professionnel */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIcon}><Feather name="mail" size={15} color={ORANGE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Email professionnel</Text>
              <Text style={s.cardSub}>Optionnel — affiché sur votre profil marchand</Text>
            </View>
          </View>
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                placeholder="contact@moncommerce.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                keyboardType="email-address"
                onFocus={() => scrollRef.current?.scrollTo({ y: 220, animated: true })}
              />
            )}
          />
        </View>

        {/* Livraison */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIcon}><Feather name="truck" size={15} color={ORANGE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Service de livraison</Text>
              <Text style={s.cardSub}>Activez si vous proposez la livraison à domicile</Text>
            </View>
            <Switch
              value={deliveryAvailable}
              onValueChange={setDeliveryAvailable}
              trackColor={{ false: '#E5E7EB', true: ORANGE }}
              thumbColor="#fff"
            />
          </View>

          {deliveryAvailable && (
            <>
              <View style={s.divider} />
              <Controller
                control={control}
                name="delivery_price"
                render={({ field: { onChange, value, onBlur } }) => (
                  <Input
                    label={`Frais de livraison${savedCity ? ` à ${savedCity}` : ''} (FCFA)`}
                    placeholder="Ex : 500"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    keyboardType="numeric"
                    leftIcon="tag"
                  />
                )}
              />
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button title="Suivant →" onPress={handleSubmit(onSubmit)} fullWidth size="lg" />
      </View>
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

  content: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },

  card:       { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon:   { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center' },
  cardTitle:  { fontSize: 15, fontWeight: '800', color: '#111827' },
  cardSub:    { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  charHint:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -6 },
  charHintText: { fontSize: 11, color: '#9CA3AF' },

  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: -18 },

  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EFEFEF' },
});
