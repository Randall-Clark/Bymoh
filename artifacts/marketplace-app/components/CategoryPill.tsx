import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  label: string;
  icon: string;
  selected?: boolean;
  onPress: () => void;
}

export default function CategoryPill({ label, icon, selected, onPress }: Props) {
  const colors = useColors();
  return (
    <TouchableOpacity
      style={[
        styles.pill,
        {
          backgroundColor: selected ? colors.primary : colors.card,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Feather name={icon as any} size={14} color={selected ? colors.primaryForeground : colors.mutedForeground} />
      <Text style={[styles.label, { color: selected ? colors.primaryForeground : colors.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    borderWidth: 1,
  },
  label: { fontSize: 13, fontWeight: "600" },
});
