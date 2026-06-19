import React, { useRef } from "react";
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";

interface PinFieldProps {
  value: string[];
  onChange: (digits: string[]) => void;
  error?: boolean;
  autoFocus?: boolean;
  length?: number;
}

export function PinField({ value, onChange, error = false, autoFocus = false, length = 6 }: PinFieldProps) {
  const colors = useColors();
  const inputRef = useRef<TextInput>(null);

  const handleChangeText = (text: string) => {
    const digits = text.replace(/\D/g, "").slice(0, length).split("");
    const next = Array(length).fill("").map((_, i) => digits[i] ?? "");
    onChange(next);
  };

  const filledCount = value.filter(Boolean).length;

  return (
    <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.container}>
      <TextInput
        ref={inputRef}
        value={value.join("")}
        onChangeText={handleChangeText}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={[
          styles.hiddenInput,
          Platform.OS === "web" ? { opacity: 0.01, position: "absolute", width: "100%", height: "100%", zIndex: 2 } : { position: "absolute", opacity: 0, width: 1, height: 1 },
        ]}
      />
      <View style={styles.boxes} pointerEvents="none">
        {Array.from({ length }).map((_, idx) => (
          <View
            key={idx}
            style={[
              styles.box,
              {
                backgroundColor: colors.card,
                borderColor: error
                  ? "#EF4444"
                  : idx === filledCount && autoFocus
                  ? colors.primary
                  : value[idx]
                  ? colors.primary
                  : colors.border,
                borderWidth: idx === filledCount ? 2 : 1.5,
              },
            ]}
          >
            <Text style={[styles.dot, { color: colors.text }]}>
              {value[idx] ? "●" : ""}
            </Text>
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: "stretch",
  },
  hiddenInput: {
    top: 0,
    left: 0,
  },
  boxes: {
    flexDirection: "row",
    gap: 10,
  },
  box: {
    width: 46,
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    fontSize: 22,
    fontWeight: "700",
  },
});
