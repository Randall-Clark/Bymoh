import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { Service } from "@/constants/types";
import { formatPrice } from "@/constants/mockData";

interface Props {
  service: Service;
  onAddToCart?: () => void;
  onBook?: () => void;
  inCart?: boolean;
}

export default function ServiceCard({ service, onAddToCart, onBook, inCart }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: colors.text }]}>{service.title}</Text>
        <Text style={[styles.desc, { color: colors.mutedForeground }]} numberOfLines={2}>
          {service.description}
        </Text>
        <Text style={[styles.price, { color: colors.primary }]}>{formatPrice(service.price, service.currency)}</Text>
      </View>
      <View style={styles.actions}>
        {onBook && (
          <TouchableOpacity style={[styles.btn, { backgroundColor: colors.secondary }]} onPress={onBook}>
            <Feather name="calendar" size={14} color={colors.secondaryForeground} />
          </TouchableOpacity>
        )}
        {onAddToCart && (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: inCart ? colors.success : colors.primary }]}
            onPress={onAddToCart}
          >
            <Feather name={inCart ? "check" : "plus"} size={14} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  left: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: "700" },
  desc: { fontSize: 12, lineHeight: 16 },
  price: { fontSize: 14, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8, alignItems: "center" },
  btn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
});
