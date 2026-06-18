import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const BG_ORANGE = "#E84B1A";

export default function PurposeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleExplore = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/(tabs)");
  };

  const handleBusiness = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.replace("/pro/register");
  };

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: topPad + 16, paddingBottom: botPad + 32 },
      ]}
    >
      {/* Title block */}
      <View style={styles.titleBlock}>
        <Text style={[styles.title, { color: colors.text }]}>
          Bienvenue sur Kola
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Que souhaitez-vous faire ? Vous pourrez{"\n"}changer à tout moment.
        </Text>
      </View>

      {/* Cards */}
      <View style={styles.cards}>
        {/* Explorer card — highlighted */}
        <TouchableOpacity
          style={styles.exploreCard}
          onPress={handleExplore}
          activeOpacity={0.88}
        >
          {/* Decorative blob */}
          <View style={styles.exploreBlob} />

          <View style={[styles.exploreIconWrap]}>
            <Feather name="search" size={26} color="#fff" />
          </View>
          <Text style={styles.exploreTitle}>Explorer les adresses</Text>
          <Text style={styles.exploreDesc}>
            Trouvez les bons plans et les bonnes{"\n"}adresses autour de vous.
          </Text>
        </TouchableOpacity>

        {/* Business card — white */}
        <TouchableOpacity
          style={[styles.businessCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={handleBusiness}
          activeOpacity={0.88}
        >
          <View style={styles.businessIconWrap}>
            <Feather name="archive" size={22} color="#1C1917" />
          </View>
          <Text style={[styles.businessTitle, { color: colors.text }]}>
            Enregistrer mon business
          </Text>
          <Text style={[styles.businessDesc, { color: colors.mutedForeground }]}>
            Gagnez en visibilité, recevez réservations et{"\n"}commandes.
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  titleBlock: { paddingBottom: 28, gap: 10 },
  title: { fontSize: 30, fontWeight: "800", letterSpacing: -0.5 },
  subtitle: { fontSize: 15, lineHeight: 22 },

  cards: { gap: 16 },

  /* Explorer card */
  exploreCard: {
    backgroundColor: BG_ORANGE,
    borderRadius: 24,
    padding: 26,
    overflow: "hidden",
    gap: 12,
    minHeight: 190,
  },
  exploreBlob: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.08)",
    right: -30,
    bottom: -30,
  },
  exploreIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  exploreTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  exploreDesc: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    lineHeight: 20,
    fontWeight: "500",
  },

  /* Business card */
  businessCard: {
    borderRadius: 24,
    padding: 26,
    borderWidth: 1,
    gap: 12,
    minHeight: 170,
  },
  businessIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
  },
  businessTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },
  businessDesc: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
});
