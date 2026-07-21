import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { Business } from '@/types';

export default function ProProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(false);
  const topPad = Platform.OS === 'web' ? 67 : insets.top + 8;
  const botPad = Platform.OS === 'web' ? 34 : insets.bottom;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', profile?.id ?? '')
        .limit(1)
        .single();
      if (data) setBusiness(data as Business);
    })();
  }, [profile?.id]);

  const save = async () => {
    if (!business) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('businesses')
        .update({ name: business.name, description: business.description, phone: business.phone, email: business.email, address: business.address })
        .eq('id', business.id);
      if (error) throw error;
      Alert.alert('Enregistré !', 'Votre profil a été mis à jour.');
    } catch (err: unknown) {
      Alert.alert('Erreur', err instanceof Error ? err.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  if (!business) {
    return (
      <View style={[styles.root, styles.empty, { paddingTop: topPad }]}>
        <Feather name="briefcase" size={48} color="#D1D5DB" />
        <Text style={styles.emptyTitle}>Aucun commerce</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => router.push('/(pro)/register/step1' as any)}>
          <Text style={styles.createBtnText}>Créer mon commerce</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Profil du commerce</Text>
        <Badge label={business.is_active ? 'Actif' : 'Inactif'} variant={business.is_active ? 'confirmed' : 'cancelled'} size="md" />
      </View>

      <ScrollView style={styles.flex} contentContainerStyle={[styles.content, { paddingBottom: botPad + 120 }]} showsVerticalScrollIndicator={false}>
        <Input label="Nom du commerce" value={business.name} onChangeText={(v) => setBusiness({ ...business, name: v })} leftIcon="briefcase" />
        <Input label="Description" value={business.description ?? ''} onChangeText={(v) => setBusiness({ ...business, description: v })} multiline />
        <Input label="Téléphone" value={business.phone ?? ''} onChangeText={(v) => setBusiness({ ...business, phone: v })} leftIcon="phone" keyboardType="phone-pad" />
        <Input label="Email" value={business.email ?? ''} onChangeText={(v) => setBusiness({ ...business, email: v })} leftIcon="mail" keyboardType="email-address" />
        <Input label="Adresse" value={business.address} onChangeText={(v) => setBusiness({ ...business, address: v })} leftIcon="map-pin" />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: botPad + 16 }]}>
        <Button title="Enregistrer" onPress={save} loading={loading} fullWidth size="lg" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#F8F7F4' },
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#374151' },
  createBtn: { backgroundColor: '#FF6835', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 100 },
  createBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '800', color: '#111827' },
  content: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 10 },
});
