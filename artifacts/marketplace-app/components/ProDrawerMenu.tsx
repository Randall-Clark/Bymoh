import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const { width: W } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(W * 0.78, 320);

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface MenuItemDef {
  icon: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  badge?: string;
}

export default function ProDrawerMenu({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const slideX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideX, { toValue: 0, damping: 20, stiffness: 180, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideX, { toValue: -DRAWER_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const navigate = (path: string) => {
    onClose();
    setTimeout(() => router.push(path as any), 250);
  };

  const navigateReplace = (path: string) => {
    onClose();
    setTimeout(() => router.replace(path as any), 250);
  };

  const handleSignOut = () => {
    Alert.alert("Se déconnecter", "Voulez-vous vraiment vous déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          onClose();
          await signOut();
          router.replace("/");
        },
      },
    ]);
  };

  const initials = user?.name
    ? user.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()
    : "K";

  const mainItems: MenuItemDef[] = [
    {
      icon: "home",
      label: "Accueil (vue client)",
      sublabel: "Explorer les commerces",
      onPress: () => navigateReplace("/(tabs)"),
    },
    {
      icon: "briefcase",
      label: "Mon Business",
      sublabel: "Tableau de bord",
      onPress: onClose,
    },
    {
      icon: "bell",
      label: "Notifications",
      onPress: () => navigate("/notifications"),
      badge: "3",
    },
    {
      icon: "credit-card",
      label: "Portefeuille",
      sublabel: "Bientôt disponible",
      onPress: () => Alert.alert("Portefeuille", "Fonctionnalité disponible prochainement."),
    },
    {
      icon: "user",
      label: "Profil",
      sublabel: user?.name ?? "",
      onPress: () => navigate("/(tabs)/profile"),
    },
    {
      icon: "settings",
      label: "Paramètres généraux",
      onPress: () => Alert.alert("Paramètres", "Fonctionnalité disponible prochainement."),
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        style={[
          styles.drawer,
          { backgroundColor: colors.background, transform: [{ translateX: slideX }] },
        ]}
      >
        {/* Header area */}
        <View style={[styles.drawerHeader, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: "#E84B1A" }]}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
              {user?.name ?? "Utilisateur"}
            </Text>
            <View style={[styles.proBadge, { backgroundColor: colors.proLight ?? "#FFF3E0" }]}>
              <Feather name="briefcase" size={10} color="#F5A623" />
              <Text style={[styles.proBadgeText, { color: "#F5A623" }]}>Professionnel</Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="x" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>

        {/* Menu items */}
        <View style={styles.menuList}>
          {mainItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.danger ? "#FEE2E2" : colors.muted }]}>
                <Feather
                  name={item.icon as any}
                  size={18}
                  color={item.danger ? "#EF4444" : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.menuLabel, { color: item.danger ? "#EF4444" : colors.text }]}>
                  {item.label}
                </Text>
                {!!item.sublabel && (
                  <Text style={[styles.menuSub, { color: colors.mutedForeground }]}>{item.sublabel}</Text>
                )}
              </View>
              {!!item.badge && (
                <View style={[styles.badge, { backgroundColor: "#EF4444" }]}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Bottom: sign out */}
        <View style={[styles.drawerFooter, { paddingBottom: botPad + 16, borderTopColor: colors.border }]}>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.75}>
            <Feather name="log-out" size={16} color="#EF4444" />
            <Text style={styles.signOutText}>Se déconnecter</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drawer: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },

  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 18, fontWeight: "800", color: "#fff" },
  userName: { fontSize: 15, fontWeight: "700" },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    alignSelf: "flex-start",
    marginTop: 3,
  },
  proBadgeText: { fontSize: 10, fontWeight: "700" },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },

  menuList: { flex: 1 },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { fontSize: 14, fontWeight: "600" },
  menuSub: { fontSize: 12, marginTop: 1 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  drawerFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  signOutText: { fontSize: 14, fontWeight: "600", color: "#EF4444" },
});
