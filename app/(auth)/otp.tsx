import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
import { sendOTP, verifyOTP } from '@/lib/supabase';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60;

export default function OTPScreen() {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = () => {
    setCountdown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  useEffect(() => {
    startCountdown();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleVerify = async (value = code) => {
    if (value.length < CODE_LENGTH) return;
    setLoading(true);
    try {
      await verifyOTP(phone ?? '', value);
      // Explicit navigation to profile completion (new account flow)
      router.replace('/(auth)/complete-profile');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Code incorrect';
      Alert.alert('Erreur', msg);
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResendLoading(true);
    try {
      await sendOTP(phone ?? '');
      startCountdown();
      setCode('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors du renvoi';
      Alert.alert('Erreur', msg);
    } finally {
      setResendLoading(false);
    }
  };

  const maskedPhone = phone
    ? phone.replace(/(\+\d{3})(\d{2})(\d+)(\d{2})/, '$1 $2 **** $4')
    : '';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
      {/* Back */}
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Feather name="arrow-left" size={22} color="#111827" />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Feather name="message-square" size={30} color="#FF6835" />
          </View>
          <Text style={styles.title}>Code envoyé</Text>
          <Text style={styles.subtitle}>
            Entrez le code à {CODE_LENGTH} chiffres envoyé au{'\n'}
            <Text style={styles.phone}>{maskedPhone}</Text>
          </Text>
        </View>

        <OTPInput
          length={CODE_LENGTH}
          value={code}
          onChange={setCode}
          onComplete={handleVerify}
          loading={loading}
        />

        <Button
          title={loading ? 'Vérification…' : 'Confirmer'}
          onPress={() => handleVerify()}
          loading={loading}
          disabled={code.length < CODE_LENGTH}
          fullWidth
          size="lg"
        />

        {/* Resend */}
        <View style={styles.resendRow}>
          {countdown > 0 ? (
            <Text style={styles.resendCountdown}>
              Renvoyer le code dans <Text style={styles.orange}>{countdown}s</Text>
            </Text>
          ) : (
            <TouchableOpacity onPress={handleResend} disabled={resendLoading}>
              <Text style={[styles.resendLink, resendLoading && { opacity: 0.5 }]}>
                {resendLoading ? 'Envoi…' : 'Renvoyer le code'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.notice}>
          Vous n'avez pas reçu le code ? Vérifiez votre dossier spam ou assurez-vous que votre numéro est correct.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4', paddingHorizontal: 24, gap: 8 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 28, paddingTop: 16 },
  header: { gap: 10 },
  iconWrap: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: '#FEF2EC',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  phone: { fontWeight: '700', color: '#111827' },
  resendRow: { alignItems: 'center' },
  resendCountdown: { fontSize: 14, color: '#6B7280' },
  orange: { color: '#FF6835', fontWeight: '700' },
  resendLink: { fontSize: 14, color: '#FF6835', fontWeight: '700' },
  notice: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
});
