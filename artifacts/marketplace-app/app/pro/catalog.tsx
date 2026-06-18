import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOCK_BUSINESSES, formatPrice } from "@/constants/mockData";
import { Service } from "@/constants/types";
import { useColors } from "@/hooks/useColors";

export default function ProCatalogScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState<Service[]>([...MOCK_BUSINESSES[0].services]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  const openAdd = () => {
    setEditingService(null);
    setTitle(""); setDescription(""); setPrice("");
    setModalVisible(true);
  };

  const openEdit = (s: Service) => {
    setEditingService(s);
    setTitle(s.title); setDescription(s.description); setPrice(String(s.price));
    setModalVisible(true);
  };

  const handleSave = () => {
    if (!title.trim() || !price.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (editingService) {
      setServices((prev) => prev.map((s) => s.id === editingService.id ? { ...s, title, description, price: Number(price) } : s));
    } else {
      const newService: Service = {
        id: "s" + Date.now().toString().slice(-6),
        title, description, price: Number(price), currency: "FCFA",
      };
      setServices((prev) => [...prev, newService]);
    }
    setModalVisible(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Supprimer", "Voulez-vous supprimer ce service ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => setServices((prev) => prev.filter((s) => s.id !== id)) },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
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

      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.list, { paddingBottom: botPad + 24 }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {services.length} service{services.length !== 1 ? "s" : ""}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="package" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Aucun service dans votre catalogue</Text>
            <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: colors.primary }]} onPress={openAdd}>
              <Text style={styles.emptyBtnText}>Ajouter un service</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.serviceTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.serviceDesc, { color: colors.mutedForeground }]} numberOfLines={2}>{item.description}</Text>
              <Text style={[styles.servicePrice, { color: colors.primary }]}>{formatPrice(item.price, item.currency)}</Text>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.muted }]} onPress={() => openEdit(item)}>
                <Feather name="edit-2" size={15} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.destructiveLight }]} onPress={() => handleDelete(item.id)}>
                <Feather name="trash-2" size={15} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView
          style={[styles.modal, { backgroundColor: colors.background }]}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Feather name="x" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingService ? "Modifier le service" : "Nouveau service"}
            </Text>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: title && price ? colors.primary : colors.muted }]}
              onPress={handleSave}
              disabled={!title || !price}
            >
              <Text style={[styles.saveBtnText, { color: title && price ? "#fff" : colors.mutedForeground }]}>
                Enregistrer
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Titre *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={title} onChangeText={setTitle}
                placeholder="Nom du service" placeholderTextColor={colors.mutedForeground}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={description} onChangeText={setDescription}
                placeholder="Décrivez votre service..." placeholderTextColor={colors.mutedForeground}
                multiline numberOfLines={4}
              />
            </View>
            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Prix (FCFA) *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
                value={price} onChangeText={setPrice}
                placeholder="5000" placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  count: { fontSize: 13, marginBottom: 12 },
  list: { paddingHorizontal: 20, paddingTop: 12, gap: 12 },
  card: { flexDirection: "row", alignItems: "flex-start", padding: 14, borderRadius: 14, borderWidth: 1, gap: 12 },
  serviceTitle: { fontSize: 15, fontWeight: "700" },
  serviceDesc: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  servicePrice: { fontSize: 14, fontWeight: "700", marginTop: 6 },
  cardActions: { gap: 8 },
  actionBtn: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: 12, paddingTop: 80 },
  emptyText: { fontSize: 15 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100, marginTop: 8 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  saveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 100 },
  saveBtnText: { fontSize: 13, fontWeight: "700" },
  modalContent: { padding: 20, gap: 16 },
  field: { gap: 8 },
  label: { fontSize: 14, fontWeight: "600" },
  input: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  textArea: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1, fontSize: 15, minHeight: 100 },
});
