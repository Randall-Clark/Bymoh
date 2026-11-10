import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Modal, Pressable,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import AnimatedRN, { SlideInRight, SlideInLeft } from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { navDir } from '@/lib/navDir';
import { StepIndicator } from '@/components/forms/StepIndicator';
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

  /* ── Success modal state + animation ── */
  const [successVisible, setSuccessVisible] = useState(false);
  const [createdId,      setCreatedId]      = useState('');
  const [createdName,    setCreatedName]    = useState('');
  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const showSuccess = () => {
    setSuccessVisible(true);
    scale.setValue(0.85);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1,  useNativeDriver: true, tension: 65, friction: 8 }),
      Animated.timing(opacity, { toValue: 1,  useNativeDriver: true, duration: 220 }),
    ]).start();
  };

  const entering = navDir.current === 'back' ? SlideInLeft.duration(300) : SlideInRight.duration(300);
  navDir.current = 'forward';
  const goBack = () => {
    navDir.current = 'back';
    router.replace('/(pro)/register/step4' as any);
  };

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
    { icon: 'grid',      label: 'Catégorie',   value: draft.category  },
    { icon: 'map-pin',   label: 'Ville',       value: draft.city      },
    { icon: 'phone',     label: 'Téléphone',   value: draft.phone     },
    { icon: 'clock',     label: 'Horaires',    value: draft.schedule ? 'Configurés ✓' : 'Non définis' },
  ].filter((f) => f.value?.trim?.());

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

      if (draft.cover_uri && newBiz) {
        try {
          const ext  = (draft.cover_uri.split('.').pop()?.split('?')[0] ?? 'jpg').toLowerCase();
          const path = `covers/${newBiz.id}.${ext}`;
          const publicUrl = await uploadImageToSupabase(draft.cover_uri, 'businesses', path);
          if (publicUrl) {
            await supabase.from('businesses').update({ cover_url: publicUrl }).eq('id', newBiz.id);
          }
        } catch (coverErr) { console.error('[CoverUpload]', coverErr); }
      }

      if (draft.schedule && newBiz) {
        const DAY_KEYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const hours = (draft.schedule as any[]).map((h: any, i: number) => ({
          id: generateId(), business_id: newBiz.id, day_of_week: DAY_KEYS[i],
          open_time: h.open_time, close_time: h.close_time, is_closed: !h.is_open,
        }));
        await supabase.from('business_hours').insert(hours);
      }

      if (draft.has_delivery && (draft.delivery_price ?? 0) > 0 && newBiz) {
        try {
          await supabase.from('delivery_zones').insert({
            id: generateId(), business_id: newBiz.id,
            label: draft.city ?? 'Zone principale', price: draft.delivery_price,
          });
        } catch (zoneErr) { console.warn('[DeliveryZone]', zoneErr); }
      }

      await supabase.from('users').update({ role: 'pro' }).eq('id', profile.id);
      const { data: up } = await supabase.from('users').select('*').eq('id', profile.id).single();
      if (up) setProfile(up as any);
      await qc.invalidateQueries({ queryKey: ['my-businesses',  profile.id] });
      await qc.invalidateQueries({ queryKey: ['pro-businesses', profile.id] });

      setCreatedId(newBiz.id);
      setCreatedName(newBiz.name ?? draft.name ?? 'Boutique');
      showSuccess();

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('[CreateBusiness]', msg);
      Alert.alert('Erreur lors de la création', msg);
    } finally {
      setLoading(false);
    }
  };

  const goToDashboard = () => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 0.85, useNativeDriver: true, tension: 65, friction: 8 }),
      Animated.timing(opacity, { toValue: 0,    useNativeDriver: true, duration: 160 }),
    ]).start(() => {
      setSuccessVisible(false);
      router.replace({ pathname: '/(pro)/dashboard', params: { newBusinessId: createdId } } as any);
    });
  };

  return (
    <View style={s.root}>

      <View style={[s.navbar, { paddingTop: insets.top + 8 }]}>
        <Text style={s.navTitle}>Créer mon commerce</Text>
        <TouchableOpacity onPress={handleCancel} style={s.cancelBtn}>
          <Text style={s.cancelTxt}>Annuler</Text>
        </TouchableOpacity>
      </View>

      <View style={s.stepWrap}>
        <StepIndicator current={5} total={5} title="Récapitulatif" />
      </View>

      <AnimatedRN.View style={s.flex} entering={entering}>
        <ScrollView
          style={s.flex}
          contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={s.summaryCard}>
            <View style={s.summaryCardHeader}>
              <View style={s.summaryCardIcon}><Feather name="shopping-bag" size={18} color={ORANGE} /></View>
              <Text style={s.summaryCardTitle}>Votre boutique</Text>
            </View>
            <View style={s.summaryDivider} />
            {summaryFields.map((f, idx) => (
              <View key={f.label} style={[s.summaryRow, idx < summaryFields.length - 1 && s.summaryRowBorder]}>
                <View style={s.summaryIcon}><Feather name={f.icon as any} size={13} color={ORANGE} /></View>
                <Text style={s.summaryLabel}>{f.label}</Text>
                <Text style={s.summaryValue} numberOfLines={1}>{f.value}</Text>
              </View>
            ))}
          </View>

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

        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.footerRow}>
            <TouchableOpacity style={s.prevBtn} onPress={goBack} activeOpacity={0.8} disabled={loading}>
              <Feather name="arrow-left" size={15} color="#6B7280" />
              <Text style={s.prevBtnTxt}>Précédent (4/5)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.nextBtn, loading && s.nextBtnDisabled]}
              onPress={createBusiness}
              activeOpacity={0.85}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.nextBtnTxt}>Valider</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </AnimatedRN.View>

      {/* ── Modal succès centré avec animation scale ── */}
      <Modal visible={successVisible} transparent animationType="none" statusBarTranslucent>
        <Animated.View style={[s.backdropFill, { opacity }]}>
          <Pressable style={{ flex: 1 }} />
        </Animated.View>

        <View style={s.centeredContainer} pointerEvents="box-none">
          <Animated.View style={[s.successBox, { opacity, transform: [{ scale }] }]}>

            <View style={s.successIconCircle}>
              <Feather name="check" size={34} color="#fff" />
            </View>

            <Text style={s.successTitle}>Boutique créée !</Text>
            <Text style={s.successMsg}>
              Votre Boutique{'\n'}
              <Text style={s.successBizName}>« {createdName} »</Text>
              {'\n'}a été enregistrée avec succès.
            </Text>

            <TouchableOpacity style={s.successBtn} onPress={goToDashboard} activeOpacity={0.88}>
              <Text style={s.successBtnTxt}>Accéder au tableau de bord</Text>
              <Feather name="arrow-right" size={15} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
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

  summaryCard:       { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden' },
  summaryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, paddingBottom: 14 },
  summaryCardIcon:   { width: 36, height: 36, borderRadius: 12, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center' },
  summaryCardTitle:  { fontSize: 16, fontWeight: '800', color: '#111827' },
  summaryDivider:    { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 18 },
  summaryRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 13 },
  summaryRowBorder:  { borderBottomWidth: 1, borderBottomColor: '#F9F8F6' },
  summaryIcon:       { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center' },
  summaryLabel:      { fontSize: 13, color: '#9CA3AF', width: 76 },
  summaryValue:      { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },

  cgvBox:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EEF2FF', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  cgvText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  cgvLink: { color: ORANGE, fontWeight: '600' },

  footer:         { backgroundColor: 'transparent', paddingHorizontal: 20, paddingTop: 14 },
  footerRow:      { flexDirection: 'row', alignItems: 'center', gap: 12 },
  prevBtn:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 13, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9F8F6' },
  prevBtnTxt:     { fontSize: 13, fontWeight: '700', color: '#6B7280' },
  nextBtn:        { flex: 1, backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
  nextBtnDisabled:{ opacity: 0.6 },
  nextBtnTxt:     { fontSize: 15, fontWeight: '700', color: '#fff' },

  /* ── Modal succès ── */
  backdropFill:      { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.6)' },
  centeredContainer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 28 },

  successBox: {
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 28,
    alignItems: 'center',
    gap: 10,
    width: '100%',
    maxWidth: 360,
  },
  successIconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#22C55E', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successTitle:      { fontSize: 22, fontWeight: '900', color: '#111827', textAlign: 'center' },
  successMsg:        { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 24 },
  successBizName:    { fontWeight: '800', color: ORANGE },
  successBtn:        { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ORANGE, borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14, marginTop: 6, width: '100%', justifyContent: 'center' },
  successBtnTxt:     { fontSize: 15, fontWeight: '700', color: '#fff' },
});
