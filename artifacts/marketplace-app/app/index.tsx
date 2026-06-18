import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

const { width: W, height: H } = Dimensions.get("window");

const BG = "#E84B1A";
const BG_DARK = "#C93E12";
const DOODLE_COLOR = "rgba(255,255,255,0.13)";

const TILE = 88;
const COLS = Math.ceil(W / TILE) + 5;
const ROWS = Math.ceil(H / TILE) + 5;

const SYMBOLS = ["+", "◇", "○", "∧", "~", "⊕", "Ш", "M", "☀", "△", "×", "⌀"];

function seededPick(row: number, col: number): string {
  const i = Math.abs((row * 7 + col * 13) ^ (row + col * 3)) % SYMBOLS.length;
  return SYMBOLS[i];
}

const CELLS = Array.from({ length: ROWS }, (_, row) =>
  Array.from({ length: COLS }, (_, col) => ({
    key: `${row}-${col}`,
    symbol: seededPick(row, col),
    row,
    col,
  }))
).flat();

const USE_NATIVE = Platform.OS !== "web";

export default function SplashScreen() {
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading } = useAuth();

  const shift = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.82)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  // Diagonal doodle loop
  useEffect(() => {
    Animated.loop(
      Animated.timing(shift, {
        toValue: TILE,
        duration: 3200,
        easing: Easing.linear,
        useNativeDriver: USE_NATIVE,
      })
    ).start();
  }, [shift]);

  // Entry animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, {
        toValue: 1,
        damping: 14,
        stiffness: 120,
        useNativeDriver: USE_NATIVE,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 700,
        delay: 150,
        useNativeDriver: USE_NATIVE,
      }),
    ]).start();
  }, []);

  // Redirect authenticated users
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAuthenticated, isLoading]);

  // Show splash while loading — just disable the button
  const ready = !isLoading && !isAuthenticated;
  if (isAuthenticated) return null;

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={styles.root}>
      {/* === Animated doodle grid (diagonal) === */}
      <Animated.View
        style={[
          styles.doodleContainer,
          {
            transform: [{ translateX: shift }, { translateY: shift }],
            pointerEvents: "none",
          },
        ]}
      >
        {CELLS.map(({ key, symbol, row, col }) => (
          <Text
            key={key}
            style={[styles.doodle, { left: col * TILE - TILE, top: row * TILE - TILE }]}
          >
            {symbol}
          </Text>
        ))}
      </Animated.View>

      {/* === Decorative blobs === */}
      <View style={[styles.blobTopRight, { pointerEvents: "none" }]} />
      <View style={[styles.blobBottomLeft, { pointerEvents: "none" }]} />

      {/* === Content === */}
      <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
        {/* ---- Centred hero ---- */}
        <View style={styles.hero}>
          <Animated.View style={{ transform: [{ scale: logoScale }], marginBottom: 8 }}>
            <View style={styles.logoCard}>
              <Text style={styles.logoLetter}>K</Text>
            </View>
          </Animated.View>

          <Text style={styles.appName}>Kola</Text>

          <Text style={styles.tagline}>
            Tous les commerces et{"\n"}services près de chez vous.
          </Text>
        </View>

        {/* ---- Bottom actions ---- */}
        <View style={[styles.bottom, { paddingBottom: botPad + 24 }]}>
          <TouchableOpacity
            style={[styles.ctaBtn, !ready && { opacity: 0.6 }]}
            onPress={() => ready && router.push("/auth/country")}
            activeOpacity={0.88}
            disabled={!ready}
          >
            <Text style={styles.ctaText}>
              {isLoading ? "Chargement…" : "Commencer"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            En continuant, vous acceptez nos{" "}
            <Text style={styles.legalLink}>conditions d'utilisation</Text>
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    overflow: "hidden",
  },

  /* ---- Doodles ---- */
  doodleContainer: {
    position: "absolute",
    width: W + TILE * 3,
    height: H + TILE * 3,
    top: -TILE * 2,
    left: -TILE * 2,
  },
  doodle: {
    position: "absolute",
    fontSize: 18,
    color: DOODLE_COLOR,
    fontWeight: "300",
    lineHeight: TILE,
    width: TILE,
    textAlign: "center",
  },

  /* ---- Blobs ---- */
  blobTopRight: {
    position: "absolute",
    width: W * 0.78,
    height: W * 0.78,
    borderRadius: W * 0.39,
    backgroundColor: BG_DARK,
    top: -W * 0.22,
    right: -W * 0.22,
    opacity: 0.55,
  },
  blobBottomLeft: {
    position: "absolute",
    width: W * 0.52,
    height: W * 0.52,
    borderRadius: W * 0.26,
    backgroundColor: BG_DARK,
    bottom: -W * 0.18,
    left: -W * 0.18,
    opacity: 0.38,
  },

  /* ---- Main content ---- */
  content: {
    flex: 1,
    paddingHorizontal: 32,
  },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  bottom: {
    gap: 14,
    paddingTop: 8,
  },

  logoCard: {
    width: 96,
    height: 96,
    borderRadius: 24,
    backgroundColor: "#F5A623",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 14,
  },
  logoLetter: {
    fontSize: 54,
    fontWeight: "900",
    color: "#1C1917",
    letterSpacing: -2,
    lineHeight: 64,
  },

  appName: {
    fontSize: 50,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -1.5,
  },

  tagline: {
    fontSize: 17,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 26,
    fontWeight: "500",
  },

  ctaBtn: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    paddingVertical: 18,
    borderRadius: 100,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: "700",
    color: BG,
  },

  legal: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 18,
  },
  legalLink: {
    color: "rgba(255,255,255,0.9)",
    textDecorationLine: "underline",
  },
});
