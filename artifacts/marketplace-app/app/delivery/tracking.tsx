import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const STEPS = [
  { label: "Commande reçue", icon: "check-circle", done: true },
  { label: "En préparation", icon: "package", done: true },
  { label: "Livreur en route", icon: "truck", done: false },
  { label: "Livré", icon: "home", done: false },
];

export default function DeliveryTrackingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState(2);
  const [eta, setEta] = useState(22);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  useEffect(() => {
    const timer = setInterval(() => {
      setEta((e) => Math.max(0, e - 1));
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.replace("/orders")} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Suivi de livraison</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={[styles.content, { paddingBottom: botPad + 24 }]}>
        {/* Map placeholder */}
        <View style={[styles.mapArea, { backgroundColor: colors.muted }]}>
          <View style={[styles.mapDot, { backgroundColor: colors.primary }]}>
            <Feather name="truck" size={20} color="#fff" />
          </View>
          <View style={[styles.destDot, { backgroundColor: colors.secondary }]}>
            <Feather name="home" size={16} color="#fff" />
          </View>
          <Text style={[styles.mapLabel, { color: colors.mutedForeground }]}>Carte en temps réel</Text>
        </View>

        {/* ETA card */}
        <View style={[styles.etaCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.etaTitle, { color: colors.text }]}>Livraison estimée</Text>
            <Text style={[styles.etaLabel, { color: colors.mutedForeground }]}>Via Gozem</Text>
          </View>
          <View style={[styles.etaBadge, { backgroundColor: colors.accent }]}>
            <Feather name="clock" size={14} color={colors.primary} />
            <Text style={[styles.etaTime, { color: colors.primary }]}>{eta} min</Text>
          </View>
        </View>

        {/* Driver info */}
        <View style={[styles.driverCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.driverAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.driverInitial}>K</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.driverName, { color: colors.text }]}>Kofi Adzoga</Text>
            <Text style={[styles.driverInfo, { color: colors.mutedForeground }]}>Moto · AB 1234 TG</Text>
          </View>
          <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.success }]}>
            <Feather name="phone" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.callBtn, { backgroundColor: colors.muted }]}>
            <Feather name="message-circle" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Progress steps */}
        <View style={[styles.stepsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.stepsTitle, { color: colors.text }]}>Statut de la commande</Text>
          {STEPS.map((step, i) => {
            const isDone = i < progress;
            const isCurrent = i === progress;
            return (
              <View key={i} style={styles.step}>
                <View style={styles.stepLeft}>
                  <View style={[styles.stepIcon, { backgroundColor: isDone ? colors.success : isCurrent ? colors.primary : colors.muted }]}>
                    <Feather name={step.icon as any} size={14} color={isDone || isCurrent ? "#fff" : colors.mutedForeground} />
                  </View>
                  {i < STEPS.length - 1 && (
                    <View style={[styles.stepLine, { backgroundColor: isDone ? colors.success : colors.border }]} />
                  )}
                </View>
                <Text style={[styles.stepLabel, { color: isDone || isCurrent ? colors.text : colors.mutedForeground, fontWeight: isCurrent ? "700" : "400" }]}>
                  {step.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  content: { flex: 1, padding: 20, gap: 16 },
  mapArea: { height: 180, borderRadius: 20, alignItems: "center", justifyContent: "center", position: "relative" },
  mapDot: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", position: "absolute", top: "30%", left: "30%" },
  destDot: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", position: "absolute", bottom: "25%", right: "25%" },
  mapLabel: { fontSize: 12, position: "absolute", bottom: 12 },
  etaCard: { flexDirection: "row", alignItems: "center", padding: 16, borderRadius: 16, borderWidth: 1 },
  etaTitle: { fontSize: 16, fontWeight: "700" },
  etaLabel: { fontSize: 12, marginTop: 2 },
  etaBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  etaTime: { fontSize: 16, fontWeight: "800" },
  driverCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  driverAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  driverInitial: { color: "#fff", fontSize: 18, fontWeight: "800" },
  driverName: { fontSize: 15, fontWeight: "700" },
  driverInfo: { fontSize: 12 },
  callBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  stepsCard: { padding: 16, borderRadius: 16, borderWidth: 1, gap: 0 },
  stepsTitle: { fontSize: 15, fontWeight: "700", marginBottom: 16 },
  step: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  stepLeft: { alignItems: "center" },
  stepIcon: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  stepLine: { width: 2, height: 28, marginTop: 2 },
  stepLabel: { fontSize: 14, paddingTop: 4, paddingBottom: 16 },
});
