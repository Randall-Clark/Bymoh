import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOCK_BUSINESSES } from "@/constants/mockData";
import { useColors } from "@/hooks/useColors";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_LABELS: Record<string, string> = {
  Lun: "Lundi", Mar: "Mardi", Mer: "Mercredi", Jeu: "Jeudi",
  Ven: "Vendredi", Sam: "Samedi", Dim: "Dimanche",
};

export default function ProScheduleScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [hours, setHours] = useState({ ...MOCK_BUSINESSES[0].openingHours! });
  const [saved, setSaved] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const toggleClosed = (day: string) => {
    Haptics.selectionAsync();
    setHours((h) => ({ ...h, [day]: { ...h[day], closed: !h[day].closed } }));
    setSaved(false);
  };

  const updateTime = (day: string, field: "open" | "close", val: string) => {
    setHours((h) => ({ ...h, [day]: { ...h[day], [field]: val } }));
    setSaved(false);
  };

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSaved(true);
    Alert.alert("Horaires mis à jour", "Vos nouveaux horaires sont maintenant visibles sur votre profil.");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Horaires d'ouverture</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 100 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          Définissez vos horaires par jour. Les clients verront si vous êtes ouvert en temps réel.
        </Text>

        {DAYS.map((day) => {
          const h = hours[day];
          if (!h) return null;
          return (
            <View key={day} style={[styles.dayCard, { backgroundColor: colors.card, borderColor: h.closed ? colors.border : colors.primary + "40" }]}>
              <View style={styles.dayTop}>
                <View>
                  <Text style={[styles.dayFull, { color: colors.text }]}>{DAY_LABELS[day]}</Text>
                  <Text style={[styles.dayShort, { color: colors.mutedForeground }]}>{day}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, { backgroundColor: h.closed ? colors.muted : colors.success + "20" }]}
                  onPress={() => toggleClosed(day)}
                >
                  <View style={[styles.toggleDot, { backgroundColor: h.closed ? colors.mutedForeground : colors.success, transform: [{ translateX: h.closed ? 0 : 20 }] }]} />
                </TouchableOpacity>
              </View>

              {!h.closed && (
                <View style={styles.timeRow}>
                  <View style={styles.timeField}>
                    <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>Ouverture</Text>
                    <TextInput
                      style={[styles.timeInput, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border }]}
                      value={h.open}
                      onChangeText={(t) => updateTime(day, "open", t)}
                      placeholder="08:00"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                  <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  <View style={styles.timeField}>
                    <Text style={[styles.timeLabel, { color: colors.mutedForeground }]}>Fermeture</Text>
                    <TextInput
                      style={[styles.timeInput, { backgroundColor: colors.muted, color: colors.text, borderColor: colors.border }]}
                      value={h.close}
                      onChangeText={(t) => updateTime(day, "close", t)}
                      placeholder="18:00"
                      placeholderTextColor={colors.mutedForeground}
                    />
                  </View>
                </View>
              )}

              {h.closed && (
                <Text style={[styles.closedLabel, { color: colors.mutedForeground }]}>Fermé ce jour</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: botPad + 16 }]}>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: saved ? colors.success : colors.primary }]}
          onPress={handleSave}
        >
          <Feather name={saved ? "check" : "save"} size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{saved ? "Horaires enregistrés" : "Enregistrer les horaires"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  scroll: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  dayCard: { borderRadius: 16, padding: 16, borderWidth: 1, gap: 12 },
  dayTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  dayFull: { fontSize: 16, fontWeight: "700" },
  dayShort: { fontSize: 12, marginTop: 1 },
  toggle: { width: 48, height: 28, borderRadius: 14, justifyContent: "center", paddingHorizontal: 4 },
  toggleDot: { width: 20, height: 20, borderRadius: 10 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  timeField: { flex: 1, gap: 6 },
  timeLabel: { fontSize: 11, fontWeight: "600" },
  timeInput: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, fontSize: 16, fontWeight: "600", textAlign: "center" },
  separator: { width: 1, height: 40, marginTop: 20 },
  closedLabel: { fontSize: 13, fontStyle: "italic" },
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 16, borderRadius: 100 },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
