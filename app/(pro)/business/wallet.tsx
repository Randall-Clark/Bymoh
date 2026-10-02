// app/(pro)/business/wallet.tsx
import { Feather, MaterialCommunityIcons, FontAwesome6 } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useMyBusinesses } from "@/hooks/useBusinesses";
import { useRealtimeWallet } from "@/hooks/useRealtimeOrders";

const { width: W } = Dimensions.get("window");
const ORANGE  = "#FF6835";
const SALMON  = "#F5A58C";
const GREEN   = "#22C55E";
const DARK_BG = "#1A1025";
const INDIGO  = "#6366F1";

const PLATFORM_FEE_PCT       = 5;
const TAX_PCT                = 2;
const WITHDRAW_THRESHOLD_MOBILE = 2000;
const WITHDRAW_THRESHOLD_BANK   = 10000;
const EMERGENCY_FRACTION     = 0.75;
const EMERGENCY_FEE_PCT      = 8;

const PROVIDERS = [
  { id: "mtn",    label: "MTN Mobile Money", abbr: "MTN",  color: "#FFC107" },
  { id: "moov",   label: "Moov Money",        abbr: "MOOV", color: "#0056A2" },
  { id: "wave",   label: "Wave",              abbr: "WAV",  color: "#00B9AE" },
  { id: "orange", label: "Orange Money",      abbr: "OM",   color: "#FF6600" },
];
const BANK_PROVIDER = { id: "bank", label: "Compte bancaire", abbr: "BNK", color: INDIGO };

type Tab    = "compte" | "historique" | "versements";
type Period = "jour" | "3j" | "5j" | "sem" | "mois" | "3m" | "6m" | "1an";

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
}

const PERIODS: [Period, string][] = [
  ["jour","Jour"], ["3j","3 jours"], ["5j","5 jours"], ["sem","Semaine"],
  ["mois","Mois"], ["3m","3 mois"], ["6m","6 mois"], ["1an","1 an"],
];

// ── Validation ────────────────────────────────────────────────────────────────

function validatePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-\(\)\.]/g, "");
  // International : +XXX suivi de 7-12 chiffres (couvre Bénin +229, Sénégal +221, etc.)
  if (!/^\+?[0-9]{8,15}$/.test(cleaned)) {
    return "Numéro invalide. Exemple : 229 01 23 45 67";
  }
  return null;
}

function validateIban(raw: string): string | null {
  const cleaned = raw.replace(/\s/g, "").toUpperCase();
  // Format de base
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(cleaned)) {
    return "Format IBAN invalide. Exemple : BJ66 BJ011 0100400271101160";
  }
  // Algorithme mod-97
  const rearranged = cleaned.slice(4) + cleaned.slice(0, 4);
  const numeric = rearranged
    .split("")
    .map((c) => {
      const code = c.charCodeAt(0);
      return code >= 65 && code <= 90 ? (code - 55).toString() : c;
    })
    .join("");
  let remainder = 0;
  for (const ch of numeric) {
    remainder = (remainder * 10 + parseInt(ch, 10)) % 97;
  }
  if (remainder !== 1) return "IBAN invalide (clé de contrôle incorrecte).";
  return null;
}

// ── Avatars ──────────────────────────────────────────────────────────────────

function ProviderAvatar({ prov, size = 44 }: { prov: typeof PROVIDERS[0]; size?: number }) {
  const fontSize =
    prov.abbr.length <= 2 ? size * 0.34 : prov.abbr.length === 3 ? size * 0.28 : size * 0.22;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2,
      backgroundColor: prov.color, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize, fontWeight: "900", color: "#fff", letterSpacing: -0.5 }}>
        {prov.abbr}
      </Text>
    </View>
  );
}

function AccountAvatar({ acc, size = 44 }: { acc: any; size?: number }) {
  if (acc.type === "bank") {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2,
        backgroundColor: INDIGO + "22", alignItems: "center", justifyContent: "center" }}>
        <FontAwesome6 name="building-columns" size={size * 0.38} color={INDIGO} />
      </View>
    );
  }
  const prov = PROVIDERS.find((p) => p.id === acc.provider) ?? PROVIDERS[0];
  return <ProviderAvatar prov={prov} size={size} />;
}

function accountLabel(acc: any): string {
  if (acc.type === "bank") return acc.bank_name ?? "Compte bancaire";
  return PROVIDERS.find((p) => p.id === acc.provider)?.label ?? acc.provider ?? "Mobile Money";
}

function accountSub(acc: any): string {
  if (acc.type === "bank") {
    const iban = acc.iban ?? "";
    return iban.length > 8 ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : iban;
  }
  return acc.phone ?? "";
}

// ── Component ─────────────────────────────────────────────────────────────────

interface WalletProps {
  overrideBizId?: string;
  onChangeBiz?: (id: string) => void;
  businesses?: any[];
}

export default function BusinessWalletScreen({
  overrideBizId,
  onChangeBiz,
  businesses: bizList,
}: WalletProps = {}) {
  const insets = useSafeAreaInsets();
  const qc     = useQueryClient();
  const params = useLocalSearchParams<{ businessId?: string }>();
  const paramBizId = overrideBizId ?? params.businessId;

  const { profile } = useAuthStore();
  const { data: fetchedBusinesses = [] } = useMyBusinesses(
    bizList ? "" : (profile?.id ?? ""),
  );
  const businesses = (bizList ?? fetchedBusinesses) as any[];

  const [tab, setTab]             = useState<Tab>("compte");
  const [period, setPeriod]       = useState<Period>("mois");
  const [balHidden, setBalHidden] = useState(false);
  const [activeBizId, setActiveBizId] = useState<string>(paramBizId ?? "");
  const [bizPickOpen, setBizPickOpen] = useState(false);

  // ── Modals ───────────────────────────────────────────────────────────
  const [settingsOpen, setSettingsOpen]                 = useState(false);
  const [configOpen, setConfigOpen]                     = useState(false);
  const [withdrawSettingsOpen, setWithdrawSettingsOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen]                 = useState(false);

  // ── Wallet config state ──────────────────────────────────────────────
  type CfgStep = "main" | "pick-account" | "add-type" | "add-mobile" | "add-bank";
  const [cfgStep, setCfgStep]               = useState<CfgStep>("main");
  const [wMode, setWMode]                   = useState<"normal" | "emergency">("normal");
  const [selAccountId, setSelAccountId]     = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [newMobileProv, setNewMobileProv]   = useState("mtn");
  const [newMobilePhone, setNewMobilePhone] = useState("");
  const [newBankName, setNewBankName]       = useState("");
  const [newIban, setNewIban]               = useState("");
  const [phoneError, setPhoneError]         = useState<string | null>(null);
  const [ibanError, setIbanError]           = useState<string | null>(null);
  const [accPickOpen, setAccPickOpen]       = useState(false);
  const [longPressedAccId, setLongPressedAccId] = useState<string | null>(null);
  const [savingW, setSavingW]               = useState(false);

  // ── Withdrawal settings state ────────────────────────────────────────
  const [autoMode, setAutoMode] = useState(false);
  const [savingWS, setSavingWS] = useState(false);
  type WsStep = "main" | "pick-account" | "pick-mode";
  const [wsStep, setWsStep]     = useState<WsStep>("main");

  // ── Info modals ──────────────────────────────────────────────────────
  const [infoNetOpen, setInfoNetOpen] = useState(false);
  const [infoObjOpen, setInfoObjOpen] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);

  const bizId = activeBizId || businesses[0]?.id || "";

  // ── Queries ──────────────────────────────────────────────────────────

  const { data: biz } = useQuery({
    queryKey: ["pro-biz", bizId],
    queryFn: async () => {
      const { data } = await supabase.from("businesses").select("*").eq("id", bizId).single();
      return data;
    },
    enabled: !!bizId,
    staleTime: 30_000,
  });

  // Nouveaux comptes multi-opérateurs depuis wallet_accounts
  const { data: walletAccounts = [] } = useQuery<any[]>({
    queryKey: ["wallet-accounts", bizId],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_accounts")
        .select("*")
        .eq("business_id", bizId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
    enabled: !!bizId,
    staleTime: 30_000,
  });

  const { data: rev, isLoading } = useQuery({
    queryKey: ["wallet-revenue", bizId, period],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("total_amount,status,created_at")
        .eq("business_id", bizId)
        .in("status", ["delivered", "confirmed"]);
      const brut = (orders ?? []).reduce((s: number, o: any) => s + (o.total_amount ?? 0), 0);
      const fees = Math.round((brut * PLATFORM_FEE_PCT) / 100);
      const tax  = Math.round((brut * TAX_PCT) / 100);

      const { data: walletFull } = await supabase
        .from("wallets").select("id, balance").eq("business_id", bizId).maybeSingle();
      let txs: any[] = [];
      if (walletFull?.id) {
        const { data: txData } = await supabase
          .from("wallet_transactions").select("*")
          .eq("wallet_id", walletFull.id)
          .order("created_at", { ascending: false }).limit(20);
        txs = txData ?? [];
      }
      return { brut, fees, tax, net: brut - fees - tax, balance: walletFull?.balance ?? 0, txs };
    },
    enabled: !!bizId,
    staleTime: 30_000,
  });

  // Sélectionner le premier compte par défaut dès chargement
  const hasBizW   = walletAccounts.length > 0;
  const selAccount = walletAccounts.find((a: any) => a.id === selAccountId)
    ?? (walletAccounts[0] ?? null);

  // Déclarer AVANT les useEffect qui les utilisent
  const isBankProvider = selAccount?.type === "bank";
  const threshold      = isBankProvider ? WITHDRAW_THRESHOLD_BANK : WITHDRAW_THRESHOLD_MOBILE;

  useRealtimeWallet(bizId);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const topPad = (Platform.OS === "ios" ? insets.top : insets.top) + 12;

  useEffect(() => {
    if (!selAccountId && walletAccounts.length > 0) {
      setSelAccountId(walletAccounts[0].id);
    }
    if (!activeBizId && businesses[0]?.id) setActiveBizId(businesses[0].id);
  }, [walletAccounts, businesses]);

  useEffect(() => {
    if (biz?.withdraw_auto != null) setAutoMode(biz.withdraw_auto);
  }, [biz]);

  useEffect(() => {
    const pct = Math.min(1, (rev?.balance ?? 0) / threshold);
    Animated.timing(progressAnim, {
      toValue: pct, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false,
    }).start();
  }, [rev?.balance, threshold]);

  const balance  = rev?.balance ?? 0;
  const net      = rev?.net ?? 0;
  const pct      = Math.min(100, Math.round((balance / threshold) * 100));
  const canW     = balance >= threshold;
  const emergAmt = Math.floor(threshold * EMERGENCY_FRACTION);
  const emergFee = Math.round((emergAmt * EMERGENCY_FEE_PCT) / 100);
  const emergNet = emergAmt - emergFee;
  const canEmerg = balance >= emergAmt;
  const progW    = progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  // ── Handlers ──────────────────────────────────────────────────────────

  const openConfig = () => { setCfgStep("main"); setEditingAccountId(null); setConfigOpen(true); };
  const openWithdrawSettings = () => { setWsStep("main"); setWithdrawSettingsOpen(true); };

  const editAccount = (acc: any) => {
    setEditingAccountId(acc.id);
    if (acc.type === "bank") {
      setNewBankName(acc.bank_name ?? "");
      setNewIban(acc.iban ?? "");
      setCfgStep("add-bank");
    } else {
      setNewMobileProv(acc.provider ?? "mtn");
      setNewMobilePhone(acc.phone ?? "");
      setCfgStep("add-mobile");
    }
  };

  const deleteAccount = (accId: string, label: string) => {
    Alert.alert(
      "Supprimer ce compte",
      `"${label}" sera définitivement supprimé de votre boutique.`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer", style: "destructive",
          onPress: async () => {
            try {
              await supabase.from("wallet_accounts").delete().eq("id", accId);
              await qc.invalidateQueries({ queryKey: ["wallet-accounts", bizId] });
              if (selAccountId === accId) setSelAccountId(null);
            } catch (e: any) { Alert.alert("Erreur", e.message); }
          },
        },
      ],
    );
  };

  const saveNewMobile = async () => {
    const err = validatePhone(newMobilePhone);
    if (err) { setPhoneError(err); return; }
    setPhoneError(null);
    setSavingW(true);
    try {
      if (editingAccountId) {
        await supabase.from("wallet_accounts")
          .update({ provider: newMobileProv, phone: newMobilePhone.trim() })
          .eq("id", editingAccountId);
      } else {
        await supabase.from("wallet_accounts").insert({
          business_id: bizId, type: "mobile",
          provider: newMobileProv, phone: newMobilePhone.trim(),
        });
      }
      await qc.invalidateQueries({ queryKey: ["wallet-accounts", bizId] });
      setNewMobilePhone(""); setEditingAccountId(null);
      setCfgStep("main");
    } catch (e: any) { Alert.alert("Erreur", e.message); }
    finally { setSavingW(false); }
  };

  const saveNewBank = async () => {
    if (!newBankName.trim()) { Alert.alert("Erreur", "Nom de la banque requis."); return; }
    const err = validateIban(newIban);
    if (err) { setIbanError(err); return; }
    setIbanError(null);
    const normalizedIban = newIban.replace(/\s/g, "").toUpperCase();
    setSavingW(true);
    try {
      if (editingAccountId) {
        await supabase.from("wallet_accounts")
          .update({ bank_name: newBankName.trim(), iban: normalizedIban })
          .eq("id", editingAccountId);
      } else {
        await supabase.from("wallet_accounts").insert({
          business_id: bizId, type: "bank",
          bank_name: newBankName.trim(), iban: normalizedIban,
        });
      }
      await qc.invalidateQueries({ queryKey: ["wallet-accounts", bizId] });
      setNewIban(""); setNewBankName(""); setEditingAccountId(null);
      setCfgStep("main");
    } catch (e: any) { Alert.alert("Erreur", e.message); }
    finally { setSavingW(false); }
  };

  const saveWithdrawSettings = async () => {
    setSavingWS(true);
    try {
      await supabase.from("businesses")
        .update({ withdraw_auto: autoMode }).eq("id", bizId);
      await qc.invalidateQueries({ queryKey: ["pro-biz", bizId] });
      setWithdrawSettingsOpen(false);
      Alert.alert("✅", "Préférences de versement enregistrées.");
    } catch (e: any) { Alert.alert("Erreur", e.message); }
    finally { setSavingWS(false); }
  };

  const doWithdraw = async () => {
    if (!selAccount) { Alert.alert("Erreur", "Configurez un compte d'abord."); return; }
    const amount = wMode === "normal" ? balance : emergNet;
    const fee    = wMode === "emergency" ? emergFee : 0;
    const dest   = selAccount.type === "bank"
      ? `${selAccount.bank_name} — IBAN ${accountSub(selAccount)}`
      : `${accountLabel(selAccount)} · ${selAccount.phone}`;

    Alert.alert(
      wMode === "normal" ? "Confirmer le retrait" : "⚡ Retrait d'urgence",
      `Montant : ${fmt(amount)}\n${fee > 0 ? `Frais : ${fmt(fee)}\n` : ""}Vers : ${dest}`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: async () => {
            setWithdrawing(true);
            try {
              const { data: wRow } = await supabase
                .from("wallets").select("id").eq("business_id", bizId).maybeSingle();
              if (!wRow?.id) throw new Error("Portefeuille introuvable.");
              await supabase.from("wallet_transactions").insert({
                wallet_id: wRow.id,
                type: "withdrawal" as any,
                label: wMode === "emergency" ? "Retrait d'urgence" : "Retrait",
                sublabel: dest,
                amount: wMode === "normal" ? balance : emergAmt,
                payment_ref: null,
              });
              await supabase.from("wallets").update({ balance: 0 }).eq("business_id", bizId);
              await qc.invalidateQueries({ queryKey: ["wallet-revenue", bizId] });
              setWithdrawOpen(false);
              Alert.alert("✅", "Demande envoyée. Traitement sous 24h.");
            } catch (e: any) { Alert.alert("Erreur", e.message); }
            finally { setWithdrawing(false); }
          },
        },
      ],
    );
  };

  // ── Render helpers ────────────────────────────────────────────────────

  const renderTxList = (list: any[]) =>
    list.length === 0 ? (
      <View style={s.emptyCard}>
        <View style={s.emptyIcon}><Feather name="file-text" size={24} color="#D1D5DB" /></View>
        <Text style={s.emptyTitle}>Aucune transaction</Text>
        <Text style={s.emptySub}>Vos paiements et retraits apparaîtront ici.</Text>
      </View>
    ) : (
      <View style={s.card}>
        {list.map((tx: any, i: number) => (
          <View key={i} style={[s.txRow,
            i > 0 && { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 12, marginTop: 4 }]}>
            <View style={[s.txIcon, { backgroundColor: tx.type === "withdrawal" ? "#F0FDF4" : "#EFF6FF" }]}>
              <Feather name={tx.type === "withdrawal" ? "arrow-up-right" : "arrow-down-left"}
                size={16} color={tx.type === "withdrawal" ? GREEN : "#3B82F6"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.txLabel}>{tx.label ?? tx.type}</Text>
              <Text style={s.txDate}>{tx.sublabel ? `${tx.sublabel} · ` : ""}
                {new Date(tx.created_at).toLocaleDateString("fr-FR")}</Text>
            </View>
            <Text style={{ fontSize: 14, fontWeight: "700", color: GREEN }}>{fmt(tx.amount ?? 0)}</Text>
          </View>
        ))}
      </View>
    );

  const renderCompte = () => (
    <View style={{ gap: 14 }}>
      <View style={s.card}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.revLabel}>Revenu net</Text>
            <TouchableOpacity style={s.infoBtn} onPress={() => setInfoNetOpen(true)}>
              <Text style={s.infoBtnTxt}>i</Text>
            </TouchableOpacity>
          </View>
          {isLoading ? <ActivityIndicator color={ORANGE} /> : <Text style={s.revAmount}>{fmt(net)}</Text>}
        </View>
        <View style={s.chartArea}><View style={s.chartLine} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {PERIODS.map(([p, l]) => (
            <TouchableOpacity key={p} style={[s.periodBtn, period === p && s.periodBtnActive]}
              onPress={() => setPeriod(p)}>
              <Text style={[s.periodTxt, period === p && { color: "#111827", fontWeight: "700" }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={s.card}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.objTitle}>Prochain objectif</Text>
            <TouchableOpacity style={s.infoBtn} onPress={() => setInfoObjOpen(true)}>
              <Text style={s.infoBtnTxt}>i</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.objAmount}>{fmt(threshold)}</Text>
        </View>
        <View style={s.progBg}><Animated.View style={[s.progFill, { width: progW }]} /></View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={s.progLabel}>{fmt(balance)}</Text>
          <Text style={s.progLabel}>{pct}% atteint</Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 2 }}>
        <Text style={s.sectionTitle}>Activité récente</Text>
        <TouchableOpacity onPress={() => setTab("historique")}>
          <Text style={{ fontSize: 14, fontWeight: "600", color: ORANGE }}>Tout afficher</Text>
        </TouchableOpacity>
      </View>
      {renderTxList((rev?.txs ?? []).slice(0, 5))}
    </View>
  );

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: "#F4F4F8" }}>
      {/* Hero */}
      <View style={[s.hero, { paddingTop: topPad }]}>
        <View style={s.heroNav}>
          <Text style={s.heroTitle}>Finances</Text>
          <TouchableOpacity style={s.bizPill} activeOpacity={0.8}
            onPress={() => businesses.length > 1 && setBizPickOpen(!bizPickOpen)}>
            <Text style={s.bizPillTxt} numberOfLines={1}>{biz?.name ?? "Boutique"}</Text>
            {businesses.length > 1 && (
              <Feather name={bizPickOpen ? "chevron-up" : "chevron-down"} size={13} color="rgba(255,255,255,0.8)" />
            )}
          </TouchableOpacity>
          <TouchableOpacity style={s.heroBtn} onPress={() => setSettingsOpen(true)}>
            <Feather name="settings" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {bizPickOpen && businesses.length > 1 && (
          <View style={s.bizDrop}>
            {businesses.map((b: any) => (
              <TouchableOpacity key={b.id}
                style={[s.bizDropItem, bizId === b.id && s.bizDropItemActive]}
                onPress={() => { setActiveBizId(b.id); onChangeBiz?.(b.id); setBizPickOpen(false); }}>
                <Text style={[s.bizDropTxt, bizId === b.id && { color: ORANGE, fontWeight: "700" }]}>{b.name}</Text>
                {bizId === b.id && <Feather name="check" size={14} color={ORANGE} />}
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={s.soldeWrap}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={s.soldeLabel}>Solde disponible</Text>
            <TouchableOpacity onPress={() => setBalHidden(!balHidden)}>
              <Feather name={balHidden ? "eye-off" : "eye"} size={16} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          </View>
          <Text style={s.soldeAmt}>
            {balHidden ? "••••" : balance.toLocaleString("fr-FR")}{" "}
            <Text style={s.soldeCur}>FCFA</Text>
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN }} />
            <Text style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>Compte actif et sécurisé</Text>
          </View>
        </View>
      </View>

      {/* Floating card */}
      <View style={s.floatingCard}>
        {!hasBizW ? (
          <TouchableOpacity style={s.noAccountBanner}
            onPress={() => { setSettingsOpen(false); setTimeout(openConfig, 200); }} activeOpacity={0.85}>
            <Feather name="alert-circle" size={16} color="#B91C1C" />
            <Text style={s.noAccountBannerTxt}>Configurez un compte pour recevoir vos versements</Text>
          </TouchableOpacity>
        ) : autoMode ? (
          <View style={s.autoBanner}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN }} />
            <Text style={s.autoBannerTxt}>Retrait automatique activé</Text>
          </View>
        ) : (
          <TouchableOpacity style={[s.withdrawBtn, !canEmerg && { opacity: 0.55 }]}
            disabled={!canEmerg} onPress={() => setWithdrawOpen(true)} activeOpacity={0.88}>
            <Text style={s.withdrawBtnTxt}>Retirer mes fonds</Text>
            <Feather name="arrow-up-right" size={18} color="#7C2D12" />
          </TouchableOpacity>
        )}
        <View style={s.tabs}>
          {([
            ["compte","home","Compte"],
            ["historique","file-text","Historique"],
            ["versements","calendar","Versements"],
          ] as [Tab,string,string][]).map(([id, icon, label]) => (
            <TouchableOpacity key={id} style={s.tabItem} onPress={() => setTab(id)}>
              <View style={[s.tabIconWrap, tab === id && { backgroundColor: ORANGE + "18" }]}>
                <Feather name={icon as any} size={19} color={tab === id ? ORANGE : "#9CA3AF"} />
              </View>
              <Text style={[s.tabLabel, tab === id && { color: ORANGE, fontWeight: "700" }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 60 }}>
        {tab === "compte"     && renderCompte()}
        {tab === "historique" && renderTxList(rev?.txs ?? [])}
        {tab === "versements" && (
          <View style={s.card}>
            <Text style={s.objTitle}>Compte de réception</Text>
            {!hasBizW ? (
              <TouchableOpacity style={s.emptyCard} onPress={openConfig}>
                <View style={s.emptyIcon}><Feather name="plus-circle" size={24} color="#D1D5DB" /></View>
                <Text style={s.emptyTitle}>Aucun compte configuré</Text>
                <Text style={[s.emptySub, { color: ORANGE }]}>Configurer maintenant</Text>
              </TouchableOpacity>
            ) : selAccount ? (
              <View style={{ gap: 10 }}>
                {/* Compte actif — tap pour changer */}
                <TouchableOpacity
                  style={[s.walletRow, { borderColor: ORANGE, backgroundColor: "#FFF5F2" }]}
                  onPress={() => setAccPickOpen(true)}
                  activeOpacity={0.78}>
                  <AccountAvatar acc={selAccount} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.txLabel, { color: ORANGE }]}>{accountLabel(selAccount)}</Text>
                    <Text style={s.txDate}>{accountSub(selAccount)}</Text>
                  </View>
                  {walletAccounts.length > 1 ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ fontSize: 11, color: ORANGE, fontWeight: "600" }}>Changer</Text>
                      <Feather name="chevron-down" size={14} color={ORANGE} />
                    </View>
                  ) : (
                    <View style={[s.radioOuter, { borderColor: ORANGE, borderWidth: 2 }]}>
                      <View style={[s.radioInner, { backgroundColor: ORANGE, width: 12, height: 12, borderRadius: 6 }]} />
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity style={s.addAccountRow} onPress={openConfig} activeOpacity={0.75}>
                  <Text style={{ fontSize: 13, color: ORANGE, fontWeight: "600" }}>Gérer les comptes →</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* ── Modal info revenu net ─────────────────────────────────────── */}
      <Modal visible={infoNetOpen} transparent animationType="fade" onRequestClose={() => setInfoNetOpen(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setInfoNetOpen(false)}>
          <View style={s.infoModal}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <View style={[s.infoBtn, { width: 32, height: 32, borderRadius: 16 }]}>
                <Text style={[s.infoBtnTxt, { fontSize: 16 }]}>i</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>Revenu net</Text>
            </View>
            <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 20 }}>
              Le revenu net est calculé après déduction :{"\n\n"}
              • Frais plateforme Bymoh : <Text style={{ fontWeight: "700" }}>{PLATFORM_FEE_PCT}%</Text>{"\n"}
              • Taxes applicables : <Text style={{ fontWeight: "700" }}>{TAX_PCT}%</Text>{"\n\n"}
              Exemple : 10 000 FCFA de ventes{"\n"}
              → Frais = {Math.round((10000 * PLATFORM_FEE_PCT) / 100)} FCFA{"\n"}
              → Taxes = {Math.round((10000 * TAX_PCT) / 100)} FCFA{"\n"}
              → <Text style={{ fontWeight: "800", color: ORANGE }}>
                Net = {(10000 - Math.round((10000 * (PLATFORM_FEE_PCT + TAX_PCT)) / 100)).toLocaleString("fr-FR")} FCFA
              </Text>
            </Text>
            <TouchableOpacity style={s.infoModalBtn} onPress={() => setInfoNetOpen(false)}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Compris</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal info objectif ──────────────────────────────────────── */}
      <Modal visible={infoObjOpen} transparent animationType="fade" onRequestClose={() => setInfoObjOpen(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setInfoObjOpen(false)}>
          <View style={s.infoModal}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <View style={[s.infoBtn, { width: 32, height: 32, borderRadius: 16 }]}>
                <Text style={[s.infoBtnTxt, { fontSize: 16 }]}>i</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#111827" }}>Prochain objectif</Text>
            </View>
            <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 20 }}>
              Vos revenus deviennent disponibles après la{" "}
              <Text style={{ color: ORANGE, fontWeight: "700" }}>livraison</Text> de chaque commande.{"\n\n"}
              Seuil de retrait normal : <Text style={{ fontWeight: "800" }}>{fmt(threshold)}</Text> (sans frais){"\n\n"}
              En dessous du seuil, un retrait d'urgence est disponible avec des frais de{" "}
              <Text style={{ fontWeight: "700" }}>{EMERGENCY_FEE_PCT}%</Text>.
            </Text>
            <TouchableOpacity style={s.infoModalBtn} onPress={() => setInfoObjOpen(false)}>
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Compris</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal PARAMÈTRES ─────────────────────────────────────────── */}
      <Modal visible={settingsOpen} transparent animationType="fade" onRequestClose={() => setSettingsOpen(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setSettingsOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={s.settingsCard}>
              <View style={s.settingsHeader}>
                <Text style={s.settingsTitle}>Paramètres</Text>
                <TouchableOpacity onPress={() => setSettingsOpen(false)}>
                  <Feather name="x" size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.settingsRow} activeOpacity={0.75}
                onPress={() => { setSettingsOpen(false); setTimeout(openConfig, 200); }}>
                <View style={[s.settingsIconWrap, { backgroundColor: SALMON + "33" }]}>
                  <MaterialCommunityIcons name="wallet-outline" size={22} color={ORANGE} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingsRowTitle}>Configurer le portefeuille</Text>
                  <Text style={s.settingsRowSub}>
                    {hasBizW ? `${walletAccounts.length} compte${walletAccounts.length > 1 ? "s" : ""} configuré${walletAccounts.length > 1 ? "s" : ""}` : "Aucun compte configuré"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color="#9CA3AF" />
              </TouchableOpacity>

              <View style={s.settingsDivider} />

              <TouchableOpacity style={s.settingsRow} activeOpacity={0.75}
                onPress={() => { setSettingsOpen(false); setTimeout(openWithdrawSettings, 200); }}>
                <View style={[s.settingsIconWrap, { backgroundColor: INDIGO + "22" }]}>
                  <Feather name="sliders" size={20} color={INDIGO} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.settingsRowTitle}>Configurer mes retraits</Text>
                  <Text style={s.settingsRowSub}>Seuil, mode et fréquence</Text>
                </View>
                <Feather name="chevron-right" size={18} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal CONFIGURER LE PORTEFEUILLE ─────────────────────────── */}
      <Modal visible={configOpen} transparent animationType="fade" onRequestClose={() => setConfigOpen(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setConfigOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={s.cfgCard}>

              {/* ── STEP: main ─────────────────────────────────────────── */}
              {cfgStep === "main" && (<>
                <View style={s.cfgHeader}>
                  <TouchableOpacity style={s.cfgNavBtn}
                    onPress={() => { setConfigOpen(false); setTimeout(() => setSettingsOpen(true), 200); }}>
                    <Feather name="chevron-left" size={22} color="#374151" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={s.cfgTitle}>Portefeuille</Text>
                    <Text style={s.cfgSubtitle}>Compte de réception des fonds</Text>
                  </View>
                  <TouchableOpacity style={s.cfgNavBtn} onPress={() => setConfigOpen(false)}>
                    <Feather name="x" size={20} color="#374151" />
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 10, marginTop: 16 }}>
                  {/* Compte sélectionné (ou vide) */}
                  {selAccount ? (
                    <TouchableOpacity
                      style={[s.provRow, { borderColor: ORANGE, backgroundColor: "#FFF5F2" }]}
                      onPress={() => walletAccounts.length > 1 && setCfgStep("pick-account")}
                      activeOpacity={walletAccounts.length > 1 ? 0.75 : 1}
                    >
                      <AccountAvatar acc={selAccount} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.provRowLabel, { color: "#111827" }]}>{accountLabel(selAccount)}</Text>
                        <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{accountSub(selAccount)}</Text>
                      </View>
                      {walletAccounts.length > 1 ? (
                        <Feather name="chevron-down" size={16} color={ORANGE} />
                      ) : (
                        <View style={[s.radioOuter, { borderColor: ORANGE, borderWidth: 2 }]}>
                          <View style={[s.radioInner, { backgroundColor: ORANGE, width: 12, height: 12, borderRadius: 6 }]} />
                        </View>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={[s.emptyCard, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
                      <View style={s.emptyIcon}><Feather name="credit-card" size={22} color="#D1D5DB" /></View>
                      <Text style={s.emptyTitle}>Aucun compte</Text>
                      <Text style={s.emptySub}>Ajoutez un compte pour recevoir vos fonds.</Text>
                    </View>
                  )}

                  {/* Ajouter un compte */}
                  <TouchableOpacity style={[s.addAccountRow, { marginTop: 4 }]}
                    onPress={() => { setEditingAccountId(null); setCfgStep("add-type"); }} activeOpacity={0.75}>
                    <View style={[s.settingsIconWrap, { backgroundColor: "#F3F4F6", borderRadius: 12 }]}>
                      <FontAwesome6 name="add" size={18} color="#6B7280" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>Ajouter un compte</Text>
                      <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Mobile Money ou compte bancaire</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>

                {hasBizW && (
                  <TouchableOpacity style={[s.confirmBtn, { marginTop: 12 }]} onPress={() => setConfigOpen(false)}>
                    <Text style={s.confirmBtnTxt}>Confirmer ce compte</Text>
                  </TouchableOpacity>
                )}
              </>)}

              {/* ── STEP: pick-account ──────────────────────────────────── */}
              {cfgStep === "pick-account" && (<>
                <View style={s.cfgHeader}>
                  <TouchableOpacity style={s.cfgNavBtn} onPress={() => { setCfgStep("main"); setLongPressedAccId(null); }}>
                    <Feather name="chevron-left" size={22} color="#374151" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={s.cfgTitle}>Choisir un compte</Text>
                    <Text style={[s.cfgSubtitle, { color: longPressedAccId ? ORANGE : "#9CA3AF" }]}>
                      {longPressedAccId ? "Appuyez sur une action" : "Maintenez pour modifier ou supprimer"}
                    </Text>
                  </View>
                  <TouchableOpacity style={s.cfgNavBtn} onPress={() => { setConfigOpen(false); setLongPressedAccId(null); }}>
                    <Feather name="x" size={20} color="#374151" />
                  </TouchableOpacity>
                </View>
                <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ marginTop: 16, paddingBottom: 4 }}>
                  {walletAccounts.map((acc: any, idx: number) => {
                    const isSelected = selAccount?.id === acc.id;
                    const isLongPressed = longPressedAccId === acc.id;
                    return (
                      <View key={acc.id} style={{ marginTop: idx > 0 ? 10 : 0 }}>
                        <TouchableOpacity
                          style={[
                            s.provRow,
                            isSelected && { borderColor: ORANGE, backgroundColor: "#FFF5F2" },
                            isLongPressed && { borderColor: "#6B7280", backgroundColor: "#F9FAFB",
                              borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
                          ]}
                          onPress={() => {
                            if (longPressedAccId) { setLongPressedAccId(null); return; }
                            setSelAccountId(acc.id);
                            setCfgStep("main");
                          }}
                          onLongPress={() => setLongPressedAccId(isLongPressed ? null : acc.id)}
                          delayLongPress={350}
                          activeOpacity={0.75}>
                          <AccountAvatar acc={acc} size={44} />
                          <View style={{ flex: 1 }}>
                            <Text style={[s.provRowLabel, isSelected && { color: "#111827" }]}>{accountLabel(acc)}</Text>
                            <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{accountSub(acc)}</Text>
                          </View>
                          {isLongPressed ? (
                            <Feather name="more-horizontal" size={18} color="#6B7280" />
                          ) : (
                            <View style={[s.radioOuter, isSelected && { borderColor: ORANGE, borderWidth: 2 }]}>
                              {isSelected && <View style={[s.radioInner, { backgroundColor: ORANGE, width: 12, height: 12, borderRadius: 6 }]} />}
                            </View>
                          )}
                        </TouchableOpacity>

                        {/* Actions révélées au long press */}
                        {isLongPressed && (
                          <View style={[s.accountActions, { borderColor: "#6B7280", backgroundColor: "#F3F4F6" }]}>
                            <TouchableOpacity style={s.accountActionBtn}
                              onPress={() => { setLongPressedAccId(null); editAccount(acc); }} activeOpacity={0.7}>
                              <Feather name="edit-2" size={14} color="#374151" />
                              <Text style={[s.accountActionTxt, { color: "#374151" }]}>Modifier</Text>
                            </TouchableOpacity>
                            <View style={s.accountActionDivider} />
                            <TouchableOpacity style={s.accountActionBtn}
                              onPress={() => { setLongPressedAccId(null); deleteAccount(acc.id, accountLabel(acc)); }}
                              activeOpacity={0.7}>
                              <Feather name="trash-2" size={14} color="#EF4444" />
                              <Text style={[s.accountActionTxt, { color: "#EF4444" }]}>Supprimer</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </>)}

              {/* ── STEP: add-type ──────────────────────────────────────── */}
              {cfgStep === "add-type" && (<>
                <View style={s.cfgHeader}>
                  <TouchableOpacity style={s.cfgNavBtn} onPress={() => setCfgStep("main")}>
                    <Feather name="chevron-left" size={22} color="#374151" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={s.cfgTitle}>Type de compte</Text>
                  </View>
                  <TouchableOpacity style={s.cfgNavBtn} onPress={() => setConfigOpen(false)}>
                    <Feather name="x" size={20} color="#374151" />
                  </TouchableOpacity>
                </View>
                <View style={{ gap: 10, marginTop: 16 }}>
                  <TouchableOpacity style={s.addAccountRow} onPress={() => { setNewMobilePhone(""); setCfgStep("add-mobile"); }} activeOpacity={0.75}>
                    <View style={[s.settingsIconWrap, { backgroundColor: ORANGE + "22", borderRadius: 12 }]}>
                      <Feather name="smartphone" size={20} color={ORANGE} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>Mobile Money</Text>
                      <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>MTN, Moov, Wave, Orange…</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                  <View style={s.settingsDivider} />
                  <TouchableOpacity style={s.addAccountRow} onPress={() => { setNewIban(""); setNewBankName(""); setCfgStep("add-bank"); }} activeOpacity={0.75}>
                    <View style={[s.settingsIconWrap, { backgroundColor: INDIGO + "22", borderRadius: 12 }]}>
                      <FontAwesome6 name="building-columns" size={18} color={INDIGO} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 14, fontWeight: "700", color: "#111827" }}>Compte bancaire</Text>
                      <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>Virement via IBAN</Text>
                    </View>
                    <Feather name="chevron-right" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                </View>
              </>)}

              {/* ── STEP: add-mobile ────────────────────────────────────── */}
              {cfgStep === "add-mobile" && (<>
                <View style={s.cfgHeader}>
                  <TouchableOpacity style={s.cfgNavBtn}
                    onPress={() => { setPhoneError(null); setCfgStep(editingAccountId ? "main" : "add-type"); }}>
                    <Feather name="chevron-left" size={22} color="#374151" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={s.cfgTitle}>{editingAccountId ? "Modifier" : "Nouveau"} Mobile Money</Text>
                  </View>
                  <TouchableOpacity style={s.cfgNavBtn} onPress={() => setConfigOpen(false)}>
                    <Feather name="x" size={20} color="#374151" />
                  </TouchableOpacity>
                </View>
                <View style={{ gap: 10, marginTop: 16 }}>
                  {PROVIDERS.map((p) => {
                    const selected = newMobileProv === p.id;
                    return (
                      <TouchableOpacity key={p.id}
                        style={[s.provRow, selected && { borderColor: ORANGE, backgroundColor: "#FFF5F2" }]}
                        onPress={() => setNewMobileProv(p.id)} activeOpacity={0.75}>
                        <ProviderAvatar prov={p} size={40} />
                        <Text style={[s.provRowLabel, selected && { color: "#111827" }]}>{p.label}</Text>
                        <View style={[s.radioOuter, selected && { borderColor: ORANGE, borderWidth: 2 }]}>
                          {selected && <View style={[s.radioInner, { backgroundColor: ORANGE, width: 12, height: 12, borderRadius: 6 }]} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={{ gap: 6, marginTop: 12 }}>
                  <Text style={s.inputLabel}>Numéro de téléphone</Text>
                  <TextInput style={[s.input, phoneError && { borderColor: "#EF4444" }]}
                    value={newMobilePhone} onChangeText={(t) => { setNewMobilePhone(t); setPhoneError(null); }}
                    placeholder="229 01 23 45 67" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />
                  {phoneError && <Text style={s.fieldError}>{phoneError}</Text>}
                </View>
                <TouchableOpacity style={[s.confirmBtn, { marginTop: 16 }, savingW && { opacity: 0.7 }]}
                  onPress={saveNewMobile} disabled={savingW}>
                  {savingW ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmBtnTxt}>Enregistrer</Text>}
                </TouchableOpacity>
              </>)}

              {/* ── STEP: add-bank ──────────────────────────────────────── */}
              {cfgStep === "add-bank" && (<>
                <View style={s.cfgHeader}>
                  <TouchableOpacity style={s.cfgNavBtn}
                    onPress={() => { setIbanError(null); setCfgStep(editingAccountId ? "main" : "add-type"); }}>
                    <Feather name="chevron-left" size={22} color="#374151" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: "center" }}>
                    <Text style={s.cfgTitle}>{editingAccountId ? "Modifier" : "Nouveau"} compte bancaire</Text>
                  </View>
                  <TouchableOpacity style={s.cfgNavBtn} onPress={() => setConfigOpen(false)}>
                    <Feather name="x" size={20} color="#374151" />
                  </TouchableOpacity>
                </View>
                <View style={{ gap: 12, marginTop: 16 }}>
                  <View style={{ gap: 6 }}>
                    <Text style={s.inputLabel}>Nom de la banque</Text>
                    <TextInput style={s.input} value={newBankName} onChangeText={setNewBankName}
                      placeholder="Ex: Ecobank, UBA…" placeholderTextColor="#9CA3AF" />
                  </View>
                  <View style={{ gap: 6 }}>
                    <Text style={s.inputLabel}>IBAN</Text>
                    <TextInput style={[s.input, ibanError && { borderColor: "#EF4444" }]}
                      value={newIban} onChangeText={(t) => { setNewIban(t); setIbanError(null); }}
                      placeholder="BJ66 BJ011 0100400271101160" placeholderTextColor="#9CA3AF"
                      autoCapitalize="characters" autoCorrect={false} />
                    {ibanError && <Text style={s.fieldError}>{ibanError}</Text>}
                    <Text style={{ fontSize: 11, color: "#9CA3AF" }}>
                      L'IBAN sera vérifié automatiquement (algorithme mod-97).
                    </Text>
                  </View>
                </View>
                <TouchableOpacity style={[s.confirmBtn, { marginTop: 16 }, savingW && { opacity: 0.7 }]}
                  onPress={saveNewBank} disabled={savingW}>
                  {savingW ? <ActivityIndicator color="#fff" /> : <Text style={s.confirmBtnTxt}>Enregistrer</Text>}
                </TouchableOpacity>
              </>)}

            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal PARAMÈTRES DE RETRAIT ───────────────────────────────── */}
      <Modal visible={withdrawSettingsOpen} transparent animationType="slide"
        onRequestClose={() => { if (wsStep !== "main") setWsStep("main"); else setWithdrawSettingsOpen(false); }}>
        <View style={{ flex: 1, backgroundColor: "#F4F4F8" }}>
          <View style={[s.wsHeader, { paddingTop: topPad }]}>
            <TouchableOpacity onPress={() => { if (wsStep !== "main") setWsStep("main"); else setWithdrawSettingsOpen(false); }}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
              <Feather name={wsStep !== "main" ? "chevron-left" : "x"} size={20} color="#fff" />
            </TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={s.wsHeaderTitle}>Paramètres de retrait</Text>
              <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 }}>
                Configurez comment recevoir vos fonds
              </Text>
            </View>
          </View>

          {/* ── STEP: main ── */}
          {wsStep === "main" && (
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingBottom: 100 }}>
                {/* Configuration actuelle */}
                <View style={s.wsCurrentCard}>
                  <Text style={s.wsCurrentLabel}>Configuration actuelle</Text>
                  <View style={s.wsCurrentRow}>
                    <Text style={s.wsCurrentKey}>Réception</Text>
                    {selAccount ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <AccountAvatar acc={selAccount} size={18} />
                        <Text style={s.wsCurrentVal}>{accountLabel(selAccount)} · {accountSub(selAccount)}</Text>
                      </View>
                    ) : (
                      <Text style={[s.wsCurrentVal, { color: SALMON }]}>Non configuré</Text>
                    )}
                  </View>
                  <View style={[s.wsCurrentRow, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", marginTop: 10, paddingTop: 10 }]}>
                    <Text style={s.wsCurrentKey}>Mode</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Feather name={autoMode ? "zap" : "user"} size={13} color="rgba(255,255,255,0.7)" />
                      <Text style={s.wsCurrentVal}>{autoMode ? "Automatique" : "Manuel"}{" — seuil "}{fmt(threshold)}</Text>
                    </View>
                  </View>
                  <View style={[s.wsCurrentRow, { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.07)", marginTop: 10, paddingTop: 10 }]}>
                    <Text style={s.wsCurrentKey}>Seuil minimal</Text>
                    <Text style={[s.wsCurrentVal, { fontWeight: "800" }]}>{fmt(threshold)}</Text>
                  </View>
                </View>

                {/* Compte de réception */}
                <TouchableOpacity style={s.wsNavCard} activeOpacity={0.78}
                  onPress={() => {
                    if (!hasBizW) { setWithdrawSettingsOpen(false); setTimeout(openConfig, 200); }
                    else setWsStep("pick-account");
                  }}>
                  <View style={[s.settingsIconWrap, { backgroundColor: SALMON + "33" }]}>
                    <MaterialCommunityIcons name="wallet-outline" size={22} color={ORANGE} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.wsNavLabel}>Compte de réception</Text>
                    {selAccount ? (
                      <Text style={s.wsNavSub} numberOfLines={1}>{accountLabel(selAccount)} · {accountSub(selAccount)}</Text>
                    ) : (
                      <Text style={[s.wsNavSub, { color: SALMON }]}>Configurer un compte →</Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {/* Type de versement */}
                <TouchableOpacity style={s.wsNavCard} onPress={() => setWsStep("pick-mode")} activeOpacity={0.78}>
                  <View style={[s.settingsIconWrap, { backgroundColor: INDIGO + "22" }]}>
                    <Feather name="sliders" size={20} color={INDIGO} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.wsNavLabel}>Type de versement</Text>
                    <Text style={s.wsNavSub}>{autoMode ? "Automatique" : "Manuel"}</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#9CA3AF" />
                </TouchableOpacity>

                {/* Info seuil */}
                <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10,
                  backgroundColor: INDIGO + "11", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: INDIGO + "22" }}>
                  <Feather name="info" size={16} color={INDIGO} style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 12, color: INDIGO, lineHeight: 18 }}>
                    Le seuil minimal est fixé par Bimoh à{" "}
                    <Text style={{ fontWeight: "800" }}>{fmt(threshold)}</Text>{" "}
                    pour un compte {isBankProvider ? "bancaire" : "mobile money"}.
                    {isBankProvider
                      ? " Des frais s'appliquent sur chaque versement bancaire."
                      : " Aucun frais sur les versements mobile money."}
                  </Text>
                </View>
              </ScrollView>

              <View style={{ position: "absolute", bottom: insets.bottom + 20, left: 20, right: 20 }}>
                <TouchableOpacity style={[s.saveBtn, savingWS && { opacity: 0.7 }]}
                  onPress={saveWithdrawSettings} disabled={savingWS}>
                  {savingWS ? <ActivityIndicator color="#fff" /> : <Text style={s.saveBtnTxt}>Enregistrer mes préférences</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── STEP: pick-account ── */}
          {wsStep === "pick-account" && (
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
              <Text style={[s.wsSectionTitle, { marginBottom: 14, paddingHorizontal: 2 }]}>Choisir le compte</Text>
              <View style={{ gap: 10 }}>
                {walletAccounts.length === 0 ? (
                  <TouchableOpacity style={[s.wsNavCard, { justifyContent: "center", paddingVertical: 20 }]}
                    onPress={() => { setWithdrawSettingsOpen(false); setTimeout(openConfig, 200); }}>
                    <Feather name="plus-circle" size={20} color={SALMON} />
                    <Text style={{ fontSize: 14, color: SALMON, fontWeight: "700", marginLeft: 10 }}>Ajouter un compte</Text>
                  </TouchableOpacity>
                ) : (
                  walletAccounts.map((acc: any) => {
                    const isSelected = selAccount?.id === acc.id;
                    return (
                      <TouchableOpacity key={acc.id}
                        style={[s.provRow, isSelected && { borderColor: ORANGE, backgroundColor: "#FFF5F2" }]}
                        onPress={() => { setSelAccountId(acc.id); setWsStep("main"); }}
                        activeOpacity={0.75}>
                        <AccountAvatar acc={acc} size={44} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.provRowLabel, isSelected && { color: "#111827" }]}>{accountLabel(acc)}</Text>
                          <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{accountSub(acc)}</Text>
                          {acc.type === "bank" && (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                              <Feather name="alert-circle" size={11} color="#F59E0B" />
                              <Text style={{ fontSize: 11, color: "#F59E0B" }}>Frais applicables sur chaque versement</Text>
                            </View>
                          )}
                        </View>
                        <View style={[s.radioOuter, isSelected && { borderColor: ORANGE, borderWidth: 2 }]}>
                          {isSelected && <View style={[s.radioInner, { backgroundColor: ORANGE, width: 12, height: 12, borderRadius: 6 }]} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* ── STEP: pick-mode ── */}
          {wsStep === "pick-mode" && (
            <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
              <Text style={[s.wsSectionTitle, { marginBottom: 6, paddingHorizontal: 2 }]}>Type de versement</Text>
              <Text style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16, paddingHorizontal: 2 }}>
                Choisissez comment vous souhaitez recevoir vos fonds
              </Text>
              <View style={{ gap: 12 }}>
                {/* Automatique */}
                <TouchableOpacity style={[s.wsModeCard, autoMode && { borderColor: ORANGE, backgroundColor: "#FFF5F2" }]}
                  onPress={() => { setAutoMode(true); setWsStep("main"); }} activeOpacity={0.78}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[s.settingsIconWrap, { width: 36, height: 36, borderRadius: 10, backgroundColor: ORANGE + "18" }]}>
                        <Feather name="zap" size={17} color={ORANGE} />
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>Automatique</Text>
                    </View>
                    <View style={[s.radioOuter, autoMode && { borderColor: ORANGE, borderWidth: 2 }]}>
                      {autoMode && <View style={[s.radioInner, { backgroundColor: ORANGE, width: 12, height: 12, borderRadius: 6 }]} />}
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 20 }}>
                    {isBankProvider
                      ? `2 versements par semaine dès que le seuil de ${fmt(threshold)} est atteint.`
                      : `2 versements gratuits par semaine dès que le seuil de ${fmt(threshold)} est atteint. Aucun frais.`}
                  </Text>
                  {isBankProvider && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
                      backgroundColor: "#FEF3C7", borderRadius: 8, padding: 8 }}>
                      <Feather name="alert-circle" size={13} color="#F59E0B" />
                      <Text style={{ fontSize: 12, color: "#92400E", flex: 1 }}>Frais bancaires applicables sur chaque versement.</Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Manuel */}
                <TouchableOpacity style={[s.wsModeCard, !autoMode && { borderColor: INDIGO, backgroundColor: INDIGO + "08" }]}
                  onPress={() => { setAutoMode(false); setWsStep("main"); }} activeOpacity={0.78}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <View style={[s.settingsIconWrap, { width: 36, height: 36, borderRadius: 10, backgroundColor: INDIGO + "18" }]}>
                        <Feather name="user" size={17} color={INDIGO} />
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: "800", color: "#111827" }}>Manuel</Text>
                    </View>
                    <View style={[s.radioOuter, !autoMode && { borderColor: INDIGO, borderWidth: 2 }]}>
                      {!autoMode && <View style={[s.radioInner, { backgroundColor: INDIGO, width: 12, height: 12, borderRadius: 6 }]} />}
                    </View>
                  </View>
                  <Text style={{ fontSize: 13, color: "#6B7280", lineHeight: 20 }}>
                    {isBankProvider
                      ? `Vous déclenchez le retrait quand vous le souhaitez, dès ${fmt(threshold)} atteint.`
                      : `Vous déclenchez le retrait quand vous le souhaitez, dès ${fmt(threshold)} atteint. Aucun frais.`}
                  </Text>
                  {isBankProvider && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
                      backgroundColor: "#FEF3C7", borderRadius: 8, padding: 8 }}>
                      <Feather name="alert-circle" size={13} color="#F59E0B" />
                      <Text style={{ fontSize: 12, color: "#92400E", flex: 1 }}>Frais bancaires applicables sur chaque versement.</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* ── Modal CHOISIR COMPTE (versements tab) ────────────────────── */}
      <Modal visible={accPickOpen} transparent animationType="fade" onRequestClose={() => setAccPickOpen(false)}>
        <TouchableOpacity style={s.modalBg} activeOpacity={1} onPress={() => setAccPickOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
            <View style={[s.cfgCard, { paddingBottom: 20 }]}>
              <View style={s.cfgHeader}>
                <View style={{ flex: 1, alignItems: "center" }}>
                  <Text style={s.cfgTitle}>Choisir un compte</Text>
                  <Text style={s.cfgSubtitle}>Sélectionnez le compte de réception actif</Text>
                </View>
                <TouchableOpacity style={s.cfgNavBtn} onPress={() => setAccPickOpen(false)}>
                  <Feather name="x" size={20} color="#374151" />
                </TouchableOpacity>
              </View>
              <View style={{ gap: 10, marginTop: 16 }}>
                {walletAccounts.map((acc: any) => {
                  const isSelected = selAccount?.id === acc.id;
                  return (
                    <TouchableOpacity key={acc.id}
                      style={[s.provRow, isSelected && { borderColor: ORANGE, backgroundColor: "#FFF5F2" }]}
                      onPress={() => { setSelAccountId(acc.id); setAccPickOpen(false); }}
                      activeOpacity={0.75}>
                      <AccountAvatar acc={acc} size={44} />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.provRowLabel, isSelected && { color: "#111827" }]}>{accountLabel(acc)}</Text>
                        <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{accountSub(acc)}</Text>
                      </View>
                      <View style={[s.radioOuter, isSelected && { borderColor: ORANGE, borderWidth: 2 }]}>
                        {isSelected && <View style={[s.radioInner, { backgroundColor: ORANGE, width: 12, height: 12, borderRadius: 6 }]} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={[s.addAccountRow, { marginTop: 10 }]}
                onPress={() => { setAccPickOpen(false); setTimeout(openConfig, 200); }} activeOpacity={0.75}>
                <View style={[s.settingsIconWrap, { backgroundColor: "#F3F4F6", borderRadius: 12, width: 36, height: 36 }]}>
                  <FontAwesome6 name="add" size={16} color="#6B7280" />
                </View>
                <Text style={{ fontSize: 13, color: "#6B7280", fontWeight: "600" }}>Ajouter un autre compte</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal RETRAIT DES FONDS ───────────────────────────────────── */}
      <Modal visible={withdrawOpen} transparent animationType="slide" onRequestClose={() => setWithdrawOpen(false)}>
        <View style={[s.modalBg, { justifyContent: "flex-end", padding: 0 }]}>
          <View style={[s.sheet, { paddingBottom: insets.bottom + 20 }]}>
            <View style={s.handle} />
            <Text style={s.sheetTitle}>Retirer mes fonds</Text>
            <View style={s.wTabs}>
              <TouchableOpacity style={[s.wTab, wMode === "normal" && s.wTabActive]}
                onPress={() => setWMode("normal")} disabled={!canW}>
                <Text style={[s.wTabTxt, wMode === "normal" && { color: ORANGE, fontWeight: "700" }, !canW && { color: "#D1D5DB" }]}>
                  Normal {!canW ? "🔒" : ""}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.wTab, wMode === "emergency" && { ...s.wTabActive, borderColor: "#F59E0B", backgroundColor: "#FFFBEB" }]}
                onPress={() => setWMode("emergency")} disabled={!canEmerg}>
                <Text style={[s.wTabTxt, wMode === "emergency" && { color: "#F59E0B", fontWeight: "700" }]}>⚡ Urgence</Text>
              </TouchableOpacity>
            </View>
            <View style={[s.wSummary, wMode === "emergency" && { borderColor: "#F59E0B", backgroundColor: "#FFFBEB" }]}>
              <Text style={[s.wAmount, wMode === "emergency" && { color: "#F59E0B" }]}>
                {fmt(wMode === "normal" ? balance : emergNet)}
              </Text>
              {wMode === "emergency" && (
                <Text style={{ fontSize: 13, color: "#92400E", marginTop: 4, textAlign: "center" }}>
                  Frais urgence {EMERGENCY_FEE_PCT}% = {fmt(emergFee)}
                </Text>
              )}
            </View>
            {selAccount && (
              <View style={s.walletRow}>
                <AccountAvatar acc={selAccount} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={s.txLabel}>{accountLabel(selAccount)}</Text>
                  <Text style={s.txDate}>{accountSub(selAccount)}</Text>
                </View>
                <Feather name="check-circle" size={18} color={ORANGE} />
              </View>
            )}
            <TouchableOpacity
              style={[s.saveBtn, (!canEmerg || withdrawing) && { opacity: 0.5 }, wMode === "emergency" && { backgroundColor: "#F59E0B" }]}
              onPress={doWithdraw} disabled={!canEmerg || withdrawing}>
              {withdrawing ? <ActivityIndicator color="#fff" /> : (
                <Text style={s.saveBtnTxt}>
                  {wMode === "normal" ? "Confirmer le retrait" : "⚡ Retrait d'urgence"}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setWithdrawOpen(false)}>
              <Text style={s.cancelBtnTxt}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { backgroundColor: DARK_BG, paddingBottom: 72, paddingHorizontal: 16 },
  heroNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 8 },
  heroBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: 20, fontWeight: "800", color: "#fff" },
  soldeWrap: { paddingTop: 16, paddingBottom: 12 },
  soldeLabel: { fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: "600" },
  soldeAmt: { fontSize: 48, fontWeight: "900", color: "#fff", marginTop: 2 },
  soldeCur: { fontSize: 22, fontWeight: "700", color: "rgba(255,255,255,0.65)" },
  floatingCard: {
    marginHorizontal: 16, marginTop: -52, backgroundColor: "#fff", borderRadius: 24,
    paddingTop: 18, paddingHorizontal: 16, paddingBottom: 0,
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 12,
  },
  withdrawBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: SALMON, borderRadius: 16, paddingVertical: 17, marginBottom: 18 },
  withdrawBtnTxt: { fontSize: 16, fontWeight: "700", color: "#7C2D12" },
  noAccountBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#FEF2F2", borderRadius: 16, paddingVertical: 15, paddingHorizontal: 16, marginBottom: 18,
    borderWidth: 1.5, borderColor: "#FECACA" },
  noAccountBannerTxt: { fontSize: 14, fontWeight: "700", color: "#B91C1C", flex: 1, textAlign: "center" },
  autoBanner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#F0FDF4", borderRadius: 16, paddingVertical: 15, marginBottom: 18,
    borderWidth: 1.5, borderColor: "#BBF7D0" },
  autoBannerTxt: { fontSize: 15, fontWeight: "700", color: "#15803D" },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingTop: 10, paddingBottom: 14 },
  tabItem: { flex: 1, alignItems: "center", gap: 4 },
  tabIconWrap: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontSize: 12, fontWeight: "600", color: "#9CA3AF" },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 18, gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  emptyCard: { alignItems: "center", gap: 8, paddingVertical: 28, backgroundColor: "#FAFAFA",
    borderRadius: 14, borderWidth: 1.5, borderColor: "#F3F4F6" },
  emptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 15, fontWeight: "700", color: "#374151" },
  emptySub: { fontSize: 13, color: "#9CA3AF", textAlign: "center" },
  revLabel: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  revAmount: { fontSize: 26, fontWeight: "900", color: "#111827" },
  chartArea: { height: 80, justifyContent: "flex-end" },
  chartLine: { height: 1.5, backgroundColor: ORANGE, borderRadius: 1, marginBottom: 10 },
  periodBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#E5E7EB" },
  periodBtnActive: { backgroundColor: "#fff", borderColor: ORANGE, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  periodTxt: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  infoBtn: { width: 20, height: 20, borderRadius: 10, backgroundColor: ORANGE + "22", alignItems: "center", justifyContent: "center" },
  infoBtnTxt: { fontSize: 11, fontWeight: "900", color: ORANGE },
  objTitle: { fontSize: 15, fontWeight: "800", color: "#111827" },
  objAmount: { fontSize: 14, fontWeight: "700", color: "#111827" },
  progBg: { height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" },
  progFill: { height: "100%", backgroundColor: ORANGE, borderRadius: 4 },
  progLabel: { fontSize: 12, color: "#9CA3AF", fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  txIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  txLabel: { fontSize: 14, fontWeight: "600", color: "#111827" },
  txDate: { fontSize: 12, color: "#9CA3AF", marginTop: 1 },
  walletRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F9FAFB",
    borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#E5E7EB" },
  bizPill: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 100, paddingHorizontal: 12, paddingVertical: 7,
    marginHorizontal: 10, maxWidth: 160 },
  bizPillTxt: { fontSize: 13, fontWeight: "700", color: "rgba(255,255,255,0.9)", flex: 1, textAlign: "center" },
  bizDrop: { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden",
    marginBottom: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  bizDropItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  bizDropItemActive: { backgroundColor: "rgba(255,104,53,0.15)" },
  bizDropTxt: { fontSize: 14, color: "rgba(255,255,255,0.8)", fontWeight: "600" },
  modalBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  infoModal: { backgroundColor: "#fff", borderRadius: 20, padding: 20, gap: 12, width: "100%", maxWidth: 340 },
  infoModalBtn: { backgroundColor: ORANGE, borderRadius: 12, padding: 13, alignItems: "center", marginTop: 4 },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 14, width: "100%" },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: "#111827" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#E5E7EB", alignSelf: "center", marginBottom: 4 },

  // Settings
  settingsCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, width: W - 48, gap: 4,
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 16 },
  settingsHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  settingsTitle: { fontSize: 18, fontWeight: "800", color: "#111827" },
  settingsRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12 },
  settingsIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  settingsRowTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  settingsRowSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  settingsDivider: { height: 1, backgroundColor: "#F3F4F6", marginVertical: 2 },

  // Config card
  cfgCard: { backgroundColor: "#fff", borderRadius: 24, padding: 20, width: W - 48,
    shadowColor: "#000", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.18, shadowRadius: 24, elevation: 16 },
  cfgHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  cfgNavBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  cfgTitle: { fontSize: 17, fontWeight: "800", color: "#111827" },
  cfgSubtitle: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },

  // Provider rows
  provRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, borderWidth: 1.5,
    borderColor: "#E5E7EB", paddingHorizontal: 14, paddingVertical: 11, backgroundColor: "#F9FAFB" },
  provRowLabel: { flex: 1, fontSize: 14, fontWeight: "600", color: "#374151" },
  radioOuter: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center" },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  addAccountRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  accountActions: { flexDirection: "row", borderWidth: 1.5, borderTopWidth: 0, borderColor: "#E5E7EB",
    borderBottomLeftRadius: 14, borderBottomRightRadius: 14, overflow: "hidden", backgroundColor: "#F9FAFB" },
  accountActionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 },
  accountActionDivider: { width: 1, backgroundColor: "#E5E7EB" },
  accountActionTxt: { fontSize: 13, fontWeight: "600", color: "#6B7280" },
  confirmBtn: { backgroundColor: DARK_BG, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  confirmBtnTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },

  // Withdraw settings
  wsHeader: { backgroundColor: DARK_BG, paddingBottom: 18, paddingHorizontal: 20, flexDirection: "row", alignItems: "center" },
  wsHeaderTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },
  wsCurrentCard: { backgroundColor: DARK_BG, borderRadius: 18, padding: 16 },
  wsCurrentLabel: { fontSize: 11, fontWeight: "700", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 },
  wsCurrentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  wsCurrentKey: { fontSize: 12, color: "rgba(255,255,255,0.45)", flex: 0 },
  wsCurrentVal: { fontSize: 13, fontWeight: "600", color: "#fff", flexShrink: 1, textAlign: "right" },
  wsNavCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, flexDirection: "row", alignItems: "center", gap: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  wsNavLabel: { fontSize: 14, fontWeight: "700", color: "#111827" },
  wsNavSub: { fontSize: 12, color: "#9CA3AF", marginTop: 2 },
  wsModeCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: "#E5E7EB" },
  wsSectionTitle: { fontSize: 15, fontWeight: "800", color: "#374151" },

  // Forms
  fieldError: { fontSize: 12, color: "#EF4444", marginTop: 2 },
  inputLabel: { fontSize: 11, fontWeight: "700", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.4 },
  input: { backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 15, color: "#111827", borderWidth: 1.5, borderColor: "#E5E7EB" },
  saveBtn: { backgroundColor: ORANGE, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  saveBtnTxt: { fontSize: 15, fontWeight: "700", color: "#fff" },
  cancelBtn: { backgroundColor: "#F3F4F6", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  cancelBtnTxt: { fontSize: 14, fontWeight: "600", color: "#6B7280" },

  // Withdraw modal
  wTabs: { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 12, padding: 4 },
  wTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  wTabActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  wTabTxt: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  wSummary: { backgroundColor: "#F9FAFB", borderRadius: 16, padding: 16, alignItems: "center", borderWidth: 1.5, borderColor: "#E5E7EB" },
  wAmount: { fontSize: 32, fontWeight: "900", color: "#111827" },
});
