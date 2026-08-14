import type { BusinessHour } from '@/types';

// Mapping JS getDay() → enum DB
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
 * Utilise Intl.DateTimeFormat pour une conversion de timezone fiable.
 * @param hours    - Horaires depuis business_hours
 * @param timezone - Ex: 'Africa/Porto-Novo'. Par défaut Bénin.
 */
export function isBusinessOpen(
  hours:    BusinessHour[] | undefined,
  timezone?: string | null,
): boolean {
  if (!hours || hours.length === 0) return false;

  const tz = timezone || undefined;
  try {
    const now = new Date();

    // Récupère heure + jour dans le fuseau de la boutique via Intl
    const parts = Intl.DateTimeFormat('en-US', {
       ...(tz ? { timeZone: tz } : {}),
      weekday:  'short',
      hour:     '2-digit',
      minute:   '2-digit',
      hour12:   false,
    }).formatToParts(now);

    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const hourStr    = parts.find((p) => p.type === 'hour')?.value   ?? '0';
    const minuteStr  = parts.find((p) => p.type === 'minute')?.value ?? '0';

    // Intl peut retourner '24' pour minuit sur certains systèmes
    const h      = parseInt(hourStr, 10) % 24;
    const m      = parseInt(minuteStr, 10);
    const nowMin = h * 60 + m;

    // Intl weekday court : 'Mon', 'Tue'... correspond exactement à nos enums DB
    const todayKey = weekdayStr; // 'Wed', 'Thu'...

    // Cherche le jour — supporte string ('Wed') ET number (ancien format)
    const jsDay = now.getDay(); // fallback numérique
    const todayHours = hours.find((entry: any) =>
      entry.day_of_week === todayKey ||
      entry.day_of_week === JS_TO_ENUM[jsDay] ||
      entry.day_of_week === jsDay
    );

    if (!todayHours) return false;

    // Supporte is_closed (DB actuelle) ET is_open (ancien format)
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

  } catch (e) {
    // Fallback sans timezone si Intl échoue (ex: vieux devices)
    const now    = new Date();
    const jsDay  = now.getDay();
    const today  = JS_TO_ENUM[jsDay];
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const todayHours = hours.find((entry: any) =>
      entry.day_of_week === today || entry.day_of_week === jsDay
    );
    if (!todayHours) return false;
    if ((todayHours as any).is_closed === true) return false;

    const [oh, om] = todayHours.open_time.split(':').map(Number);
    const [ch, cm] = todayHours.close_time.split(':').map(Number);
    return nowMin >= oh * 60 + om && nowMin < ch * 60 + cm;
  }
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
