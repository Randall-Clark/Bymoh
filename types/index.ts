// ── Exporter tout ce qui existait déjà ────────────────────────────────────────

// ── Nouvelles catégories avec emojis (utilisées dans search + step1) ──────────
export const SECTEURS = [
  { id: 'restaurant', label: 'Restaurants',      emoji: '🍽️' },
  { id: 'artisan',    label: 'Artisans',         emoji: '🧵' },
  { id: 'beaute',     label: 'Hygiène & Beauté', emoji: '💆' },
  { id: 'sante',      label: 'Santé',            emoji: '🏥' },
  { id: 'education',  label: 'Éducation',        emoji: '📚' },
  { id: 'automobile', label: 'Automobile',       emoji: '🚗' },
  { id: 'tech',       label: 'Tech & Gadgets',   emoji: '💻' },
  { id: 'nettoyage',  label: 'Nettoyage',        emoji: '🧹' },
  { id: 'mode',       label: 'Vêtement & Mode',  emoji: '👗' },
  { id: 'epicerie',   label: 'Épicerie',         emoji: '🛒' },
  { id: 'maison',     label: 'Maison & Jardin',  emoji: '🏡' },
  { id: 'ouvrier',    label: 'Ouvriers',         emoji: '🛠️' },
  { id: 'animalier',  label: 'Animalier',        emoji: '🐶' },
  { id: 'divers',     label: 'Divers',           emoji: '📦' },
] as const;

export type SecteurId  = typeof SECTEURS[number]['id'];

// ── Villes disponibles ────────────────────────────────────────────────────────
export const ALL_CITIES = [
  { id: 'cotonou',    name: 'Cotonou',    flag: '🇧🇯', country: 'Bénin'         },
  { id: 'lome',       name: 'Lomé',       flag: '🇹🇬', country: 'Togo'          },
  { id: 'abidjan',    name: 'Abidjan',    flag: '🇨🇮', country: "Côte d'Ivoire" },
  { id: 'dakar',      name: 'Dakar',      flag: '🇸🇳', country: 'Sénégal'       },
  { id: 'accra',      name: 'Accra',      flag: '🇬🇭', country: 'Ghana'         },
  { id: 'douala',     name: 'Douala',     flag: '🇨🇲', country: 'Cameroun'      },
  { id: 'bamako',     name: 'Bamako',     flag: '🇲🇱', country: 'Mali'          },
  { id: 'ouaga',      name: 'Ouagadougou',flag: '🇧🇫', country: 'Burkina Faso'  },
  { id: 'niamey',     name: 'Niamey',     flag: '🇳🇪', country: 'Niger'         },
] as const;

export const DAY_LABELS = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi',
  'Vendredi', 'Samedi', 'Dimanche',
];

// ── Types utilisateur ─────────────────────────────────────────────────────────
export type UserRole = 'client' | 'pro' | 'admin';

export interface Profile {
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: UserRole;
  avatar_url?: string;
  pin_hash?: string;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  // Adresse de livraison
  delivery_address?: string;
  delivery_city?: string;
  delivery_lat?: number;
  delivery_lon?: number;
  // Préférences
  notification_prefs?: Record<string, boolean>;
}

// ── Types business ────────────────────────────────────────────────────────────
export type BookingType  = 'none' | 'instant' | 'manual';
export type BookingMode  = BookingType;
export type BillingType  = 'fixed' | 'hourly' | 'quote';

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  category: SecteurId;
  category_icon?: string;
  description?: string;
  phone: string;
  email?: string;
  address?: string;
  city?: string;
  cover_url?: string;
  rating: number;
  review_count: number;
  has_delivery: boolean;
  is_open: boolean;
  is_active: boolean;
  is_verified: boolean;
  forfait_paid: boolean;
  open_hour?: string;
  close_hour?: string;
  booking_mode: BookingMode;
  latitude?: number;
  longitude?: number;
  employee_count?: number;
  hours?: BusinessHour[];
  created_at: string;
  updated_at?: string;
}

export interface BusinessHour {
  id: string;
  business_id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
}

export interface Service {
  id: string;
  business_id: string;
  title: string;
  description?: string;
  price?: number;
  currency?: string;
  image_url?: string;
  duration_minutes?: number;
  billing_type?: BillingType;
  allows_booking: boolean;
  is_available: boolean;
}
