// app/(client)/profile/personal.tsx
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, FlatList, Image,
  KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { COUNTRIES, Country } from '@/lib/countries';

// ─────────────────────────────────────────────────────────────────────────────
// Modal changement de numéro
// Flux : PIN → Nouveau numéro → OTP → Succès
// ─────────────────────────────────────────────────────────────────────────────
type PhoneStep = 'pin' | 'newPhone' | 'otp' | 'success';

function ChangePhoneModal({
  visible, currentPhone, onClose, onSuccess,
}: {
  visible: boolean;
  currentPhone: string;
  onClose: () => void;
  onSuccess: (newPhone: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(600)).current;

  const [step,     setStep]     = useState<PhoneStep>('pin');
  const [pin,      setPin]      = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [otp,      setOtp]      = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Pays pour indicatif
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    COUNTRIES.find((c) => c.code === 'BJ') ?? COUNTRIES[0]
  );

  useEffect(() => {
    if (visible) {
      setStep('pin'); setPin(''); setNewPhone(''); setOtp(''); setError('');
      Animated.spring(slideY, { toValue: 0, tension: 70, friction: 13, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideY, { toValue: 600, duration: 240, useNativeDriver: true }).start();
    }
  }, [visible]);

  const verifyPin = async () => {
    if (pin.length < 6) { setError('Entrez votre NIP à 6 chiffres'); return; }
    setLoading(true); setError('');
    try {
      // Vérification du NIP via l'API
      const { data, error: e } = await supabase.rpc('verify_user_pin', { user_pin: pin });
      if (e || !data) throw new Error('NIP incorrect');
      setStep('newPhone');
    } catch {
      setError('NIP incorrect. Veuillez réessayer.');
    } finally { setLoading(false); }
  };

  const sendOtp = async () => {
    const full = `${selectedCountry.dialCode}${newPhone.replace(/^0+/, '')}`;
    if (newPhone.length < 6) { setError('Numéro invalide'); return; }
    if (full === currentPhone) { setError('Ce numéro est identique à l\'actuel'); return; }
    setLoading(true); setError('');
    try {
      const { error: e } = await supabase.auth.signInWithOtp({ phone: full });
      if (e) throw e;
      setStep('otp');
    } catch (e: any) {
      setError(e.message ?? 'Impossible d\'envoyer le code');
    } finally { setLoading(false); }
  };

  const verifyOtp = async () => {
    const full = `${selectedCountry.dialCode}${newPhone.replace(/^0+/, '')}`;
    if (otp.length < 4) { setError('Code invalide'); return; }
    setLoading(true); setError('');
    try {
      const { error: e } = await supabase.auth.verifyOtp({
        phone: full, token: otp, type: 'sms',
      });
      if (e) throw e;
      // Met à jour le numéro en DB
      const { error: upErr } = await supabase
        .from('users')
        .update({ phone: full })
        .eq('phone', currentPhone);
      if (upErr) throw upErr;
      setStep('success');
      setTimeout(() => { onSuccess(full); onClose(); }, 1500);
    } catch (e: any) {
      setError(e.message ?? 'Code incorrect');
    } finally { setLoading(false); }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={pm.backdrop} />
      </TouchableWithoutFeedback>

      <Animated.View style={[pm.sheet, { transform: [{ translateY: slideY }], paddingBottom: insets.bottom + 24 }]}>
        <View style={pm.handle} />

        {/* Header */}
        <View style={pm.header}>
          {step !== 'pin' && step !== 'success' && (
            <TouchableOpacity onPress={() => { setStep(step === 'otp' ? 'newPhone' : 'pin'); setError(''); }} style={pm.backBtn}>
              <Feather name="arrow-left" size={20} color="#111827" />
            </TouchableOpacity>
          )}
          <Text style={pm.title}>
            {step === 'pin'      ? 'Confirmer votre identité'  :
             step === 'newPhone' ? 'Nouveau numéro'            :
             step === 'otp'     ? 'Code de vérification'      :
                                  'Numéro mis à jour ✅'}
          </Text>
          <TouchableOpacity onPress={onClose} style={pm.closeBtn}>
            <Feather name="x" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Étape 1 : NIP */}
          {step === 'pin' && (
            <View style={pm.body}>
              <Text style={pm.desc}>Entrez votre NIP actuel pour confirmer votre identité avant de changer de numéro.</Text>
              <TextInput
                style={pm.input}
                placeholder="• • • • • •"
                placeholderTextColor="#D1D5DB"
                secureTextEntry
                keyboardType="number-pad"
                maxLength={6}
                value={pin}
                onChangeText={(t) => { setPin(t.replace(/\D/g, '')); setError(''); }}
                autoFocus
              />
              {error ? <Text style={pm.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[pm.btn, (pin.length < 6 || loading) && pm.btnDisabled]}
                onPress={verifyPin}
                disabled={pin.length < 6 || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={pm.btnText}>Vérifier le NIP</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Étape 2 : Nouveau numéro */}
          {step === 'newPhone' && (
            <View style={pm.body}>
              <Text style={pm.desc}>Entrez votre nouveau numéro de téléphone. Vous recevrez un code de vérification.</Text>
              <View style={pm.phoneRow}>
                <View style={pm.dialBox}>
                  <Text style={pm.dialText}>{selectedCountry.flag} {selectedCountry.dialCode}</Text>
                </View>
                <TextInput
                  style={pm.phoneInput}
                  placeholder="XX XX XX XX"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={newPhone}
                  onChangeText={(t) => { setNewPhone(t.replace(/\D/g, '')); setError(''); }}
                  maxLength={12}
                  autoFocus
                />
              </View>
              {error ? <Text style={pm.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[pm.btn, (newPhone.length < 6 || loading) && pm.btnDisabled]}
                onPress={sendOtp}
                disabled={newPhone.length < 6 || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={pm.btnText}>Recevoir le code</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Étape 3 : OTP */}
          {step === 'otp' && (
            <View style={pm.body}>
              <Text style={pm.desc}>
                Entrez le code envoyé au {selectedCountry.dialCode} {newPhone}
              </Text>
              <TextInput
                style={pm.input}
                placeholder="Code OTP"
                placeholderTextColor="#D1D5DB"
                keyboardType="number-pad"
                maxLength={6}
                value={otp}
                onChangeText={(t) => { setOtp(t.replace(/\D/g, '')); setError(''); }}
                autoFocus
              />
              {error ? <Text style={pm.error}>{error}</Text> : null}
              <TouchableOpacity
                style={[pm.btn, (otp.length < 4 || loading) && pm.btnDisabled]}
                onPress={verifyOtp}
                disabled={otp.length < 4 || loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={pm.btnText}>Confirmer</Text>}
              </TouchableOpacity>
            </View>
          )}

          {/* Succès */}
          {step === 'success' && (
            <View style={[pm.body, { alignItems: 'center', gap: 12 }]}>
              <View style={pm.successIcon}>
                <Feather name="check-circle" size={48} color="#22C55E" />
              </View>
              <Text style={pm.successText}>Numéro mis à jour avec succès !</Text>
            </View>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const pm = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle:      { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: 4 },
  title:       { flex: 1, fontSize: 16, fontWeight: '800', color: '#111827' },
  closeBtn:    { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  body:        { padding: 20, gap: 16 },
  desc:        { fontSize: 14, color: '#6B7280', lineHeight: 21 },
  input:       { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 22, fontWeight: '700', color: '#111827', letterSpacing: 6, textAlign: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  phoneRow:    { flexDirection: 'row', gap: 10 },
  dialBox:     { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 14, justifyContent: 'center', borderWidth: 1.5, borderColor: '#E5E7EB' },
  dialText:    { fontSize: 14, fontWeight: '700', color: '#111827' },
  phoneInput:  { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, fontWeight: '600', color: '#111827', borderWidth: 1.5, borderColor: '#E5E7EB' },
  error:       { fontSize: 13, color: '#EF4444', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10 },
  btn:         { backgroundColor: '#FF6835', borderRadius: 14, padding: 16, alignItems: 'center' },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText:     { fontSize: 15, fontWeight: '700', color: '#fff' },
  successIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
  successText: { fontSize: 16, fontWeight: '700', color: '#22C55E' },
});

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal
// ─────────────────────────────────────────────────────────────────────────────
export default function PersonalInfoScreen() {
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useAuthStore();
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 12;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom + 16;

  // État initial (pour détecter les changements)
  const initial = {
    name:         profile?.name         ?? '',
    email:        profile?.email        ?? '',
    country_code: profile?.country_code ?? '',
    country:      profile?.country      ?? '',
    timezone:     (profile as any)?.timezone ?? '',
  };

  const [form, setForm] = useState(initial);
  const [saving,         setSaving]         = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [search, setSearch] = useState('');

  // Détecter si des changements ont été effectués
  const hasChanges =
    form.name.trim()   !== initial.name.trim()   ||
    form.email.trim()  !== initial.email.trim()  ||
    form.country_code  !== initial.country_code  ||
    form.timezone      !== initial.timezone;

  const selectedCountry = COUNTRIES.find((c) => c.code === form.country_code) ?? null;
  const filtered = COUNTRIES.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dialCode.includes(search)
  );

  // ── Changer la photo de profil ────────────────────────────────────────────
  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission requise', 'Autorisez l\'accès à la galerie dans les paramètres.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const asset = result.assets[0];
      const ext   = asset.uri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const path  = `avatars/${profile?.id}.${ext}`;

      const response = await fetch(asset.uri);
      const blob     = await response.blob();

      const { error: upErr } = await supabase.storage
        .from('users')
        .upload(path, blob, { upsert: true, contentType: `image/${ext}` });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from('users').getPublicUrl(path);
      const avatarUrl = data.publicUrl;

      await supabase.from('users').update({ avatar_url: avatarUrl }).eq('id', profile?.id ?? '');
      setProfile({ ...profile!, avatar_url: avatarUrl });
      Alert.alert('✅ Photo mise à jour');
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de mettre à jour la photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Sauvegarder les modifications ─────────────────────────────────────────
  const save = async () => {
    if (!profile?.id) return;
    if (form.name.trim().length < 2) {
      Alert.alert('Nom invalide', 'Le nom doit contenir au moins 2 caractères.');
      return;
    }
    setSaving(true);
    try {
      const updates: Record<string, any> = {
        name:  form.name.trim(),
        email: form.email.trim() || null,
      };
      if (form.country_code) {
        updates.country_code = form.country_code;
        updates.country      = form.country;
        updates.timezone     = form.timezone;
      }

      const { error } = await supabase.from('users').update(updates).eq('id', profile.id);
      if (error) throw error;

      setProfile({ ...profile, ...updates } as any);
      Alert.alert('✅ Modifications enregistrées');
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de sauvegarder.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: topPad }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Informations personnelles</Text>
        {/* Bouton Enregistrer — visible uniquement si changements */}
        {hasChanges && (
          <TouchableOpacity
            style={styles.saveHeaderBtn}
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveHeaderBtnText}>Enregistrer</Text>}
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Photo de profil ── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            {profile?.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Text style={styles.avatarInitial}>
                  {profile?.name?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={styles.avatarEditBtn}
              onPress={pickAvatar}
              disabled={uploadingPhoto}
              activeOpacity={0.85}
            >
              {uploadingPhoto
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="camera" size={14} color="#fff" />}
            </TouchableOpacity>
          </View>
          <Text style={styles.avatarHint}>Appuyez pour changer la photo</Text>
        </View>

        {/* ── Identité ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Identité</Text>

          {/* Nom */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Nom complet</Text>
            <View style={styles.inputWrap}>
              <Feather name="user" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                value={form.name}
                onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                placeholder="Votre nom complet"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Adresse email</Text>
            <View style={styles.inputWrap}>
              <Feather name="mail" size={16} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                value={form.email}
                onChangeText={(t) => setForm((f) => ({ ...f, email: t }))}
                placeholder="votre@email.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Téléphone */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Numéro de téléphone</Text>
            <View style={styles.inputWrap}>
              <Feather name="phone" size={16} color="#9CA3AF" />
              <Text style={[styles.input, { color: '#374151' }]}>{profile?.phone ?? '—'}</Text>
              <TouchableOpacity
                style={styles.changePhoneBtn}
                onPress={() => setPhoneModalVisible(true)}
                activeOpacity={0.85}
              >
                <Feather name="edit-2" size={13} color="#FF6835" />
                <Text style={styles.changePhoneBtnText}>Modifier</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Pays de résidence ── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Pays de résidence</Text>
          <Text style={styles.cardSub}>
            Détermine votre fuseau horaire et les commerces visibles par défaut.
          </Text>

          <TouchableOpacity
            style={styles.countryBtn}
            onPress={() => { setSearch(''); setCountryPickerVisible(true); }}
            activeOpacity={0.85}
          >
            {selectedCountry ? (
              <>
                <Text style={styles.countryFlag}>{selectedCountry.flag}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.countryName}>{selectedCountry.name}</Text>
                  <Text style={styles.countryTz}>{selectedCountry.timezone}</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.countryEmpty}>
                  <Feather name="globe" size={20} color="#9CA3AF" />
                </View>
                <Text style={[styles.countryName, { color: '#9CA3AF' }]}>
                  Aucun pays sélectionné
                </Text>
              </>
            )}
            <View style={[styles.changeBadge, form.country_code !== initial.country_code && styles.changeBadgeActive]}>
              <Text style={[styles.changeBadgeText, form.country_code !== initial.country_code && { color: '#FF6835' }]}>
                {selectedCountry ? 'Changer' : 'Sélectionner'}
              </Text>
              <Feather name="chevron-right" size={14} color={form.country_code !== initial.country_code ? '#FF6835' : '#9CA3AF'} />
            </View>
          </TouchableOpacity>

          {/* Heure locale du pays */}
          {form.timezone ? (
            <View style={styles.tzInfo}>
              <Feather name="clock" size={13} color="#1E3A5F" />
              <Text style={styles.tzInfoText}>
                Heure actuelle dans ce pays :{' '}
                <Text style={styles.tzInfoBold}>
                  {new Date().toLocaleTimeString('fr-FR', {
                    timeZone: form.timezone,
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* ── Modal changement numéro ── */}
      <ChangePhoneModal
        visible={phoneModalVisible}
        currentPhone={profile?.phone ?? ''}
        onClose={() => setPhoneModalVisible(false)}
        onSuccess={(newPhone) => {
          setProfile({ ...profile!, phone: newPhone });
        }}
      />

      {/* ── Modal sélecteur pays ── */}
      <Modal
        visible={countryPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCountryPickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setCountryPickerVisible(false)}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Pays de résidence</Text>

          <View style={styles.searchBar}>
            <Feather name="search" size={15} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Rechercher un pays…"
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
              const sel = c.code === form.country_code;
              return (
                <TouchableOpacity
                  style={[styles.countryRow, sel && styles.countryRowSelected]}
                  onPress={() => {
                    setForm((f) => ({
                      ...f,
                      country_code: c.code,
                      country:      c.name,
                      timezone:     c.timezone,
                    }));
                    setCountryPickerVisible(false);
                    setSearch('');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.rowFlag}>{c.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowName, sel && { color: '#FF6835' }]}>{c.name}</Text>
                    <Text style={styles.rowMeta}>{c.dialCode} · {c.timezone}</Text>
                  </View>
                  {sel && <Feather name="check-circle" size={18} color="#FF6835" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root:               { flex: 1, backgroundColor: '#F8F7F4' },

  // Header
  header:             { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn:            { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle:        { flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' },
  saveHeaderBtn:      { backgroundColor: '#FF6835', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  saveHeaderBtnText:  { fontSize: 13, fontWeight: '700', color: '#fff' },

  scroll:             { padding: 20, gap: 16 },

  // Avatar
  avatarSection:      { alignItems: 'center', gap: 8, paddingVertical: 8 },
  avatarWrap:         { position: 'relative' },
  avatar:             { width: 96, height: 96, borderRadius: 48 },
  avatarPlaceholder:  { backgroundColor: '#1E3A5F', alignItems: 'center', justifyContent: 'center' },
  avatarInitial:      { fontSize: 36, fontWeight: '800', color: '#fff' },
  avatarEditBtn:      { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarHint:         { fontSize: 12, color: '#9CA3AF' },

  // Cards
  card:               { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  cardTitle:          { fontSize: 16, fontWeight: '800', color: '#111827' },
  cardSub:            { fontSize: 12, color: '#9CA3AF', marginTop: -8 },

  // Champs
  field:              { gap: 6 },
  fieldLabel:         { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  inputWrap:          { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1.5, borderColor: '#E5E7EB' },
  input:              { flex: 1, fontSize: 15, color: '#111827', padding: 0 },

  // Modifier numéro
  changePhoneBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2EC', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  changePhoneBtnText: { fontSize: 12, fontWeight: '600', color: '#FF6835' },

  // Pays
  countryBtn:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8F7F4', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  countryEmpty:       { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  countryFlag:        { fontSize: 28 },
  countryName:        { fontSize: 15, fontWeight: '700', color: '#111827' },
  countryTz:          { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  changeBadge:        { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 5 },
  changeBadgeActive:  { backgroundColor: '#FEF2EC' },
  changeBadgeText:    { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  tzInfo:             { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EEF2FF', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#C7D2FE' },
  tzInfoText:         { flex: 1, fontSize: 12, color: '#374151' },
  tzInfoBold:         { fontWeight: '700', color: '#1E3A5F' },

  // Modal
  modalBackdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet:         { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '85%', gap: 14 },
  modalHandle:        { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 4 },
  modalTitle:         { fontSize: 18, fontWeight: '800', color: '#111827' },
  searchBar:          { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput:        { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  countryRow:         { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  countryRowSelected: { backgroundColor: '#FEF2EC', borderRadius: 10, paddingHorizontal: 8, borderBottomWidth: 0 },
  rowFlag:            { fontSize: 24 },
  rowName:            { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowMeta:            { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
});
