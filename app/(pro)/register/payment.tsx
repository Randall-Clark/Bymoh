import { router } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Dimensions, Modal, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity,
  TouchableWithoutFeedback, View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { StepIndicator } from '@/components/forms/StepIndicator';
import { Button } from '@/components/ui/Button';
import { buildBusinessTag } from '@/lib/businessTag';
import {
  PaymentMethod, PAYMENT_METHODS,
  initiatePayment, checkPaymentStatus, formatAmount,
} from '@/lib/payment';
import { registerDraft } from './step1';

const BUSINESS_REGISTRATION_FEE = 0;
const { height: SCREEN_H } = Dimensions.get('window');

function generateId(): string {
  return Math.random().toString(36).slice(2, 10) +
         Math.random().toString(36).slice(2, 10);
}

// ── Sheet de paiement ─────────────────────────────────────────────────────────
type SheetStep = 'invoice' | 'phone' | 'processing' | 'webview' | 'success' | 'failure';

function PaymentSheet({
  visible, amount, description, userId,
  onSuccess, onClose,
}: {
  visible: boolean;
  amount: number;
  description: string;
  userId: string;
  onSuccess: (txId: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  const [step, setStep]               = useState<SheetStep>('invoice');
  const [method, setMethod]           = useState<PaymentMethod>('mtn_momo');
  const [phone, setPhone]             = useState('');
  const [phoneErr, setPhoneErr]       = useState('');
  const [txId, setTxId]               = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const available = PAYMENT_METHODS.filter((m) => m.available);
  const isMoMo    = method !== 'card';

  React.useEffect(() => {
    if (visible) {
      setStep('invoice'); setPhone(''); setPhoneErr('');
      setTxId(null); setCheckoutUrl(null); setErrorMsg('');
      Animated.spring(slideY, { toValue: 0, tension: 68, friction: 12, useNativeDriver: true }).start();
    } else {
      clearPoll();
      Animated.timing(slideY, { toValue: SCREEN_H, duration: 240, useNativeDriver: true }).start();
    }
  }, [visible]);

  const dismiss = () => {
    clearPoll();
    Animated.timing(slideY, { toValue: SCREEN_H, duration: 240, useNativeDriver: true }).start(() => onClose());
  };

  const clearPoll = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPayment = async (phoneNumber?: string) => {
    setStep('processing');
    const result = await initiatePayment(
      { amount, description, purpose: 'business_registration', userId },
      method, phoneNumber,
    );
    if (!result.success || !result.transactionId) {
      setErrorMsg(result.error ?? 'Paiement échoué');
      setStep('failure');
      return;
    }
    setTxId(result.transactionId);
    if (result.checkoutUrl) {
      setCheckoutUrl(result.checkoutUrl);
      setStep('webview');
    } else {
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        const status = await checkPaymentStatus(result.transactionId!);
        if (status === 'approved') {
          clearPoll(); setStep('success');
          setTimeout(() => onSuccess(result.transactionId!), 1200);
        } else if (status === 'declined' || attempts >= 30) {
          clearPoll();
          setErrorMsg(status === 'declined' ? 'Paiement refusé' : 'Délai dépassé');
          setStep('failure');
        }
      }, 3000);
    }
  };

  const onWebViewNav = (state: any) => {
    const url: string = state.url ?? '';
    if (url.includes('approved') || url.includes('/payment/callback')) {
      if (txId) { setStep('success'); setTimeout(() => onSuccess(txId), 1200); }
    } else if (url.includes('declined') || url.includes('failed')) {
      setErrorMsg('Paiement refusé.'); setStep('failure');
    }
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={step === 'webview' ? undefined : dismiss}>
        <Animated.View style={[ss.backdrop, {
          opacity: slideY.interpolate({ inputRange: [0, SCREEN_H], outputRange: [1, 0], extrapolate: 'clamp' }),
        }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[
        ss.sheet,
        step === 'webview' && { height: SCREEN_H },
        { transform: [{ translateY: slideY }] },
      ]}>
        <View style={ss.handle} />

        {step === 'invoice' && (
          <>
            <View style={ss.sheetHeader}>
              <TouchableOpacity onPress={dismiss} style={ss.iconBtn}>
                <Feather name="x" size={20} color="#9CA3AF" />
              </TouchableOpacity>
              <Text style={ss.sheetTitle}>Détail de la commande</Text>
            </View>
            <ScrollView contentContainerStyle={[ss.sheetContent, { paddingBottom: insets.bottom + 24 }]}>
              <View style={ss.invoiceBox}>
                <View style={ss.invoiceRow}>
                  <Text style={ss.invoiceLabel}>{description}</Text>
                  <Text style={ss.invoiceValue}>{formatAmount(amount)}</Text>
                </View>
                <View style={ss.invoiceDivider} />
                <View style={ss.invoiceRow}>
                  <Text style={[ss.invoiceLabel, { fontWeight: '800', color: '#111827' }]}>Total</Text>
                  <Text style={[ss.invoiceValue, { fontSize: 20, color: '#FF6835' }]}>{formatAmount(amount)}</Text>
                </View>
              </View>
              <Text style={ss.sectionLabel}>Mode de paiement</Text>
              {available.map((m) => (
                <TouchableOpacity key={m.id} style={[ss.methodCard, method === m.id && ss.methodCardActive]}
                  onPress={() => setMethod(m.id as PaymentMethod)} activeOpacity={0.85}>
                  <Text style={ss.methodEmoji}>{m.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[ss.methodLabel, method === m.id && { color: '#FF6835' }]}>{m.label}</Text>
                    <Text style={ss.methodDesc}>{m.description}</Text>
                  </View>
                  <View style={[ss.radio, method === m.id && ss.radioActive]}>
                    {method === m.id && <View style={ss.radioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={ss.payBtn} onPress={() => isMoMo ? setStep('phone') : startPayment()} activeOpacity={0.88}>
                <Text style={ss.payBtnText}>Confirmer le paiement</Text>
              </TouchableOpacity>
              <View style={ss.secureRow}>
                <Feather name="lock" size={12} color="#9CA3AF" />
                <Text style={ss.secureText}>Paiement sécurisé par FedaPay</Text>
              </View>
            </ScrollView>
          </>
        )}

        {step === 'phone' && (
          <>
            <View style={ss.sheetHeader}>
              <TouchableOpacity onPress={() => setStep('invoice')} style={ss.iconBtn}>
                <Feather name="arrow-left" size={20} color="#111827" />
              </TouchableOpacity>
              <Text style={ss.sheetTitle}>{PAYMENT_METHODS.find((m) => m.id === method)?.label}</Text>
            </View>
            <ScrollView contentContainerStyle={[ss.sheetContent, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
              <Text style={ss.phoneInstr}>Entrez le numéro associé à votre compte mobile money. Vous recevrez une notification USSD pour confirmer.</Text>
              <TextInput style={ss.phoneInput} placeholder="Ex : 97123456" placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad" value={phone}
                onChangeText={(t) => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setPhoneErr(''); }}
                maxLength={10} autoFocus />
              {!!phoneErr && (
                <View style={ss.errBox}>
                  <Feather name="alert-circle" size={13} color="#EF4444" />
                  <Text style={ss.errText}>{phoneErr}</Text>
                </View>
              )}
              <View style={ss.amountRecap}>
                <Text style={ss.amountRecapLabel}>Montant à débiter</Text>
                <Text style={ss.amountRecapValue}>{formatAmount(amount)}</Text>
              </View>
              <TouchableOpacity style={ss.payBtn} onPress={() => {
                if (phone.replace(/\D/g, '').length < 8) { setPhoneErr('Numéro trop court (min 8 chiffres)'); return; }
                startPayment(phone.replace(/\D/g, ''));
              }} activeOpacity={0.88}>
                <Text style={ss.payBtnText}>Envoyer la demande</Text>
              </TouchableOpacity>
            </ScrollView>
          </>
        )}

        {step === 'processing' && (
          <View style={ss.centerView}>
            <View style={ss.processingCircle}><ActivityIndicator size="large" color="#FF6835" /></View>
            <Text style={ss.centerTitle}>Traitement en cours…</Text>
            {isMoMo && <Text style={ss.centerSub}>Acceptez la notification USSD sur votre téléphone.</Text>}
          </View>
        )}

        {step === 'webview' && checkoutUrl && (
          <WebView source={{ uri: checkoutUrl }} style={{ flex: 1 }} onNavigationStateChange={onWebViewNav} javaScriptEnabled domStorageEnabled />
        )}

        {step === 'success' && (
          <View style={ss.centerView}>
            <View style={[ss.resultCircle, { backgroundColor: '#F0FDF4' }]}>
              <Feather name="check-circle" size={52} color="#22C55E" />
            </View>
            <Text style={[ss.centerTitle, { color: '#22C55E' }]}>Paiement confirmé !</Text>
            <Text style={ss.centerSub}>{formatAmount(amount)} débité avec succès.</Text>
          </View>
        )}

        {step === 'failure' && (
          <View style={[ss.centerView, { paddingBottom: insets.bottom + 24 }]}>
            <View style={[ss.resultCircle, { backgroundColor: '#FEF2F2' }]}>
              <Feather name="x-circle" size={52} color="#EF4444" />
            </View>
            <Text style={[ss.centerTitle, { color: '#EF4444' }]}>Paiement échoué</Text>
            <Text style={ss.centerSub}>{errorMsg}</Text>
            <TouchableOpacity style={ss.retryBtn} onPress={() => setStep('invoice')}>
              <Text style={ss.retryText}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Écran principal Step 5
// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterPaymentScreen() {
  const insets  = useSafeAreaInsets();
  const { profile, setProfile } = useAuthStore();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [loading, setLoading]           = useState(false);

  const draft = registerDraft as any;

  const summaryFields = [
    { icon: 'briefcase', label: 'Nom',      value: draft.name      },
    { icon: 'grid',      label: 'Catégorie', value: `${draft.category_icon ?? ''} ${draft.category ?? ''}`.trim() },
    { icon: 'map-pin',   label: 'Ville',     value: draft.city      },
    { icon: 'phone',     label: 'Téléphone', value: draft.phone     },
    { icon: 'clock',     label: 'Horaires',  value: draft.schedule ? 'Configurés' : 'Non définis' },
  ].filter((f) => f.value?.trim());

  const createBusiness = async () => {
    if (!profile?.id) { Alert.alert('Non connecté'); return; }
    setLoading(true);
    try {
      // ── Génère l'ID et le tag ensemble ──────────────────────────────────
      const newId = generateId();
      const tag   = buildBusinessTag(draft.name, newId); // ✅ tag généré ici

      const { data: newBiz, error } = await supabase
        .from('businesses')
        .insert({
          id:            newId,
          tag:           tag,            // ✅ tag enregistré en DB
          owner_id:      profile.id,
          name:          draft.name,
          category:      draft.category,
          category_icon: draft.category_icon ?? 'briefcase',
          phone:         draft.phone ?? '',
          address:       draft.address ?? '',
          city:          draft.city ?? 'Cotonou',
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
          const res  = await fetch(draft.cover_uri);
          const blob = await res.blob();
          const ext  = draft.cover_uri.split('.').pop()?.split('?')[0] ?? 'jpg';
          const path = `covers/${newBiz.id}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from('businesses')
            .upload(path, blob, { upsert: true, contentType: `image/${ext}` });
          if (!upErr) {
            const { data } = supabase.storage.from('businesses').getPublicUrl(path);
            await supabase.from('businesses').update({ cover_url: data.publicUrl }).eq('id', newBiz.id);
          }
        } catch {}
      }

      // Horaires
      if (draft.schedule && newBiz) {
        const hours = draft.schedule.map((h: any, i: number) => ({
          id:          generateId(),
          business_id: newBiz.id,
          day_of_week: i === 6 ? 0 : i + 1,
          open_time:   h.open_time,
          close_time:  h.close_time,
          is_closed:   !h.is_open,
        }));
        await supabase.from('business_hours').insert(hours);
      }

      // Passage en rôle pro
      await supabase.from('users').update({ role: 'pro' }).eq('id', profile.id);
      const { data: up } = await supabase.from('users').select('*').eq('id', profile.id).single();
      if (up) setProfile(up as any);

      router.replace('/(pro)/dashboard' as any);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : JSON.stringify(err);
      console.error('[CreateBusiness]', msg);
      Alert.alert('Erreur lors de la création', msg);
    } finally {
      setLoading(false);
    }
  };

  const onPress = () => {
    if (BUSINESS_REGISTRATION_FEE === 0) createBusiness();
    else setSheetVisible(true);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
      </View>

      <View style={styles.stepWrap}>
        <StepIndicator current={5} total={5} title="Récapitulatif" />
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Votre commerce</Text>
          {summaryFields.map((f) => (
            <View key={f.label} style={styles.summaryRow}>
              <View style={styles.summaryIcon}>
                <Feather name={f.icon as any} size={14} color="#FF6835" />
              </View>
              <Text style={styles.summaryLabel}>{f.label}</Text>
              <Text style={styles.summaryValue} numberOfLines={1}>{f.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.cgvBox}>
          <Feather name="file-text" size={14} color="#1E3A5F" />
          <Text style={styles.cgvText}>
            En créant votre commerce, vous acceptez les{' '}
            <Text style={styles.cgvLink}>Conditions Générales d'Utilisation</Text>
            {' '}ainsi que la{' '}
            <Text style={styles.cgvLink}>Politique de confidentialité</Text>
            {' '}de Bymoh.
          </Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Button
          title={loading
            ? 'Création en cours…'
            : BUSINESS_REGISTRATION_FEE === 0
              ? 'Terminer'
              : `Payer ${formatAmount(BUSINESS_REGISTRATION_FEE)}`}
          onPress={onPress}
          loading={loading}
          fullWidth
          size="lg"
        />
      </View>

      {BUSINESS_REGISTRATION_FEE > 0 && (
        <PaymentSheet
          visible={sheetVisible}
          amount={BUSINESS_REGISTRATION_FEE}
          description="Inscription Bymoh Pro"
          userId={profile?.id ?? ''}
          onSuccess={async () => { setSheetVisible(false); await createBusiness(); }}
          onClose={() => setSheetVisible(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  flex: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 4 },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepWrap: { paddingHorizontal: 20, paddingBottom: 12, backgroundColor: '#F8F7F4' },
  content: { paddingHorizontal: 20, paddingTop: 8, gap: 16 },
  summaryCard: { backgroundColor: '#fff', borderRadius: 18, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  summaryTitle: { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 2 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  summaryLabel: { fontSize: 13, color: '#9CA3AF', width: 80 },
  summaryValue: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },
  cgvBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#EEF2FF', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#C7D2FE' },
  cgvText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 20 },
  cgvLink: { color: '#FF6835', fontWeight: '600' },
  footer: { backgroundColor: '#F8F7F4', paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
});

const ss = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCREEN_H * 0.88, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  iconBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: '#111827' },
  sheetContent: { padding: 20, gap: 14 },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },
  invoiceBox: { backgroundColor: '#F8F7F4', borderRadius: 16, padding: 16, gap: 12 },
  invoiceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  invoiceLabel: { fontSize: 14, color: '#6B7280' },
  invoiceValue: { fontSize: 15, fontWeight: '700', color: '#111827' },
  invoiceDivider: { height: 1, backgroundColor: '#E5E7EB' },
  methodCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  methodCardActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  methodEmoji: { fontSize: 24 },
  methodLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  methodDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#FF6835' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6835' },
  payBtn: { backgroundColor: '#FF6835', borderRadius: 14, padding: 16, alignItems: 'center' },
  payBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  secureText: { fontSize: 12, color: '#9CA3AF' },
  phoneInstr: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  phoneInput: { backgroundColor: '#F3F4F6', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 20, fontWeight: '700', color: '#111827', letterSpacing: 2, borderWidth: 1.5, borderColor: '#E5E7EB' },
  errBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10 },
  errText: { fontSize: 13, color: '#EF4444' },
  amountRecap: { backgroundColor: '#F8F7F4', borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  amountRecapLabel: { fontSize: 12, color: '#9CA3AF' },
  amountRecapValue: { fontSize: 22, fontWeight: '800', color: '#111827' },
  centerView: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  processingCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  resultCircle: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  centerTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  centerSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21 },
  retryBtn: { backgroundColor: '#FF6835', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  retryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});