import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

const schema = z.object({
  name: z.string().min(2, 'Nom complet requis (min 2 caractères)'),
});
type FormData = z.infer<typeof schema>;

export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, setProfile } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  const onSubmit = async (data: FormData) => {
    if (!session?.user) return;
    setLoading(true);
    try {
      const userData = {
        id: session.user.id,
        phone: session.user.phone ?? '',
        name: data.name.trim(),
        role: 'client' as const,
        is_active: true,
        pin_hash: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('users')
        .upsert(userData, { onConflict: 'id' });

      if (error) throw error;

      setProfile(userData);
      // Redirect to PIN setup (not directly to app)
      router.replace('/(auth)/set-pin');
    } catch (err: unknown) {
      // Supabase PostgrestError is not instanceof Error — extract message explicitly
      let msg = 'Erreur lors de la création du profil';
      if (err && typeof err === 'object') {
        const e = err as Record<string, unknown>;
        msg = (typeof e.message === 'string' ? e.message : null)
          ?? (typeof e.details === 'string' ? e.details : null)
          ?? (typeof e.code === 'string' ? `code: ${e.code}` : null)
          ?? msg;
      }
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>Bienvenue !</Text>
          <Text style={styles.subtitle}>
            Comment souhaitez-vous être appelé(e) sur Bymoh ?
          </Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, value, onBlur } }) => (
              <Input
                label="Nom complet"
                placeholder="Ex: Kofi Mensah"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
                leftIcon="user"
                autoCapitalize="words"
              />
            )}
          />
        </View>

        <Button
          title="Continuer"
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          fullWidth
          size="lg"
        />

        <Text style={styles.step}>Étape 2 sur 3</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F7F4' },
  content: { paddingHorizontal: 24, gap: 28 },
  header: { gap: 10, alignItems: 'center' },
  emoji: { fontSize: 60 },
  title: { fontSize: 30, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  form: { gap: 16 },
  step: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});
