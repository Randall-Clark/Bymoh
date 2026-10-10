import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useRef, useState } from 'react';

import {
  Alert, Image, Modal, ScrollView, StyleSheet, Text,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { registerDraft } from './step1';
import { COUNTRIES, Country } from '@/lib/countries';
import { BusinessLocationPickerModal, BusinessAddressResult } from '@/components/BusinessLocationPickerModal';
import { useAuthStore } from '@/stores/authStore';

const ORANGE = '#FF6835';
const DARK   = '#1A1025';

const DIAL_CODES = [
  { code: '+229', flag: '🇧🇯', name: 'Bénin'         },
  { code: '+228', flag: '🇹🇬', name: 'Togo'          },
  { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
  { code: '+221', flag: '🇸🇳', name: 'Sénégal'       },
  { code: '+233', flag: '🇬🇭', name: 'Ghana'         },
  { code: '+237', flag: '🇨🇲', name: 'Cameroun'      },
  { code: '+223', flag: '🇲🇱', name: 'Mali'          },
  { code: '+226', flag: '🇧🇫', name: 'Burkina Faso'  },
  { code: '+227', flag: '🇳🇪', name: 'Niger'         },
];

type AddressMode = 'manual' | 'map';

// ── Validation géographique via OpenStreetMap Nominatim ───────────────────────
async function validateLocationInCountry(locationName: string, countryCode: string): Promise<boolean> {
  try {
    const q   = encodeURIComponent(locationName.trim());
    const cc  = countryCode.toLowerCase();
    const url = `https://nominatim.openstreetmap.org/search?q=${q}&countrycodes=${cc}&format=json&limit=1&accept-language=fr`;
    const res  = await fetch(url, { headers: { 'User-Agent': 'BymohApp/1.0 contact@bymoh.com' } });
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return true; // fail-open en cas d'erreur réseau
  }
}

export default function RegisterStep2() {
  const insets     = useSafeAreaInsets();
  const scrollRef  = useRef<ScrollView>(null);
  const { profile } = useAuthStore();

  const handleCancel = () => {
    router.dismissAll();
    if ((profile as any)?.role === 'pro') {
      router.replace('/(pro)/dashboard' as any);
    } else {
      router.replace('/(client)/' as any);
    }
  };

  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [addressMode, setAddressMode]         = useState<AddressMode>('manual');

  // Mode manuel
  const [manualCity,     setManualCity]     = useState('');
  const [manualQuartier, setManualQuartier] = useState('');
  const [manualDetails,  setManualDetails]  = useState('');
  const [cityError,      setCityError]      = useState('');
  const [quartierError,  setQuartierError]  = useState('');

  // Validation géographique
  const [validatingAddress, setValidatingAddress] = useState(false);

  // Mode carte
  const [addressPickerVisible, setAddressPickerVisible] = useState(false);
  const [businessAddress,      setBusinessAddress]      = useState<BusinessAddressResult | null>(null);

  const [dialCode, setDialCode]                 = useState(DIAL_CODES[0]);
  const [dialModalVisible, setDialModalVisible] = useState(false);
  const [phone, setPhone]                       = useState('');
  const [phoneError, setPhoneError]             = useState('');
  const [coverUri, setCoverUri]                 = useState<string | null>(null);

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setCoverUri(result.assets[0].uri);
  };

  const addressReady = addressMode === 'manual'
    ? manualCity.trim().length > 0 && manualQuartier.trim().length > 0
    : businessAddress !== null;

  const onNext = async () => {
    // Validation adresse
    if (addressMode === 'manual') {
      let ok = true;
      if (!manualCity.trim())     { setCityError('La ville est obligatoire');        ok = false; }
      else setCityError('');
      if (!manualQuartier.trim()) { setQuartierError('Le quartier est obligatoire'); ok = false; }
      else setQuartierError('');
      if (!ok) return;

      // ── Validation géographique Nominatim ─────────────────────────────────
      setValidatingAddress(true);

      // Vérifier la ville
      const cityExists = await validateLocationInCountry(manualCity.trim(), selectedCountry.code);
      if (!cityExists) {
        setValidatingAddress(false);
        setCityError('Ville introuvable dans ce pays');
        Alert.alert(
          'Ville introuvable',
          `"${manualCity.trim()}" n'a pas été trouvé en ${selectedCountry.name}.\n\nVérifiez l'orthographe ou essayez un nom plus général.`,
          [{ text: 'OK' }],
        );
        return;
      }

      // Vérifier le quartier
      const quartierExists = await validateLocationInCountry(manualQuartier.trim(), selectedCountry.code);
      setValidatingAddress(false);
      if (!quartierExists) {
        setQuartierError('Quartier introuvable dans ce pays');
        Alert.alert(
          'Quartier introuvable',
          `"${manualQuartier.trim()}" n'a pas été trouvé en ${selectedCountry.name}.\n\nVérifiez l'orthographe ou essayez un nom plus général (ex : "Cadjehoun" au lieu de "Cadjehoun-nord").`,
          [{ text: 'OK' }],
        );
        return;
      }
      // ──────────────────────────────────────────────────────────────────────
    } else {
      if (!businessAddress) return;
    }

    // Validation téléphone
    if (!phone || phone.length < 6) { setPhoneError('Numéro trop court'); return; }
    setPhoneError('');

    const addressData = addressMode === 'manual'
      ? {
          address:  `${manualQuartier.trim()}, ${manualCity.trim()}${manualDetails.trim() ? ` — ${manualDetails.trim()}` : ''}`,
          city:     manualCity.trim(),
          latitude:  null,
          longitude: null,
          building_type:   null,
          address_floor:   null,
          address_details: manualDetails.trim() || null,
        }
      : {
          address:         businessAddress!.address,
          city:            businessAddress!.city,
          latitude:        businessAddress!.lat,
          longitude:       businessAddress!.lon,
          building_type:   businessAddress!.buildingType,
          address_floor:   businessAddress!.floor,
          address_details: businessAddress!.details,
        };

    Object.assign(registerDraft, {
      phone:        `${dialCode.code}${phone}`,
      cover_uri:    coverUri ?? null,
      country:      selectedCountry.name,
      country_code: selectedCountry.code,
      timezone:     selectedCountry.timezone,
      ...addressData,
    });
    router.push('/(pro)/register/step3' as any);
  };

  return (
    <View style={s.root}>

      {/* ── Navbar sombre ── */}
      <View style={[s.navbar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </TouchableOpacity>
        <Text style={s.navTitle}>Créer mon commerce</Text>
        <TouchableOpacity onPress={handleCancel} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </View>

      {/* ── Indicateur d'étape ── */}
      <View style={s.stepWrap}>
        <StepIndicator current={2} total={5} title="Localisation & Contact" />
      </View>

      <ScrollView
        ref={scrollRef}
        style={s.flex}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Pays ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIcon}><Feather name="globe" size={15} color={ORANGE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Pays du commerce</Text>
              <Text style={s.cardSub}>Sélectionnez le pays où se situe votre commerce</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {COUNTRIES.map((c) => {
              const sel = c.code === selectedCountry.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[s.countryBtn, sel && s.countryBtnSelected]}
                  onPress={() => setSelectedCountry(c)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 22 }}>{c.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.countryBtnText, sel && { color: ORANGE }]}>{c.name}</Text>
                    <Text style={s.countryBtnSub}>{c.dialCode}</Text>
                  </View>
                  {sel && <Feather name="check-circle" size={20} color={ORANGE} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Adresse ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIcon}><Feather name="map-pin" size={15} color={ORANGE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Adresse du commerce</Text>
              <Text style={s.cardSub}>Choisissez comment renseigner votre adresse</Text>
            </View>
          </View>

          {/* Toggle manuel / carte */}
          <View style={s.modeToggle}>
            <TouchableOpacity
              style={[s.modeBtn, addressMode === 'manual' && s.modeBtnActive]}
              onPress={() => setAddressMode('manual')}
              activeOpacity={0.8}
            >
              <Feather name="edit-3" size={14} color={addressMode === 'manual' ? ORANGE : '#9CA3AF'} />
              <Text style={[s.modeBtnText, addressMode === 'manual' && s.modeBtnTextActive]}>
                Saisir manuellement
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.modeBtn, addressMode === 'map' && s.modeBtnActive]}
              onPress={() => setAddressMode('map')}
              activeOpacity={0.8}
            >
              <Feather name="map" size={14} color={addressMode === 'map' ? ORANGE : '#9CA3AF'} />
              <Text style={[s.modeBtnText, addressMode === 'map' && s.modeBtnTextActive]}>
                Utiliser la carte
              </Text>
            </TouchableOpacity>
          </View>

          {/* ── Mode manuel ── */}
          {addressMode === 'manual' && (
            <View style={{ gap: 12 }}>
              <Input
                label="Ville *"
                placeholder="Ex : Cotonou"
                value={manualCity}
                onChangeText={(t) => { setManualCity(t); setCityError(''); }}
                error={cityError}
                leftIcon="map-pin"
              />
              <Input
                label="Quartier *"
                placeholder="Ex : Cadjehoun, Akpakpa, Fidjrossè…"
                value={manualQuartier}
                onChangeText={(t) => { setManualQuartier(t); setQuartierError(''); }}
                error={quartierError}
                leftIcon="navigation"
              />
              <Input
                label="Informations complémentaires"
                placeholder="Ex : En face du marché, près de l'église…"
                value={manualDetails}
                onChangeText={setManualDetails}
                leftIcon="info"
              />
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

          {/* ── Mode carte ── */}
          {addressMode === 'map' && (
            businessAddress ? (
              <TouchableOpacity style={s.addressCard} onPress={() => setAddressPickerVisible(true)} activeOpacity={0.85}>
                <View style={s.addressCardLeft}>
                  <View style={s.addressIconWrap}>
                    <Feather name="map-pin" size={16} color={ORANGE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.addressCity}>{businessAddress.city}</Text>
                    <Text style={s.addressFull} numberOfLines={2}>{businessAddress.address}</Text>
                    {businessAddress.buildingType ? (
                      <Text style={s.addressMeta}>
                        {businessAddress.buildingType}{businessAddress.floor ? ` · ${businessAddress.floor}` : ''}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={s.editBtn}>
                  <Feather name="edit-2" size={13} color={ORANGE} />
                  <Text style={s.editBtnText}>Modifier</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={s.addressPlaceholder} onPress={() => setAddressPickerVisible(true)} activeOpacity={0.85}>
                <View style={s.addressPlaceholderIcon}>
                  <Feather name="map-pin" size={24} color="#C4C9D4" />
                </View>
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

        {/* ── Téléphone ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIcon}><Feather name="phone" size={15} color={ORANGE} /></View>
            <Text style={s.cardTitle}>Téléphone du commerce</Text>
          </View>
          <View style={s.phoneRow}>
            <TouchableOpacity style={s.dialBtn} onPress={() => setDialModalVisible(true)} activeOpacity={0.8}>
              <Text style={s.dialFlag}>{dialCode.flag}</Text>
              <Text style={s.dialCode}>{dialCode.code}</Text>
              <Feather name="chevron-down" size={13} color="#6B7280" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Input
                placeholder="XX XX XX XX"
                value={phone}
                onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                maxLength={10}
                error={phoneError}
              />
            </View>
          </View>
        </View>

        {/* ── Photo de couverture ── */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <View style={s.cardIcon}><Feather name="image" size={15} color={ORANGE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>Photo de couverture</Text>
              <Text style={s.cardSub}>Format 16/9 recommandé — optionnel</Text>
            </View>
          </View>
          <TouchableOpacity style={s.coverPicker} onPress={pickCover} activeOpacity={0.85}>
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
                <View style={s.coverEmptyIcon}>
                  <Feather name="camera" size={28} color="#C4C9D4" />
                </View>
                <Text style={s.coverEmptyTitle}>Ajouter une photo</Text>
                <Text style={s.coverEmptySub}>JPG ou PNG — max 5 Mo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        {!addressReady && (
          <View style={s.footerWarning}>
            <Feather name="alert-triangle" size={13} color="#D97706" />
            <Text style={s.footerWarningText}>
              {addressMode === 'manual'
                ? 'Renseignez la ville et le quartier'
                : 'Veuillez définir l\'adresse sur la carte'}
            </Text>
          </View>
        )}
        <Button
          title={validatingAddress ? 'Vérification…' : 'Suivant →'}
          onPress={onNext}
          fullWidth
          size="lg"
          disabled={validatingAddress}
        />
      </View>

      <BusinessLocationPickerModal
        visible={addressPickerVisible}
        onClose={() => setAddressPickerVisible(false)}
        onConfirm={(result) => { setBusinessAddress(result); setAddressPickerVisible(false); }}
      />

      {/* ── Modal indicatif ── */}
      <Modal visible={dialModalVisible} transparent animationType="fade" onRequestClose={() => setDialModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setDialModalVisible(false)}>
          <View style={s.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={s.modalBox}>
                <View style={s.modalHeader}>
                  <Text style={s.modalTitle}>Choisir l'indicatif</Text>
                  <TouchableOpacity onPress={() => setDialModalVisible(false)}>
                    <Feather name="x" size={20} color="#6B7280" />
                  </TouchableOpacity>
                </View>
                {DIAL_CODES.map((dc) => (
                  <TouchableOpacity
                    key={dc.code}
                    style={[s.dialItem, dc.code === dialCode.code && s.dialItemActive]}
                    onPress={() => { setDialCode(dc); setDialModalVisible(false); }}
                  >
                    <Text style={s.dialItemFlag}>{dc.flag}</Text>
                    <Text style={[s.dialItemName, dc.code === dialCode.code && { color: ORANGE }]}>{dc.name}</Text>
                    <Text style={s.dialItemCode}>{dc.code}</Text>
                    {dc.code === dialCode.code && <Feather name="check" size={16} color={ORANGE} />}
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F6F3' },
  flex: { flex: 1 },

  navbar:    { backgroundColor: DARK, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 18 },
  backBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  navTitle:  { flex: 1, textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelTxt: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.65)' },

  stepWrap: { paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EFEFEF' },

  content: { paddingHorizontal: 16, paddingTop: 18, gap: 14 },

  card:       { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardIcon:   { width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center' },
  cardTitle:  { fontSize: 15, fontWeight: '800', color: '#111827' },
  cardSub:    { fontSize: 12, color: '#9CA3AF', marginTop: 2 },

  countryBtn:         { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 13, borderWidth: 1.5, borderColor: '#EFEFEF', backgroundColor: '#FAFAFA' },
  countryBtnSelected: { borderColor: ORANGE, backgroundColor: '#FFF4EF' },
  countryBtnText:     { fontSize: 14, fontWeight: '700', color: '#111827' },
  countryBtnSub:      { fontSize: 11, color: '#9CA3AF', marginTop: 1 },

  // Toggle mode adresse
  modeToggle:        { flexDirection: 'row', gap: 8 },
  modeBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#FAFAFA' },
  modeBtnActive:     { borderColor: ORANGE, backgroundColor: '#FFF4EF' },
  modeBtnText:       { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },
  modeBtnTextActive: { color: ORANGE },

  // Aperçu adresse manuelle
  addressPreview:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#BBF7D0' },
  addressPreviewText: { flex: 1, fontSize: 12, color: '#166534', fontWeight: '500', lineHeight: 17 },

  // Carte adresse
  addressCard:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF4EF', borderRadius: 14, padding: 13, borderWidth: 1.5, borderColor: ORANGE, gap: 10 },
  addressCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  addressIconWrap: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  addressCity:     { fontSize: 10, fontWeight: '800', color: ORANGE, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 },
  addressFull:     { fontSize: 13, color: '#374151', lineHeight: 18 },
  addressMeta:     { fontSize: 11, color: ORANGE, fontWeight: '600', marginTop: 2 },
  editBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  editBtnText:     { fontSize: 12, fontWeight: '600', color: ORANGE },

  addressPlaceholder:      { borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed', backgroundColor: '#FAFAFA' },
  addressPlaceholderIcon:  { width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  addressPlaceholderTitle: { fontSize: 14, fontWeight: '700', color: '#374151' },
  addressPlaceholderSub:   { fontSize: 12, color: '#9CA3AF', textAlign: 'center' },
  addressCTA:              { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF0EA', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginTop: 4, borderWidth: 1, borderColor: '#FDDCCA' },
  addressCTAText:          { fontSize: 13, fontWeight: '700', color: ORANGE },

  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dialBtn:  { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: '#EFEFEF', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 15, backgroundColor: '#FAFAFA' },
  dialFlag: { fontSize: 18 },
  dialCode: { fontSize: 13, fontWeight: '600', color: '#111827' },

  coverPicker:      { height: 180, borderRadius: 16, overflow: 'hidden', backgroundColor: '#FAFAFA', borderWidth: 1.5, borderColor: '#EFEFEF', borderStyle: 'dashed' },
  coverPreview:     { width: '100%', height: '100%', resizeMode: 'cover' },
  coverOverlay:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  coverOverlayText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  coverEmpty:       { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  coverEmptyIcon:   { width: 60, height: 60, borderRadius: 30, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  coverEmptyTitle:  { fontSize: 14, fontWeight: '700', color: '#6B7280' },
  coverEmptySub:    { fontSize: 12, color: '#9CA3AF' },

  footer:            { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EFEFEF', gap: 10 },
  footerWarning:     { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFBEB', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  footerWarningText: { fontSize: 12, color: '#D97706', fontWeight: '600' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox:      { backgroundColor: '#fff', borderRadius: 22, padding: 8, width: '100%', maxWidth: 360 },
  modalHeader:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 4 },
  modalTitle:    { fontSize: 16, fontWeight: '700', color: '#111827' },
  dialItem:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12 },
  dialItemActive: { backgroundColor: '#FFF4EF' },
  dialItemFlag:  { fontSize: 22 },
  dialItemName:  { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  dialItemCode:  { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
});
