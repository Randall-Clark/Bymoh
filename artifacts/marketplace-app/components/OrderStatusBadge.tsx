import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

type Status = "pending" | "confirmed" | "completed" | "cancelled" | "in_delivery";

const LABELS: Record<Status, string> = {
  pending: "En attente",
  confirmed: "Confirmé",
  completed: "Terminé",
  cancelled: "Annulé",
  in_delivery: "En livraison",
};

export default function OrderStatusBadge({ status }: { status: Status }) {
  const colors = useColors();
  const bg =
    status === "confirmed" ? colors.successLight :
    status === "completed" ? colors.muted :
    status === "cancelled" ? colors.destructiveLight :
    status === "in_delivery" ? colors.warningLight :
    colors.accentForeground + "20";
  const fg =
    status === "confirmed" ? colors.success :
    status === "completed" ? colors.mutedForeground :
    status === "cancelled" ? colors.destructive :
    status === "in_delivery" ? colors.warning :
    colors.primary;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{LABELS[status]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 100 },
  text: { fontSize: 11, fontWeight: "700" },
});
