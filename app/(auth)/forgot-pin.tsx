// app/(auth)/forgot-pin.tsx
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { OTPInput } from '@/components/forms/OTPInput';

type Step = 'send' | 'otp' | 'newPin' | 'confirm' | 'success';

export default function ForgotPinScreen() {
  const insets = useSafeAreaInsets();
  const { phone } = useLocalSearchParams<{ phone: string }>();

  const [step,       setStep]       = useState<Step>('send');
  const [otp,        setOtp]        = useState('');
  const [newPin,     setNewPin]     = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading,    setLoading]    = useState(false);
  const [countdown,  setCountdown]  = useState(0);

  // Compte à rebours pour renvoyer le SMS
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const maskedPhone = phone
    ? phone.replace(/(\+\d{3})(\d{2})(\d+)(\d{2})$/, '$1 $2 **** $4')
    : '';

  // ── Étape 1 : Envoyer l'OTP ───────────────────────────────────────────────
  const sendOtp = async () => {
    if (!phone) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setStep('otp');
      setCountdown(60);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible d\'envoyer le code.');
    } finally {
      setLoading(false);
    }
  };

  // ── Étape 2 : Vérifier l'OTP ─────────────────────────────────────────────
  const verifyOtp = async (value: string) => {
    if (value.length < 4 || !phone) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone, token: value, type: 'sms',
      });
      if (error) throw error;
      setStep('newPin');
    } catch (e: any) {
      Alert.alert('Code invalide', e.message ?? 'Code incorrect. Réessayez.');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  // ── Étape 3 : Nouveau NIP ─────────────────────────────────────────────────
  const handleNewPin = (value: string) => {
    if (value.length === 6) {
      setNewPin(value);
      setStep('confirm');
    }
  };

  // ── Étape 4 : Confirmer et enregistrer ───────────────────────────────────
  const handleConfirmPin = async (value: string) => {
    if (value.length < 6) return;
    if (value !== newPin) {
      Alert.alert('NIP incorrect', 'Les deux NIP ne correspondent pas.');
      setNewPin(''); setConfirmPin(''); setStep('newPin');
      return;
    }
    setLoading(true);
    try {
      // Met à jour le mot de passe Supabase Auth avec le nouveau NIP
      const { error } = await supabase.auth.updateUser({ password: value });
      if (error) throw error;
      setStep('success');
      // Redirige vers la connexion après 2 secondes
      setTimeout(() => {
        router.replace({ pathname: '/(auth)/pin-login' as any, params: { phone } });
      }, 2000);
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de modifier le NIP.');
      setStep('newPin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, {
      paddingTop:    insets.top + 16,
      paddingBottom: insets.bottom + 32,
    }]}>

      {/* Bouton retour */}
      <TouchableOpacity
        style={styles.back}
        onPress={() => {
          if (step === 'otp')     { setStep('send'); return; }
          if (step === 'confirm') { setStep('newPin'); return; }
          router.back();
        }}
      >
        <Feather name="arrow-left" size={22} color="#111827" />
      </TouchableOpacity>

      {/* ── Étape 1 : Envoyer OTP ── */}
      {step === 'send' && (
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Feather name="phone" size={30} color="#FF6835" />
          </View>
          <Text style={styles.title}>NIP oublié ?</Text>
          <Text style={styles.subtitle}>
            Nous allons envoyer un code de vérification au{'\n'}
            <Text style={styles.phone}>{maskedPhone}</Text>
            {'\n'}pour confirmer votre identité.
          </Text>
          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={sendOtp}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Feather name="send" size={16} color="#fff" />
                  <Text style={styles.btnText}>Envoyer le code</Text>
                </>}
          </TouchableOpacity>
        </View>
      )}

      {/* ── Étape 2 : Saisir OTP ── */}
      {step === 'otp' && (
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Feather name="message-circle" size={30} color="#FF6835" />
          </View>
          <Text style={styles.title}>Code de vérification</Text>
          <Text style={styles.subtitle}>
            Entrez le code reçu au{'\n'}
            <Text style={styles.phone}>{maskedPhone}</Text>
          </Text>

          <OTPInput
            length={6}
            value={otp}
            onChange={setOtp}
            onComplete={verifyOtp}
            loading={loading}
          />

          {/* Renvoyer */}
          <TouchableOpacity
            onPress={sendOtp}
            disabled={countdown > 0 || loading}
            style={styles.resendRow}
          >
            <Text style={[styles.resendText, countdown > 0 && { color: '#9CA3AF' }]}>
              {countdown > 0 ? `Renvoyer dans ${countdown}s` : 'Renvoyer le code'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Étape 3 : Nouveau NIP ── */}
      {step === 'newPin' && (
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Feather name="lock" size={30} color="#FF6835" />
          </View>
          <Text style={styles.title}>Nouveau NIP</Text>
          <Text style={styles.subtitle}>
            Choisissez un nouveau code à 6 chiffres.
          </Text>
          <OTPInput
            key="new"
            length={6}
            value={newPin}
            onChange={setNewPin}
            onComplete={handleNewPin}
            secureTextEntry
          />
        </View>
      )}

      {/* ── Étape 4 : Confirmer NIP ── */}
      {step === 'confirm' && (
        <View style={styles.content}>
          <View style={styles.iconWrap}>
            <Feather name="check-circle" size={30} color="#FF6835" />
          </View>
          <Text style={styles.title}>Confirmer le NIP</Text>
          <Text style={styles.subtitle}>
            Saisissez à nouveau votre nouveau NIP.
          </Text>
          <OTPInput
            key="confirm"
            length={6}
            value={confirmPin}
            onChange={setConfirmPin}
            onComplete={handleConfirmPin}
            secureTextEntry
            loading={loading}
          />
        </View>
      )}

      {/* ── Succès ── */}
      {step === 'success' && (
        <View style={styles.content}>
          <View style={[styles.iconWrap, { backgroundColor: '#F0FDF4' }]}>
            <Feather name="check-circle" size={40} color="#22C55E" />
          </View>
          <Text style={[styles.title, { color: '#22C55E' }]}>NIP mis à jour !</Text>
          <Text style={styles.subtitle}>
            Votre NIP a été modifié avec succès.{'\n'}
            Vous allez être redirigé vers la connexion…
          </Text>
          <ActivityIndicator color="#FF6835" style={{ marginTop: 8 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:       { flex: 1, backgroundColor: '#F8F7F4', paddingHorizontal: 24, gap: 8 },
  back:       { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  content:    { flex: 1, gap: 24, paddingTop: 16, alignItems: 'flex-start' },
  iconWrap:   { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle:   { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  phone:      { fontWeight: '700', color: '#111827' },
  btn:        { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FF6835', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 28, alignSelf: 'stretch', justifyContent: 'center', shadowColor: '#FF6835', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnText:    { fontSize: 16, fontWeight: '700', color: '#fff' },
  resendRow:  { alignSelf: 'center', paddingVertical: 8 },
  resendText: { fontSize: 14, fontWeight: '600', color: '#FF6835' },
});
