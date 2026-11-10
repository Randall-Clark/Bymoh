import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import Animated, { SlideInRight, SlideInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Input } from '@/components/ui/Input';
import { registerDraft } from './step1';
import { useAuthStore } from '@/stores/authStore';
import { navDir } from '@/lib/navDir';

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
  const [deliveryAvailable, setDeliveryAvailable] = useState((registerDraft as any).has_delivery ?? false);
  const { profile } = useAuthStore();
  const savedCity   = (registerDraft as any).city ?? null;

  const entering = navDir.current === 'back' ? SlideInLeft.duration(300) : SlideInRight.duration(300);
  navDir.current = 'forward';
  const goBack = () => {
    navDir.current = 'back';
    router.replace('/(pro)/register/step3' as any);
  };

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
    defaultValues: {
      description:    (registerDraft as any).description    ?? '',
      email:          (registerDraft as any).email          ?? '',
      delivery_price: (registerDraft as any).delivery_price != null
        ? String((registerDraft as any).delivery_price)
        : '',
    },
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

      {/* ── Navbar sombre (fixe) ── */}
      <View style={[s.navbar, { paddingTop: insets.top + 8 }]}>
        <Text style={s.navTitle}>Créer mon commerce</Text>
        <TouchableOpacity onPress={handleCancel} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </View>

      {/* ── Indicateur d'étape (fixe) ── */}
      <View style={s.stepWrap}>
        <StepIndicator current={4} total={5} title="Description & services" />
      </View>

      {/* ── Zone animée ── */}
      <Animated.View style={s.flex} entering={entering}>

        <ScrollView
          ref={scrollRef}
          style={s.flex}
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Une seule carte plate */}
          <View style={s.flatCard}>

            {/* ── Description ── */}
            <View style={s.fieldGroup}>
              <View style={s.sectionHeader}>
                <View style={s.sectionIcon}><Feather name="file-text" size={14} color={ORANGE} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>Description du commerce</Text>
                  <Text style={s.sectionSub}>Décrivez votre activité et ce qui vous rend unique</Text>
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
                    style={{ minHeight: 110 }}
                    onFocus={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
                  />
                )}
              />
              <View style={s.charHint}>
                <Feather name="info" size={11} color="#9CA3AF" />
                <Text style={s.charHintText}>Minimum 20 caractères</Text>
              </View>
            </View>

            <View style={s.sep} />

            {/* ── Email professionnel ── */}
            <View style={s.fieldGroup}>
              <View style={s.sectionHeader}>
                <View style={s.sectionIcon}><Feather name="mail" size={14} color={ORANGE} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>Email professionnel</Text>
                  <Text style={s.sectionSub}>Optionnel — affiché sur votre profil marchand</Text>
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

            <View style={s.sep} />

            {/* ── Service de livraison ── */}
            <View style={s.fieldGroup}>
              <View style={s.sectionHeader}>
                <View style={s.sectionIcon}><Feather name="truck" size={14} color={ORANGE} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>Service de livraison</Text>
                  <Text style={s.sectionSub}>Activez si vous proposez la livraison à domicile</Text>
                </View>
                <Switch
                  value={deliveryAvailable}
                  onValueChange={setDeliveryAvailable}
                  trackColor={{ false: '#E5E7EB', true: ORANGE }}
                  thumbColor="#fff"
                />
              </View>

              {deliveryAvailable && (
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
              )}
            </View>

          </View>
        </ScrollView>

        {/* ── Footer ── */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.footerRow}>
            <TouchableOpacity style={s.prevBtn} onPress={goBack} activeOpacity={0.8}>
              <Feather name="arrow-left" size={15} color="#6B7280" />
              <Text style={s.prevBtnTxt}>Précédent (3/5)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.nextBtn} onPress={handleSubmit(onSubmit)} activeOpacity={0.85}>
              <Text style={s.nextBtnTxt}>Suivant</Text>
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
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

  content: { paddingHorizontal: 16, paddingTop: 18 },

  flatCard:   { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  fieldGroup: { paddingHorizontal: 18, paddingVertical: 16, gap: 12 },
  sep:        { height: 1, backgroundColor: '#F3F4F6' },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon:   { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center' },
  sectionTitle:  { fontSize: 14, fontWeight: '800', color: '#111827' },
  sectionSub:    { fontSize: 12, color: '#9CA3AF', marginTop: 1 },

  charHint:     { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: -4 },
  charHintText: { fontSize: 11, color: '#9CA3AF' },

  footer:    { backgroundColor: 'transparent', paddingHorizontal: 20, paddingTop: 14 },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prevBtn:   { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9F8F6' },
  prevBtnTxt: { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  nextBtn:   { flex: 1, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  nextBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
