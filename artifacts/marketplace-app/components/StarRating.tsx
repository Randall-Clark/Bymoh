import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, View } from "react-native";

interface Props {
  rating: number;
  size?: number;
  max?: number;
}

export default function StarRating({ rating, size = 14, max = 5 }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: max }).map((_, i) => (
        <Feather
          key={i}
          name={i < Math.round(rating) ? "star" : "star"}
          size={size}
          color={i < Math.round(rating) ? "#F59E0B" : "#D1D5DB"}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 1 },
});
