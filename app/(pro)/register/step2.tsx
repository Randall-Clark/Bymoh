import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Alert, Image, ScrollView, StyleSheet, Text,
  TouchableOpacity, View,
} from 'react-native';
import Animated, { SlideInRight, SlideInLeft } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Input } from '@/components/ui/Input';
import { registerDraft } from './step1';
import { BusinessLocationPickerModal, BusinessAddressResult } from '@/components/BusinessLocationPickerModal';
import { useAuthStore } from '@/stores/authStore';
import { navDir } from '@/lib/navDir';

const ORANGE = '#FF6835';
const DARK   = '#1A1025';

type AddressMode = 'manual' | 'map';

async function validateLocationInCountry(locationName: string, countryCode: string): Promise<boolean> {
  try {
    const q   = encodeURIComponent(locationName.trim());
    const cc  = countryCode.toLowerCase();
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&countrycodes=${cc}&format=json&limit=1&accept-language=fr`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'BymohApp/1.0 contact@bymoh.com' } });
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return true;
  }
}

export default function RegisterStep2() {
  const insets     = useSafeAreaInsets();
  const { profile } = useAuthStore();

  const entering = navDir.current === 'back' ? SlideInLeft.duration(300) : SlideInRight.duration(300);
  navDir.current = 'forward';

  const handleCancel = () => {
    router.dismissAll();
    if ((profile as any)?.role === 'pro') {
      router.replace('/(pro)/dashboard' as any);
    } else {
      router.replace('/(client)/' as any);
    }
  };

  const goBack = () => {
    navDir.current = 'back';
    router.replace('/(pro)/register/step1' as any);
  };

  /* ── State adresse ── */
  const [addressMode, setAddressMode] = useState<AddressMode>('manual');
  const [manualCity,     setManualCity]     = useState((registerDraft as any).city      ?? '');
  const [manualQuartier, setManualQuartier] = useState((registerDraft as any).quartier  ?? '');
  const [manualDetails,  setManualDetails]  = useState((registerDraft as any).address_details ?? '');
  const [cityError,      setCityError]      = useState('');
  const [quartierError,  setQuartierError]  = useState('');
  const [validatingAddress, setValidatingAddress] = useState(false);

  const [addressPickerVisible, setAddressPickerVisible] = useState(false);
  const [businessAddress, setBusinessAddress] = useState<BusinessAddressResult | null>(null);

  /* ── State photo ── */
  const [coverUri, setCoverUri] = useState<string | null>((registerDraft as any).cover_uri ?? null);
  const [coverError, setCoverError] = useState('');

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
      setCoverError('');
    }
  };

  const addressReady = addressMode === 'manual'
    ? manualCity.trim().length > 0 && manualQuartier.trim().length > 0
    : businessAddress !== null;

  const onNext = async () => {
    /* Validation photo obligatoire */
    if (!coverUri) {
      setCoverError('La photo de couverture est obligatoire');
      return;
    }

    const countryCode = (registerDraft as any).country_code ?? 'bj';

    if (addressMode === 'manual') {
      let ok = true;
      if (!manualCity.trim())     { setCityError('La ville est obligatoire');        ok = false; } else setCityError('');
      if (!manualQuartier.trim()) { setQuartierError('Le quartier est obligatoire'); ok = false; } else setQuartierError('');
      if (!ok) return;

      setValidatingAddress(true);
      const cityExists = await validateLocationInCountry(manualCity.trim(), countryCode);
      if (!cityExists) {
        setValidatingAddress(false);
        setCityError('Ville introuvable dans ce pays');
        Alert.alert('Ville introuvable', `"${manualCity.trim()}" est introuvable.\nVérifiez l'orthographe.`, [{ text: 'OK' }]);
        return;
      }
      const quartierExists = await validateLocationInCountry(manualQuartier.trim(), countryCode);
      setValidatingAddress(false);
      if (!quartierExists) {
        setQuartierError('Quartier introuvable dans ce pays');
        Alert.alert('Quartier introuvable', `"${manualQuartier.trim()}" est introuvable.`, [{ text: 'OK' }]);
        return;
      }
    } else {
      if (!businessAddress) return;
    }

    const addressData = addressMode === 'manual'
      ? {
          address:         `${manualQuartier.trim()}, ${manualCity.trim()}${manualDetails.trim() ? ` — ${manualDetails.trim()}` : ''}`,
          city:            manualCity.trim(),
          quartier:        manualQuartier.trim(),
          latitude:        null,
          longitude:       null,
          building_type:   null,
          address_floor:   null,
          address_details: manualDetails.trim() || null,
        }
      : {
          address:         businessAddress!.address,
          city:            businessAddress!.city,
          quartier:        null,
          latitude:        businessAddress!.lat,
          longitude:       businessAddress!.lon,
          building_type:   businessAddress!.buildingType,
          address_floor:   businessAddress!.floor,
          address_details: businessAddress!.details,
        };

    Object.assign(registerDraft, { cover_uri: coverUri, ...addressData });
    router.push('/(pro)/register/step3' as any);
  };

  return (
    <View style={s.root}>

      {/* ── Navbar ── */}
      <View style={[s.navbar, { paddingTop: insets.top + 8 }]}>
        <Text style={s.navTitle}>Créer mon commerce</Text>
        <TouchableOpacity onPress={handleCancel} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </View>

      {/* ── Step indicator ── */}
      <View style={s.stepWrap}>
        <StepIndicator current={2} total={5} title="Photo & Adresse" />
      </View>

      {/* ── Zone animée ── */}
      <Animated.View style={s.flex} entering={entering}>
        <ScrollView
          style={s.flex}
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.flatCard}>

            {/* ── Photo de couverture ── */}
            <View style={s.fieldGroup}>
              <View style={s.labelRow}>
                <Text style={s.fieldLabel}>Photo de couverture</Text>
                <View style={s.requiredBadge}><Text style={s.requiredText}>Obligatoire</Text></View>
              </View>
              <Text style={s.fieldSub}>Format 16/9 recommandé</Text>
              <TouchableOpacity style={[s.coverPicker, coverError ? s.coverPickerError : null]} onPress={pickCover} activeOpacity={0.85}>
                {coverUri ? (
                  <>
                    <Image source={{ uri: coverUri }} style={s.coverPreview} />
                    <View style={s.coverOverlay}>
                      <Feather name="edit-2" size={16} color="#fff" />
                      <Text style={s.coverOverlayText}>Changer la photo</Text>
                    </View>
                  </>
                ) : (
                  <View style={s.coverEmpty}>
                    <View style={[s.coverEmptyIcon, coverError ? s.coverEmptyIconError : null]}>
                      <Feather name="camera" size={28} color={coverError ? '#EF4444' : '#C4C9D4'} />
                    </View>
                    <Text style={[s.coverEmptyTitle, coverError ? s.coverEmptyTitleError : null]}>Ajouter une photo</Text>
                    <Text style={s.coverEmptySub}>JPG ou PNG — max 5 Mo</Text>
                  </View>
                )}
              </TouchableOpacity>
              {coverError ? (
                <View style={s.errorRow}>
                  <Feather name="alert-circle" size={12} color="#EF4444" />
                  <Text style={s.errorText}>{coverError}</Text>
                </View>
              ) : null}
            </View>

            <View style={s.sep} />

            {/* ── Adresse ── */}
            <View style={s.fieldGroup}>
              <Text style={s.fieldLabel}>Adresse du commerce</Text>
              <Text style={s.fieldSub}>Choisissez comment renseigner votre adresse</Text>

              <View style={s.modeToggle}>
                <TouchableOpacity style={[s.modeBtn, addressMode === 'manual' && s.modeBtnActive]} onPress={() => setAddressMode('manual')} activeOpacity={0.8}>
                  <Feather name="edit-3" size={14} color={addressMode === 'manual' ? ORANGE : '#9CA3AF'} />
                  <Text style={[s.modeBtnText, addressMode === 'manual' && s.modeBtnTextActive]}>Manuellement</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.modeBtn, addressMode === 'map' && s.modeBtnActive]} onPress={() => setAddressMode('map')} activeOpacity={0.8}>
                  <Feather name="map" size={14} color={addressMode === 'map' ? ORANGE : '#9CA3AF'} />
                  <Text style={[s.modeBtnText, addressMode === 'map' && s.modeBtnTextActive]}>Sur la carte</Text>
                </TouchableOpacity>
              </View>

              {addressMode === 'manual' && (
                <View style={{ gap: 12 }}>
                  <Input label="Ville *" placeholder="Ex : Cotonou" value={manualCity} onChangeText={(t) => { setManualCity(t); setCityError(''); }} error={cityError} leftIcon="map-pin" />
                  <Input label="Quartier *" placeholder="Ex : Cadjehoun, Akpakpa…" value={manualQuartier} onChangeText={(t) => { setManualQuartier(t); setQuartierError(''); }} error={quartierError} leftIcon="navigation" />
                  <Input label="Infos complémentaires" placeholder="Ex : En face du marché…" value={manualDetails} onChangeText={setManualDetails} leftIcon="info" />
                  {manualCity.trim() && manualQuartier.trim() && (
                    <View style={s.addressPreview}>
                      <Feather name="check-circle" size={13} color="#22C55E" />
                      <Text style={s.addressPreviewText} numberOfLines={2}>
                        {manualQuartier.trim()}, {manualCity.trim()}
                        {manualDetails.trim() ? ` — ${manualDetails.trim()}` : ''}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {addressMode === 'map' && (
                businessAddress ? (
                  <TouchableOpacity style={s.addressCard} onPress={() => setAddressPickerVisible(true)} activeOpacity={0.85}>
                    <View style={s.addressCardLeft}>
                      <View style={s.addressIconWrap}><Feather name="map-pin" size={16} color={ORANGE} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.addressCity}>{businessAddress.city}</Text>
                        <Text style={s.addressFull} numberOfLines={2}>{businessAddress.address}</Text>
                      </View>
                    </View>
                    <View style={s.editBtn}>
                      <Feather name="edit-2" size={13} color={ORANGE} />
                      <Text style={s.editBtnText}>Modifier</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={s.addressPlaceholder} onPress={() => setAddressPickerVisible(true)} activeOpacity={0.85}>
                    <View style={s.addressPlaceholderIcon}><Feather name="map-pin" size={24} color="#C4C9D4" /></View>
                    <Text style={s.addressPlaceholderTitle}>Définir l'adresse sur la carte</Text>
                    <Text style={s.addressPlaceholderSub}>Précisez l'emplacement exact de votre commerce</Text>
                    <View style={s.addressCTA}>
                      <Feather name="navigation" size={14} color={ORANGE} />
                      <Text style={s.addressCTAText}>Choisir sur la carte</Text>
                    </View>
                  </TouchableOpacity>
                )
              )}
            </View>

          </View>
        </ScrollView>

        {/* ── Footer ── */}
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.footerRow}>
            <TouchableOpacity style={s.prevBtn} onPress={goBack} activeOpacity={0.8}>
              <Feather name="arrow-left" size={15} color="#6B7280" />
              <Text style={s.prevBtnTxt}>Précédent (1/5)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.nextBtn, validatingAddress && s.nextBtnDisabled]}
              onPress={onNext}
              activeOpacity={0.85}
              disabled={validatingAddress}
            >
              <Text style={s.nextBtnTxt}>{validatingAddress ? 'Vérification…' : 'Suivant'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>

      <BusinessLocationPickerModal
        visible={addressPickerVisible}
        onClose={() => setAddressPickerVisible(false)}
        onConfirm={(result) => { setBusinessAddress(result); setAddressPickerVisible(false); }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F6F3' },
  flex: { flex: 1 },

  navbar:    { backgroundColor: DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 18 },
  navTitle:  { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },

  stepWrap: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },

  content: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },

  flatCard:   { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  fieldGroup: { paddingHorizontal: 18, paddingVertical: 16, gap: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: '#374151', letterSpacing: 0.1 },
  fieldSub:   { fontSize: 12, color: '#9CA3AF', marginTop: -6 },
  sep:        { height: 1, backgroundColor: '#F3F4F6' },

  labelRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requiredBadge: { backgroundColor: '#FEE2E2', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  requiredText:  { fontSize: 10, fontWeight: '700', color: '#EF4444', letterSpacing: 0.3 },

  coverPicker:      { height: 180, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F7F6F3', borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  coverPickerError: { borderColor: '#EF4444' },
  coverPreview:     { width: '100%', height: '100%', resizeMode: 'cover' },
  coverOverlay:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  coverOverlayText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  coverEmpty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  coverEmptyIcon:   { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  coverEmptyIconError: { backgroundColor: '#FEE2E2' },
  coverEmptyTitle:  { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  coverEmptyTitleError: { color: '#EF4444' },
  coverEmptySub:    { fontSize: 12, color: '#9CA3AF' },

  errorRow:  { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: -4 },
  errorText: { fontSize: 12, color: '#EF4444', fontWeight: '500' },

  modeToggle:        { flexDirection: 'row', gap: 8 },
  modeBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F7F6F3' },
  modeBtnActive:     { borderColor: ORANGE, backgroundColor: '#FFF4EF' },
  modeBtnText:       { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  modeBtnTextActive: { color: ORANGE },

  addressPreview:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  addressPreviewText: { flex: 1, fontSize: 12, color: '#166534', fontWeight: '500', lineHeight: 17 },

  addressCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF4EF', borderRadius: 14, padding: 13, borderWidth: 1.5, borderColor: ORANGE, gap: 10 },
  addressCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addressIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  addressCity:     { fontSize: 10, fontWeight: '800', color: ORANGE, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  addressFull:     { fontSize: 13, color: '#374151', lineHeight: 18 },
  editBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText:     { fontSize: 12, fontWeight: '600', color: ORANGE },

  addressPlaceholder:      { borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed', backgroundColor: '#FAFAFA' },
  addressPlaceholderIcon:  { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  addressPlaceholderTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  addressPlaceholderSub:   { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  addressCTA:              { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF0EA', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4, borderWidth: 1, borderColor: '#FDDCCA' },
  addressCTAText:          { fontSize: 13, fontWeight: '700', color: ORANGE },

  footer:            { backgroundColor: 'transparent', paddingHorizontal: 20, paddingTop: 14, gap: 10 },
  footerRow:         { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prevBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9F8F6' },
  prevBtnTxt:        { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  nextBtn:           { flex: 1, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  nextBtnDisabled:   { opacity: 0.6 },
  nextBtnTxt:        { fontSize: 15, fontWeight: '700', color: '#fff' },
});
