import { router, useLocalSearchParams } from 'expo-router';
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
import { OTPInput } from '@/components/forms/OTPInput';
import { signInWithPIN } from '@/lib/supabase';

const PIN_LENGTH = 6;

export default function PINLoginScreen() {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleComplete = async (value: string) => {
    if (value.length < PIN_LENGTH) return;
    setLoading(true);
    try {
      await signInWithPIN(phone ?? '', value);
      // onAuthStateChange in useAuth handles routing via AuthGuard
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'NIP incorrect';
      Alert.alert('NIP incorrect', msg === 'Invalid login credentials'
        ? 'Le NIP saisi est incorrect. Réessayez.'
        : msg);
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = phone
    ? phone.replace(/(\+\d{3})(\d{2})(\d+)(\d{2})/, '$1 $2 **** $4')
    : '';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}>
        <Feather name="arrow-left" size={22} color="#111827" />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Feather name="lock" size={30} color="#1E3A5F" />
          </View>
          <Text style={styles.title}>Entrez votre NIP</Text>
          <Text style={styles.subtitle}>
            Compte associé au{'\n'}
            <Text style={styles.phone}>{maskedPhone}</Text>
          </Text>
        </View>

        <OTPInput
          length={PIN_LENGTH}
          value={pin}
          onChange={setPin}
          onComplete={handleComplete}
          secureTextEntry
          loading={loading}
        />

        <Text style={styles.notice}>
          Vous avez oublié votre NIP ?{' '}
          <Text
            style={styles.link}
            onPress={() => router.push({ pathname: '/(auth)/phone', params: { mode: 'signup' } })}
          >
            Recréez votre compte
          </Text>
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
    width: 60, height: 60, borderRadius: 18, backgroundColor: '#EEF2FF',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  phone: { fontWeight: '700', color: '#111827' },
  notice: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', lineHeight: 20 },
  link: { color: '#FF6835', fontWeight: '600' },
});
