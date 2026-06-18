import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props {
  current: number;
  total: number;
  labels?: string[];
}

export default function StepProgress({ current, total, labels }: Props) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      <View style={styles.bar}>
        {Array.from({ length: total }).map((_, i) => (
          <React.Fragment key={i}>
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: i < current ? colors.primary : i === current ? colors.primary : colors.border,
                  borderWidth: i === current ? 2 : 0,
                  borderColor: colors.primary,
                  opacity: i > current ? 0.4 : 1,
                },
              ]}
            />
            {i < total - 1 && (
              <View style={[styles.line, { backgroundColor: i < current ? colors.primary : colors.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>
      {labels && (
        <Text style={[styles.label, { color: colors.mutedForeground }]}>
          Étape {current + 1} sur {total}: {labels[current]}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8, alignItems: "center" },
  bar: { flexDirection: "row", alignItems: "center" },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: { flex: 1, height: 2, minWidth: 20 },
  label: { fontSize: 12 },
});
