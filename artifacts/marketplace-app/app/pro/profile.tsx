import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const CATEGORIES = [
  "Alimentation / Épicerie",
  "Restauration / Café",
  "Mode & Vêtements",
  "Beauté & Bien-être",
  "Santé & Pharmacie",
  "Électronique & Tech",
  "Maison & Décoration",
  "Sport & Loisirs",
  "Artisanat & Création",
  "Services & Prestations",
  "Transport & Livraison",
  "Autre",
];

export default function ProBusinessProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // Form state (mocked with initial values)
  const [name, setName] = useState("Ma Boutique");
  const [phone, setPhone] = useState("+228 90 00 00 00");
  const [whatsapp, setWhatsapp] = useState("+228 90 00 00 00");
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [address, setAddress] = useState("Adakpamé, Lomé");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Mode & Vêtements");
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [banner, setBanner] = useState<string | undefined>(undefined);
  const [requiresPrepayment, setRequiresPrepayment] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const pickImage = async (
    aspect: [number, number],
    setter: (uri: string) => void
  ) => {
    if ((Platform.OS as string) !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setter(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      Alert.alert("Profil mis à jour", "Les informations de votre business ont été enregistrées.");
    }, 900);
  };

  const effectiveWhatsapp = sameAsPhone ? phone : whatsapp;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profil business</Text>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={isSaving}
        >
          <Text style={styles.saveBtnText}>{isSaving ? "..." : "Enregistrer"}</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: botPad + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Banner ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Image de bannière</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Affichée en haut de votre page business (format large)
            </Text>
            <TouchableOpacity
              style={[styles.bannerPicker, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={() => pickImage([16, 9], setBanner)}
              activeOpacity={0.85}
            >
              {banner ? (
                <>
                  <Image source={{ uri: banner }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  <View style={styles.photoOverlay}>
                    <Feather name="camera" size={15} color="#fff" />
                    <Text style={styles.photoOverlayText}>Changer la bannière</Text>
                  </View>
                </>
              ) : (
                <View style={styles.pickerEmpty}>
                  <Feather name="image" size={28} color={colors.mutedForeground} />
                  <Text style={[styles.pickerEmptyText, { color: colors.mutedForeground }]}>
                    Ajouter une bannière
                  </Text>
                  <Text style={[styles.pickerEmptyHint, { color: colors.mutedForeground }]}>
                    Format recommandé : 1200 × 400 px
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ── Logo ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Logo</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Photo principale de votre business (carré, fond clair conseillé)
            </Text>
            <View style={styles.logoRow}>
              <TouchableOpacity
                style={[styles.logoPicker, { backgroundColor: colors.muted, borderColor: colors.border }]}
                onPress={() => pickImage([1, 1], setLogo)}
                activeOpacity={0.85}
              >
                {logo ? (
                  <>
                    <Image source={{ uri: logo }} style={[StyleSheet.absoluteFill, { borderRadius: 20 }]} contentFit="cover" />
                    <View style={styles.logoOverlay}>
                      <Feather name="camera" size={14} color="#fff" />
                    </View>
                  </>
                ) : (
                  <View style={styles.logoEmpty}>
                    <Feather name="camera" size={26} color={colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.logoHint, { color: colors.text }]}>
                  {logo ? "Logo ajouté ✓" : "Aucun logo défini"}
                </Text>
                <Text style={[styles.logoHintSub, { color: colors.mutedForeground }]}>
                  Format recommandé : 400 × 400 px · PNG ou JPG
                </Text>
              </View>
            </View>
          </View>

          {/* ── Info générales ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Informations générales</Text>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Nom du business *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={name}
                onChangeText={setName}
                placeholder="Ex : Boutique Awa"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Catégorie d'activité</Text>
              <TouchableOpacity
                style={[styles.selector, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowCategoryPicker(!showCategoryPicker)}
              >
                <Text style={[styles.selectorText, { color: colors.text }]}>{category}</Text>
                <Feather name={showCategoryPicker ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={[styles.categoryList, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryItem, { borderBottomColor: colors.border, backgroundColor: category === cat ? colors.accent : "transparent" }]}
                      onPress={() => { setCategory(cat); setShowCategoryPicker(false); }}
                    >
                      <Text style={[styles.categoryItemText, { color: category === cat ? colors.primary : colors.text }]}>
                        {cat}
                      </Text>
                      {category === cat && <Feather name="check" size={15} color={colors.primary} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={description}
                onChangeText={setDescription}
                placeholder="Décrivez votre activité, vos spécialités..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Adresse / Quartier</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={address}
                onChangeText={setAddress}
                placeholder="Ex : Tokoin, Lomé"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          {/* ── Contact ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact</Text>

            <View style={styles.field}>
              <View style={styles.labelRow}>
                <Feather name="phone" size={14} color={colors.mutedForeground} />
                <Text style={[styles.label, { color: colors.text }]}>Numéro de téléphone</Text>
              </View>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="+228 90 00 00 00"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />
            </View>

            {/* WhatsApp same as phone toggle */}
            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.toggleIcon, { backgroundColor: "#DCFCE7" }]}>
                <Feather name="message-circle" size={16} color="#16A34A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>WhatsApp = même numéro</Text>
                <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
                  {sameAsPhone ? phone : "Numéro différent"}
                </Text>
              </View>
              <Switch
                value={sameAsPhone}
                onValueChange={setSameAsPhone}
                trackColor={{ false: colors.border, true: "#86EFAC" }}
                thumbColor={sameAsPhone ? "#16A34A" : colors.mutedForeground}
              />
            </View>

            {!sameAsPhone && (
              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <Feather name="message-circle" size={14} color="#16A34A" />
                  <Text style={[styles.label, { color: colors.text }]}>Numéro WhatsApp</Text>
                </View>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                  placeholder="+228 90 00 00 00"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                />
              </View>
            )}
          </View>

          {/* ── Politique de réservation ── */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Politique de réservation</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Définissez comment vos clients règlent leurs réservations
            </Text>

            <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.toggleIcon, { backgroundColor: "#DBEAFE" }]}>
                <Feather name="smartphone" size={16} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.toggleTitle, { color: colors.text }]}>Exiger le prépaiement en ligne</Text>
                <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
                  {requiresPrepayment
                    ? "Le client doit payer en ligne (Mobile Money) pour réserver"
                    : "Le client peut payer en ligne ou sur place"}
                </Text>
              </View>
              <Switch
                value={requiresPrepayment}
                onValueChange={setRequiresPrepayment}
                trackColor={{ false: colors.border, true: "#93C5FD" }}
                thumbColor={requiresPrepayment ? "#2563EB" : colors.mutedForeground}
              />
            </View>

            <View style={[styles.escrowBox, { backgroundColor: "#F0FDF4", borderColor: "#BBF7D0" }]}>
              <Feather name="lock" size={14} color="#16A34A" />
              <Text style={[styles.escrowText, { color: "#15803D" }]}>
                <Text style={{ fontWeight: "700" }}>Escrow Bymoh : </Text>
                Tous les paiements en ligne sont retenus par Bymoh et versés sur votre wallet 24h après la prestation accomplie.
              </Text>
            </View>

            {!requiresPrepayment && (
              <View style={[styles.infoBox, { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" }]}>
                <Feather name="info" size={14} color="#EA580C" />
                <Text style={[styles.infoBoxText, { color: "#C2410C" }]}>
                  Sans prépaiement obligatoire, vos clients peuvent réserver et payer sur place. Votre business sera visible dans le filtre "Sans prépaiement" des clients.
                </Text>
              </View>
            )}
          </View>

          {/* ── Info recap ── */}
          <View style={[styles.infoBox, { backgroundColor: colors.accent, borderColor: colors.primary + "30" }]}>
            <Feather name="info" size={15} color={colors.primary} />
            <Text style={[styles.infoBoxText, { color: colors.primary }]}>
              Ces informations sont visibles par les clients sur votre page publique Bymoh.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 100 },
  saveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  content: { paddingHorizontal: 20, paddingTop: 20, gap: 28 },

  section: { gap: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionSub: { fontSize: 13, lineHeight: 18, marginTop: -6 },

  bannerPicker: {
    height: 150, borderRadius: 16, borderWidth: 1,
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  pickerEmpty: { alignItems: "center", gap: 8 },
  pickerEmptyText: { fontSize: 14, fontWeight: "600" },
  pickerEmptyHint: { fontSize: 12 },
  photoOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.5)", flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10,
  },
  photoOverlayText: { color: "#fff", fontSize: 13, fontWeight: "600" },

  logoRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  logoPicker: { width: 88, height: 88, borderRadius: 20, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  logoEmpty: { alignItems: "center", justifyContent: "center" },
  logoOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", paddingVertical: 6,
  },
  logoHint: { fontSize: 14, fontWeight: "600" },
  logoHintSub: { fontSize: 12, marginTop: 4, lineHeight: 16 },

  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  textArea: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, fontSize: 15, minHeight: 110, textAlignVertical: "top",
  },

  selector: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, borderWidth: 1,
  },
  selectorText: { fontSize: 15 },
  categoryList: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  categoryItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  categoryItemText: { fontSize: 14 },

  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  toggleIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  toggleTitle: { fontSize: 14, fontWeight: "700" },
  toggleSub: { fontSize: 12, marginTop: 2 },

  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  infoBoxText: { flex: 1, fontSize: 13, lineHeight: 18, fontWeight: "500" },
  escrowBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 14, borderRadius: 12, borderWidth: 1,
  },
  escrowText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
