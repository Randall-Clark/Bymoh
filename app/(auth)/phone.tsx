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
import { api } from '@/lib/api';

const schema = z.object({
  phone: z
    .string()
    .min(8, 'Numéro trop court')
    .regex(/^\+?[0-9]{8,15}$/, 'Format invalide (ex: +22890000000)'),
});
type FormData = z.infer<typeof schema>;

function buildE164(input: string, dialCode: string): string {
  const clean = input.replace(/[\s\-().]/g, '');
  if (clean.startsWith('+')) return clean;
  const digits = dialCode.replace('+', '');
  if (clean.startsWith(digits)) return `+${clean}`;
  return `${dialCode}${clean}`;
}

const COUNTRY_CODES = [
  { code: '+225', flag: '🇨🇮', name: 'CI' },
  { code: '+233', flag: '🇬🇭', name: 'GH' },
  { code: '+221', flag: '🇸🇳', name: 'SN' },
  { code: '+228', flag: '🇹🇬', name: 'TG' },
  { code: '+229', flag: '🇧🇯', name: 'BJ' },
  { code: '+237', flag: '🇨🇲', name: 'CM' },
  { code: '+223', flag: '🇲🇱', name: 'ML' },
];

export default function PhoneScreen() {
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: 'login' | 'signup' }>();
  const isLogin = mode === 'login';

  const [countryCode, setCountryCode] = useState(COUNTRY_CODES[3]);
  const [loading, setLoading] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '' },
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const fullPhone = buildE164(data.phone, countryCode.code);

      if (isLogin) {
        // Vérifier si le numéro est enregistré via l'API Express
        const result = await api.post<{ exists: boolean }>('/auth/check-phone', { phone: fullPhone });
        if (!result.exists) {
          Alert.alert(
            'Numéro non trouvé',
            "Ce numéro n'est pas encore enregistré. Créez un compte.",
            [
              { text: 'Créer un compte', onPress: () => router.replace({ pathname: '/(auth)/phone', params: { mode: 'signup' } }) },
              { text: 'Annuler', style: 'cancel' },
            ],
          );
          return;
        }
        router.push({ pathname: '/(auth)/pin-login', params: { phone: fullPhone } });
      } else {
        // Inscription : aller vers le formulaire nom + NIP
        router.push({ pathname: '/(auth)/signup', params: { phone: fullPhone } });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur de connexion au serveur';
      Alert.alert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.back} onPress={() => router.back()}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Feather name="smartphone" size={30} color={isLogin ? '#1E3A5F' : '#FF6835'} />
          </View>
          <Text style={styles.title}>
            {isLogin ? 'Connexion' : 'Créer un compte'}
          </Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? 'Entrez votre numéro pour accéder à votre compte.'
              : 'Entrez votre numéro de téléphone pour commencer.'}
          </Text>
        </View>

        <View style={styles.phoneRow}>
          <TouchableOpacity
            style={styles.codeBtn}
            onPress={() => setPickerVisible((v) => !v)}
            activeOpacity={0.8}
          >
            <Text style={styles.codeFlag}>{countryCode.flag}</Text>
            <Text style={styles.codeText}>{countryCode.code}</Text>
            <Feather name="chevron-down" size={14} color="#6B7280" />
          </TouchableOpacity>

          <View style={styles.phoneInput}>
            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value, onBlur } }) => (
                <Input
                  placeholder="XX XX XX XX"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  keyboardType="phone-pad"
                  error={errors.phone?.message}
                  leftIcon="phone"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit(onSubmit)}
                />
              )}
            />
          </View>
        </View>

        {pickerVisible && (
          <View style={styles.picker}>
            {COUNTRY_CODES.map((cc) => (
              <TouchableOpacity
                key={cc.code}
                style={[styles.pickerItem, cc.code === countryCode.code && styles.pickerItemActive]}
                onPress={() => { setCountryCode(cc); setPickerVisible(false); }}
              >
                <Text style={styles.pickerFlag}>{cc.flag}</Text>
                <Text style={[styles.pickerName, cc.code === countryCode.code && { color: '#FF6835' }]}>
                  {cc.name} ({cc.code})
                </Text>
                {cc.code === countryCode.code && <Feather name="check" size={16} color="#FF6835" />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Button
          title={loading ? 'Vérification…' : 'Continuer'}
          onPress={handleSubmit(onSubmit)}
          loading={loading}
          fullWidth
          size="lg"
          style={isLogin ? { ...styles.cta, ...styles.ctaLogin } : styles.cta}
        />

        {isLogin ? (
          <TouchableOpacity onPress={() => router.replace({ pathname: '/(auth)/phone', params: { mode: 'signup' } })}>
            <Text style={styles.switchMode}>
              Pas encore de compte ?{' '}
              <Text style={styles.switchModeLink}>Créer un compte</Text>
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => router.replace({ pathname: '/(auth)/phone', params: { mode: 'login' } })}>
            <Text style={styles.switchMode}>
              Déjà un compte ?{' '}
              <Text style={styles.switchModeLink}>Se connecter</Text>
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F7F4' },
  content: { paddingHorizontal: 24, gap: 20 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  header: { gap: 10, marginBottom: 8 },
  iconWrap: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: '#FEF2EC',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 28, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 15, color: '#6B7280', lineHeight: 22 },
  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  codeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 15, backgroundColor: '#fff',
  },
  codeFlag: { fontSize: 20 },
  codeText: { fontSize: 14, fontWeight: '600', color: '#111827' },
  phoneInput: { flex: 1 },
  picker: {
    backgroundColor: '#fff', borderRadius: 16, padding: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 8,
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10,
  },
  pickerItemActive: { backgroundColor: '#FEF2EC' },
  pickerFlag: { fontSize: 22 },
  pickerName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  cta: { marginTop: 8 },
  ctaLogin: { backgroundColor: '#1E3A5F' },
  switchMode: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  switchModeLink: { color: '#FF6835', fontWeight: '700' },
});
