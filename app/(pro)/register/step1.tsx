import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Image, Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import Animated, { SlideInRight, SlideInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Input } from '@/components/ui/Input';
import { useAuthStore } from '@/stores/authStore';
import { COUNTRIES, Country } from '@/lib/countries';
import { navDir } from '@/lib/navDir';

const ORANGE = '#FF6835';
const DARK   = '#1A1025';

const CATEGORIES = [
  { id: 'restaurant', value: 'Restaurants',  label: 'Restauration',           icon: require('@/assets/images/restaurant.png'),     desc: 'Restaurants, desserts, pâtisserie, boissons, jus' },
  { id: 'mode',       value: 'mode',          label: 'Mode & Accessoires',      icon: require('@/assets/images/fashions_icon.png'),   desc: 'Vêtements, chaussures, sacs, bijoux, montres' },
  { id: 'beaute',     value: 'beaute',        label: 'Beauté & Bien-être',      icon: require('@/assets/images/beaute_icon.png'),     desc: 'Coiffure, soins, cosmétiques, spa, massages' },
  { id: 'maison',     value: 'maison',        label: 'Maison & Électroménager', icon: require('@/assets/images/household_icon.png'),  desc: 'Meubles, électroménager, décoration, literie' },
  { id: 'tech',       value: 'tech',          label: 'Tech & Gadgets',          icon: require('@/assets/images/device_icon.png'),     desc: 'Téléphones, ordinateurs, accessoires, électronique' },
  { id: 'artisans',   value: 'artisans',      label: 'Artisans & Services',     icon: require('@/assets/images/proservice_icon.png'), desc: 'Plomberie, couture, imprimerie, réparations' },
];

const schema = z.object({
  name:     z.string().min(2, 'Le nom de la boutique est requis (min 2 caractères)'),
  category: z.string().min(1, 'Veuillez choisir une catégorie'),
});
type FormData = z.infer<typeof schema>;

const registerDraft: Record<string, unknown> = {};
export { registerDraft };

export default function RegisterStep1() {
  const insets      = useSafeAreaInsets();
  const { profile } = useAuthStore();

  const entering = navDir.current === 'back' ? SlideInLeft.duration(300) : SlideInRight.duration(300);
  navDir.current = 'forward';

  const [selectedCountry, setSelectedCountry] = useState<Country>(
    COUNTRIES.find((c) => c.code === (registerDraft as any).country_code) ?? COUNTRIES[0]
  );
  const [countryModal, setCountryModal] = useState(false);

  const [phoneNumber, setPhoneNumber] = useState(() => {
    const saved = (registerDraft as any).phone ?? '';
    for (const c of COUNTRIES) {
      if (c.dialCode && saved.startsWith(c.dialCode)) return saved.slice(c.dialCode.length);
    }
    return saved;
  });
  const [phoneError, setPhoneError] = useState('');

  const handleCancel = () => {
    router.dismissAll();
    if ((profile as any)?.role === 'pro') {
      router.replace('/(pro)/dashboard' as any);
    } else {
      router.replace('/(client)/' as any);
    }
  };

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:     (registerDraft as any).name          ?? '',
      category: (registerDraft as any).category_icon ?? '',
    },
  });

  const selectedCategory = watch('category');

  const onSubmit = (data: FormData) => {
    if (!phoneNumber || phoneNumber.length < 6) {
      setPhoneError('Numéro trop court');
      return;
    }
    setPhoneError('');
    const cat = CATEGORIES.find((c) => c.id === data.category);
    Object.assign(registerDraft, {
      name:          data.name,
      category:      cat?.value ?? data.category,
      category_icon: cat?.id ?? 'briefcase',
      phone:         `${selectedCountry.dialCode}${phoneNumber}`,
      country:       selectedCountry.name,
      country_code:  selectedCountry.code,
      timezone:      selectedCountry.timezone,
    });
    router.push('/(pro)/register/step2' as any);
  };

  return (
    <View style={s.root}>

      {/* ── Navbar ── */}
      <View style={[s.navbar, { paddingTop: insets.top + 8 }]}>
        <Text style={s.navTitle}>Créer mon commerce</Text>
        <TouchableOpacity onPress={handleCancel} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </View>

      {/* ── Step indicator ── */}
      <View style={s.stepWrap}>
        <StepIndicator current={1} total={5} title="Informations de base" />
      </View>

      {/* ── Zone animée ── */}
      <Animated.View style={s.flex} entering={entering}>
        <ScrollView
          style={s.flex}
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={s.flatCard}>

            {/* ── Pays ── */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Pays</Text>
              <TouchableOpacity style={s.countrySelector} onPress={() => setCountryModal(true)} activeOpacity={0.8}>
                <Text style={{ fontSize: 22 }}>{selectedCountry.flag}</Text>
                <Text style={s.countrySelectorName}>{selectedCountry.name}</Text>
                <Text style={s.countrySelectorDial}>{selectedCountry.dialCode}</Text>
                <Feather name="chevron-down" size={15} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={s.sep} />

            {/* ── Nom de la boutique ── */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Nom de votre boutique</Text>
              <Controller
                control={control}
                name="name"
                render={({ field: { onChange, value, onBlur } }) => (
                  <Input
                    placeholder="Ex : Ma boutique"
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    error={errors.name?.message}
                  />
                )}
              />
            </View>

            <View style={s.sep} />

            {/* ── Téléphone ── */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Téléphone professionel</Text>
              <View style={s.phoneRow}>
                <View style={s.dialBadge}>
                  <Text style={{ fontSize: 18 }}>{selectedCountry.flag}</Text>
                  <Text style={s.dialBadgeCode}>{selectedCountry.dialCode}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Input
                    placeholder="XX XX XX XX"
                    value={phoneNumber}
                    onChangeText={(t) => { setPhoneNumber(t.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }}
                    keyboardType="number-pad"
                    maxLength={10}
                    error={phoneError}
                  />
                </View>
              </View>
            </View>

            <View style={s.sep} />

            {/* ── Secteur d'activité ── */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Secteur d'activité</Text>
              <Text style={s.fieldSub}>Choisissez la catégorie qui correspond à votre boutique</Text>
              {errors.category && (
                <View style={s.errorBox}>
                  <Feather name="alert-circle" size={13} color="#EF4444" />
                  <Text style={s.errorText}>{errors.category.message}</Text>
                </View>
              )}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.catScroll}
              >
                {CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[s.catCard, active && s.catCardActive]}
                      onPress={() => setValue('category', cat.id, { shouldValidate: true })}
                      activeOpacity={0.8}
                    >
                      {active && (
                        <View style={s.checkmark}>
                          <Feather name="check" size={10} color="#fff" />
                        </View>
                      )}
                      <Image source={cat.icon} style={s.catIcon} resizeMode="contain" />
                      <Text style={[s.catLabel, active && s.catLabelActive]}>{cat.label}</Text>
                      <Text style={[s.catDesc, active && s.catDescActive]}>{cat.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

          </View>
        </ScrollView>

        {/* ── Footer ── */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity style={s.nextBtn} onPress={handleSubmit(onSubmit)} activeOpacity={0.85}>
            <Text style={s.nextBtnTxt}>Suivant</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── Modal choix de pays ── */}
      <Modal visible={countryModal} transparent animationType="slide" onRequestClose={() => setCountryModal(false)}>
        <TouchableWithoutFeedback onPress={() => setCountryModal(false)}>
          <View style={s.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={[s.modalBox, { paddingBottom: insets.bottom + 8 }]}>
                <View style={s.modalHandle} />
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Choisir le pays</Text>
                  <TouchableOpacity onPress={() => setCountryModal(false)}>
                    <Feather name="x" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {COUNTRIES.map((c) => {
                    const active = c.code === selectedCountry.code;
                    return (
                      <TouchableOpacity
                        key={c.code}
                        style={[s.countryItem, active && s.countryItemActive]}
                        onPress={() => { setSelectedCountry(c); setCountryModal(false); }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 24 }}>{c.flag}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.countryItemName, active && { color: ORANGE }]}>{c.name}</Text>
                          <Text style={s.countryItemDial}>{c.dialCode}</Text>
                        </View>
                        {active && <Feather name="check-circle" size={18} color={ORANGE} />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
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

  content: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },

  /* ── Carte plate ── */
  flatCard:   { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  fieldGroup: { paddingHorizontal: 18, paddingVertical: 16, gap: 10 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', letterSpacing: 0.1 },
  fieldSub:   { fontSize: 12, color: '#9CA3AF', marginTop: -4 },
  sep:        { height: 1, backgroundColor: '#F3F4F6' },

  /* ── Sélecteur de pays ── */
  countrySelector:     { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E5E7EB' },
  countrySelectorName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  countrySelectorDial: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },

  /* ── Téléphone ── */
  phoneRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dialBadge:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13, backgroundColor: '#F7F6F3', borderWidth: 1, borderColor: '#E5E7EB' },
  dialBadgeCode: { fontSize: 13, fontWeight: '700', color: '#374151' },

  /* ── Erreur ── */
  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { fontSize: 13, color: '#EF4444' },

  /* ── Catégories ── */
  catScroll:      { gap: 10, paddingVertical: 4, paddingHorizontal: 2 },
  catCard:        { width: 140, borderRadius: 16, padding: 14, gap: 6, borderWidth: 1.5, borderColor: '#EFEFEF', backgroundColor: '#FAFAFA', position: 'relative' },
  catCardActive:  { borderColor: ORANGE, backgroundColor: '#FFF4EF' },
  checkmark:      { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  catIcon:        { width: 40, height: 40, marginBottom: 2 },
  catLabel:       { fontSize: 13, fontWeight: '700', color: '#374151', lineHeight: 18 },
  catLabelActive: { color: ORANGE },
  catDesc:        { fontSize: 11, color: '#9CA3AF', lineHeight: 16 },
  catDescActive:  { color: '#F97316' },

  /* ── Footer ── */
  footer:     { backgroundColor: 'transparent', paddingHorizontal: 20, paddingTop: 14, alignItems: 'center' },
  nextBtn:    { backgroundColor: ORANGE, borderRadius: 14, paddingHorizontal: 36, paddingVertical: 13 },
  nextBtnTxt: { fontSize: 15, fontWeight: '700', color: '#fff' },

  /* ── Modal pays ── */
  modalBackdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalBox:        { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '72%' },
  modalHandle:     { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  modalTitle:      { fontSize: 16, fontWeight: '700', color: '#111827' },
  countryItem:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  countryItemActive: { backgroundColor: '#FFF4EF' },
  countryItemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  countryItemDial: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
});
