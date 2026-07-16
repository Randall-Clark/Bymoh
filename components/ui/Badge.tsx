import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type BadgeVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'primary'
  | 'open'
  | 'closed'
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled'
  | 'active'
  | 'suspended'
  | 'completed';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

const COLORS: Record<BadgeVariant, { bg: string; text: string }> = {
  success: { bg: '#D1FAE5', text: '#059669' },
  error: { bg: '#FEE2E2', text: '#DC2626' },
  warning: { bg: '#FEF3C7', text: '#D97706' },
  info: { bg: '#DBEAFE', text: '#2563EB' },
  neutral: { bg: '#F3F4F6', text: '#6B7280' },
  primary: { bg: '#FEF2EC', text: '#FF6835' },
  open: { bg: '#D1FAE5', text: '#059669' },
  closed: { bg: '#F3F4F6', text: '#6B7280' },
  pending: { bg: '#FEF3C7', text: '#D97706' },
  confirmed: { bg: '#DBEAFE', text: '#2563EB' },
  preparing: { bg: '#EDE9FE', text: '#7C3AED' },
  ready: { bg: '#D1FAE5', text: '#059669' },
  delivering: { bg: '#FEF3C7', text: '#D97706' },
  delivered: { bg: '#D1FAE5', text: '#059669' },
  cancelled: { bg: '#FEE2E2', text: '#DC2626' },
  active: { bg: '#D1FAE5', text: '#059669' },
  suspended: { bg: '#FEE2E2', text: '#DC2626' },
  completed: { bg: '#D1FAE5', text: '#059669' },
};

export function Badge({ label, variant = 'neutral', size = 'sm' }: BadgeProps) {
  const { bg, text } = COLORS[variant] ?? COLORS.neutral;
  return (
    <View style={[styles.badge, { backgroundColor: bg }, size === 'md' && styles.md]}>
      <Text style={[styles.label, { color: text }, size === 'md' && styles.labelMd]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  md: { paddingHorizontal: 12, paddingVertical: 5 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  labelMd: { fontSize: 13 },
});
