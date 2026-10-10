import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator, Alert, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Button } from '@/components/ui/Button';
import { registerDraft } from './step1';
import { uploadImageToSupabase } from '@/lib/uploadImage';

const ORANGE = '#FF6835';
const DARK   = '#1A1025';

const BUSINESS_REGISTRATION_FEE = 0;

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) +
         Math.random().toString(36).slice(2, 10);
}

export default function RegisterPaymentScreen() {
  const insets     = useSafeAreaInsets();
  const qc         = useQueryClient();
  const { profile, setProfile } = useAuthStore();
  const [loading, setLoading]   = useState(false);

  const handleCancel = () => {
    router.dismissAll();
    if ((profile as any)?.role === 'pro') {
      router.replace('/(pro)/dashboard' as any);
    } else {
      router.replace('/(client)/' as any);
    }
  };

  const draft = registerDraft as any;

  const summaryFields = [
    { icon: 'briefcase', label: 'Nom',        value: draft.name      },
    { icon: 'grid',      label: 'Catégorie',   value: `${draft.category_icon ?? ''} ${draft.category ?? ''}`.trim() },
    { icon: 'map-pin',   label: 'Ville',       value: draft.city      },
    { icon: 'phone',     label: 'Téléphone',   value: draft.phone     },
    { icon: 'clock',     label: 'Horaires',    value: draft.schedule ? 'Configurés ✓' : 'Non définis' },
  ].filter((f) => f.value?.trim());

  const createBusiness = async () => {
    if (!profile?.id) { Alert.alert('Non connecté'); return; }
    setLoading(true);
    try {
      const { data: newBiz, error } = await supabase
        .from('businesses')
        .insert({
          id:            generateId(),
          owner_id:      profile.id,
          name:          draft.name,
          category:      draft.category,
          category_icon: draft.category_icon ?? 'briefcase',
          phone:         draft.phone ?? '',
          address:       draft.address ?? '',
          city:          draft.city ?? 'Cotonou',
          country_code:  (profile as any).country_code ?? null,
          latitude:      draft.latitude ?? null,
          longitude:     draft.longitude ?? null,
          description:   draft.description ?? '',
          email:         draft.email ?? null,
          has_delivery:  draft.has_delivery ?? false,
          cover_url:     null,
          is_active:     true,
          is_open:       false,
          is_verified:   false,
          forfait_paid:  BUSINESS_REGISTRATION_FEE === 0,
          booking_mode:  'none',
        })
        .select()
        .single();

      if (error) throw error;

      // Upload photo de couverture
      if (draft.cover_uri && newBiz) {
        try {
          const ext  = (draft.cover_uri.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase();
          const path = `covers/${newBiz.id}.${ext}`;
          const publicUrl = await uploadImageToSupabase(draft.cover_uri, 'businesses', path);
          if (publicUrl) {
            await supabase.from('businesses').update({ cover_url: publicUrl }).eq('id', newBiz.id);
          } else {
            console.error('[CoverUpload] uploadImageToSupabase returned null');
          }
        } catch (coverErr) {
          console.error('[CoverUpload] catch', coverErr);
        }
      }

      // Horaires
      if (draft.schedule && newBiz) {
        const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const hours = (draft.schedule as any[]).map((h: any, i: number) => ({
          id:          generateId(),
          business_id: newBiz.id,
          day_of_week: DAY_KEYS[i],
          open_time:   h.open_time,
          close_time:  h.close_time,
          is_closed:   !h.is_open,
        }));
        await supabase.from('business_hours').insert(hours);
      }

      // Zone de livraison initiale (configurée à l'étape 4)
      if (draft.has_delivery && (draft.delivery_price ?? 0) > 0 && newBiz) {
        try {
          await supabase.from('delivery_zones').insert({
            id:          generateId(),
            business_id: newBiz.id,
            label:       draft.city ?? 'Zone principale',
            price:       draft.delivery_price,
          });
        } catch (zoneErr) {
          console.warn('[DeliveryZone]', zoneErr);
        }
      }

      // Passage en rôle pro
      await supabase.from('users').update({ role: 'pro' }).eq('id', profile.id);
      const { data: up } = await supabase.from('users').select('*').eq('id', profile.id).single();
      if (up) setProfile(up as any);

      await qc.invalidateQueries({ queryKey: ['my-businesses',  profile.id] });
      await qc.invalidateQueries({ queryKey: ['pro-businesses', profile.id] });

      router.replace('/(pro)/dashboard' as any);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('[CreateBusiness]', msg);
      Alert.alert('Erreur lors de la création', msg);
    } finally {
      setLoading(false);
    }
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
        <StepIndicator current={5} total={5} title="Récapitulatif" />
      </View>

      <ScrollView
        style={s.flex}
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Badge étape finale */}
        <View style={s.finalBadge}>
          <Feather name="check-circle" size={16} color="#22C55E" />
          <Text style={s.finalBadgeText}>Dernière étape — vérifiez vos informations</Text>
        </View>

        {/* Carte récapitulatif */}
        <View style={s.summaryCard}>
          <View style={s.summaryCardHeader}>
            <View style={s.summaryCardIcon}>
              <Feather name="shopping-bag" size={18} color={ORANGE} />
            </View>
            <Text style={s.summaryCardTitle}>Votre commerce</Text>
          </View>

          <View style={s.summaryDivider} />

          {summaryFields.map((f, idx) => (
            <View key={f.label} style={[s.summaryRow, idx < summaryFields.length - 1 && s.summaryRowBorder]}>
              <View style={s.summaryIcon}>
                <Feather name={f.icon as any} size={13} color={ORANGE} />
              </View>
              <Text style={s.summaryLabel}>{f.label}</Text>
              <Text style={s.summaryValue} numberOfLines={1}>{f.value}</Text>
            </View>
          ))}
        </View>

        {/* CGU */}
        <View style={s.cgvBox}>
          <Feather name="shield" size={16} color="#6366F1" />
          <Text style={s.cgvText}>
            En créant votre commerce, vous acceptez les{' '}
            <Text style={s.cgvLink}>Conditions Générales d'Utilisation</Text>
            {' '}ainsi que la{' '}
            <Text style={s.cgvLink}>Politique de confidentialité</Text>
            {' '}de Bymoh.
          </Text>
        </View>
      </ScrollView>

      {/* ── Footer ── */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title={loading ? 'Création en cours…' : 'Créer mon commerce'}
          onPress={createBusiness}
          loading={loading}
          fullWidth
          size="lg"
        />
      </View>
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

  finalBadge:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  finalBadgeText: { fontSize: 13, fontWeight: '600', color: '#166534' },

  summaryCard: {
    backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 10, elevation: 3,
  },
  summaryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, paddingBottom: 14 },
  summaryCardIcon:   { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center' },
  summaryCardTitle:  { fontSize: 16, fontWeight: '800', color: '#111827' },
  summaryDivider:    { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 18 },

  summaryRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13 },
  summaryRowBorder: { borderBottomWidth: 1, borderBottomColor: '#F9F8F6' },
  summaryIcon:      { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center' },
  summaryLabel:     { fontSize: 13, color: '#9CA3AF', width: 76 },
  summaryValue:     { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },

  cgvBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: '#EEF2FF', borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: '#C7D2FE',
  },
  cgvText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  cgvLink: { color: ORANGE, fontWeight: '600' },

  footer: { backgroundColor: '#fff', paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#EFEFEF' },
});
