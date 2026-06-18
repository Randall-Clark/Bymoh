import { Feather } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Business } from "@/constants/types";
import { formatPrice } from "@/constants/mockData";
import StarRating from "./StarRating";

interface Props {
  business: Business;
  onPress: () => void;
  isFavorite?: boolean;
  onFavoriteToggle?: () => void;
  style?: object;
}

export default function BusinessCard({ business, onPress, isFavorite, onFavoriteToggle, style }: Props) {
  const colors = useColors();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[styles.imageContainer, { backgroundColor: colors.muted }]}>
        <View style={[styles.imagePlaceholder, { backgroundColor: colors.muted }]}>
          <Feather name={business.categoryIcon as any} size={36} color={colors.primary} />
        </View>
        <View style={[styles.statusBadge, { backgroundColor: business.isOpen ? colors.success : colors.mutedForeground }]}>
          <Text style={styles.statusText}>{business.isOpen ? "Ouvert" : "Fermé"}</Text>
        </View>
        {onFavoriteToggle && (
          <TouchableOpacity
            style={[styles.favBtn, { backgroundColor: colors.card }]}
            onPress={onFavoriteToggle}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Feather name="heart" size={16} color={isFavorite ? colors.primary : colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.content}>
        <View style={styles.row}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>{business.name}</Text>
          {business.isVerified && (
            <Feather name="check-circle" size={14} color={colors.primary} style={{ marginLeft: 4 }} />
          )}
        </View>
        <Text style={[styles.category, { color: colors.mutedForeground }]}>{business.city} · {business.category}</Text>
        <View style={styles.meta}>
          <StarRating rating={business.rating} size={12} />
          <Text style={[styles.rating, { color: colors.mutedForeground }]}>
            {business.rating} ({business.reviewCount})
          </Text>
        </View>
        <View style={styles.footer}>
          <View style={styles.infoRow}>
            <Feather name="map-pin" size={12} color={colors.mutedForeground} />
            <Text style={[styles.infoText, { color: colors.mutedForeground }]}>{business.distance}</Text>
          </View>
          {business.hasDelivery && (
            <View style={[styles.deliveryBadge, { backgroundColor: colors.accent }]}>
              <Feather name="package" size={10} color={colors.primary} />
              <Text style={[styles.deliveryText, { color: colors.primary }]}>Livraison</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  imagePlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  statusBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  favBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  content: {
    padding: 12,
    gap: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    flex: 1,
  },
  category: {
    fontSize: 12,
    textTransform: "capitalize",
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  rating: {
    fontSize: 11,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  infoText: {
    fontSize: 11,
  },
  deliveryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
  },
  deliveryText: {
    fontSize: 10,
    fontWeight: "600",
  },
});
