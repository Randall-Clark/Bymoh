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
  const insets = useSafeAreaInsets();

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
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>

      {/* Header fixe */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* StepIndicator fixe */}
      <View style={styles.stepWrap}>
        <StepIndicator current={1} total={5} title="Informations de base" />
      </View>

      {/* Contenu défilant */}
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Nom du commerce */}
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, value, onBlur } }) => (
            <Input
              label="Nom du commerce *"
              placeholder="Ex : Chez Maman Restaurant"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={errors.name?.message}
              leftIcon="briefcase"
            />
          )}
        />

        {/* Catégorie */}
        <View style={styles.catSection}>
          <Text style={styles.catLabel}>Catégorie *</Text>
          <Text style={styles.catSub}>Choisissez le secteur d'activité de votre commerce</Text>

          {errors.category && (
            <View style={styles.errorBox}>
              <Feather name="alert-circle" size={13} color="#EF4444" />
              <Text style={styles.errorText}>{errors.category.message}</Text>
            </View>
          )}

          {/* Grille 2 colonnes avec emojis */}
          <View style={styles.catGrid}>
            {SECTEURS.map((s) => {
              const active = selectedCategory === s.id;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.catCard, active && styles.catCardActive]}
                  onPress={() => setValue('category', s.id, { shouldValidate: true })}
                  activeOpacity={0.8}
                >
                  {/* Coche de sélection */}
                  {active && (
                    <View style={styles.checkmark}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}

                  <Text style={styles.catEmoji}>{s.emoji}</Text>
                  <Text style={[styles.catCardLabel, active && styles.catCardLabelActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Résumé de la sélection */}
          {selectedCategory && (
            <View style={styles.selectedBadge}>
              <Text style={styles.selectedBadgeEmoji}>
                {SECTEURS.find((s) => s.id === selectedCategory)?.emoji}
              </Text>
              <Text style={styles.selectedBadgeText}>
                {SECTEURS.find((s) => s.id === selectedCategory)?.label} sélectionné
              </Text>
              <Feather name="check-circle" size={14} color="#22C55E" />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer fixe */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title="Suivant →"
          onPress={handleSubmit(onSubmit)}
          fullWidth
          size="lg"
        />
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
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 24 },

  // Catégorie
  catSection: { gap: 10 },
  catLabel: { fontSize: 13, fontWeight: '700', color: '#374151' },
  catSub: { fontSize: 12, color: '#9CA3AF', marginTop: -6 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#FECACA',
  },
  errorText: { fontSize: 13, color: '#EF4444' },

  // Grille 2 colonnes
  catGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  catCard: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 16, padding: 16,
    alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#E5E7EB',
    position: 'relative',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  catCardActive: {
    borderColor: '#FF6835',
    backgroundColor: '#FEF2EC',
    shadowColor: '#FF6835', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4,
  },
  checkmark: {
    position: 'absolute', top: 8, right: 8,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: '#FF6835',
    alignItems: 'center', justifyContent: 'center',
  },
  catEmoji: { fontSize: 32 },
  catCardLabel: {
    fontSize: 12, fontWeight: '600', color: '#6B7280',
    textAlign: 'center', lineHeight: 16,
  },
  catCardLabelActive: { color: '#FF6835' },

  // Badge sélection
  selectedBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  selectedBadgeEmoji: { fontSize: 18 },
  selectedBadgeText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#166534' },

  // Footer
  footer: {
    backgroundColor: '#F8F7F4',
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
});
