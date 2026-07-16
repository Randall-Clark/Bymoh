import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import type { CatalogItem } from '@/types';

const schema = z.object({
  title: z.string().min(2, 'Nom requis'),
  description: z.string().optional(),
  price: z.string().min(1, 'Prix requis').regex(/^\d+$/, 'Chiffres seulement'),
  allows_booking: z.boolean(),
});
type FormData = z.infer<typeof schema>;

export default function CatalogEditScreen() {
  const insets = useSafeAreaInsets();
  const { bizId, itemId } = useLocalSearchParams<{ bizId: string; itemId?: string }>();
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', price: '', allows_booking: false },
  });
  const allowsBooking = watch('allows_booking');

  useEffect(() => {
    if (itemId) {
      supabase.from('services').select('*').eq('id', itemId).single().then(({ data }) => {
        if (data) {
          const item = data as CatalogItem;
          setValue('title', item.title);
          setValue('description', item.description ?? '');
          setValue('price', item.price.toString());
          setValue('allows_booking', item.allows_booking);
        }
      });
    }
  }, [itemId]);

  const onSubmit = async (data: FormData) => {
    if (!bizId) { Alert.alert('Erreur', 'Commerce non trouvé'); return; }
    setLoading(true);
    try {
      const payload = {
        business_id: bizId,
        title: data.title.trim(),
        description: data.description?.trim() ?? '',
        price: parseInt(data.price, 10),
        currency: 'XOF',
        allows_booking: data.allows_booking,
        is_available: true,
        show_stock: false,
      };
      if (itemId) {
        const { error } = await supabase.from('services').update(payload).eq('id', itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('services').insert(payload);
        if (error) throw error;
      }
      router.back();
    } catch (err: unknown) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
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
        <Text style={styles.title}>{itemId ? "Modifier l'article" : 'Nouvel article'}</Text>
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}>
        {/* Type selector */}
        <View style={styles.typeSection}>
          <Text style={styles.typeLabel}>Type *</Text>
          <View style={styles.typeRow}>
            {([false, true] as const).map((isBooking) => (
              <TouchableOpacity
                key={String(isBooking)}
                style={[styles.typeBtn, allowsBooking === isBooking && styles.typeBtnActive]}
                onPress={() => setValue('allows_booking', isBooking)}
              >
                <Feather name={!isBooking ? 'package' : 'briefcase'} size={18} color={allowsBooking === isBooking ? '#fff' : '#6B7280'} />
                <Text style={[styles.typeBtnText, allowsBooking === isBooking && { color: '#fff' }]}>
                  {!isBooking ? 'Produit' : 'Service'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Controller control={control} name="title" render={({ field: { onChange, value, onBlur } }) => (
          <Input label="Nom *" placeholder={allowsBooking ? 'Ex: Coupe femme' : 'Ex: Thiéboudienne'} value={value} onChangeText={onChange} onBlur={onBlur} error={errors.title?.message} />
        )} />

        <Controller control={control} name="description" render={({ field: { onChange, value, onBlur } }) => (
          <Input label="Description" placeholder="Décrivez l'article..." value={value ?? ''} onChangeText={onChange} onBlur={onBlur} multiline />
        )} />

        <Controller control={control} name="price" render={({ field: { onChange, value, onBlur } }) => (
          <Input label="Prix (FCFA) *" placeholder="Ex: 5000" value={value} onChangeText={onChange} onBlur={onBlur} error={errors.price?.message} keyboardType="number-pad" leftIcon="tag" />
        )} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title={loading ? 'Enregistrement…' : itemId ? 'Mettre à jour' : 'Ajouter au catalogue'}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 20 },
  typeSection: { gap: 8 },
  typeLabel: { fontSize: 13, fontWeight: '600', color: '#374151' },
  typeRow: { flexDirection: 'row', gap: 12 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff' },
  typeBtnActive: { backgroundColor: '#FF6835', borderColor: '#FF6835' },
  typeBtnText: { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
});
