// app/(auth)/otp.tsx
// Vérification OTP pour l'inscription
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function OtpScreen() {
  const insets = useSafeAreaInsets();
  const { phone, country_code, country_name, timezone, mode } =
    useLocalSearchParams<{
      phone:        string;
      country_code: string;
      country_name: string;
      timezone:     string;
      mode:         string;
    }>();

  const [otp,       setOtp]       = useState('');
  const [loading,   setLoading]   = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const inputRef = useRef<TextInput>(null);

  // Compte à rebours pour renvoyer l'OTP
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const resendOtp = async () => {
    if (countdown > 0 || !phone) return;
    setResending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setCountdown(60);
      Alert.alert('Code envoyé', 'Un nouveau code a été envoyé.');
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de renvoyer le code.');
    } finally {
      setResending(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length < 4 || !phone) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone, token: otp, type: 'sms',
      });
      if (error) throw error;

      // OTP vérifié → aller à la création du profil
      router.replace({
        pathname: '/(auth)/signup' as any,
        params: { phone, country_code, country_name, timezone },
      });
    } catch (e: any) {
      Alert.alert('Code invalide', e.message ?? 'Le code entré est incorrect. Réessayez.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone = phone
    ? phone.replace(/(\+\d{3})(\d{2})(\d+)(\d{2})$/, '$1 $2 **** $4')
    : '';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: Platform.OS === 'web' ? 67 : insets.top + 20 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity onPress={() => router.back()} style={styles.back}>
        <Feather name="arrow-left" size={22} color="#111827" />
      </TouchableOpacity>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Feather name="message-circle" size={32} color="#FF6835" />
        </View>

        <Text style={styles.title}>Vérification SMS</Text>
        <Text style={styles.subtitle}>
          Entrez le code à 6 chiffres envoyé au{'\n'}
          <Text style={styles.phone}>{maskedPhone}</Text>
        </Text>

        {/* Champ OTP */}
        <TextInput
          ref={inputRef}
          style={styles.otpInput}
          value={otp}
          onChangeText={(t) => {
            setOtp(t.replace(/\D/g, '').slice(0, 6));
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          placeholder="• • • • • •"
          placeholderTextColor="#D1D5DB"
          onSubmitEditing={verifyOtp}
        />

        {/* Bouton vérifier */}
        <TouchableOpacity
          style={[styles.btn, (otp.length < 4 || loading) && styles.btnDisabled]}
          onPress={verifyOtp}
          disabled={otp.length < 4 || loading}
          activeOpacity={0.88}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Vérifier</Text>}
        </TouchableOpacity>

        {/* Renvoyer le code */}
        <TouchableOpacity
          onPress={resendOtp}
          disabled={countdown > 0 || resending}
          style={styles.resendRow}
        >
          {resending
            ? <ActivityIndicator size="small" color="#FF6835" />
            : <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
                {countdown > 0
                  ? `Renvoyer dans ${countdown}s`
                  : 'Renvoyer le code'}
              </Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1, backgroundColor: '#F8F7F4', paddingHorizontal: 24 },
  back:         { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content:      { flex: 1, gap: 20, paddingTop: 20 },
  iconWrap:     { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  title:        { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle:     { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  phone:        { fontWeight: '700', color: '#111827' },
  otpInput:     { backgroundColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 20, paddingVertical: 18, fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: 10, textAlign: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  btn:          { backgroundColor: '#FF6835', borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#FF6835', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnDisabled:  { backgroundColor: '#D1D5DB', shadowOpacity: 0, elevation: 0 },
  btnText:      { fontSize: 16, fontWeight: '700', color: '#fff' },
  resendRow:    { alignItems: 'center', paddingVertical: 8 },
  resendText:   { fontSize: 14, fontWeight: '600', color: '#FF6835' },
  resendTextDisabled: { color: '#9CA3AF' },
});
