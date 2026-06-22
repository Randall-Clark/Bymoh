import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetBusinessWalletQueryKey,
  getGetPersonalWalletQueryKey,
  useGetBusinessWallet,
  useGetPersonalWallet,
  useInitiateTopup,
  useWithdrawBusinessWallet,
  type WalletTransaction,
} from "@workspace/api-client-react";
import { useActiveBusiness } from "@/context/ActiveBusinessContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import PaymentModal from "@/components/PaymentModal";

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(n: number): string {
  return `${Math.abs(n).toLocaleString("fr-FR")} FCFA`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / (3600 * 1000);
}

// ─── Transaction row ────────────────────────────────────────────────────────────

function TxRow({ tx, colors }: { tx: WalletTransaction; colors: ReturnType<typeof useColors> }) {
  const hrs = hoursAgo(tx.createdAt);
  const isCredit = tx.type === "credit";
  const isPending = tx.type === "pending";
  const isDebit = tx.type === "debit";
  const hoursLeft = Math.max(0, Math.ceil(24 - hrs));

  let iconName: string;
  let iconBg: string;
  let iconColor: string;
  if (isDebit) { iconName = "arrow-up-left"; iconBg = "#FEE2E2"; iconColor = "#DC2626"; }
  else if (isPending) { iconName = "clock"; iconBg = "#FEF3C7"; iconColor = "#D97706"; }
  else { iconName = "arrow-down-right"; iconBg = "#DCFCE7"; iconColor = "#16A34A"; }

  return (
    <View style={[styles.txRow, { borderBottomColor: colors.border }]}>
      <View style={[styles.txIcon, { backgroundColor: iconBg }]}>
        <Feather name={iconName as any} size={18} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.txLabel, { color: colors.text }]}>{tx.label}</Text>
        {tx.sublabel ? (
          <Text style={[styles.txSub, { color: colors.mutedForeground }]}>{tx.sublabel}</Text>
        ) : null}
        {isPending && (
          <View style={[styles.lockBadge, { backgroundColor: "#FEF3C7" }]}>
            <Feather name="clock" size={10} color="#D97706" />
            <Text style={[styles.lockText, { color: "#D97706" }]}>En cours de traitement</Text>
          </View>
        )}
        {isCredit && hoursLeft > 0 && hrs < 24 && (
          <View style={[styles.lockBadge, { backgroundColor: "#EDE9FE" }]}>
            <Feather name="lock" size={10} color="#7C3AED" />
            <Text style={[styles.lockText, { color: "#7C3AED" }]}>Disponible dans {hoursLeft}h</Text>
          </View>
        )}
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={[
          styles.txAmount,
          { color: isDebit ? "#DC2626" : isPending ? "#D97706" : "#16A34A" },
        ]}>
          {isDebit ? "−" : "+"}{formatAmount(tx.amount)}
        </Text>
        <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{formatDate(tx.createdAt)}</Text>
      </View>
    </View>
  );
}

// ─── Personal wallet tab ────────────────────────────────────────────────────────

function PersonalWallet({ colors, botPad }: { colors: ReturnType<typeof useColors>; botPad: number }) {
  const queryClient = useQueryClient();
  const [paymentModal, setPaymentModal] = useState(false);

  const { data, isLoading } = useGetPersonalWallet({
    query: { queryKey: getGetPersonalWalletQueryKey() },
  });

  const { mutateAsync: initiateTopup } = useInitiateTopup();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const balance = data?.balance ?? 0;
  const pendingBalance = data?.pendingBalance ?? 0;
  const transactions = data?.transactions ?? [];
  const totalSpent = transactions
    .filter((t) => t.type === "debit")
    .reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <View style={[styles.balanceCard, { backgroundColor: colors.primary }]}>
          <View style={styles.decoCircle1} />
          <View style={styles.decoCircle2} />
          <View style={[styles.walletBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Feather name="user" size={13} color="rgba(255,255,255,0.9)" />
            <Text style={styles.walletBadgeText}>Personnel</Text>
          </View>
          <Text style={styles.balanceLabel}>Solde disponible</Text>
          <Text style={styles.balanceAmount}>{balance.toLocaleString("fr-FR")} FCFA</Text>
          <View style={styles.balanceSplit}>
            <View style={styles.balanceSplitItem}>
              <View style={[styles.splitDot, { backgroundColor: "#FCD34D" }]} />
              <View>
                <Text style={styles.splitLabel}>En cours</Text>
                <Text style={styles.splitValue}>{pendingBalance.toLocaleString("fr-FR")} FCFA</Text>
              </View>
            </View>
            <View style={[styles.splitDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.balanceSplitItem}>
              <View style={[styles.splitDot, { backgroundColor: "#FCA5A5" }]} />
              <View>
                <Text style={styles.splitLabel}>Dépensé (total)</Text>
                <Text style={styles.splitValue}>{totalSpent.toLocaleString("fr-FR")} FCFA</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Topup button */}
        <TouchableOpacity
          style={[styles.withdrawBtn, { backgroundColor: colors.primary }]}
          onPress={() => setPaymentModal(true)}
        >
          <Feather name="plus-circle" size={18} color="#fff" />
          <Text style={[styles.withdrawBtnText, { color: "#fff" }]}>Recharger le portefeuille</Text>
        </TouchableOpacity>

        {/* Info box */}
        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.infoIcon, { backgroundColor: colors.accent }]}>
            <Feather name="shield" size={16} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Paiement sécurisé</Text>
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Votre portefeuille personnel sert à payer vos commandes sur Kola. Rechargez-le via Mobile Money (Flooz, T-Money).
            </Text>
          </View>
        </View>

        {/* History */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Historique</Text>
          <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {transactions.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="inbox" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Aucune transaction</Text>
              </View>
            ) : (
              [...transactions].reverse().map((tx) => <TxRow key={tx.id} tx={tx} colors={colors} />)
            )}
          </View>
        </View>
      </ScrollView>

      <PaymentModal
        visible={paymentModal}
        onClose={() => setPaymentModal(false)}
        onInitiate={async (params) => {
          const result = await initiateTopup({ data: params });
          return result;
        }}
        onSuccess={() => {
          setPaymentModal(false);
          queryClient.invalidateQueries({ queryKey: getGetPersonalWalletQueryKey() });
        }}
      />
    </>
  );
}

// ─── Business wallet tab ────────────────────────────────────────────────────────

function BusinessWallet({ colors, botPad, hasBusiness }: {
  colors: ReturnType<typeof useColors>;
  botPad: number;
  hasBusiness: boolean;
}) {
  const queryClient = useQueryClient();
  const { selectedBusinessId } = useActiveBusiness();
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const { data, isLoading } = useGetBusinessWallet(selectedBusinessId, {
    query: {
      queryKey: getGetBusinessWalletQueryKey(selectedBusinessId),
      enabled: !!selectedBusinessId && hasBusiness,
    },
  });

  const { mutate: withdraw, isPending: withdrawing } = useWithdrawBusinessWallet({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBusinessWalletQueryKey(selectedBusinessId) });
        setWithdrawModal(false);
        setWithdrawAmount("");
        Alert.alert("Retrait initié", `${formatAmount(Number(withdrawAmount))} sera virée sur votre Mobile Money dans quelques minutes.`);
      },
      onError: () => {
        Alert.alert("Erreur", "Solde insuffisant ou montant invalide. Minimum : 500 FCFA.");
      },
    },
  });

  const handleWithdraw = () => {
    const amt = Number(withdrawAmount);
    if (!amt || amt < 500) {
      Alert.alert("Montant invalide", "Le montant minimum de retrait est 500 FCFA.");
      return;
    }
    if (amt > (data?.balance ?? 0)) {
      Alert.alert("Fonds insuffisants", "Vous ne pouvez retirer que votre solde disponible.");
      return;
    }
    withdraw({ businessId: selectedBusinessId, data: { amount: amt } });
  };

  // No business registered
  if (!hasBusiness) {
    return (
      <View style={[styles.noBizWrap, { paddingBottom: botPad + 32 }]}>
        <View style={[styles.noBizIcon, { backgroundColor: "#1E3A5F15" }]}>
          <Feather name="briefcase" size={48} color="#1E3A5F" />
        </View>
        <Text style={[styles.noBizTitle, { color: "#1E3A5F" }]}>Aucune entreprise</Text>
        <Text style={[styles.noBizSub, { color: "#6B7280" }]}>
          Inscrivez votre commerce sur Kola Pro pour accéder à votre portefeuille business, encaisser des paiements et suivre vos revenus.
        </Text>
        <TouchableOpacity
          style={[styles.noBizBtn, { backgroundColor: "#1E3A5F" }]}
          onPress={() => router.push("/pro/register")}
          activeOpacity={0.85}
        >
          <Feather name="plus-circle" size={18} color="#fff" />
          <Text style={styles.noBizBtnText}>Inscrire mon commerce</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Business registered but none selected in session
  if (!selectedBusinessId) {
    return (
      <View style={[styles.noBizWrap, { paddingBottom: botPad + 32 }]}>
        <View style={[styles.noBizIcon, { backgroundColor: "#1E3A5F15" }]}>
          <Feather name="briefcase" size={48} color="#1E3A5F" />
        </View>
        <Text style={[styles.noBizTitle, { color: "#1E3A5F" }]}>Aucune entreprise sélectionnée</Text>
        <Text style={[styles.noBizSub, { color: "#6B7280" }]}>
          Sélectionnez une entreprise depuis l'espace pro pour voir son portefeuille.
        </Text>
        <TouchableOpacity
          style={[styles.noBizBtn, { backgroundColor: "#1E3A5F" }]}
          onPress={() => router.push("/pro/businesses")}
          activeOpacity={0.85}
        >
          <Feather name="briefcase" size={18} color="#fff" />
          <Text style={styles.noBizBtnText}>Choisir une entreprise</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#1E3A5F" size="large" />
      </View>
    );
  }

  const balance = data?.balance ?? 0;
  const pendingBalance = data?.pendingBalance ?? 0;
  const transactions = data?.transactions ?? [];
  const canWithdraw = balance >= 500;

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Balance card */}
        <View style={[styles.balanceCard, { backgroundColor: "#1E3A5F" }]}>
          <View style={styles.decoCircle1} />
          <View style={styles.decoCircle2} />
          <View style={[styles.walletBadge, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
            <Feather name="briefcase" size={13} color="rgba(255,255,255,0.9)" />
            <Text style={styles.walletBadgeText}>Business</Text>
          </View>
          <Text style={styles.balanceLabel}>Solde total business</Text>
          <Text style={styles.balanceAmount}>{(balance + pendingBalance).toLocaleString("fr-FR")} FCFA</Text>
          <View style={styles.balanceSplit}>
            <View style={styles.balanceSplitItem}>
              <View style={[styles.splitDot, { backgroundColor: "#4ADE80" }]} />
              <View>
                <Text style={styles.splitLabel}>Disponible</Text>
                <Text style={styles.splitValue}>{balance.toLocaleString("fr-FR")} FCFA</Text>
              </View>
            </View>
            <View style={[styles.splitDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.balanceSplitItem}>
              <View style={[styles.splitDot, { backgroundColor: "#FCD34D" }]} />
              <View>
                <Text style={styles.splitLabel}>En attente</Text>
                <Text style={styles.splitValue}>{pendingBalance.toLocaleString("fr-FR")} FCFA</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info box */}
        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.infoIcon, { backgroundColor: "#EDE9FE" }]}>
            <Feather name="lock" size={16} color="#7C3AED" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.infoTitle, { color: colors.text }]}>Règle de retrait</Text>
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
              Les fonds des commandes sont disponibles au retrait <Text style={{ fontWeight: "700" }}>après 24 heures</Text>. Les commandes en cours sont bloquées jusqu'à leur finalisation.
            </Text>
          </View>
        </View>

        {/* Withdraw button */}
        <TouchableOpacity
          style={[styles.withdrawBtn, { backgroundColor: canWithdraw ? "#1E3A5F" : colors.muted }]}
          onPress={() => canWithdraw ? setWithdrawModal(true) : null}
          activeOpacity={canWithdraw ? 0.85 : 1}
        >
          <Feather name="arrow-up" size={18} color={canWithdraw ? "#fff" : colors.mutedForeground} />
          <Text style={[styles.withdrawBtnText, { color: canWithdraw ? "#fff" : colors.mutedForeground }]}>
            {canWithdraw
              ? `Retirer des fonds (${balance.toLocaleString("fr-FR")} FCFA dispo)`
              : "Aucun fonds disponible"}
          </Text>
        </TouchableOpacity>

        {/* History */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Historique des transactions</Text>
          <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {transactions.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="inbox" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Aucune transaction</Text>
              </View>
            ) : (
              [...transactions].reverse().map((tx) => <TxRow key={tx.id} tx={tx} colors={colors} />)
            )}
          </View>
        </View>
      </ScrollView>

      {/* Withdraw Modal */}
      <Modal visible={withdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Retrait Mobile Money</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Solde disponible : <Text style={{ fontWeight: "700", color: "#16A34A" }}>{balance.toLocaleString("fr-FR")} FCFA</Text>
            </Text>
            <View style={styles.modalField}>
              <Text style={[styles.modalLabel, { color: colors.text }]}>Montant à retirer (FCFA)</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={withdrawAmount}
                onChangeText={setWithdrawAmount}
                placeholder="Ex : 5000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
            </View>
            <View style={[styles.modalInfo, { backgroundColor: colors.background }]}>
              <Feather name="smartphone" size={14} color="#1E3A5F" />
              <Text style={[styles.modalInfoText, { color: colors.mutedForeground }]}>
                Virement vers votre numéro Mobile Money enregistré
              </Text>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => { setWithdrawModal(false); setWithdrawAmount(""); }}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: "#1E3A5F", opacity: withdrawing ? 0.7 : 1 }]}
                onPress={handleWithdraw}
                disabled={withdrawing}
              >
                <Text style={styles.modalConfirmText}>{withdrawing ? "Traitement..." : "Confirmer le retrait"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ProWalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const hasBusiness = (user?.businessIds?.length ?? 0) > 0;

  const [activeTab, setActiveTab] = useState<"personal" | "business">("personal");

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Portefeuille</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
        {(["personal", "business"] as const).map((tab) => {
          const active = activeTab === tab;
          const label = tab === "personal" ? "Personnel" : "Business";
          const icon = tab === "personal" ? "user" : "briefcase";
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, active && { borderBottomColor: colors.primary, borderBottomWidth: 2.5 }]}
              onPress={() => setActiveTab(tab)}
            >
              <Feather name={icon as any} size={15} color={active ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.tabText, { color: active ? colors.primary : colors.mutedForeground, fontWeight: active ? "700" : "500" }]}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab === "business"
        ? <BusinessWallet colors={colors} botPad={botPad} hasBusiness={hasBusiness} />
        : <PersonalWallet colors={colors} botPad={botPad} />
      }
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },

  tabBar: {
    flexDirection: "row", borderBottomWidth: 1,
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 13,
  },
  tabText: { fontSize: 14 },

  centered: { flex: 1, alignItems: "center", justifyContent: "center" },

  content: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },

  balanceCard: {
    borderRadius: 24, padding: 24, gap: 6, overflow: "hidden", position: "relative",
  },
  decoCircle1: {
    position: "absolute", width: 180, height: 180, borderRadius: 90,
    backgroundColor: "rgba(255,255,255,0.07)", top: -60, right: -40,
  },
  decoCircle2: {
    position: "absolute", width: 120, height: 120, borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -40, left: -20,
  },
  walletBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, marginBottom: 8,
  },
  walletBadgeText: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700" },
  balanceLabel: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  balanceAmount: { color: "#fff", fontSize: 32, fontWeight: "900", letterSpacing: -0.5 },
  balanceSplit: { flexDirection: "row", alignItems: "center", marginTop: 12, gap: 16 },
  balanceSplitItem: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  splitDot: { width: 8, height: 8, borderRadius: 4 },
  splitLabel: { color: "rgba(255,255,255,0.7)", fontSize: 11, marginBottom: 1 },
  splitValue: { color: "#fff", fontSize: 13, fontWeight: "700" },
  splitDivider: { width: 1, height: 36 },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 14,
    padding: 16, borderRadius: 16, borderWidth: 1,
  },
  infoIcon: {
    width: 36, height: 36, borderRadius: 12,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  infoTitle: { fontSize: 14, fontWeight: "700", marginBottom: 4 },
  infoText: { fontSize: 13, lineHeight: 19 },

  withdrawBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16, borderRadius: 16,
  },
  withdrawBtnText: { fontSize: 15, fontWeight: "700" },

  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 10 },
  txCard: { borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  txRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderBottomWidth: 1 },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  txLabel: { fontSize: 14, fontWeight: "600", marginBottom: 2 },
  txSub: { fontSize: 12, marginBottom: 4 },
  lockBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: "flex-start",
  },
  lockText: { fontSize: 11, fontWeight: "600" },
  txAmount: { fontSize: 14, fontWeight: "800" },
  txDate: { fontSize: 11 },

  empty: { alignItems: "center", gap: 10, padding: 40 },
  emptyText: { fontSize: 14 },

  // No business empty state
  noBizWrap: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36,
  },
  noBizIcon: {
    width: 96, height: 96, borderRadius: 48,
    alignItems: "center", justifyContent: "center", marginBottom: 24,
  },
  noBizTitle: { fontSize: 22, fontWeight: "800", textAlign: "center", marginBottom: 12 },
  noBizSub: {
    fontSize: 15, lineHeight: 22, textAlign: "center", marginBottom: 36,
  },
  noBizBtn: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 28, paddingVertical: 16, borderRadius: 16,
  },
  noBizBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 18 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center" },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  modalSub: { fontSize: 14, marginTop: -8 },
  modalField: { gap: 8 },
  modalLabel: { fontSize: 14, fontWeight: "600" },
  modalInput: {
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 16, fontWeight: "600",
  },
  modalInfo: {
    flexDirection: "row", alignItems: "center", gap: 10,
    padding: 14, borderRadius: 12,
  },
  modalInfoText: { fontSize: 13, flex: 1 },
  modalBtns: { flexDirection: "row", gap: 12 },
  modalCancelBtn: {
    flex: 1, borderWidth: 1.5, borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
  },
  modalCancelText: { fontSize: 15, fontWeight: "600" },
  modalConfirmBtn: {
    flex: 2, borderRadius: 14, paddingVertical: 14, alignItems: "center",
  },
  modalConfirmText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
