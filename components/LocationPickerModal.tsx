import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Keyboard, Linking,
  Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import MapView, { Marker, Region, PROVIDER_GOOGLE } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocationStore } from '@/stores/locationStore';
import { supabase } from '@/lib/supabase';
import { ALL_CITIES } from '@/types';

interface Props { visible: boolean; onClose: () => void; }
type Step = 'view' | 'search' | 'details';
interface AddressResult { label: string; sublabel?: string; lat?: number; lon?: number; }

const BUILDING_TYPES = ['Maison', 'Appartement', 'Bureau', 'Commerce', 'Autre'];
const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.92;
const MAP_H = 300;
const PREVIEW_H = 200;
const DEFAULT_LAT = 6.3654;
const DEFAULT_LON = 2.4183;

const RECENTS: AddressResult[] = [
  { label: 'Marché de Tokpa',     sublabel: 'Cotonou, Bénin', lat: 6.3667, lon: 2.4167 },
  { label: 'Carrefour Cadjèhoun', sublabel: 'Cotonou, Bénin', lat: 6.3600, lon: 2.4100 },
  { label: "Stade de l'Amitié",   sublabel: 'Cotonou, Bénin', lat: 6.3570, lon: 2.4220 },
];

export function LocationPickerModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const store = useLocationStore() as any;
  const {
    city: savedCity, address: savedAddress,
    lat: savedLat, lon: savedLon,
    setCity, setAddress, setCoords, clearCity,
  } = store;

  const mapRef    = useRef<MapView>(null);
  const previewRef = useRef<MapView>(null);

  const hasAddress = !!(savedAddress || savedCity);
  const hasCoords  = !!(savedLat && savedLon);

  const [step, setStep]                         = useState<Step>(hasAddress ? 'view' : 'search');
  const [query, setQuery]                       = useState('');
  const [gpsLoading, setGpsLoading]             = useState(false);
  const [gpsError, setGpsError]                 = useState<string | null>(null);
  const [nearbyAddress, setNearbyAddress]       = useState<AddressResult | null>(null);
  const [selectedAddress, setSelectedAddress]   = useState<AddressResult | null>(null);
  const [mapAddress, setMapAddress]             = useState('');
  const [geocoding, setGeocoding]               = useState(false);
  const [isDragging, setIsDragging]             = useState(false);

  const cachedPosition  = useRef<{ lat: number; lon: number } | null>(null);
  const currentCenter   = useRef({ lat: savedLat ?? DEFAULT_LAT, lon: savedLon ?? DEFAULT_LON });

  const [streetNumber, setStreetNumber]         = useState('');
  const [buildingType, setBuildingType]         = useState(BUILDING_TYPES[0]);
  const [buildingTypeOpen, setBuildingTypeOpen] = useState(false);
  const [aptUnit, setAptUnit]                   = useState('');
  const [buildingName, setBuildingName]         = useState('');
  const [buzzerCode, setBuzzerCode]             = useState('');

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  useEffect(() => {
    if (visible) {
      setQuery(''); setGpsError(null); setMapAddress(''); setSelectedAddress(null);
      setStep(hasAddress ? 'view' : 'search');
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

  const detectNearby = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      cachedPosition.current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo) {
        const label = [geo.street, geo.district ?? geo.subregion, geo.city].filter(Boolean).join(', ');
        setNearbyAddress({ label: label || geo.city || 'Position actuelle', sublabel: geo.city ?? undefined, lat: pos.coords.latitude, lon: pos.coords.longitude });
      }
    } catch {}
  };

  const useGPS = async () => {
    if (cachedPosition.current && nearbyAddress) { goToDetails(nearbyAddress); return; }
    setGpsLoading(true); setGpsError(null);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { setGpsError('Permission refusée'); return; }
      const pos = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 500 })
        ?? await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const [geo] = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      if (geo) {
        const label = [geo.street, geo.district ?? geo.subregion, geo.city].filter(Boolean).join(', ');
        goToDetails({ label: label || 'Position actuelle', sublabel: geo.city ?? undefined, lat: pos.coords.latitude, lon: pos.coords.longitude });
      } else { setGpsError('Position non reconnue.'); }
    } catch { setGpsError('Impossible de récupérer votre position.'); }
    finally { setGpsLoading(false); }
  };

  const goToDetails = (addr: AddressResult) => {
    setSelectedAddress(addr);
    setMapAddress(addr.label);
    setStreetNumber(''); setAptUnit(''); setBuildingName('');
    setBuzzerCode(''); setBuildingType(BUILDING_TYPES[0]);
    const lat = addr.lat ?? DEFAULT_LAT;
    const lon = addr.lon ?? DEFAULT_LON;
    currentCenter.current = { lat, lon };
    setStep('details');
    setTimeout(() => {
      mapRef.current?.animateToRegion({ latitude: lat, longitude: lon, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 600);
    }, 400);
  };

  const onRegionChange = () => setIsDragging(true);
  const onRegionChangeComplete = (region: Region) => {
    setIsDragging(false);
    currentCenter.current = { lat: region.latitude, lon: region.longitude };
  };

  const handlePinpoint = async () => {
    const { lat, lon } = currentCenter.current;
    setGeocoding(true);
    try {
      const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (geo) {
        const label = [geo.street, geo.district ?? geo.subregion, geo.postalCode, geo.city].filter(Boolean).join(', ');
        setMapAddress(label || `${lat.toFixed(5)}, ${lon.toFixed(5)}`);
        setSelectedAddress({ label: label || 'Position sélectionnée', sublabel: geo.city ?? undefined, lat, lon });
      }
    } catch { setMapAddress(`${lat.toFixed(5)}, ${lon.toFixed(5)}`); }
    finally { setGeocoding(false); }
  };

  const recenterGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = cachedPosition.current
        ? { coords: { latitude: cachedPosition.current.lat, longitude: cachedPosition.current.lon } }
        : await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      mapRef.current?.animateToRegion({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, latitudeDelta: 0.004, longitudeDelta: 0.004 }, 500);
    } catch {}
  };

  // ── Confirme et sauvegarde ─────────────────────────────────────────────────
  const confirm = async () => {
    if (!selectedAddress) return;
    const fullAddress = [streetNumber, selectedAddress.label, aptUnit, buildingName].filter(Boolean).join(', ');
    const city = selectedAddress.sublabel ?? selectedAddress.label;
    const lat  = selectedAddress.lat ?? null;
    const lon  = selectedAddress.lon ?? null;

    setCity(city);
    setAddress(fullAddress);
    if (lat && lon && typeof setCoords === 'function') setCoords(lat, lon);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('users').update({
          delivery_address: fullAddress,
          delivery_city: city,
          delivery_lat: lat,
          delivery_lon: lon,
        }).eq('id', user.id);
      }
    } catch (err) {
      console.warn('[LocationPicker] Sauvegarde échouée:', err);
    }
    dismiss();
  };

  // ── Partager avec vrai lien Google Maps ───────────────────────────────────
  const shareAddress = async () => {
    const addr = savedAddress ?? savedCity ?? '';
    let googleMapsUrl: string;

    if (savedLat && savedLon) {
      // Lien avec coordonnées exactes — s'ouvre directement au bon endroit
      googleMapsUrl = `https://www.google.com/maps?q=${savedLat},${savedLon}`;
    } else {
      // Lien avec adresse texte
      googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
    }

    try {
      await Share.share({
        message: `Mon adresse de livraison Bymoh :\n${addr}\n\n📍 Voir sur Google Maps :\n${googleMapsUrl}`,
        url: googleMapsUrl, // iOS uniquement — affiche l'URL séparément
      });
    } catch {}
  };

  // ── Ouvrir Google Maps directement ────────────────────────────────────────
  const openInGoogleMaps = async () => {
    const url = savedLat && savedLon
      ? `https://www.google.com/maps?q=${savedLat},${savedLon}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(savedAddress ?? '')}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) Linking.openURL(url);
  };

  const cityResults = ALL_CITIES.filter(
    (c) => query && (c.name.toLowerCase().includes(query.toLowerCase()) || c.country.toLowerCase().includes(query.toLowerCase()))
  );

  // ── ÉTAPE 0 : Vue adresse enregistrée ─────────────────────────────────────
  const renderView = () => (
    <>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Mon adresse de livraison</Text>
        <TouchableOpacity onPress={dismiss} style={styles.closeBtn}>
          <Feather name="x" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>

        {/* ── Mini carte de prévisualisation ── */}
        {hasCoords ? (
          <View style={styles.previewMapWrapper}>
            <MapView
              ref={previewRef}
              style={styles.previewMap}
              provider={PROVIDER_GOOGLE}
              initialRegion={{
                latitude: savedLat,
                longitude: savedLon,
                latitudeDelta: 0.003,
                longitudeDelta: 0.003,
              }}
              // ── Non interagissable ──
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
              showsUserLocation={false}
              showsCompass={false}
              showsMyLocationButton={false}
              mapType="standard"
            >
              {/* Marqueur rouge à la position exacte */}
              <Marker
                coordinate={{ latitude: savedLat, longitude: savedLon }}
                pinColor="#FF6835"
              />
            </MapView>

            {/* Bouton "Ouvrir dans Google Maps" par-dessus la carte */}
            <TouchableOpacity style={styles.openMapsBtn} onPress={openInGoogleMaps} activeOpacity={0.88}>
              <Feather name="external-link" size={13} color="#fff" />
              <Text style={styles.openMapsBtnText}>Ouvrir dans Google Maps</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.previewPlaceholder}>
            <Feather name="map" size={32} color="#D1D5DB" />
            <Text style={styles.previewPlaceholderText}>Carte non disponible</Text>
            <Text style={styles.previewPlaceholderSub}>Les coordonnées ne sont pas enregistrées</Text>
          </View>
        )}

        <View style={styles.viewContent}>
          {/* Adresse */}
          <View style={styles.addressCard}>
            <View style={styles.addressCardIcon}>
              <Feather name="map-pin" size={20} color="#FF6835" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.addressCardLabel}>Adresse enregistrée</Text>
              <Text style={styles.addressCardValue}>
                {savedAddress ?? savedCity ?? 'Aucune adresse'}
              </Text>
            </View>
          </View>

          {/* Bouton Partager */}
          <TouchableOpacity style={styles.shareBtn} onPress={shareAddress} activeOpacity={0.8}>
            <Feather name="share-2" size={17} color="#1E3A5F" />
            <Text style={styles.shareBtnText}>Partager mon adresse</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.divider} />
          </View>

          {/* Bouton Modifier */}
          <TouchableOpacity style={styles.modifyBtn} onPress={() => setStep('search')} activeOpacity={0.88}>
            <Feather name="edit-2" size={17} color="#fff" />
            <Text style={styles.modifyBtnText}>Modifier l'adresse</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </>
  );

  // ── ÉTAPE 1 : Recherche ───────────────────────────────────────────────────
  const renderSearch = () => (
    <>
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={() => hasAddress ? setStep('view') : dismiss()} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Choisir une adresse</Text>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color="#9CA3AF" />
        <TextInput style={styles.searchInput} placeholder="Rechercher une adresse" placeholderTextColor="#9CA3AF" value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="words" />
        {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><Feather name="x-circle" size={16} color="#C4C9D4" /></TouchableOpacity>}
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {query.length > 1 ? (
          <>
            <TouchableOpacity style={styles.gpsRow} onPress={useGPS} disabled={gpsLoading}>
              <View style={styles.gpsRowIcon}>{gpsLoading ? <ActivityIndicator size="small" color="#FF6835" /> : <Feather name="navigation" size={16} color="#FF6835" />}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsRowLabel}>Utiliser ma position actuelle</Text>
                {gpsError && <Text style={styles.gpsRowError}>{gpsError}</Text>}
              </View>
            </TouchableOpacity>
            {query.trim().length > 2 && (
              <TouchableOpacity style={styles.resultRow} onPress={() => goToDetails({ label: query.trim(), lat: DEFAULT_LAT, lon: DEFAULT_LON })}>
                <View style={styles.resultIcon}><Feather name="map-pin" size={16} color="#6B7280" /></View>
                <View style={{ flex: 1 }}><Text style={styles.resultLabel}>{query.trim()}</Text><Text style={styles.resultSub}>Affiner sur la carte</Text></View>
                <Feather name="chevron-right" size={14} color="#D1D5DB" />
              </TouchableOpacity>
            )}
            {cityResults.map((c) => (
              <TouchableOpacity key={c.id} style={styles.resultRow} onPress={() => goToDetails({ label: c.name, sublabel: c.country })}>
                <View style={styles.resultIcon}><Text style={{ fontSize: 18 }}>{c.flag}</Text></View>
                <View style={{ flex: 1 }}><Text style={styles.resultLabel}>{c.name}</Text><Text style={styles.resultSub}>{c.country}</Text></View>
                <Feather name="chevron-right" size={14} color="#D1D5DB" />
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.gpsMainBtn} onPress={useGPS} disabled={gpsLoading}>
              <View style={styles.gpsMainIcon}>{gpsLoading ? <ActivityIndicator size="small" color="#FF6835" /> : <Feather name="navigation" size={18} color="#FF6835" />}</View>
              <View style={{ flex: 1 }}><Text style={styles.gpsMainLabel}>Utiliser ma position actuelle</Text><Text style={styles.gpsMainSub}>Détection automatique par GPS</Text></View>
              <Feather name="chevron-right" size={16} color="#FF6835" />
            </TouchableOpacity>
            {nearbyAddress && (
              <>
                <Text style={styles.sectionTitle}>Adresses à proximité</Text>
                <TouchableOpacity style={[styles.resultRow, styles.resultRowHighlight]} onPress={() => goToDetails(nearbyAddress)}>
                  <View style={styles.resultIcon}><Feather name="map-pin" size={16} color="#111827" /></View>
                  <View style={{ flex: 1 }}><Text style={styles.resultLabel}>{nearbyAddress.label}</Text>{nearbyAddress.sublabel && <Text style={styles.resultSub}>{nearbyAddress.sublabel}</Text>}</View>
                </TouchableOpacity>
              </>
            )}
            <Text style={styles.sectionTitle}>Adresses précédentes</Text>
            {RECENTS.map((r, i) => (
              <TouchableOpacity key={i} style={styles.resultRow} onPress={() => goToDetails(r)}>
                <View style={styles.resultIcon}><Feather name="map-pin" size={16} color="#9CA3AF" /></View>
                <View style={{ flex: 1 }}><Text style={styles.resultLabel}>{r.label}</Text>{r.sublabel && <Text style={styles.resultSub}>{r.sublabel}</Text>}</View>
              </TouchableOpacity>
            ))}
          </>
        )}
        <View style={{ height: insets.bottom + 40 }} />
      </ScrollView>
    </>
  );

  // ── ÉTAPE 2 : Carte Google Maps + Détails ─────────────────────────────────
  const renderDetails = () => (
    <>
      <View style={styles.pageHeader}>
        <TouchableOpacity onPress={() => setStep('search')} style={styles.backBtn}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Choisir sur la carte</Text>
      </View>

      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{ latitude: selectedAddress?.lat ?? DEFAULT_LAT, longitude: selectedAddress?.lon ?? DEFAULT_LON, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
          onRegionChange={onRegionChange}
          onRegionChangeComplete={onRegionChangeComplete}
          showsUserLocation showsMyLocationButton={false}
          showsCompass={false} toolbarEnabled={false} mapType="standard"
        />
        <View style={styles.pinWrap} pointerEvents="none">
          <View style={[styles.pinShadow, isDragging && styles.pinShadowUp]} />
          <View style={[styles.pinBody, isDragging && styles.pinBodyUp]}>
            <View style={styles.pinHead}><View style={styles.pinHeadDot} /></View>
            <View style={styles.pinTip} />
          </View>
        </View>
        <TouchableOpacity style={styles.gpsMapBtn} onPress={recenterGPS} activeOpacity={0.8}>
          <Feather name="navigation" size={18} color="#FF6835" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pinpointBtn, geocoding && { opacity: 0.8 }]} onPress={handlePinpoint} disabled={geocoding} activeOpacity={0.88}>
          {geocoding ? <ActivityIndicator size="small" color="#fff" /> : <><Feather name="crosshair" size={15} color="#fff" /><Text style={styles.pinpointText}>Pointer ici</Text></>}
        </TouchableOpacity>
      </View>

      <View style={styles.resolvedRow}>
        <Feather name="map-pin" size={14} color={mapAddress ? '#FF6835' : '#9CA3AF'} />
        <Text style={[styles.resolvedText, !mapAddress && styles.resolvedPlaceholder]} numberOfLines={2}>
          {isDragging ? 'Déplacement…' : mapAddress || 'Déplacez la carte puis appuyez sur "Pointer ici"'}
        </Text>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.detailsContent}>
          <Text style={styles.fieldLabel}>Numéro de la rue</Text>
          <TextInput style={styles.field} placeholder="ex : 42" placeholderTextColor="#9CA3AF" value={streetNumber} onChangeText={setStreetNumber} />

          <Text style={styles.fieldLabel}>Type de bâtiment</Text>
          <TouchableOpacity style={styles.dropdown} onPress={() => setBuildingTypeOpen((v) => !v)}>
            <Text style={styles.dropdownValue}>{buildingType}</Text>
            <Feather name={buildingTypeOpen ? 'chevron-up' : 'chevron-down'} size={16} color="#6B7280" />
          </TouchableOpacity>
          {buildingTypeOpen && (
            <View style={styles.dropdownMenu}>
              {BUILDING_TYPES.map((t) => (
                <TouchableOpacity key={t} style={[styles.dropdownItem, t === buildingType && styles.dropdownItemActive]} onPress={() => { setBuildingType(t); setBuildingTypeOpen(false); }}>
                  <Text style={[styles.dropdownItemText, t === buildingType && { color: '#FF6835' }]}>{t}</Text>
                  {t === buildingType && <Feather name="check" size={14} color="#FF6835" />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Text style={styles.fieldLabel}>Appartement / Étage <Text style={styles.optional}>(optionnel)</Text></Text>
          <TextInput style={styles.field} placeholder="ex : Apt 3B" placeholderTextColor="#9CA3AF" value={aptUnit} onChangeText={setAptUnit} />
          <Text style={styles.fieldLabel}>Nom du bâtiment <Text style={styles.optional}>(optionnel)</Text></Text>
          <TextInput style={styles.field} placeholder="ex : Résidence Les Cocotiers" placeholderTextColor="#9CA3AF" value={buildingName} onChangeText={setBuildingName} />
          <Text style={styles.fieldLabel}>Code d'entrée <Text style={styles.optional}>(optionnel)</Text></Text>
          <TextInput style={styles.field} placeholder="ex : 1234#" placeholderTextColor="#9CA3AF" value={buzzerCode} onChangeText={setBuzzerCode} />
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.confirmFooter, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={[styles.confirmBtn, !mapAddress && styles.confirmBtnDisabled]} onPress={confirm} activeOpacity={0.88} disabled={!mapAddress}>
          <Text style={styles.confirmBtnText}>Confirmer cette adresse</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={dismiss}>
        <Animated.View style={[styles.backdrop, { opacity: slideY.interpolate({ inputRange: [0, SHEET_H], outputRange: [1, 0], extrapolate: 'clamp' }) }]} />
      </TouchableWithoutFeedback>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={styles.handleZone}><View style={styles.handle} /></View>
        {step === 'view'    && renderView()}
        {step === 'search'  && renderSearch()}
        {step === 'details' && renderDetails()}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SHEET_H, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handleZone: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  closeBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  pageTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: '#111827' },

  // ── Vue adresse ──
  previewMapWrapper: { height: PREVIEW_H, position: 'relative', overflow: 'hidden' },
  previewMap: { ...StyleSheet.absoluteFillObject },
  openMapsBtn: {
    position: 'absolute', bottom: 12, right: 12,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 100,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  openMapsBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  previewPlaceholder: { height: 120, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', gap: 8 },
  previewPlaceholderText: { fontSize: 14, fontWeight: '600', color: '#9CA3AF' },
  previewPlaceholderSub: { fontSize: 12, color: '#C4C9D4' },

  viewContent: { padding: 20, gap: 14 },
  addressCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F8F7F4', borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: '#E5E7EB' },
  addressCardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  addressCardLabel: { fontSize: 11, fontWeight: '600', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  addressCardValue: { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 22 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F3F4F6', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  shareBtnText: { fontSize: 14, fontWeight: '600', color: '#1E3A5F' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divider: { flex: 1, height: 1, backgroundColor: '#F3F4F6' },
  dividerText: { fontSize: 13, color: '#9CA3AF' },
  modifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FF6835', borderRadius: 14, padding: 16, shadowColor: '#FF6835', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  modifyBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  // ── Recherche ──
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, marginBottom: 12, backgroundColor: '#F3F4F6', borderRadius: 100, paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 13 : 11 },
  searchInput: { flex: 1, fontSize: 15, color: '#111827', padding: 0 },
  gpsMainBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginVertical: 8, backgroundColor: '#FEF2EC', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#FDDCCA' },
  gpsMainIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  gpsMainLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
  gpsMainSub: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  gpsRowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  gpsRowLabel: { fontSize: 14, fontWeight: '600', color: '#FF6835' },
  gpsRowError: { fontSize: 12, color: '#EF4444', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#111827', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6 },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  resultRowHighlight: { backgroundColor: '#F9FAFB' },
  resultIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  resultLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  resultSub: { fontSize: 13, color: '#9CA3AF', marginTop: 2 },

  // ── Carte interactive ──
  mapWrapper: { height: MAP_H, position: 'relative', overflow: 'hidden' },
  map: { ...StyleSheet.absoluteFillObject },
  pinWrap: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  pinBody: { alignItems: 'center', transform: [{ translateY: -22 }] },
  pinBodyUp: { transform: [{ translateY: -32 }] },
  pinHead: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF6835', borderWidth: 3.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#FF6835', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 8, elevation: 8 },
  pinHeadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' },
  pinTip: { width: 0, height: 0, borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 12, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#FF6835', marginTop: -1 },
  pinShadow: { width: 14, height: 6, borderRadius: 7, backgroundColor: 'rgba(0,0,0,0.2)', transform: [{ translateY: 16 }] },
  pinShadowUp: { width: 8, height: 4, opacity: 0.1 },
  gpsMapBtn: { position: 'absolute', bottom: 52, right: 14, width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4 },
  pinpointBtn: { position: 'absolute', bottom: 14, alignSelf: 'center', left: '50%', transform: [{ translateX: -65 }], width: 130, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#111827', borderRadius: 100, paddingHorizontal: 18, paddingVertical: 11, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 6 },
  pinpointText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  resolvedRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#F8F7F4', borderBottomWidth: 1, borderBottomColor: '#F3F4F6', minHeight: 52 },
  resolvedText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827', lineHeight: 20 },
  resolvedPlaceholder: { color: '#9CA3AF', fontWeight: '400', fontSize: 13 },

  // ── Détails ──
  detailsContent: { paddingHorizontal: 20, paddingTop: 8, gap: 6 },
  fieldLabel: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 12, marginBottom: 6 },
  optional: { fontSize: 13, fontWeight: '400', color: '#9CA3AF' },
  field: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 11, fontSize: 15, color: '#111827' },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 14 : 11 },
  dropdownValue: { fontSize: 15, color: '#111827' },
  dropdownMenu: { backgroundColor: '#fff', borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, elevation: 6 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  dropdownItemActive: { backgroundColor: '#FEF2EC' },
  dropdownItemText: { fontSize: 15, color: '#111827' },
  confirmFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  confirmBtn: { backgroundColor: '#FF6835', borderRadius: 14, paddingVertical: 17, alignItems: 'center' },
  confirmBtnDisabled: { backgroundColor: '#D1D5DB' },
  confirmBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
});
