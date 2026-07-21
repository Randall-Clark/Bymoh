import { zodResolver } from '@hookform/resolvers/zod';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { z } from 'zod';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { OTPInput } from '@/components/forms/OTPInput';
import { api, saveApiToken, normalizeProfile } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

const schema = z.object({
  name: z.string().min(2, 'Nom complet requis (minimum 2 caractères)'),
});
type FormData = z.infer<typeof schema>;

const PIN_LENGTH = 6;
type Step = 'name' | 'pin' | 'confirm';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const { setToken, setProfile } = useAuthStore();

  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [firstPin, setFirstPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  const onNameSubmit = (data: FormData) => {
    setName(data.name.trim());
    setStep('pin');
  };

  const handleFirstPin = (value: string) => {
    if (value.length === PIN_LENGTH) {
      setFirstPin(value);
      setStep('confirm');
    }
  };

  const handleConfirmPin = async (value: string) => {
    if (value.length < PIN_LENGTH) return;
    if (value !== firstPin) {
      Alert.alert('NIP incorrect', 'Les deux NIP ne correspondent pas. Recommencez.');
      setFirstPin('');
      setConfirmPin('');
      setStep('pin');
      return;
    }
    setLoading(true);
    try {
      const result = await api.post<{ token: string; user: Record<string, unknown> }>(
        '/auth/register',
        { phone: phone ?? '', name, pin: value },
      );
      await saveApiToken(result.token);
      setToken(result.token);
      setProfile(normalizeProfile(result.user));
      router.replace('/(client)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la création du compte';
      Alert.alert('Erreur', msg);
      setFirstPin('');
      setConfirmPin('');
      setStep('pin');
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = phone
    ? phone.replace(/(\+\d{3})(\d{2})(\d+)(\d{2})/, '$1 $2 **** $4')
    : '';

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.back}
          onPress={() => {
            if (step === 'confirm') { setStep('pin'); setConfirmPin(''); }
            else if (step === 'pin') { setStep('name'); setFirstPin(''); }
            else router.back();
          }}
        >
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>

        {/* Step indicator */}
        <View style={styles.steps}>
          {(['name', 'pin', 'confirm'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <View style={[styles.stepDot, step === s && styles.stepDotActive,
                (step === 'pin' && i === 0) || (step === 'confirm' && i <= 1) ? styles.stepDotDone : null,
              ]} />
              {i < 2 && <View style={[styles.stepLine,
                (step === 'pin' && i === 0) || (step === 'confirm' && i === 0) ? styles.stepLineDone : null,
                step === 'confirm' && i === 1 ? styles.stepLineActive : null,
              ]} />}
            </React.Fragment>
          ))}
        </View>

        {/* ── STEP 1: Name ── */}
        {step === 'name' && (
          <View style={styles.section}>
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <Feather name="user" size={28} color="#FF6835" />
              </View>
              <Text style={styles.title}>Votre nom</Text>
              <Text style={styles.subtitle}>
                Comment souhaitez-vous être appelé(e) sur Bymoh ?
              </Text>
            </View>

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
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onNameSubmit)}
                />
              )}
            />

            <Text style={styles.phone}>
              <Feather name="phone" size={13} color="#9CA3AF" /> {maskedPhone}
            </Text>

            <Button
              title="Continuer"
              onPress={handleSubmit(onNameSubmit)}
              fullWidth
              size="lg"
            />
          </View>
        )}

        {/* ── STEP 2: Create PIN ── */}
        {step === 'pin' && (
          <View style={styles.section}>
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <Feather name="lock" size={28} color="#FF6835" />
              </View>
              <Text style={styles.title}>Créez votre NIP</Text>
              <Text style={styles.subtitle}>
                Choisissez un code à 6 chiffres.{'\n'}Vous l'utiliserez à chaque connexion.
              </Text>
            </View>

            <OTPInput
              key="create"
              length={PIN_LENGTH}
              value={firstPin}
              onChange={setFirstPin}
              onComplete={handleFirstPin}
              secureTextEntry
            />
          </View>
        )}

        {/* ── STEP 3: Confirm PIN ── */}
        {step === 'confirm' && (
          <View style={styles.section}>
            <View style={styles.header}>
              <View style={styles.iconWrap}>
                <Feather name="check-circle" size={28} color="#FF6835" />
              </View>
              <Text style={styles.title}>Confirmez votre NIP</Text>
              <Text style={styles.subtitle}>
                Saisissez à nouveau votre NIP pour le confirmer.
              </Text>
            </View>

            <OTPInput
              key="confirm"
              length={PIN_LENGTH}
              value={confirmPin}
              onChange={setConfirmPin}
              onComplete={handleConfirmPin}
              secureTextEntry
              loading={loading}
            />

            <Button
              title={loading ? 'Création du compte…' : 'Créer mon compte'}
              onPress={() => handleConfirmPin(confirmPin)}
              loading={loading}
              disabled={confirmPin.length < PIN_LENGTH}
              fullWidth
              size="lg"
            />
          </View>
        )}

        <Text style={styles.notice}>
          Ne partagez jamais votre NIP. Bymoh ne vous le demandera jamais.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F7F4' },
  content: { paddingHorizontal: 24, gap: 24 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  stepDot: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: '#E5E7EB',
  },
  stepDotActive: { backgroundColor: '#FF6835', width: 14, height: 14, borderRadius: 7 },
  stepDotDone: { backgroundColor: '#10B981' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  stepLineDone: { backgroundColor: '#10B981' },
  stepLineActive: { backgroundColor: '#FF6835' },
  section: { gap: 24 },
  header: { gap: 10 },
  iconWrap: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: '#FEF2EC',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  phone: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  notice: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
});
