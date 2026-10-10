import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { SECTEURS } from '@/types';
import { useAuthStore } from '@/stores/authStore';

const ORANGE = '#FF6835';
const DARK   = '#1A1025';

// ── Schéma ────────────────────────────────────────────────────────────────────
const schema = z.object({
  name:     z.string().min(2, 'Le nom du commerce est requis (min 2 caractères)'),
  category: z.string().min(1, 'Veuillez choisir une catégorie'),
});
type FormData = z.infer<typeof schema>;

// ── Draft partagé entre toutes les étapes ─────────────────────────────────────
const registerDraft: Record<string, unknown> = {};
export { registerDraft };

export default function RegisterStep1() {
  const insets     = useSafeAreaInsets();
  const { profile } = useAuthStore();


  const handleCancel = () => {
    router.dismissAll();
    if ((profile as any)?.role === 'pro') {
      router.replace('/(pro)/dashboard' as any);
    } else {
      router.replace('/(client)/' as any);
    }
  };

  const {
    control, handleSubmit, setValue, watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', category: '' },
  });

  const selectedCategory = watch('category');

  const onSubmit = (data: FormData) => {
    const secteur = SECTEURS.find((s) => s.id === data.category);
    Object.assign(registerDraft, {
      name:          data.name,
      category:      data.category,
      category_icon: secteur?.emoji ?? '',
    });
    router.push('/(pro)/register/step2' as any);
  };

  return (
    <View style={s.root}>

      {/* ── Navbar sombre ── */}
      <View style={[s.navbar, { paddingTop: insets.top + 8 }]}>
        <View style={{ width: 40 }} />
        <Text style={s.navTitle}>Créer mon commerce</Text>
        <TouchableOpacity onPress={handleCancel} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </View>

      {/* ── Indicateur d'étape ── */}
      <View style={s.stepWrap}>
        <StepIndicator current={1} total={5} title="Informations de base" />
      </View>

      {/* ── Contenu défilant ── */}
      <ScrollView
        style={s.flex}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Nom du commerce */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIcon}>
              <Feather name="briefcase" size={15} color={ORANGE} />
            </View>
            <Text style={s.cardTitle}>Nom du commerce</Text>
          </View>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                placeholder="Ex : Chez Maman Restaurant"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
              />
            )}
          />
        </View>

        {/* Catégorie */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIcon}>
              <Feather name="grid" size={15} color={ORANGE} />
            </View>
            <Text style={s.cardTitle}>Secteur d'activité</Text>
          </View>
          <Text style={s.cardSub}>Choisissez la catégorie qui correspond à votre commerce</Text>

          {errors.category && (
            <View style={s.errorBox}>
              <Feather name="alert-circle" size={13} color="#EF4444" />
              <Text style={s.errorText}>{errors.category.message}</Text>
            </View>
          )}

          {/* Grille 2 colonnes */}
          <View style={s.catGrid}>
            {SECTEURS.map((sec) => {
              const active = selectedCategory === sec.id;
              return (
                <TouchableOpacity
                  key={sec.id}
                  style={[s.catCard, active && s.catCardActive]}
                  onPress={() => setValue('category', sec.id, { shouldValidate: true })}
                  activeOpacity={0.8}
                >
                  {active && (
                    <View style={s.checkmark}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}
                  <Text style={s.catEmoji}>{sec.emoji}</Text>
                  <Text style={[s.catLabel, active && s.catLabelActive]} numberOfLines={2}>
                    {sec.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Badge de sélection */}
          {selectedCategory && (
            <View style={s.selectedBadge}>
              <Text style={{ fontSize: 18 }}>
                {SECTEURS.find((sec) => sec.id === selectedCategory)?.emoji}
              </Text>
              <Text style={s.selectedBadgeText}>
                {SECTEURS.find((sec) => sec.id === selectedCategory)?.label} sélectionné
              </Text>
              <Feather name="check-circle" size={15} color="#22C55E" />
            </View>
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
  root:    { flex: 1, backgroundColor: '#F7F6F3' },
  flex:    { flex: 1 },

  // Navbar
  navbar:     { backgroundColor: DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 18 },
  backBtn:    { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  navTitle:   { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  cancelBtn:  { paddingHorizontal: 12, paddingVertical: 8 },
  cancelTxt:  { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },

  // Step indicator
  stepWrap: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },

  // Contenu
  content: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },

  // Cards
  card:       { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon:   { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center' },
  cardTitle:  { fontSize: 15, fontWeight: '800', color: '#111827' },
  cardSub:    { fontSize: 13, color: '#9CA3AF', lineHeight: 18, marginTop: -6 },

  // Erreur
  errorBox:  { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FECACA' },
  errorText: { fontSize: 13, color: '#EF4444' },

  // Grille catégories
  catGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 2 },
  catCard:        { width: '47%', borderRadius: 16, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#EFEFEF', backgroundColor: '#FAFAFA', position: 'relative' },
  catCardActive:  { borderColor: ORANGE, backgroundColor: '#FFF4EF', shadowColor: ORANGE, shadowOpacity: 0.1, shadowRadius: 8, elevation: 3 },
  checkmark:      { position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderRadius: 9, backgroundColor: ORANGE, alignItems: 'center', justifyContent: 'center' },
  catEmoji:       { fontSize: 32 },
  catLabel:       { fontSize: 12, fontWeight: '600', color: '#6B7280', textAlign: 'center', lineHeight: 16 },
  catLabelActive: { color: ORANGE },

  // Badge sélection
  selectedBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BBF7D0', marginTop: 2 },
  selectedBadgeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#166534' },

  // Footer
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EFEFEF' },
});
