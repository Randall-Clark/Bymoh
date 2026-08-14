// app/(auth)/phone.tsx
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView,
  Modal, Platform, StyleSheet, Text, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { checkPhoneExists, sendOTP } from '@/lib/supabase';
import { COUNTRIES, Country, buildFullPhone } from '@/lib/countries';

type Mode = 'login' | 'register';

export default function PhoneScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 16;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 32;

  const [selectedCountry, setSelectedCountry] = useState<Country>(
    COUNTRIES.find((c) => c.code === 'BJ') ?? COUNTRIES[0]
  );
  const [phone,         setPhone]         = useState('');
  const [mode,          setMode]          = useState<Mode>('login');
  const [loading,       setLoading]       = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [search,        setSearch]        = useState('');

  // ✅ Verrou — empêche tout double envoi
  const sendingRef = useRef(false);

  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dialCode.includes(search)
  );

  const isValid   = phone.replace(/\D/g, '').length >= selectedCountry.phoneDigits - 1;
  const fullPhone = buildFullPhone(phone, selectedCountry);

  // ── Soumission unique selon le mode ──────────────────────────────────────
  const handleSubmit = async () => {
    if (!isValid || loading || sendingRef.current) return;
    sendingRef.current = true;
    setLoading(true);

    try {
      if (mode === 'login') {
        // ── Connexion ──────────────────────────────────────────────────────
        let phoneExists = false;
        try {
          phoneExists = await checkPhoneExists(fullPhone);
        } catch {
          // RPC non disponible — on laisse passer, pin-login gérera
        }

        if (!phoneExists) {
          Alert.alert(
            'Compte introuvable',
            'Aucun compte associé à ce numéro. Souhaitez-vous créer un compte ?',
            [
              {
                text: 'Créer un compte',
                onPress: () => setMode('register'),
              },
              { text: 'Annuler', style: 'cancel' },
            ]
          );
          return;
        }

        router.push({
          pathname: '/(auth)/pin-login' as any,
          params: { phone: fullPhone },
        });

      } else {
        // ── Inscription ────────────────────────────────────────────────────
        let phoneExists = false;
        try {
          phoneExists = await checkPhoneExists(fullPhone);
        } catch {
          // Ignore — on continue
        }

        if (phoneExists) {
          Alert.alert(
            'Compte existant',
            'Un compte est déjà associé à ce numéro. Connectez-vous à la place.',
            [
              {
                text: 'Se connecter',
                onPress: () => setMode('login'),
              },
              { text: 'Annuler', style: 'cancel' },
            ]
          );
          return;
        }

        // ✅ Un seul appel OTP — garanti par sendingRef
        await sendOTP(fullPhone);

        router.push({
          pathname: '/(auth)/otp' as any,
          params: {
            phone:        fullPhone,
            country_code: selectedCountry.code,
            country_name: selectedCountry.name,
            timezone:     selectedCountry.timezone,
            mode:         'register',
          },
        });
      }

    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Une erreur est survenue.');
    } finally {
      setLoading(false);
      // Libère le verrou après 3s
      setTimeout(() => { sendingRef.current = false; }, 3000);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.content, { paddingTop: topPad, paddingBottom: botPad }]}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoWrap}>
            <Text style={styles.logoText}>B</Text>
          </View>
          <Text style={styles.title}>Bienvenue sur Bymoh</Text>
          <Text style={styles.subtitle}>
            Entrez votre numéro de téléphone pour continuer.
          </Text>
        </View>

        {/* Onglets Connexion / Inscription */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'login' && styles.tabActive]}
            onPress={() => setMode('login')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>
              Se connecter
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'register' && styles.tabActive]}
            onPress={() => setMode('register')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === 'register' && styles.tabTextActive]}>
              Créer un compte
            </Text>
          </TouchableOpacity>
        </View>

        {/* Champ téléphone */}
        <View style={styles.phoneRow}>
          <TouchableOpacity
            style={styles.dialBtn}
            onPress={() => { setSearch(''); setPickerVisible(true); }}
            activeOpacity={0.8}
          >
            <Text style={styles.dialFlag}>{selectedCountry.flag}</Text>
            <Text style={styles.dialCode}>{selectedCountry.dialCode}</Text>
            <Feather name="chevron-down" size={13} color="#6B7280" />
          </TouchableOpacity>

          <TextInput
            style={styles.phoneInput}
            placeholder={selectedCountry.placeholder}
            placeholderTextColor="#9CA3AF"
            keyboardType="phone-pad"
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
            maxLength={selectedCountry.phoneDigits}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
        </View>

        {/* Aperçu numéro complet */}
        {phone.length > 0 && (
          <Text style={styles.phonePreview}>
            Numéro complet : <Text style={{ fontWeight: '700' }}>{fullPhone}</Text>
          </Text>
        )}

        {/* Bouton unique selon le mode */}
        <TouchableOpacity
          style={[styles.btn, (!isValid || loading) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={!isValid || loading}
          activeOpacity={0.88}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.btnText}>
                {mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
              </Text>
              <Feather name="arrow-right" size={18} color="#fff" />
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.notice}>
          En continuant, vous acceptez nos Conditions d'utilisation.
        </Text>
      </View>

      {/* Modal sélecteur d'indicatif */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Choisir le pays</Text>

          <View style={styles.searchBar}>
            <Feather name="search" size={15} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher…"
              placeholderTextColor="#9CA3AF"
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
                <Feather name="x" size={14} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(c) => c.code}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: c }) => {
              const sel = c.code === selectedCountry.code;
              return (
                <TouchableOpacity
                  style={[styles.countryRow, sel && styles.countryRowSelected]}
                  onPress={() => {
                    setSelectedCountry(c);
                    setPhone('');
                    setPickerVisible(false);
                    setSearch('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.countryFlag}>{c.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.countryName, sel && { color: '#FF6835' }]}>
                      {c.name}
                    </Text>
                    <Text style={styles.countryDigits}>{c.phoneDigits} chiffres</Text>
                  </View>
                  <Text style={styles.countryDial}>{c.dialCode}</Text>
                  {sel && <Feather name="check" size={16} color="#FF6835" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex:               { flex: 1, backgroundColor: '#F8F7F4' },
  content:            { flex: 1, paddingHorizontal: 24, gap: 20 },
  header:             { gap: 10, alignItems: 'center', paddingTop: 20 },
  logoWrap:           { width: 64, height: 64, borderRadius: 20, backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center' },
  logoText:           { fontSize: 32, fontWeight: '900', color: '#fff' },
  title:              { fontSize: 26, fontWeight: '800', color: '#111827', textAlign: 'center' },
  subtitle:           { fontSize: 14, color: '#6B7280', lineHeight: 21, textAlign: 'center' },

  // Onglets
  tabs:               { flexDirection: 'row', backgroundColor: '#F3F4F6', borderRadius: 14, padding: 4 },
  tab:                { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 11 },
  tabActive:          { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  tabText:            { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  tabTextActive:      { color: '#111827' },

  // Téléphone
  phoneRow:           { flexDirection: 'row', gap: 10 },
  dialBtn:            { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  dialFlag:           { fontSize: 20 },
  dialCode:           { fontSize: 15, fontWeight: '700', color: '#111827' },
  phoneInput:         { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: '600', color: '#111827', borderWidth: 1.5, borderColor: '#E5E7EB' },
  phonePreview:       { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },

  // Bouton
  btn:                { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FF6835', borderRadius: 16, paddingVertical: 16, shadowColor: '#FF6835', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  btnDisabled:        { backgroundColor: '#D1D5DB', shadowOpacity: 0, elevation: 0 },
  btnText:            { fontSize: 16, fontWeight: '700', color: '#fff' },
  notice:             { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },

  // Modal
  modalBackdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet:         { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '80%', gap: 14 },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4 },
  modalTitle:         { fontSize: 18, fontWeight: '800', color: '#111827' },
  searchBar:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:        { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  countryRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  countryRowSelected: { backgroundColor: '#FEF2EC', borderRadius: 10, paddingHorizontal: 8, borderBottomWidth: 0 },
  countryFlag:        { fontSize: 22 },
  countryName:        { fontSize: 15, fontWeight: '600', color: '#111827' },
  countryDigits:      { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  countryDial:        { fontSize: 13, color: '#9CA3AF' },
});
