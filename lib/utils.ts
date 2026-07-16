import type { BusinessHours } from '@/types';

/** Merge Tailwind class names (simple implementation) */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Format a price in FCFA */
export function formatPrice(amount: number, currency = 'FCFA'): string {
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}

/** Format a date string to French locale */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Format a date string as short form */
export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

/** Check if a business is currently open based on its hours */
export function isBusinessOpen(hours: BusinessHours[] | undefined): boolean {
  if (!hours || hours.length === 0) return false;
  const now = new Date();
  const day = now.getDay();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  const today = hours.find((h) => h.day_of_week === day);
  if (!today || !today.is_open || !today.open_time || !today.close_time) return false;
  return time >= today.open_time && time <= today.close_time;
}

/** Generate time slots for booking */
export function generateTimeSlots(openTime = '08:00', closeTime = '18:00', intervalMin = 30): string[] {
  const slots: string[] = [];
  const [startH, startM] = openTime.split(':').map(Number);
  const [endH, endM] = closeTime.split(':').map(Number);
  let h = startH;
  let m = startM;
  while (h < endH || (h === endH && m <= endM)) {
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    m += intervalMin;
    if (m >= 60) { h += 1; m -= 60; }
  }
  return slots;
}

/** Get relative time string */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'à l\'instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}
