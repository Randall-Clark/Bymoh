import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

export default function SecurityScreen() {
  const insets = useSafeAreaInsets();
  const { profile, clearAuth } = useAuthStore();
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  const changePin = async () => {
    if (newPin.length !== 6) { Alert.alert('Erreur', 'Le NIP doit contenir 6 chiffres.'); return; }
    if (newPin !== confirmPin) { Alert.alert('Erreur', 'Les deux NIP ne correspondent pas.'); return; }
    setPinLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPin });
      if (error) throw error;
      Alert.alert('Succès', 'Votre NIP a été modifié.');
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de modifier le NIP.');
    } finally { setPinLoading(false); }
  };

  const deleteAccount = () => {
    Alert.alert(
      'Supprimer le compte',
      'Cette action est irréversible. Toutes vos données, boutiques et historique seront définitivement supprimés.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement', style: 'destructive',
          onPress: () => {
            // Double confirmation
            Alert.alert(
              'Êtes-vous certain ?',
              'Cette suppression est définitive et ne peut pas être annulée.',
              [
                { text: 'Annuler', style: 'cancel' },
                {
                  text: 'Oui, supprimer', style: 'destructive',
                  onPress: async () => {
                    try {
                      // ✅ Edge Function qui supprime tout proprement
                      // (users table + auth.users + boutiques + commandes...)
                      const { data, error } = await supabase.functions.invoke('delete-account');

                      if (error) throw error;
                      if (data?.error) throw new Error(data.error);

                      // Nettoyer le store local
                      clearAuth();

                      // Rediriger vers l'authentification
                      router.replace('/(auth)/phone' as any);

                    } catch (err: any) {
                      Alert.alert('Erreur', err.message ?? 'Impossible de supprimer le compte.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 8 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Sécurité</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>

        {/* Changer NIP */}
        <Text style={styles.sectionLabel}>Changer de NIP</Text>
        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.label}>NIP actuel</Text>
            <TextInput style={styles.input} value={currentPin} onChangeText={setCurrentPin} secureTextEntry keyboardType="number-pad" maxLength={6} placeholder="••••••" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.sep} />
          <View style={styles.field}>
            <Text style={styles.label}>Nouveau NIP</Text>
            <TextInput style={styles.input} value={newPin} onChangeText={setNewPin} secureTextEntry keyboardType="number-pad" maxLength={6} placeholder="••••••" placeholderTextColor="#9CA3AF" />
          </View>
          <View style={styles.sep} />
          <View style={styles.field}>
            <Text style={styles.label}>Confirmer le nouveau NIP</Text>
            <TextInput style={styles.input} value={confirmPin} onChangeText={setConfirmPin} secureTextEntry keyboardType="number-pad" maxLength={6} placeholder="••••••" placeholderTextColor="#9CA3AF" />
          </View>
        </View>

        <TouchableOpacity style={[styles.saveBtn, pinLoading && { opacity: 0.7 }]} onPress={changePin} disabled={pinLoading}>
          <Text style={styles.saveBtnText}>{pinLoading ? 'Modification…' : 'Modifier le NIP'}</Text>
        </TouchableOpacity>

        {/* Zone danger */}
        <Text style={styles.sectionLabel}>Danger</Text>
        <View style={styles.dangerCard}>
          <View style={styles.dangerInfo}>
            <Feather name="alert-triangle" size={18} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={styles.dangerLabel}>Supprimer mon compte</Text>
              <Text style={styles.dangerSub}>Action irréversible — toutes vos données seront perdues</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.dangerBtn} onPress={deleteAccount}>
            <Text style={styles.dangerBtnText}>Supprimer définitivement</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 20, gap: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  rowSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  field: { paddingVertical: 14 },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F3F4F6' },
  label: { fontSize: 12, fontWeight: '600', color: '#9CA3AF', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  input: { fontSize: 16, color: '#111827', padding: 0 },
  saveBtn: { backgroundColor: '#1E3A5F', borderRadius: 14, padding: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  dangerCard: { backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16, gap: 14, borderWidth: 1, borderColor: '#FECACA' },
  dangerInfo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dangerLabel: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
  dangerSub: { fontSize: 12, color: '#F87171', marginTop: 2, lineHeight: 17 },
  dangerBtn: { backgroundColor: '#EF4444', borderRadius: 12, padding: 14, alignItems: 'center' },
  dangerBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
});
