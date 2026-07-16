import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

const PRIMARY = '#FF6835';
const ERROR = '#EF4444';

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'secondary';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  style,
  fullWidth = false,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && { alignSelf: 'stretch' },
        (isDisabled || pressed) && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? PRIMARY : '#fff'}
          size="small"
        />
      ) : (
        <Text style={[styles.label, styles[`label_${variant}`], styles[`label_${size}`]]}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 100,
    flexDirection: 'row',
    gap: 8,
  },
  pressed: { opacity: 0.75 },

  // Variants
  primary: { backgroundColor: PRIMARY },
  outline: { borderWidth: 1.5, borderColor: PRIMARY, backgroundColor: 'transparent' },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: ERROR },
  secondary: { backgroundColor: '#1E3A5F' },

  // Sizes
  sm: { paddingVertical: 10, paddingHorizontal: 18 },
  md: { paddingVertical: 15, paddingHorizontal: 24 },
  lg: { paddingVertical: 18, paddingHorizontal: 32 },

  // Labels
  label: { fontWeight: '700' },
  label_primary: { color: '#fff' },
  label_outline: { color: PRIMARY },
  label_ghost: { color: PRIMARY },
  label_danger: { color: '#fff' },
  label_secondary: { color: '#fff' },

  label_sm: { fontSize: 13 },
  label_md: { fontSize: 15 },
  label_lg: { fontSize: 17 },
});
