import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
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

// ─── Types ─────────────────────────────────────────────────────────────────────

type ItemKind = "article" | "prestation";
type BillingType = "fixed" | "hourly";

type CatalogItem = {
  id: string;
  kind: ItemKind;
  title: string;
  description: string;
  price: number;
  currency: string;
  photo?: string;
  // Prestation only
  duration?: number; // minutes
  billingType?: BillingType;
  allowsBooking?: boolean;
};

const DURATION_OPTIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 h", value: 60 },
  { label: "1h30", value: 90 },
  { label: "2 h", value: 120 },
  { label: "3 h", value: 180 },
  { label: "Journée", value: 480 },
];

const INITIAL_ITEMS: CatalogItem[] = [
  { id: "1", kind: "article", title: "Produit exemple", description: "Un article disponible à la vente.", price: 5000, currency: "FCFA" },
  { id: "2", kind: "prestation", title: "Prestation exemple", description: "Une prestation sur rendez-vous.", price: 15000, currency: "FCFA", duration: 60, billingType: "fixed", allowsBooking: true },
];

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString("fr-FR")} ${currency}`;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function ProCatalogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<CatalogItem[]>(INITIAL_ITEMS);
  const [modalVisible, setModalVisible] = useState(false);
  const [kindSelectorVisible, setKindSelectorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  // Form state
  const [formKind, setFormKind] = useState<ItemKind>("article");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formPhoto, setFormPhoto] = useState<string | undefined>(undefined);
  const [formDuration, setFormDuration] = useState(60);
  const [formBilling, setFormBilling] = useState<BillingType>("fixed");
  const [formAllowsBooking, setFormAllowsBooking] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormPrice(""); setFormPhoto(undefined);
    setFormDuration(60); setFormBilling("fixed"); setFormAllowsBooking(true);
    setEditingItem(null);
  };

  const openAdd = () => {
    resetForm();
    setKindSelectorVisible(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditingItem(item);
    setFormKind(item.kind);
    setFormTitle(item.title);
    setFormDesc(item.description);
    setFormPrice(String(item.price));
    setFormPhoto(item.photo);
    setFormDuration(item.duration ?? 60);
    setFormBilling(item.billingType ?? "fixed");
    setFormAllowsBooking(item.allowsBooking ?? true);
    setModalVisible(true);
  };

  const pickPhoto = async () => {
    if ((Platform.OS as string) !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.75,
    });
    if (!result.canceled && result.assets[0]) {
      setFormPhoto(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    if (!formTitle.trim() || !formPrice.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const base: CatalogItem = {
      id: editingItem?.id ?? "i" + Date.now().toString().slice(-6),
      kind: formKind,
      title: formTitle.trim(),
      description: formDesc.trim(),
      price: Number(formPrice),
      currency: "FCFA",
      photo: formPhoto,
    };
    if (formKind === "prestation") {
      base.duration = formDuration;
      base.billingType = formBilling;
      base.allowsBooking = formAllowsBooking;
    }
    if (editingItem) {
      setItems((prev) => prev.map((i) => i.id === editingItem.id ? base : i));
    } else {
      setItems((prev) => [...prev, base]);
    }
    setModalVisible(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const articleCount = items.filter((i) => i.kind === "article").length;
  const prestationCount = items.filter((i) => i.kind === "prestation").length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Mon catalogue</Text>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={openAdd}
        >
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats pills */}
      <View style={styles.statRow}>
        <View style={[styles.statPill, { backgroundColor: colors.accent }]}>
          <Feather name="package" size={13} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.primary }]}>{articleCount} article{articleCount !== 1 ? "s" : ""}</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: "#EDE9FE" }]}>
          <Feather name="calendar" size={13} color="#7C3AED" />
          <Text style={[styles.statText, { color: "#7C3AED" }]}>{prestationCount} prestation{prestationCount !== 1 ? "s" : ""}</Text>
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="layers" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Catalogue vide</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Ajoutez vos articles à vendre ou vos prestations de service.
            </Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
              <Feather name="plus" size={16} color="#fff" />
              <Text style={styles.emptyBtnText}>Ajouter un élément</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {item.photo ? (
              <Image source={{ uri: item.photo }} style={styles.cardImg} contentFit="cover" />
            ) : (
              <View style={[styles.cardImg, styles.cardImgPlaceholder, { backgroundColor: item.kind === "prestation" ? "#EDE9FE" : colors.muted }]}>
                <Feather name={item.kind === "prestation" ? "calendar" : "package"} size={22} color={item.kind === "prestation" ? "#7C3AED" : colors.mutedForeground} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              {/* Kind badge */}
              <View style={[styles.kindBadge, { backgroundColor: item.kind === "prestation" ? "#EDE9FE" : colors.accent }]}>
                <Text style={[styles.kindBadgeText, { color: item.kind === "prestation" ? "#7C3AED" : colors.primary }]}>
                  {item.kind === "prestation" ? "Prestation" : "Article"}
                </Text>
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
              {item.description ? (
                <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
              ) : null}
              <View style={styles.cardFooter}>
                <Text style={[styles.cardPrice, { color: colors.primary }]}>
                  {formatPrice(item.price, item.currency)}
                  {item.billingType === "hourly" ? "/h" : ""}
                </Text>
                {item.kind === "prestation" && item.duration && (
                  <View style={[styles.durationBadge, { backgroundColor: colors.muted }]}>
                    <Feather name="clock" size={11} color={colors.mutedForeground} />
                    <Text style={[styles.durationText, { color: colors.mutedForeground }]}>
                      {formatDuration(item.duration)}
                    </Text>
                  </View>
                )}
                {item.allowsBooking && (
                  <View style={[styles.bookingBadge, { backgroundColor: "#DCFCE7" }]}>
                    <Feather name="check-circle" size={11} color="#16A34A" />
                    <Text style={[styles.bookingText, { color: "#16A34A" }]}>RDV</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]} onPress={() => openEdit(item)}>
                <Feather name="edit-2" size={15} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]} onPress={() => handleDelete(item.id)}>
                <Feather name="trash-2" size={15} color="#DC2626" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* ── Kind Selector Modal ── */}
      <Modal visible={kindSelectorVisible} transparent animationType="fade">
        <View style={styles.overlay}>
          <View style={[styles.kindSheet, { backgroundColor: colors.card }]}>
            <Text style={[styles.kindSheetTitle, { color: colors.text }]}>Que voulez-vous ajouter ?</Text>
            <Text style={[styles.kindSheetSub, { color: colors.mutedForeground }]}>
              Choisissez le type d'élément à créer dans votre catalogue.
            </Text>
            <View style={styles.kindChoices}>
              <TouchableOpacity
                style={[styles.kindChoice, { backgroundColor: colors.accent, borderColor: colors.primary }]}
                onPress={() => { setFormKind("article"); setKindSelectorVisible(false); setModalVisible(true); }}
                activeOpacity={0.85}
              >
                <View style={[styles.kindChoiceIcon, { backgroundColor: colors.primary }]}>
                  <Feather name="package" size={24} color="#fff" />
                </View>
                <Text style={[styles.kindChoiceLabel, { color: colors.text }]}>Article</Text>
                <Text style={[styles.kindChoiceDesc, { color: colors.mutedForeground }]}>
                  Produit à vendre avec un prix unitaire
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.kindChoice, { backgroundColor: "#F5F3FF", borderColor: "#7C3AED" }]}
                onPress={() => { setFormKind("prestation"); setKindSelectorVisible(false); setModalVisible(true); }}
                activeOpacity={0.85}
              >
                <View style={[styles.kindChoiceIcon, { backgroundColor: "#7C3AED" }]}>
                  <Feather name="calendar" size={24} color="#fff" />
                </View>
                <Text style={[styles.kindChoiceLabel, { color: colors.text }]}>Prestation</Text>
                <Text style={[styles.kindChoiceDesc, { color: colors.mutedForeground }]}>
                  Service avec durée, tarif et prise de rendez-vous
                </Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.kindCancelBtn, { borderColor: colors.border }]}
              onPress={() => setKindSelectorVisible(false)}
            >
              <Text style={[styles.kindCancelText, { color: colors.text }]}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Add/Edit Modal ── */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[styles.modal, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Modal header */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Feather name="x" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.modalTitleRow}>
              <View style={[styles.modalKindBadge, { backgroundColor: formKind === "prestation" ? "#EDE9FE" : colors.accent }]}>
                <Feather name={formKind === "prestation" ? "calendar" : "package"} size={13} color={formKind === "prestation" ? "#7C3AED" : colors.primary} />
                <Text style={[styles.modalKindLabel, { color: formKind === "prestation" ? "#7C3AED" : colors.primary }]}>
                  {formKind === "prestation" ? "Prestation" : "Article"}
                </Text>
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingItem ? "Modifier" : "Ajouter"}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: formTitle && formPrice ? colors.primary : colors.muted }]}
              onPress={handleSave}
              disabled={!formTitle || !formPrice}
            >
              <Text style={[styles.saveBtnText, { color: formTitle && formPrice ? "#fff" : colors.mutedForeground }]}>
                Enregistrer
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Photo */}
            <TouchableOpacity
              style={[styles.photoPicker, { backgroundColor: colors.muted, borderColor: colors.border }]}
              onPress={pickPhoto}
              activeOpacity={0.85}
            >
              {formPhoto ? (
                <>
                  <Image source={{ uri: formPhoto }} style={styles.photoFill} contentFit="cover" />
                  <View style={styles.photoOverlay}>
                    <Feather name="camera" size={15} color="#fff" />
                    <Text style={styles.photoOverlayText}>Changer</Text>
                  </View>
                </>
              ) : (
                <View style={styles.photoEmpty}>
                  <Feather name="camera" size={24} color={colors.primary} />
                  <Text style={[styles.photoEmptyText, { color: colors.mutedForeground }]}>Ajouter une photo</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Title */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>
                {formKind === "prestation" ? "Nom de la prestation *" : "Nom de l'article *"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={formTitle}
                onChangeText={setFormTitle}
                placeholder={formKind === "prestation" ? "Ex : Coupe + brushing" : "Ex : Sac en cuir"}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={formDesc}
                onChangeText={setFormDesc}
                placeholder="Décrivez votre élément..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={3}
              />
            </View>

            {/* Price */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>
                Prix (FCFA) *{formKind === "prestation" && formBilling === "hourly" ? " — à l'heure" : ""}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={formPrice}
                onChangeText={setFormPrice}
                placeholder="Ex : 5000"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
            </View>

            {/* Prestation-only fields */}
            {formKind === "prestation" && (
              <>
                {/* Duration */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Durée de la prestation</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.durationRow}>
                    {DURATION_OPTIONS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.durationChip, {
                          backgroundColor: formDuration === opt.value ? colors.primary : colors.card,
                          borderColor: formDuration === opt.value ? colors.primary : colors.border,
                        }]}
                        onPress={() => setFormDuration(opt.value)}
                      >
                        <Text style={[styles.durationChipText, { color: formDuration === opt.value ? "#fff" : colors.text }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Billing type */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Mode de facturation</Text>
                  <View style={styles.billingRow}>
                    <TouchableOpacity
                      style={[styles.billingOption, {
                        backgroundColor: formBilling === "fixed" ? colors.accent : colors.card,
                        borderColor: formBilling === "fixed" ? colors.primary : colors.border,
                      }]}
                      onPress={() => setFormBilling("fixed")}
                    >
                      <Feather name="tag" size={16} color={formBilling === "fixed" ? colors.primary : colors.mutedForeground} />
                      <View>
                        <Text style={[styles.billingLabel, { color: colors.text }]}>Forfait</Text>
                        <Text style={[styles.billingDesc, { color: colors.mutedForeground }]}>Prix fixe par prestation</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.billingOption, {
                        backgroundColor: formBilling === "hourly" ? colors.accent : colors.card,
                        borderColor: formBilling === "hourly" ? colors.primary : colors.border,
                      }]}
                      onPress={() => setFormBilling("hourly")}
                    >
                      <Feather name="clock" size={16} color={formBilling === "hourly" ? colors.primary : colors.mutedForeground} />
                      <View>
                        <Text style={[styles.billingLabel, { color: colors.text }]}>À l'heure</Text>
                        <Text style={[styles.billingDesc, { color: colors.mutedForeground }]}>Tarif horaire</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Allows booking */}
                <View style={[styles.bookingRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.bookingIcon, { backgroundColor: formAllowsBooking ? "#DCFCE7" : colors.muted }]}>
                    <Feather name="calendar" size={18} color={formAllowsBooking ? "#16A34A" : colors.mutedForeground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.bookingTitle, { color: colors.text }]}>Prise de rendez-vous</Text>
                    <Text style={[styles.bookingSubtitle, { color: colors.mutedForeground }]}>
                      Les clients peuvent réserver un créneau en ligne
                    </Text>
                  </View>
                  <Switch
                    value={formAllowsBooking}
                    onValueChange={setFormAllowsBooking}
                    trackColor={{ false: colors.border, true: "#86EFAC" }}
                    thumbColor={formAllowsBooking ? "#16A34A" : colors.mutedForeground}
                  />
                </View>
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  statRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 12 },
  statPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100 },
  statText: { fontSize: 12, fontWeight: "700" },

  list: { paddingHorizontal: 20, paddingTop: 4, gap: 12 },
  card: {
    flexDirection: "row", alignItems: "flex-start",
    borderRadius: 16, borderWidth: 1, overflow: "hidden", gap: 12, padding: 10,
  },
  cardImg: { width: 72, height: 72, borderRadius: 10 },
  cardImgPlaceholder: { alignItems: "center", justifyContent: "center" },
  kindBadge: {
    alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 100, marginBottom: 4,
  },
  kindBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  cardTitle: { fontSize: 14, fontWeight: "700" },
  cardDesc: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  cardPrice: { fontSize: 13, fontWeight: "800" },
  durationBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  durationText: { fontSize: 11 },
  bookingBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  bookingText: { fontSize: 11, fontWeight: "600" },
  cardActions: { gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  empty: { alignItems: "center", gap: 12, paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },

  // Kind selector
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  kindSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 16 },
  kindSheetTitle: { fontSize: 20, fontWeight: "800" },
  kindSheetSub: { fontSize: 14, lineHeight: 20 },
  kindChoices: { gap: 12 },
  kindChoice: {
    borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 10, alignItems: "center",
  },
  kindChoiceIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  kindChoiceLabel: { fontSize: 17, fontWeight: "800" },
  kindChoiceDesc: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  kindCancelBtn: {
    paddingVertical: 14, borderRadius: 100, alignItems: "center", borderWidth: 1,
  },
  kindCancelText: { fontSize: 15, fontWeight: "600" },

  // Add/Edit modal
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1,
  },
  modalTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalKindBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 100 },
  modalKindLabel: { fontSize: 11, fontWeight: "700" },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  saveBtnText: { fontSize: 13, fontWeight: "700" },
  modalContent: { padding: 20, gap: 18 },

  photoPicker: {
    height: 160, borderRadius: 14, borderWidth: 1,
    overflow: "hidden", alignItems: "center", justifyContent: "center",
  },
  photoFill: { width: "100%", height: "100%" },
  photoEmpty: { alignItems: "center", gap: 8 },
  photoEmptyText: { fontSize: 13 },
  photoOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)", flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8,
  },
  photoOverlayText: { color: "#fff", fontSize: 12, fontWeight: "600" },

  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  textArea: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15, minHeight: 100, textAlignVertical: "top" },

  durationRow: { gap: 8, paddingVertical: 2 },
  durationChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 100, borderWidth: 1.5 },
  durationChipText: { fontSize: 13, fontWeight: "600" },

  billingRow: { gap: 10 },
  billingOption: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1.5,
  },
  billingLabel: { fontSize: 14, fontWeight: "700" },
  billingDesc: { fontSize: 12, marginTop: 1 },

  bookingRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  bookingIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  bookingTitle: { fontSize: 14, fontWeight: "700" },
  bookingSubtitle: { fontSize: 12, marginTop: 2 },
});
