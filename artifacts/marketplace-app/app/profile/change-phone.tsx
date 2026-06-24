import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PinField } from "@/components/PinField";
import { api } from "@/lib/api";

type Step = "phone" | "channel" | "otp";

export default function ChangePhoneScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, updateUser } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [step, setStep] = useState<Step>("phone");
  const [newPhone, setNewPhone] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [maskedTarget, setMaskedTarget] = useState("");
  const [devOtp, setDevOtp] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const hasEmail = !!user?.email;

  const isPhoneValid = /^[+]?[\d\s\-]{8,15}$/.test(newPhone.trim());
  const isOtpComplete = otp.every((d) => d !== "");

  const handleRequestOtp = async () => {
    if (!isPhoneValid || loading) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.post<{
        sent: boolean; channel: string; maskedTarget: string; devOtp?: string;
      }>("/users/me/phone/otp", { newPhone: newPhone.trim(), channel });
      setMaskedTarget(data.maskedTarget);
      setDevOtp(data.devOtp);
      setStep("otp");
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? "Erreur lors de l'envoi du code.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOtp = async () => {
    if (!isOtpComplete || loading) return;
    setLoading(true);
    setError("");
    try {
      const updated = await api.post<{ phone: string }>("/users/me/phone/confirm", {
        newPhone: newPhone.trim(),
        otp: otp.join(""),
      });
      await updateUser({ phone: updated.phone });
      setSuccess(true);
      setTimeout(() => router.back(), 1200);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? "Code OTP invalide ou expiré.");
      setOtp(Array(6).fill(""));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step === "channel") { setStep("phone"); setError(""); return; }
    if (step === "otp") { setStep("channel"); setError(""); return; }
    router.back();
  };

  const stepTitle: Record<Step, string> = {
    phone: "Nouveau numéro",
    channel: "Vérification",
    otp: "Entrez le code",
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{stepTitle[step]}</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Step indicator */}
      <View style={styles.steps}>
        {(["phone", "channel", "otp"] as Step[]).map((s, idx) => (
          <View
            key={s}
            style={[
              styles.stepDot,
              {
                backgroundColor:
                  s === step ? colors.primary : ["phone", "channel", "otp"].indexOf(step) > idx ? colors.primary : colors.border,
                opacity: s === step ? 1 : ["phone", "channel", "otp"].indexOf(step) > idx ? 0.5 : 0.3,
              },
            ]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── STEP 1 : Enter new phone ── */}
        {step === "phone" && (
          <>
            <View style={styles.iconWrap}>
              <Feather name="smartphone" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Quel est votre nouveau numéro ?</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Entrez le numéro que vous souhaitez utiliser pour votre compte Bymoh.
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: isPhoneValid ? colors.primary : colors.border, color: colors.text }]}
              placeholder="+228 90 00 00 00"
              placeholderTextColor={colors.mutedForeground}
              value={newPhone}
              onChangeText={(t) => { setNewPhone(t); setError(""); }}
              keyboardType="phone-pad"
              autoFocus
            />
            {!!error && <ErrorBox message={error} />}
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: isPhoneValid ? colors.primary : colors.muted }]}
              onPress={() => setStep("channel")}
              disabled={!isPhoneValid}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: isPhoneValid ? "#fff" : colors.mutedForeground }]}>Continuer</Text>
              <Feather name="arrow-right" size={18} color={isPhoneValid ? "#fff" : colors.mutedForeground} />
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 2 : Choose verification channel ── */}
        {step === "channel" && (
          <>
            <View style={styles.iconWrap}>
              <Feather name="shield" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Vérification d'identité</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Pour confirmer ce changement, choisissez comment recevoir un code de vérification.
            </Text>

            <ChannelOption
              icon="message-square"
              label="SMS sur votre ancien numéro"
              description={(user?.phone ?? "").slice(0, -4).replace(/\d/g, "•") + (user?.phone ?? "").slice(-4)}
              selected={channel === "sms"}
              onPress={() => setChannel("sms")}
              colors={colors}
            />
            <ChannelOption
              icon="mail"
              label="E-mail"
              description={hasEmail ? user!.email! : "Aucun e-mail associé à ce compte"}
              selected={channel === "email"}
              onPress={() => hasEmail && setChannel("email")}
              disabled={!hasEmail}
              colors={colors}
            />

            {!hasEmail && (
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                Ajoutez une adresse e-mail dans votre profil pour utiliser cette option.
              </Text>
            )}
            {!!error && <ErrorBox message={error} />}

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={handleRequestOtp}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnText, { color: "#fff" }]}>
                {loading ? "Envoi en cours…" : "Envoyer le code"}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── STEP 3 : Enter OTP ── */}
        {step === "otp" && (
          <>
            <View style={styles.iconWrap}>
              <Feather name="lock" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Code de vérification</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Un code à 6 chiffres a été envoyé via{" "}
              <Text style={{ fontWeight: "700" }}>{channel === "sms" ? "SMS" : "e-mail"}</Text>
              {"\n"}à <Text style={{ color: colors.text, fontWeight: "700" }}>{maskedTarget}</Text>
            </Text>

            <PinField value={otp} onChange={(d) => { setOtp(d); setError(""); }} error={!!error} autoFocus />

            {/* DEV banner — shows OTP code in development */}
            {!!devOtp && (
              <View style={[styles.devBanner, { backgroundColor: "#FEF3C7", borderColor: "#FDE68A" }]}>
                <Feather name="info" size={13} color="#92400E" />
                <Text style={styles.devBannerText}>
                  Mode dev — code : <Text style={{ fontWeight: "800" }}>{devOtp}</Text>
                </Text>
              </View>
            )}

            {!!error && <ErrorBox message={error} />}

            {success && (
              <View style={[styles.successBox, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
                <Feather name="check-circle" size={15} color="#22C55E" />
                <Text style={[styles.successText, { color: "#166534" }]}>
                  Numéro mis à jour avec succès !
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, { backgroundColor: success ? "#22C55E" : isOtpComplete ? colors.primary : colors.muted }]}
              onPress={handleConfirmOtp}
              disabled={!isOtpComplete || loading || success}
              activeOpacity={0.85}
            >
              {success ? (
                <Feather name="check" size={20} color="#fff" />
              ) : (
                <Text style={[styles.btnText, { color: isOtpComplete ? "#fff" : colors.mutedForeground }]}>
                  {loading ? "Vérification…" : "Confirmer"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => { setStep("channel"); setOtp(Array(6).fill("")); setError(""); }}
              style={styles.resend}
              activeOpacity={0.75}
            >
              <Text style={[styles.resendText, { color: colors.primary }]}>
                Renvoyer le code
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChannelOption({
  icon, label, description, selected, onPress, disabled = false, colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.channelOption,
        {
          backgroundColor: selected ? colors.accent : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <View style={[styles.channelIcon, { backgroundColor: selected ? colors.primary : colors.muted }]}>
        <Feather name={icon} size={18} color={selected ? "#fff" : colors.mutedForeground} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.channelLabel, { color: colors.text }]}>{label}</Text>
        {!!description && (
          <Text style={[styles.channelDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
            {description}
          </Text>
        )}
      </View>
      <View style={[
        styles.radioOuter,
        { borderColor: selected ? colors.primary : colors.border },
      ]}>
        {selected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
      </View>
    </TouchableOpacity>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <View style={[styles.errorBox, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
      <Feather name="alert-circle" size={14} color="#EF4444" />
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  steps: {
    flexDirection: "row", gap: 6, justifyContent: "center", paddingVertical: 14,
  },
  stepDot: { width: 28, height: 4, borderRadius: 2 },

  content: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 48, gap: 20 },
  iconWrap: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: "#FFF0EB", alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, lineHeight: 21 },

  input: {
    paddingHorizontal: 16, paddingVertical: 14,
    borderRadius: 12, borderWidth: 1.5, fontSize: 16,
  },

  channelOption: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 16, borderWidth: 1.5, padding: 16,
  },
  channelIcon: {
    width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center",
  },
  channelLabel: { fontSize: 14, fontWeight: "700" },
  channelDesc: { fontSize: 12, marginTop: 2 },
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },

  hint: { fontSize: 12, lineHeight: 18 },

  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 16, borderRadius: 100,
  },
  btnText: { fontSize: 16, fontWeight: "700" },

  devBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  devBannerText: { fontSize: 13, color: "#92400E" },

  successBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  successText: { fontSize: 13 },

  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, borderWidth: 1,
  },
  errorText: { flex: 1, fontSize: 13, color: "#EF4444" },

  resend: { alignItems: "center" },
  resendText: { fontSize: 14, fontWeight: "600" },
});
