// components/OnboardingChecklistModal.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, StyleSheet,
  Text, TouchableOpacity, View, ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

const ORANGE = '#FF6835';

interface Props {
  businessId:   string;
  businessName: string;
}

export function OnboardingChecklistModal({ businessId, businessName }: Props) {
  const [visible,           setVisible]           = useState(false);
  const [walletConfigured,  setWalletConfigured]  = useState(false);
  const [productsAdded,     setProductsAdded]     = useState(false);
  const [loading,           setLoading]           = useState(true);
  const [neverShow,         setNeverShow]         = useState(false);

  /* ── Animation scale + opacité ── */
  const scale   = useRef(new Animated.Value(0.88)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  const animateIn = () => {
    scale.setValue(0.88);
    opacity.setValue(0);
    Animated.parallel([
      Animated.spring(scale,   { toValue: 1,   useNativeDriver: true, tension: 70, friction: 9 }),
      Animated.timing(opacity, { toValue: 1,   useNativeDriver: true, duration: 220 }),
    ]).start();
  };

  const animateOut = (cb: () => void) => {
    Animated.parallel([
      Animated.spring(scale,   { toValue: 0.88, useNativeDriver: true, tension: 70, friction: 9 }),
      Animated.timing(opacity, { toValue: 0,    useNativeDriver: true, duration: 160 }),
    ]).start(() => cb());
  };

  useEffect(() => {
    if (!businessId) return;
    checkAndShow();
  }, [businessId]);

  const checkAndShow = async () => {
    setLoading(true);
    try {
      /* 1. L'utilisateur a-t-il coché "ne plus afficher" ? */
      const dismissed = await AsyncStorage.getItem(`onboarding_dismissed_${businessId}`);
      if (dismissed === 'true') return;

      /* 2. Vérifier l'état des tâches en base */
      const [walletRes, productsRes] = await Promise.all([
        supabase.from('wallet_accounts').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      ]);

      const wallet   = (walletRes.count ?? 0) > 0;
      const products = (productsRes.count ?? 0) >= 3;

      setWalletConfigured(wallet);
      setProductsAdded(products);
      setLoading(false);

      /* 3. Afficher si au moins une tâche est incomplète */
      if (!wallet || !products) {
        setVisible(true);
        animateIn();
      }
    } catch {
      setLoading(false);
    }
  };

  const close = async () => {
    if (neverShow) {
      await AsyncStorage.setItem(`onboarding_dismissed_${businessId}`, 'true');
    }
    animateOut(() => setVisible(false));
  };

  const goWallet = () => {
    animateOut(() => {
      setVisible(false);
      router.navigate({ pathname: '/(pro)/business/wallet', params: { businessId } } as any);
    });
  };

  const goAddProduct = () => {
    animateOut(() => {
      setVisible(false);
      router.navigate({ pathname: '/(pro)/catalog/edit', params: { businessId, defaultKind: 'article' } } as any);
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
      {/* Backdrop foncé */}
      <Animated.View style={[s.backdrop, { opacity }]}>
        <Pressable style={s.backdropPress} onPress={close} />
      </Animated.View>

      {/* Popup centré */}
      <View style={s.centeredContainer} pointerEvents="box-none">
        <Animated.View style={[s.popup, { opacity, transform: [{ scale }] }]}>

          {/* Icône + Titre */}
          <View style={s.popupHeader}>
            <View style={s.popupIconWrap}>
              <Feather name="check-square" size={20} color={ORANGE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.popupSup}>TÂCHES À EFFECTUER</Text>
              <Text style={s.popupTitle}>Finaliser votre boutique</Text>
              <Text style={s.popupBizName} numberOfLines={1}>« {businessName} »</Text>
            </View>
            <TouchableOpacity onPress={close} style={s.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={s.divider} />

          {/* Liste des tâches */}
          {loading ? (
            <ActivityIndicator color={ORANGE} style={{ paddingVertical: 20 }} />
          ) : (
            <View style={s.taskList}>

              <TaskRow
                done
                label="Enregistrer votre boutique"
                sub="Boutique créée avec succès"
              />

              <View style={s.taskSep} />

              <TaskRow
                done={walletConfigured}
                label="Configurer le portefeuille marchand"
                sub={walletConfigured ? 'Portefeuille configuré ✓' : 'Ajoutez vos comptes de paiement'}
                actionLabel={walletConfigured ? undefined : 'Configurer'}
                onAction={walletConfigured ? undefined : goWallet}
              />

              <View style={s.taskSep} />

              <TaskRow
                done={productsAdded}
                label="Ajouter 3 produits ou services"
                sub={productsAdded ? 'Catalogue complété ✓' : 'Ajoutez au moins 3 articles ou services'}
                actionLabel={productsAdded ? undefined : 'Ajouter'}
                onAction={productsAdded ? undefined : goAddProduct}
              />

            </View>
          )}

          <View style={s.divider} />

          {/* Pied : case "ne plus afficher" + bouton fermer */}
          <View style={s.popupFooter}>
            <TouchableOpacity style={s.neverShowRow} onPress={() => setNeverShow((v) => !v)} activeOpacity={0.7}>
              <View style={[s.checkbox, neverShow && s.checkboxChecked]}>
                {neverShow && <Feather name="check" size={11} color="#fff" />}
              </View>
              <Text style={s.neverShowTxt}>Ne plus afficher ce message</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.closeActionBtn} onPress={close} activeOpacity={0.85}>
              <Text style={s.closeActionTxt}>Fermer</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

function TaskRow({ done, label, sub, actionLabel, onAction }: {
  done: boolean; label: string; sub: string;
  actionLabel?: string; onAction?: () => void;
}) {
  return (
    <View style={r.row}>
      <View style={[r.check, done && r.checkDone]}>
        <Feather name="check" size={12} color={done ? '#fff' : '#D1D5DB'} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[r.label, done && r.labelDone]}>{label}</Text>
        <Text style={r.sub}>{sub}</Text>
      </View>
      {!done && actionLabel && onAction && (
        <TouchableOpacity style={r.actionBtn} onPress={onAction} activeOpacity={0.85}>
          <Text style={r.actionTxt}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  backdrop:        { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.55)' },
  backdropPress:   { flex: 1 },
  centeredContainer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 24 },

  popup: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
  },

  popupHeader:  { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 18, paddingBottom: 14 },
  popupIconWrap:{ width: 42, height: 42, borderRadius: 13, backgroundColor: '#FFF0EA', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  popupSup:     { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 1.1, marginBottom: 2 },
  popupTitle:   { fontSize: 15, fontWeight: '800', color: '#111827' },
  popupBizName: { fontSize: 13, color: ORANGE, fontWeight: '600', marginTop: 2 },
  closeBtn:     { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },

  divider:  { height: 1, backgroundColor: '#F3F4F6' },
  taskList: { paddingVertical: 4 },
  taskSep:  { height: 1, backgroundColor: '#F9F8F6', marginLeft: 56 },

  popupFooter:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  neverShowRow:   { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox:       { width: 20, height: 20, borderRadius: 6, borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked:{ backgroundColor: ORANGE, borderColor: ORANGE },
  neverShowTxt:   { fontSize: 12, color: '#6B7280', flex: 1, lineHeight: 16 },
  closeActionBtn: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  closeActionTxt: { fontSize: 13, fontWeight: '700', color: '#374151' },
});

const r = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  check:      { width: 26, height: 26, borderRadius: 13, backgroundColor: '#F3F4F6', borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  checkDone:  { backgroundColor: '#22C55E', borderColor: '#22C55E' },
  label:      { fontSize: 13, fontWeight: '700', color: '#374151' },
  labelDone:  { color: '#9CA3AF', textDecorationLine: 'line-through' },
  sub:        { fontSize: 11, color: '#9CA3AF', marginTop: 1 },
  actionBtn:  { backgroundColor: ORANGE, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 7, flexShrink: 0 },
  actionTxt:  { fontSize: 12, fontWeight: '700', color: '#fff' },
});
