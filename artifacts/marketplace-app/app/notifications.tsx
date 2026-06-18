import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const NOTIFS = [
  { id: "n1", icon: "check-circle", title: "Réservation confirmée", body: "Salon Élégance & Style a confirmé votre réservation du 20 juin.", time: "Il y a 2h", color: "#22C55E", read: false },
  { id: "n2", icon: "truck", title: "Commande en livraison", body: "Votre commande de TechPro Solutions est en route. ETA: 20 min.", time: "Il y a 3h", color: "#F59E0B", read: false },
  { id: "n3", icon: "star", title: "Notez votre expérience", body: "Comment s'est passée votre visite chez Restaurant Chez Mamie ?", time: "Hier", color: "#FF6835", read: true },
  { id: "n4", icon: "gift", title: "Offre spéciale", body: "Profitez de 10% de réduction sur votre prochaine commande ce week-end !", time: "Il y a 2 jours", color: "#8B5CF6", read: true },
  { id: "n5", icon: "clock", title: "Rappel de réservation", body: "Votre réservation chez Clinique du Quartier est demain à 09h00.", time: "Il y a 3 jours", color: "#3B82F6", read: true },
];

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 16 }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 22 }} />
      </View>

      <FlatList
        data={NOTIFS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.notifItem,
              {
                backgroundColor: item.read ? colors.card : colors.card,
                borderColor: item.read ? colors.border : colors.primary + "30",
                borderLeftWidth: item.read ? 1 : 3,
                borderLeftColor: item.read ? colors.border : item.color,
              },
            ]}
            activeOpacity={0.75}
          >
            <View style={[styles.iconWrap, { backgroundColor: item.color + "20" }]}>
              <Feather name={item.icon as any} size={20} color={item.color} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <View style={styles.notifRow}>
                <Text style={[styles.notifTitle, { color: colors.text }]}>{item.title}</Text>
                {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
              </View>
              <Text style={[styles.notifBody, { color: colors.mutedForeground }]} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>{item.time}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  title: { fontSize: 20, fontWeight: "800" },
  list: { padding: 16, gap: 10 },
  notifItem: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  iconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  notifRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  notifTitle: { fontSize: 14, fontWeight: "700", flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notifBody: { fontSize: 13, lineHeight: 18 },
  notifTime: { fontSize: 11 },
});
