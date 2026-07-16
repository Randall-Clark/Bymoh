import React, { useRef } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
} from 'react-native';

interface OTPInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  secureTextEntry?: boolean;
  loading?: boolean;
}

export function OTPInput({
  length = 6,
  value,
  onChange,
  onComplete,
  secureTextEntry = false,
  loading = false,
}: OTPInputProps) {
  const refs = useRef<Array<TextInput | null>>([]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, '').slice(-1);
    const chars = value.padEnd(length, '').split('');
    chars[index] = digit;
    const updated = chars.join('').slice(0, length);
    onChange(updated);

    if (digit && index < length - 1) {
      refs.current[index + 1]?.focus();
    }

    const filled = updated.replace(/\s/g, '');
    if (filled.length === length && onComplete) {
      onComplete(filled);
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === 'Backspace') {
      if (!value[index] && index > 0) {
        refs.current[index - 1]?.focus();
        const chars = value.split('');
        chars[index - 1] = '';
        onChange(chars.join(''));
      }
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }, (_, i) => (
        <TextInput
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          style={[styles.box, value[i] ? styles.boxFilled : undefined, loading && styles.boxDisabled]}
          value={value[i] ?? ''}
          onChangeText={(text) => handleChange(text, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          secureTextEntry={secureTextEntry}
          textContentType={secureTextEntry ? 'password' : 'oneTimeCode'}
          autoComplete={secureTextEntry ? 'off' : 'sms-otp'}
          editable={!loading}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, justifyContent: 'center' },
  box: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    textAlign: 'center',
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  boxFilled: { borderColor: '#FF6835', backgroundColor: '#FEF2EC' },
  boxDisabled: { opacity: 0.5 },
});
