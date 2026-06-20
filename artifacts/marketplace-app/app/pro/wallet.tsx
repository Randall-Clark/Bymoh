import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
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
import { useColors } from "@/hooks/useColors";

// ─── Types ─────────────────────────────────────────────────────────────────────

type TxType = "credit" | "debit" | "pending";

type Transaction = {
  id: string;
  type: TxType;
  label: string;
  sublabel: string;
  amount: number;
  date: string; // ISO string
  canWithdraw: boolean; // true if > 24h ago
};

// ─── Mock data ─────────────────────────────────────────────────────────────────

const now = Date.now();
const h = 3600 * 1000;

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: "t1",
    type: "credit",
    label: "Commande #1089",
    sublabel: "Tissu wax × 3 m — Livré",
    amount: 10500,
    date: new Date(now - 72 * h).toISOString(),
    canWithdraw: true,
  },
  {
    id: "t2",
    type: "credit",
    label: "Commande #1088",
    sublabel: "Coupe + brushing — Terminée",
    amount: 8000,
    date: new Date(now - 50 * h).toISOString(),
    canWithdraw: true,
  },
  {
    id: "t3",
    type: "debit",
    label: "Retrait vers Flooz",
    sublabel: "+228 90 12 34 56",
    amount: -12000,
    date: new Date(now - 36 * h).toISOString(),
    canWithdraw: false,
  },
  {
    id: "t4",
    type: "pending",
    label: "Commande #1092",
    sublabel: "Sucre en poudre × 5 kg — En cours",
    amount: 3000,
    date: new Date(now - 10 * h).toISOString(),
    canWithdraw: false,
  },
  {
    id: "t5",
    type: "pending",
    label: "Commande #1093",
    sublabel: "Prestation — En livraison",
    amount: 6500,
    date: new Date(now - 2 * h).toISOString(),
    canWithdraw: false,
  },
];

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

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ProWalletScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const credits = MOCK_TRANSACTIONS.filter((t) => t.type === "credit" && t.canWithdraw);
  const pending = MOCK_TRANSACTIONS.filter((t) => t.type === "pending" || (t.type === "credit" && !t.canWithdraw));
  const debits = MOCK_TRANSACTIONS.filter((t) => t.type === "debit");

  const totalAvailable = credits.reduce((s, t) => s + t.amount, 0) + debits.reduce((s, t) => s + t.amount, 0);
  const totalPending = pending.reduce((s, t) => s + t.amount, 0);
  const totalBalance = totalAvailable + totalPending;

  const canWithdraw = totalAvailable >= 500;

  const handleWithdraw = () => {
    const amt = Number(withdrawAmount);
    if (!amt || amt < 500) {
      Alert.alert("Montant invalide", "Le montant minimum de retrait est 500 FCFA.");
      return;
    }
    if (amt > totalAvailable) {
      Alert.alert("Fonds insuffisants", "Vous ne pouvez retirer que votre solde disponible.");
      return;
    }
    setWithdrawing(true);
    setTimeout(() => {
      setWithdrawing(false);
      setWithdrawModal(false);
      setWithdrawAmount("");
      Alert.alert("Retrait initié", `${formatAmount(amt)} sera virée sur votre Mobile Money dans quelques minutes.`);
    }, 1200);
  };

  const TxRow = ({ tx }: { tx: Transaction }) => {
    const hrs = hoursAgo(tx.date);
    const isCredit = tx.type === "credit";
    const isPending = tx.type === "pending";
    const lockedCredit = isCredit && !tx.canWithdraw;
    const hoursLeft = Math.max(0, Math.ceil(24 - hrs));

    let iconName: string;
    let iconBg: string;
    let iconColor: string;
    if (tx.type === "debit") { iconName = "arrow-up-left"; iconBg = "#FEE2E2"; iconColor = "#DC2626"; }
    else if (isPending) { iconName = "clock"; iconBg = "#FEF3C7"; iconColor = "#D97706"; }
    else if (lockedCredit) { iconName = "lock"; iconBg = "#EDE9FE"; iconColor = "#7C3AED"; }
    else { iconName = "arrow-down-right"; iconBg = "#DCFCE7"; iconColor = "#16A34A"; }

    return (
      <View style={[styles.txRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.txIcon, { backgroundColor: iconBg }]}>
          <Feather name={iconName as any} size={18} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.txLabel, { color: colors.text }]}>{tx.label}</Text>
          <Text style={[styles.txSub, { color: colors.mutedForeground }]}>{tx.sublabel}</Text>
          {lockedCredit && (
            <View style={[styles.lockBadge, { backgroundColor: "#EDE9FE" }]}>
              <Feather name="lock" size={10} color="#7C3AED" />
              <Text style={[styles.lockText, { color: "#7C3AED" }]}>
                Disponible dans {hoursLeft}h
              </Text>
            </View>
          )}
          {isPending && (
            <View style={[styles.lockBadge, { backgroundColor: "#FEF3C7" }]}>
              <Feather name="clock" size={10} color="#D97706" />
              <Text style={[styles.lockText, { color: "#D97706" }]}>En attente de finalisation</Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: "flex-end", gap: 4 }}>
          <Text style={[
            styles.txAmount,
            { color: tx.type === "debit" ? "#DC2626" : (isPending || lockedCredit) ? "#D97706" : "#16A34A" },
          ]}>
            {tx.type === "debit" ? "−" : "+"}{formatAmount(tx.amount)}
          </Text>
          <Text style={[styles.txDate, { color: colors.mutedForeground }]}>{formatDate(tx.date)}</Text>
        </View>
      </View>
    );
  };

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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: botPad + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Balance card ── */}
        <View style={[styles.balanceCard, { backgroundColor: "#1E3A5F" }]}>
          {/* deco circles */}
          <View style={styles.decoCircle1} />
          <View style={styles.decoCircle2} />

          <Text style={styles.balanceLabel}>Solde total</Text>
          <Text style={styles.balanceAmount}>{totalBalance.toLocaleString("fr-FR")} FCFA</Text>

          <View style={styles.balanceSplit}>
            <View style={styles.balanceSplitItem}>
              <View style={[styles.splitDot, { backgroundColor: "#4ADE80" }]} />
              <View>
                <Text style={styles.splitLabel}>Disponible</Text>
                <Text style={styles.splitValue}>{totalAvailable.toLocaleString("fr-FR")} FCFA</Text>
              </View>
            </View>
            <View style={[styles.splitDivider, { backgroundColor: "rgba(255,255,255,0.2)" }]} />
            <View style={styles.balanceSplitItem}>
              <View style={[styles.splitDot, { backgroundColor: "#FCD34D" }]} />
              <View>
                <Text style={styles.splitLabel}>En attente</Text>
                <Text style={styles.splitValue}>{totalPending.toLocaleString("fr-FR")} FCFA</Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Info box: règle 24h ── */}
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

        {/* ── Withdraw button ── */}
        <TouchableOpacity
          style={[styles.withdrawBtn, {
            backgroundColor: canWithdraw ? colors.primary : colors.muted,
          }]}
          onPress={() => canWithdraw ? setWithdrawModal(true) : null}
          activeOpacity={canWithdraw ? 0.85 : 1}
        >
          <Feather name="arrow-up" size={18} color={canWithdraw ? "#fff" : colors.mutedForeground} />
          <Text style={[styles.withdrawBtnText, { color: canWithdraw ? "#fff" : colors.mutedForeground }]}>
            {canWithdraw
              ? `Retirer des fonds (${totalAvailable.toLocaleString("fr-FR")} FCFA dispo)`
              : "Aucun fonds disponible"}
          </Text>
        </TouchableOpacity>

        {/* ── Transaction history ── */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Historique des transactions</Text>
          <View style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {MOCK_TRANSACTIONS.length === 0 ? (
              <View style={styles.empty}>
                <Feather name="inbox" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Aucune transaction</Text>
              </View>
            ) : (
              MOCK_TRANSACTIONS.map((tx) => <TxRow key={tx.id} tx={tx} />)
            )}
          </View>
        </View>
      </ScrollView>

      {/* ── Withdraw Modal ── */}
      <Modal visible={withdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Retrait Mobile Money</Text>
            <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
              Solde disponible : <Text style={{ fontWeight: "700", color: "#16A34A" }}>{totalAvailable.toLocaleString("fr-FR")} FCFA</Text>
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
              <Feather name="smartphone" size={14} color={colors.primary} />
              <Text style={[styles.modalInfoText, { color: colors.mutedForeground }]}>
                Virement vers votre numéro Mobile Money enregistré
              </Text>
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setWithdrawModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: colors.primary, opacity: withdrawing ? 0.7 : 1 }]}
                onPress={handleWithdraw}
                disabled={withdrawing}
              >
                <Text style={styles.modalConfirmText}>{withdrawing ? "Traitement..." : "Confirmer le retrait"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },

  content: { paddingHorizontal: 20, paddingTop: 20, gap: 20 },

  // Balance card
  balanceCard: {
    borderRadius: 24, padding: 24, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 8,
  },
  decoCircle1: {
    position: "absolute", width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.06)", top: -80, right: -60,
  },
  decoCircle2: {
    position: "absolute", width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -40, left: -30,
  },
  balanceLabel: { fontSize: 13, color: "rgba(255,255,255,0.65)", fontWeight: "600", marginBottom: 6 },
  balanceAmount: { fontSize: 34, fontWeight: "900", color: "#fff", letterSpacing: -0.5, marginBottom: 20 },
  balanceSplit: { flexDirection: "row", alignItems: "center", gap: 16 },
  balanceSplitItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  splitDot: { width: 10, height: 10, borderRadius: 5 },
  splitLabel: { fontSize: 11, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  splitValue: { fontSize: 14, color: "#fff", fontWeight: "700", marginTop: 2 },
  splitDivider: { width: 1, height: 36 },

  // Info
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  infoIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  infoTitle: { fontSize: 13, fontWeight: "700", marginBottom: 3 },
  infoText: { fontSize: 12, lineHeight: 17 },

  withdrawBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16, borderRadius: 16,
  },
  withdrawBtnText: { fontSize: 15, fontWeight: "700" },

  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 12 },
  txCard: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  txRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  txLabel: { fontSize: 14, fontWeight: "600" },
  txSub: { fontSize: 12, marginTop: 2 },
  lockBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 100, alignSelf: "flex-start", marginTop: 5 },
  lockText: { fontSize: 11, fontWeight: "600" },
  txAmount: { fontSize: 14, fontWeight: "800" },
  txDate: { fontSize: 11 },

  empty: { alignItems: "center", gap: 10, padding: 40 },
  emptyText: { fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 18 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D1D5DB", alignSelf: "center", marginBottom: 4 },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  modalSub: { fontSize: 14, marginTop: -10 },
  modalField: { gap: 8 },
  modalLabel: { fontSize: 14, fontWeight: "600" },
  modalInput: { paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1, fontSize: 16 },
  modalInfo: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10 },
  modalInfoText: { fontSize: 13, flex: 1 },
  modalBtns: { flexDirection: "row", gap: 10 },
  modalCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 100, borderWidth: 1, alignItems: "center" },
  modalCancelText: { fontSize: 15, fontWeight: "600" },
  modalConfirmBtn: { flex: 2, paddingVertical: 14, borderRadius: 100, alignItems: "center" },
  modalConfirmText: { fontSize: 15, fontWeight: "700", color: "#fff" },
});
