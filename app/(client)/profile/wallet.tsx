import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, Platform, RefreshControl,
  ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/lib/supabase';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Wallet {
  id: string;
  balance: number;
  type: string;
}

interface Transaction {
  id: string;
  label: string;
  sublabel?: string;
  amount: number;
  type: 'credit' | 'debit';
  created_at: string;
}

const TOPUP_AMOUNTS = [2000, 5000, 10000, 25000];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [topupVisible, setTopupVisible] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [topupLoading, setTopupLoading] = useState(false);

  // ── Chargement des données ─────────────────────────────────────────────────
  const load = async (silent = false) => {
    if (!profile?.id) return;
    if (!silent) setLoading(true);

    try {
      // Charger le portefeuille de l'utilisateur
      const { data: walletData, error: walletError } = await supabase
        .from('wallets')
        .select('id, balance, type')
        .eq('user_id', profile.id)
        .single();

      if (walletError && walletError.code !== 'PGRST116') throw walletError;

      // Si pas de portefeuille → en créer un
      if (!walletData) {
        const { data: newWallet, error: createError } = await supabase
          .from('wallets')
          .insert({ user_id: profile.id, balance: 0, type: 'personal' })
          .select('id, balance, type')
          .single();
        if (createError) throw createError;
        setWallet(newWallet);
        setTransactions([]);
        return;
      }

      setWallet(walletData);

      // Charger les transactions de ce portefeuille
      const { data: txData, error: txError } = await supabase
        .from('wallet_transactions')
        .select('id, label, sublabel, amount, type, created_at')
        .eq('wallet_id', walletData.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (txError) throw txError;
      setTransactions((txData as Transaction[]) ?? []);

    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Impossible de charger le portefeuille.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [profile?.id]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  // ── Recharger le portefeuille ──────────────────────────────────────────────
  const topUp = async () => {
    const amount = selectedAmount ?? parseInt(customAmount, 10);
    if (!amount || amount < 500) {
      Alert.alert('Montant invalide', 'Le montant minimum est de 500 FCFA.');
      return;
    }
    if (!wallet) return;

    setTopupLoading(true);
    try {
      // 1 — Créer la transaction
      const { error: txError } = await supabase
        .from('wallet_transactions')
        .insert({
          wallet_id: wallet.id,
          label: 'Rechargement',
          sublabel: 'Via Mobile Money',
          amount,
          type: 'credit',
        });
      if (txError) throw txError;

      // 2 — Mettre à jour le solde
      const { error: updateError } = await supabase
        .from('wallets')
        .update({ balance: (wallet.balance ?? 0) + amount })
        .eq('id', wallet.id);
      if (updateError) throw updateError;

      // 3 — Rafraîchir
      await load(true);
      setTopupVisible(false);
      setSelectedAmount(null);
      setCustomAmount('');
      Alert.alert('✅ Rechargement effectué', `${amount.toLocaleString('fr-FR')} FCFA ajoutés à votre portefeuille.`);
    } catch (err: any) {
      Alert.alert('Erreur', err.message ?? 'Rechargement échoué.');
    } finally {
      setTopupLoading(false);
    }
  };

  // ── Rendu ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#1E3A5F" />
        <Text style={styles.loadingText}>Chargement du portefeuille…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: Platform.OS === 'ios' ? insets.top : insets.top + 8 }]}>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Feather name="arrow-left" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Portefeuille</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6835" />}
      >
        {/* ── Carte solde ── */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceDeco1} />
          <View style={styles.balanceDeco2} />
          <Text style={styles.balanceLabel}>Solde disponible</Text>
          <Text style={styles.balanceAmount}>
            {(wallet?.balance ?? 0).toLocaleString('fr-FR')} FCFA
          </Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity style={styles.balanceBtn} onPress={() => setTopupVisible((v) => !v)}>
              <Feather name="plus" size={16} color="#1E3A5F" />
              <Text style={styles.balanceBtnText}>Recharger</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.balanceBtn, styles.balanceBtnOutline]}>
              <Feather name="send" size={16} color="#fff" />
              <Text style={[styles.balanceBtnText, { color: '#fff' }]}>Retirer</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Panneau rechargement ── */}
        {topupVisible && (
          <View style={styles.topupCard}>
            <Text style={styles.topupTitle}>Choisir un montant</Text>
            <View style={styles.amountsGrid}>
              {TOPUP_AMOUNTS.map((a) => (
                <TouchableOpacity
                  key={a}
                  style={[styles.amountChip, selectedAmount === a && styles.amountChipActive]}
                  onPress={() => { setSelectedAmount(a); setCustomAmount(''); }}
                >
                  <Text style={[styles.amountText, selectedAmount === a && { color: '#FF6835' }]}>
                    {a.toLocaleString('fr-FR')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.topupOr}>ou entrer un montant</Text>
            <TextInput
              style={styles.customInput}
              placeholder="Montant en FCFA"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              value={customAmount}
              onChangeText={(v) => { setCustomAmount(v); setSelectedAmount(null); }}
            />
            <View style={styles.topupBtns}>
              <TouchableOpacity style={styles.topupCancel} onPress={() => setTopupVisible(false)}>
                <Text style={styles.topupCancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.topupConfirm, topupLoading && { opacity: 0.7 }]}
                onPress={topUp}
                disabled={topupLoading}
              >
                {topupLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.topupConfirmText}>Recharger via Mobile Money</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Historique ── */}
        <Text style={styles.sectionLabel}>Historique des transactions</Text>

        {transactions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="credit-card" size={36} color="#E5E7EB" />
            <Text style={styles.emptyText}>Aucune transaction pour l'instant</Text>
            <Text style={styles.emptySub}>Rechargez votre portefeuille pour commencer</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {transactions.map((tx, i) => (
              <View key={tx.id}>
                <View style={styles.txRow}>
                  <View style={[styles.txIcon, tx.type === 'credit' ? styles.txIconCredit : styles.txIconDebit]}>
                    <Feather
                      name={tx.type === 'credit' ? 'arrow-down-left' : 'arrow-up-right'}
                      size={16}
                      color={tx.type === 'credit' ? '#22C55E' : '#EF4444'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txLabel}>{tx.label}</Text>
                    <Text style={styles.txSub}>
                      {tx.sublabel ? `${tx.sublabel} · ` : ''}{formatDate(tx.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, tx.type === 'credit' ? styles.txAmountCredit : styles.txAmountDebit]}>
                    {tx.type === 'credit' ? '+' : '-'}{Math.abs(tx.amount).toLocaleString('fr-FR')} F
                  </Text>
                </View>
                {i < transactions.length - 1 && <View style={styles.sep} />}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8F7F4' },
  centered: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: '#9CA3AF' },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
  content: { padding: 20, gap: 20 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 },

  balanceCard: { backgroundColor: '#1E3A5F', borderRadius: 24, padding: 24, gap: 6, overflow: 'hidden', position: 'relative' },
  balanceDeco1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.05)', top: -80, right: -60 },
  balanceDeco2: { position: 'absolute', width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -60, left: -30 },
  balanceLabel: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  balanceAmount: { fontSize: 34, fontWeight: '800', color: '#fff', marginBottom: 16 },
  balanceActions: { flexDirection: 'row', gap: 12 },
  balanceBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12 },
  balanceBtnOutline: { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  balanceBtnText: { fontSize: 14, fontWeight: '700', color: '#1E3A5F' },

  topupCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, gap: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  topupTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  amountsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amountChip: { flex: 1, minWidth: '44%', alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  amountChipActive: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  amountText: { fontSize: 15, fontWeight: '700', color: '#374151' },
  topupOr: { textAlign: 'center', fontSize: 13, color: '#9CA3AF' },
  customInput: { borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: '#111827' },
  topupBtns: { flexDirection: 'row', gap: 10 },
  topupCancel: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center' },
  topupCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  topupConfirm: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: '#FF6835', alignItems: 'center' },
  topupConfirmText: { fontSize: 14, fontWeight: '700', color: '#fff' },

  card: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  txIconCredit: { backgroundColor: '#F0FDF4' },
  txIconDebit: { backgroundColor: '#FEF2F2' },
  txLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  txSub: { fontSize: 12, color: '#9CA3AF', marginTop: 1 },
  txAmount: { fontSize: 14, fontWeight: '700' },
  txAmountCredit: { color: '#22C55E' },
  txAmountDebit: { color: '#EF4444' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: '#F3F4F6' },

  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 32, alignItems: 'center', gap: 10 },
  emptyText: { fontSize: 15, fontWeight: '600', color: '#374151' },
  emptySub: { fontSize: 13, color: '#9CA3AF', textAlign: 'center' },
});
