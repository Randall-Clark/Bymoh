import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { OTPInput } from '@/components/forms/OTPInput';
import { setPIN } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';

const PIN_LENGTH = 6;

type Step = 'create' | 'confirm';

export default function SetPINScreen() {
  const insets = useSafeAreaInsets();
  const { session, setProfile, profile } = useAuthStore();

  const [step, setStep] = useState<Step>('create');
  const [firstPIN, setFirstPIN] = useState('');
  const [confirmPIN, setConfirmPIN] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFirstComplete = (value: string) => {
    if (value.length === PIN_LENGTH) {
      setFirstPIN(value);
      setStep('confirm');
    }
  };

  const handleConfirmComplete = async (value: string) => {
    if (value.length < PIN_LENGTH) return;
    if (value !== firstPIN) {
      Alert.alert('NIP incorrect', 'Les deux NIP ne correspondent pas. Recommencez.');
      setFirstPIN('');
      setConfirmPIN('');
      setStep('create');
      return;
    }
    await handleSave(value);
  };

  const handleSave = async (pin: string) => {
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      await setPIN(session.user.id, pin);
      if (profile) {
        setProfile({ ...profile, pin_hash: 'configured' });
      }
      router.replace('/(client)');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la configuration du NIP';
      Alert.alert('Erreur', msg);
      setFirstPIN('');
      setConfirmPIN('');
      setStep('create');
    } finally {
      setLoading(false);
    }
  };

  const isCreate = step === 'create';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
      {isCreate ? null : (
        <TouchableOpacity style={styles.back} onPress={() => { setStep('create'); setFirstPIN(''); setConfirmPIN(''); }}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Feather name="lock" size={30} color="#FF6835" />
          </View>
          {isCreate ? (
            <>
              <Text style={styles.title}>Créez votre NIP</Text>
              <Text style={styles.subtitle}>
                Choisissez un code à {PIN_LENGTH} chiffres.{'\n'}
                Vous l'utiliserez à chaque connexion.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>Confirmez votre NIP</Text>
              <Text style={styles.subtitle}>
                Saisissez à nouveau votre NIP{'\n'}pour le confirmer.
              </Text>
            </>
          )}
        </View>

        {/* Step indicator */}
        <View style={styles.steps}>
          <View style={[styles.stepDot, styles.stepDotActive]} />
          <View style={[styles.stepLine, !isCreate && styles.stepLineActive]} />
          <View style={[styles.stepDot, !isCreate && styles.stepDotActive]} />
        </View>

        {isCreate ? (
          <OTPInput
            key="create"
            length={PIN_LENGTH}
            value={firstPIN}
            onChange={setFirstPIN}
            onComplete={handleFirstComplete}
            secureTextEntry
          />
        ) : (
          <OTPInput
            key="confirm"
            length={PIN_LENGTH}
            value={confirmPIN}
            onChange={setConfirmPIN}
            onComplete={handleConfirmComplete}
            secureTextEntry
          />
        )}

        {!isCreate && (
          <Button
            title={loading ? 'Enregistrement…' : 'Valider le NIP'}
            onPress={() => handleConfirmComplete(confirmPIN)}
            loading={loading}
            disabled={confirmPIN.length < PIN_LENGTH}
            fullWidth
            size="lg"
          />
        )}

        <Text style={styles.notice}>
          Ne partagez jamais votre NIP. Bymoh ne vous le demandera jamais.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4', paddingHorizontal: 24, gap: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 32, paddingTop: 16 },
  header: { gap: 12 },
  iconWrap: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: '#FEF2EC',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  stepDot: {
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#E5E7EB',
  },
  stepDotActive: { backgroundColor: '#FF6835' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 4 },
  stepLineActive: { backgroundColor: '#FF6835' },
  notice: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
});
