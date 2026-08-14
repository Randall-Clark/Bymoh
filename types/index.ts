// ── Catégories avec icônes Feather (compatibilité ancienne) ───────────────────
export const CATEGORIES = [
  { id: 'restaurant',  label: 'Restaurants',     icon: 'coffee'        },
  { id: 'artisan',     label: 'Artisans',         icon: 'tool'          },
  { id: 'beaute',      label: 'Hygiène & Beauté', icon: 'feather'       },
  { id: 'sante',       label: 'Santé',            icon: 'heart'         },
  { id: 'education',   label: 'Éducation',        icon: 'book-open'     },
  { id: 'automobile',  label: 'Automobile',       icon: 'truck'         },
  { id: 'tech',        label: 'Tech & Gadgets',   icon: 'cpu'           },
  { id: 'nettoyage',   label: 'Nettoyage',        icon: 'wind'          },
  { id: 'mode',        label: 'Vêtement & Mode',  icon: 'shopping-bag'  },
  { id: 'epicerie',    label: 'Épicerie',         icon: 'shopping-cart' },
  { id: 'maison',      label: 'Maison & Jardin',  icon: 'home'          },
  { id: 'ouvrier',     label: 'Ouvriers',         icon: 'settings'      },
  { id: 'animalier',   label: 'Animalier',        icon: 'github'        },
  { id: 'divers',      label: 'Divers',           icon: 'grid'          },
] as const;

// ── Catégories avec emojis (utilisées dans search + step1 + dashboard) ────────
export const SECTEURS = [
  { id: 'restaurant',  label: 'Restaurants',     emoji: '🍽️' },
  { id: 'artisan',     label: 'Artisans',         emoji: '🧵' },
  { id: 'beaute',      label: 'Hygiène & Beauté', emoji: '💆' },
  { id: 'sante',       label: 'Santé',            emoji: '🏥' },
  { id: 'education',   label: 'Éducation',        emoji: '📚' },
  { id: 'automobile',  label: 'Automobile',       emoji: '🚗' },
  { id: 'tech',        label: 'Tech & Gadgets',   emoji: '💻' },
  { id: 'nettoyage',   label: 'Nettoyage',        emoji: '🧹' },
  { id: 'mode',        label: 'Vêtement & Mode',  emoji: '👗' },
  { id: 'epicerie',    label: 'Épicerie',         emoji: '🛒' },
  { id: 'maison',      label: 'Maison & Jardin',  emoji: '🏡' },
  { id: 'ouvrier',     label: 'Ouvriers',         emoji: '🛠️' },
  { id: 'animalier',   label: 'Animalier',        emoji: '🐶' },
  { id: 'divers',      label: 'Divers',           emoji: '📦' },
] as const;

export type CategoryId = typeof CATEGORIES[number]['id'];
export type SecteurId  = typeof SECTEURS[number]['id'];

// ── Villes disponibles ────────────────────────────────────────────────────────
export const ALL_CITIES = [
  { id: 'cotonou',  name: 'Cotonou',     flag: '🇧🇯', country: 'Bénin'          },
  { id: 'lome',     name: 'Lomé',        flag: '🇹🇬', country: 'Togo'           },
  { id: 'abidjan',  name: 'Abidjan',     flag: '🇨🇮', country: "Côte d'Ivoire"  },
  { id: 'dakar',    name: 'Dakar',       flag: '🇸🇳', country: 'Sénégal'        },
  { id: 'accra',    name: 'Accra',       flag: '🇬🇭', country: 'Ghana'          },
  { id: 'douala',   name: 'Douala',      flag: '🇨🇲', country: 'Cameroun'       },
  { id: 'bamako',   name: 'Bamako',      flag: '🇲🇱', country: 'Mali'           },
  { id: 'ouaga',    name: 'Ouagadougou', flag: '🇧🇫', country: 'Burkina Faso'   },
  { id: 'niamey',   name: 'Niamey',      flag: '🇳🇪', country: 'Niger'          },
] as const;

export const DAY_LABELS = [
  'Lundi', 'Mardi', 'Mercredi', 'Jeudi',
  'Vendredi', 'Samedi', 'Dimanche',
];

export type DayOfWeek = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

// ── Types utilisateur ─────────────────────────────────────────────────────────
export type UserRole = 'client' | 'pro' | 'admin';

export interface Profile {
  id:                   string;
  phone:                string;
  name:                 string;
  email?:               string;
  role:                 UserRole;
  avatar_url?:          string;
  pin_hash?:            string;
  is_active:            boolean;
  created_at:           string;
  updated_at?:          string;
  // Localisation
  country?:             string;
  country_code?:        string;
  // Adresse de livraison
  delivery_address?:    string;
  delivery_city?:       string;
  delivery_lat?:        number;
  delivery_lon?:        number;
  // Préférences
  notification_prefs?:  Record<string, boolean>;
}

// ── Horaires ──────────────────────────────────────────────────────────────────
/**
 * Correspond exactement à la table business_hours en DB.
 * day_of_week : 0 = Dimanche, 1 = Lundi … 6 = Samedi (convention JS Date.getDay())
 * is_closed   : true = fermé ce jour (colonne DB — PAS is_open)
 */
export interface BusinessHour {
  id:          string;
  business_id: string;
  day_of_week: DayOfWeek;
  open_time:   string;   // "08:00"
  close_time:  string;   // "18:00"
  is_closed:   boolean;  // ✅ is_closed, pas is_open
}

// Alias pour compatibilité (certains anciens fichiers utilisent BusinessHours)
export type BusinessHours = BusinessHour;

// ── Types business ────────────────────────────────────────────────────────────
export type BookingMode = 'table' | 'service' | 'none';
export type BillingType = 'fixed' | 'hourly' | 'quote';

export interface Business {
  id:             string;
  owner_id:       string;
  name:           string;
  tag?:           string;          // ✅ tag unique #XX123
  category:       string;
  category_icon?: string;
  sector?:        string;
  description?:   string;
  phone:          string;
  email?:         string;
  address?:       string;
  city?:          string;
  cover_url?:     string;
  rating:         number;
  review_count:   number;
  has_delivery:   boolean;
  is_open:        boolean;
  is_active:      boolean;
  is_verified:    boolean;
  forfait_paid:   boolean;
  open_hour?:     string;
  close_hour?:    string;
  booking_mode:   BookingMode;
  latitude?:      number;
  longitude?:     number;
  employee_count?: number;
  paused_at?:     string;
  hours?:         BusinessHour[];  // ✅ relation business_hours chargée avec select('*')
  created_at:     string;
  updated_at?:    string;
}

// ── Services / Catalogue ──────────────────────────────────────────────────────
export interface Service {
  id:                 string;
  business_id:        string;
  title:              string;
  description?:       string;
  price?:             number;
  currency?:          string;
  image_url?:         string;
  duration_minutes?:  number;
  billing_type?:      BillingType;
  allows_booking:     boolean;
  is_available:       boolean;
  kind?:              string;
  unit?:              string;
  stock_qty?:         number;
  show_stock?:        boolean;
  created_at?:        string;
}

// Alias
export type CatalogItem = Service;

// ── Commandes ─────────────────────────────────────────────────────────────────
export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export interface Order {
  id:          string;
  business_id: string;
  user_id:     string;
  status:      OrderStatus;
  total:       number;
  currency?:   string;
  note?:       string;
  created_at:  string;
  updated_at?: string;
}

// ── Réservations ──────────────────────────────────────────────────────────────
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id:          string;
  business_id: string;
  user_id:     string;
  service_id?: string;
  status:      BookingStatus;
  date:        string;
  time?:       string;
  note?:       string;
  created_at:  string;
}

// ── Avis ──────────────────────────────────────────────────────────────────────
export interface Review {
  id:          string;
  business_id: string;
  user_id:     string;
  rating:      number;
  comment?:    string;
  created_at:  string;
}

// ── Portefeuille ──────────────────────────────────────────────────────────────
export type WalletType        = 'personal' | 'business';
export type TransactionType   = 'credit' | 'debit';
export type TransactionStatus = 'pending' | 'completed' | 'failed';

export interface Wallet {
  id:           string;
  user_id:      string;
  wallet_type:  WalletType;
  balance:      number;
  currency:     string;
  created_at:   string;
  updated_at?:  string;
}

export interface WalletTransaction {
  id:          string;
  wallet_id:   string;
  type:        TransactionType;
  amount:      number;
  status:      TransactionStatus;
  description?: string;
  reference?:  string;
  created_at:  string;
}