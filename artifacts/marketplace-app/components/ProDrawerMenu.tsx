import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
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
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetMyBusinessesQueryKey,
  useGetMyBusinesses,
  useSetBusinessActive,
} from "@workspace/api-client-react";
import { useActiveBusiness } from "@/context/ActiveBusinessContext";
import { useAuth } from "@/context/AuthContext";
import { getMediaUrl } from "@/lib/api";
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
  const qc = useQueryClient();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const { selectedBusinessId } = useActiveBusiness();
  const businessId = selectedBusinessId || user?.businessIds?.[0] || "";
  const { data: myBusinesses = [] } = useGetMyBusinesses({
    query: { queryKey: getGetMyBusinessesQueryKey(), enabled: !!businessId },
  });
  const myBusiness = myBusinesses.find((b) => b.id === businessId);

  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
  const isPauseExpired = myBusiness?.pausedAt
    ? Date.now() - new Date(myBusiness.pausedAt).getTime() > THREE_DAYS_MS
    : false;

  const { mutate: setActive, isPending: isTogglingActive } = useSetBusinessActive({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetMyBusinessesQueryKey() });
      },
      onError: (err: any) => {
        const msg = err?.data?.message ?? "Impossible de modifier le statut. Réessayez.";
        Alert.alert("Erreur", msg);
      },
    },
  });

  const handleToggleActive = () => {
    if (!businessId) return;
    const closing = myBusiness?.isActive !== false;

    if (!closing && isPauseExpired) {
      Alert.alert(
        "Business définitivement fermé",
        "Le délai de 3 jours est dépassé. Pour rouvrir, créez un nouveau commerce depuis l'espace entreprise."
      );
      return;
    }

    Alert.alert(
      closing ? "Mettre en pause ?" : "Réactiver le business ?",
      closing
        ? "Votre business sera invisible aux clients. Vous avez 3 jours pour le réactiver, après quoi il sera définitivement fermé."
        : "Votre business redeviendra visible sur Kola.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: closing ? "Mettre en pause" : "Réactiver",
          style: closing ? "destructive" : "default",
          onPress: () => setActive({ businessId, data: { isActive: !closing } }),
        },
      ]
    );
  };

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
      label: "Accueil",
      sublabel: "Explorer les commerces",
      onPress: () => navigateReplace("/(tabs)"),
    },
    {
      icon: "briefcase",
      label: "Mes Entreprises",
      sublabel: "Changer de commerce",
      onPress: () => navigate("/pro/businesses"),
    },
    {
      icon: "bell",
      label: "Notifications",
      onPress: () => navigate("/notifications"),
      badge: "3",
    },
    {
      icon: "percent",
      label: "Offres & Promotions",
      sublabel: "Créer et gérer vos promos",
      onPress: () => navigate("/pro/promotions"),
    },
    {
      icon: "credit-card",
      label: "Portefeuille",
      sublabel: "Solde & retraits",
      onPress: () => navigate("/pro/wallet"),
    },
    {
      icon: "user",
      label: "Profil business",
      sublabel: "Logo, bannière, contact",
      onPress: () => navigate("/pro/profile"),
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
            {user?.avatar ? (
              <Image
                source={{ uri: getMediaUrl(user.avatar) }}
                style={styles.avatarImg}
                contentFit="cover"
              />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
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

        {/* Bottom: business toggle + sign out */}
        <View style={[styles.drawerFooter, { paddingBottom: botPad + 16, borderTopColor: colors.border }]}>
          {!!businessId && !isPauseExpired && (
            <TouchableOpacity
              style={[
                styles.bizToggleBtn,
                {
                  backgroundColor: myBusiness?.isActive === false ? "#F0FDF4" : "#FFF7ED",
                  borderColor: myBusiness?.isActive === false ? "#86EFAC" : "#FED7AA",
                },
              ]}
              onPress={handleToggleActive}
              disabled={isTogglingActive}
              activeOpacity={0.75}
            >
              <Feather
                name={myBusiness?.isActive === false ? "play-circle" : "pause-circle"}
                size={16}
                color={myBusiness?.isActive === false ? "#16A34A" : "#EA580C"}
              />
              <Text
                style={[
                  styles.bizToggleText,
                  { color: myBusiness?.isActive === false ? "#16A34A" : "#EA580C" },
                ]}
              >
                {isTogglingActive
                  ? "En cours…"
                  : myBusiness?.isActive === false
                  ? "Réactiver le business"
                  : "Mettre en pause le business"}
              </Text>
            </TouchableOpacity>
          )}
          {!!businessId && isPauseExpired && (
            <View style={[styles.bizToggleBtn, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
              <Feather name="x-circle" size={16} color="#EF4444" />
              <Text style={[styles.bizToggleText, { color: "#EF4444" }]}>
                Business définitivement fermé
              </Text>
            </View>
          )}
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
    overflow: "hidden",
  },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
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
  bizToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  bizToggleText: { fontSize: 14, fontWeight: "600", flex: 1 },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
  },
  signOutText: { fontSize: 14, fontWeight: "600", color: "#EF4444" },
});
