import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Image,
  Keyboard, Modal, Platform, ScrollView, StyleSheet, Text,
  TextInput, TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import MapView, { Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { registerDraft } from './step1';
import { COUNTRIES, Country } from '@/lib/countries';

const DIAL_CODES = [
  { code: '+229', flag: '🇧🇯', name: 'Bénin'         },
  { code: '+228', flag: '🇹🇬', name: 'Togo'          },
  { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
];

const BUILDING_TYPES = ['Commerce', 'Boutique', 'Bureau', 'Marché', 'Domicile', 'Autre'];
const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H   = SCREEN_H * 0.92;
const MAP_H     = 280;
const DEFAULT_LAT = 6.3654;
const DEFAULT_LON = 2.4183;

interface AddressResult {
  label: string;
  city?: string;
  lat: number;
  lon: number;
}

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address: {
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    country?: string;
  };
}

// ── Geocoding via Nominatim (gratuit, aucune clé) ─────────────────────────────
async function searchAddress(query: string): Promise<AddressResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&accept-language=fr`,
      { headers: { 'User-Agent': 'BymohApp/1.0' } }
    );
    const data: NominatimResult[] = await res.json();
    return data.map((item) => ({
      label: item.display_name.split(',').slice(0, 3).join(', '),
      city:  item.address?.city ?? item.address?.town ?? item.address?.village ?? item.address?.county,
      lat:   parseFloat(item.lat),
      lon:   parseFloat(item.lon),
    }));
  } catch { return []; }
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`,
      { headers: { 'User-Agent': 'BymohApp/1.0' } }
    );
    const data = await res.json();
    if (data?.address) {
      const a = data.address;
      const label = [a.road, a.suburb ?? a.neighbourhood, a.city ?? a.town ?? a.village].filter(Boolean).join(', ');
      return label || data.display_name?.split(',').slice(0, 2).join(',') || '';
    }
    return '';
  } catch { return ''; }
}

// ─────────────────────────────────────────────────────────────────────────────
// BusinessAddressPicker
// ─────────────────────────────────────────────────────────────────────────────
function BusinessAddressPicker({
  visible, onClose, onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (r: { address: string; city: string; lat?: number; lon?: number }) => void;
}) {
  const insets  = useSafeAreaInsets();
  const mapRef  = useRef<MapView>(null);
  const slideY  = useRef(new Animated.Value(SCREEN_H)).current;

  const [step, setStep]               = useState<'search' | 'details'>('search');
  const [query, setQuery]             = useState('');
  const [searching, setSearching]     = useState(false);
  const [searchResults, setSearchResults] = useState<AddressResult[]>([]);
  const [gpsLoading, setGpsLoading]   = useState(false);
  const [gpsError, setGpsError]       = useState<string | null>(null);
  const [nearby, setNearby]           = useState<AddressResult | null>(null);
  const [selected, setSelected]       = useState<AddressResult | null>(null);
  const [mapLabel, setMapLabel]       = useState('');
  const [isDragging, setIsDragging]   = useState(false);
  const [geocoding, setGeocoding]     = useState(false);

  const [streetNumber, setStreetNumber] = useState('');
  const [buildingType, setBuildingType] = useState(BUILDING_TYPES[0]);
  const [typeOpen, setTypeOpen]         = useState(false);
  const [complement, setComplement]     = useState('');

  const currentCenter  = useRef({ lat: DEFAULT_LAT, lon: DEFAULT_LON });
  const cachedPos      = useRef<{ lat: number; lon: number } | null>(null);
  const searchTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setStep('search'); setQuery(''); setGpsError(null);
      setMapLabel(''); setSelected(null); setSearchResults([]);
      detectNearby();
      Animated.spring(slideY, { toValue: 0, tension: 68, friction: 12, useNativeDriver: true }).start();
    } else {
      Animated.timing(slideY, { toValue: SHEET_H, duration: 240, useNativeDriver: true }).start();
    }
  }, [visible]);

  const dismiss = () => {
    Keyboard.dismiss();
    Animated.timing(slideY, { toValue: SHEET_H, duration: 240, useNativeDriver: true }).start(() => onClose());
  };

  // ── Recherche avec debounce ────────────────────────────────────────────────
  const onQueryChange = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      const results = await searchAddress(text);
      setSearchResults(results);
      setSearching(false);
    }, 500);
  };

  const detectNearby = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      cachedPos.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo) {
        const label = [geo.street, geo.district ?? geo.subregion, geo.city].filter(Boolean).join(', ');
        setNearby({ label: label || geo.city || 'Position actuelle', city: geo.city ?? undefined, lat: pos.coords.latitude, lon: pos.coords.longitude });
      }
    } catch {}
  };

  const useGPS = async () => {
    if (cachedPos.current && nearby) { goToDetails(nearby); return; }
    setGpsLoading(true); setGpsError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsError('Permission refusée'); return; }
      const pos = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 500 })
        ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo) {
        const label = [geo.street, geo.district ?? geo.subregion, geo.city].filter(Boolean).join(', ');
        goToDetails({ label: label || 'Position actuelle', city: geo.city ?? undefined, lat: pos.coords.latitude, lon: pos.coords.longitude });
      } else { setGpsError('Position non reconnue.'); }
    } catch { setGpsError('Impossible de récupérer votre position.'); }
    finally { setGpsLoading(false); }
  };

  // ── Sélection d'un résultat → centre la carte dessus ──────────────────────
  const goToDetails = (addr: AddressResult) => {
    setSelected(addr);
    setMapLabel(addr.label);
    setStreetNumber(''); setComplement(''); setBuildingType(BUILDING_TYPES[0]);
    currentCenter.current = { lat: addr.lat, lon: addr.lon };
    setStep('details');
    // Anime la carte vers la position recherchée
    setTimeout(() => {
      mapRef.current?.animateToRegion({
        latitude:      addr.lat,
        longitude:     addr.lon,
        latitudeDelta:  0.005,
        longitudeDelta: 0.005,
      }, 700);
    }, 400);
  };

  // ── Mise à jour automatique de l'adresse pendant le déplacement du pin ────
  const onRegionChange = () => {
    setIsDragging(true);
    setMapLabel('Déplacement…');
  };

  const onRegionChangeComplete = (region: Region) => {
    setIsDragging(false);
    currentCenter.current = { lat: region.latitude, lon: region.longitude };

    // Auto-geocoding avec debounce — met à jour le texte en temps réel
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    setGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      const label = await reverseGeocode(region.latitude, region.longitude);
      if (label) {
        setMapLabel(label);
        setSelected((prev) => ({
          ...(prev ?? { label, lat: region.latitude, lon: region.longitude }),
          label,
          lat: region.latitude,
          lon: region.longitude,
        }));
      } else {
        setMapLabel(`${region.latitude.toFixed(5)}, ${region.longitude.toFixed(5)}`);
      }
      setGeocoding(false);
    }, 600);
  };

  const recenterGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = cachedPos.current
        ? { coords: { latitude: cachedPos.current.lat, longitude: cachedPos.current.lon } }
        : await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      mapRef.current?.animateToRegion({
        latitude: pos.coords.latitude, longitude: pos.coords.longitude,
        latitudeDelta: 0.004, longitudeDelta: 0.004,
      }, 500);
    } catch {}
  };

  const confirm = () => {
    if (!selected && !mapLabel) return;
    const fullAddress = [streetNumber, buildingType !== BUILDING_TYPES[0] ? buildingType : '', mapLabel, complement].filter(Boolean).join(', ');
    onConfirm({
      address: fullAddress || mapLabel,
      city:    selected?.city ?? selected?.label ?? '',
      lat:     currentCenter.current.lat,
      lon:     currentCenter.current.lon,
    });
    dismiss();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={dismiss}>
        <Animated.View style={[pickerStyles.backdrop, {
          opacity: slideY.interpolate({ inputRange: [0, SHEET_H], outputRange: [1, 0], extrapolate: 'clamp' }),
        }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[pickerStyles.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={pickerStyles.handle} />

        {/* ── ÉTAPE 1 : Recherche avec geocoding ── */}
        {step === 'search' && (
          <>
            <View style={pickerStyles.pageHeader}>
              <TouchableOpacity onPress={dismiss} style={pickerStyles.backBtn}>
                <Feather name="x" size={20} color="#9CA3AF" />
              </TouchableOpacity>
              <Text style={pickerStyles.pageTitle}>Adresse du commerce</Text>
            </View>

            <View style={pickerStyles.searchWrap}>
              <Feather name="search" size={16} color="#9CA3AF" />
              <TextInput
                style={pickerStyles.searchInput}
                placeholder="Ex : Cotonou, Quartier Haie Vive..."
                placeholderTextColor="#9CA3AF"
                value={query}
                onChangeText={onQueryChange}
                autoCorrect={false}
                autoFocus
              />
              {searching
                ? <ActivityIndicator size="small" color="#FF6835" />
                : query.length > 0 && <TouchableOpacity onPress={() => { setQuery(''); setSearchResults([]); }} hitSlop={8}><Feather name="x-circle" size={16} color="#C4C9D4" /></TouchableOpacity>
              }
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {/* GPS */}
              <TouchableOpacity style={pickerStyles.gpsMainBtn} onPress={useGPS} disabled={gpsLoading}>
                <View style={pickerStyles.gpsMainIcon}>
                  {gpsLoading ? <ActivityIndicator size="small" color="#FF6835" /> : <Feather name="navigation" size={18} color="#FF6835" />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={pickerStyles.gpsMainLabel}>Ma position actuelle</Text>
                  <Text style={pickerStyles.gpsMainSub}>Utiliser le GPS de l'appareil</Text>
                </View>
                <Feather name="chevron-right" size={16} color="#FF6835" />
              </TouchableOpacity>

              {/* Résultats de recherche Nominatim */}
              {searchResults.length > 0 && (
                <>
                  <Text style={pickerStyles.sectionTitle}>Résultats</Text>
                  {searchResults.map((r, i) => (
                    <TouchableOpacity key={i} style={pickerStyles.resultRow} onPress={() => goToDetails(r)}>
                      <View style={pickerStyles.resultIcon}><Feather name="map-pin" size={16} color="#6B7280" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={pickerStyles.resultLabel} numberOfLines={1}>{r.label}</Text>
                        {r.city && <Text style={pickerStyles.resultSub}>{r.city}</Text>}
                      </View>
                      <Feather name="chevron-right" size={14} color="#D1D5DB" />
                    </TouchableOpacity>
                  ))}
                </>
              )}

              {/* Position détectée GPS */}
              {nearby && searchResults.length === 0 && (
                <>
                  <Text style={pickerStyles.sectionTitle}>Position détectée</Text>
                  <TouchableOpacity style={[pickerStyles.resultRow, { backgroundColor: '#F9FAFB' }]} onPress={() => goToDetails(nearby)}>
                    <View style={pickerStyles.resultIcon}><Feather name="crosshair" size={16} color="#111827" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={pickerStyles.resultLabel}>{nearby.label}</Text>
                      {nearby.city && <Text style={pickerStyles.resultSub}>{nearby.city}</Text>}
                    </View>
                  </TouchableOpacity>
                </>
              )}

              {gpsError && (
                <View style={pickerStyles.errorRow}>
                  <Feather name="alert-circle" size={14} color="#EF4444" />
                  <Text style={pickerStyles.errorText}>{gpsError}</Text>
                </View>
              )}

              <View style={{ height: insets.bottom + 40 }} />
            </ScrollView>
          </>
        )}

        {/* ── ÉTAPE 2 : Carte + détails ── */}
        {step === 'details' && (
          <>
            <View style={pickerStyles.pageHeader}>
              <TouchableOpacity onPress={() => setStep('search')} style={pickerStyles.backBtn}>
                <Feather name="arrow-left" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={pickerStyles.pageTitle}>Positionner le commerce</Text>
            </View>

            {/* Carte */}
            <View style={pickerStyles.mapWrapper}>
              <MapView
                ref={mapRef}
                style={pickerStyles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={{
                  latitude:       selected?.lat ?? DEFAULT_LAT,
                  longitude:      selected?.lon ?? DEFAULT_LON,
                  latitudeDelta:  0.005,
                  longitudeDelta: 0.005,
                }}
                onRegionChange={onRegionChange}
                onRegionChangeComplete={onRegionChangeComplete}
                showsUserLocation showsMyLocationButton={false}
                showsCompass={false} toolbarEnabled={false} mapType="standard"
              />

              {/* Pin fixe au centre */}
              <View style={pickerStyles.pinWrap} pointerEvents="none">
                <View style={[pickerStyles.pinShadow, isDragging && pickerStyles.pinShadowUp]} />
                <View style={[pickerStyles.pinBody, isDragging && pickerStyles.pinBodyUp]}>
                  <View style={pickerStyles.pinHead}><View style={pickerStyles.pinDot} /></View>
                  <View style={pickerStyles.pinTip} />
                </View>
              </View>

              {/* Bouton GPS */}
              <TouchableOpacity style={pickerStyles.gpsMapBtn} onPress={recenterGPS}>
                <Feather name="navigation" size={18} color="#FF6835" />
              </TouchableOpacity>
            </View>

            {/* Adresse mise à jour en temps réel */}
            <View style={pickerStyles.resolvedRow}>
              {geocoding
                ? <ActivityIndicator size="small" color="#FF6835" />
                : <Feather name="map-pin" size={14} color={mapLabel && mapLabel !== 'Déplacement…' ? '#FF6835' : '#9CA3AF'} />
              }
              <Text style={[pickerStyles.resolvedText, (!mapLabel || mapLabel === 'Déplacement…') && { color: '#9CA3AF', fontWeight: '400' }]} numberOfLines={2}>
                {mapLabel || 'Déplacez la carte pour positionner votre commerce'}
              </Text>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={pickerStyles.detailsContent}>
                <Text style={pickerStyles.fieldLabel}>Numéro de la rue</Text>
                <TextInput style={pickerStyles.field} placeholder="ex : 42" placeholderTextColor="#9CA3AF" value={streetNumber} onChangeText={setStreetNumber} />

                <Text style={pickerStyles.fieldLabel}>Type de local</Text>
                <TouchableOpacity style={pickerStyles.dropdown} onPress={() => setTypeOpen((v) => !v)}>
                  <Text style={pickerStyles.dropdownValue}>{buildingType}</Text>
                  <Feather name={typeOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" />
                </TouchableOpacity>
                {typeOpen && (
                  <View style={pickerStyles.dropdownMenu}>
                    {BUILDING_TYPES.map((t) => (
                      <TouchableOpacity key={t} style={[pickerStyles.dropdownItem, t === buildingType && pickerStyles.dropdownItemActive]} onPress={() => { setBuildingType(t); setTypeOpen(false); }}>
                        <Text style={[pickerStyles.dropdownItemText, t === buildingType && { color: '#FF6835' }]}>{t}</Text>
                        {t === buildingType && <Feather name="check" size={14} color="#FF6835" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                <Text style={pickerStyles.fieldLabel}>Complément <Text style={{ fontWeight: '400', color: '#9CA3AF' }}>(optionnel)</Text></Text>
                <TextInput style={pickerStyles.field} placeholder="ex : Face à la pharmacie" placeholderTextColor="#9CA3AF" value={complement} onChangeText={setComplement} />
              </View>
              <View style={{ height: 160 }} />
            </ScrollView>

            <View style={[pickerStyles.confirmFooter, { paddingBottom: insets.bottom + 16 }]}>
              <TouchableOpacity
                style={[pickerStyles.confirmBtn, (!mapLabel || mapLabel === 'Déplacement…') && { backgroundColor: '#D1D5DB' }]}
                onPress={confirm}
                disabled={!mapLabel || mapLabel === 'Déplacement…'}
                activeOpacity={0.88}
              >
                <Text style={pickerStyles.confirmBtnText}>Valider l'adresse du commerce</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 principal
// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterStep2() {
  const insets    = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  // Pays du commerce — initialisé selon le profil utilisateur
  const [selectedCountry, setSelectedCountry] = useState<Country>(COUNTRIES[0]);
  const [addressPickerVisible, setAddressPickerVisible] = useState(false);
  const [businessAddress, setBusinessAddress] = useState<{
    address: string; city: string; lat?: number; lon?: number;
  } | null>(null);

  const [dialCode, setDialCode]               = useState(DIAL_CODES[0]);
  const [dialModalVisible, setDialModalVisible] = useState(false);
  const [phone, setPhone]                     = useState('');
  const [phoneError, setPhoneError]           = useState('');
  const [coverUri, setCoverUri]               = useState<string | null>(null);

  const pickCover = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setCoverUri(result.assets[0].uri);
  };

  const onNext = () => {
    if (!businessAddress) return;
    if (!phone || phone.length < 6) { setPhoneError('Numéro trop court'); return; }
    setPhoneError('');
    Object.assign(registerDraft, {
      phone:        `${dialCode.code}${phone}`,
      address:      businessAddress.address,
      city:         businessAddress.city,
      latitude:     businessAddress.lat ?? null,
      longitude:    businessAddress.lon ?? null,
      cover_uri:    coverUri ?? null,
      country:      selectedCountry.name,
      country_code: selectedCountry.code,
      timezone:     selectedCountry.timezone,
    });
    router.push('/(pro)/register/step3' as any);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.stepWrap}>
        <StepIndicator current={2} total={5} title="Localisation & Contact" />
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Pays du commerce */}
        <View style={styles.section}>
          <Text style={styles.label}>Pays du commerce *</Text>
          <Text style={styles.hint}>Sélectionnez le pays où se situe votre commerce</Text>
          <View style={{ gap: 8, marginTop: 4 }}>
            {COUNTRIES.map((c) => {
              const sel = c.code === selectedCountry.code;
              return (
                <TouchableOpacity
                  key={c.code}
                  style={[
                    styles.countryBtn,
                    sel && styles.countryBtnSelected,
                  ]}
                  onPress={() => setSelectedCountry(c)}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 22 }}>{c.flag}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.countryBtnText, sel && { color: '#FF6835' }]}>{c.name}</Text>
                    <Text style={styles.countryBtnSub}>{c.dialCode}</Text>
                  </View>
                  {sel && <Feather name="check-circle" size={20} color="#FF6835" />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Adresse */}
        <View style={styles.section}>
          <Text style={styles.label}>Adresse du commerce *</Text>
          {businessAddress ? (
            <TouchableOpacity style={styles.addressCard} onPress={() => setAddressPickerVisible(true)} activeOpacity={0.85}>
              <View style={styles.addressCardLeft}>
                <View style={styles.addressCardIcon}>
                  <Feather name="map-pin" size={18} color="#FF6835" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.addressCardCity}>{businessAddress.city}</Text>
                  <Text style={styles.addressCardFull} numberOfLines={2}>{businessAddress.address}</Text>
                </View>
              </View>
              <View style={styles.editAddressBtn}>
                <Feather name="edit-2" size={14} color="#FF6835" />
                <Text style={styles.editAddressText}>Modifier</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.addressPlaceholder} onPress={() => setAddressPickerVisible(true)} activeOpacity={0.85}>
              <Feather name="map-pin" size={22} color="#9CA3AF" />
              <Text style={styles.addressPlaceholderText}>Définir l'adresse sur la carte</Text>
              <Text style={styles.addressPlaceholderSub}>Précisez l'emplacement exact de votre commerce</Text>
              <View style={styles.addressPlaceholderBtn}>
                <Feather name="navigation" size={14} color="#FF6835" />
                <Text style={styles.addressPlaceholderBtnText}>Choisir sur la carte</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Téléphone */}
        <View style={styles.section}>
          <Text style={styles.label}>Téléphone du commerce *</Text>
          <View style={styles.phoneRow}>
            <TouchableOpacity style={styles.dialBtn} onPress={() => setDialModalVisible(true)} activeOpacity={0.8}>
              <Text style={styles.dialFlag}>{dialCode.flag}</Text>
              <Text style={styles.dialCode}>{dialCode.code}</Text>
              <Feather name="chevron-down" size={13} color="#6B7280" />
            </TouchableOpacity>
            <View style={styles.phoneInput}>
              <Input placeholder="XX XX XX XX" value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" maxLength={10} error={phoneError} />
            </View>
          </View>
        </View>

        {/* Photo couverture */}
        <View style={styles.section}>
          <Text style={styles.label}>Photo de couverture</Text>
          <Text style={styles.hint}>Format 16/9 recommandé</Text>
          <TouchableOpacity style={styles.coverPicker} onPress={pickCover} activeOpacity={0.85}>
            {coverUri ? (
              <>
                <Image source={{ uri: coverUri }} style={styles.coverPreview} />
                <View style={styles.coverOverlay}>
                  <Feather name="edit-2" size={18} color="#fff" />
                  <Text style={styles.coverOverlayText}>Changer la photo</Text>
                </View>
              </>
            ) : (
              <View style={styles.coverPlaceholder}>
                <Feather name="image" size={32} color="#9CA3AF" />
                <Text style={styles.coverPlaceholderText}>Appuyez pour ajouter une photo</Text>
                <Text style={styles.coverPlaceholderSub}>JPG ou PNG — max 5 Mo</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {!businessAddress && <Text style={styles.footerHint}>⚠️ Veuillez définir l'adresse du commerce</Text>}
        <Button title="Suivant →" onPress={onNext} fullWidth size="lg" />
      </View>

      <BusinessAddressPicker
        visible={addressPickerVisible}
        onClose={() => setAddressPickerVisible(false)}
        onConfirm={(result) => { setBusinessAddress(result); setAddressPickerVisible(false); }}
      />

      <Modal visible={dialModalVisible} transparent animationType="fade" onRequestClose={() => setDialModalVisible(false)}>
        <TouchableWithoutFeedback onPress={() => setDialModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalBox}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Choisir l'indicatif</Text>
                  <TouchableOpacity onPress={() => setDialModalVisible(false)}><Feather name="x" size={20} color="#6B7280" /></TouchableOpacity>
                </View>
                {DIAL_CODES.map((dc) => (
                  <TouchableOpacity key={dc.code} style={[styles.dialItem, dc.code === dialCode.code && styles.dialItemActive]} onPress={() => { setDialCode(dc); setDialModalVisible(false); }}>
                    <Text style={styles.dialItemFlag}>{dc.flag}</Text>
                    <Text style={[styles.dialItemName, dc.code === dialCode.code && { color: '#FF6835' }]}>{dc.name}</Text>
                    <Text style={styles.dialItemCode}>{dc.code}</Text>
                    {dc.code === dialCode.code && <Feather name="check" size={16} color="#FF6835" />}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepWrap: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#F8F7F4' },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 24 },
  section: { gap: 8 },
  label: { fontSize: 13, fontWeight: '700', color: '#374151' },
  hint: { fontSize: 12, color: '#9CA3AF', marginTop: -4 },
  addressCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#FF6835', shadowColor: '#FF6835', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 3 },
  addressCardLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  addressCardIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  addressCardCity: { fontSize: 11, fontWeight: '700', color: '#FF6835', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  addressCardFull: { fontSize: 13, color: '#374151', lineHeight: 18 },
  editAddressBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FEF2EC', borderRadius: 100, paddingHorizontal: 10, paddingVertical: 6 },
  editAddressText: { fontSize: 12, fontWeight: '600', color: '#FF6835' },
  addressPlaceholder: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed' },
  addressPlaceholderText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  addressPlaceholderSub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
  addressPlaceholderBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2EC', borderRadius: 100, paddingHorizontal: 16, paddingVertical: 10, marginTop: 6, borderWidth: 1, borderColor: '#FDDCCA' },
  addressPlaceholderBtnText: { fontSize: 14, fontWeight: '700', color: '#FF6835' },
  phoneRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dialBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 15, backgroundColor: '#fff' },
  dialFlag: { fontSize: 18 },
  dialCode: { fontSize: 13, fontWeight: '600', color: '#111827' },
  phoneInput: { flex: 1 },
  coverPicker: { height: 180, borderRadius: 16, borderWidth: 1.5, borderColor: '#E5E7EB', borderStyle: 'dashed', overflow: 'hidden', backgroundColor: '#fff' },
  coverPreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  coverOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10 },
  coverOverlayText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  coverPlaceholderText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  coverPlaceholderSub: { fontSize: 12, color: '#9CA3AF' },
  footer: { backgroundColor: '#F8F7F4', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', gap: 8 },
  footerHint: { fontSize: 12, color: '#F59E0B', textAlign: 'center', fontWeight: '600' },
  countryBtn:         { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  countryBtnSelected: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  countryBtnText:     { fontSize: 15, fontWeight: '700', color: '#111827' },
  countryBtnSub:      { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalBox: { backgroundColor: '#fff', borderRadius: 20, padding: 8, width: '100%', maxWidth: 360 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', marginBottom: 4 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  dialItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 12 },
  dialItemActive: { backgroundColor: '#FEF2EC' },
  dialItemFlag: { fontSize: 22 },
  dialItemName: { flex: 1, fontSize: 15, fontWeight: '600', color: '#111827' },
  dialItemCode: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
});

const pickerStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_H, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 12, backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 13 : 11 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },
  gpsMainBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginVertical: 8, backgroundColor: '#FEF2EC', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#FDDCCA' },
  gpsMainIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  gpsMainLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  gpsMainSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 6 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  resultIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  resultLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  resultSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10 },
  errorText: { fontSize: 13, color: '#EF4444' },
  mapWrapper: { height: MAP_H, position: 'relative', overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFillObject },
  pinWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pinBody: { alignItems: 'center', transform: [{ translateY: -22 }] },
  pinBodyUp: { transform: [{ translateY: -32 }] },
  pinHead: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF6835', borderWidth: 3.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#FF6835', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 8 },
  pinDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  pinTip: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FF6835', marginTop: -1 },
  pinShadow: { width: 14, height: 6, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.2)', transform: [{ translateY: 16 }] },
  pinShadowUp: { width: 8, height: 4, opacity: 0.1 },
  gpsMapBtn: { position: 'absolute', bottom: 14, right: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#F8F7F4', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', minHeight: 52 },
  resolvedText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  detailsContent: { paddingHorizontal: 20, paddingTop: 8, gap: 6 },
  fieldLabel: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 },
  field: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 11, fontSize: 15, color: '#111827' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 11 },
  dropdownValue: { fontSize: 15, color: '#111827' },
  dropdownMenu: { backgroundColor: '#fff', borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 6 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  dropdownItemActive: { backgroundColor: '#FEF2EC' },
  dropdownItemText: { fontSize: 15, color: '#111827' },
  confirmFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  confirmBtn: { backgroundColor: '#FF6835', borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
