import { uploadImageToSupabase } from '@/lib/uploadImage';
// app/(pro)/business/settings.tsx
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
  ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCartStore } from '@/stores/cartStore';

const ORANGE = '#FF6835';
const DARK   = '#1E3A5F';
const RED    = '#EF4444';

type SettingSection =
  | 'info'
  | 'address'
  | 'socials'
  | 'danger';

interface SettingItem {
  id:    SettingSection;
  icon:  string;
  label: string;
  sub:   string;
  color: string;
  bg:    string;
}

interface DeliveryZone {
  id:    string;
  label: string;
  price: number;
}

const SETTING_ITEMS: SettingItem[] = [
  { id:'info',    icon:'edit-3',      label:'Informations generales', sub:'Nom, description, telephone, livraison', color:DARK,    bg:'#EEF2FF' },
  { id:'address', icon:'map-pin',     label:'Adresse',                sub:'Localisation de la boutique',           color:'#059669', bg:'#F0FDF4' },
  { id:'socials', icon:'share-2',     label:'Reseaux sociaux',        sub:'Facebook, Instagram, WhatsApp...',       color:'#F59E0B', bg:'#FFFBEB' },
  { id:'danger',  icon:'trash-2',     label:'Supprimer la boutique',  sub:'Action irreversible',                   color:RED,       bg:'#FEF2F2' },
];

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
}

// ── Validation géographique via Nominatim (OpenStreetMap) ─────────────────────
/**
 * Vérifie qu'un lieu (ville, quartier) existe dans le pays donné.
 * countryCode = code ISO 2 lettres (ex : "BJ", "CI", "SN")
 * Fail-open : retourne true si le réseau est inaccessible.
 */
async function validateLocationInCountry(
  locationName: string,
  countryCode: string,
): Promise<boolean> {
  try {
    const q  = encodeURIComponent(locationName.trim());
    const cc = countryCode.toLowerCase();
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${q}&countrycodes=${cc}&format=json&limit=1&accept-language=fr`;
    const res  = await fetch(url, {
      headers: { 'User-Agent': 'BymohApp/1.0 contact@bymoh.com' },
    });
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return true;   // Pas de réseau → on laisse passer (fail-open)
  }
}

export default function BusinessSettingsPage() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc     = useQueryClient();

  const [activeSection, setActiveSection] = useState<SettingSection | null>(null);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Champs infos
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [phone,       setPhone]       = useState('');
  const [hasDelivery, setHasDelivery] = useState(false);
  const [address,     setAddress]     = useState('');
  const [city,        setCity]        = useState('');
  const [countryCode, setCountryCode] = useState<string | null>(null);   // ← code pays boutique
  const [socials, setSocials] = useState({
    facebook:'', instagram:'', tiktok:'', whatsapp:'', twitter:'', website:'',
  });
  const [imageUri, setImageUri] = useState<string|null>(null);
  const [coverUrl, setCoverUrl] = useState<string|null>(null);

  // Zones de livraison
  const [deliveryZones,  setDeliveryZones]  = useState<DeliveryZone[]>([]);
  const [addingZone,     setAddingZone]     = useState(false);
  const [newZoneLabel,   setNewZoneLabel]   = useState('');
  const [newZonePrice,   setNewZonePrice]   = useState('');
  const [savingZone,     setSavingZone]     = useState(false);
  const [validatingZone, setValidatingZone] = useState(false);   // ← vérif. géo en cours
  const infoScrollRef = useRef<ScrollView>(null);

  // ── Charger les données ───────────────────────────────────────────────────
  const { data: business, isLoading } = useQuery({
    queryKey: ['pro-biz', id],
    queryFn: async () => {
      const [{ data, error }, { data: zones }] = await Promise.all([
        supabase.from('businesses').select('*').eq('id', id!).single(),
        supabase.from('delivery_zones').select('*').eq('business_id', id!).order('created_at'),
      ]);
      if (error) throw error;
      setName(data.name ?? '');
      setDescription(data.description ?? '');
      setPhone(data.phone ?? '');
      setHasDelivery(data.has_delivery ?? false);
      setAddress(data.address ?? '');
      setCity(data.city ?? '');
      setCountryCode(data.country_code ?? null);                  // ← stocker le code pays
      setCoverUrl(data.cover_url ?? null);
      setSocials({
        facebook:  (data as any).social_facebook  ?? '',
        instagram: (data as any).social_instagram ?? '',
        tiktok:    (data as any).social_tiktok    ?? '',
        whatsapp:  (data as any).social_whatsapp  ?? '',
        twitter:   (data as any).social_twitter   ?? '',
        website:   (data as any).website          ?? '',
      });
      setDeliveryZones((zones ?? []).map((z: any) => ({ id: z.id, label: z.label, price: z.price })));
      return data;
    },
    enabled: !!id,
  });

  // ── Upload image ──────────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission requise'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true, aspect: [16, 9], quality: 1,
    });
    if (!result.canceled && result.assets[0]) setImageUri(result.assets[0].uri);
  };

  const uploadCover = async (): Promise<string | null> => {
    if (!imageUri) return coverUrl;
    try {
      const ext  = imageUri.split('.').pop()?.split('?')[0] ?? 'jpg';
      const path = `covers/${id}.${ext}`;
      const uploadedUrl = await uploadImageToSupabase(imageUri!, 'businesses', path);
      if (uploadedUrl) return uploadedUrl;
    } catch {}
    return coverUrl;
  };

  // ── Zones de livraison ────────────────────────────────────────────────────
  const addDeliveryZone = async () => {
    if (!newZoneLabel.trim()) { Alert.alert('Erreur', 'Indiquez une ville ou un quartier.'); return; }
    if (!newZonePrice.trim()) { Alert.alert('Erreur', 'Indiquez un prix de livraison.'); return; }

    // ── Validation géographique ──────────────────────────────────────────
    if (countryCode) {
      setValidatingZone(true);
      const exists = await validateLocationInCountry(newZoneLabel.trim(), countryCode);
      setValidatingZone(false);
      if (!exists) {
        Alert.alert(
          'Lieu introuvable',
          `"${newZoneLabel.trim()}" n'a pas été trouvé dans ce pays.\n\nVérifiez l'orthographe ou essayez un nom plus général.`,
        );
        return;
      }
    }
    // ────────────────────────────────────────────────────────────────────

    setSavingZone(true);
    try {
      const { data, error } = await supabase
        .from('delivery_zones')
        .insert({
          id:          generateId(),
          business_id: id!,
          label:       newZoneLabel.trim(),
          price:       parseInt(newZonePrice, 10) || 0,
        })
        .select()
        .single();
      if (error) throw error;
      setDeliveryZones(z => [...z, { id: data.id, label: data.label, price: data.price }]);
      setNewZoneLabel('');
      setNewZonePrice('');
      setAddingZone(false);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setSavingZone(false);
    }
  };

  const deleteDeliveryZone = (zoneId: string) => {
    Alert.alert('Supprimer cette zone ?', 'Cette zone de livraison sera définitivement supprimée.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('delivery_zones').delete().eq('id', zoneId);
          setDeliveryZones(z => z.filter(zone => zone.id !== zoneId));
        } catch (e: any) {
          Alert.alert('Erreur', e.message);
        }
      }},
    ]);
  };

  // ── Toggle livraison ──────────────────────────────────────────────────────
  const toggleDelivery = async (val: boolean) => {
    setHasDelivery(val);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ has_delivery: val })
        .eq('id', id!);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['pro-biz', id] });
    } catch (e: any) {
      setHasDelivery(!val);
      Alert.alert('Erreur', e.message);
    }
  };

  // ── Sauvegarder section ───────────────────────────────────────────────────
  const save = async (section: SettingSection) => {
    setSaving(true);
    try {
      let payload: Record<string, any> = {};
      if (section === 'info') {
        if (!name.trim()) { Alert.alert('Erreur', 'Le nom est requis.'); setSaving(false); return; }
        const newCover = await uploadCover();
        payload = { name: name.trim(), description: description.trim(), phone: phone.trim(), has_delivery: hasDelivery, cover_url: newCover };
      }
      if (section === 'address') {
        payload = { address: address.trim(), city: city.trim() };
      }
      if (section === 'socials') {
        payload = {
          social_facebook:  socials.facebook  || null,
          social_instagram: socials.instagram || null,
          social_tiktok:    socials.tiktok    || null,
          social_whatsapp:  socials.whatsapp  || null,
          social_twitter:   socials.twitter   || null,
          website:          socials.website   || null,
        };
      }
      const { error } = await supabase.from('businesses').update(payload).eq('id', id!);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['pro-biz', id] });
      await qc.invalidateQueries({ queryKey: ['biz-client', id] });
      await qc.invalidateQueries({ queryKey: ['my-businesses'] });
      setActiveSection(null);
      Alert.alert('✅', 'Modifications enregistrees.');
    } catch (err: any) {
      Alert.alert('Erreur', err.message);
    } finally {
      setSaving(false);
    }
  };

  // ── Supprimer boutique ────────────────────────────────────────────────────
  const cleanBusinessStorage = async (bizId: string) => {
    const coverExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    await Promise.allSettled(
      coverExts.map((ext) =>
        supabase.storage.from('businesses').remove([`covers/${bizId}.${ext}`])
      )
    );
    try {
      const { data: serviceFiles } = await supabase.storage.from('businesses').list(`services/${bizId}`);
      if (serviceFiles && serviceFiles.length > 0) {
        await supabase.storage.from('businesses').remove(serviceFiles.map((f) => `services/${bizId}/${f.name}`));
      }
    } catch {}
    try {
      const { data: serviceItems } = await supabase.storage.from('businesses').list(`items/${bizId}`);
      if (serviceItems && serviceItems.length > 0) {
        await supabase.storage.from('businesses').remove(serviceItems.map((f) => `items/${bizId}/${f.name}`));
      }
    } catch {}
  };

  const deleteBusiness = () => {
    Alert.alert('Supprimer la boutique ?',
      `"${business?.name}" sera definitivement supprimee.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () =>
          Alert.alert('Confirmation finale', 'Cette action est irreversible.',
            [
              { text: 'Annuler', style: 'cancel' },
              { text: 'Oui, supprimer', style: 'destructive', onPress: async () => {
                setDeleting(true);
                try {
                  await supabase.from('delivery_zones').delete().eq('business_id', id!);
                  await supabase.from('services').delete().eq('business_id', id!);
                  await supabase.from('business_hours').delete().eq('business_id', id!);
                  await supabase.from('businesses').delete().eq('id', id!);
                  await cleanBusinessStorage(id!);
                  await qc.invalidateQueries({ queryKey: ['my-businesses'] });
                  const cartStore = useCartStore.getState();
                  if (cartStore.businessId === id!) cartStore.clearCart();
                  router.replace('/(pro)/dashboard' as any);
                } catch (e: any) {
                  Alert.alert('Erreur', e.message);
                  setDeleting(false);
                }
              }},
            ]
          )
        },
      ]
    );
  };

  if (isLoading) {
    return <View style={s.center}><ActivityIndicator color={ORANGE} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F8F7F4' }}>

      {/* Header */}
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={s.backBtn}
          onPress={() => activeSection ? setActiveSection(null) : router.navigate('/(pro)/boutique' as any)}>
          <Feather name="arrow-left" size={20} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle as any}>
            {activeSection ? SETTING_ITEMS.find(i=>i.id===activeSection)?.label : 'Parametres'}
          </Text>
          {!activeSection && <Text style={s.headerSub as any}>{business?.name}</Text>}
        </View>
        {activeSection && activeSection !== 'danger' && (
          <TouchableOpacity
            style={[s.saveBtn, saving && { opacity: 0.7 }]}
            onPress={() => save(activeSection)}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.saveBtnTxt as any}>Sauvegarder</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* ── Liste des sections ── */}
      {!activeSection && (
        <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>
          <TouchableOpacity style={s.coverRow} onPress={pickImage} activeOpacity={0.85}>
            {(imageUri || coverUrl)
              ? <Image source={{ uri: imageUri ?? coverUrl! }} style={s.coverThumb} />
              : <View style={s.coverThumbPh}><Feather name="image" size={20} color="#9CA3AF" /></View>
            }
            <View style={{ flex: 1 }}>
              <Text style={s.coverLabel as any}>Photo de couverture</Text>
              <Text style={s.coverSub as any}>Appuyer pour modifier</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#9CA3AF" />
          </TouchableOpacity>

          {SETTING_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[s.settingRow, item.id === 'danger' && s.settingRowDanger]}
              onPress={() => {
                if (item.id === 'danger') { deleteBusiness(); return; }
                setActiveSection(item.id);
              }}
              activeOpacity={0.85}
            >
              <View style={[s.settingIcon, { backgroundColor: item.bg }]}>
                <Feather name={item.icon as any} size={18} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.settingLabel as any, item.id === 'danger' && { color: RED }]}>
                  {item.label}
                </Text>
                <Text style={s.settingSub as any}>{item.sub}</Text>
              </View>
              {item.id !== 'danger'
                ? <Feather name="chevron-right" size={16} color="#9CA3AF" />
                : deleting ? <ActivityIndicator size="small" color={RED} /> : null
              }
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* ── Informations générales ── */}
      {activeSection === 'info' && (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={topPad + 60}>
        <ScrollView ref={infoScrollRef} contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={s.coverPickerInForm} onPress={pickImage} activeOpacity={0.85}>
            {(imageUri || coverUrl)
              ? <Image source={{ uri: imageUri ?? coverUrl! }} style={s.coverImgFull} />
              : <View style={s.coverPhFull}>
                  <Feather name="camera" size={28} color="#9CA3AF" />
                  <Text style={s.coverPhTxt as any}>Modifier la couverture (16:9)</Text>
                </View>
            }
            <View style={s.coverEdit}><Feather name="edit-2" size={14} color="#fff" /></View>
          </TouchableOpacity>

          <Field label="Nom *" value={name} onChangeText={setName} placeholder="Nom de la boutique" />
          <FieldArea label="Description" value={description} onChangeText={setDescription} placeholder="Decrivez votre boutique..." />
          <Field label="Telephone" value={phone} onChangeText={setPhone} placeholder="+229 XX XX XX XX" keyboardType="phone-pad" />

          <View style={s.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.fieldLabel as any}>Livraison disponible</Text>
              <Text style={s.fieldSub as any}>Les clients pourront commander avec livraison</Text>
            </View>
            <Switch value={hasDelivery} onValueChange={toggleDelivery}
              trackColor={{ false:'#E5E7EB', true:ORANGE }} thumbColor="#fff" />
          </View>

          {/* ── Zones de livraison ── */}
          {hasDelivery && (
            <View style={s.zonesCard}>
              <View style={s.zonesHeader}>
                <View style={s.zonesIconWrap}>
                  <Feather name="map-pin" size={14} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.zonesTitle as any}>Zones de livraison</Text>
                  <Text style={s.zonesSub as any}>Définissez les villes / quartiers et leurs tarifs</Text>
                </View>
              </View>

              <View style={s.zonesDivider} />

              {deliveryZones.length === 0 && !addingZone && (
                <Text style={s.zonesEmpty as any}>Aucune zone configurée</Text>
              )}
              {deliveryZones.map(zone => (
                <View key={zone.id} style={s.zoneRow}>
                  <Feather name="map-pin" size={12} color={ORANGE} />
                  <Text style={s.zoneLabel as any} numberOfLines={1}>{zone.label}</Text>
                  <Text style={s.zonePrice as any}>{zone.price.toLocaleString('fr-FR')} FCFA</Text>
                  <TouchableOpacity onPress={() => deleteDeliveryZone(zone.id)} hitSlop={10}>
                    <Feather name="trash-2" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {addingZone ? (
                <View style={s.zoneForm}>
                  <TextInput
                    style={s.input}
                    placeholder="Ville ou quartier"
                    placeholderTextColor="#9CA3AF"
                    value={newZoneLabel}
                    onChangeText={setNewZoneLabel}
                  />
                  <TextInput
                    style={s.input}
                    placeholder="Prix de livraison (FCFA)"
                    placeholderTextColor="#9CA3AF"
                    value={newZonePrice}
                    onChangeText={setNewZonePrice}
                    keyboardType="numeric"
                  />
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity
                      style={[s.zoneFormBtn, { backgroundColor: '#F3F4F6', flex: 1 }]}
                      onPress={() => { setAddingZone(false); setNewZoneLabel(''); setNewZonePrice(''); }}
                    >
                      <Text style={{ fontSize: 13, color: '#374151', fontWeight: '600' }}>Annuler</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.zoneFormBtn, { backgroundColor: ORANGE, flex: 1, opacity: (savingZone || validatingZone) ? 0.7 : 1 }]}
                      onPress={addDeliveryZone}
                      disabled={savingZone || validatingZone}
                    >
                      {(validatingZone || savingZone) ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <ActivityIndicator size="small" color="#fff" />
                          <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600' }}>
                            {validatingZone ? 'Vérification...' : 'Ajout...'}
                          </Text>
                        </View>
                      ) : (
                        <Text style={{ fontSize: 13, color: '#fff', fontWeight: '700' }}>Ajouter</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={s.addZoneBtn} onPress={() => {
                  setAddingZone(true);
                  setTimeout(() => infoScrollRef.current?.scrollToEnd({ animated: true }), 100);
                }} activeOpacity={0.8}>
                  <Feather name="plus" size={14} color={ORANGE} />
                  <Text style={s.addZoneTxt as any}>Ajouter une livraison</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── Adresse ── */}
      {activeSection === 'address' && (
        <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
          <Field label="Adresse" value={address} onChangeText={setAddress} placeholder="Rue, quartier..." />
          <Field label="Ville" value={city} onChangeText={setCity} placeholder="Cotonou, Abidjan..." />
        </ScrollView>
      )}

      {/* ── Réseaux sociaux ── */}
      {activeSection === 'socials' && (
        <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
          {[
            { key:'facebook',  icon:'f',    placeholder:'@votre_page' },
            { key:'instagram', icon:'📷',   placeholder:'@votre_compte' },
            { key:'tiktok',    icon:'🎵',   placeholder:'@votre_tiktok' },
            { key:'whatsapp',  icon:'💬',   placeholder:'+229 XX XX XX XX' },
            { key:'twitter',   icon:'X',    placeholder:'@votre_twitter' },
            { key:'website',   icon:'🌐',   placeholder:'https://votre-site.com' },
          ].map((item) => (
            <Field
              key={item.key}
              label={`${item.icon} ${item.key.charAt(0).toUpperCase()+item.key.slice(1)}`}
              value={(socials as any)[item.key]}
              onChangeText={(t: string) => setSocials(p => ({ ...p, [item.key]: t }))}
              placeholder={item.placeholder}
              keyboardType={item.key==='whatsapp'?'phone-pad':'default'}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

// ── Composants champ ──────────────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel as any}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType ?? 'default'} />
    </View>
  );
}

function FieldArea({ label, value, onChangeText, placeholder }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.fieldLabel as any}>{label}</Text>
      <TextInput style={[s.input, { height: 90, textAlignVertical:'top', paddingTop:12 }]}
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor="#9CA3AF" multiline />
    </View>
  );
}

const s = StyleSheet.create({
  center:          { flex:1, alignItems:'center', justifyContent:'center' },
  header:          { flexDirection:'row', alignItems:'center', gap:12, paddingHorizontal:16, paddingBottom:14, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#F3F4F6' },
  backBtn:         { width:38, height:38, borderRadius:19, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  headerTitle:     { fontSize:17, fontWeight:'800', color:'#111827' },
  headerSub:       { fontSize:12, color:'#9CA3AF', marginTop:1 },
  saveBtn:         { backgroundColor:ORANGE, borderRadius:10, paddingHorizontal:14, paddingVertical:8 },
  saveBtnTxt:      { fontSize:13, fontWeight:'700', color:'#fff' },
  coverRow:        { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#fff', borderRadius:16, padding:14, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  coverThumb:      { width:56, height:56, borderRadius:12, resizeMode:'cover' },
  coverThumbPh:    { width:56, height:56, borderRadius:12, backgroundColor:'#F3F4F6', alignItems:'center', justifyContent:'center' },
  coverLabel:      { fontSize:14, fontWeight:'700', color:'#111827' },
  coverSub:        { fontSize:12, color:'#9CA3AF', marginTop:1 },
  settingRow:      { flexDirection:'row', alignItems:'center', gap:14, backgroundColor:'#fff', borderRadius:16, padding:14, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  settingRowDanger:{ backgroundColor:'#FEF2F2', borderWidth:1, borderColor:'#FECACA' },
  settingIcon:     { width:46, height:46, borderRadius:14, alignItems:'center', justifyContent:'center' },
  settingLabel:    { fontSize:14, fontWeight:'700', color:'#111827' },
  settingSub:      { fontSize:12, color:'#9CA3AF', marginTop:2 },
  formScroll:      { padding:20, gap:14, paddingBottom:60 },
  coverPickerInForm:{ position:'relative', borderRadius:16, overflow:'hidden', backgroundColor:'#F3F4F6', borderWidth:2, borderColor:'#E5E7EB', borderStyle:'dashed', height:180, marginBottom:6 },
  coverImgFull:    { width:'100%', height:'100%', resizeMode:'cover' },
  coverPhFull:     { flex:1, alignItems:'center', justifyContent:'center', gap:8 },
  coverPhTxt:      { fontSize:14, fontWeight:'600', color:'#9CA3AF' },
  coverEdit:       { position:'absolute', bottom:10, right:10, width:32, height:32, borderRadius:16, backgroundColor:'rgba(0,0,0,0.6)', alignItems:'center', justifyContent:'center' },
  fieldLabel:      { fontSize:11, fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.4 },
  fieldSub:        { fontSize:12, color:'#9CA3AF', marginTop:1 },
  input:           { backgroundColor:'#F3F4F6', borderRadius:12, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:'#111827', borderWidth:1.5, borderColor:'#E5E7EB' },
  switchRow:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:4 },

  // Zones de livraison
  zonesCard:    { backgroundColor:'#FFFBF8', borderRadius:16, padding:14, gap:10, borderWidth:1.5, borderColor:'#FED7C3' },
  zonesHeader:  { flexDirection:'row', alignItems:'center', gap:10 },
  zonesIconWrap:{ width:30, height:30, borderRadius:9, backgroundColor:'#FFF0EA', alignItems:'center', justifyContent:'center' },
  zonesTitle:   { fontSize:13, fontWeight:'800', color:'#111827' },
  zonesSub:     { fontSize:11, color:'#9CA3AF', marginTop:1 },
  zonesDivider: { height:1, backgroundColor:'#FED7C3', marginHorizontal:-4 },
  zonesEmpty:   { fontSize:12, color:'#9CA3AF', textAlign:'center', paddingVertical:4 },
  zoneRow:      { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#fff', borderRadius:10, padding:10, borderWidth:1, borderColor:'#F3F4F6' },
  zoneLabel:    { flex:1, fontSize:13, fontWeight:'600', color:'#111827' },
  zonePrice:    { fontSize:13, color:ORANGE, fontWeight:'700' },
  zoneForm:     { gap:8, backgroundColor:'#fff', borderRadius:12, padding:12, borderWidth:1, borderColor:'#E5E7EB' },
  zoneFormBtn:  { borderRadius:10, paddingVertical:12, alignItems:'center', justifyContent:'center' },
  addZoneBtn:   { flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#FFF0EA', borderRadius:10, padding:12, justifyContent:'center', borderWidth:1.5, borderColor:'#FED7C3', borderStyle:'dashed' },
  addZoneTxt:   { fontSize:13, fontWeight:'700', color:ORANGE },
});
