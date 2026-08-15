import type { BusinessHour } from '@/types';

const JS_TO_ENUM: Record<number, string> = {
  0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat',
};

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatPrice(amount: number, currency = 'FCFA'): string {
  return `${amount.toLocaleString('fr-FR')} ${currency}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });
}

export function formatDateShort(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'short',
  });
}

/**
 * Vérifie si un commerce est ouvert maintenant.
 *
 * ⚠️  Utilise TOUJOURS le fuseau horaire du COMMERCE (timezone),
 * pas celui de l'appareil de l'utilisateur.
 *
 * Exemple : boutique à Cotonou (Africa/Porto-Novo, UTC+1),
 * utilisateur au Canada (UTC-4) → on compare l'heure de Cotonou.
 *
 * @param hours    - business_hours depuis Supabase
 * @param timezone - fuseau du commerce, ex: 'Africa/Porto-Novo'
 */
export function isBusinessOpen(
  hours:    BusinessHour[] | undefined,
  timezone?: string | null,
): boolean {
  if (!hours || hours.length === 0) return false;

  const now = new Date();
  const tz  = timezone || 'Africa/Porto-Novo'; // défaut : Bénin

  let dayKey: string;
  let nowMin: number;

  try {
    // ✅ Heure dans le fuseau du COMMERCE via Intl
    const parts = Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday:  'short',   // 'Mon', 'Tue'...
      hour:     '2-digit',
      minute:   '2-digit',
      hour12:   false,
    }).formatToParts(now);

    dayKey = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const h = parseInt(parts.find((p) => p.type === 'hour')?.value   ?? '0', 10) % 24;
    const m = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    nowMin  = h * 60 + m;

  } catch {
    // Fallback : heure locale de l'appareil
    const jsDay = now.getDay();
    dayKey = JS_TO_ENUM[jsDay];
    nowMin = now.getHours() * 60 + now.getMinutes();
  }

  // Cherche le jour — supporte string ('Fri') ET number (5)
  const todayHours = hours.find((entry: any) =>
    entry.day_of_week === dayKey ||
    entry.day_of_week === JS_TO_ENUM[now.getDay()]
  );

  if (!todayHours) return false;

  const isClosed =
    (todayHours as any).is_closed === true ||
    (todayHours as any).is_open   === false;
  if (isClosed) return false;

  const open  = todayHours.open_time;
  const close = todayHours.close_time;
  if (!open || !close) return false;

  const [oh, om] = open.split(':').map(Number);
  const [ch, cm] = close.split(':').map(Number);

  return nowMin >= oh * 60 + om && nowMin < ch * 60 + cm;
}

export function generateTimeSlots(
  openTime = '08:00', closeTime = '18:00', intervalMin = 30,
): string[] {
  const slots: string[] = [];
  const [sh, sm] = openTime.split(':').map(Number);
  const [eh, em] = closeTime.split(':').map(Number);
  let h = sh, m = sm;
  while (h < eh || (h === eh && m <= em)) {
    slots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    m += intervalMin;
    if (m >= 60) { h += 1; m -= 60; }
  }
  return slots;
}

export function timeAgo(dateStr: string): string {
  const diff    = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1)  return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)   return `il y a ${hours}h`;
  return `il y a ${Math.floor(hours / 24)}j`;
}
