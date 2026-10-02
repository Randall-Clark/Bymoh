import { uploadImageToSupabase } from '@/lib/uploadImage';
// app/(pro)/business/settings.tsx
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform,
  ScrollView, StyleSheet, Switch, Text,
  TextInput, TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

const ORANGE = '#FF6835';
const DARK   = '#1E3A5F';
const RED    = '#EF4444';

// ── Liste des sections de paramètres ─────────────────────────────────────────
type SettingSection =
  | 'info'
  | 'address'
  // | 'wallet'
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

const SETTING_ITEMS: SettingItem[] = [
  { id:'info',    icon:'edit-3',      label:'Informations generales', sub:'Nom, description, telephone, livraison', color:DARK,    bg:'#EEF2FF' },
  { id:'address', icon:'map-pin',     label:'Adresse',                sub:'Localisation de la boutique',           color:'#059669', bg:'#F0FDF4' },
  // { id:'wallet',  icon:'credit-card', label:'Portefeuille',           sub:'Numero de reception Mobile Money',       color:'#7C3AED', bg:'#F5F3FF' },
  { id:'socials', icon:'share-2',     label:'Reseaux sociaux',        sub:'Facebook, Instagram, WhatsApp...',       color:'#F59E0B', bg:'#FFFBEB' },
  { id:'danger',  icon:'trash-2',     label:'Supprimer la boutique',  sub:'Action irreversible',                   color:RED,       bg:'#FEF2F2' },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function BusinessSettingsPage() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc     = useQueryClient();

  const [activeSection, setActiveSection] = useState<SettingSection | null>(null);
  const [saving,  setSaving]  = useState(false);
  const [deleting,setDeleting]= useState(false);

  // Champs
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [phone,       setPhone]       = useState('');
  const [hasDelivery, setHasDelivery] = useState(false);
  const [address,     setAddress]     = useState('');
  const [city,        setCity]        = useState('');
  const [walletPhone,    setWalletPhone]    = useState('');
  const [walletProvider, setWalletProvider] = useState('mtn');
  const [socials, setSocials] = useState({
    facebook:'', instagram:'', tiktok:'', whatsapp:'', twitter:'', website:'',
  });
  const [imageUri, setImageUri] = useState<string|null>(null);
  const [coverUrl, setCoverUrl] = useState<string|null>(null);

  // ── Charger les données ───────────────────────────────────────────────────
  const { data: business, isLoading } = useQuery({
    queryKey: ['pro-biz', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('businesses').select('*').eq('id', id!).single();
      if (error) throw error;
      setName(data.name ?? '');
      setDescription(data.description ?? '');
      setPhone(data.phone ?? '');
      setHasDelivery(data.has_delivery ?? false);
      setAddress(data.address ?? '');
      setCity(data.city ?? '');
      setCoverUrl(data.cover_url ?? null);
      setWalletPhone((data as any).wallet_phone ?? '');
      setWalletProvider((data as any).wallet_provider ?? 'mtn');
      setSocials({
        facebook:  (data as any).social_facebook  ?? '',
        instagram: (data as any).social_instagram ?? '',
        tiktok:    (data as any).social_tiktok    ?? '',
        whatsapp:  (data as any).social_whatsapp  ?? '',
        twitter:   (data as any).social_twitter   ?? '',
        website:   (data as any).website          ?? '',
      });
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
      // if (section === 'wallet') {
      //   payload = { wallet_phone: walletPhone.trim() || null, wallet_provider: walletPhone.trim() ? walletProvider : null };
      // }
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
                  await supabase.from('services').delete().eq('business_id', id!);
                  await supabase.from('business_hours').delete().eq('business_id', id!);
                  await supabase.from('businesses').delete().eq('id', id!);
                  await qc.invalidateQueries({ queryKey: ['my-businesses'] });
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
          {/* Photo de couverture */}
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

          {/* Items de paramètres */}
          {SETTING_ITEMS.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[s.settingRow, item.id === 'danger' && s.settingRowDanger]}
              onPress={() => {
              if (item.id === 'danger') { deleteBusiness(); return; }
              // if (item.id === 'wallet') { router.push({ pathname:'/(pro)/business/wallet', params:{ businessId: id } } as any); return; }
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
        <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
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
            <Switch value={hasDelivery} onValueChange={setHasDelivery}
              trackColor={{ false:'#E5E7EB', true:ORANGE }} thumbColor="#fff" />
          </View>
        </ScrollView>
      )}

      {/* ── Adresse ── */}
      {activeSection === 'address' && (
        <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
          <Field label="Adresse" value={address} onChangeText={setAddress} placeholder="Rue, quartier..." />
          <Field label="Ville" value={city} onChangeText={setCity} placeholder="Cotonou, Abidjan..." />
        </ScrollView>
      )}

      {/* ── Portefeuille ──
      {activeSection === 'wallet' && (
        <ScrollView contentContainerStyle={s.formScroll} keyboardShouldPersistTaps="handled">
          <View style={s.walletInfo}>
            <Feather name="info" size={15} color="#7C3AED" />
            <Text style={s.walletInfoTxt as any}>
              Renseignez le numero sur lequel vous souhaitez recevoir vos paiements.
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={s.fieldLabel as any}>Operateur</Text>
            <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
              {['mtn','moov','orange','wave'].map((p) => (
                <TouchableOpacity key={p}
                  style={[s.provChip, walletProvider===p && s.provChipActive]}
                  onPress={() => setWalletProvider(p)}>
                  <Text style={[s.provChipTxt as any, walletProvider===p && { color:ORANGE, fontWeight:'700' }]}>
                    {p.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Field label="Numero Mobile Money" value={walletPhone} onChangeText={setWalletPhone}
            placeholder="+229 XX XX XX XX" keyboardType="phone-pad" />
          {walletPhone.trim() && (
            <View style={s.walletConfirm}>
              <Feather name="check-circle" size={14} color="#22C55E" />
              <Text style={s.walletConfirmTxt as any}>
                Paiements sur {walletProvider.toUpperCase()} : {walletPhone}
              </Text>
            </View>
          )}
        </ScrollView>
      )} */}

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
  walletInfo:      { flexDirection:'row', gap:10, backgroundColor:'#F5F3FF', borderRadius:12, padding:12, borderWidth:1, borderColor:'#DDD6FE' },
  walletInfoTxt:   { flex:1, fontSize:13, color:'#6D28D9', lineHeight:18 },
  walletConfirm:   { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#F0FDF4', borderRadius:10, padding:12 },
  walletConfirmTxt:{ fontSize:13, color:'#166534', fontWeight:'500' },
  provChip:        { paddingHorizontal:14, paddingVertical:8, borderRadius:100, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'#E5E7EB' },
  provChipActive:  { backgroundColor:'#FEF2EC', borderColor:ORANGE },
  provChipTxt:     { fontSize:12, fontWeight:'600', color:'#6B7280' },
});
