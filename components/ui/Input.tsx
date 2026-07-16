import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { Feather } from '@expo/vector-icons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ComponentProps<typeof Feather>['name'];
  rightIcon?: React.ComponentProps<typeof Feather>['name'];
  onRightIconPress?: () => void;
  secured?: boolean;
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secured,
  style,
  ...rest
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.container,
          focused && styles.focused,
          !!error && styles.errored,
        ]}
      >
        {leftIcon && (
          <Feather name={leftIcon} size={18} color={focused ? '#FF6835' : '#9CA3AF'} style={styles.leftIcon} />
        )}
        <TextInput
          {...rest}
          secureTextEntry={secured && !showPassword}
          style={[styles.input, style]}
          placeholderTextColor="#9CA3AF"
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
        />
        {secured ? (
          <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.rightIcon}>
            <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#9CA3AF" />
          </Pressable>
        ) : rightIcon ? (
          <Pressable onPress={onRightIconPress} style={styles.rightIcon}>
            <Feather name={rightIcon} size={18} color="#9CA3AF" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151' },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    minHeight: 52,
  },
  focused: { borderColor: '#FF6835' },
  errored: { borderColor: '#EF4444' },
  leftIcon: { marginRight: 10 },
  rightIcon: { marginLeft: 10, padding: 4 },
  input: { flex: 1, fontSize: 15, color: '#111827', paddingVertical: 12 },
  error: { fontSize: 12, color: '#EF4444', marginTop: 2 },
  hint: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
});
