import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Modal, Platform,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

const DIAL_CODES = [
  { code: '+229', flag: '🇧🇯', name: 'Bénin' },
  { code: '+228', flag: '🇹🇬', name: 'Togo' },
  { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
  { code: '+233', flag: '🇬🇭', name: 'Ghana' },
  { code: '+237', flag: '🇨🇲', name: 'Cameroun' },
  { code: '+223', flag: '🇲🇱', name: 'Mali' },
];

type PhoneStep = 'pin' | 'new_number' | 'otp';

export default function PersonalInfoScreen() {
  const insets = useSafeAreaInsets();
  const { profile, setProfile } = useAuthStore();

  // ── Champs modifiables ────────────────────────────────────────────────────
  const [name, setName] = useState(profile?.name ?? '');
  const [email, setEmail] = useState(profile?.email ?? '');
  const [saving, setSaving] = useState(false);

  // Valeurs originales — pour détecter les changements
  const [originalName, setOriginalName] = useState(profile?.name ?? '');
  const [originalEmail, setOriginalEmail] = useState(profile?.email ?? '');

  // Bouton visible uniquement si une valeur a changé
  const hasChanges = name !== originalName || email !== originalEmail;

  // ── Photo de profil ───────────────────────────────────────────────────────
  const [avatarUri, setAvatarUri] = useState<string | null>(profile?.avatar_url ?? null);
  const [avatarLoading, setAvatarLoading] = useState(false);

  // ── Modal changement de téléphone ─────────────────────────────────────────
  const [phoneModalVisible, setPhoneModalVisible] = useState(false);
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('pin');
  const [pinValue, setPinValue] = useState('');
  const [dialCode, setDialCode] = useState(DIAL_CODES[0]);
  const [dialPickerOpen, setDialPickerOpen] = useState(false);
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [otpValue, setOtpValue] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const initials = name
    ? name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  // ── Sauvegarder nom + email ───────────────────────────────────────────────
  const saveInfo = async () => {
    if (!profile?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ name, email: email || null })
        .eq('id', profile.id);
      if (error) throw error;
      setProfile({ ...profile, name, email: email || undefined });
      // Mettre à jour les valeurs originales → hasChanges redevient false → bouton disparaît
      setOriginalName(name);
      setOriginalEmail(email);
      Alert.alert('✅ Succès', 'Vos informations ont été mises à jour.');
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de sauvegarder.');
    } finally {
      setSaving(false);
    }
  };

  // ── Modifier la photo de profil ───────────────────────────────────────────
  const changeAvatar = async () => {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Permission requise', "Autorisez l'accès à vos photos.");
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return;

  const asset = result.assets[0];
  setAvatarLoading(true);

  try {
    // ✅ Extension depuis le mimeType de l'asset — pas depuis l'URI blob
    const mimeType = asset.mimeType ?? 'image/jpeg';
    const ext = mimeType.split('/')[1] ?? 'jpg';
    const filePath = `${profile?.id}.${ext}`;

    // ✅ FormData — la bonne méthode pour React Native + Supabase Storage
    const formData = new FormData();
    formData.append('file', {
      uri: asset.uri,
      name: `avatar.${ext}`,
      type: mimeType,
    } as any);

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, formData, {
        upsert: true,
        contentType: mimeType,
      });
    if (uploadError) throw uploadError;

    // Récupérer l'URL publique
    const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;

    // Mettre à jour en base
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', profile?.id ?? '');
    if (updateError) throw updateError;

    setAvatarUri(publicUrl);
    setProfile({ ...profile!, avatar_url: publicUrl });
    Alert.alert('✅ Photo mise à jour');

  } catch (err: any) {
    console.error('[Avatar] Erreur:', err);
    Alert.alert('Erreur', err.message ?? 'Impossible de changer la photo.');
  } finally {
    setAvatarLoading(false);
  }
};

  // ── Flux téléphone : étape 1 — vérifier NIP ──────────────────────────────
  const verifyPin = async () => {
    if (pinValue.length !== 6) { setPhoneError('Le NIP doit contenir 6 chiffres.'); return; }
    setPhoneLoading(true);
    setPhoneError('');
    try {
      const { error } = await supabase.auth.signInWithPassword({
        phone: profile?.phone ?? '',
        password: pinValue,
      });
      if (error) throw new Error('NIP incorrect. Réessayez.');
      setPhoneStep('new_number');
    } catch (err: any) {
      setPhoneError(err.message ?? 'NIP incorrect.');
    } finally {
      setPhoneLoading(false);
    }
  };

  // ── Flux téléphone : étape 2 — envoyer OTP ───────────────────────────────
  const sendOtpToNewNumber = async () => {
    const fullPhone = `${dialCode.code}${newPhoneNumber.replace(/\D/g, '')}`;
    if (newPhoneNumber.replace(/\D/g, '').length < 6) { setPhoneError('Numéro trop court.'); return; }
    if (fullPhone === profile?.phone) { setPhoneError('Ce numéro est déjà le vôtre.'); return; }
    setPhoneLoading(true);
    setPhoneError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: fullPhone });
      if (error) throw error;
      setPhoneStep('otp');
    } catch (err: any) {
      setPhoneError(err.message ?? "Impossible d'envoyer le code.");
    } finally {
      setPhoneLoading(false);
    }
  };

  // ── Flux téléphone : étape 3 — vérifier OTP + mettre à jour ─────────────
  const verifyOtpAndUpdate = async () => {
    const fullPhone = `${dialCode.code}${newPhoneNumber.replace(/\D/g, '')}`;
    if (otpValue.length !== 6) { setPhoneError('Code OTP invalide.'); return; }
    setPhoneLoading(true);
    setPhoneError('');
    try {
      const { error: otpError } = await supabase.auth.verifyOtp({
        phone: fullPhone, token: otpValue, type: 'sms',
      });
      if (otpError) throw new Error('Code OTP incorrect ou expiré.');

      const { error: updateError } = await supabase
        .from('users')
        .update({ phone: fullPhone })
        .eq('id', profile?.id ?? '');
      if (updateError) throw updateError;

      setProfile({ ...profile!, phone: fullPhone });
      setPhoneModalVisible(false);
      resetPhoneModal();
      Alert.alert('✅ Numéro mis à jour', `Votre nouveau numéro est ${fullPhone}`);
    } catch (err: any) {
      setPhoneError(err.message ?? 'Code incorrect.');
    } finally {
      setPhoneLoading(false);
    }
  };

  const resetPhoneModal = () => {
    setPhoneStep('pin');
    setPinValue('');
    setNewPhoneNumber('');
    setOtpValue('');
    setPhoneError('');
    setDialPickerOpen(false);
  };

  const closePhoneModal = () => {
    setPhoneModalVisible(false);
    resetPhoneModal();
  };

  const stepMeta = {
    pin:        { title: 'Vérification NIP',  sub: 'Entrez votre NIP de sécurité pour continuer' },
    new_number: { title: 'Nouveau numéro',    sub: 'Entrez le numéro que vous souhaitez utiliser' },
    otp:        { title: 'Confirmation',      sub: `Code envoyé au ${dialCode.code} ${newPhoneNumber}` },
  };

  const STEPS: PhoneStep[] = ['pin', 'new_number', 'otp'];

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 8 }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Informations personnelles</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Photo de profil ── */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrap} onPress={changeAvatar} activeOpacity={0.85} disabled={avatarLoading}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.initials}>{initials}</Text>
              </View>
            )}
            <View style={styles.cameraBtn}>
              {avatarLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="camera" size={14} color="#fff" />
              }
            </View>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>Appuyez pour modifier la photo</Text>
        </View>

        {/* ── Champs ── */}
        <View style={styles.card}>

          {/* Nom complet */}
          <View style={styles.field}>
            <Text style={styles.label}>Nom complet</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Votre nom complet"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.sep} />

          {/* Téléphone */}
          <View style={styles.field}>
            <Text style={styles.label}>Téléphone</Text>
            <View style={styles.phoneRow}>
              <Text style={styles.phoneValue}>{profile?.phone ?? '—'}</Text>
              <TouchableOpacity
                style={styles.editPhoneBtn}
                onPress={() => setPhoneModalVisible(true)}
              >
                <Feather name="edit-2" size={13} color="#FF6835" />
                <Text style={styles.editPhoneText}>Modifier</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sep} />

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>
              Email <Text style={styles.optional}>(optionnel)</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="votre@email.com"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* ── Bouton sauvegarder — visible UNIQUEMENT si une valeur a changé ── */}
        {hasChanges && (
          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.7 }]}
            onPress={saveInfo}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={styles.saveBtnText}>Enregistrer les modifications</Text>
            }
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* ── Modal changement de téléphone ── */}
      <Modal
        visible={phoneModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closePhoneModal}
      >
        <TouchableWithoutFeedback onPress={closePhoneModal}>
          <View style={styles.modalBackdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.modalHandle} />

          {/* Indicateur d'étape */}
          <View style={styles.stepRow}>
            {STEPS.map((s, i) => {
              const currentIdx = STEPS.indexOf(phoneStep);
              return (
                <View
                  key={s}
                  style={[
                    styles.stepDot,
                    i === currentIdx && styles.stepDotActive,
                    i < currentIdx && styles.stepDotDone,
                  ]}
                />
              );
            })}
          </View>

          <Text style={styles.modalTitle}>{stepMeta[phoneStep].title}</Text>
          <Text style={styles.modalSub}>{stepMeta[phoneStep].sub}</Text>

          {/* Étape 1 : NIP */}
          {phoneStep === 'pin' && (
            <View style={styles.stepContent}>
              <View style={styles.pinWrap}>
                <TextInput
                  style={styles.pinInput}
                  value={pinValue}
                  onChangeText={setPinValue}
                  keyboardType="number-pad"
                  maxLength={6}
                  secureTextEntry
                  placeholder="• • • • • •"
                  placeholderTextColor="#D1D5DB"
                  textAlign="center"
                  autoFocus
                />
              </View>
              {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
              <TouchableOpacity
                style={[styles.modalBtn, phoneLoading && { opacity: 0.7 }]}
                onPress={verifyPin}
                disabled={phoneLoading}
              >
                {phoneLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnText}>Valider le NIP</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Étape 2 : Nouveau numéro */}
          {phoneStep === 'new_number' && (
            <View style={styles.stepContent}>
              <View style={styles.newPhoneRow}>
                <TouchableOpacity
                  style={styles.dialBtn}
                  onPress={() => setDialPickerOpen((v) => !v)}
                >
                  <Text style={{ fontSize: 18 }}>{dialCode.flag}</Text>
                  <Text style={styles.dialCode}>{dialCode.code}</Text>
                  <Feather name="chevron-down" size={13} color="#6B7280" />
                </TouchableOpacity>
                <TextInput
                  style={styles.newPhoneInput}
                  value={newPhoneNumber}
                  onChangeText={(t) => setNewPhoneNumber(t.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  maxLength={10}
                  placeholder="XX XX XX XX"
                  placeholderTextColor="#9CA3AF"
                  autoFocus
                />
              </View>
              {dialPickerOpen && (
                <View style={styles.dialPicker}>
                  {DIAL_CODES.map((dc) => (
                    <TouchableOpacity
                      key={dc.code}
                      style={[styles.dialItem, dc.code === dialCode.code && styles.dialItemActive]}
                      onPress={() => { setDialCode(dc); setDialPickerOpen(false); }}
                    >
                      <Text style={{ fontSize: 20 }}>{dc.flag}</Text>
                      <Text style={[styles.dialItemName, dc.code === dialCode.code && { color: '#FF6835' }]}>
                        {dc.name}
                      </Text>
                      <Text style={styles.dialItemCode}>{dc.code}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
              <TouchableOpacity
                style={[styles.modalBtn, phoneLoading && { opacity: 0.7 }]}
                onPress={sendOtpToNewNumber}
                disabled={phoneLoading}
              >
                {phoneLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnText}>Recevoir le code OTP</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Étape 3 : OTP */}
          {phoneStep === 'otp' && (
            <View style={styles.stepContent}>
              <View style={styles.pinWrap}>
                <TextInput
                  style={styles.pinInput}
                  value={otpValue}
                  onChangeText={setOtpValue}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="• • • • • •"
                  placeholderTextColor="#D1D5DB"
                  textAlign="center"
                  autoFocus
                />
              </View>
              <TouchableOpacity onPress={sendOtpToNewNumber}>
                <Text style={styles.resendText}>Renvoyer le code</Text>
              </TouchableOpacity>
              {!!phoneError && <Text style={styles.errorText}>{phoneError}</Text>}
              <TouchableOpacity
                style={[styles.modalBtn, phoneLoading && { opacity: 0.7 }]}
                onPress={verifyOtpAndUpdate}
                disabled={phoneLoading}
              >
                {phoneLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnText}>Confirmer le nouveau numéro</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={closePhoneModal}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', backgroundColor: '#F8F7F4' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 20, gap: 20 },

  avatarSection: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#E5E7EB' },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#FF6835', alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 34, fontWeight: '800', color: '#fff' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F8F7F4' },
  avatarHint: { fontSize: 13, color: '#9CA3AF' },

  card: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  field: { paddingHorizontal: 16, paddingVertical: 16 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
  label: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  optional: { fontWeight: '400', textTransform: 'none', letterSpacing: 0 },
  input: { fontSize: 16, color: '#111827', padding: 0 },

  phoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  phoneValue: { fontSize: 16, color: '#374151', fontWeight: '500' },
  editPhoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF2EC', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  editPhoneText: { fontSize: 13, fontWeight: '600', color: '#FF6835' },

  saveBtn: { backgroundColor: '#FF6835', borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginBottom: 8 },

  stepRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 4 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E5E7EB' },
  stepDotActive: { backgroundColor: '#FF6835', width: 24 },
  stepDotDone: { backgroundColor: '#22C55E' },

  modalTitle: { fontSize: 20, fontWeight: '800', color: '#111827', textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 20, marginBottom: 8 },
  stepContent: { gap: 14 },

  pinWrap: { backgroundColor: '#F3F4F6', borderRadius: 16, paddingVertical: 4 },
  pinInput: { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: 12, paddingVertical: 16 },

  newPhoneRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  dialBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 13, backgroundColor: '#fff' },
  dialCode: { fontSize: 13, fontWeight: '600', color: '#111827' },
  newPhoneInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: '#111827' },
  dialPicker: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden' },
  dialItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F3F4F6' },
  dialItemActive: { backgroundColor: '#FEF2EC' },
  dialItemName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  dialItemCode: { fontSize: 13, color: '#9CA3AF' },

  resendText: { fontSize: 13, color: '#FF6835', fontWeight: '600', textAlign: 'center' },
  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10 },
  modalBtn: { backgroundColor: '#FF6835', borderRadius: 14, padding: 16, alignItems: 'center' },
  modalBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelBtn: { alignItems: 'center', paddingVertical: 8 },
  cancelText: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
});
