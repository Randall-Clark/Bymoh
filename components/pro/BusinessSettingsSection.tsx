// components/pro/BusinessSettingsSection.tsx
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView,
  StyleSheet, Switch, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { uploadImageToSupabase } from '@/lib/uploadImage';

interface Props { business: any; }

const ORANGE = '#FF6835';
const DARK   = '#1E3A5F';
const RED    = '#EF4444';

export function BusinessSettingsSection({ business }: Props) {
  const qc = useQueryClient();

  const [name,        setName]        = useState<string>(business.name ?? '');
  const [description, setDescription] = useState<string>(business.description ?? '');
  const [address,     setAddress]     = useState<string>(business.address ?? '');
  const [city,        setCity]        = useState<string>(business.city ?? '');
  const [phone,       setPhone]       = useState<string>(business.phone ?? '');
  const [hasDelivery, setHasDelivery] = useState<boolean>(business.has_delivery ?? false);
  const [imageUri,    setImageUri]    = useState<string | null>(null);
  const [coverUrl,    setCoverUrl]    = useState<string | null>(business.cover_url ?? null);
  const [walletPhone,    setWalletPhone]    = useState<string>((business as any).wallet_phone    ?? '');
  const [walletProvider, setWalletProvider] = useState<string>((business as any).wallet_provider ?? 'mtn');
  const [socials, setSocials] = useState<Record<string, string>>({
    facebook:  (business as any).social_facebook  ?? '',
    instagram: (business as any).social_instagram ?? '',
    tiktok:    (business as any).social_tiktok    ?? '',
    whatsapp:  (business as any).social_whatsapp  ?? '',
    twitter:   (business as any).social_twitter   ?? '',
    website:   (business as any).website          ?? '',
  });

  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ── Choisir image ──────────────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission requise'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  // ── Upload cover ───────────────────────────────────────────────────────────
  const uploadCover = async (): Promise<string | null> => {
    if (!imageUri) return coverUrl;
    const rawExt = imageUri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
    const path = `covers/${business.id}.${rawExt}`;
    const url = await uploadImageToSupabase(imageUri, 'businesses', path);
    return url ?? coverUrl;
  };

  // ── Sauvegarder ───────────────────────────────────────────────────────────
  const save = async () => {
    if (!name.trim()) { Alert.alert('Erreur', 'Le nom est requis.'); return; }
    setSaving(true);
    try {
      const newCover = await uploadCover();
      const { error } = await supabase.from('businesses').update({
        name:             name.trim(),
        description:      description.trim(),
        address:          address.trim(),
        city:             city.trim(),
        phone:            phone.trim(),
        has_delivery:     hasDelivery,
        cover_url:        newCover,
        social_facebook:  socials.facebook  || null,
        social_instagram: socials.instagram || null,
        social_tiktok:    socials.tiktok    || null,
        social_whatsapp:  socials.whatsapp  || null,
        social_twitter:   socials.twitter   || null,
        website:          socials.website   || null,
        wallet_phone:     walletPhone.trim() || null,
        wallet_provider:  walletPhone.trim() ? walletProvider : null,
      }).eq('id', business.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ['pro-biz', business.id] });
      await qc.invalidateQueries({ queryKey: ['biz-client', business.id] });
      await qc.invalidateQueries({ queryKey: ['my-businesses'] });
      Alert.alert('', 'Boutique mise a jour.');
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de sauvegarder.');
    } finally {
      setSaving(false);
    }
  };

  // ── Supprimer ─────────────────────────────────────────────────────────────
  const deleteBusiness = () => {
    Alert.alert('Supprimer ?', `"${business.name}" sera supprimee.`, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () =>
        Alert.alert('Confirmation', 'Action irreversible.', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Confirmer', style: 'destructive', onPress: async () => {
            setDeleting(true);
            try {
              await supabase.from('services').delete().eq('business_id', business.id);
              await supabase.from('business_hours').delete().eq('business_id', business.id);
              await supabase.from('businesses').delete().eq('id', business.id);
              await qc.invalidateQueries({ queryKey: ['my-businesses'] });
              router.replace('/(pro)/dashboard' as any);
            } catch (e: any) {
              Alert.alert('Erreur', e.message);
              setDeleting(false);
            }
          }},
        ])
      },
    ]);
  };

  const SOCIAL_FIELDS: { key: string; label: string; placeholder: string; keyboard?: any }[] = [
    { key:'facebook',  label:'Facebook',  placeholder:'@votre_page' },
    { key:'instagram', label:'Instagram', placeholder:'@votre_compte' },
    { key:'tiktok',    label:'TikTok',    placeholder:'@votre_tiktok' },
    { key:'whatsapp',  label:'WhatsApp',  placeholder:'+229 XX XX XX XX', keyboard:'phone-pad' },
    { key:'twitter',   label:'Twitter/X', placeholder:'@votre_twitter' },
    { key:'website',   label:'Site web',  placeholder:'https://votre-site.com' },
  ];

  return (
    <ScrollView showsVerticalScrollIndicator={false}
      contentContainerStyle={{ padding:20, gap:16, paddingBottom:60 }}
      keyboardShouldPersistTaps="handled">

      {/* Cover */}
      <TouchableOpacity style={s.coverPicker} onPress={pickImage} activeOpacity={0.85}>
        {(imageUri || coverUrl)
          ? <Image source={{ uri: imageUri ?? coverUrl! }} style={s.coverImg}/>
          : <View style={s.coverPh}>
              <Feather name="camera" size={28} color="#9CA3AF"/>
              <Text style={s.coverPhTxt as any}>Changer la photo de couverture</Text>
            </View>
        }
        <View style={s.coverEdit}>
          <Feather name="edit-2" size={14} color="#fff"/>
        </View>
      </TouchableOpacity>

      {/* Infos générales */}
      <View style={s.card}>
        <Text style={s.cardTitle as any}>Informations generales</Text>
        <Field label="Nom *"        value={name}        onChangeText={setName}        placeholder="Nom de la boutique"/>
        <FieldArea label="Description" value={description} onChangeText={setDescription} placeholder="Decrivez votre boutique..."/>
        <Field label="Telephone"    value={phone}       onChangeText={setPhone}       placeholder="+229 XX XX XX XX" keyboardType="phone-pad"/>
        <View style={s.row}>
          <View style={{flex:1}}>
            <Text style={s.switchLabel as any}>Livraison disponible</Text>
            <Text style={s.switchSub as any}>Les clients pourront commander en livraison</Text>
          </View>
          <Switch value={hasDelivery} onValueChange={setHasDelivery}
            trackColor={{false:'#E5E7EB', true:ORANGE}} thumbColor="#fff"/>
        </View>
      </View>

      {/* Adresse */}
      <View style={s.card}>
        <Text style={s.cardTitle as any}>Adresse</Text>
        <Field label="Adresse" value={address} onChangeText={setAddress} placeholder="Rue, quartier..."/>
        <Field label="Ville"   value={city}    onChangeText={setCity}    placeholder="Cotonou, Abidjan..."/>
      </View>

      {/* Portefeuille */}
      <View style={s.card}>
        <Text style={s.cardTitle as any}>Portefeuille de reception</Text>
        <Text style={s.hint as any}>Numero ou vous recevrez vos paiements Mobile Money</Text>
        <View style={{flexDirection:'row', flexWrap:'wrap', gap:8}}>
          {['mtn','moov','orange','wave'].map((p) => (
            <TouchableOpacity key={p}
              style={[s.chip, walletProvider===p && s.chipActive]}
              onPress={() => setWalletProvider(p)}>
              <Text style={[s.chipTxt as any, walletProvider===p && {color:ORANGE,fontWeight:'700'}]}>
                {p.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="Numero Mobile Money" value={walletPhone} onChangeText={setWalletPhone}
          placeholder="+229 XX XX XX XX" keyboardType="phone-pad"/>
        {walletPhone.trim() && (
          <View style={s.walletOk}>
            <Feather name="check-circle" size={14} color="#22C55E"/>
            <Text style={s.walletOkTxt as any}>{walletProvider.toUpperCase()} : {walletPhone}</Text>
          </View>
        )}
      </View>

      {/* Réseaux sociaux */}
      <View style={s.card}>
        <Text style={s.cardTitle as any}>Reseaux sociaux & contact</Text>
        {SOCIAL_FIELDS.map(f => (
          <Field key={f.key} label={f.label}
            value={socials[f.key]} onChangeText={(t: string) => setSocials(p => ({...p,[f.key]:t}))}
            placeholder={f.placeholder} keyboardType={f.keyboard}/>
        ))}
      </View>

      {/* Sauvegarder */}
      <TouchableOpacity style={[s.saveBtn, saving && {opacity:0.7}]}
        onPress={save} disabled={saving} activeOpacity={0.88}>
        {saving
          ? <ActivityIndicator color="#fff"/>
          : <><Feather name="save" size={18} color="#fff"/>
              <Text style={s.saveBtnTxt as any}>Enregistrer les modifications</Text></>
        }
      </TouchableOpacity>

      {/* Zone danger */}
      <View style={s.dangerZone}>
        <Text style={s.dangerTitle as any}>Zone de danger</Text>
        <TouchableOpacity style={[s.deleteBtn, deleting && {opacity:0.7}]}
          onPress={deleteBusiness} disabled={deleting} activeOpacity={0.85}>
          {deleting
            ? <ActivityIndicator color={RED}/>
            : <><Feather name="trash-2" size={16} color={RED}/>
                <Text style={s.deleteBtnTxt as any}>Supprimer cette boutique</Text></>
          }
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Composants champs ─────────────────────────────────────────────────────────
function Field({ label, value, onChangeText, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (t: string) => void;
  placeholder?: string; keyboardType?: any;
}) {
  return (
    <View style={{gap:6}}>
      <Text style={s.label as any}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType ?? 'default'}/>
    </View>
  );
}

function FieldArea({ label, value, onChangeText, placeholder }: {
  label: string; value: string; onChangeText: (t: string) => void; placeholder?: string;
}) {
  return (
    <View style={{gap:6}}>
      <Text style={s.label as any}>{label}</Text>
      <TextInput style={[s.input,{height:80,textAlignVertical:'top',paddingTop:12}]}
        value={value} onChangeText={onChangeText}
        placeholder={placeholder} placeholderTextColor="#9CA3AF" multiline/>
    </View>
  );
}

const s = StyleSheet.create({
  coverPicker:  { position:'relative', borderRadius:16, overflow:'hidden', backgroundColor:'#F3F4F6', borderWidth:2, borderColor:'#E5E7EB', borderStyle:'dashed', height:180 },
  coverImg:     { width:'100%', height:'100%', resizeMode:'cover' },
  coverPh:      { flex:1, alignItems:'center', justifyContent:'center', gap:8 },
  coverPhTxt:   { fontSize:14, fontWeight:'600', color:'#9CA3AF' },
  coverEdit:    { position:'absolute', bottom:10, right:10, width:32, height:32, borderRadius:16, backgroundColor:'rgba(0,0,0,0.6)', alignItems:'center', justifyContent:'center' },
  card:         { backgroundColor:'#fff', borderRadius:18, padding:18, gap:14, shadowColor:'#000', shadowOffset:{width:0,height:1}, shadowOpacity:0.05, shadowRadius:4, elevation:2 },
  cardTitle:    { fontSize:16, fontWeight:'800', color:'#111827' },
  label:        { fontSize:11, fontWeight:'700', color:'#9CA3AF', textTransform:'uppercase', letterSpacing:0.4 },
  input:        { backgroundColor:'#F3F4F6', borderRadius:12, paddingHorizontal:14, paddingVertical:13, fontSize:15, color:'#111827', borderWidth:1.5, borderColor:'#E5E7EB' },
  row:          { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  switchLabel:  { fontSize:14, fontWeight:'600', color:'#111827' },
  switchSub:    { fontSize:12, color:'#9CA3AF', marginTop:1 },
  hint:         { fontSize:12, color:'#9CA3AF' },
  chip:         { paddingHorizontal:14, paddingVertical:8, borderRadius:100, backgroundColor:'#F3F4F6', borderWidth:1.5, borderColor:'#E5E7EB' },
  chipActive:   { backgroundColor:'#FEF2EC', borderColor:ORANGE },
  chipTxt:      { fontSize:12, fontWeight:'600', color:'#6B7280' },
  walletOk:     { flexDirection:'row', alignItems:'center', gap:8, backgroundColor:'#F0FDF4', borderRadius:10, padding:10 },
  walletOkTxt:  { fontSize:13, color:'#166534', fontWeight:'500' },
  saveBtn:      { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:ORANGE, borderRadius:16, paddingVertical:16, shadowColor:ORANGE, shadowOffset:{width:0,height:4}, shadowOpacity:0.3, shadowRadius:10, elevation:6 },
  saveBtnTxt:   { fontSize:16, fontWeight:'700', color:'#fff' },
  dangerZone:   { backgroundColor:'#FEF2F2', borderRadius:16, padding:16, gap:12, borderWidth:1, borderColor:'#FECACA' },
  dangerTitle:  { fontSize:14, fontWeight:'700', color:'#991B1B' },
  deleteBtn:    { flexDirection:'row', alignItems:'center', justifyContent:'center', gap:10, backgroundColor:'#fff', borderRadius:12, paddingVertical:14, borderWidth:1.5, borderColor:'#FECACA' },
  deleteBtnTxt: { fontSize:15, fontWeight:'700', color:RED },
});
