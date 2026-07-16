import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface StepIndicatorProps {
  current: number;
  total: number;
  title: string;
}

export function StepIndicator({ current, total, title }: StepIndicatorProps) {
  const progress = current / total;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.step}>Étape {current}/{total}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>

      {/* Step dots */}
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => {
          const done = i + 1 < current;
          const active = i + 1 === current;
          return (
            <View
              key={i}
              style={[
                styles.dot,
                done && styles.dotDone,
                active && styles.dotActive,
              ]}
            >
              {done && <Feather name="check" size={10} color="#fff" />}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  header: { gap: 2 },
  step: { fontSize: 12, fontWeight: '600', color: '#FF6835', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { fontSize: 20, fontWeight: '800', color: '#111827' },
  track: {
    height: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#FF6835',
    borderRadius: 2,
  },
  dots: { flexDirection: 'row', gap: 8 },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: '#22C55E' },
  dotActive: { backgroundColor: '#FF6835', width: 28 },
});
