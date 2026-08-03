// components/PaymentModal.tsx
// ── Modal de paiement universel — MTN MoMo, Moov Money, Carte ────────────────
import { Feather } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, Dimensions, Keyboard, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, TouchableWithoutFeedback, View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  PaymentMethod, PaymentRequest, PAYMENT_METHODS,
  initiatePayment, checkPaymentStatus, formatAmount,
} from '@/lib/payment';

interface Props {
  visible:       boolean;
  request:       PaymentRequest | null;
  onSuccess:     (transactionId: string) => void;
  onFailure:     (error: string) => void;
  onClose:       () => void;
}

type Step = 'method' | 'phone' | 'processing' | 'webview' | 'success' | 'failure';

const { height: SCREEN_H, width: SCREEN_W } = Dimensions.get('window');
const SHEET_H = SCREEN_H * 0.85;

export function PaymentModal({ visible, request, onSuccess, onFailure, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const slideY = useRef(new Animated.Value(SCREEN_H)).current;

  const [step, setStep]               = useState<Step>('method');
  const [method, setMethod]           = useState<PaymentMethod>('mtn_momo');
  const [phone, setPhone]             = useState('');
  const [phoneError, setPhoneError]   = useState('');
  const [transactionId, setTransactionId] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState('');
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const availableMethods = PAYMENT_METHODS.filter((m) => m.available);
  const isMobileMoney    = method !== 'card';

  React.useEffect(() => {
    if (visible) {
      setStep('method'); setPhone(''); setPhoneError('');
      setTransactionId(null); setCheckoutUrl(null); setErrorMsg('');
      Animated.spring(slideY, { toValue: 0, tension: 68, friction: 12, useNativeDriver: true }).start();
    } else {
      clearPoll();
      Animated.timing(slideY, { toValue: SHEET_H, duration: 240, useNativeDriver: true }).start();
    }
  }, [visible]);

  const dismiss = () => {
    clearPoll();
    Keyboard.dismiss();
    Animated.timing(slideY, { toValue: SHEET_H, duration: 240, useNativeDriver: true }).start(() => onClose());
  };

  const clearPoll = () => {
    if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null; }
  };

  // ── Étape 1 : Méthode sélectionnée → continuer ────────────────────────────
  const onMethodContinue = () => {
    if (isMobileMoney) {
      setStep('phone'); // MoMo → demander le numéro
    } else {
      startPayment(); // Carte → directement WebView
    }
  };

  // ── Étape 2 : Valider le numéro de téléphone ──────────────────────────────
  const onPhoneContinue = () => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length < 8) { setPhoneError('Numéro trop court (min 8 chiffres)'); return; }
    setPhoneError('');
    startPayment(cleaned);
  };

  // ── Initiation du paiement ────────────────────────────────────────────────
  const startPayment = async (phoneNumber?: string) => {
    if (!request) return;
    setStep('processing');
    const result = await initiatePayment(request, method, phoneNumber);

    if (!result.success || !result.transactionId) {
      setErrorMsg(result.error ?? 'Paiement échoué');
      setStep('failure');
      return;
    }

    setTransactionId(result.transactionId);

    if (result.checkoutUrl) {
      // Carte ou MoMo via WebView
      setCheckoutUrl(result.checkoutUrl);
      setStep('webview');
    } else {
      // MoMo direct : USSD envoyé sur le téléphone, on poll le statut
      setStep('processing');
      startPolling(result.transactionId);
    }
  };

  // ── Polling du statut (pour MoMo direct) ─────────────────────────────────
  const startPolling = (txId: string) => {
    let attempts = 0;
    pollTimer.current = setInterval(async () => {
      attempts++;
      const status = await checkPaymentStatus(txId);
      if (status === 'approved') {
        clearPoll();
        setStep('success');
        setTimeout(() => onSuccess(txId), 1500);
      } else if (status === 'declined' || attempts >= 30) {
        clearPoll();
        setErrorMsg(status === 'declined' ? 'Paiement refusé' : 'Délai dépassé. Réessayez.');
        setStep('failure');
      }
    }, 3000); // vérifie toutes les 3s pendant max 90s
  };

  // ── WebView : détecter le succès/échec dans l'URL de retour ───────────────
  const onWebViewNavChange = (navState: any) => {
    const url: string = navState.url ?? '';
    if (url.includes('/payment/callback') || url.includes('approved')) {
      if (transactionId) {
        setStep('success');
        setTimeout(() => onSuccess(transactionId), 1500);
      }
    } else if (url.includes('declined') || url.includes('failed')) {
      setErrorMsg('Paiement refusé ou annulé.');
      setStep('failure');
    }
  };

  if (!visible || !request) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
      <TouchableWithoutFeedback onPress={step === 'webview' ? undefined : dismiss}>
        <Animated.View style={[styles.backdrop, {
          opacity: slideY.interpolate({ inputRange: [0, SHEET_H], outputRange: [1, 0], extrapolate: 'clamp' }),
        }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[
        styles.sheet,
        step === 'webview' && styles.sheetFull,
        { transform: [{ translateY: slideY }] },
      ]}>
        <View style={styles.handle} />

        {/* ── HEADER ── */}
        <View style={styles.header}>
          {step !== 'success' && step !== 'failure' && (
            <TouchableOpacity onPress={step === 'phone' ? () => setStep('method') : dismiss} style={styles.backBtn}>
              <Feather name={step === 'phone' ? 'arrow-left' : 'x'} size={20} color="#6B7280" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>
              {step === 'method'     && 'Choisir un mode de paiement'}
              {step === 'phone'      && 'Numéro Mobile Money'}
              {step === 'processing' && 'Paiement en cours…'}
              {step === 'webview'    && 'Paiement sécurisé'}
              {step === 'success'    && 'Paiement confirmé ✅'}
              {step === 'failure'    && 'Paiement échoué'}
            </Text>
            <Text style={styles.headerAmount}>{formatAmount(request.amount)}</Text>
          </View>
        </View>

        {/* ── ÉTAPE : MÉTHODE ── */}
        {step === 'method' && (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
            <Text style={styles.label}>Méthodes disponibles</Text>
            {availableMethods.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={[styles.methodCard, method === m.id && styles.methodCardActive]}
                onPress={() => setMethod(m.id as PaymentMethod)}
                activeOpacity={0.85}
              >
                <Text style={styles.methodEmoji}>{m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.methodLabel, method === m.id && { color: '#FF6835' }]}>{m.label}</Text>
                  <Text style={styles.methodDesc}>{m.description}</Text>
                </View>
                <View style={[styles.radio, method === m.id && styles.radioActive]}>
                  {method === m.id && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}

            {/* Méthodes bientôt disponibles */}
            <Text style={[styles.label, { marginTop: 8 }]}>Bientôt disponibles</Text>
            {PAYMENT_METHODS.filter((m) => !m.available).map((m) => (
              <View key={m.id} style={[styles.methodCard, { opacity: 0.45 }]}>
                <Text style={styles.methodEmoji}>{m.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.methodLabel}>{m.label}</Text>
                  <Text style={styles.methodDesc}>Disponible prochainement</Text>
                </View>
                <View style={styles.comingSoon}>
                  <Text style={styles.comingSoonText}>Bientôt</Text>
                </View>
              </View>
            ))}

            <TouchableOpacity style={styles.continueBtn} onPress={onMethodContinue} activeOpacity={0.88}>
              <Text style={styles.continueBtnText}>Continuer →</Text>
            </TouchableOpacity>

            <View style={styles.secureRow}>
              <Feather name="lock" size={12} color="#9CA3AF" />
              <Text style={styles.secureText}>Paiement sécurisé par FedaPay</Text>
            </View>
          </ScrollView>
        )}

        {/* ── ÉTAPE : NUMÉRO MOBILE MONEY ── */}
        {step === 'phone' && (
          <View style={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.methodInfo}>
              <Text style={styles.methodInfoEmoji}>
                {PAYMENT_METHODS.find((m) => m.id === method)?.emoji}
              </Text>
              <Text style={styles.methodInfoLabel}>
                {PAYMENT_METHODS.find((m) => m.id === method)?.label}
              </Text>
            </View>

            <Text style={styles.phoneInstructions}>
              Entrez le numéro enregistré sur votre compte{' '}
              {PAYMENT_METHODS.find((m) => m.id === method)?.label}.
              Vous recevrez une notification USSD pour confirmer.
            </Text>

            <View style={styles.phoneInput}>
              <Feather name="phone" size={18} color="#9CA3AF" style={{ marginRight: 10 }} />
              <TextInput
                style={styles.phoneInputText}
                placeholder="Ex : 97123456"
                placeholderTextColor="#9CA3AF"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={(t) => { setPhone(t.replace(/\D/g, '').slice(0, 10)); setPhoneError(''); }}
                maxLength={10}
                autoFocus
              />
            </View>
            {!!phoneError && (
              <View style={styles.errorBox}>
                <Feather name="alert-circle" size={13} color="#EF4444" />
                <Text style={styles.errorText}>{phoneError}</Text>
              </View>
            )}

            <View style={styles.amountBox}>
              <Text style={styles.amountBoxLabel}>Montant à payer</Text>
              <Text style={styles.amountBoxValue}>{formatAmount(request.amount)}</Text>
            </View>

            <TouchableOpacity style={styles.continueBtn} onPress={onPhoneContinue} activeOpacity={0.88}>
              <Text style={styles.continueBtnText}>Payer {formatAmount(request.amount)}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ÉTAPE : TRAITEMENT ── */}
        {step === 'processing' && (
          <View style={styles.centerContent}>
            <View style={styles.processingIcon}>
              <ActivityIndicator size="large" color="#FF6835" />
            </View>
            <Text style={styles.processingTitle}>Traitement en cours…</Text>
            {isMobileMoney && (
              <Text style={styles.processingDesc}>
                Une notification USSD a été envoyée sur votre téléphone.{'\n'}
                Acceptez le paiement pour continuer.
              </Text>
            )}
          </View>
        )}

        {/* ── ÉTAPE : WEBVIEW (carte) ── */}
        {step === 'webview' && checkoutUrl && (
          <View style={{ flex: 1 }}>
            <WebView
              source={{ uri: checkoutUrl }}
              style={{ flex: 1 }}
              onNavigationStateChange={onWebViewNavChange}
              javaScriptEnabled
              domStorageEnabled
            />
          </View>
        )}

        {/* ── ÉTAPE : SUCCÈS ── */}
        {step === 'success' && (
          <View style={[styles.centerContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.resultIcon, { backgroundColor: '#F0FDF4' }]}>
              <Feather name="check-circle" size={48} color="#22C55E" />
            </View>
            <Text style={[styles.resultTitle, { color: '#22C55E' }]}>Paiement confirmé !</Text>
            <Text style={styles.resultDesc}>{formatAmount(request.amount)} débité avec succès.</Text>
            <Text style={styles.txIdText}>Ref: {transactionId?.slice(0, 12)}…</Text>
          </View>
        )}

        {/* ── ÉTAPE : ÉCHEC ── */}
        {step === 'failure' && (
          <View style={[styles.centerContent, { paddingBottom: insets.bottom + 24 }]}>
            <View style={[styles.resultIcon, { backgroundColor: '#FEF2F2' }]}>
              <Feather name="x-circle" size={48} color="#EF4444" />
            </View>
            <Text style={[styles.resultTitle, { color: '#EF4444' }]}>Paiement échoué</Text>
            <Text style={styles.resultDesc}>{errorMsg}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={() => setStep('method')} activeOpacity={0.85}>
              <Text style={styles.retryBtnText}>Réessayer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={dismiss}>
              <Text style={styles.cancelLink}>Annuler</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SCREEN_H * 0.88,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetFull: { height: SCREEN_H },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#E5E7EB', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  headerAmount: { fontSize: 22, fontWeight: '800', color: '#FF6835' },

  content: { padding: 20, gap: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Méthodes
  methodCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#F9FAFB', borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  methodCardActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  methodEmoji: { fontSize: 26 },
  methodLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  methodDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: '#FF6835' },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FF6835' },
  comingSoon: { backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  comingSoonText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },

  continueBtn: { backgroundColor: '#FF6835', borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 8 },
  continueBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  secureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  secureText: { fontSize: 12, color: '#9CA3AF' },

  // Téléphone
  methodInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEF2EC', borderRadius: 12, padding: 12 },
  methodInfoEmoji: { fontSize: 24 },
  methodInfoLabel: { fontSize: 15, fontWeight: '700', color: '#FF6835' },
  phoneInstructions: { fontSize: 13, color: '#6B7280', lineHeight: 20 },
  phoneInput: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F3F4F6', borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  phoneInputText: { flex: 1, fontSize: 20, fontWeight: '700', color: '#111827', letterSpacing: 2 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 10, padding: 10 },
  errorText: { fontSize: 13, color: '#EF4444' },
  amountBox: { backgroundColor: '#F8F7F4', borderRadius: 14, padding: 16, alignItems: 'center', gap: 4 },
  amountBoxLabel: { fontSize: 12, color: '#9CA3AF', fontWeight: '600' },
  amountBoxValue: { fontSize: 24, fontWeight: '800', color: '#111827' },

  // Processing
  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  processingIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF2EC', alignItems: 'center', justifyContent: 'center' },
  processingTitle: { fontSize: 20, fontWeight: '800', color: '#111827' },
  processingDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 },

  // Résultat
  resultIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
  resultTitle: { fontSize: 22, fontWeight: '800' },
  resultDesc: { fontSize: 14, color: '#6B7280', textAlign: 'center' },
  txIdText: { fontSize: 12, color: '#9CA3AF', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  retryBtn: { backgroundColor: '#FF6835', borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  retryBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cancelLink: { fontSize: 14, color: '#9CA3AF', fontWeight: '600' },
});
