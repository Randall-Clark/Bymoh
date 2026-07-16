import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

interface CardProps extends ViewProps {
  padding?: number;
  shadow?: boolean;
}

export function Card({ children, style, padding = 16, shadow = true, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        styles.card,
        shadow && styles.shadow,
        { padding },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
  },
  shadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
});
