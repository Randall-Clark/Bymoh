import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
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

type PromoType = "percent" | "fixed" | "bundle";
type PromoStatus = "active" | "scheduled" | "expired";

interface Promo {
  id: string;
  title: string;
  description: string;
  type: PromoType;
  value: number;
  minOrder?: number;
  startDate: string;
  endDate: string;
  active: boolean;
  usageCount: number;
  usageLimit?: number;
}

const INITIAL_PROMOS: Promo[] = [
  {
    id: "p1",
    title: "Happy Hour midi",
    description: "Réduction sur tous les plats entre 12h et 14h",
    type: "percent",
    value: 15,
    startDate: "2026-06-01",
    endDate: "2026-07-31",
    active: true,
    usageCount: 43,
    usageLimit: 200,
  },
  {
    id: "p2",
    title: "Première commande",
    description: "Offre de bienvenue pour les nouveaux clients Bymoh",
    type: "fixed",
    value: 500,
    minOrder: 2000,
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    active: true,
    usageCount: 12,
  },
  {
    id: "p3",
    title: "Duo week-end",
    description: "2 prestations achetées = la 3e à moitié prix",
    type: "bundle",
    value: 50,
    startDate: "2026-06-20",
    endDate: "2026-06-30",
    active: false,
    usageCount: 0,
  },
];

function promoStatus(p: Promo): PromoStatus {
  if (!p.active) return "expired";
  const now = new Date();
  const start = new Date(p.startDate);
  const end = new Date(p.endDate);
  if (now < start) return "scheduled";
  if (now > end) return "expired";
  return "active";
}

function formatValue(p: Promo): string {
  if (p.type === "percent") return `-${p.value} %`;
  if (p.type === "fixed") return `-${p.value.toLocaleString("fr-FR")} FCFA`;
  return `Bundle ${p.value} %`;
}

function formatDate(s: string): string {
  return new Date(s).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const TYPE_OPTIONS: { key: PromoType; label: string; icon: string; desc: string }[] = [
  { key: "percent", label: "Pourcentage", icon: "percent", desc: "Ex : -15 % sur la commande" },
  { key: "fixed",   label: "Montant fixe", icon: "tag",     desc: "Ex : -500 FCFA déduits" },
  { key: "bundle",  label: "Offre groupée", icon: "gift",   desc: "Ex : 2 achetés = 3e à moitié" },
];

export default function ProPromotionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const [promos, setPromos] = useState<Promo[]>(INITIAL_PROMOS);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promo | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState<PromoType>("percent");
  const [formValue, setFormValue] = useState("");
  const [formMinOrder, setFormMinOrder] = useState("");
  const [formStart, setFormStart] = useState("2026-07-01");
  const [formEnd, setFormEnd] = useState("2026-07-31");

  const resetForm = () => {
    setFormTitle(""); setFormDesc(""); setFormType("percent");
    setFormValue(""); setFormMinOrder("");
    setFormStart("2026-07-01"); setFormEnd("2026-07-31");
    setEditingPromo(null);
  };

  const openAdd = () => { resetForm(); setModalVisible(true); };

  const openEdit = (p: Promo) => {
    setEditingPromo(p);
    setFormTitle(p.title); setFormDesc(p.description);
    setFormType(p.type); setFormValue(String(p.value));
    setFormMinOrder(p.minOrder ? String(p.minOrder) : "");
    setFormStart(p.startDate); setFormEnd(p.endDate);
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!formTitle.trim() || !formValue.trim()) return;
    const base: Promo = {
      id: editingPromo?.id ?? `p_${Date.now()}`,
      title: formTitle.trim(),
      description: formDesc.trim(),
      type: formType,
      value: parseFloat(formValue) || 0,
      minOrder: formMinOrder ? parseFloat(formMinOrder) : undefined,
      startDate: formStart,
      endDate: formEnd,
      active: editingPromo?.active ?? true,
      usageCount: editingPromo?.usageCount ?? 0,
    };
    if (editingPromo) {
      setPromos((prev) => prev.map((p) => p.id === editingPromo.id ? base : p));
    } else {
      setPromos((prev) => [base, ...prev]);
    }
    setModalVisible(false);
    resetForm();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const toggleActive = (id: string) => {
    Haptics.selectionAsync();
    setPromos((prev) => prev.map((p) => p.id === id ? { ...p, active: !p.active } : p));
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setPromos((prev) => prev.filter((p) => p.id !== id));
  };

  const activeCount = promos.filter((p) => promoStatus(p) === "active").length;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Feather name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Offres & Promotions</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
          <Feather name="plus" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
        <View style={[styles.statPill, { backgroundColor: "#D1FAE5" }]}>
          <Feather name="zap" size={13} color="#059669" />
          <Text style={[styles.statText, { color: "#059669" }]}>{activeCount} active{activeCount !== 1 ? "s" : ""}</Text>
        </View>
        <View style={[styles.statPill, { backgroundColor: colors.accent }]}>
          <Feather name="gift" size={13} color={colors.primary} />
          <Text style={[styles.statText, { color: colors.primary }]}>{promos.length} offre{promos.length !== 1 ? "s" : ""} au total</Text>
        </View>
      </View>

      {promos.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="gift" size={44} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aucune promotion</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Créez des offres pour attirer plus de clients et fidéliser votre clientèle.
          </Text>
          <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
            <Feather name="plus" size={16} color="#fff" />
            <Text style={styles.emptyBtnText}>Créer une promotion</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={promos}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: p }) => {
            const status = promoStatus(p);
            const statusColors = {
              active:    { bg: "#D1FAE5", text: "#059669", label: "Active" },
              scheduled: { bg: "#EFF6FF", text: "#2563EB", label: "Programmée" },
              expired:   { bg: "#F3F4F6", text: "#6B7280", label: "Expirée" },
            }[status];

            return (
              <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {/* Top row */}
                <View style={styles.cardTop}>
                  <View style={[styles.promoTypeIcon, {
                    backgroundColor: p.type === "percent" ? "#FEF3C7" : p.type === "fixed" ? "#EDE9FE" : "#FEE2E2",
                  }]}>
                    <Feather
                      name={p.type === "percent" ? "percent" : p.type === "fixed" ? "tag" : "gift"}
                      size={16}
                      color={p.type === "percent" ? "#D97706" : p.type === "fixed" ? "#7C3AED" : "#DC2626"}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.promoTitle, { color: colors.text }]}>{p.title}</Text>
                    <Text style={[styles.promoDesc, { color: colors.mutedForeground }]} numberOfLines={1}>{p.description}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}>
                    <Text style={[styles.statusText, { color: statusColors.text }]}>{statusColors.label}</Text>
                  </View>
                </View>

                {/* Value + dates */}
                <View style={styles.promoMeta}>
                  <View style={[styles.valueBadge, { backgroundColor: colors.primary + "18" }]}>
                    <Text style={[styles.valueText, { color: colors.primary }]}>{formatValue(p)}</Text>
                  </View>
                  {p.minOrder && (
                    <Text style={[styles.minOrder, { color: colors.mutedForeground }]}>
                      Commande min. {p.minOrder.toLocaleString("fr-FR")} FCFA
                    </Text>
                  )}
                </View>

                <View style={styles.datesRow}>
                  <Feather name="calendar" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.datesText, { color: colors.mutedForeground }]}>
                    {formatDate(p.startDate)} → {formatDate(p.endDate)}
                  </Text>
                </View>

                {/* Usage bar */}
                {p.usageLimit && (
                  <View style={styles.usageWrap}>
                    <View style={[styles.usageTrack, { backgroundColor: colors.muted }]}>
                      <View style={[styles.usageFill, { backgroundColor: colors.primary, width: `${Math.min(100, (p.usageCount / p.usageLimit) * 100)}%` as any }]} />
                    </View>
                    <Text style={[styles.usageText, { color: colors.mutedForeground }]}>
                      {p.usageCount}/{p.usageLimit} utilisations
                    </Text>
                  </View>
                )}

                {/* Actions */}
                <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
                  <View style={styles.toggleWrap}>
                    <Text style={[styles.toggleLabel, { color: colors.mutedForeground }]}>
                      {p.active ? "Active" : "Désactivée"}
                    </Text>
                    <Switch
                      value={p.active}
                      onValueChange={() => toggleActive(p.id)}
                      trackColor={{ false: colors.muted, true: colors.primary + "60" }}
                      thumbColor={p.active ? colors.primary : "#ccc"}
                    />
                  </View>
                  <View style={styles.actionBtns}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: colors.muted }]}
                      onPress={() => openEdit(p)}
                    >
                      <Feather name="edit-2" size={14} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}
                      onPress={() => handleDelete(p.id)}
                    >
                      <Feather name="trash-2" size={14} color="#DC2626" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Add/Edit Modal */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={[styles.modal, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => { setModalVisible(false); resetForm(); }}>
              <Text style={[styles.modalCancel, { color: colors.mutedForeground }]}>Annuler</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingPromo ? "Modifier l'offre" : "Nouvelle promotion"}
            </Text>
            <TouchableOpacity
              style={[styles.modalSave, { backgroundColor: formTitle.trim() && formValue.trim() ? colors.primary : colors.muted }]}
              onPress={handleSave}
              disabled={!formTitle.trim() || !formValue.trim()}
            >
              <Text style={[styles.modalSaveText, { color: formTitle.trim() && formValue.trim() ? "#fff" : colors.mutedForeground }]}>
                {editingPromo ? "Enregistrer" : "Créer"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalInner} showsVerticalScrollIndicator={false}>
            {/* Type selector */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Type de promotion</Text>
              <View style={styles.typeRow}>
                {TYPE_OPTIONS.map((t) => {
                  const active = formType === t.key;
                  return (
                    <TouchableOpacity
                      key={t.key}
                      style={[styles.typeChip, {
                        backgroundColor: active ? colors.accent : colors.card,
                        borderColor: active ? colors.primary : colors.border,
                        borderWidth: active ? 2 : 1,
                        flex: 1,
                      }]}
                      onPress={() => { setFormType(t.key); Haptics.selectionAsync(); }}
                    >
                      <Feather name={t.icon as any} size={16} color={active ? colors.primary : colors.mutedForeground} />
                      <Text style={[styles.typeChipLabel, { color: active ? colors.primary : colors.text }]}>{t.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>
                {TYPE_OPTIONS.find((t) => t.key === formType)?.desc}
              </Text>
            </View>

            {/* Title */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Titre de l'offre</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                placeholder="Ex : Happy Hour midi -15 %"
                placeholderTextColor={colors.mutedForeground}
                value={formTitle}
                onChangeText={setFormTitle}
              />
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Description (optionnel)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                placeholder="Décrivez votre offre..."
                placeholderTextColor={colors.mutedForeground}
                value={formDesc}
                onChangeText={setFormDesc}
              />
            </View>

            {/* Value */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>
                {formType === "percent" ? "Pourcentage de réduction (%)" : formType === "fixed" ? "Montant déduit (FCFA)" : "Réduction sur le 3e article (%)"}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                placeholder={formType === "fixed" ? "500" : "15"}
                placeholderTextColor={colors.mutedForeground}
                value={formValue}
                onChangeText={setFormValue}
                keyboardType="numeric"
              />
            </View>

            {/* Min order (fixed) */}
            {formType === "fixed" && (
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Commande minimum (FCFA, optionnel)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="2000"
                  placeholderTextColor={colors.mutedForeground}
                  value={formMinOrder}
                  onChangeText={setFormMinOrder}
                  keyboardType="numeric"
                />
              </View>
            )}

            {/* Dates */}
            <View style={styles.datesFields}>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.text }]}>Début (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="2026-07-01"
                  placeholderTextColor={colors.mutedForeground}
                  value={formStart}
                  onChangeText={setFormStart}
                />
              </View>
              <View style={[styles.field, { flex: 1 }]}>
                <Text style={[styles.label, { color: colors.text }]}>Fin (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                  placeholder="2026-07-31"
                  placeholderTextColor={colors.mutedForeground}
                  value={formEnd}
                  onChangeText={setFormEnd}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  statPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  statText: { fontSize: 12, fontWeight: "700" },

  list: { padding: 16, gap: 14 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16, gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  promoTypeIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  promoTitle: { fontSize: 15, fontWeight: "800" },
  promoDesc: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 100, flexShrink: 0 },
  statusText: { fontSize: 11, fontWeight: "700" },

  promoMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  valueBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  valueText: { fontSize: 14, fontWeight: "800" },
  minOrder: { fontSize: 12 },

  datesRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  datesText: { fontSize: 12 },

  usageWrap: { gap: 4 },
  usageTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  usageFill: { height: "100%", borderRadius: 2 },
  usageText: { fontSize: 11 },

  cardActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  toggleWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggleLabel: { fontSize: 12 },
  actionBtns: { flexDirection: "row", gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },

  empty: { flex: 1, alignItems: "center", gap: 12, paddingTop: 80, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },

  modal: { flex: 1 },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  modalCancel: { fontSize: 15 },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  modalSave: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 100 },
  modalSaveText: { fontSize: 13, fontWeight: "700" },
  modalContent: { flex: 1 },
  modalInner: { padding: 20, gap: 18 },

  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  fieldHint: { fontSize: 12 },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  typeRow: { flexDirection: "row", gap: 8 },
  typeChip: { padding: 10, borderRadius: 12, alignItems: "center", gap: 4 },
  typeChipLabel: { fontSize: 11, fontWeight: "600", textAlign: "center" },
  datesFields: { flexDirection: "row", gap: 12 },
});
