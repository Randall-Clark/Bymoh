import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

export type PaymentMethod = "moov_money" | "mtn_momo" | "card";

interface PaymentMethodOption {
  id: PaymentMethod;
  label: string;
  sub: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  needsPhone: boolean;
}

const METHODS: PaymentMethodOption[] = [
  {
    id: "moov_money",
    label: "Moov Money",
    sub: "Flooz · Moov Africa Togo",
    icon: "smartphone",
    iconBg: "#FEF3C7",
    iconColor: "#D97706",
    needsPhone: true,
  },
  {
    id: "mtn_momo",
    label: "MTN MoMo",
    sub: "Mobile Money MTN",
    icon: "phone",
    iconBg: "#FDE68A",
    iconColor: "#B45309",
    needsPhone: true,
  },
  {
    id: "card",
    label: "Carte bancaire",
    sub: "Visa · Mastercard",
    icon: "credit-card",
    iconBg: "#E0E7FF",
    iconColor: "#4338CA",
    needsPhone: false,
  },
];

interface Props {
  visible: boolean;
  onClose: () => void;
  onInitiate: (params: {
    amount: number;
    method: PaymentMethod;
    phone?: string;
  }) => Promise<{ paymentUrl?: string | null; transactionId: string; sandbox: boolean }>;
  onSuccess: () => void;
}

type Step = "method" | "amount" | "confirm" | "waiting";

export default function PaymentModal({ visible, onClose, onInitiate, onSuccess }: Props) {
  const colors = useColors();
  const [step, setStep] = useState<Step>("method");
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>("moov_money");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const methodDef = METHODS.find((m) => m.id === selectedMethod)!;

  function reset() {
    setStep("method");
    setAmount("");
    setPhone("");
    setLoading(false);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function goToAmount() {
    setStep("amount");
  }

  function goToConfirm() {
    const amt = Number(amount);
    if (!amt || amt < 100) {
      Alert.alert("Montant invalide", "Le montant minimum est 100 FCFA.");
      return;
    }
    setStep("confirm");
  }

  async function handlePay() {
    const amt = Number(amount);
    if (methodDef.needsPhone && !phone.trim()) {
      Alert.alert("Numéro requis", "Veuillez saisir votre numéro Mobile Money.");
      return;
    }
    setLoading(true);
    try {
      const result = await onInitiate({
        amount: amt,
        method: selectedMethod,
        phone: phone.trim() || undefined,
      });

      if (result.sandbox) {
        // Sandbox: wallet credited directly
        reset();
        onSuccess();
        Alert.alert(
          "Recharge effectuée",
          `${amt.toLocaleString("fr-FR")} FCFA ajoutés à votre portefeuille.\n(Mode test — aucun paiement réel)`
        );
        return;
      }

      if (result.paymentUrl) {
        // Real CinetPay: open payment page in browser
        setStep("waiting");
        await Linking.openURL(result.paymentUrl);
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'initier le paiement. Réessayez.");
    } finally {
      setLoading(false);
    }
  }

  function handleReturnFromBrowser() {
    reset();
    onSuccess();
    Alert.alert(
      "Vérification en cours",
      "Votre paiement est en cours de confirmation. Le solde sera mis à jour sous quelques instants."
    );
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.handle} />

          {/* ── STEP: method ─────────────────────────────────────────── */}
          {step === "method" && (
            <>
              <Text style={[styles.title, { color: colors.text }]}>Choisir le moyen de paiement</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground }]}>
                Rechargez votre portefeuille Kola
              </Text>
              <View style={styles.methodList}>
                {METHODS.map((m) => {
                  const isSelected = selectedMethod === m.id;
                  return (
                    <TouchableOpacity
                      key={m.id}
                      style={[
                        styles.methodRow,
                        {
                          borderColor: isSelected ? colors.primary : colors.border,
                          backgroundColor: isSelected ? `${colors.primary}12` : colors.background,
                        },
                      ]}
                      onPress={() => setSelectedMethod(m.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.methodIcon, { backgroundColor: m.iconBg }]}>
                        <Feather name={m.icon as any} size={20} color={m.iconColor} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.methodLabel, { color: colors.text }]}>{m.label}</Text>
                        <Text style={[styles.methodSub, { color: colors.mutedForeground }]}>{m.sub}</Text>
                      </View>
                      <View
                        style={[
                          styles.radio,
                          {
                            borderColor: isSelected ? colors.primary : colors.border,
                            backgroundColor: isSelected ? colors.primary : "transparent",
                          },
                        ]}
                      >
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                >
                  <Text style={[styles.cancelText, { color: colors.text }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, { backgroundColor: colors.primary }]}
                  onPress={goToAmount}
                >
                  <Text style={styles.nextText}>Continuer</Text>
                  <Feather name="arrow-right" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── STEP: amount ─────────────────────────────────────────── */}
          {step === "amount" && (
            <>
              <TouchableOpacity style={styles.backRow} onPress={() => setStep("method")}>
                <Feather name="arrow-left" size={18} color={colors.primary} />
                <Text style={[styles.backText, { color: colors.primary }]}>Retour</Text>
              </TouchableOpacity>
              <View style={[styles.methodPill, { backgroundColor: `${colors.primary}15` }]}>
                <Feather name={methodDef.icon as any} size={14} color={colors.primary} />
                <Text style={[styles.methodPillText, { color: colors.primary }]}>{methodDef.label}</Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Montant à recharger</Text>

              {/* Quick amounts */}
              <View style={styles.quickRow}>
                {[1000, 2500, 5000, 10000].map((q) => (
                  <TouchableOpacity
                    key={q}
                    style={[
                      styles.quickBtn,
                      {
                        borderColor: amount === String(q) ? colors.primary : colors.border,
                        backgroundColor: amount === String(q) ? `${colors.primary}12` : colors.background,
                      },
                    ]}
                    onPress={() => setAmount(String(q))}
                  >
                    <Text
                      style={[
                        styles.quickText,
                        { color: amount === String(q) ? colors.primary : colors.text },
                      ]}
                    >
                      {q.toLocaleString("fr-FR")}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.text }]}>Montant personnalisé (FCFA)</Text>
                <TextInput
                  style={[
                    styles.input,
                    { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                  ]}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Ex : 7500"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="number-pad"
                />
              </View>

              {methodDef.needsPhone && (
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>
                    Numéro {methodDef.label}
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      { backgroundColor: colors.background, borderColor: colors.border, color: colors.text },
                    ]}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="Ex : +228 90 00 00 00"
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="phone-pad"
                  />
                </View>
              )}

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                >
                  <Text style={[styles.cancelText, { color: colors.text }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, { backgroundColor: colors.primary }]}
                  onPress={goToConfirm}
                >
                  <Text style={styles.nextText}>Suivant</Text>
                  <Feather name="arrow-right" size={16} color="#fff" />
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── STEP: confirm ─────────────────────────────────────────── */}
          {step === "confirm" && (
            <>
              <TouchableOpacity style={styles.backRow} onPress={() => setStep("amount")}>
                <Feather name="arrow-left" size={18} color={colors.primary} />
                <Text style={[styles.backText, { color: colors.primary }]}>Retour</Text>
              </TouchableOpacity>
              <Text style={[styles.title, { color: colors.text }]}>Confirmer la recharge</Text>

              <View style={[styles.summaryCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>Méthode</Text>
                  <View style={styles.summaryValue}>
                    <Feather name={methodDef.icon as any} size={14} color={colors.primary} />
                    <Text style={[styles.summaryValueText, { color: colors.text }]}>{methodDef.label}</Text>
                  </View>
                </View>
                {phone ? (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>Numéro</Text>
                    <Text style={[styles.summaryValueText, { color: colors.text }]}>{phone}</Text>
                  </View>
                ) : null}
                <View style={[styles.summaryRow, styles.summaryRowLast]}>
                  <Text style={[styles.summaryKey, { color: colors.mutedForeground }]}>Montant</Text>
                  <Text style={[styles.summaryAmount, { color: colors.primary }]}>
                    {Number(amount).toLocaleString("fr-FR")} FCFA
                  </Text>
                </View>
              </View>

              <View style={[styles.infoBox, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Feather name="shield" size={14} color="#16A34A" />
                <Text style={[styles.infoText, { color: "#15803D" }]}>
                  Paiement sécurisé via CinetPay — Moov Money, MTN MoMo &amp; Visa acceptés au Togo
                </Text>
              </View>

              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: colors.border }]}
                  onPress={handleClose}
                >
                  <Text style={[styles.cancelText, { color: colors.text }]}>Annuler</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.nextBtn, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
                  onPress={handlePay}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="lock" size={14} color="#fff" />
                      <Text style={styles.nextText}>Payer</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── STEP: waiting ─────────────────────────────────────────── */}
          {step === "waiting" && (
            <View style={styles.waitingWrap}>
              <View style={[styles.waitingIcon, { backgroundColor: `${colors.primary}15` }]}>
                <Feather name="external-link" size={36} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Paiement en cours</Text>
              <Text style={[styles.sub, { color: colors.mutedForeground, textAlign: "center" }]}>
                Complétez votre paiement dans la page qui s'est ouverte, puis revenez ici.
              </Text>
              <TouchableOpacity
                style={[styles.nextBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
                onPress={handleReturnFromBrowser}
              >
                <Feather name="check-circle" size={16} color="#fff" />
                <Text style={styles.nextText}>J'ai payé — Rafraîchir</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ marginTop: 12 }} onPress={handleClose}>
                <Text style={[styles.cancelText, { color: colors.mutedForeground }]}>Annuler</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  sub: {
    fontSize: 13,
    marginTop: -8,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: -4,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
  },
  methodList: {
    gap: 10,
  },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  methodIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  methodLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  methodSub: {
    fontSize: 12,
    marginTop: 1,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  nextBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  nextText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  methodPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  methodPillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  quickBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  quickText: {
    fontSize: 13,
    fontWeight: "600",
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 15,
  },
  summaryCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  summaryRowLast: {
    borderBottomWidth: 0,
  },
  summaryKey: {
    fontSize: 13,
    fontWeight: "500",
  },
  summaryValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryValueText: {
    fontSize: 14,
    fontWeight: "600",
  },
  summaryAmount: {
    fontSize: 17,
    fontWeight: "800",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  waitingWrap: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  waitingIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
