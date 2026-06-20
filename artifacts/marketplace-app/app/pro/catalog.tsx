import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBusinessCatalog,
  useCreateCatalogItem,
  useUpdateCatalogItem,
  useDeleteCatalogItem,
  getGetBusinessCatalogQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
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
  // Article only
  category?: string;      // free-text category for grouping
  unit?: string;          // e.g. "Unité", "kg", "m"
  stockQty?: number | null; // null = non géré
  showStock?: boolean;    // propriétaire choisit; auto-true si ≤ 5
  // Prestation only
  duration?: number;
  billingType?: BillingType;
  allowsBooking?: boolean;
};

type CatalogSection = {
  title: string;
  kind: "articles" | "prestations";
  data: CatalogItem[];
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

const UNIT_OPTIONS = [
  { label: "Unité", short: "unité" },
  { label: "Kilogramme", short: "kg" },
  { label: "Gramme", short: "g" },
  { label: "Mètre", short: "m" },
  { label: "Centimètre", short: "cm" },
  { label: "Litre", short: "L" },
  { label: "Paire", short: "paire" },
  { label: "Lot / Pack", short: "lot" },
  { label: "Carton", short: "carton" },
  { label: "Douzaine", short: "douzaine" },
  { label: "Sachet", short: "sachet" },
  { label: "Boîte", short: "boîte" },
];


/** Stock visible par le client : toujours vrai si ≤ 5, sinon selon la préférence du proprio */
function isStockVisibleToClient(item: CatalogItem): boolean {
  if (item.stockQty == null) return false;
  if (item.stockQty <= 5) return true;
  return !!item.showStock;
}

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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const businessId = user?.businessIds?.[0] ?? "";

  const [modalVisible, setModalVisible] = useState(false);
  const [kindSelectorVisible, setKindSelectorVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);

  // Form state
  const [formKind, setFormKind] = useState<ItemKind>("article");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [formPhoto, setFormPhoto] = useState<string | undefined>(undefined);
  // Article fields
  const [formCategory, setFormCategory] = useState("");
  const [formUnit, setFormUnit] = useState("Unité");
  const [formStockQty, setFormStockQty] = useState<string>("");
  const [formShowStock, setFormShowStock] = useState(false);
  // Prestation fields
  const [formDuration, setFormDuration] = useState(60);
  const [formBilling, setFormBilling] = useState<BillingType>("fixed");
  const [formAllowsBooking, setFormAllowsBooking] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  // ── API ──────────────────────────────────────────────────────────────────────
  const { data: apiItems = [], isLoading } = useGetBusinessCatalog(businessId, {
    query: { queryKey: getGetBusinessCatalogQueryKey(businessId), enabled: !!businessId },
  });

  const items: CatalogItem[] = apiItems.map((i) => ({
    id: i.id,
    kind: i.kind as ItemKind,
    title: i.title,
    description: i.description,
    price: i.price,
    currency: i.currency,
    photo: i.photo ?? undefined,
    category: i.category ?? undefined,
    unit: i.unit ?? undefined,
    stockQty: i.stockQty ?? null,
    showStock: i.showStock,
    duration: i.duration ?? undefined,
    billingType: (i.billingType as BillingType) ?? "fixed",
    allowsBooking: i.allowsBooking,
  }));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getGetBusinessCatalogQueryKey(businessId) });

  const createMutation = useCreateCatalogItem({
    mutation: { onSuccess: () => { invalidate(); setModalVisible(false); resetForm(); } },
  });
  const updateMutation = useUpdateCatalogItem({
    mutation: { onSuccess: () => { invalidate(); setModalVisible(false); resetForm(); } },
  });
  const deleteMutation = useDeleteCatalogItem({
    mutation: { onSuccess: invalidate },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormPrice(""); setFormPhoto(undefined);
    setFormCategory(""); setFormUnit("Unité"); setFormStockQty(""); setFormShowStock(false);
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
    setFormCategory(item.category ?? "");
    setFormUnit(item.unit ?? "Unité");
    setFormStockQty(item.stockQty != null ? String(item.stockQty) : "");
    setFormShowStock(item.showStock ?? false);
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
    if (!formTitle.trim() || !formPrice.trim() || !businessId || isSaving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const parsedStock = formStockQty.trim() !== "" ? Number(formStockQty) : null;
    const showStock = parsedStock != null && parsedStock <= 5 ? true : formShowStock;
    const payload =
      formKind === "article"
        ? {
            kind: "article" as const,
            title: formTitle.trim(),
            description: formDesc.trim(),
            price: Number(formPrice),
            currency: "FCFA",
            photo: formPhoto,
            category: formCategory.trim() || undefined,
            unit: formUnit,
            stockQty: parsedStock,
            showStock,
          }
        : {
            kind: "prestation" as const,
            title: formTitle.trim(),
            description: formDesc.trim(),
            price: Number(formPrice),
            currency: "FCFA",
            photo: formPhoto,
            duration: formDuration,
            billingType: formBilling,
            allowsBooking: formAllowsBooking,
          };
    if (editingItem) {
      updateMutation.mutate({ bizId: businessId, itemId: editingItem.id, data: payload });
    } else {
      createMutation.mutate({ businessId, data: payload });
    }
  };

  const handleDelete = (id: string) => {
    if (!businessId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteMutation.mutate({ bizId: businessId, itemId: id });
  };

  const articleCount = items.filter((i) => i.kind === "article").length;
  const prestationCount = items.filter((i) => i.kind === "prestation").length;

  // Unique existing categories (for quick-select chips in form)
  const existingCategories = Array.from(
    new Set(items.filter((i) => i.kind === "article" && i.category).map((i) => i.category as string))
  ).sort();

  if (!businessId) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <Feather name="briefcase" size={40} color={colors.mutedForeground} />
        <Text style={[styles.emptyTitle, { color: colors.text, marginTop: 12 }]}>Aucun business enregistré</Text>
        <Text style={[styles.emptyText, { color: colors.mutedForeground, textAlign: "center" }]}>
          Créez votre espace professionnel pour gérer votre catalogue.
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Build sections: articles grouped by category, then prestations
  const sections: CatalogSection[] = (() => {
    const articles = items.filter((i) => i.kind === "article");
    const prestations = items.filter((i) => i.kind === "prestation");
    const catMap = new Map<string, CatalogItem[]>();
    for (const a of articles) {
      const key = a.category?.trim() || "Autres";
      if (!catMap.has(key)) catMap.set(key, []);
      catMap.get(key)!.push(a);
    }
    const articleSections: CatalogSection[] = Array.from(catMap.entries())
      .sort(([a], [b]) => a === "Autres" ? 1 : b === "Autres" ? -1 : a.localeCompare(b, "fr"))
      .map(([title, data]) => ({ title, kind: "articles", data }));
    const result: CatalogSection[] = [...articleSections];
    if (prestations.length > 0) {
      result.push({ title: "Prestations", kind: "prestations", data: prestations });
    }
    return result;
  })();

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

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {sections.length === 0 ? (
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
        ) : sections.map((section) => (
          <View key={section.title}>
            {/* Section header */}
            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
              <View style={[styles.sectionHeaderLine, { backgroundColor: section.kind === "prestations" ? "#7C3AED" : colors.primary }]} />
              <View style={[styles.sectionHeaderBadge, { backgroundColor: section.kind === "prestations" ? "#EDE9FE" : colors.accent }]}>
                <Feather
                  name={section.kind === "prestations" ? "calendar" : "tag"}
                  size={12}
                  color={section.kind === "prestations" ? "#7C3AED" : colors.primary}
                />
                <Text style={[styles.sectionHeaderText, { color: section.kind === "prestations" ? "#7C3AED" : colors.primary }]}>
                  {section.title}
                </Text>
                <Text style={[styles.sectionHeaderCount, { color: section.kind === "prestations" ? "#7C3AED" : colors.primary }]}>
                  {section.data.length}
                </Text>
              </View>
            </View>
            {/* Items */}
            {section.data.map((item) => (
              <View key={item.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {item.photo ? (
                  <Image source={{ uri: item.photo }} style={styles.cardImg} contentFit="cover" />
                ) : (
                  <View style={[styles.cardImg, styles.cardImgPlaceholder, { backgroundColor: item.kind === "prestation" ? "#EDE9FE" : colors.muted }]}>
                    <Feather name={item.kind === "prestation" ? "calendar" : "package"} size={22} color={item.kind === "prestation" ? "#7C3AED" : colors.mutedForeground} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
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
                      {item.kind === "article" && item.unit && item.unit !== "Unité" ? ` / ${item.unit}` : ""}
                      {item.billingType === "hourly" ? "/h" : ""}
                    </Text>
                    {item.kind === "article" && item.unit && item.unit !== "Unité" && (
                      <View style={[styles.unitBadge, { backgroundColor: colors.muted }]}>
                        <Text style={[styles.unitText, { color: colors.mutedForeground }]}>/{item.unit}</Text>
                      </View>
                    )}
                    {item.kind === "article" && isStockVisibleToClient(item) && item.stockQty != null && (
                      <View style={[styles.stockBadge, { backgroundColor: item.stockQty <= 5 ? "#FEF3C7" : "#DCFCE7" }]}>
                        <Feather name="layers" size={11} color={item.stockQty <= 5 ? "#D97706" : "#16A34A"} />
                        <Text style={[styles.stockText, { color: item.stockQty <= 5 ? "#D97706" : "#16A34A" }]}>
                          {item.stockQty <= 5 ? `${item.stockQty} restant${item.stockQty > 1 ? "s" : ""}` : `En stock (${item.stockQty})`}
                        </Text>
                      </View>
                    )}
                    {item.kind === "article" && item.stockQty != null && !isStockVisibleToClient(item) && (
                      <View style={[styles.stockBadge, { backgroundColor: colors.muted }]}>
                        <Feather name="eye-off" size={11} color={colors.mutedForeground} />
                        <Text style={[styles.stockText, { color: colors.mutedForeground }]}>{item.stockQty} (masqué)</Text>
                      </View>
                    )}
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
            ))}
          </View>
        ))}
      </ScrollView>

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
          <View style={[styles.modalHeader, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
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
              style={[styles.saveBtn, { backgroundColor: formTitle && formPrice && !isSaving ? colors.primary : colors.muted }]}
              onPress={handleSave}
              disabled={!formTitle || !formPrice || isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.saveBtnText, { color: formTitle && formPrice ? "#fff" : colors.mutedForeground }]}>
                  Enregistrer
                </Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                Prix (FCFA) *
                {formKind === "article" && formUnit !== "Unité" ? ` — par ${formUnit}` : ""}
                {formKind === "prestation" && formBilling === "hourly" ? " — à l'heure" : ""}
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

            {/* ── Article-only fields ── */}
            {formKind === "article" && (
              <>
                {/* Category */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Catégorie</Text>
                  {existingCategories.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                      {existingCategories.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.unitChip, {
                            backgroundColor: formCategory === cat ? colors.primary : colors.card,
                            borderColor: formCategory === cat ? colors.primary : colors.border,
                          }]}
                          onPress={() => setFormCategory(formCategory === cat ? "" : cat)}
                        >
                          <Text style={[styles.unitChipText, { color: formCategory === cat ? "#fff" : colors.text }]}>
                            {cat}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                    value={formCategory}
                    onChangeText={setFormCategory}
                    placeholder='Ex : Plats, Boissons, Snacks… (optionnel)'
                    placeholderTextColor={colors.mutedForeground}
                  />
                </View>

                {/* Unit of sale */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Unité de vente</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                    {UNIT_OPTIONS.map((u) => (
                      <TouchableOpacity
                        key={u.label}
                        style={[styles.unitChip, {
                          backgroundColor: formUnit === u.label ? colors.primary : colors.card,
                          borderColor: formUnit === u.label ? colors.primary : colors.border,
                        }]}
                        onPress={() => setFormUnit(u.label)}
                      >
                        <Text style={[styles.unitChipText, { color: formUnit === u.label ? "#fff" : colors.text }]}>
                          {u.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Stock quantity */}
                <View style={styles.field}>
                  <Text style={[styles.label, { color: colors.text }]}>Quantité en stock</Text>
                  <View style={styles.stockInputRow}>
                    <TextInput
                      style={[styles.stockInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                      value={formStockQty}
                      onChangeText={setFormStockQty}
                      placeholder="Laisser vide si non géré"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                    />
                    {formStockQty !== "" && (
                      <TouchableOpacity
                        style={[styles.stockClearBtn, { backgroundColor: colors.muted }]}
                        onPress={() => setFormStockQty("")}
                      >
                        <Feather name="x" size={14} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {formStockQty !== "" && Number(formStockQty) <= 5 && (
                    <View style={[styles.stockAutoAlert, { backgroundColor: "#FEF3C7" }]}>
                      <Feather name="alert-triangle" size={13} color="#D97706" />
                      <Text style={[styles.stockAutoText, { color: "#D97706" }]}>
                        Stock ≤ 5 : affiché automatiquement aux clients comme "dernières unités"
                      </Text>
                    </View>
                  )}
                </View>

                {/* Show stock toggle — only if stock > 5 */}
                {formStockQty !== "" && Number(formStockQty) > 5 && (
                  <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <View style={[styles.toggleIcon, { backgroundColor: formShowStock ? "#DCFCE7" : colors.muted }]}>
                      <Feather name={formShowStock ? "eye" : "eye-off"} size={16} color={formShowStock ? "#16A34A" : colors.mutedForeground} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.toggleTitle, { color: colors.text }]}>Afficher le stock aux clients</Text>
                      <Text style={[styles.toggleSub, { color: colors.mutedForeground }]}>
                        {formShowStock ? "Les clients voient la quantité disponible" : "Le stock reste masqué pour les clients"}
                      </Text>
                    </View>
                    <Switch
                      value={formShowStock}
                      onValueChange={setFormShowStock}
                      trackColor={{ false: colors.border, true: "#86EFAC" }}
                      thumbColor={formShowStock ? "#16A34A" : colors.mutedForeground}
                    />
                  </View>
                )}
              </>
            )}

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
    paddingHorizontal: 20, paddingBottom: 8, borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  addBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },

  statRow: { flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 6 },
  statPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  statText: { fontSize: 11, fontWeight: "700" },

  list: { paddingHorizontal: 20, paddingTop: 0 },


  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 4, paddingBottom: 6 },
  sectionHeaderLine: { width: 4, height: 20, borderRadius: 2 },
  sectionHeaderBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  sectionHeaderText: { fontSize: 13, fontWeight: "800", letterSpacing: 0.2 },
  sectionHeaderCount: { fontSize: 12, fontWeight: "600", opacity: 0.7 },
  card: {
    flexDirection: "row", alignItems: "flex-start",
    borderRadius: 16, borderWidth: 1, overflow: "hidden", gap: 12, padding: 10,
    marginBottom: 12,
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

  // Unit of sale
  unitBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  unitText: { fontSize: 11, fontWeight: "600" },
  chipsRow: { gap: 8, paddingVertical: 2 },
  unitChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 100, borderWidth: 1.5 },
  unitChipText: { fontSize: 13, fontWeight: "600" },

  // Stock
  stockBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  stockText: { fontSize: 11, fontWeight: "600" },
  stockInputRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stockInput: { flex: 1, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  stockClearBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  stockAutoAlert: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 10, borderRadius: 10, marginTop: 2 },
  stockAutoText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "500" },

  // Show-stock toggle row
  toggleRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  toggleIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  toggleTitle: { fontSize: 14, fontWeight: "700" },
  toggleSub: { fontSize: 12, marginTop: 2 },
});
