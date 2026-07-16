/** User row in public.users (mirrors auth.users.id via id field) */
export interface Profile {
  id: string;
  phone: string;
  name: string;
  email?: string;
  role: 'client' | 'pro' | 'admin';
  avatar_url?: string;
  is_active: boolean;
  pin_hash?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface BusinessHours {
  id: string;
  business_id: string;
  day_of_week: number; // 0=Sunday … 6=Saturday
  is_open: boolean;
  open_time?: string;  // "09:00"
  close_time?: string; // "18:00"
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  category: string;
  category_icon?: string;
  sector?: string;
  description?: string;
  phone?: string;
  email?: string;
  address: string;
  city: string;
  cover_url?: string;
  rating: number;
  review_count: number;
  has_delivery: boolean;
  is_open: boolean;
  open_hour: string;
  close_hour: string;
  is_active: boolean;
  is_verified: boolean;
  forfait_paid: boolean;
  latitude?: number;
  longitude?: number;
  created_at: string;
  hours?: BusinessHours[];
}

/** Row in public.services (catalogue d'articles/prestations) */
export interface CatalogItem {
  id: string;
  business_id: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  image_url?: string;
  duration_minutes?: number;
  is_available: boolean;
  kind?: string;
  billing_type?: string;
  allows_booking: boolean;
  category?: string;
  unit?: string;
  stock_qty?: number;
  show_stock: boolean;
}

export interface CartItem {
  service_id: string;
  title: string;
  price: number;
  quantity: number;
  business_id: string;
  business_name: string;
  kind?: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export type DeliveryMethod = 'pickup' | 'gozem' | 'yango';

export interface Order {
  id: string;
  user_id: string;
  business_id: string;
  status: OrderStatus;
  delivery_method: DeliveryMethod;
  delivery_address?: string;
  delivery_fee: number;
  subtotal: number;
  total: number;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  service_id?: string;
  title: string;
  quantity: number;
  unit_price: number;
  currency: string;
}

export interface Booking {
  id: string;
  user_id: string;
  business_id: string;
  service_id?: string;
  booking_type?: string;
  date: string;
  time: string;
  party_size?: number;
  notes?: string;
  status: BookingStatus;
  created_at: string;
  updated_at?: string;
}

export interface DeliveryEstimate {
  provider: 'gozem' | 'yango';
  price: number;
  duration_minutes: number;
  currency: string;
}

export const CATEGORIES = [
  { id: 'restaurant', label: 'Restaurants', icon: 'coffee' },
  { id: 'artisan', label: 'Artisans', icon: 'tool' },
  { id: 'beauty', label: 'Beauté', icon: 'scissors' },
  { id: 'health', label: 'Santé', icon: 'heart' },
  { id: 'education', label: 'Formation', icon: 'book' },
  { id: 'auto', label: 'Auto', icon: 'truck' },
  { id: 'tech', label: 'Tech & IT', icon: 'monitor' },
  { id: 'cleaning', label: 'Nettoyage', icon: 'home' },
  { id: 'fashion', label: 'Mode', icon: 'shopping-bag' },
  { id: 'food', label: 'Épicerie', icon: 'shopping-cart' },
] as const;

export const ALL_CITIES = [
  { id: 'abidjan', name: 'Abidjan', country: "Côte d'Ivoire", flag: '🇨🇮' },
  { id: 'accra', name: 'Accra', country: 'Ghana', flag: '🇬🇭' },
  { id: 'bamako', name: 'Bamako', country: 'Mali', flag: '🇲🇱' },
  { id: 'cotonou', name: 'Cotonou', country: 'Bénin', flag: '🇧🇯' },
  { id: 'dakar', name: 'Dakar', country: 'Sénégal', flag: '🇸🇳' },
  { id: 'douala', name: 'Douala', country: 'Cameroun', flag: '🇨🇲' },
  { id: 'lome', name: 'Lomé', country: 'Togo', flag: '🇹🇬' },
  { id: 'ouagadougou', name: 'Ouagadougou', country: 'Burkina Faso', flag: '🇧🇫' },
  { id: 'yaounde', name: 'Yaoundé', country: 'Cameroun', flag: '🇨🇲' },
] as const;

export const DAY_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

export const TIME_SLOTS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00',
];
