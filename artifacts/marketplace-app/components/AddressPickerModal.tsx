import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ALL_CITIES } from "@/constants/cities";
import { useLocation } from "@/context/LocationContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AddressPickerModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { address, saveAddress, requestGPS, isLoadingGPS } = useLocation();

  const [quartier, setQuartier] = useState(address?.quartier ?? "");
  const [selectedCity, setSelectedCity] = useState(address?.city ?? "Lomé");
  const [citySearch, setCitySearch] = useState("");

  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const handleGPS = async () => {
    const result = await requestGPS();
    if (result === "granted") {
      onClose();
    } else if (result === "denied") {
      Alert.alert(
        "Localisation refusée",
        "Activez la localisation dans les paramètres de votre appareil pour utiliser cette fonctionnalité.",
      );
    } else {
      Alert.alert("Erreur", "Impossible de récupérer votre position. Réessayez.");
    }
  };

  const handleSave = async () => {
    const q = quartier.trim();
    const label = q ? `${q}, ${selectedCity}` : selectedCity;
    await saveAddress({ label, quartier: q || undefined, city: selectedCity });
    onClose();
  };

  const filteredCities = citySearch
    ? ALL_CITIES.filter(
        (c) =>
          c.name.toLowerCase().includes(citySearch.toLowerCase()) ||
          c.country.toLowerCase().includes(citySearch.toLowerCase()),
      )
    : ALL_CITIES;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: botPad + 16 }]}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>Adresse de livraison</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                Recevez des recommandations près de vous
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Current address display */}
          {address && (
            <View style={[styles.currentAddrBadge, { backgroundColor: colors.accent, borderColor: colors.primary + "40" }]}>
              <Feather name="map-pin" size={14} color={colors.primary} />
              <Text style={[styles.currentAddrText, { color: colors.primary }]} numberOfLines={1}>
                {address.isGPS ? "📡 " : ""}{address.label}
              </Text>
            </View>
          )}

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 20 }}>
            {/* GPS button */}
            <TouchableOpacity
              style={[styles.gpsBtn, { backgroundColor: colors.primary, opacity: isLoadingGPS ? 0.7 : 1 }]}
              onPress={handleGPS}
              disabled={isLoadingGPS}
              activeOpacity={0.85}
            >
              {isLoadingGPS ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="navigation" size={18} color="#fff" />
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.gpsBtnLabel}>
                  {isLoadingGPS ? "Localisation en cours..." : "Utiliser ma position actuelle"}
                </Text>
                <Text style={styles.gpsBtnSub}>GPS · Précis et rapide</Text>
              </View>
              {!isLoadingGPS && <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />}
            </TouchableOpacity>

            <View style={[styles.dividerRow, { borderColor: colors.border }]}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground, backgroundColor: colors.card }]}>
                ou entrer manuellement
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            {/* Quartier input */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Quartier / Rue (optionnel)</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Feather name="home" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={quartier}
                  onChangeText={setQuartier}
                  placeholder="Ex : Adidogomé, Tokoin Hédzranawoé..."
                  placeholderTextColor={colors.mutedForeground}
                />
                {quartier.length > 0 && (
                  <TouchableOpacity onPress={() => setQuartier("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* City search */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Ville</Text>
              <View style={[styles.inputWrap, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Feather name="search" size={16} color={colors.mutedForeground} />
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  value={citySearch}
                  onChangeText={setCitySearch}
                  placeholder="Rechercher une ville..."
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cityRow}>
                {filteredCities.map((c) => {
                  const active = selectedCity === c.name;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.cityChip, {
                        backgroundColor: active ? colors.primary : colors.background,
                        borderColor: active ? colors.primary : colors.border,
                      }]}
                      onPress={() => { setSelectedCity(c.name); setCitySearch(""); }}
                    >
                      <Text style={styles.cityFlag}>{c.flag}</Text>
                      <View>
                        <Text style={[styles.cityName, { color: active ? "#fff" : colors.text }]}>{c.name}</Text>
                        <Text style={[styles.cityCountry, { color: active ? "rgba(255,255,255,0.75)" : colors.mutedForeground }]}>
                          {c.country}
                        </Text>
                      </View>
                      {active && <Feather name="check" size={12} color="#fff" style={{ marginLeft: 2 }} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Save button */}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Feather name="check" size={18} color="#fff" />
            <Text style={styles.saveBtnText}>Enregistrer l'adresse</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24,
    gap: 16, maxHeight: "90%",
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.14, shadowRadius: 20, elevation: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 4 },

  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 3 },
  subtitle: { fontSize: 13 },

  currentAddrBadge: {
    flexDirection: "row", alignItems: "center", gap: 7,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1,
  },
  currentAddrText: { fontSize: 13, fontWeight: "600", flex: 1 },

  gpsBtn: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 18, paddingVertical: 16, borderRadius: 18,
  },
  gpsBtnLabel: { color: "#fff", fontSize: 15, fontWeight: "700" },
  gpsBtnSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontWeight: "500", paddingHorizontal: 4 },

  fieldGroup: { gap: 10 },
  fieldLabel: { fontSize: 14, fontWeight: "700" },
  inputWrap: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: 14, borderWidth: 1.5,
  },
  input: { flex: 1, fontSize: 14 },

  cityRow: { gap: 8, paddingVertical: 4 },
  cityChip: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, borderWidth: 1.5,
  },
  cityFlag: { fontSize: 18 },
  cityName: { fontSize: 13, fontWeight: "700" },
  cityCountry: { fontSize: 11, marginTop: 1 },

  saveBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    paddingVertical: 16, borderRadius: 16, marginTop: 4,
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
