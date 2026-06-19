import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import EmptyState from "@/components/EmptyState";
import ServiceCard from "@/components/ServiceCard";
import StarRating from "@/components/StarRating";
import { MOCK_BUSINESSES, formatPrice } from "@/constants/mockData";
import { Service } from "@/constants/types";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { useColors } from "@/hooks/useColors";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

export default function BusinessDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, toggleFavorite } = useAuth();
  const { addItem, items } = useCart();
  const [activeTab, setActiveTab] = useState<"services" | "horaires" | "infos">("services");

  const business = MOCK_BUSINESSES.find((b) => b.id === id);
  const isFav = user?.favoriteIds.includes(id ?? "") ?? false;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const botPad = Platform.OS === "web" ? 34 : insets.bottom;

  if (!business) {
    return <EmptyState icon="alert-circle" title="Business introuvable" />;
  }

  const cartCount = items.reduce((s, i) => s + i.quantity, 0);

  const handleFav = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (id) toggleFavorite(id);
  };

  const handleAddToCart = (service: Service) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    addItem(service, business.id, business.name);
  };

  const getBookingMode = (category: string): "table" | "service" => {
    const lower = category.toLowerCase();
    if (lower.includes("restaurant") || lower.includes("café") || lower.includes("cafe") || lower.includes("bar") || lower.includes("brasserie")) {
      return "table";
    }
    return "service";
  };

  const bookingMode = getBookingMode(business.category);

  const handleBookTable = () => {
    router.push({ pathname: "/booking/new", params: { businessId: business.id, bookingMode: "table" } });
  };

  const handleBook = (service: Service) => {
    router.push({ pathname: "/booking/new", params: { businessId: business.id, serviceId: service.id, bookingMode } });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header image area */}
      <View style={[styles.banner, { backgroundColor: colors.muted }]}>
        <View style={styles.bannerInner}>
          <Feather name={business.categoryIcon as any} size={56} color={colors.primary} />
        </View>
        <View style={[styles.bannerOverlay, { paddingTop: topPad }]}>
          <TouchableOpacity style={[styles.backBtn, { backgroundColor: colors.card }]} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.bannerActions}>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]} onPress={handleFav}>
              <Feather name="heart" size={18} color={isFav ? colors.primary : colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, { backgroundColor: colors.card }]}>
              <Feather name="share-2" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: botPad + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Business Info */}
        <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
          <View style={styles.nameRow}>
            <Text style={[styles.businessName, { color: colors.text }]}>{business.name}</Text>
            {business.isVerified && <Feather name="check-circle" size={18} color={colors.primary} />}
          </View>
          <View style={styles.metaRow}>
            <View style={[styles.statusChip, { backgroundColor: business.isOpen ? colors.successLight : colors.muted }]}>
              <View style={[styles.statusDot, { backgroundColor: business.isOpen ? colors.success : colors.mutedForeground }]} />
              <Text style={[styles.statusText, { color: business.isOpen ? colors.success : colors.mutedForeground }]}>
                {business.isOpen ? `Ouvert · jusqu'à ${business.closeHour}` : `Fermé · ouvre à ${business.openHour}`}
              </Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <StarRating rating={business.rating} size={14} />
              <Text style={[styles.statLabel, { color: colors.text }]}>{business.rating} ({business.reviewCount})</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.statItem}>
              <Feather name="map-pin" size={14} color={colors.mutedForeground} />
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{business.distance}</Text>
            </View>
            {business.hasDelivery && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <View style={styles.statItem}>
                  <Feather name="package" size={14} color={colors.primary} />
                  <Text style={[styles.statLabel, { color: colors.primary }]}>Livraison</Text>
                </View>
              </>
            )}
          </View>
          <Text style={[styles.desc, { color: colors.mutedForeground }]}>{business.description}</Text>
          <View style={styles.contactRow}>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.muted }]}>
              <Feather name="phone" size={16} color={colors.text} />
              <Text style={[styles.contactLabel, { color: colors.text }]}>Appeler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.contactBtn, { backgroundColor: colors.muted }]}>
              <Feather name="map-pin" size={16} color={colors.text} />
              <Text style={[styles.contactLabel, { color: colors.text }]}>Itinéraire</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {(["services", "horaires", "infos"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary }]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabLabel, { color: activeTab === tab ? colors.primary : colors.mutedForeground }]}>
                {tab === "services" ? "Services" : tab === "horaires" ? "Horaires" : "Infos"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "services" && (
          <View style={styles.tabContent}>
            {bookingMode === "table" && (
              <TouchableOpacity
                style={[styles.tableReservationBtn, { backgroundColor: colors.secondary }]}
                onPress={handleBookTable}
                activeOpacity={0.85}
              >
                <Feather name="calendar" size={20} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.tableReservationTitle}>Réserver une table</Text>
                  <Text style={styles.tableReservationSub}>Choisissez la date, l'heure et le nombre de convives</Text>
                </View>
                <Feather name="arrow-right" size={18} color="#fff" />
              </TouchableOpacity>
            )}
            {business.services.map((s) => (
              <ServiceCard
                key={s.id}
                service={s}
                onAddToCart={() => handleAddToCart(s)}
                onBook={bookingMode === "service" ? () => handleBook(s) : undefined}
                inCart={items.some((i) => i.service.id === s.id)}
              />
            ))}
          </View>
        )}

        {activeTab === "horaires" && (
          <View style={[styles.tabContent, { backgroundColor: colors.card, borderRadius: 16 }]}>
            {DAYS.map((day) => {
              const h = business.openingHours?.[day];
              return (
                <View key={day} style={[styles.hourRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.dayLabel, { color: colors.text }]}>{day}</Text>
                  <Text style={[styles.hourLabel, { color: h?.closed ? colors.mutedForeground : colors.text }]}>
                    {h?.closed ? "Fermé" : h ? `${h.open} – ${h.close}` : "–"}
                  </Text>
                </View>
              );
            })}
          </View>
        )}

        {activeTab === "infos" && (
          <View style={[styles.tabContent, { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 16 }]}>
            <View style={styles.infoRow}>
              <Feather name="map-pin" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Adresse</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{business.address}, {business.city}</Text>
              </View>
            </View>
            <View style={styles.infoRow}>
              <Feather name="phone" size={16} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Téléphone</Text>
                <Text style={[styles.infoValue, { color: colors.text }]}>{business.phone}</Text>
              </View>
            </View>
            {business.email && (
              <View style={styles.infoRow}>
                <Feather name="mail" size={16} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>Email</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>{business.email}</Text>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom CTA */}
      {cartCount > 0 && (
        <View style={[styles.cartBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: botPad + 8 }]}>
          <View>
            <Text style={[styles.cartLabel, { color: colors.mutedForeground }]}>{cartCount} article{cartCount > 1 ? "s" : ""}</Text>
            <Text style={[styles.cartTotal, { color: colors.text }]}>
              {formatPrice(items.reduce((s, i) => s + i.service.price * i.quantity, 0))}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.cartBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/cart")}
          >
            <Feather name="shopping-cart" size={16} color="#fff" />
            <Text style={styles.cartBtnText}>Voir le panier</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  banner: { height: 200, alignItems: "center", justifyContent: "center" },
  bannerInner: { alignItems: "center", justifyContent: "center" },
  bannerOverlay: { position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 8 },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  bannerActions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  scroll: { padding: 16, gap: 14 },
  infoCard: { borderRadius: 20, padding: 16, gap: 12 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  businessName: { fontSize: 22, fontWeight: "800", flex: 1 },
  metaRow: { flexDirection: "row" },
  statusChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 100 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  statusText: { fontSize: 12, fontWeight: "600" },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  statLabel: { fontSize: 12 },
  divider: { width: 1, height: 16 },
  desc: { fontSize: 14, lineHeight: 20 },
  contactRow: { flexDirection: "row", gap: 10 },
  contactBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 12 },
  contactLabel: { fontSize: 14, fontWeight: "600" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel: { fontSize: 14, fontWeight: "600" },
  tabContent: { gap: 10 },
  tableReservationBtn: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16 },
  tableReservationTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  tableReservationSub: { fontSize: 12, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  hourRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  dayLabel: { fontSize: 14, fontWeight: "600" },
  hourLabel: { fontSize: 14 },
  infoRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 14, fontWeight: "500", marginTop: 2 },
  cartBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1 },
  cartLabel: { fontSize: 12 },
  cartTotal: { fontSize: 16, fontWeight: "700" },
  cartBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100 },
  cartBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
});
