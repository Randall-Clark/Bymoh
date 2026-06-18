import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSignOut = () => {
    Alert.alert("Se déconnecter", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Se déconnecter", style: "destructive", onPress: async () => { await signOut(); router.replace("/"); } },
    ]);
  };

  const MenuItem = ({ icon, label, onPress, danger }: { icon: string; label: string; onPress: () => void; danger?: boolean }) => (
    <TouchableOpacity
      style={[styles.menuItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={[styles.menuIcon, { backgroundColor: danger ? colors.destructiveLight : colors.muted }]}>
        <Feather name={icon as any} size={18} color={danger ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.menuLabel, { color: danger ? colors.destructive : colors.text }]}>{label}</Text>
      <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: 120 }]}
      showsVerticalScrollIndicator={false}
    >
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{user?.name.charAt(0).toUpperCase() ?? "U"}</Text>
        </View>
        <Text style={[styles.userName, { color: colors.text }]}>{user?.name}</Text>
        <Text style={[styles.userPhone, { color: colors.mutedForeground }]}>{user?.phone}</Text>
        <View style={[styles.roleBadge, { backgroundColor: user?.role === "pro" ? colors.proLight : colors.accent }]}>
          <Feather name={user?.role === "pro" ? "briefcase" : "user"} size={12} color={user?.role === "pro" ? colors.proColor : colors.primary} />
          <Text style={[styles.roleText, { color: user?.role === "pro" ? colors.proColor : colors.primary }]}>
            {user?.role === "pro" ? "Professionnel" : "Client"}
          </Text>
        </View>
      </View>

      {/* Client section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>MON ESPACE CLIENT</Text>
        <MenuItem icon="clock" label="Historique des réservations" onPress={() => router.push("/orders/index")} />
        <MenuItem icon="heart" label="Mes favoris" onPress={() => router.push("/(tabs)/favorites")} />
        <MenuItem icon="bell" label="Notifications" onPress={() => router.push("/notifications")} />
      </View>

      {/* Pro section */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>ESPACE PROFESSIONNEL</Text>
        {user?.businessIds && user.businessIds.length > 0 ? (
          <MenuItem icon="bar-chart-2" label="Tableau de bord Pro" onPress={() => router.push("/pro/dashboard")} />
        ) : (
          <TouchableOpacity
            style={[styles.proPromo, { backgroundColor: colors.secondary, borderRadius: 16 }]}
            onPress={() => router.push("/pro/register")}
            activeOpacity={0.85}
          >
            <View>
              <Text style={styles.proPromoTitle}>Vous avez un business ?</Text>
              <Text style={styles.proPromoSub}>Inscrivez-le et gagnez en visibilité</Text>
            </View>
            <View style={[styles.proPromoBtn, { backgroundColor: colors.primary }]}>
              <Feather name="plus" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>PARAMÈTRES</Text>
        <MenuItem icon="edit-2" label="Modifier mon profil" onPress={() => {}} />
        <MenuItem icon="lock" label="Confidentialité" onPress={() => {}} />
        <MenuItem icon="help-circle" label="Aide et support" onPress={() => {}} />
        <MenuItem icon="log-out" label="Se déconnecter" onPress={handleSignOut} danger />
        <MenuItem icon="trash-2" label="Supprimer mon compte" onPress={() => Alert.alert("Suppression", "Cette action est irréversible.", [{ text: "Annuler" }, { text: "Supprimer", style: "destructive" }])} danger />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 24 },
  avatarSection: { alignItems: "center", gap: 8 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 32, fontWeight: "800", color: "#fff" },
  userName: { fontSize: 22, fontWeight: "800" },
  userPhone: { fontSize: 14 },
  roleBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 100 },
  roleText: { fontSize: 12, fontWeight: "700" },
  section: { gap: 8 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 4 },
  menuItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  menuIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontWeight: "500" },
  proPromo: { padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  proPromoTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  proPromoSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  proPromoBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
